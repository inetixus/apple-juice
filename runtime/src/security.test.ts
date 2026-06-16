import { describe, it, expect } from "vitest";
import { PairingManager, extractBearer } from "./security.ts";

// Deterministic clock + RNG so the security behavior is fully testable.
function makeManager(overrides: Partial<ConstructorParameters<typeof PairingManager>[0]> = {}) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  // genId returns predictable hex; pair code derives from first bytes.
  let counter = 0;
  const genId = (_bytes: number) => {
    counter += 1;
    return counter.toString(16).padStart(8, "0").repeat(8).slice(0, _bytes * 2);
  };
  const mgr = new PairingManager({
    allowedOrigins: ["https://apple-juice.online"],
    allowedHosts: ["127.0.0.1:5000"],
    now: clock.now,
    genId,
    ...overrides,
  });
  return { mgr, clock };
}

describe("PairingManager", () => {
  it("pairs with the correct code and mints a token", () => {
    const { mgr } = makeManager();
    const code = mgr.newPairCode();
    const r = mgr.pair(code);
    expect(r.ok).toBe(true);
    expect(typeof r.token).toBe("string");
    expect(mgr.checkToken(r.token).ok).toBe(true);
  });

  it("rejects a wrong code and counts attempts, burning after the limit", () => {
    const { mgr } = makeManager({ maxAttempts: 3 });
    const real = mgr.newPairCode();
    const wrong = real === "999999" ? "111111" : "999999";
    expect(mgr.pair(wrong).reason).toBe("bad_code");
    expect(mgr.pair(wrong).reason).toBe("bad_code");
    // 3rd wrong attempt burns the code.
    expect(mgr.pair(wrong).reason).toBe("bad_code");
    // Code now gone.
    expect(mgr.pair(wrong).reason).toBe("no_active_code");
  });

  it("is single-use: a code can't be reused after success", () => {
    const { mgr } = makeManager();
    const code = mgr.newPairCode();
    expect(mgr.pair(code).ok).toBe(true);
    expect(mgr.pair(code).reason).toBe("no_active_code");
  });

  it("expires a pair code after its TTL", () => {
    const { mgr, clock } = makeManager({ codeTtlMs: 1000 });
    const code = mgr.newPairCode();
    clock.advance(1001);
    expect(mgr.pair(code).reason).toBe("expired");
  });

  it("expires a session token after its TTL", () => {
    const { mgr, clock } = makeManager({ tokenTtlMs: 5000 });
    const code = mgr.newPairCode();
    const token = mgr.pair(code).token!;
    expect(mgr.checkToken(token).ok).toBe(true);
    clock.advance(5001);
    expect(mgr.checkToken(token).reason).toBe("token_expired");
  });

  it("authorize() enforces origin, host, then token in order", () => {
    const { mgr } = makeManager();
    const token = mgr.pair(mgr.newPairCode()).token!;
    // bad origin
    expect(mgr.authorize({ origin: "https://evil.com", host: "127.0.0.1:5000", token }).reason).toBe("bad_origin");
    // bad host (DNS-rebind attempt)
    expect(mgr.authorize({ origin: "https://apple-juice.online", host: "evil.com", token }).reason).toBe("bad_host");
    // missing token
    expect(mgr.authorize({ origin: "https://apple-juice.online", host: "127.0.0.1:5000", token: null }).reason).toBe("no_token");
    // all good
    expect(mgr.authorize({ origin: "https://apple-juice.online", host: "127.0.0.1:5000", token }).ok).toBe(true);
  });

  it("rejects unknown origins and only allows the configured one", () => {
    const { mgr } = makeManager();
    expect(mgr.checkOrigin("https://apple-juice.online")).toBe(true);
    expect(mgr.checkOrigin("http://apple-juice.online")).toBe(false); // scheme differs
    expect(mgr.checkOrigin("https://evil.com")).toBe(false);
    expect(mgr.checkOrigin(null)).toBe(false);
  });

  it("setAllowedHosts updates host validation", () => {
    const { mgr } = makeManager();
    expect(mgr.checkHost("localhost:9999")).toBe(false);
    mgr.setAllowedHosts(["localhost:9999"]);
    expect(mgr.checkHost("localhost:9999")).toBe(true);
  });
});

describe("extractBearer", () => {
  it("extracts the token from a Bearer header", () => {
    expect(extractBearer("Bearer abc123")).toBe("abc123");
    expect(extractBearer("bearer XYZ")).toBe("XYZ");
  });
  it("returns null for missing/malformed headers", () => {
    expect(extractBearer(null)).toBeNull();
    expect(extractBearer("Basic foo")).toBeNull();
    expect(extractBearer("")).toBeNull();
  });
});
