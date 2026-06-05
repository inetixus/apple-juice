// Turso (libSQL) backing store + a Redis-compatible KV adapter.
//
// We migrated off Upstash Redis. To keep the large surface of existing call
// sites working, this exposes a `getKV()` adapter whose methods mirror the
// subset of the Upstash client the app used (get/set/del/expire/incr/...).
//
// TTL is emulated with an `expires_at` (epoch ms) column, checked lazily on
// read. Atomic read-modify-write (the old Lua `eval` scripts) is done with
// libSQL transactions in store.ts via getTurso().

import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

export function getTurso(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error(
      "Missing TURSO_DATABASE_URL. Set it (and TURSO_AUTH_TOKEN) in your environment.",
    );
  }
  _client = createClient({ url, authToken });
  return _client;
}

// Schema is created once per process (memoized promise).
let _schema: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (_schema) return _schema;
  _schema = (async () => {
    const client = getTurso();
    await client.execute(
      `CREATE TABLE IF NOT EXISTS kv (
         key TEXT PRIMARY KEY,
         value TEXT NOT NULL,
         expires_at INTEGER
       )`,
    );
    // Index to make the occasional expiry sweep cheap.
    await client.execute(
      `CREATE INDEX IF NOT EXISTS kv_expires_idx ON kv (expires_at)`,
    );
  })().catch((e) => {
    // Reset so a later call can retry after a transient failure.
    _schema = null;
    throw e;
  });
  return _schema;
}

/** Occasionally purge expired rows so the table doesn't grow unbounded. */
async function maybeSweep(): Promise<void> {
  if (Math.random() > 0.02) return; // ~2% of writes
  try {
    await getTurso().execute({
      sql: `DELETE FROM kv WHERE expires_at IS NOT NULL AND expires_at <= ?`,
      args: [Date.now()],
    });
  } catch {
    /* best-effort */
  }
}

/** Decode a stored TEXT value the way Upstash's client did (auto JSON parse). */
function decode(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // not JSON — return the raw string
  }
}

/** Encode any value to TEXT for storage (strings stored as-is, like Upstash). */
function encode(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export interface SetOpts {
  /** Expire after N seconds (mirrors Upstash `{ ex }`). */
  ex?: number;
}

export interface KV {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: SetOpts): Promise<void>;
  del(key: string): Promise<void>;
  expire(key: string, seconds: number): Promise<number>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  incrby(key: string, n: number): Promise<number>;
  decrby(key: string, n: number): Promise<number>;
  // Set operations (backed by a JSON-array value under the key).
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
}

async function kvGet<T>(key: string): Promise<T | null> {
  await ensureSchema();
  const rs = await getTurso().execute({
    sql: `SELECT value FROM kv WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)`,
    args: [key, Date.now()],
  });
  if (!rs.rows.length) return null;
  return decode(String(rs.rows[0].value)) as T;
}

async function kvSet(key: string, value: unknown, opts?: SetOpts): Promise<void> {
  await ensureSchema();
  const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : null;
  await getTurso().execute({
    sql: `INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
    args: [key, encode(value), expiresAt],
  });
  void maybeSweep();
}

async function kvDel(key: string): Promise<void> {
  await ensureSchema();
  await getTurso().execute({ sql: `DELETE FROM kv WHERE key = ?`, args: [key] });
}

async function kvExpire(key: string, seconds: number): Promise<number> {
  await ensureSchema();
  const rs = await getTurso().execute({
    sql: `UPDATE kv SET expires_at = ? WHERE key = ?`,
    args: [Date.now() + seconds * 1000, key],
  });
  return rs.rowsAffected > 0 ? 1 : 0;
}

/** Atomic increment by delta, honoring (and clearing) expiry. */
async function kvIncrBy(key: string, delta: number): Promise<number> {
  await ensureSchema();
  const client = getTurso();
  const tx = await client.transaction("write");
  try {
    const now = Date.now();
    const rs = await tx.execute({
      sql: `SELECT value, expires_at FROM kv WHERE key = ?`,
      args: [key],
    });
    let current = 0;
    let exp: number | null = null;
    if (rs.rows.length) {
      const row = rs.rows[0];
      const ea = row.expires_at == null ? null : Number(row.expires_at);
      if (ea != null && ea <= now) {
        current = 0; // expired — treat as a fresh counter
        exp = null;
      } else {
        current = parseInt(String(row.value), 10) || 0;
        exp = ea;
      }
    }
    const next = current + delta;
    await tx.execute({
      sql: `INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      args: [key, String(next), exp],
    });
    await tx.commit();
    return next;
  } catch (e) {
    try { await tx.rollback(); } catch { /* ignore */ }
    throw e;
  }
}

/** Set ops: members are stored as a JSON string array under the key. */
async function kvSetMembers(key: string): Promise<string[]> {
  const v = await kvGet<unknown>(key);
  if (Array.isArray(v)) return v.map(String);
  return [];
}

async function kvSadd(key: string, members: string[]): Promise<number> {
  await ensureSchema();
  const tx = await getTurso().transaction("write");
  try {
    const rs = await tx.execute({
      sql: `SELECT value, expires_at FROM kv WHERE key = ?`,
      args: [key],
    });
    let set = new Set<string>();
    let exp: number | null = null;
    if (rs.rows.length) {
      try { set = new Set((JSON.parse(String(rs.rows[0].value)) as unknown[]).map(String)); } catch { /* reset */ }
      exp = rs.rows[0].expires_at == null ? null : Number(rs.rows[0].expires_at);
    }
    let added = 0;
    for (const m of members) if (!set.has(m)) { set.add(m); added++; }
    await tx.execute({
      sql: `INSERT INTO kv (key, value, expires_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`,
      args: [key, JSON.stringify([...set]), exp],
    });
    await tx.commit();
    return added;
  } catch (e) {
    try { await tx.rollback(); } catch { /* ignore */ }
    throw e;
  }
}

async function kvSrem(key: string, members: string[]): Promise<number> {
  await ensureSchema();
  const tx = await getTurso().transaction("write");
  try {
    const rs = await tx.execute({
      sql: `SELECT value, expires_at FROM kv WHERE key = ?`,
      args: [key],
    });
    if (!rs.rows.length) { await tx.rollback(); return 0; }
    let arr: string[] = [];
    try { arr = (JSON.parse(String(rs.rows[0].value)) as unknown[]).map(String); } catch { /* empty */ }
    const exp = rs.rows[0].expires_at == null ? null : Number(rs.rows[0].expires_at);
    const toRemove = new Set(members);
    const next = arr.filter((m) => !toRemove.has(m));
    const removed = arr.length - next.length;
    await tx.execute({
      sql: `UPDATE kv SET value = ?, expires_at = ? WHERE key = ?`,
      args: [JSON.stringify(next), exp, key],
    });
    await tx.commit();
    return removed;
  } catch (e) {
    try { await tx.rollback(); } catch { /* ignore */ }
    throw e;
  }
}

let _kv: KV | null = null;
export function getKV(): KV {
  if (_kv) return _kv;
  _kv = {
    get: kvGet,
    set: kvSet,
    del: kvDel,
    expire: kvExpire,
    incr: (k) => kvIncrBy(k, 1),
    decr: (k) => kvIncrBy(k, -1),
    incrby: (k, n) => kvIncrBy(k, n),
    decrby: (k, n) => kvIncrBy(k, -n),
    sadd: (k, ...members) => kvSadd(k, members),
    srem: (k, ...members) => kvSrem(k, members),
    smembers: (k) => kvSetMembers(k),
  };
  return _kv;
}
