// Migrated from Upstash Redis to Turso (libSQL). `getRedis()` now returns a
// Redis-compatible KV adapter backed by Turso so existing call sites keep
// working; the former Lua `eval` scripts are reimplemented as libSQL
// transactions in this file.
import { getKV, getTurso, ensureSchema, type KV } from "@/lib/turso";

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
  provider?: string;
  model?: string;
  mode?: string;
  openaiKey?: string;
  googleKey?: string;
};

const PREFIX = "apple-juice:session:";
const IP_PREFIX = "apple-juice:ip:";
const USAGE_PREFIX = "apple-juice:usage:";
const BONUS_ML_PREFIX = "apple-juice:bonus-ml:";
const TRANSFER_LIMIT_PREFIX = "apple-juice:transfers:";

// ─── mL of Juice Economy ─────────────────────────────────────────────────────
// 1000 Input Tokens  = 1 mL of Juice
// 1000 Output Tokens = 6 mL of Juice  (AI output costs 6x more)
// Daily allowances are NON-stackable (reset every day).
// Bonus mL from Juice Box purchases ARE stackable.
export const OUTPUT_ML_MULTIPLIER = 6;

export const PLAN_LIMITS = {
  free: {
    dailyMl: 1_000,
    maxProjects: 2,
    maxChatTransfers: 0,
  },
  fresh_pro: {
    dailyMl: 5_000,
    maxProjects: 3,
    maxChatTransfers: 3,
  },
  pure_ultra: {
    dailyMl: 15_000,
    maxProjects: 8,
    maxChatTransfers: 5,
  },
} as const;

export const MODEL_MULTIPLIERS: Record<string, number> = {
  // ── Kiro lineup (primary) — keyed by both display label and api id ──
  "Claude Opus 4.8": 2.2, "claude-opus-4.8": 2.2,
  "Claude Opus 4.7": 2.2, "claude-opus-4.7": 2.2,
  "Claude Opus 4.6": 2.2, "claude-opus-4.6": 2.2,
  "Claude Opus 4.5": 2.2, "claude-opus-4.5": 2.2,
  "Auto": 1.0, "auto": 1.0,
  "Claude Sonnet 4.6": 1.3, "claude-sonnet-4.6": 1.3,
  "Claude Sonnet 4.5": 1.3, "claude-sonnet-4.5": 1.3,
  "Claude Sonnet 4.0": 1.3, "claude-sonnet-4.0": 1.3,
  "GLM-5": 0.5, "glm-5": 0.5,
  "Claude Haiku 4.5": 0.4, "claude-haiku-4.5": 0.4,
  "MiniMax M2.5": 0.25, "minimax-m2.5": 0.25,
  "DeepSeek 3.2": 0.25, "deepseek-3.2": 0.25,
  "MiniMax M2.1": 0.15, "minimax-m2.1": 0.15,
  "Qwen3 Coder Next": 0.05, "qwen3-coder-next": 0.05,

  // ── Legacy provider models (kept for custom-key users) ──
  "gemini-2.5-flash": 1,
  "gemini-2.0-flash": 1,
  "gemini-1.5-flash": 1,
  "gemini-2.5-pro": 4,
  "gemini-1.5-pro": 4,
  "gpt-4o": 5,
  "gpt-4o-mini": 1,
  "o1-preview": 15,
  "o1-mini": 4,
  "deepseek-v3": 1,
  "deepseek-r1": 2,
};

export type UserPlan = keyof typeof PLAN_LIMITS;

/**
 * Calculate mL of Juice consumed from raw token counts.
 * Formula: ((inputTokens * 1 + outputTokens * 6) / 1000) * modelMultiplier
 */
export function calculateMlUsed(
  inputTokens: number,
  outputTokens: number,
  model?: string,
): number {
  const multiplier = model ? MODEL_MULTIPLIERS[model] || 1 : 1;
  const raw = inputTokens + outputTokens * OUTPUT_ML_MULTIPLIER;
  // Ceiling to ensure at least 1 mL is used for tiny requests
  return Math.max(1, Math.ceil((raw / 1000) * multiplier));
}

/**
 * Calculate the max output tokens we can allow given remaining mL.
 * Formula: (remainingMl * 1000) / 6
 */
export function calculateMaxOutputTokens(remainingMl: number): number {
  return Math.max(0, Math.floor((remainingMl * 1000) / OUTPUT_ML_MULTIPLIER));
}

let _kvWrap: KV | null = null;

/**
 * Back-compat shim: returns a Redis-like client. Historically this returned an
 * Upstash Redis instance; it now returns the Turso-backed KV adapter, which
 * implements the same get/set/del/expire/incr/decr/incrby/decrby surface the
 * app uses. Callers that used `.eval(...)` now go through the dedicated
 * transaction-based functions below instead.
 */
export function getRedis(): KV {
  if (_kvWrap) return _kvWrap;
  _kvWrap = getKV();
  return _kvWrap;
}

function keyFor(sessionKey: string) {
  return `${PREFIX}${sessionKey}`;
}

export function ipKeyFor(ip: string) {
  return `${IP_PREFIX}${ip}`;
}

function normalizeIp(ip: string): string {
  if (!ip) return "unknown";
  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }
  return ip;
}

/**
 * Extract the real client IP.
 *
 * Behind Cloudflare, `x-forwarded-for` carries a Cloudflare EDGE IP that
 * differs between requests (browser vs Studio plugin hit different edge
 * nodes), which broke IP-based auto-pairing. Cloudflare passes the true client
 * IP in `cf-connecting-ip` / `true-client-ip`, so we prefer those.
 */
export function extractIp(req: Request): string {
  const h = req.headers;
  // Cloudflare's real-client-IP headers take priority.
  const cf = h.get("cf-connecting-ip") || h.get("true-client-ip");
  if (cf) return normalizeIp(cf.trim());

  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be "client, proxy1, proxy2" — take the first.
    return normalizeIp(forwarded.split(",")[0].trim());
  }
  return normalizeIp(h.get("x-real-ip") || "unknown");
}

export async function createOrReplaceSession(
  entry: SessionEntry,
): Promise<SessionEntry> {
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
    console.warn(
      "Failed to set TTL on session key",
      e instanceof Error ? e.message : String(e),
    );
  }
  return entry;
}

export async function getSession(
  sessionKey: string,
): Promise<SessionEntry | undefined> {
  const key = keyFor(sessionKey);
  const raw = await getRedis().get(key);
  if (!raw) return undefined;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : (raw as SessionEntry);
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

    // Check if the dashboard is currently active (pinged within the last 60 seconds)
    const lastPing = session.dashboardLastPingTime || 0;
    if (Date.now() - lastPing > 60000) return null;

    return sessionKey;
  } catch {
    return null;
  }
}

export async function updateSession(
  sessionKey: string,
  updates: Partial<SessionEntry>,
) {
  const key = keyFor(sessionKey);
  const client = getTurso();
  await ensureSchema();
  const tx = await client.transaction("write");
  try {
    const now = Date.now();
    const rs = await tx.execute({
      sql: `SELECT value FROM kv WHERE key = ?`,
      args: [key],
    });
    if (!rs.rows.length) {
      await tx.rollback();
      return null;
    }
    const sess = JSON.parse(String(rs.rows[0].value)) as SessionEntry &
      Record<string, unknown>;

    // Apply updates; an explicit null deletes the field (mirrors cjson.null).
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === undefined) {
        delete (sess as Record<string, unknown>)[k];
      } else {
        (sess as Record<string, unknown>)[k] = v;
      }
    }

    const encoded = JSON.stringify(sess);
    const expiresAt =
      typeof sess.expiresAt === "number" ? sess.expiresAt : null;
    await tx.execute({
      sql: `UPDATE kv SET value = ?, expires_at = ? WHERE key = ?`,
      args: [encoded, expiresAt && expiresAt > now ? expiresAt : null, key],
    });
    await tx.commit();
    return sess as SessionEntry;
  } catch (err) {
    try { await tx.rollback(); } catch { /* ignore */ }
    console.error(
      "updateSession error",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export async function upsertGeneratedCode(
  sessionKey: string,
  code: string,
  messageId: string,
  autoAccept: boolean = true,
) {
  const key = keyFor(sessionKey);
  await ensureSchema();
  const tx = await getTurso().transaction("write");
  try {
    const rs = await tx.execute({
      sql: `SELECT value, expires_at FROM kv WHERE key = ?`,
      args: [key],
    });
    if (!rs.rows.length) {
      await tx.rollback();
      return null;
    }
    const sess = JSON.parse(String(rs.rows[0].value)) as SessionEntry;
    const exp = rs.rows[0].expires_at == null ? null : Number(rs.rows[0].expires_at);

    sess.messageId = messageId;
    if (autoAccept) {
      sess.code = code;
      sess.hasNewCode = true;
      sess.pendingCode = undefined;
    } else {
      sess.pendingCode = code;
      sess.hasNewCode = false;
    }
    await tx.execute({
      sql: `UPDATE kv SET value = ?, expires_at = ? WHERE key = ?`,
      args: [JSON.stringify(sess), exp, key],
    });
    await tx.commit();
    return sess;
  } catch (err) {
    try { await tx.rollback(); } catch { /* ignore */ }
    console.error(
      "upsertGeneratedCode error",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export async function acceptPendingCode(sessionKey: string) {
  const key = keyFor(sessionKey);
  await ensureSchema();
  const tx = await getTurso().transaction("write");
  try {
    const rs = await tx.execute({
      sql: `SELECT value, expires_at FROM kv WHERE key = ?`,
      args: [key],
    });
    if (!rs.rows.length) {
      await tx.rollback();
      return null;
    }
    const sess = JSON.parse(String(rs.rows[0].value)) as SessionEntry;
    const exp = rs.rows[0].expires_at == null ? null : Number(rs.rows[0].expires_at);
    if (sess.pendingCode) {
      sess.code = sess.pendingCode;
      sess.hasNewCode = true;
      sess.pendingCode = undefined;
      await tx.execute({
        sql: `UPDATE kv SET value = ?, expires_at = ? WHERE key = ?`,
        args: [JSON.stringify(sess), exp, key],
      });
    }
    await tx.commit();
    return sess;
  } catch (err) {
    try { await tx.rollback(); } catch { /* ignore */ }
    console.error("acceptPendingCode error", err);
    return null;
  }
}

export async function consumeCode(sessionKey: string) {
  const key = keyFor(sessionKey);
  const now = Date.now();
  await ensureSchema();
  const tx = await getTurso().transaction("write");
  try {
    const rs = await tx.execute({
      sql: `SELECT value, expires_at FROM kv WHERE key = ?`,
      args: [key],
    });
    if (!rs.rows.length) {
      await tx.rollback();
      return { ok: false as const, reason: "not_found" as const };
    }
    const sess = JSON.parse(String(rs.rows[0].value)) as SessionEntry;
    const exp = rs.rows[0].expires_at == null ? null : Number(rs.rows[0].expires_at);

    if (typeof sess.expiresAt === "number" && sess.expiresAt < now) {
      await tx.rollback();
      return { ok: false as const, reason: "expired" as const };
    }

    const payload = {
      hasNewCode: sess.hasNewCode,
      code: sess.code,
      messageId: sess.messageId,
      requestedFile: sess.requestedFile,
      dashboardLastPingTime: sess.dashboardLastPingTime,
    };

    sess.hasNewCode = false;
    sess.requestedFile = undefined;
    sess.lastPollTime = now;

    await tx.execute({
      sql: `UPDATE kv SET value = ?, expires_at = ? WHERE key = ?`,
      args: [JSON.stringify(sess), exp, key],
    });
    await tx.commit();
    return { ok: true as const, payload };
  } catch (err) {
    try { await tx.rollback(); } catch { /* ignore */ }
    console.error(
      "consumeCode error",
      err instanceof Error ? err.message : String(err),
    );
    return { ok: false as const, reason: "not_found" as const };
  }
}

export async function appendLogs(sessionKey: string, newLogs: string[]) {
  if (!newLogs || newLogs.length === 0) return { ok: true };
  const key = keyFor(sessionKey);
  await ensureSchema();
  const tx = await getTurso().transaction("write");
  try {
    const rs = await tx.execute({
      sql: `SELECT value, expires_at FROM kv WHERE key = ?`,
      args: [key],
    });
    if (!rs.rows.length) {
      await tx.rollback();
      return { ok: false, reason: "not_found" };
    }
    const sess = JSON.parse(String(rs.rows[0].value)) as SessionEntry;
    const exp = rs.rows[0].expires_at == null ? null : Number(rs.rows[0].expires_at);
    if (!sess.logs) sess.logs = [];
    for (const l of newLogs) {
      sess.logs.push(l);
      if (sess.logs.length > 100) sess.logs.shift();
    }
    await tx.execute({
      sql: `UPDATE kv SET value = ?, expires_at = ? WHERE key = ?`,
      args: [JSON.stringify(sess), exp, key],
    });
    await tx.commit();
    return { ok: true };
  } catch (err) {
    try { await tx.rollback(); } catch { /* ignore */ }
    console.error("appendLogs error", err);
    return { ok: false, reason: "error" };
  }
}

export async function consumeLogs(sessionKey: string) {
  const key = keyFor(sessionKey);
  await ensureSchema();
  const tx = await getTurso().transaction("write");
  try {
    const rs = await tx.execute({
      sql: `SELECT value, expires_at FROM kv WHERE key = ?`,
      args: [key],
    });
    if (!rs.rows.length) {
      await tx.rollback();
      return { ok: false, reason: "not_found" };
    }
    const sess = JSON.parse(String(rs.rows[0].value)) as SessionEntry;
    const exp = rs.rows[0].expires_at == null ? null : Number(rs.rows[0].expires_at);
    const logs = sess.logs || [];
    sess.logs = [];
    await tx.execute({
      sql: `UPDATE kv SET value = ?, expires_at = ? WHERE key = ?`,
      args: [JSON.stringify(sess), exp, key],
    });
    await tx.commit();
    return { ok: true, logs };
  } catch (err) {
    try { await tx.rollback(); } catch { /* ignore */ }
    console.error("consumeLogs error", err);
    return { ok: false, reason: "error" };
  }
}

export function usageKeyFor(userId: string) {
  const date = new Date();
  const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`; // YYYY-MM-DD
  return `${USAGE_PREFIX}${userId}:${dayKey}`;
}

export async function setUserUsage(userId: string, usedMl: number) {
  const redis = getRedis();
  const key = usageKeyFor(userId);
  await redis.set(key, usedMl);
  // Set expiry to 40 days to keep the monthly key alive
  await redis.expire(key, 60 * 60 * 24 * 40);
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

  // Cap is always the plan's daily limit
  const totalMl = limits.dailyMl;
  const remainingMl = Math.max(0, totalMl - usedMl);

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
  const key = usageKeyFor(userId);
  const redis = getRedis();
  try {
    await redis.incrby(key, mlUsed);
    // Set expiry to 40 days to keep the monthly key alive
    await redis.expire(key, 60 * 60 * 24 * 40);
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
 * Reduces the daily "used" counter so the tank refills, capped at the plan limit.
 */
export async function grantBonusMl(userId: string, ml: number) {
  if (ml <= 0) return;
  const key = usageKeyFor(userId);
  const redis = getRedis();
  try {
    const current = (await redis.get<number>(key)) || 0;
    // Refill by reducing used count, but never go below 0 (can't exceed plan cap)
    const toDeduct = Math.min(current, ml);
    if (toDeduct > 0) {
      await redis.decrby(key, toDeduct);
    }
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
  status?: "active" | "archived";
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

function projectMessagesKeyFor(projectId: string, index: number = 0) {
  return `${PROJECT_MESSAGES_PREFIX}${projectId}${index > 0 ? `:${index}` : ""}`;
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
export async function createProject(
  userId: string,
  name: string,
): Promise<Project> {
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
      projectIds = (
        typeof rawIndex === "string" ? JSON.parse(rawIndex) : rawIndex
      ) as string[];
    } catch {
      /* corrupted */
    }
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
    projectIds = (
      typeof rawIndex === "string" ? JSON.parse(rawIndex) : rawIndex
    ) as string[];
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
      } catch {
        /* skip corrupted */
      }
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
export async function updateProject(
  projectId: string,
  updates: Partial<Project>,
): Promise<Project | null> {
  const redis = getRedis();
  const key = projectKeyFor(projectId);
  const raw = await redis.get(key);
  if (!raw) return null;

  try {
    const project = (
      typeof raw === "string" ? JSON.parse(raw) : raw
    ) as Project;
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
export async function deleteProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
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
      let projectIds = (
        typeof rawIndex === "string" ? JSON.parse(rawIndex) : rawIndex
      ) as string[];
      projectIds = projectIds.filter((id) => id !== projectId);
      await redis.set(indexKey, JSON.stringify(projectIds));
    } catch {
      /* ignore */
    }
  }

  return true;
}

/**
 * Save messages for a project. Replaces the entire message array.
 */
export async function saveProjectMessages(
  projectId: string,
  messages: ProjectMessage[],
  chatIndex: number = 0
): Promise<void> {
  const redis = getRedis();
  // Only keep the last 200 messages to avoid hitting Redis limits
  const trimmed = messages.slice(-200);
  await redis.set(projectMessagesKeyFor(projectId, chatIndex), JSON.stringify(trimmed));
  // Also touch lastActiveAt on the project
  const projKey = projectKeyFor(projectId);
  const raw = await redis.get(projKey);
  if (raw) {
    try {
      const project = (
        typeof raw === "string" ? JSON.parse(raw) : raw
      ) as Project;
      project.lastActiveAt = Date.now();
      await redis.set(projKey, JSON.stringify(project));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Load messages for a project.
 */
export async function getProjectMessages(
  projectId: string,
  chatIndex: number = 0
): Promise<ProjectMessage[]> {
  const raw = await getRedis().get(projectMessagesKeyFor(projectId, chatIndex));
  if (!raw) return [];
  try {
    return (
      typeof raw === "string" ? JSON.parse(raw) : raw
    ) as ProjectMessage[];
  } catch {
    return [];
  }
}

/**
 * Transfer a chat thread from one project to another.
 */
export async function transferProjectChat(
  userId: string,
  sourceProjectId: string,
  sourceChatIndex: number,
  targetProjectId: string,
  targetChatIndex: number
): Promise<{ ok: boolean; error?: string }> {
  const redis = getRedis();

  // Check plan limits
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  
  if (limits.maxChatTransfers === 0) {
    return { ok: false, error: "Chat transfers are not available on your current plan." };
  }

  // Check daily limit
  const date = new Date().toISOString().split("T")[0];
  const transferKey = `${TRANSFER_LIMIT_PREFIX}${userId}:${date}`;
  const usedTransfers = (await redis.get<number>(transferKey)) || 0;

  if (usedTransfers >= limits.maxChatTransfers) {
    return { ok: false, error: `Daily transfer limit reached (${limits.maxChatTransfers}).` };
  }

  // Load source messages
  const sourceMessages = await getProjectMessages(sourceProjectId, sourceChatIndex);
  if (sourceMessages.length === 0) {
    return { ok: false, error: "Source chat is empty." };
  }

  // Save to target
  await saveProjectMessages(targetProjectId, sourceMessages, targetChatIndex);
  
  // Track transfer
  await redis.incr(transferKey);
  await redis.expire(transferKey, 86400); // 1 day

  return { ok: true };
}

// ─── Security: rate limiting & one-time redemption ────────────────────────────

const RATE_PREFIX = "apple-juice:rate:";
const REDEEM_PREFIX = "apple-juice:redeemed:";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
};

/**
 * Fixed-window rate limiter backed by Redis INCR + EXPIRE.
 *
 * @param bucket   Logical bucket name (e.g. "redeem", "insert").
 * @param id       Per-caller identifier (IP, sessionKey, or userId).
 * @param limit    Max allowed actions within the window.
 * @param windowSec Window length in seconds.
 *
 * Fails OPEN (allows the request) if Redis is unavailable, matching the
 * resilience posture of the rest of the store, but never throws.
 */
export async function checkRateLimit(
  bucket: string,
  id: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const safeId = (id || "unknown").replace(/\s+/g, "_").slice(0, 120);
  const windowStart = Math.floor(Date.now() / 1000 / windowSec);
  const key = `${RATE_PREFIX}${bucket}:${safeId}:${windowStart}`;
  try {
    const redis = getRedis();
    const count = await redis.incr(key);
    // Only set the TTL on first hit in this window.
    if (count === 1) {
      await redis.expire(key, windowSec);
    }
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining, limit };
  } catch {
    // Redis down / not configured — don't block legitimate traffic.
    return { allowed: true, remaining: limit, limit };
  }
}

/**
 * Returns true if this user has already redeemed the given code (replay guard).
 */
export async function hasRedeemed(userId: string, code: string): Promise<boolean> {
  const key = `${REDEEM_PREFIX}${userId}:${code.trim().toLowerCase()}`;
  try {
    const v = await getRedis().get(key);
    return v != null;
  } catch {
    // If we can't verify, treat as not-yet-redeemed (fail open for usability),
    // but redemption itself is still gated by the code check.
    return false;
  }
}

/**
 * Marks a code as redeemed for a user so it can't be farmed repeatedly.
 */
export async function markRedeemed(userId: string, code: string): Promise<void> {
  const key = `${REDEEM_PREFIX}${userId}:${code.trim().toLowerCase()}`;
  try {
    await getRedis().set(key, Date.now());
  } catch {
    /* best-effort */
  }
}
