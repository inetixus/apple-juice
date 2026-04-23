import { Redis } from "@upstash/redis";

export type SessionEntry = {
  pairingCode: string;
  ownerUserId: string;
  pairToken: string;
  expiresAt: number;
  hasNewCode: boolean;
  code: string;
  messageId: string;
};

const PREFIX = "apple-juice:session:";

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Create a minimal placeholder that throws when trying to use Redis so imports don't crash during build.
    const missing: Partial<Redis> = {
      set: async () => {
        throw new Error("Missing Upstash environment variables: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
      },
      get: async () => null,
      expire: async () => 0,
      eval: async () => {
        throw new Error("Missing Upstash environment variables: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
      },
    };
    _redis = missing as Redis;
    return _redis;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

function keyFor(code: string) {
  return `${PREFIX}${code}`;
}

export async function createOrReplaceSession(entry: SessionEntry): Promise<SessionEntry> {
  const key = keyFor(entry.pairingCode);
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

export async function getSession(pairingCode: string): Promise<SessionEntry | undefined> {
  const key = keyFor(pairingCode);
  const raw = await getRedis().get(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw as string) as SessionEntry;
  } catch (err) {
    console.warn("Failed to parse session JSON", err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

export async function upsertGeneratedCode(pairingCode: string, code: string, messageId: string) {
  const key = keyFor(pairingCode);
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
    return JSON.parse(res as string) as SessionEntry;
  } catch (err) {
    console.error("upsertGeneratedCode error", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function consumeIfAuthorized(pairingCode: string, pairToken: string) {
  const key = keyFor(pairingCode);
  const now = Date.now();
  const lua = `
    local raw = redis.call("GET", KEYS[1])
    if not raw then return cjson.encode({ok=false,reason="not_found"}) end
    local sess = cjson.decode(raw)
    if sess.pairToken ~= ARGV[1] then return cjson.encode({ok=false,reason="bad_token"}) end
    if tonumber(sess.expiresAt) < tonumber(ARGV[2]) then return cjson.encode({ok=false,reason="expired"}) end
    local payload = { hasNewCode = sess.hasNewCode, code = sess.code, messageId = sess.messageId }
    sess.hasNewCode = false
    redis.call("SET", KEYS[1], cjson.encode(sess))
    return cjson.encode({ok=true,payload=payload})
  `;

  try {
    const res = await getRedis().eval(lua, [key], [pairToken, String(now)]);
    if (!res) return { ok: false as const, reason: "not_found" as const };
    const parsed = JSON.parse(res as string);
    if (parsed.ok) return { ok: true as const, payload: parsed.payload };
    return { ok: false as const, reason: parsed.reason as "not_found" | "bad_token" | "expired" };
  } catch (err) {
    console.error("consumeIfAuthorized error", err instanceof Error ? err.message : String(err));
    return { ok: false as const, reason: "not_found" as const };
  }
}

// Note: This implementation uses Upstash Redis. Ensure you set UPSTASH_REDIS_REST_URL
// and UPSTASH_REDIS_REST_TOKEN in your environment (.env.local for local dev and
// in Vercel project settings for production). The keys are stored as JSON strings
// under the prefix `apple-juice:session:` and consumeIfAuthorized is implemented
// using a Lua script (EVAL) to atomically read-and-clear the `hasNewCode` flag.
