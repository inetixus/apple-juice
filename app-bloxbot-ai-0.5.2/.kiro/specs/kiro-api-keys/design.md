# Design Document

## Overview

This feature integrates **Kiro** into BloxBot as a **separate agent backend**
driven by the bundled `kiro-cli` binary and a user-supplied `KIRO_API_KEY`.

### Why the original design was scrapped

The first design registered `kiro` as an OpenCode provider pointing at
`https://api.kiro.dev/v1` with `@ai-sdk/openai-compatible`. Verification showed:

1. **`api.kiro.dev` does not resolve** — there is no such host. (`kiro.dev` and
   `app.kiro.dev` resolve; `api.kiro.dev` returns "No such host is known".)
2. **`ksk_` keys are not HTTP bearer tokens.** Kiro's official docs state the key
   is the `KIRO_API_KEY` environment variable for the **`kiro-cli`** binary's
   headless mode (`kiro-cli chat --no-interactive`). There is no public
   OpenAI-compatible Kiro chat endpoint.
3. **`kiro-cli` is an agent, not a model server.** It runs its own model + tool
   loop. It cannot be exposed as a "model" for OpenCode's agent loop to call.

Therefore Kiro cannot be a model inside the existing OpenCode chat. The supported
integration is to **shell out to `kiro-cli`** as its own agent.

### What this feature does

1. **Bundle `kiro-cli`** as a Tauri `externalBin` sidecar (per platform).
2. **Store the `KIRO_API_KEY`** app-locally (Tauri store / OS-appropriate
   location), never in the OpenCode config or a committed file.
3. **Run headless prompts** via `kiro-cli chat --no-interactive`, passing the key
   through the child process environment, streaming output back to the UI.
4. **Connect / disconnect / status** UI in Settings.
5. **Remove the dead `api.kiro.dev` provider config** and the corresponding
   frontend metadata.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ React frontend                                                     │
│                                                                    │
│  Settings → Kiro section                                           │
│   • Connect dialog: ksk_... input + "Get an API key" link          │
│   • Status (connected/disconnected), Disconnect                    │
│        │ invoke()                                                  │
│        ▼                                                            │
│  Kiro prompt UI (separate "Run with Kiro" affordance)              │
│        │ invoke("kiro_run", { prompt })  + event stream            │
└────────┼───────────────────────────────────────────────────────────┘
         │ Tauri commands / events
         ▼
┌──────────────────────────────────────────────────────────────────┐
│ Rust backend — kiro.rs (NEW)                                       │
│                                                                    │
│  kiro_set_key(key)      → validate ksk_ prefix, trim, store        │
│  kiro_clear_key()       → remove stored key                        │
│  kiro_status()          → { connected: bool }                      │
│  kiro_run(prompt)       → spawn sidecar:                           │
│        kiro-cli chat --no-interactive --trust-tools=... "<prompt>" │
│        env: KIRO_API_KEY=<stored key>   (env only, never argv/log) │
│        stream stdout/stderr as Tauri events; report exit code      │
│  kiro_cancel()          → kill the running child                   │
│                                                                    │
│  key store: Tauri store (bloxbot-store.json is for non-secrets;    │
│  the key is kept in a separate app-local store entry — see below)  │
└────────────────────────────────┬───────────────────────────────────┘
                                  │ spawns
                                  ▼
                        ┌───────────────────────┐
                        │ kiro-cli (sidecar)     │
                        │  headless agent run    │
                        │  (optionally uses the  │
                        │   Roblox Studio MCP)   │
                        └───────────────────────┘
```

The existing OpenCode sidecar path in `opencode.rs` is untouched except for
**removing** the `provider.kiro` block (Requirement 7).

## Components and Interfaces

### 1. Bundling: `tauri.conf.json`

Add `kiro-cli` to `bundle.externalBin` alongside `binaries/opencode`:

```jsonc
"externalBin": [
  "binaries/opencode",
  "binaries/kiro-cli"
]
```

Per-platform binaries are placed at `binaries/kiro-cli-<target-triple>` following
Tauri's sidecar naming, exactly as the existing OpenCode sidecar is shipped. The
binary is obtained from `https://cli.kiro.dev/install` per platform during the
release/packaging step (documented in the tasks, not committed to the repo).

> Open item: confirm Kiro CLI's license permits redistribution inside BloxBot's
> installer. If redistribution is not permitted, fall back to detecting a
> user-installed `kiro-cli` on PATH and prompting the user to install it. This is
> called out in Tasks and Open Questions.

### 2. Backend module: `src-tauri/src/kiro.rs` (new)

Mirrors the structure and conventions of `opencode.rs` (shared state behind
`Arc<Mutex<…>>`, sidecar resolution via `paths::sidecar_dir`, child-process event
handling, `#[tauri::command]` wrappers returning `Result<T, String>`).

```rust
pub struct KiroState {
    /// In-memory copy of the key for the current session (loaded at startup).
    api_key: Option<String>,
    /// Currently running headless child, if any.
    child: Option<CommandChild>,
}
pub type SharedKiroState = Arc<Mutex<KiroState>>;

/// Local format check; never touches the network. (Req 2)
fn is_valid_kiro_key(trimmed: &str) -> bool {
    trimmed.starts_with("ksk_") && trimmed.len() > "ksk_".len()
}

#[tauri::command]
async fn kiro_set_key(state, store, key: String) -> Result<(), String>;   // Req 1.5, 2
#[tauri::command]
async fn kiro_clear_key(state, store) -> Result<(), String>;              // Req 5.2
#[tauri::command]
async fn kiro_status(state) -> Result<KiroStatus, String>;                // Req 6
#[tauri::command]
async fn kiro_run(app, state, prompt: String) -> Result<(), String>;      // Req 3
#[tauri::command]
async fn kiro_cancel(state) -> Result<(), String>;                        // Req 3.4
```

Key handling rules:

- `kiro_set_key` trims, validates the `ksk_` prefix, stores the key, and updates
  in-memory state. Validation failure returns `Err` and does **not** store.
- `kiro_run` reads the in-memory key; if absent, returns an error instructing the
  user to connect (Req 5.5). It spawns the sidecar with `.env("KIRO_API_KEY", key)`
  and the prompt as a **single argument** — never interpolated into a shell
  string — to avoid injection and key leakage (Req 3.2, 3.3).
- Trust scope: pass `--trust-tools=read,grep` by default for safety; a broader
  scope (or `--trust-all-tools`) is opt-in via a parameter. Headless mode has no
  interactive approval, so an explicit scope is required (Req 3.7).

### 3. Key storage

The key is a secret. Options, in order of preference:

1. **OS keychain** via a Tauri keyring plugin (most secure). If adding a
   dependency is undesirable, use option 2.
2. **Separate Tauri store file** (e.g. `kiro-secret.json`) distinct from
   `bloxbot-store.json`, with the file excluded from any sync/commit. The
   existing `bloxbot-store.json` is for non-secret config (`lastModel`,
   `hiddenModels`) and the design keeps secrets out of it (Req 6.3).

The chosen mechanism is finalized in Tasks; either way the key is app-local and
never written into `opencode.json` (Req 6.3, 7).

### 4. Frontend

- **Settings → Kiro section** (in `Settings.tsx` or a small dedicated component):
  Connect dialog (placeholder `ksk_...`, help link to `https://app.kiro.dev/`
  opened via the existing opener plugin), connected/disconnected status, and
  Disconnect. Mutations call the new Tauri commands instead of the OpenCode
  `auth.set`/`auth.remove` path (which does not apply to a CLI agent).
- **Run-with-Kiro affordance**: a distinct entry point (not the OpenCode model
  picker) that calls `kiro_run` and renders streamed output + terminal state.
  This is deliberately separate from the OpenCode chat because Kiro is a separate
  agent (one-shot, no token-level streaming guarantees, no shared session state).

### 5. Removal of the dead provider config (Req 7)

- `opencode.rs`: delete `KIRO_BASE_URL`, `kiro_provider_config()`, the
  `"provider": kiro_provider_config()` entry in `do_start`, and the two related
  unit tests. Confirm the remaining `mcp_config` (plugin, mcp, default_agent,
  agent) is unchanged.
- `Settings.tsx`: remove `"kiro"` from `POPULAR_PROVIDERS` and the
  `PROVIDER_META.kiro` HTTP-provider entry. (Kiro metadata now lives in the new
  Kiro section, not the OpenCode provider registry.)

## Data Models

### Backend

| Type | Field | Meaning |
|------|-------|---------|
| `KiroState` | `api_key: Option<String>` | In-memory session copy of the stored key |
| `KiroState` | `child: Option<CommandChild>` | Handle to the active headless run |
| `KiroStatus` | `connected: bool` | Whether a key is stored |

### Frontend

| Structure | Purpose |
|-----------|---------|
| `kiro_status()` result | drives connected/disconnected UI |
| Kiro run events | `{ kind: "stdout"|"stderr"|"exit", data | code }` streamed to the UI |

No changes to `AppConfig` other than ensuring the secret is **not** stored there.

## Error Handling

| Scenario | Handling | Requirement |
|----------|----------|-------------|
| Key missing `ksk_` prefix | `kiro_set_key` returns Err; dialog shows format error, stays open, no persist | 2.1, 2.2 |
| Empty/whitespace key | Save disabled; backend also rejects | 1.4 |
| Sidecar binary missing | `kiro_run`/resolution returns descriptive Err | 0.3, 4.3 |
| Run exits non-zero | Surface stderr tail (key redacted) + failure state | 4.1 |
| Auth failure from CLI | "authentication failed" message; key retained | 4.2 |
| Run cancelled | Child killed; UI returns to idle | 3.4 |
| Any run failure | Never exit the app | 4.4 |

The key is never logged. stdout/stderr forwarded to the UI are scanned to ensure
the key string (if it ever appeared) is redacted before display.

## Testing Strategy

### Rust unit tests (`src-tauri/src/kiro.rs`, `#[cfg(test)]`)

- `is_valid_kiro_key` accepts `ksk_abc`, rejects `""`, `"ksk_"`, `"sk-..."`,
  and leading/trailing-whitespace cases after trimming. (Req 2)
- Key trimming: a key with surrounding whitespace is stored trimmed. (Req 1.5)
- Argument construction: the headless command vector contains
  `["chat", "--no-interactive", ...]` and the prompt as its own element, and the
  key is **not** present in the argument vector. (Req 3.3)
- Status reflects presence/absence of a stored key. (Req 6)

### Rust regression test for removal (Req 7)

- A test asserting the serialized OpenCode `mcp_config` does **not** contain a
  `provider.kiro` / `api.kiro.dev` substring, and still contains the existing
  `plugin`/`mcp`/`agent` keys.

### Frontend tests (Vitest)

- Connect dialog renders the `ksk_...` placeholder and a help link to
  `https://app.kiro.dev/`. (Req 1.2)
- Save disabled on empty/whitespace input, enabled otherwise. (Req 1.4)
- Submitting an invalid-prefix key shows a format error and does not call the
  persist command successfully. (Req 2.2)
- Connected status renders Disconnect; disconnected renders Connect. (Req 5, 6)
- The Kiro run affordance is **absent/blocked** when disconnected. (Req 5.5)

### Manual end-to-end (requires Rust toolchain + a real Kiro Pro key)

> Note: this machine currently has **no Rust toolchain** (`cargo`/`rustc`/`rustup`
> absent) and `pnpm` is only reachable via `npx`. Building/running the full app
> requires installing Rust first. The manual E2E below is gated on that.

1. Install Rust, run `cargo fmt` / `cargo clippy` / `cargo test` from `src-tauri/`.
2. Place a `kiro-cli` binary at the sidecar path for the dev target.
3. `pnpm tauri dev`; open Settings → Kiro; paste a real `ksk_...` key; Save.
4. Confirm status flips to connected and persists across a restart.
5. Run a prompt; confirm output streams and the run reports success.
6. Disconnect; confirm status flips and a run is refused.

## Security Considerations

- **Secret handling**: the key is stored app-local (keychain preferred), passed
  to the child **only** via `KIRO_API_KEY` env, never in argv or logs, and
  redacted from any forwarded output. It is never written into `opencode.json`.
- **Command injection**: the prompt is passed as a discrete process argument
  (no shell string interpolation).
- **Tool trust in headless mode**: default to least privilege
  (`--trust-tools=read,grep`); broader trust is explicit opt-in, since headless
  runs cannot prompt for approval.
- **Third-party binary**: `kiro-cli` is an external AWS/Kiro binary; bundling is
  contingent on its license (see Open Questions). It runs with the user's
  subscription credential.

## Correctness Properties

### Property 1: Key format gate
For any input string, `kiro_set_key` persists a value **iff** the trimmed input
starts with `ksk_` and is longer than the prefix; otherwise nothing is stored.
**Validates: Req 2.1, 2.2, 1.5**

### Property 2: Key never appears in argv or logs
For any prompt and any stored key, the spawned command's argument vector and all
forwarded log/output lines do not contain the key string.
**Validates: Req 3.3, security**

### Property 3: Run requires connection
For any prompt, `kiro_run` starts a child process **iff** a key is stored;
otherwise it returns an error and spawns nothing.
**Validates: Req 3.1, 5.5**

### Property 4: Status mirrors store
`kiro_status().connected` is true **iff** a non-empty key exists in the store,
across set/clear/restart.
**Validates: Req 6.1, 6.2**

### Property 5: No dead provider remains
For any generated OpenCode config, the serialized JSON contains no `provider.kiro`
object and no `api.kiro.dev` reference.
**Validates: Req 7.1**

## Open Questions / Assumptions

- **Redistribution license (blocking for bundling).** Confirm `kiro-cli` may be
  redistributed inside BloxBot's installer. If not, switch to "detect/prompt to
  install `kiro-cli` on PATH" instead of `externalBin` bundling. This decision
  affects Requirement 0 and its tasks.
- **Cross-platform binaries.** `kiro-cli` must be available for macOS and Windows
  targets matching BloxBot's build matrix.
- **Output format.** `kiro-cli --no-interactive` emits human-oriented text, not a
  structured stream. The UI renders it as agent output; richer parsing (tool
  call display, etc.) is a possible follow-up.
- **MCP wiring.** Pointing `kiro-cli` at the Roblox Studio MCP (so Kiro can do
  Studio work) depends on `kiro-cli`'s MCP config mechanism; treated as an
  enhancement after the basic run path works.
- **Subscription gating.** API keys require Kiro Pro/Pro+/Power; auth failures for
  ineligible accounts surface via Requirement 4.2.
