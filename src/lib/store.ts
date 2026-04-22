import fs from "fs/promises";
import path from "path";

export type SessionEntry = {
  pairingCode: string;
  ownerUserId: string;
  pairToken: string;
  expiresAt: number;
  hasNewCode: boolean;
  code: string;
  messageId: string;
};

type Store = Record<string, SessionEntry>;

const SESSIONS_FILE = path.join(process.cwd(), "data", "sessions.json");

// A simple in-process queue to serialize read-write operations.
let pending: Promise<unknown> = Promise.resolve();
function queued<T>(op: () => Promise<T>): Promise<T> {
  const run = () => op();
  const result = pending.then(run, run);
  pending = result.then(() => undefined, () => undefined);
  return result;
}

async function readSessions(): Promise<Store> {
  try {
    const raw = await fs.readFile(SESSIONS_FILE, "utf-8");
    return JSON.parse(raw) as Store;
  } catch (err: any) {
    if (err?.code === "ENOENT") return {};
    throw err;
  }
}

async function writeSessions(store: Store) {
  await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
  const tmp = `${SESSIONS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
  await fs.rename(tmp, SESSIONS_FILE);
}

export async function createOrReplaceSession(entry: SessionEntry): Promise<SessionEntry> {
  return queued(async () => {
    const store = await readSessions();
    store[entry.pairingCode] = entry;
    await writeSessions(store);
    return entry;
  });
}

export async function getSession(pairingCode: string): Promise<SessionEntry | undefined> {
  const store = await readSessions();
  return store[pairingCode];
}

export async function upsertGeneratedCode(pairingCode: string, code: string, messageId: string) {
  return queued(async () => {
    const store = await readSessions();
    const session = store[pairingCode];
    if (!session) return null;
    session.code = code;
    session.messageId = messageId;
    session.hasNewCode = true;
    await writeSessions(store);
    return session;
  });
}

export async function consumeIfAuthorized(pairingCode: string, pairToken: string) {
  return queued(async () => {
    const store = await readSessions();
    const session = store[pairingCode];
    if (!session) return { ok: false as const, reason: "not_found" as const };
    if (session.pairToken !== pairToken) return { ok: false as const, reason: "bad_token" as const };
    if (Date.now() > session.expiresAt) return { ok: false as const, reason: "expired" as const };

    const payload = {
      hasNewCode: session.hasNewCode,
      code: session.code,
      messageId: session.messageId,
    };

    session.hasNewCode = false;
    await writeSessions(store);
    return { ok: true as const, payload };
  });
}

// NOTE: This file-backed store is intended as a simple, persistent fallback for local
// development. For production/robustness you should use a centralized store that
// survives across instances/processes, e.g. Upstash Redis (serverless-friendly) or
// a proper database with a Prisma schema (Postgres, MySQL, etc.). The exported
// functions are async so you can swap implementations without changing call sites.
