# Requirements Document

## Introduction

This feature adds support for using a **Kiro API key** inside BloxBot. The
original spec assumed Kiro exposed an OpenAI-compatible HTTP endpoint
(`https://api.kiro.dev/v1`) that could be registered as an OpenCode provider.
That assumption is false and the feature was redesigned:

- `api.kiro.dev` does not exist (DNS does not resolve).
- A Kiro `ksk_...` key is **not** a bearer token for any HTTP chat API. Per
  Kiro's official documentation, it is the `KIRO_API_KEY` environment variable
  consumed by the **`kiro-cli`** binary in headless mode
  (`kiro-cli chat --no-interactive ...`).
- Kiro API keys are only available to Kiro **Pro, Pro+, and Power** subscribers,
  and an administrator may need to enable key generation for managed accounts.

Because `kiro-cli` is a self-contained **agent** (it runs its own model and tool
loop, not a model server), Kiro cannot be surfaced as a selectable model inside
the existing OpenCode chat. Instead, this feature integrates Kiro as a
**separate, officially-supported agent backend**: BloxBot bundles the `kiro-cli`
binary, lets the user store their `KIRO_API_KEY`, and runs `kiro-cli` in headless
mode to answer a prompt. The Kiro agent is optionally pointed at the same Roblox
Studio MCP server the OpenCode agent uses, so it can perform Studio work.

This document scopes the user-facing behavior of connecting a Kiro key,
persisting it securely, running a Kiro agent prompt, surfacing its output, and
disconnecting.

### Fixed values

- **CLI binary**: `kiro-cli` (bundled per-platform as a Tauri `externalBin` sidecar).
- **Auth mechanism**: `KIRO_API_KEY` environment variable, value prefixed `ksk_`.
- **Headless invocation**: `kiro-cli chat --no-interactive [--trust-tools=...] "<prompt>"`.
- **Help URL**: `https://app.kiro.dev/` (Account > API Keys section).
- **Subscription requirement**: Kiro Pro, Pro+, or Power.

## Glossary

- **BloxBot**: The Tauri v2 desktop application that hosts the React frontend and sidecar processes.
- **Kiro_CLI**: The bundled `kiro-cli` binary that runs a Kiro agent session in headless mode.
- **Kiro_Api_Key**: The user's Kiro credential (prefix `ksk_`), supplied to `Kiro_CLI` via the `KIRO_API_KEY` environment variable.
- **Kiro_Key_Store**: The persisted, app-local location where the `Kiro_Api_Key` is stored between launches.
- **Kiro_Backend**: The Rust-side module that stores/clears the key and spawns `Kiro_CLI` headless runs.
- **Kiro_Run**: A single invocation of `Kiro_CLI` in headless mode for one user prompt.
- **Kiro_Connection_Status**: Whether a `Kiro_Api_Key` is currently stored (connected) or absent (disconnected).
- **Kiro_Settings_Section**: The Settings UI area where the user connects/disconnects Kiro and sees status.
- **Connect_Dialog**: The overlay used to enter and save a `Kiro_Api_Key`.
- **Kiro_Help_URL**: The external URL where a user obtains a Kiro API key (`https://app.kiro.dev/`).
- **Kiro_Key_Placeholder**: The format hint shown in the key input (`ksk_...`).
- **Studio_MCP**: The Roblox Studio MCP server BloxBot already manages; `Kiro_Run` may be configured to use it.

## Requirements

### Requirement 0: Bundle the Kiro CLI binary

**User Story:** As a BloxBot user, I want the Kiro CLI shipped with the app, so that I can use my Kiro key without separately installing tooling.

#### Acceptance Criteria

1. THE BloxBot build SHALL declare `kiro-cli` as a Tauri `externalBin` sidecar so the binary is bundled next to the main executable for each target platform (macOS, Windows).
2. THE Kiro_Backend SHALL resolve the bundled `Kiro_CLI` path using the same sidecar-resolution mechanism used for the existing OpenCode sidecar.
3. IF the `Kiro_CLI` binary cannot be resolved at runtime, THEN THE Kiro_Backend SHALL return a descriptive error to the frontend rather than crashing the app.
4. THE bundling of `Kiro_CLI` SHALL NOT alter or block the existing OpenCode sidecar startup path.

### Requirement 1: Connect Kiro with an API key

**User Story:** As a BloxBot user, I want to paste and save my Kiro API key, so that BloxBot can run Kiro on my behalf.

#### Acceptance Criteria

1. THE Kiro_Settings_Section SHALL present a Connect control while no `Kiro_Api_Key` is stored.
2. WHEN the user activates Connect, THE Connect_Dialog SHALL display a key input showing the `Kiro_Key_Placeholder` (`ksk_...`) and a "Get an API key" link targeting the `Kiro_Help_URL`.
3. WHEN the user activates the "Get an API key" link, THE BloxBot SHALL open the `Kiro_Help_URL` in the user's default external browser.
4. WHILE the key input is empty (or whitespace-only), THE Connect_Dialog SHALL keep the Save control disabled.
5. WHEN the user submits a non-empty key, THE Kiro_Backend SHALL persist the key to the `Kiro_Key_Store` after trimming leading and trailing whitespace.
6. WHILE the key is being persisted, THE Connect_Dialog SHALL indicate an in-progress state on the Save control.
7. WHEN persistence completes successfully, THE Kiro_Settings_Section SHALL close the Connect_Dialog, reflect `Kiro_Connection_Status` as connected, and display a confirmation.

### Requirement 2: Validate the stored key format

**User Story:** As a BloxBot user, I want obviously malformed keys rejected early, so that I find out before running a prompt.

#### Acceptance Criteria

1. WHEN the user submits a key, THE Kiro_Backend SHALL validate that the trimmed key begins with the `ksk_` prefix.
2. IF the trimmed key does not begin with `ksk_`, THEN THE Connect_Dialog SHALL display a format error, keep the dialog open, and NOT persist the key.
3. THE format validation SHALL NOT transmit the key to any network endpoint (it is a local string check only).

### Requirement 3: Run a Kiro agent prompt

**User Story:** As a BloxBot user, I want to send a prompt to Kiro, so that Kiro can answer or perform Roblox Studio work using my subscription.

#### Acceptance Criteria

1. WHILE `Kiro_Connection_Status` is connected, THE BloxBot SHALL allow the user to submit a prompt to a `Kiro_Run`.
2. WHEN a `Kiro_Run` starts, THE Kiro_Backend SHALL spawn `Kiro_CLI` in headless mode (`chat --no-interactive`) with the prompt and SHALL provide the stored `Kiro_Api_Key` through the `KIRO_API_KEY` environment variable.
3. THE Kiro_Backend SHALL pass the `Kiro_Api_Key` only through the child process environment and SHALL NOT place it in command-line arguments or logs.
4. WHILE a `Kiro_Run` is executing, THE BloxBot SHALL indicate an in-progress state and SHALL allow the run to be cancelled.
5. WHEN a `Kiro_Run` produces output, THE BloxBot SHALL surface that output to the user.
6. WHEN a `Kiro_Run` exits, THE BloxBot SHALL reflect a terminal state derived from the process exit code (success or failure).
7. WHERE the user has not granted tool permissions, THE Kiro_Backend SHALL invoke `Kiro_CLI` with an explicit trust scope (e.g. `--trust-tools=<categories>` or `--trust-all-tools`) appropriate to headless operation, since no interactive approval is possible.

### Requirement 4: Handle Kiro run failures

**User Story:** As a BloxBot user, I want clear feedback when a Kiro run fails, so that I can fix the cause (bad key, no subscription, network).

#### Acceptance Criteria

1. IF a `Kiro_Run` exits with a non-success code, THEN THE BloxBot SHALL display an error that includes the relevant diagnostic output (e.g. stderr tail) without exposing the `Kiro_Api_Key`.
2. IF `Kiro_CLI` reports an authentication failure, THEN THE BloxBot SHALL surface an "authentication failed" message and keep the stored key so the user can review or replace it.
3. IF the `Kiro_CLI` binary cannot be launched, THEN THE BloxBot SHALL surface the launch error from Requirement 0.3.
4. THE Kiro_Backend SHALL not exit or crash the application when a `Kiro_Run` fails.

### Requirement 5: Disconnect Kiro

**User Story:** As a BloxBot user, I want to remove my stored Kiro key, so that I can rotate credentials or stop using Kiro.

#### Acceptance Criteria

1. WHILE `Kiro_Connection_Status` is connected, THE Kiro_Settings_Section SHALL present a Disconnect control.
2. WHEN the user activates Disconnect, THE Kiro_Backend SHALL remove the `Kiro_Api_Key` from the `Kiro_Key_Store`.
3. WHILE the disconnect is in progress, THE Kiro_Settings_Section SHALL indicate an in-progress state.
4. WHEN disconnect completes, THE Kiro_Settings_Section SHALL reflect `Kiro_Connection_Status` as disconnected, present the Connect control again, and display a confirmation.
5. WHEN `Kiro_Connection_Status` is disconnected, THE BloxBot SHALL refuse to start a `Kiro_Run` and SHALL prompt the user to connect.

### Requirement 6: Persist connection across launches

**User Story:** As a BloxBot user, I want my Kiro connection to survive restarts, so that I do not re-enter the key every session.

#### Acceptance Criteria

1. WHEN BloxBot launches AND a `Kiro_Api_Key` exists in the `Kiro_Key_Store`, THE Kiro_Settings_Section SHALL reflect `Kiro_Connection_Status` as connected without re-prompting.
2. WHEN BloxBot launches AND no `Kiro_Api_Key` exists, THE Kiro_Settings_Section SHALL reflect `Kiro_Connection_Status` as disconnected.
3. THE `Kiro_Key_Store` SHALL keep the key app-local and SHALL NOT write it into the OpenCode config or any committed file.

### Requirement 7: Remove the obsolete OpenAI-compatible provider config

**User Story:** As a maintainer, I want the dead `api.kiro.dev` provider registration removed, so that the app does not advertise a Kiro provider that can never function.

#### Acceptance Criteria

1. THE OpenCode config generated by the backend SHALL NOT contain a `provider.kiro` block pointing at `https://api.kiro.dev/v1`.
2. THE frontend provider metadata SHALL NOT register `kiro` as an OpenCode HTTP provider (the prior `POPULAR_PROVIDERS`/`PROVIDER_META` entries pointing at the non-existent endpoint are removed or repurposed for the new Kiro_Settings_Section).
3. THE removal SHALL NOT affect any other registered provider, plugin, MCP, or agent configuration.
