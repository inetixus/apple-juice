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

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_URL || !UPSTASH_TOKEN) {
  // Fail fast in dev/build if env vars are missing — clearer than obscure runtime errors.
  console.warn(
    "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not set. Sessions will not persist.",
  );
}

const redis = new Redis({ url: UPSTASH_URL || "", token: UPSTASH_TOKEN || "" });

function makeKey(pairingCode: string) {
  return `apple-juice:session:${pairingCode}`;
}

export async function createOrReplaceSession(entry: SessionEntry): Promise<SessionEntry> {
  const key = makeKey(entry.pairingCode);
  await redis.set(key, JSON.stringify(entry));
  // Set TTL to match expiresAt so sessions auto-expire in Redis
  try {
    const ttl = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    if (ttl > 0) await redis.expire(key, ttl);
  } catch (e) {
    // ignore TTL errors
  }
  return entry;
}

export async function getSession(pairingCode: string): Promise<SessionEntry | undefined> {
  const key = makeKey(pairingCode);
  const raw = await redis.get(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw as string) as SessionEntry;
  } catch (e) {
    console.warn("Failed to parse session JSON from Redis", e);
    return undefined;
  }
}

export async function upsertGeneratedCode(pairingCode: string, code: string, messageId: string) {
  const key = makeKey(pairingCode);
  const script = `
    local val = redis.call('GET', KEYS[1])
    if not val then return nil end
    local ttl = redis.call('TTL', KEYS[1])
    local obj = cjson.decode(val)
    obj.code = ARGV[1]
    obj.messageId = ARGV[2]
    obj.hasNewCode = true
    local new = cjson.encode(obj)
    redis.call('SET', KEYS[1], new)
    if ttl and ttl > 0 then redis.call('EXPIRE', KEYS[1], ttl) end
    return new
  `;

  const res = await redis.eval(script, [key], [code, messageId]);
  if (!res) return null;
  try {
    return JSON.parse(res as string) as SessionEntry;
  } catch (e) {
    console.warn("Failed to parse upsertGeneratedCode result", e);
    return null;
  }
}

export async function consumeIfAuthorized(pairingCode: string, pairToken: string) {
  const key = makeKey(pairingCode);
  const script = `
    local val = redis.call('GET', KEYS[1])
    if not val then return cjson.encode({ok=false, reason='not_found'}) end
    local obj = cjson.decode(val)
    if obj.pairToken ~= ARGV[1] then return cjson.encode({ok=false, reason='bad_token'}) end
    if tonumber(obj.expiresAt) < tonumber(ARGV[2]) then return cjson.encode({ok=false, reason='expired'}) end
    local payload = { hasNewCode = obj.hasNewCode, code = obj.code, messageId = obj.messageId }
    obj.hasNewCode = false
    local ttl = redis.call('TTL', KEYS[1])
    redis.call('SET', KEYS[1], cjson.encode(obj))
    if ttl and ttl > 0 then redis.call('EXPIRE', KEYS[1], ttl) end
    return cjson.encode({ok=true, payload=payload})
  `;

  const now = Date.now().toString();
  const res = await redis.eval(script, [key], [pairToken, now]);
  try {
    const parsed = JSON.parse(res as string);
    if (!parsed.ok) {
      return { ok: false as const, reason: parsed.reason as "not_found" | "bad_token" | "expired" };
    }
    return { ok: true as const, payload: parsed.payload };
  } catch (e) {
    console.error("consumeIfAuthorized: failed to parse redis response", e);
    return { ok: false as const, reason: "not_found" as const };
  }
}

// Note: This Upstash-backed store stores sessions as JSON strings under key
// `apple-juice:session:<pairingCode>`. For production, set the following env vars:
// - UPSTASH_REDIS_REST_URL
// - UPSTASH_REDIS_REST_TOKEN
// Install with: `npm install @upstash/redis`
