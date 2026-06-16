/**
 * Apple Juice Runtime — security core (pure, dependency-free, testable).
 *
 * Implements the R2.3 + R2 §4b defenses for the loopback bridge. Binding to
 * 127.0.0.1 stops EXTERNAL scanners but NOT other local code (any website the
 * user visits can also reach 127.0.0.1). So every request must additionally:
 *   - present a valid per-session PAIRING token (Authorization header),
 *   - originate from an allowlisted Origin,
 *   - carry an expected Host (anti DNS-rebinding).
 *
 * The pairing token is delivered via a short, single-use, attempt-limited,
 * short-lived PAIR CODE the user enters on the dashboard — never via a URL.
 */

export interface PairingConfig {
  /** Allowed browser origins (exact match), e.g. https://apple-juice.online. */
  allowedOrigins: string[];
  /** Expected Host header values (host[:port]) the bridge answers on. */
  allowedHosts: string[];
  /** Pair-code lifetime in ms (short — user types it promptly). */
  codeTtlMs?: number;
  /** Session token lifetime in ms once paired. */
  tokenTtlMs?: number;
  /** Max wrong code attempts before the active code is burned. */
  maxAttempts?: number;
  /** Injectable clock for tests. */
  now?: () => number;
  /** Injectable RNG for tests (returns a string of digits/hex). */
  genId?: (bytes: number) => string;
}

export interface PairCheck {
  ok: boolean;
  /** Reason code when !ok, for logging (never leak to clients verbatim). */
  reason?:
    | "no_active_code"
    | "expired"
    | "bad_code"
    | "attempts_exceeded"
    | "bad_origin"
    | "bad_host"
    | "no_token"
    | "bad_token"
    | "token_expired";
  /** The minted session token when a pair() succeeds. */
  token?: string;
}

const DEFAULTS = {
  codeTtlMs: 120_000, // 2 minutes
  tokenTtlMs: 8 * 60 * 60_000, // 8 hours
  maxAttempts: 5,
};

/** Default RNG using crypto when available; overridable for tests. */
function defaultGenId(bytes: number): string {
  try {
    // Node crypto — avoids bundling assumptions.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto") as typeof import("crypto");
    return crypto.randomBytes(bytes).toString("hex");
  } catch {
    let s = "";
    for (let i = 0; i < bytes * 2; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }
}

/** Generate a 6-digit numeric pair code (low entropy → MUST be short-lived + limited). */
function genPairCode(genId: (b: number) => string): string {
  // Derive 6 digits from random bytes deterministically (test-injectable).
  const hex = genId(4);
  const n = parseInt(hex.slice(0, 6), 16) % 1_000_000;
  return n.toString().padStart(6, "0");
}

export class PairingManager {
  private readonly cfg: Required<PairingConfig>;
  private activeCode: { code: string; expiresAt: number; attempts: number } | null = null;
  private tokens = new Map<string, { expiresAt: number }>();

  constructor(cfg: PairingConfig) {
    this.cfg = {
      codeTtlMs: cfg.codeTtlMs ?? DEFAULTS.codeTtlMs,
      tokenTtlMs: cfg.tokenTtlMs ?? DEFAULTS.tokenTtlMs,
      maxAttempts: cfg.maxAttempts ?? DEFAULTS.maxAttempts,
      allowedOrigins: cfg.allowedOrigins,
      allowedHosts: cfg.allowedHosts,
      now: cfg.now ?? Date.now,
      genId: cfg.genId ?? defaultGenId,
    };
  }

  /** Mint a fresh pair code (invalidating any previous one). Shown in the UI. */
  newPairCode(): string {
    const code = genPairCode(this.cfg.genId);
    this.activeCode = {
      code,
      expiresAt: this.cfg.now() + this.cfg.codeTtlMs,
      attempts: 0,
    };
    return code;
  }

  /**
   * Attempt to pair using a code from the dashboard. On success, burns the code
   * (single-use) and returns a session token. Enforces TTL + attempt limit.
   */
  pair(submittedCode: string): PairCheck {
    const ac = this.activeCode;
    if (!ac) return { ok: false, reason: "no_active_code" };
    if (this.cfg.now() > ac.expiresAt) {
      this.activeCode = null;
      return { ok: false, reason: "expired" };
    }
    if (ac.attempts >= this.cfg.maxAttempts) {
      this.activeCode = null; // burn it — brute-force defense
      return { ok: false, reason: "attempts_exceeded" };
    }
    if (submittedCode !== ac.code) {
      ac.attempts += 1;
      if (ac.attempts >= this.cfg.maxAttempts) this.activeCode = null;
      return { ok: false, reason: "bad_code" };
    }
    // Success: single-use — consume the code, mint a token.
    this.activeCode = null;
    const token = this.cfg.genId(32);
    this.tokens.set(token, { expiresAt: this.cfg.now() + this.cfg.tokenTtlMs });
    return { ok: true, token };
  }

  /** Validate a session token (presence + not expired). */
  checkToken(token: string | undefined | null): PairCheck {
    if (!token) return { ok: false, reason: "no_token" };
    const rec = this.tokens.get(token);
    if (!rec) return { ok: false, reason: "bad_token" };
    if (this.cfg.now() > rec.expiresAt) {
      this.tokens.delete(token);
      return { ok: false, reason: "token_expired" };
    }
    return { ok: true };
  }

  /** Exact-match Origin allowlist check. */
  checkOrigin(origin: string | undefined | null): boolean {
    if (!origin) return false;
    return this.cfg.allowedOrigins.includes(origin);
  }

  /** Host header check (anti DNS-rebinding). */
  checkHost(host: string | undefined | null): boolean {
    if (!host) return false;
    return this.cfg.allowedHosts.includes(host);
  }

  /** Replace the allowed Host list (the bridge sets this once it knows its port). */
  setAllowedHosts(hosts: string[]): void {
    this.cfg.allowedHosts = hosts;
  }

  /**
   * Full gate for an authenticated tool request: Origin + Host + token.
   * Returns the first failing reason (checked in defense-in-depth order).
   */
  authorize(req: {
    origin?: string | null;
    host?: string | null;
    token?: string | null;
  }): PairCheck {
    if (!this.checkOrigin(req.origin)) return { ok: false, reason: "bad_origin" };
    if (!this.checkHost(req.host)) return { ok: false, reason: "bad_host" };
    return this.checkToken(req.token);
  }

  /** Drop expired tokens/codes (call periodically). */
  sweep(): void {
    const now = this.cfg.now();
    if (this.activeCode && now > this.activeCode.expiresAt) this.activeCode = null;
    for (const [tok, rec] of this.tokens) {
      if (now > rec.expiresAt) this.tokens.delete(tok);
    }
  }
}

/** Bearer-token extraction from an Authorization header. */
export function extractBearer(authHeader: string | undefined | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? m[1].trim() : null;
}
