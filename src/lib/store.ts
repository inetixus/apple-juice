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

/**
 * mL of Juice charged per real Kiro credit, when the proxy reports actual
 * credit usage (agent/MCP paths). This anchors billing to ground-truth cost
 * instead of token estimates. Tune so your margins hold: e.g. if a credit
 * costs you ~$0.02–0.04 and you want a clear markup, pick an mL value that maps
 * a credit to noticeably more than its share of the user's plan. Overridable
 * via ML_PER_KIRO_CREDIT env (falls back to 1000 = "1 credit ≈ 1000 mL").
 */
export const ML_PER_KIRO_CREDIT = Number(process.env.ML_PER_KIRO_CREDIT) || 1000;

/**
 * Convert real Kiro credits (from the proxy footer) into mL to charge.
 * Applies the model multiplier so a heavier model still costs proportionally
 * more, matching the estimate-based path. Floors at 1 mL.
 */
export function mlFromCredits(credits: number, model?: string): number {
  if (!Number.isFinite(credits) || credits <= 0) return 0;
  const multiplier = model ? MODEL_MULTIPLIERS[model] || 1 : 1;
  return Math.max(1, Math.ceil(credits * ML_PER_KIRO_CREDIT * multiplier));
}

export const PLAN_LIMITS = {
  free: {
    dailyMl: 1_000,
    maxProjects: 2,
    maxChatTransfers: 0,
    // Monthly hard ceiling (cost guardrail). Tune against your real mL→credit
    // ratio so maxMonthlyMl × worstCostPerMl < the plan's price. 0 = no cap.
    maxMonthlyMl: 20_000,
  },
  // Partner: invite-only tier between Free and Pro. Granted manually to
  // partnered creators/studios — NOT purchasable. Sits above Free on
  // allowance/projects/transfers, but uses the same model access as Free.
  partner: {
    dailyMl: 3_000,
    maxProjects: 3,
    maxChatTransfers: 2,
    maxMonthlyMl: 60_000,
  },
  fresh_pro: {
    dailyMl: 5_000,
    maxProjects: 3,
    maxChatTransfers: 3,
    maxMonthlyMl: 110_000,
  },
  pure_ultra: {
    dailyMl: 15_000,
    maxProjects: 8,
    maxChatTransfers: 5,
    maxMonthlyMl: 350_000,
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
 * Recommended Studio-plugin poll interval (seconds) by plan. Higher tiers poll
 * faster, so generated code + MCP commands land in Studio with less latency —
 * a concrete "priority speed" benefit beyond the generation-start queue. The
 * plugin clamps to its own min/max, so these are advisory. Tuned so the cost
 * (extra poll QPS) scales with plan value.
 */
export const PLAN_POLL_INTERVAL: Record<UserPlan, number> = {
  free: 0.4,
  partner: 0.25,
  fresh_pro: 0.15,
  pure_ultra: 0.1,
};

/** Look up the recommended Studio poll interval for a user's plan. */
export async function getPollIntervalForUser(userId: string): Promise<number> {
  try {
    const plan = await getUserPlan(userId);
    return PLAN_POLL_INTERVAL[plan] ?? PLAN_POLL_INTERVAL.free;
  } catch {
    return PLAN_POLL_INTERVAL.free;
  }
}

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
      ownerUserId: sess.ownerUserId,
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

/**
 * Monthly usage key (YYYY-MM). Backs the per-user MONTHLY mL ceiling, which is
 * the real cost guardrail: daily allowances reset every day with no monthly
 * bound, so without this a single user could run all month and push aggregate
 * Kiro credit burn into paid overage. The daily key drives the UX "fuel gauge";
 * this monthly key is the hard cap.
 */
export function monthlyUsageKeyFor(userId: string) {
  const date = new Date();
  const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`; // YYYY-M
  return `${USAGE_PREFIX}monthly:${userId}:${monthKey}`;
}

export async function setUserUsage(userId: string, usedMl: number) {
  const redis = getRedis();
  const key = usageKeyFor(userId);
  await redis.set(key, usedMl);
  // Set expiry to 40 days to keep the monthly key alive
  await redis.expire(key, 60 * 60 * 24 * 40);
}

/** Current month-to-date mL consumed (for the monthly ceiling). */
export async function getMonthlyUsage(userId: string): Promise<number> {
  try {
    return (await getRedis().get<number>(monthlyUsageKeyFor(userId))) || 0;
  } catch {
    return 0;
  }
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
  const dailyRemainingMl = Math.max(0, totalMl - usedMl);

  // Monthly ceiling (cost guardrail). When set (>0), the effective remaining is
  // the SMALLER of the daily and monthly remaining — so a user can't exceed the
  // monthly cap even if they have daily allowance left.
  const maxMonthlyMl = (limits as { maxMonthlyMl?: number }).maxMonthlyMl ?? 0;
  const monthlyUsedMl = maxMonthlyMl > 0
    ? ((await redis.get<number>(monthlyUsageKeyFor(userId))) || 0)
    : 0;
  const monthlyRemainingMl = maxMonthlyMl > 0
    ? Math.max(0, maxMonthlyMl - monthlyUsedMl)
    : Infinity;

  const remainingMl = Math.max(0, Math.min(dailyRemainingMl, monthlyRemainingMl));
  const monthlyCapped = maxMonthlyMl > 0 && monthlyRemainingMl <= 0 && dailyRemainingMl > 0;

  return {
    usedMl,
    dailyMl: limits.dailyMl,
    bonusMl,
    totalMl,
    remainingMl,
    // Monthly ceiling visibility
    maxMonthlyMl,
    monthlyUsedMl,
    monthlyRemainingMl: maxMonthlyMl > 0 ? monthlyRemainingMl : 0,
    monthlyCapped,

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
  const monthlyKey = monthlyUsageKeyFor(userId);
  const redis = getRedis();
  try {
    await redis.incrby(key, mlUsed);
    // Set expiry to 40 days to keep the monthly key alive
    await redis.expire(key, 60 * 60 * 24 * 40);
    // Also track month-to-date usage for the monthly ceiling (cost guardrail).
    await redis.incrby(monthlyKey, mlUsed);
    await redis.expire(monthlyKey, 60 * 60 * 24 * 40);
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
    // Also relieve the monthly counter so a purchased refill actually lets a
    // monthly-capped user keep building (not just the daily tank).
    const monthlyKey = monthlyUsageKeyFor(userId);
    const monthlyCurrent = (await redis.get<number>(monthlyKey)) || 0;
    const monthlyDeduct = Math.min(monthlyCurrent, ml);
    if (monthlyDeduct > 0) {
      await redis.decrby(monthlyKey, monthlyDeduct);
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

// ─── Moderation: bans & warnings ─────────────────────────────────────────────
//
// Admin moderation state, keyed per user. Bans are enforced at the chat route
// (and anywhere else that calls isUserBanned). Warnings are advisory notices
// surfaced to the user. An audit log records every admin action for review.

const BAN_PREFIX = "apple-juice:ban:";
const WARN_PREFIX = "apple-juice:warnings:";
const AUDIT_KEY = "apple-juice:admin-audit";

export type BanRecord = {
  banned: true;
  reason: string;
  bannedBy: string;
  bannedAt: number;
  /** Epoch ms when the ban lifts; omitted/0 = permanent. */
  expiresAt?: number;
  /** Whether the user is allowed to submit an appeal. */
  appealable?: boolean;
  /** Also block this user's last-known IP. */
  ipBan?: boolean;
  /** The IP that was banned (when ipBan is set). */
  bannedIp?: string;
  /** Appeal text submitted by the user, if any. */
  appeal?: { text: string; submittedAt: number };
};

export type WarningRecord = {
  id: string;
  reason: string;
  warnedBy: string;
  warnedAt: number;
  acknowledged?: boolean;
};

export type AdminAuditEntry = {
  id: string;
  action: string;
  targetUserId: string;
  adminUserId: string;
  detail?: string;
  at: number;
};

function banKeyFor(userId: string) {
  return `${BAN_PREFIX}${userId}`;
}
function warnKeyFor(userId: string) {
  return `${WARN_PREFIX}${userId}`;
}

/** Ban a user. durationDays <= 0 (or omitted) = permanent. */
export async function banUser(
  userId: string,
  reason: string,
  bannedBy: string,
  opts?: {
    durationDays?: number;
    appealable?: boolean;
    ipBan?: boolean;
    /** Last-known IP to also block when ipBan is set. */
    ip?: string;
  },
): Promise<BanRecord> {
  const now = Date.now();
  const record: BanRecord = {
    banned: true,
    reason: reason || "No reason provided",
    bannedBy,
    bannedAt: now,
    appealable: opts?.appealable ?? true,
  };
  const durationDays = opts?.durationDays;
  if (durationDays && durationDays > 0) {
    record.expiresAt = now + durationDays * 24 * 60 * 60 * 1000;
  }
  const redis = getRedis();

  // Optional IP ban — block the user's last-known IP too.
  if (opts?.ipBan && opts.ip && opts.ip !== "unknown") {
    record.ipBan = true;
    record.bannedIp = opts.ip;
    const ipBanRec = {
      ip: opts.ip,
      reason: record.reason,
      bannedBy,
      bannedAt: now,
      expiresAt: record.expiresAt,
    };
    await redis.set(ipBanKeyFor(opts.ip), JSON.stringify(ipBanRec));
    if (record.expiresAt) {
      const ttl = Math.ceil((record.expiresAt - now) / 1000);
      if (ttl > 0) await redis.expire(ipBanKeyFor(opts.ip), ttl);
    }
  }

  await redis.set(banKeyFor(userId), JSON.stringify(record));
  if (record.expiresAt) {
    const ttl = Math.ceil((record.expiresAt - now) / 1000);
    if (ttl > 0) await redis.expire(banKeyFor(userId), ttl);
  }
  return record;
}

const IP_BAN_PREFIX = "apple-juice:ipban:";
function ipBanKeyFor(ip: string) {
  return `${IP_BAN_PREFIX}${ip}`;
}

/** Is this IP banned? (auto-expires via TTL). */
export async function isIpBanned(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  try {
    return (await getRedis().get(ipBanKeyFor(ip))) != null;
  } catch {
    return false;
  }
}

/** Lift an IP ban. */
export async function unbanIp(ip: string): Promise<void> {
  if (!ip) return;
  try {
    await getRedis().del(ipBanKeyFor(ip));
  } catch {
    /* best-effort */
  }
}

/** Record/replace a user's appeal text on their ban record. */
export async function submitBanAppeal(
  userId: string,
  text: string,
): Promise<boolean> {
  const ban = await getBan(userId);
  if (!ban || !ban.appealable) return false;
  ban.appeal = { text: text.slice(0, 2000), submittedAt: Date.now() };
  try {
    const redis = getRedis();
    const remaining = ban.expiresAt
      ? Math.ceil((ban.expiresAt - Date.now()) / 1000)
      : 0;
    await redis.set(banKeyFor(userId), JSON.stringify(ban));
    if (remaining > 0) await redis.expire(banKeyFor(userId), remaining);
    return true;
  } catch {
    return false;
  }
}

/** Lift a user's ban. */
export async function unbanUser(userId: string): Promise<void> {
  try {
    await getRedis().del(banKeyFor(userId));
  } catch {
    /* best-effort */
  }
}

/** Returns the active ban record, or null if not banned (auto-expires). */
export async function getBan(userId: string): Promise<BanRecord | null> {
  try {
    const raw = await getRedis().get(banKeyFor(userId));
    if (!raw) return null;
    const rec = (typeof raw === "string" ? JSON.parse(raw) : raw) as BanRecord;
    if (rec.expiresAt && Date.now() > rec.expiresAt) {
      await unbanUser(userId);
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

export async function isUserBanned(userId: string): Promise<boolean> {
  return (await getBan(userId)) !== null;
}

/** Add a warning to a user's record. */
export async function warnUser(
  userId: string,
  reason: string,
  warnedBy: string,
): Promise<WarningRecord> {
  const warning: WarningRecord = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    reason: reason || "No reason provided",
    warnedBy,
    warnedAt: Date.now(),
  };
  const redis = getRedis();
  const raw = await redis.get(warnKeyFor(userId));
  let list: WarningRecord[] = [];
  if (raw) {
    try {
      list = (typeof raw === "string" ? JSON.parse(raw) : raw) as WarningRecord[];
    } catch {
      list = [];
    }
  }
  list.push(warning);
  if (list.length > 50) list = list.slice(-50);
  await redis.set(warnKeyFor(userId), JSON.stringify(list));
  return warning;
}

export async function getWarnings(userId: string): Promise<WarningRecord[]> {
  try {
    const raw = await getRedis().get(warnKeyFor(userId));
    if (!raw) return [];
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as WarningRecord[];
  } catch {
    return [];
  }
}

/** Clear all warnings for a user. */
export async function clearWarnings(userId: string): Promise<void> {
  try {
    await getRedis().del(warnKeyFor(userId));
  } catch {
    /* best-effort */
  }
}

/** Mark all of a user's warnings acknowledged (called when they view them). */
export async function acknowledgeWarnings(userId: string): Promise<void> {
  const redis = getRedis();
  const list = await getWarnings(userId);
  if (!list.length) return;
  for (const w of list) w.acknowledged = true;
  try {
    await redis.set(warnKeyFor(userId), JSON.stringify(list));
  } catch {
    /* best-effort */
  }
}

/** Append an entry to the admin audit log (most-recent-first, capped). */
export async function logAdminAction(
  entry: Omit<AdminAuditEntry, "id" | "at">,
): Promise<void> {
  const redis = getRedis();
  const full: AdminAuditEntry = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    at: Date.now(),
  };
  try {
    const raw = await redis.get(AUDIT_KEY);
    let list: AdminAuditEntry[] = [];
    if (raw) {
      try {
        list = (typeof raw === "string" ? JSON.parse(raw) : raw) as AdminAuditEntry[];
      } catch {
        list = [];
      }
    }
    list.unshift(full);
    if (list.length > 500) list = list.slice(0, 500);
    await redis.set(AUDIT_KEY, JSON.stringify(list));
  } catch {
    /* best-effort */
  }
}

export async function getAdminAudit(limit = 100): Promise<AdminAuditEntry[]> {
  try {
    const raw = await getRedis().get(AUDIT_KEY);
    if (!raw) return [];
    const list = (typeof raw === "string" ? JSON.parse(raw) : raw) as AdminAuditEntry[];
    return list.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Admin lookup: aggregate a user's moderation + account state in one call.
 */
export async function getAdminUserSnapshot(userId: string) {
  const [usage, ban, warnings] = await Promise.all([
    getUserUsage(userId),
    getBan(userId),
    getWarnings(userId),
  ]);
  return {
    userId,
    plan: usage.plan,
    usage: {
      usedMl: usage.usedMl,
      totalMl: usage.totalMl,
      remainingMl: usage.remainingMl,
      bonusMl: usage.bonusMl,
    },
    ban,
    warnings,
  };
}

// ─── Manual subscription verification (under-16 flow) ────────────────────────
//
// Under-16 users can't enter the 16+ shop game, so they purchase the Roblox
// subscription directly on roblox.com, then submit proof here (screenshots +
// details) for an admin to review and grant manually. Requests live in KV,
// indexed in a pending list for the admin review queue.

const SUBREQ_PREFIX = "apple-juice:subreq:";
const SUBREQ_INDEX = "apple-juice:subreq-index"; // JSON array of request ids (most recent first)

export type SubReqStatus = "pending" | "approved" | "rejected";

export type SubscriptionRequest = {
  id: string;
  /** Apple Juice account (Roblox userId from session) that gets the grant. */
  userId: string;
  /** Roblox username the user typed (for admin cross-check). */
  robloxUsername: string;
  /** Plan they claim to have subscribed to. */
  plan: UserPlan;
  /** Did they say they already cancelled the recurring sub? */
  cancelled: boolean;
  /** Screenshot data URLs (compressed client-side). */
  purchaseProof: string; // confirmation screenshot
  ownershipProof: string; // "already subscribed" screenshot
  status: SubReqStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNote?: string;
};

function subReqKeyFor(id: string) {
  return `${SUBREQ_PREFIX}${id}`;
}

function genReqId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Create a pending subscription verification request. */
export async function createSubscriptionRequest(
  input: Omit<SubscriptionRequest, "id" | "status" | "createdAt">,
): Promise<SubscriptionRequest> {
  const redis = getRedis();
  const req: SubscriptionRequest = {
    ...input,
    id: genReqId(),
    status: "pending",
    createdAt: Date.now(),
  };
  // Store the request (keep 60 days).
  await redis.set(subReqKeyFor(req.id), JSON.stringify(req));
  await redis.expire(subReqKeyFor(req.id), 60 * 60 * 24 * 60);

  // Prepend to the index.
  const rawIdx = await redis.get(SUBREQ_INDEX);
  let ids: string[] = [];
  if (rawIdx) {
    try {
      ids = (typeof rawIdx === "string" ? JSON.parse(rawIdx) : rawIdx) as string[];
    } catch {
      ids = [];
    }
  }
  ids.unshift(req.id);
  if (ids.length > 1000) ids = ids.slice(0, 1000);
  await redis.set(SUBREQ_INDEX, JSON.stringify(ids));
  return req;
}

export async function getSubscriptionRequest(
  id: string,
): Promise<SubscriptionRequest | null> {
  try {
    const raw = await getRedis().get(subReqKeyFor(id));
    if (!raw) return null;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as SubscriptionRequest;
  } catch {
    return null;
  }
}

/**
 * List subscription requests for the admin queue. By default returns the most
 * recent `limit` requests; pass status to filter. Strips the heavy image data
 * unless includeProof is set (the list view doesn't need full images).
 */
export async function listSubscriptionRequests(opts?: {
  status?: SubReqStatus;
  limit?: number;
  includeProof?: boolean;
}): Promise<SubscriptionRequest[]> {
  const limit = opts?.limit ?? 100;
  const redis = getRedis();
  const rawIdx = await redis.get(SUBREQ_INDEX);
  if (!rawIdx) return [];
  let ids: string[];
  try {
    ids = (typeof rawIdx === "string" ? JSON.parse(rawIdx) : rawIdx) as string[];
  } catch {
    return [];
  }

  const out: SubscriptionRequest[] = [];
  for (const id of ids) {
    if (out.length >= limit) break;
    const req = await getSubscriptionRequest(id);
    if (!req) continue;
    if (opts?.status && req.status !== opts.status) continue;
    if (!opts?.includeProof) {
      out.push({ ...req, purchaseProof: "", ownershipProof: "" });
    } else {
      out.push(req);
    }
  }
  return out;
}

/** Mark a request approved/rejected. Returns the updated request. */
export async function reviewSubscriptionRequest(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string,
  note?: string,
): Promise<SubscriptionRequest | null> {
  const req = await getSubscriptionRequest(id);
  if (!req) return null;
  req.status = status;
  req.reviewedAt = Date.now();
  req.reviewedBy = reviewedBy;
  if (note) req.reviewNote = note;
  const redis = getRedis();
  await redis.set(subReqKeyFor(id), JSON.stringify(req));
  await redis.expire(subReqKeyFor(id), 60 * 60 * 24 * 60);
  return req;
}

/** Count pending requests (for an admin badge). */
export async function countPendingSubscriptionRequests(): Promise<number> {
  const pending = await listSubscriptionRequests({ status: "pending", limit: 1000 });
  return pending.length;
}

// ─── User registry (who joined & when) ───────────────────────────────────────
//
// We record each user's first-seen timestamp + last-known IP/username so admins
// can see the full membership list and so IP bans have an IP to target.

const USER_PREFIX = "apple-juice:user:";
const USERS_INDEX = "apple-juice:users-index"; // JSON array of userIds (most recent first)

export type UserRecord = {
  userId: string;
  username?: string;
  firstSeen: number;
  lastSeen: number;
  lastIp?: string;
};

function userKeyFor(userId: string) {
  return `${USER_PREFIX}${userId}`;
}

/**
 * Record/refresh a user's presence. Called on dashboard load. Creates the
 * record + index entry on first sight, updates lastSeen/ip/username after.
 */
export async function recordUserSeen(
  userId: string,
  opts?: { username?: string; ip?: string },
): Promise<void> {
  if (!userId) return;
  const redis = getRedis();
  const now = Date.now();
  try {
    const raw = await redis.get(userKeyFor(userId));
    let rec: UserRecord;
    let isNew = false;
    if (raw) {
      rec = (typeof raw === "string" ? JSON.parse(raw) : raw) as UserRecord;
      rec.lastSeen = now;
      if (opts?.username) rec.username = opts.username;
      if (opts?.ip && opts.ip !== "unknown") rec.lastIp = opts.ip;
    } else {
      isNew = true;
      rec = {
        userId,
        username: opts?.username,
        firstSeen: now,
        lastSeen: now,
        lastIp: opts?.ip && opts.ip !== "unknown" ? opts.ip : undefined,
      };
    }
    await redis.set(userKeyFor(userId), JSON.stringify(rec));

    if (isNew) {
      const rawIdx = await redis.get(USERS_INDEX);
      let ids: string[] = [];
      if (rawIdx) {
        try {
          ids = (typeof rawIdx === "string" ? JSON.parse(rawIdx) : rawIdx) as string[];
        } catch {
          ids = [];
        }
      }
      ids.unshift(userId);
      if (ids.length > 5000) ids = ids.slice(0, 5000);
      await redis.set(USERS_INDEX, JSON.stringify(ids));
    }
  } catch {
    /* best-effort */
  }
}

export async function getUserRecord(userId: string): Promise<UserRecord | null> {
  try {
    const raw = await getRedis().get(userKeyFor(userId));
    if (!raw) return null;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as UserRecord;
  } catch {
    return null;
  }
}

/** True if this userId has ever signed in (exists in the registry). */
export async function isUserRegistered(userId: string): Promise<boolean> {
  return (await getUserRecord(userId)) !== null;
}

/**
 * Find a registered user by their Roblox username (case-insensitive). Only
 * matches users already in our registry (i.e. who have signed in). Returns the
 * record or null.
 */
export async function findUserByUsername(
  username: string,
): Promise<UserRecord | null> {
  const target = username.trim().toLowerCase();
  if (!target) return null;
  const users = await listUsers(5000);
  return (
    users.find((u) => (u.username || "").toLowerCase() === target) || null
  );
}

/** List registered users (most-recent-first) for the admin roster. */
export async function listUsers(limit = 200): Promise<UserRecord[]> {
  const redis = getRedis();
  try {
    const rawIdx = await redis.get(USERS_INDEX);
    if (!rawIdx) return [];
    let ids: string[];
    try {
      ids = (typeof rawIdx === "string" ? JSON.parse(rawIdx) : rawIdx) as string[];
    } catch {
      return [];
    }
    const out: UserRecord[] = [];
    for (const id of ids.slice(0, limit)) {
      const rec = await getUserRecord(id);
      if (rec) out.push(rec);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Find the most recent subscription request for a user (any status) so the
 * dashboard can tell them whether it was approved/rejected/still pending.
 */
export async function getLatestSubscriptionRequestForUser(
  userId: string,
): Promise<SubscriptionRequest | null> {
  const all = await listSubscriptionRequests({ limit: 1000 });
  const mine = all.filter((r) => r.userId === userId);
  if (!mine.length) return null;
  mine.sort((a, b) => (b.reviewedAt || b.createdAt) - (a.reviewedAt || a.createdAt));
  return mine[0];
}

// ─── Subscription tracking (Open Cloud verified) ─────────────────────────────
//
// When a user's Roblox subscription is verified active via Open Cloud, we store
// which product they're on + when we last confirmed it. A lazy re-check (on
// dashboard load, throttled) downgrades them to free if the subscription
// lapsed, so we never need an in-game purchase or a manual timer.

const SUBSCRIPTION_PREFIX = "apple-juice:subscription:";

export type UserSubscription = {
  /** The "EXP-..." subscription product id the user is subscribed to. */
  productId: string;
  /** Plan granted by this subscription. */
  plan: UserPlan;
  /** Last time we confirmed it active via Open Cloud (epoch ms). */
  lastVerifiedAt: number;
  /** Whether Roblox reported it will auto-renew. */
  willRenew?: boolean;
};

function subscriptionKeyFor(userId: string) {
  return `${SUBSCRIPTION_PREFIX}${userId}`;
}

export async function setUserSubscription(
  userId: string,
  sub: UserSubscription,
): Promise<void> {
  try {
    await getRedis().set(subscriptionKeyFor(userId), JSON.stringify(sub));
  } catch (err) {
    console.error("setUserSubscription error", err);
  }
}

export async function getUserSubscription(
  userId: string,
): Promise<UserSubscription | null> {
  try {
    const raw = await getRedis().get(subscriptionKeyFor(userId));
    if (!raw) return null;
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as UserSubscription;
  } catch {
    return null;
  }
}

export async function clearUserSubscription(userId: string): Promise<void> {
  try {
    await getRedis().del(subscriptionKeyFor(userId));
  } catch {
    /* best-effort */
  }
}
