// @ts-ignore
import { Redis } from "@upstash/redis";

export type SessionEntry = {
  sessionKey: string;
  ownerUserId: string;
  clientIp: string;
  expiresAt: number;
  hasNewCode: boolean;
  code: string;
  messageId: string;
  lastPollTime?: number;
  dashboardLastPingTime?: number;
  logs?: string[];
  requestedFile?: string;
  fileResponse?: { name: string; content: string };
  pendingCode?: string;
};

const PREFIX = "apple-juice:session:";
const IP_PREFIX = "apple-juice:ip:";
const USAGE_PREFIX = "apple-juice:usage:";
const BONUS_ML_PREFIX = "apple-juice:bonus-ml:";

// ─── mL of Juice Economy ─────────────────────────────────────────────────────
// 1 Input Token  = 1 mL of Juice
// 1 Output Token = 6 mL of Juice  (AI output costs 6x more)
// Daily allowances are NON-stackable (reset every day).
// Bonus mL from Juice Box purchases ARE stackable.
export const OUTPUT_ML_MULTIPLIER = 6;

export const PLAN_LIMITS = {
  free: {
    dailyMl: 2_000,       // Free tier: 2,000 mL/day (DeepSeek only)
    maxProjects: 1,
  },
  fresh_pro: {
    dailyMl: 10_000,      // Fresh Pro: 10,000 mL/day
    maxProjects: 15,
  },
  pure_ultra: {
    dailyMl: 30_000,      // Pure Ultra: 30,000 mL/day
    maxProjects: 9999,
  },
} as const;

export type UserPlan = keyof typeof PLAN_LIMITS;

/**
 * Calculate mL of Juice consumed from raw token counts.
 * Formula: inputTokens * 1 + outputTokens * 6
 */
export function calculateMlUsed(inputTokens: number, outputTokens: number): number {
  return inputTokens + (outputTokens * OUTPUT_ML_MULTIPLIER);
}

/**
 * Calculate the max output tokens we can allow given remaining mL.
 * Formula: remainingMl / 6  (since each output token costs 6 mL)
 */
export function calculateMaxOutputTokens(remainingMl: number): number {
  return Math.max(0, Math.floor(remainingMl / OUTPUT_ML_MULTIPLIER));
}

let _redis: Redis | null = null;
export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const missingMsg =
      "Missing Redis credentials. Ensure KV_REST_API_URL or UPSTASH_REDIS_REST_URL is set in your environment.";
    const missing: Partial<Redis> = {
      set: async () => {
        throw new Error(missingMsg);
      },
      get: async () => null,
      expire: async () => 0,
      eval: async () => {
        throw new Error(missingMsg);
      },
    };
    _redis = missing as Redis;
    return _redis;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

function keyFor(sessionKey: string) {
  return `${PREFIX}${sessionKey}`;
}

export function ipKeyFor(ip: string) {
  return `${IP_PREFIX}${ip}`;
}

/**
 * Extract the client IP from standard proxy headers.
 */
export function extractIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be "client, proxy1, proxy2" — take the first
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export async function createOrReplaceSession(entry: SessionEntry): Promise<SessionEntry> {
  const key = keyFor(entry.sessionKey);
  const value = JSON.stringify(entry);
  const redis = getRedis();
  try {
    await redis.set(key, value);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error("Database Error: " + msg);
  }

  // Create IP → sessionKey index so the plugin can auto-discover by IP
  if (entry.clientIp && entry.clientIp !== "unknown") {
    try {
      await redis.set(ipKeyFor(entry.clientIp), entry.sessionKey);
    } catch {
      // best-effort
    }
  }

  // set TTL
  try {
    const ttl = Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    if (ttl > 0) {
      await redis.expire(key, ttl);
      if (entry.clientIp && entry.clientIp !== "unknown") {
        await redis.expire(ipKeyFor(entry.clientIp), ttl);
      }
    }
  } catch (e) {
    console.warn("Failed to set TTL on session key", e instanceof Error ? e.message : String(e));
  }
  return entry;
}

export async function getSession(sessionKey: string): Promise<SessionEntry | undefined> {
  const key = keyFor(sessionKey);
  const raw = await getRedis().get(key);
  if (!raw) return undefined;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw as SessionEntry;
  } catch {
    return undefined;
  }
}

// ─── Real-Time Priority Queue Tracking ────────────────────────────────────────

const ACTIVE_GEN_KEY = "apple-juice:active-generations";

export async function incrementActiveGenerations(): Promise<number> {
  try {
    return await getRedis().incr(ACTIVE_GEN_KEY);
  } catch {
    return 0; // fallback if redis fails
  }
}

export async function decrementActiveGenerations(): Promise<number> {
  try {
    const val = await getRedis().decr(ACTIVE_GEN_KEY);
    if (val < 0) {
      await getRedis().set(ACTIVE_GEN_KEY, 0);
      return 0;
    }
    return val;
  } catch {
    return 0;
  }
}

export async function getActiveGenerations(): Promise<number> {
  try {
    const val = await getRedis().get<number>(ACTIVE_GEN_KEY);
    return val || 0;
  } catch {
    return 0;
  }
}

/**
 * Look up a session by the client's IP address.
 * Returns the sessionKey if found, or null.
 */
export async function findSessionKeyByIp(ip: string): Promise<string | null> {
  if (!ip || ip === "unknown") return null;
  try {
    const raw = await getRedis().get(ipKeyFor(ip));
    if (!raw) return null;
    const sessionKey = typeof raw === "string" ? raw : String(raw);
    // Verify the session still exists
    const session = await getSession(sessionKey);
    if (!session) return null;
    if (Date.now() > session.expiresAt) return null;
    
    // Check if the dashboard is currently active (pinged within the last 20 seconds)
    const lastPing = session.dashboardLastPingTime || 0;
    if (Date.now() - lastPing > 20000) return null;

    return sessionKey;
  } catch {
    return null;
  }
}

export async function updateSession(sessionKey: string, updates: Partial<SessionEntry>) {
  const key = keyFor(sessionKey);
  const lua = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then return nil end
    local sess = cjson.decode(raw)
    local updates = cjson.decode(ARGV[1])
    local now = tonumber(ARGV[2])

    for k, v in pairs(updates) do
      if v == cjson.null then
        sess[k] = nil
      else
        sess[k] = v
      end
    end

    local encoded = cjson.encode(sess)
    if sess.expiresAt then
      local ttl = math.floor((tonumber(sess.expiresAt) - now) / 1000)
      if ttl > 0 then
        redis.call("SET", KEYS[1], encoded, "EX", ttl)
      else
        redis.call("SET", KEYS[1], encoded)
      end
    else
      redis.call("SET", KEYS[1], encoded)
    end
    return encoded
  `;
  try {
    const res = await getRedis().eval(lua, [key], [JSON.stringify(updates), String(Date.now())]);
    if (!res) return null;
    return (typeof res === "string" ? JSON.parse(res) : res) as SessionEntry;
  } catch (err) {
    console.error("updateSession error", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function upsertGeneratedCode(sessionKey: string, code: string, messageId: string, autoAccept: boolean = true) {
  const key = keyFor(sessionKey);
  const lua = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then return nil end
    local sess = cjson.decode(raw)
    sess.messageId = ARGV[2]
    if ARGV[3] == "true" then
      sess.code = ARGV[1]
      sess.hasNewCode = true
      sess.pendingCode = nil
    else
      sess.pendingCode = ARGV[1]
      sess.hasNewCode = false
    end
    redis.call("SET", KEYS[1], cjson.encode(sess))
    return cjson.encode(sess)
  `;

  try {
    const res = await getRedis().eval(lua, [key], [code, messageId, autoAccept ? "true" : "false"]);
    if (!res) return null;
    return (typeof res === "string" ? JSON.parse(res) : res) as SessionEntry;
  } catch (err) {
    console.error("upsertGeneratedCode error", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function acceptPendingCode(sessionKey: string) {
  const key = keyFor(sessionKey);
  const lua = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then return nil end
    local sess = cjson.decode(raw)
    if sess.pendingCode then
      sess.code = sess.pendingCode
      sess.hasNewCode = true
      sess.pendingCode = nil
      redis.call("SET", KEYS[1], cjson.encode(sess))
      return cjson.encode(sess)
    end
    return raw
  `;
  try {
    const res = await getRedis().eval(lua, [key], []);
    if (!res) return null;
    return (typeof res === "string" ? JSON.parse(res) : res) as SessionEntry;
  } catch (err) {
    console.error("acceptPendingCode error", err);
    return null;
  }
}

export async function consumeCode(sessionKey: string) {
  const key = keyFor(sessionKey);
  const now = Date.now();
  const lua = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then return cjson.encode({ok=false,reason="not_found"}) end
    local sess = cjson.decode(raw)
    if tonumber(sess.expiresAt) < tonumber(ARGV[1]) then return cjson.encode({ok=false,reason="expired"}) end
    local payload = { 
      hasNewCode = sess.hasNewCode, 
      code = sess.code, 
      messageId = sess.messageId,
      requestedFile = sess.requestedFile,
      dashboardLastPingTime = sess.dashboardLastPingTime
    }
    sess.hasNewCode = false
    sess.requestedFile = nil
    sess.lastPollTime = tonumber(ARGV[1])
    redis.call("SET", KEYS[1], cjson.encode(sess))
    return cjson.encode({ok=true,payload=payload})
  `;

  try {
    const res = await getRedis().eval(lua, [key], [String(now)]);
    if (!res) return { ok: false as const, reason: "not_found" as const };
    const parsed = typeof res === "string" ? JSON.parse(res) : res;
    if (parsed.ok) return { ok: true as const, payload: parsed.payload };
    return { ok: false as const, reason: parsed.reason as "not_found" | "expired" };
  } catch (err) {
    console.error("consumeCode error", err instanceof Error ? err.message : String(err));
    return { ok: false as const, reason: "not_found" as const };
  }
}

export async function appendLogs(sessionKey: string, newLogs: string[]) {
  if (!newLogs || newLogs.length === 0) return { ok: true };
  const key = keyFor(sessionKey);
  const logsJson = JSON.stringify(newLogs);
  const lua = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then return cjson.encode({ok=false,reason="not_found"}) end
    local sess = cjson.decode(raw)
    if not sess.logs then sess.logs = {} end
    local newLogs = cjson.decode(ARGV[1])
    for i=1, #newLogs do
      table.insert(sess.logs, newLogs[i])
      if #sess.logs > 100 then
        table.remove(sess.logs, 1)
      end
    end
    redis.call("SET", KEYS[1], cjson.encode(sess))
    return cjson.encode({ok=true})
  `;
  try {
    const res = await getRedis().eval(lua, [key], [logsJson]);
    const parsed = typeof res === "string" ? JSON.parse(res) : res;
    return parsed as { ok: boolean, reason?: string };
  } catch (err) {
    console.error("appendLogs error", err);
    return { ok: false, reason: "error" };
  }
}

export async function consumeLogs(sessionKey: string) {
  const key = keyFor(sessionKey);
  const lua = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then return cjson.encode({ok=false,reason="not_found"}) end
    local sess = cjson.decode(raw)
    local logs = sess.logs or {}
    sess.logs = {}
    redis.call("SET", KEYS[1], cjson.encode(sess))
    return cjson.encode({ok=true, logs=logs})
  `;
  try {
    const res = await getRedis().eval(lua, [key], []);
    const parsed = typeof res === "string" ? JSON.parse(res) : res;
    return parsed as { ok: boolean, logs?: string[], reason?: string };
  } catch (err) {
    console.error("consumeLogs error", err);
    return { ok: false, reason: "error" };
  }
}

function usageKeyFor(userId: string) {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${USAGE_PREFIX}${userId}:${date}`;
}

function bonusMlKeyFor(userId: string) {
  return `${BONUS_ML_PREFIX}${userId}`;
}

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const redis = getRedis();
  const plan = await redis.get<UserPlan>(`apple-juice:user-plan:${userId}`);
  return plan || "free";
}

export async function setUserPlan(userId: string, plan: UserPlan) {
  const redis = getRedis();
  await redis.set(`apple-juice:user-plan:${userId}`, plan);
}

/**
 * Get the user's current mL of Juice usage for today.
 * Returns daily allowance, used mL, remaining mL, and bonus mL.
 */
export async function getUserUsage(userId: string) {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const key = usageKeyFor(userId);
  const redis = getRedis();
  
  const usedMl = (await redis.get<number>(key)) || 0;
  const bonusMl = (await redis.get<number>(bonusMlKeyFor(userId))) || 0;

  // Calculate remaining from daily bucket vs bonus bucket
  const remainingDaily = Math.max(0, limits.dailyMl - usedMl);
  const remainingMl = remainingDaily + bonusMl;
  
  // Total available conceptually represents the current total tank
  const totalMl = limits.dailyMl + bonusMl;

  return {
    usedMl,
    dailyMl: limits.dailyMl,
    bonusMl,
    totalMl,
    remainingMl,
    maxOutputTokens: calculateMaxOutputTokens(remainingMl),
    plan,
    limits,
    // Legacy compat fields for frontend transition
    usedTokens: usedMl,
    totalTokens: totalMl,
    usedCredits: Math.floor(usedMl / 1000),
    totalCredits: Math.floor(totalMl / 1000),
  };
}

/**
 * Track mL consumption after an AI response.
 * Deducts from daily allowance first, then bonus mL.
 */
export async function trackMlUsage(userId: string, mlUsed: number) {
  if (mlUsed <= 0) return;
  
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  
  const key = usageKeyFor(userId);
  const bKey = bonusMlKeyFor(userId);
  const redis = getRedis();
  
  try {
    const currentUsed = (await redis.get<number>(key)) || 0;
    
    // Calculate how much of this consumption goes over the daily limit
    const remainingDaily = Math.max(0, limits.dailyMl - currentUsed);
    const consumedFromDaily = Math.min(mlUsed, remainingDaily);
    const consumedFromBonus = mlUsed - consumedFromDaily;
    
    // Always increment the daily usage key
    await redis.incrby(key, mlUsed);
    await redis.expire(key, 60 * 60 * 48); // 48h expiry
    
    // If we overflowed daily, permanently deduct from bonusMl key!
    if (consumedFromBonus > 0) {
      await redis.decrby(bKey, consumedFromBonus);
      
      // Ensure it doesn't go below 0
      const newBonus = await redis.get<number>(bKey);
      if (newBonus && newBonus < 0) {
        await redis.set(bKey, 0);
      }
    }
  } catch (err) {
    console.error("trackMlUsage error", err);
  }
}

/** @deprecated Use trackMlUsage instead */
export async function trackUserUsage(userId: string, tokens: number) {
  return trackMlUsage(userId, tokens);
}

/**
 * Grant bonus mL (Refill) — used for Juice Box purchases.
 * Bonus mL stacks infinitely and does not expire daily.
 */
export async function grantBonusMl(userId: string, ml: number) {
  if (ml <= 0) return;
  const key = bonusMlKeyFor(userId);
  const redis = getRedis();
  try {
    await redis.incrby(key, ml);
  } catch (err) {
    console.error("grantBonusMl error", err);
  }
}

/** @deprecated Use grantBonusMl instead */
export async function grantBonusCredits(userId: string, credits: number) {
  // Legacy: 1 credit ≈ 1000 mL
  return grantBonusMl(userId, credits * 1000);
}

/**
 * Consume bonus mL after daily allowance is exhausted.
 * Called internally when daily mL runs out but bonus exists.
 */
export async function consumeBonusMl(userId: string, ml: number) {
  if (ml <= 0) return;
  const key = bonusMlKeyFor(userId);
  const redis = getRedis();
  try {
    const current = (await redis.get<number>(key)) || 0;
    const newVal = Math.max(0, current - ml);
    await redis.set(key, newVal);
  } catch (err) {
    console.error("consumeBonusMl error", err);
  }
}

// ─── Multi-Project System ───────────────────────────────────────────────────

const PROJECT_PREFIX = "apple-juice:project:";
const USER_PROJECTS_PREFIX = "apple-juice:user-projects:";
const PROJECT_MESSAGES_PREFIX = "apple-juice:project-msgs:";

export type Project = {
  id: string;
  name: string;
  ownerUserId: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  createdAt: number;
  lastActiveAt: number;
};

export type ProjectMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  model?: string;
  scripts?: unknown[];
  thinking?: string;
};

function projectKeyFor(projectId: string) {
  return `${PROJECT_PREFIX}${projectId}`;
}

function userProjectsKeyFor(userId: string) {
  return `${USER_PROJECTS_PREFIX}${userId}`;
}

function projectMessagesKeyFor(projectId: string) {
  return `${PROJECT_MESSAGES_PREFIX}${projectId}`;
}

function generateProjectId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Create a new project for a user.
 */
export async function createProject(userId: string, name: string): Promise<Project> {
  const redis = getRedis();
  const id = generateProjectId();
  const now = Date.now();

  const project: Project = {
    id,
    name,
    ownerUserId: userId,
    createdAt: now,
    lastActiveAt: now,
  };

  // Store project data
  await redis.set(projectKeyFor(id), JSON.stringify(project));

  // Add to user's project index (stored as a JSON array of project IDs)
  const indexKey = userProjectsKeyFor(userId);
  const rawIndex = await redis.get(indexKey);
  let projectIds: string[] = [];
  if (rawIndex) {
    try {
      projectIds = (typeof rawIndex === "string" ? JSON.parse(rawIndex) : rawIndex) as string[];
    } catch { /* corrupted */ }
  }
  projectIds.push(id);
  await redis.set(indexKey, JSON.stringify(projectIds));

  return project;
}

/**
 * List all projects for a user.
 */
export async function listUserProjects(userId: string): Promise<Project[]> {
  const redis = getRedis();
  const indexKey = userProjectsKeyFor(userId);
  const rawIndex = await redis.get(indexKey);
  if (!rawIndex) return [];

  let projectIds: string[];
  try {
    projectIds = (typeof rawIndex === "string" ? JSON.parse(rawIndex) : rawIndex) as string[];
  } catch {
    return [];
  }

  const projects: Project[] = [];
  const validIds: string[] = [];

  for (const id of projectIds) {
    const raw = await redis.get(projectKeyFor(id));
    if (raw) {
      try {
        const p = (typeof raw === "string" ? JSON.parse(raw) : raw) as Project;
        projects.push(p);
        validIds.push(id);
      } catch { /* skip corrupted */ }
    }
  }

  // Clean up index if some projects were deleted
  if (validIds.length !== projectIds.length) {
    await redis.set(indexKey, JSON.stringify(validIds));
  }

  // Sort by lastActiveAt descending
  projects.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  return projects;
}

/**
 * Get a single project by ID.
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const raw = await getRedis().get(projectKeyFor(projectId));
  if (!raw) return null;
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as Project;
  } catch {
    return null;
  }
}

/**
 * Update a project's fields.
 */
export async function updateProject(projectId: string, updates: Partial<Project>): Promise<Project | null> {
  const redis = getRedis();
  const key = projectKeyFor(projectId);
  const raw = await redis.get(key);
  if (!raw) return null;

  try {
    const project = (typeof raw === "string" ? JSON.parse(raw) : raw) as Project;
    Object.assign(project, updates, { lastActiveAt: Date.now() });
    await redis.set(key, JSON.stringify(project));
    return project;
  } catch {
    return null;
  }
}

/**
 * Delete a project and its messages.
 */
export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const redis = getRedis();

  // Remove project data
  await redis.del(projectKeyFor(projectId));
  // Remove messages
  await redis.del(projectMessagesKeyFor(projectId));

  // Remove from user's project index
  const indexKey = userProjectsKeyFor(userId);
  const rawIndex = await redis.get(indexKey);
  if (rawIndex) {
    try {
      let projectIds = (typeof rawIndex === "string" ? JSON.parse(rawIndex) : rawIndex) as string[];
      projectIds = projectIds.filter(id => id !== projectId);
      await redis.set(indexKey, JSON.stringify(projectIds));
    } catch { /* ignore */ }
  }

  return true;
}

/**
 * Save messages for a project. Replaces the entire message array.
 */
export async function saveProjectMessages(projectId: string, messages: ProjectMessage[]): Promise<void> {
  const redis = getRedis();
  // Only keep the last 200 messages to avoid hitting Redis limits
  const trimmed = messages.slice(-200);
  await redis.set(projectMessagesKeyFor(projectId), JSON.stringify(trimmed));
  // Also touch lastActiveAt on the project
  const projKey = projectKeyFor(projectId);
  const raw = await redis.get(projKey);
  if (raw) {
    try {
      const project = (typeof raw === "string" ? JSON.parse(raw) : raw) as Project;
      project.lastActiveAt = Date.now();
      await redis.set(projKey, JSON.stringify(project));
    } catch { /* ignore */ }
  }
}

/**
 * Load messages for a project.
 */
export async function getProjectMessages(projectId: string): Promise<ProjectMessage[]> {
  const raw = await getRedis().get(projectMessagesKeyFor(projectId));
  if (!raw) return [];
  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as ProjectMessage[];
  } catch {
    return [];
  }
}
