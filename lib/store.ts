export type SessionEntry = {
  code: string;
  messageId: string;
  hasNewCode: boolean;
};

export type SessionStore = Record<string, SessionEntry>;

declare global {
  // eslint-disable-next-line no-var
  var __appleJuiceSessionStore: SessionStore | undefined;
}

const globalStore = globalThis as typeof globalThis & {
  __appleJuiceSessionStore?: SessionStore;
};

export const sessionStore: SessionStore =
  globalStore.__appleJuiceSessionStore ??
  (globalStore.__appleJuiceSessionStore = {});

export function upsertSession(pairingCode: string, entry: SessionEntry) {
  sessionStore[pairingCode] = entry;
}

export function consumeSession(pairingCode: string): SessionEntry | null {
  const session = sessionStore[pairingCode];

  if (!session || !session.hasNewCode) {
    return null;
  }

  // Mark as consumed right before returning so polling does not duplicate inserts.
  sessionStore[pairingCode] = { ...session, hasNewCode: false };
  return session;
}