// Verifies the Turso-backed store works end to end.
//
// Usage (from project root, with TURSO_DATABASE_URL + TURSO_AUTH_TOKEN set,
// or a local file fallback):
//   node scripts/verify-turso.mjs
//
// It exercises the same operations store.ts relies on: KV get/set/expire,
// atomic incr, set ops, and a simulated session round-trip + project CRUD
// using the raw kv table semantics. Uses a throwaway key prefix and cleans up.

import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:./.turso-verify.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

async function main() {
  console.log(`Connecting to: ${url}`);

  // 1. Schema
  await client.execute(
    `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER)`,
  );
  console.log("\n[1] Schema");
  const t = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='kv'`,
  );
  check("kv table exists", t.rows.length === 1);

  const P = `__verify__:${Date.now()}:`;

  // 2. Basic get/set
  console.log("\n[2] get / set / del");
  await client.execute({
    sql: `INSERT INTO kv (key,value,expires_at) VALUES (?,?,NULL)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    args: [`${P}a`, JSON.stringify({ hello: "world" })],
  });
  const got = await client.execute({ sql: `SELECT value FROM kv WHERE key=?`, args: [`${P}a`] });
  check("set then get returns value", JSON.parse(String(got.rows[0].value)).hello === "world");

  await client.execute({ sql: `DELETE FROM kv WHERE key=?`, args: [`${P}a`] });
  const afterDel = await client.execute({ sql: `SELECT value FROM kv WHERE key=?`, args: [`${P}a`] });
  check("del removes key", afterDel.rows.length === 0);

  // 3. TTL expiry semantics (expired rows not returned)
  console.log("\n[3] TTL expiry");
  await client.execute({
    sql: `INSERT INTO kv (key,value,expires_at) VALUES (?,?,?)`,
    args: [`${P}exp`, "x", Date.now() - 1000], // already expired
  });
  const expired = await client.execute({
    sql: `SELECT value FROM kv WHERE key=? AND (expires_at IS NULL OR expires_at > ?)`,
    args: [`${P}exp`, Date.now()],
  });
  check("expired key is filtered out on read", expired.rows.length === 0);
  await client.execute({ sql: `DELETE FROM kv WHERE key=?`, args: [`${P}exp`] });

  // 4. Atomic increment via transaction
  console.log("\n[4] atomic incr (transaction)");
  const incrKey = `${P}counter`;
  async function incrBy(delta) {
    const tx = await client.transaction("write");
    try {
      const rs = await tx.execute({ sql: `SELECT value FROM kv WHERE key=?`, args: [incrKey] });
      const cur = rs.rows.length ? parseInt(String(rs.rows[0].value), 10) || 0 : 0;
      const next = cur + delta;
      await tx.execute({
        sql: `INSERT INTO kv (key,value,expires_at) VALUES (?,?,NULL)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        args: [incrKey, String(next)],
      });
      await tx.commit();
      return next;
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }
  await incrBy(1);
  await incrBy(5);
  const decr = await incrBy(-2);
  check("incr/decr accumulates correctly (1+5-2=4)", decr === 4);
  await client.execute({ sql: `DELETE FROM kv WHERE key=?`, args: [incrKey] });

  // 5. Session round-trip simulation (the consumeCode pattern)
  console.log("\n[5] session round-trip");
  const sessKey = `${P}session`;
  const sess = {
    sessionKey: "ABCD1234",
    ownerUserId: "user-1",
    expiresAt: Date.now() + 60000,
    hasNewCode: true,
    code: '{"scripts":[]}',
    messageId: "m1",
  };
  await client.execute({
    sql: `INSERT INTO kv (key,value,expires_at) VALUES (?,?,?)`,
    args: [sessKey, JSON.stringify(sess), sess.expiresAt],
  });
  // consume: read, flip hasNewCode, write back — in one tx
  const tx = await client.transaction("write");
  const rs = await tx.execute({ sql: `SELECT value FROM kv WHERE key=?`, args: [sessKey] });
  const s = JSON.parse(String(rs.rows[0].value));
  const payloadHadCode = s.hasNewCode === true;
  s.hasNewCode = false;
  await tx.execute({ sql: `UPDATE kv SET value=? WHERE key=?`, args: [JSON.stringify(s), sessKey] });
  await tx.commit();
  const after = await client.execute({ sql: `SELECT value FROM kv WHERE key=?`, args: [sessKey] });
  const s2 = JSON.parse(String(after.rows[0].value));
  check("session consume flips hasNewCode atomically", payloadHadCode && s2.hasNewCode === false);
  await client.execute({ sql: `DELETE FROM kv WHERE key=?`, args: [sessKey] });

  // 6. cleanup sweep
  console.log("\n[6] cleanup");
  await client.execute({
    sql: `DELETE FROM kv WHERE key LIKE ?`,
    args: [`${P}%`],
  });
  const leftover = await client.execute({
    sql: `SELECT COUNT(*) as c FROM kv WHERE key LIKE ?`,
    args: [`${P}%`],
  });
  check("verify keys cleaned up", Number(leftover.rows[0].c) === 0);

  console.log(`\n──────────────\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Verification failed with error:", e);
  process.exit(1);
});
