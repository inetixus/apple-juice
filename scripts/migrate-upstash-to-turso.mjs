// One-time data migration: Upstash Redis -> Turso (libSQL).
//
// Copies every apple-juice:* key (sessions, projects, project indexes, chat
// messages, usage counters, plans, antigravity maps, etc.) into the Turso `kv`
// table, preserving values and any remaining TTL.
//
// Usage (from project root):
//   Set BOTH sets of env vars, then run:
//     node scripts/migrate-upstash-to-turso.mjs            (dry run — counts only)
//     node scripts/migrate-upstash-to-turso.mjs --commit   (actually writes)
//
// Required env:
//   UPSTASH_REDIS_REST_URL (or KV_REST_API_URL)
//   UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN)
//   TURSO_DATABASE_URL
//   TURSO_AUTH_TOKEN
//
// Safe to re-run: uses upsert, so keys are overwritten not duplicated.

import { Redis } from "@upstash/redis";
import { createClient } from "@libsql/client";

const COMMIT = process.argv.includes("--commit");

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!redisUrl || !redisToken) {
  console.error("Missing Upstash creds (UPSTASH_REDIS_REST_URL / _TOKEN).");
  process.exit(1);
}
if (!tursoUrl) {
  console.error("Missing TURSO_DATABASE_URL.");
  process.exit(1);
}

const redis = new Redis({ url: redisUrl, token: redisToken });
const turso = createClient(tursoToken ? { url: tursoUrl, authToken: tursoToken } : { url: tursoUrl });

const SCAN_PATTERN = "apple-juice:*";
const EXTRA_PREFIXES = ["tree:", "snapshot:", "checkpoint:", "requestSnapshot:"];

function encode(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function ensureSchema() {
  await turso.execute(
    `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER)`,
  );
  await turso.execute(`CREATE INDEX IF NOT EXISTS kv_expires_idx ON kv (expires_at)`);
}

async function scanAll(pattern) {
  const keys = [];
  let cursor = "0";
  do {
    // Upstash SCAN returns [nextCursor, keys[]]
    const [next, batch] = await redis.scan(cursor, { match: pattern, count: 200 });
    cursor = next;
    if (Array.isArray(batch)) keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

async function migrateKey(key) {
  // Pull value + remaining TTL from Upstash.
  const value = await redis.get(key);
  if (value === null || value === undefined) return false;

  let expiresAt = null;
  try {
    const ttl = await redis.ttl(key); // seconds; -1 = no expiry, -2 = gone
    if (typeof ttl === "number" && ttl > 0) {
      expiresAt = Date.now() + ttl * 1000;
    }
  } catch {
    /* ignore — treat as no expiry */
  }

  if (COMMIT) {
    await turso.execute({
      sql: `INSERT INTO kv (key,value,expires_at) VALUES (?,?,?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at`,
      args: [key, encode(value), expiresAt],
    });
  }
  return true;
}

async function main() {
  console.log(`Mode: ${COMMIT ? "COMMIT (writing)" : "DRY RUN (counts only)"}`);
  await ensureSchema();

  // Collect all relevant keys.
  const patterns = [SCAN_PATTERN, ...EXTRA_PREFIXES.map((p) => `${p}*`)];
  const allKeys = new Set();
  for (const pat of patterns) {
    const keys = await scanAll(pat);
    keys.forEach((k) => allKeys.add(k));
    console.log(`  pattern ${pat}: ${keys.length} keys`);
  }

  const keys = [...allKeys];
  console.log(`\nTotal unique keys to migrate: ${keys.length}`);

  let migrated = 0;
  let skipped = 0;
  let i = 0;
  for (const key of keys) {
    i++;
    try {
      const ok = await migrateKey(key);
      if (ok) migrated++;
      else skipped++;
    } catch (e) {
      console.error(`  ! failed ${key}: ${e?.message || e}`);
      skipped++;
    }
    if (i % 50 === 0) console.log(`  ...${i}/${keys.length}`);
  }

  console.log(`\n──────────────`);
  console.log(`${COMMIT ? "Migrated" : "Would migrate"}: ${migrated}`);
  console.log(`Skipped/empty: ${skipped}`);
  if (!COMMIT) {
    console.log(`\nThis was a DRY RUN. Re-run with --commit to write to Turso.`);
  } else {
    console.log(`\nDone. Verify by opening the app pointed at Turso.`);
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
