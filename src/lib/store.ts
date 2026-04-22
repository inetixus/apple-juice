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

declare global {
  // eslint-disable-next-line no-var
  var __appleJuiceStore: Store | undefined;
}

function getStore(): Store {
  if (!global.__appleJuiceStore) global.__appleJuiceStore = {};
  return global.__appleJuiceStore;
}

export function createOrReplaceSession(entry: SessionEntry): SessionEntry {
  const store = getStore();
  store[entry.pairingCode] = entry;
  return entry;
}

export function getSession(pairingCode: string): SessionEntry | undefined {
  return getStore()[pairingCode];
}

export function upsertGeneratedCode(pairingCode: string, code: string, messageId: string) {
  const session = getStore()[pairingCode];
  if (!session) return null;
  session.code = code;
  session.messageId = messageId;
  session.hasNewCode = true;
  return session;
}

export function consumeIfAuthorized(pairingCode: string, pairToken: string) {
  const session = getStore()[pairingCode];
  if (!session) return { ok: false as const, reason: "not_found" as const };
  if (session.pairToken !== pairToken) return { ok: false as const, reason: "bad_token" as const };
  if (Date.now() > session.expiresAt) return { ok: false as const, reason: "expired" as const };

  const payload = {
    hasNewCode: session.hasNewCode,
    code: session.code,
    messageId: session.messageId,
  };

  session.hasNewCode = false;
  return { ok: true as const, payload };
}