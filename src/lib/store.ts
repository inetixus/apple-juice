import { Redis } from "@upstash/redis";

export type SessionEntry = {
  sessionKey: string;
  ownerUserId: string;
  expiresAt: number;
  hasNewCode: boolean;
  code: string;
  messageId: string;
  lastPollTime?: number;
  logs?: string[];
};

const PREFIX = "apple-juice:session:";

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (_redis) return _redis;
  // Prefer Vercel KV environment variable names, fallback to Upstash legacy names
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Create a minimal placeholder that throws when trying to use Redis so imports don't crash during build.
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

export async function createOrReplaceSession(entry: SessionEntry): Promise<SessionEntry> {
  const key = keyFor(entry.sessionKey);
  const value = JSON.stringify(entry);
  try {
    await getRedis().set(key, value);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error("Database Error: " + msg);
  }
  // set TTL to roughly match expiresAt for cleanup
  try {
    const ttl = Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    if (ttl > 0) await getRedis().expire(key, ttl);
  } catch (e) {
    // best-effort; don't fail the operation
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

export async function upsertGeneratedCode(sessionKey: string, code: string, messageId: string) {
  const key = keyFor(sessionKey);
  const lua = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then return nil end
    local sess = cjson.decode(raw)
    sess.code = ARGV[1]
    sess.messageId = ARGV[2]
    sess.hasNewCode = true
    redis.call("SET", KEYS[1], cjson.encode(sess))
    return cjson.encode(sess)
  `;

  try {
    const res = await getRedis().eval(lua, [key], [code, messageId]);
    if (!res) return null;
    return (typeof res === "string" ? JSON.parse(res) : res) as SessionEntry;
  } catch (err) {
    console.error("upsertGeneratedCode error", err instanceof Error ? err.message : String(err));
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
    local payload = { hasNewCode = sess.hasNewCode, code = sess.code, messageId = sess.messageId }
    sess.hasNewCode = false
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

// Note: This implementation uses Upstash Redis. Prefer setting KV_REST_API_URL
// and KV_REST_API_TOKEN (Vercel KV) or fallback to UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN in your environment (.env.local for local dev and
// in Vercel project settings for production). The keys are stored as JSON strings
// under the prefix `apple-juice:session:` and consumeCode is implemented
// using a Lua script (EVAL) to atomically read-and-clear the `hasNewCode` flag.
