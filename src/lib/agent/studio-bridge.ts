/**
 * Studio bridge — synchronous, server-side tool execution against the user's
 * Roblox Studio plugin.
 *
 * This is the foundation of the in-app agentic loop. The Studio plugin already
 * long-polls `/api/mcp/next` for commands and posts results to `/api/mcp/result`
 * (see `executeMcpCommand` in `plugin/AppleJuiceSync.lua`). Historically those
 * commands could only be produced by an external VPS MCP server. This module
 * lets the Next.js server itself enqueue a `studio_*` command and block until
 * the plugin returns the result — turning the plugin into a real tool runtime
 * the agent can drive directly.
 *
 * Every call is bounded by a timeout; if the plugin is offline or slow the
 * caller gets a structured failure instead of hanging.
 */

import { enqueueCommand, awaitResult } from "@/lib/mcp-bridge";

/** Tool names the plugin's `executeMcpCommand` understands. */
export type StudioTool =
  | "studio_get_tree"
  | "studio_read_script"
  | "studio_write_script"
  | "studio_create_instance"
  | "studio_delete"
  | "studio_rename"
  | "studio_move"
  | "studio_run_playtest"
  | "studio_get_logs";

export type StudioToolResult = {
  ok: boolean;
  /** Stringified plugin output (script source, status message, playtest report). */
  data?: string;
  error?: string;
  /** Wall-clock ms the round trip took (for budgeting/telemetry). */
  elapsedMs: number;
};

/** Per-tool timeouts. Playtests are intentionally generous (the plugin runs a
 *  ~6s run-mode session plus startup/teardown); everything else is quick. */
const TOOL_TIMEOUT_MS: Record<StudioTool, number> = {
  studio_get_tree: 15_000,
  studio_read_script: 15_000,
  studio_write_script: 20_000,
  studio_create_instance: 15_000,
  studio_delete: 15_000,
  studio_rename: 15_000,
  studio_move: 15_000,
  studio_run_playtest: 45_000,
  studio_get_logs: 15_000,
};

function stringifyData(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

/**
 * Run a single Studio tool and wait for the plugin's result.
 * Never throws — failures (offline plugin, timeout) come back as `{ ok:false }`.
 */
export async function runStudioTool(
  sessionKey: string,
  tool: StudioTool,
  args: Record<string, unknown> = {},
): Promise<StudioToolResult> {
  const started = Date.now();
  try {
    const requestId = await enqueueCommand(sessionKey, tool, args);
    const result = await awaitResult(
      sessionKey,
      requestId,
      TOOL_TIMEOUT_MS[tool] ?? 20_000,
    );
    return {
      ok: result.ok,
      data: stringifyData(result.data),
      error: result.error,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    };
  }
}

/**
 * Quick liveness probe: ask the plugin for the project tree with a short
 * timeout. Used by `/api/chat` to decide whether the native agent loop can run
 * (plugin connected) or it should fall back to the legacy single-shot path.
 */
export async function isStudioBridgeLive(
  sessionKey: string,
  timeoutMs = 6000,
): Promise<boolean> {
  try {
    const requestId = await enqueueCommand(sessionKey, "studio_get_tree", {});
    const result = await awaitResult(sessionKey, requestId, timeoutMs, 120);
    return result.ok;
  } catch {
    return false;
  }
}

/** Structured view of a playtest run, parsed from the plugin's reply. */
export type PlaytestOutcome = {
  passed: boolean;
  /** Raw human-readable summary the plugin returned. */
  summary: string;
  /** Best-effort extracted error lines (empty when passed). */
  errors: string[];
};

/**
 * Run a playtest and normalize the plugin's reply into a structured outcome.
 *
 * The plugin's `studio_run_playtest` returns either:
 *   "Playtest passed with no errors."
 *   "Playtest found N error(s):\n<line>\n<line>"
 * (see `executeMcpCommand`). We also treat a failed round-trip (offline /
 * timeout) as a non-fatal "could not verify" rather than a code failure.
 */
export async function runPlaytest(sessionKey: string): Promise<PlaytestOutcome> {
  const res = await runStudioTool(sessionKey, "studio_run_playtest", {});

  if (!res.ok) {
    return {
      passed: false,
      summary:
        res.error ??
        "Could not run the playtest (Studio plugin did not respond).",
      errors: res.error ? [res.error] : [],
    };
  }

  const text = (res.data ?? "").trim();
  const passed = /passed with no errors/i.test(text) || /no errors/i.test(text);
  if (passed) {
    return { passed: true, summary: text || "Playtest passed.", errors: [] };
  }

  // Pull individual error lines out of the "found N error(s):" report.
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^playtest found/i.test(l));

  return {
    passed: false,
    summary: text || "Playtest reported errors.",
    errors: lines.length > 0 ? lines : [text],
  };
}
