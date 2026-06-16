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
  | "studio_search_game_tree"
  | "studio_read_script"
  | "studio_write_script"
  | "studio_create_instance"
  | "studio_set_properties"
  | "studio_build_model"
  | "studio_inspect_build"
  | "studio_inspect_instance"
  | "studio_script_search"
  | "studio_script_grep"
  | "studio_multi_edit"
  | "studio_start_playtest"
  | "studio_stop_playtest"
  | "studio_console_output"
  | "studio_execute_luau"
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
  studio_search_game_tree: 20_000,
  studio_read_script: 15_000,
  studio_write_script: 20_000,
  studio_create_instance: 15_000,
  studio_set_properties: 15_000,
  studio_build_model: 25_000,
  studio_inspect_build: 20_000,
  studio_inspect_instance: 15_000,
  studio_script_search: 15_000,
  studio_script_grep: 20_000,
  studio_multi_edit: 20_000,
  studio_start_playtest: 15_000,
  studio_stop_playtest: 15_000,
  studio_console_output: 15_000,
  studio_execute_luau: 30_000,
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
/**
 * A function that executes a Studio tool. Both the module-level `runStudioTool`
 * (remote bridge) and a transport's `callTool` satisfy this shape, so callers
 * can route playtest/inspect through whichever transport is active.
 */
export type StudioToolRunner = (
  tool: StudioTool,
  args?: Record<string, unknown>,
) => Promise<StudioToolResult>;

export async function runPlaytest(
  sessionKey: string,
  runner?: StudioToolRunner,
): Promise<PlaytestOutcome> {
  const res = runner
    ? await runner("studio_run_playtest", {})
    : await runStudioTool(sessionKey, "studio_run_playtest", {});

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

  // Preferred path: the plugin returns STRUCTURED JSON
  // ({ passed, errorCount, errors:[{scriptName,scriptPath,line,message,raw}], ... }).
  // Format it into a clear block the model can act on directly.
  if (text.startsWith("{")) {
    try {
      const data = JSON.parse(text) as {
        passed?: boolean;
        errorCount?: number;
        errors?: Array<{
          scriptName?: string;
          scriptPath?: string;
          line?: number;
          message?: string;
          raw?: string;
        }>;
      };
      const errs = Array.isArray(data.errors) ? data.errors : [];
      if (data.passed && errs.length === 0) {
        return { passed: true, summary: "Playtest passed with no errors.", errors: [] };
      }
      const lines = errs.map((e) => {
        const loc = e.scriptPath || e.scriptName || "unknown";
        const at = e.line ? `:${e.line}` : "";
        return `${loc}${at} — ${e.message ?? e.raw ?? "error"}`;
      });
      const summary =
        `Playtest FAILED with ${errs.length} error(s):\n` +
        lines.map((l) => `  • ${l}`).join("\n") +
        `\n\nEach entry is script[:line] — message. Read the named script around that ` +
        `line and fix the ROOT CAUSE with multi_edit, then run_playtest again.`;
      return { passed: false, summary, errors: lines.length ? lines : ["Playtest reported errors."] };
    } catch {
      /* fall through to legacy text parsing */
    }
  }

  // Legacy text format fallback ("passed with no errors" / "found N error(s):").
  const passed = /passed with no errors/i.test(text) || /no errors/i.test(text);
  if (passed) {
    return { passed: true, summary: text || "Playtest passed.", errors: [] };
  }

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

/** A part's geometry as reported by the plugin's inspect tool. */
export type InspectedPart = {
  name?: string;
  className?: string;
  position: [number, number, number];
  size: [number, number, number];
  orientation?: [number, number, number];
  color?: [number, number, number];
  transparency?: number;
  shape?: string;
  material?: string;
};

export type BuildInspection = {
  ok: boolean;
  path: string;
  summary: string;
  parts: InspectedPart[];
  error?: string;
};

/**
 * Ask the plugin for the geometry of an instance (defaults to Workspace).
 * Parsed into a structured inspection the server can render + summarize.
 */
export async function inspectBuild(
  sessionKey: string,
  path = "Workspace",
  runner?: StudioToolRunner,
): Promise<BuildInspection> {
  const res = runner
    ? await runner("studio_inspect_build", { path })
    : await runStudioTool(sessionKey, "studio_inspect_build", { path });
  if (!res.ok) {
    return { ok: false, path, summary: res.error ?? "Inspection failed.", parts: [] };
  }
  try {
    const data = JSON.parse(res.data ?? "{}");
    return {
      ok: true,
      path: data.path ?? path,
      summary: typeof data.summary === "string" ? data.summary : "",
      parts: Array.isArray(data.parts) ? data.parts : [],
    };
  } catch {
    return { ok: false, path, summary: "Could not parse inspection.", parts: [] };
  }
}
