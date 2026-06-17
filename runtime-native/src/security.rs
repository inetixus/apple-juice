//! Apple Juice Runtime — security core (port of runtime/src/security.ts).
//!
//! Binding to 127.0.0.1 stops EXTERNAL scanners but NOT other local code (any
//! website the user visits can also reach 127.0.0.1). So every authenticated
//! request must additionally:
//!   - present a valid per-session PAIRING token (Authorization: Bearer ...),
//!   - originate from an allowlisted Origin,
//!   - carry an expected Host (anti DNS-rebinding).
//!
//! The pairing token is delivered via a short, single-use, attempt-limited,
//! short-lived PAIR CODE the user types on the dashboard — never via a URL.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

/// Result of a pairing/auth check. `reason` is a stable code for logging; never
/// leak it verbatim to clients beyond the generic shape the TS server used.
pub struct PairCheck {
    pub ok: bool,
    pub reason: Option<&'static str>,
    pub token: Option<String>,
}

impl PairCheck {
    fn ok_token(token: String) -> Self {
        PairCheck { ok: true, reason: None, token: Some(token) }
    }
    fn ok_only() -> Self {
        PairCheck { ok: true, reason: None, token: None }
    }
    fn fail(reason: &'static str) -> Self {
        PairCheck { ok: false, reason: Some(reason), token: None }
    }
}

struct ActiveCode {
    code: String,
    expires_at: u64,
    attempts: u32,
}

/// Default lifetimes (mirror security.ts DEFAULTS).
const DEFAULT_CODE_TTL_MS: u64 = 120_000; // 2 minutes
const DEFAULT_TOKEN_TTL_MS: u64 = 8 * 60 * 60_000; // 8 hours
const DEFAULT_MAX_ATTEMPTS: u32 = 5;

type NowFn = Box<dyn Fn() -> u64 + Send>;
type GenIdFn = Box<dyn Fn(usize) -> String + Send>;

pub struct PairingManager {
    allowed_origins: Vec<String>,
    allowed_hosts: Vec<String>,
    code_ttl_ms: u64,
    token_ttl_ms: u64,
    max_attempts: u32,
    now: NowFn,
    gen_id: GenIdFn,
    active_code: Option<ActiveCode>,
    tokens: HashMap<String, u64>, // token -> expires_at
}

impl PairingManager {
    /// Production constructor: real clock + OS CSPRNG.
    pub fn new(allowed_origins: Vec<String>, allowed_hosts: Vec<String>) -> Self {
        PairingManager::with_deps(
            allowed_origins,
            allowed_hosts,
            DEFAULT_CODE_TTL_MS,
            DEFAULT_TOKEN_TTL_MS,
            DEFAULT_MAX_ATTEMPTS,
            Box::new(real_now_ms),
            Box::new(real_gen_id),
        )
    }

    /// Fully injectable constructor (clock + RNG) for deterministic tests.
    #[allow(clippy::too_many_arguments)]
    pub fn with_deps(
        allowed_origins: Vec<String>,
        allowed_hosts: Vec<String>,
        code_ttl_ms: u64,
        token_ttl_ms: u64,
        max_attempts: u32,
        now: NowFn,
        gen_id: GenIdFn,
    ) -> Self {
        PairingManager {
            allowed_origins,
            allowed_hosts,
            code_ttl_ms,
            token_ttl_ms,
            max_attempts,
            now,
            gen_id,
            active_code: None,
            tokens: HashMap::new(),
        }
    }

    /// Mint a fresh pair code (invalidating any previous one). Shown in the UI.
    pub fn new_pair_code(&mut self) -> String {
        let code = gen_pair_code(&self.gen_id);
        self.active_code = Some(ActiveCode {
            code: code.clone(),
            expires_at: (self.now)() + self.code_ttl_ms,
            attempts: 0,
        });
        code
    }

    /// Attempt to pair using a code from the dashboard. On success, burns the
    /// code (single-use) and returns a session token. Enforces TTL + attempts.
    pub fn pair(&mut self, submitted: &str) -> PairCheck {
        let now = (self.now)();
        let ac = match self.active_code.as_mut() {
            None => return PairCheck::fail("no_active_code"),
            Some(ac) => ac,
        };
        if now > ac.expires_at {
            self.active_code = None;
            return PairCheck::fail("expired");
        }
        if ac.attempts >= self.max_attempts {
            self.active_code = None; // burn it — brute-force defense
            return PairCheck::fail("attempts_exceeded");
        }
        if submitted != ac.code {
            ac.attempts += 1;
            if ac.attempts >= self.max_attempts {
                self.active_code = None;
            }
            return PairCheck::fail("bad_code");
        }
        // Success: single-use — consume the code, mint a token.
        self.active_code = None;
        let token = (self.gen_id)(32);
        self.tokens.insert(token.clone(), now + self.token_ttl_ms);
        PairCheck::ok_token(token)
    }

    /// Validate a session token (presence + not expired).
    pub fn check_token(&mut self, token: Option<&str>) -> PairCheck {
        let token = match token {
            None => return PairCheck::fail("no_token"),
            Some(t) if t.is_empty() => return PairCheck::fail("no_token"),
            Some(t) => t,
        };
        match self.tokens.get(token).copied() {
            None => PairCheck::fail("bad_token"),
            Some(expires_at) => {
                if (self.now)() > expires_at {
                    self.tokens.remove(token);
                    PairCheck::fail("token_expired")
                } else {
                    PairCheck::ok_only()
                }
            }
        }
    }

    /// Exact-match Origin allowlist check.
    pub fn check_origin(&self, origin: Option<&str>) -> bool {
        match origin {
            None => false,
            Some(o) => self.allowed_origins.iter().any(|a| a == o),
        }
    }

    /// Host header check (anti DNS-rebinding).
    pub fn check_host(&self, host: Option<&str>) -> bool {
        match host {
            None => false,
            Some(h) => self.allowed_hosts.iter().any(|a| a == h),
        }
    }

    /// Replace the allowed Host list (set once the bridge knows its port).
    #[allow(dead_code)]
    pub fn set_allowed_hosts(&mut self, hosts: Vec<String>) {
        self.allowed_hosts = hosts;
    }

    /// Full gate for an authenticated request: Origin + Host + token, in
    /// defense-in-depth order (returns the first failing reason).
    pub fn authorize(
        &mut self,
        origin: Option<&str>,
        host: Option<&str>,
        token: Option<&str>,
    ) -> PairCheck {
        if !self.check_origin(origin) {
            return PairCheck::fail("bad_origin");
        }
        if !self.check_host(host) {
            return PairCheck::fail("bad_host");
        }
        self.check_token(token)
    }

    /// Drop expired tokens/codes (call periodically).
    pub fn sweep(&mut self) {
        let now = (self.now)();
        if let Some(ac) = &self.active_code {
            if now > ac.expires_at {
                self.active_code = None;
            }
        }
        self.tokens.retain(|_, &mut exp| now <= exp);
    }
}

/// Derive a 6-digit numeric pair code from random bytes (low entropy → MUST be
/// short-lived + attempt-limited, enforced above). Mirrors security.ts.
fn gen_pair_code(gen_id: &GenIdFn) -> String {
    let hex = gen_id(4);
    let slice: String = hex.chars().take(6).collect();
    let n = u32::from_str_radix(&slice, 16).unwrap_or(0) % 1_000_000;
    format!("{:06}", n)
}

fn real_now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// OS CSPRNG → lowercase hex string of `bytes` bytes (`bytes*2` hex chars).
fn real_gen_id(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    if getrandom::getrandom(&mut buf).is_err() {
        // Extremely unlikely on supported platforms; fail closed to a value that
        // cannot collide with a real token by being obviously short.
        return String::new();
    }
    to_hex(&buf)
}

fn to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0x0f) as usize] as char);
    }
    s
}

/// Bearer-token extraction from an Authorization header.
pub fn extract_bearer(auth_header: Option<&str>) -> Option<String> {
    let h = auth_header?.trim();
    let lower = h.to_ascii_lowercase();
    if let Some(rest) = lower.strip_prefix("bearer ") {
        let start = h.len() - rest.len();
        let tok = h[start..].trim();
        if tok.is_empty() {
            None
        } else {
            Some(tok.to_string())
        }
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    /// Deterministic clock + counter-based RNG (mirrors security.test.ts intent).
    fn make_manager(
        code_ttl: u64,
        token_ttl: u64,
        max_attempts: u32,
    ) -> (PairingManager, Arc<AtomicU64>) {
        let clock = Arc::new(AtomicU64::new(1_000_000));
        let clock_for_fn = clock.clone();
        let now: NowFn = Box::new(move || clock_for_fn.load(Ordering::SeqCst));
        let counter = Arc::new(AtomicU64::new(0));
        let gen_id: GenIdFn = Box::new(move |bytes: usize| {
            let c = counter.fetch_add(1, Ordering::SeqCst) + 1;
            // 8-hex-char block repeated, then sliced to bytes*2 chars.
            let block = format!("{:08x}", c);
            block.repeat(8).chars().take(bytes * 2).collect()
        });
        let mgr = PairingManager::with_deps(
            vec!["https://apple-juice.online".to_string()],
            vec!["127.0.0.1:5000".to_string()],
            code_ttl,
            token_ttl,
            max_attempts,
            now,
            gen_id,
        );
        (mgr, clock)
    }

    #[test]
    fn pairs_with_correct_code_and_mints_token() {
        let (mut mgr, _clock) = make_manager(DEFAULT_CODE_TTL_MS, DEFAULT_TOKEN_TTL_MS, 5);
        let code = mgr.new_pair_code();
        let r = mgr.pair(&code);
        assert!(r.ok);
        let token = r.token.clone().unwrap();
        assert!(mgr.check_token(Some(&token)).ok);
    }

    #[test]
    fn rejects_wrong_code_counts_attempts_and_burns() {
        let (mut mgr, _clock) = make_manager(DEFAULT_CODE_TTL_MS, DEFAULT_TOKEN_TTL_MS, 3);
        let real = mgr.new_pair_code();
        let wrong = if real == "999999" { "111111" } else { "999999" };
        assert_eq!(mgr.pair(wrong).reason, Some("bad_code"));
        assert_eq!(mgr.pair(wrong).reason, Some("bad_code"));
        // 3rd wrong attempt burns the code.
        assert_eq!(mgr.pair(wrong).reason, Some("bad_code"));
        // Code now gone.
        assert_eq!(mgr.pair(wrong).reason, Some("no_active_code"));
    }

    #[test]
    fn single_use_code_cannot_be_reused() {
        let (mut mgr, _clock) = make_manager(DEFAULT_CODE_TTL_MS, DEFAULT_TOKEN_TTL_MS, 5);
        let code = mgr.new_pair_code();
        assert!(mgr.pair(&code).ok);
        assert_eq!(mgr.pair(&code).reason, Some("no_active_code"));
    }

    #[test]
    fn pair_code_expires_after_ttl() {
        let (mut mgr, clock) = make_manager(1000, DEFAULT_TOKEN_TTL_MS, 5);
        let code = mgr.new_pair_code();
        clock.fetch_add(1001, Ordering::SeqCst);
        assert_eq!(mgr.pair(&code).reason, Some("expired"));
    }

    #[test]
    fn token_expires_after_ttl() {
        let (mut mgr, clock) = make_manager(DEFAULT_CODE_TTL_MS, 5000, 5);
        let code = mgr.new_pair_code();
        let token = mgr.pair(&code).token.unwrap();
        assert!(mgr.check_token(Some(&token)).ok);
        clock.fetch_add(5001, Ordering::SeqCst);
        assert_eq!(mgr.check_token(Some(&token)).reason, Some("token_expired"));
    }

    #[test]
    fn authorize_enforces_origin_then_host_then_token() {
        let (mut mgr, _clock) = make_manager(DEFAULT_CODE_TTL_MS, DEFAULT_TOKEN_TTL_MS, 5);
        let code = mgr.new_pair_code();
        let token = mgr.pair(&code).token.unwrap();
        assert_eq!(
            mgr.authorize(Some("https://evil.com"), Some("127.0.0.1:5000"), Some(&token))
                .reason,
            Some("bad_origin")
        );
        assert_eq!(
            mgr.authorize(Some("https://apple-juice.online"), Some("evil.com"), Some(&token))
                .reason,
            Some("bad_host")
        );
        assert_eq!(
            mgr.authorize(Some("https://apple-juice.online"), Some("127.0.0.1:5000"), None)
                .reason,
            Some("no_token")
        );
        assert!(mgr
            .authorize(Some("https://apple-juice.online"), Some("127.0.0.1:5000"), Some(&token))
            .ok);
    }

    #[test]
    fn only_configured_origin_allowed() {
        let (mgr, _clock) = make_manager(DEFAULT_CODE_TTL_MS, DEFAULT_TOKEN_TTL_MS, 5);
        assert!(mgr.check_origin(Some("https://apple-juice.online")));
        assert!(!mgr.check_origin(Some("http://apple-juice.online"))); // scheme differs
        assert!(!mgr.check_origin(Some("https://evil.com")));
        assert!(!mgr.check_origin(None));
    }

    #[test]
    fn set_allowed_hosts_updates_validation() {
        let (mut mgr, _clock) = make_manager(DEFAULT_CODE_TTL_MS, DEFAULT_TOKEN_TTL_MS, 5);
        assert!(!mgr.check_host(Some("localhost:9999")));
        mgr.set_allowed_hosts(vec!["localhost:9999".to_string()]);
        assert!(mgr.check_host(Some("localhost:9999")));
    }

    #[test]
    fn extract_bearer_works() {
        assert_eq!(extract_bearer(Some("Bearer abc123")).as_deref(), Some("abc123"));
        assert_eq!(extract_bearer(Some("bearer XYZ")).as_deref(), Some("XYZ"));
        assert_eq!(extract_bearer(None), None);
        assert_eq!(extract_bearer(Some("Basic foo")), None);
        assert_eq!(extract_bearer(Some("")), None);
    }
}
