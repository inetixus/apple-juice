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

export const MAX_CREDITS_PER_DAY = 50;
export const TOKENS_PER_CREDIT = 1000;
export const MAX_TOKENS_PER_DAY = MAX_CREDITS_PER_DAY * TOKENS_PER_CREDIT;

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

function ipKeyFor(ip: string) {
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
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as SessionEntry;
  } catch (err) {
    console.warn("Failed to parse session JSON", err instanceof Error ? err.message : String(err));
    return undefined;
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
    for k, v in pairs(updates) do
      if v == cjson.null then
        sess[k] = nil
      else
        sess[k] = v
      end
    end
    redis.call("SET", KEYS[1], cjson.encode(sess))
    return cjson.encode(sess)
  `;
  try {
    const res = await getRedis().eval(lua, [key], [JSON.stringify(updates)]);
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
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `${USAGE_PREFIX}${userId}:${date}`;
}

export async function getUserUsage(userId: string) {
  const key = usageKeyFor(userId);
  const used = await getRedis().get<number>(key);
  return {
    usedTokens: used || 0,
    totalTokens: MAX_TOKENS_PER_DAY,
    usedCredits: Math.floor((used || 0) / TOKENS_PER_CREDIT),
    totalCredits: MAX_CREDITS_PER_DAY,
  };
}

export async function trackUserUsage(userId: string, tokens: number) {
  if (tokens <= 0) return;
  const key = usageKeyFor(userId);
  const redis = getRedis();
  try {
    await redis.incrby(key, tokens);
    // Set expiry to 48 hours to clean up old keys
    await redis.expire(key, 60 * 60 * 48);
  } catch (err) {
    console.error("trackUserUsage error", err);
  }
}

export async function grantBonusCredits(userId: string, credits: number) {
  if (credits <= 0) return;
  const key = usageKeyFor(userId);
  const redis = getRedis();
  try {
    // 1 credit = TOKENS_PER_CREDIT
    // Decrementing usage effectively grants credits
    const tokensToGrant = credits * TOKENS_PER_CREDIT;
    await redis.decrby(key, tokensToGrant);
  } catch (err) {
    console.error("grantBonusCredits error", err);
  }
}
