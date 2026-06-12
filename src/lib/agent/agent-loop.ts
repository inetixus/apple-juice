/**
 * The Apple Juice agentic loop.
 *
 * A real, server-side, multi-step agent that drives Roblox Studio through the
 * plugin tool bridge. Unlike the legacy single-shot generator (which just
 * emitted a scripts array and *told* the model to "run a playtest"), this loop
 * actually:
 *
 *   1. Explores the project (reads the tree + relevant scripts).
 *   2. Writes / edits code live in Studio.
 *   3. Runs a real playtest and reads the actual runtime errors.
 *   4. If the playtest fails, feeds the errors back to the model and fixes —
 *      repeating until it passes or the iteration budget is exhausted.
 *   5. Returns a final summary.
 *
 * Every tool call is executed against the user's Studio via `runStudioTool`,
 * and progress is streamed to the caller via `onProgress` so the dashboard can
 * render a live tool timeline.
 */

import {
  runLlmTurn,
  parseToolArgs,
  type LlmMessage,
  type LlmToolSchema,
} from "@/lib/agent/llm";
import {
  runStudioTool,
  runPlaytest,
  type StudioTool,
} from "@/lib/agent/studio-bridge";

export type AgentProgress =
  | { kind: "thinking"; text: string }
  | { kind: "tool_start"; tool: string; label: string }
  | { kind: "tool_end"; tool: string; ok: boolean; label: string }
  | { kind: "playtest"; passed: boolean; summary: string }
  | { kind: "phase"; phase: string };

export type AgentResult = {
  message: string;
  /** Scripts the agent wrote/changed, for the dashboard's diff/checkpoint UI. */
  scripts: {
    action: string;
    type: string;
    parent: string;
    name: string;
    code: string;
  }[];
  /** Inverse patch: applying these restores the pre-run state of touched
   *  scripts (used to persist a per-prompt revert checkpoint). */
  revert: {
    action: string;
    type: string;
    parent: string;
    name: string;
    code: string;
  }[];
  /** Final playtest verdict, if one ran. */
  playtestPassed: boolean | null;
  iterations: number;
  usage: { inputTokens: number; outputTokens: number };
  /** True when the loop wrapped up early due to the wall-clock budget. */
  timedOut?: boolean;
  error?: string;
};

/** Tool schemas exposed to the model. These mirror the plugin's capabilities. */
const AGENT_TOOLS: LlmToolSchema[] = [
  {
    name: "get_tree",
    description:
      "Return the current Roblox project tree (services, folders, scripts). Call this FIRST to understand the project before changing anything.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_script",
    description:
      "Read the full source of a script by its path or name. Always read a script before editing it.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Dotted path (e.g. 'ServerScriptService.Combat.Damage') or bare script name.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_script",
    description:
      "Create a new script or completely overwrite an existing one with the COMPLETE corrected source. Never write partial snippets.",
    parameters: {
      type: "object",
      properties: {
        parent: {
          type: "string",
          description:
            "Parent path, e.g. ServerScriptService, ReplicatedStorage, StarterPlayer.StarterPlayerScripts.",
        },
        name: { type: "string", description: "Script name." },
        type: {
          type: "string",
          enum: ["Script", "LocalScript", "ModuleScript"],
          description: "Script class.",
        },
        code: { type: "string", description: "The ENTIRE Luau source." },
      },
      required: ["parent", "name", "type", "code"],
    },
  },
  {
    name: "create_instance",
    description:
      "Create a non-script instance (Folder, RemoteEvent, RemoteFunction, ScreenGui, etc.). Create dependencies (like RemoteEvents) BEFORE the scripts that reference them.",
    parameters: {
      type: "object",
      properties: {
        parent: { type: "string", description: "Parent path." },
        className: {
          type: "string",
          description: "Roblox class name, e.g. RemoteEvent, Folder.",
        },
        instanceName: { type: "string", description: "Name for the instance." },
      },
      required: ["parent", "className", "instanceName"],
    },
  },
  {
    name: "delete_instance",
    description: "Delete an instance by name within a parent path.",
    parameters: {
      type: "object",
      properties: {
        parent: { type: "string", description: "Parent path." },
        name: { type: "string", description: "Instance name to delete." },
      },
      required: ["parent", "name"],
    },
  },
  {
    name: "run_playtest",
    description:
      "Start a real playtest in Studio (~6s run session) and return any runtime errors/warnings captured. ALWAYS run this after writing or fixing code to verify it actually works.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_logs",
    description:
      "Return the most recent runtime errors and warnings captured from the last playtest.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "finish",
    description:
      "Call this ONLY after the code is written AND a playtest has passed (or you have exhausted reasonable fixes). Provide a concise summary of what you built and its current verified state.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "What was built/changed and the verified result.",
        },
      },
      required: ["summary"],
    },
  },
];

/** Map an agent tool name to the underlying Studio bridge tool + args. */
function toStudioCall(
  name: string,
  args: Record<string, unknown>,
): { tool: StudioTool; args: Record<string, unknown>; label: string } | null {
  switch (name) {
    case "get_tree":
      return { tool: "studio_get_tree", args: {}, label: "Reading project tree" };
    case "read_script":
      return {
        tool: "studio_read_script",
        args: { path: args.path },
        label: `Reading ${args.path ?? "script"}`,
      };
    case "write_script":
      return {
        tool: "studio_write_script",
        args: {
          parent: args.parent,
          name: args.name,
          type: args.type ?? "Script",
          code: args.code ?? "",
        },
        label: `Writing ${args.parent ?? ""}.${args.name ?? "script"}`,
      };
    case "create_instance":
      return {
        tool: "studio_create_instance",
        args: {
          parent: args.parent,
          className: args.className,
          instanceName: args.instanceName,
        },
        label: `Creating ${args.className ?? "instance"} "${args.instanceName ?? ""}"`,
      };
    case "delete_instance":
      return {
        tool: "studio_delete",
        args: { parent: args.parent, name: args.name },
        label: `Deleting ${args.name ?? "instance"}`,
      };
    case "get_logs":
      return { tool: "studio_get_logs", args: {}, label: "Reading runtime logs" };
    default:
      return null;
  }
}

const SYSTEM_PROMPT = `You are Apple Juice AI — an autonomous, expert Roblox game developer operating live inside the user's Roblox Studio through a tool bridge.

You do NOT hand the user code to paste. You build the game yourself by calling tools that execute directly in Studio, and you VERIFY your work by running real playtests and fixing whatever breaks.

## Your operating loop (follow it every time)
1. EXPLORE — call get_tree, and read_script on any files you'll touch. Never guess paths or invent instances that don't exist.
2. PLAN — briefly state what you'll build and how it fits the existing architecture/conventions.
3. BUILD — create instances (RemoteEvents, Folders) BEFORE the scripts that use them, then write_script the COMPLETE, production-ready Luau. No placeholders, no "TODO", no partial snippets — write the whole file every time.
4. VERIFY — call run_playtest. Read the returned errors.
5. FIX — if the playtest reports errors, diagnose the ROOT CAUSE, read_script the offending file, write_script the corrected full source, and run_playtest again. Repeat until it passes.
6. FINISH — only call finish() once the playtest passes (or you've made a genuine, well-reasoned effort to fix remaining issues). Summarize what you built and the verified result.

## Hard rules
- ALWAYS run a playtest after writing or changing code. Code is not "done" until a playtest has run.
- When a playtest fails, actually FIX it — read the error, find the cause, correct the real file. Do not declare success on failing code.
- Server logic → ServerScriptService. LocalScripts → StarterPlayer.StarterPlayerScripts or StarterGui. Never put scripts loose in Workspace.
- Validate RemoteEvent args on the server. Never trust the client.
- Use task.spawn/task.wait (never legacy spawn/wait). Use :WaitForChild with a timeout on the client.
- Every script should start with: print("[AppleJuice] Running <ScriptName>...") so playtest logs are traceable.
- Do not spawn 3D Parts into Workspace unless the user explicitly asks for physical objects.
- Match the project's existing frameworks, folder layout, and naming. Don't introduce a new framework unless asked.

## Style
- Write idiomatic, complete, robust Luau. Full implementations only.
- Keep your natural-language turns short — the user sees them as live progress. Let the tools do the talking.

Begin by exploring the project, then build and verify.`;

export type RunAgentOptions = {
  sessionKey: string;
  modelId: string;
  /** Current user request. */
  prompt: string;
  /** Prior conversation turns for memory. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Extra guidance appended to the system prompt (e.g. UI library docs). */
  extraContext?: string;
  /** Max model turns before we force a wrap-up. */
  maxIterations?: number;
  /** Max consecutive playtest-fix attempts. */
  maxFixAttempts?: number;
  /** Wall-clock budget (ms). The loop stops starting new turns past this so
   *  the caller always gets a final message before the serverless function
   *  hits its hard `maxDuration` limit. Default 240s (under the 300s route cap). */
  timeBudgetMs?: number;
  onProgress?: (p: AgentProgress) => void;
  signal?: AbortSignal;
};

/**
 * Run the full agentic loop. Drives the model + Studio until the task is
 * verified done, the iteration budget is hit, or an unrecoverable error occurs.
 */
export async function runAgentLoop(
  opts: RunAgentOptions,
): Promise<AgentResult> {
  const {
    sessionKey,
    modelId,
    prompt,
    history = [],
    extraContext = "",
    maxIterations = 16,
    maxFixAttempts = 4,
    timeBudgetMs = 240_000,
    onProgress = () => {},
    signal,
  } = opts;

  const writtenScripts = new Map<
    string,
    { action: string; type: string; parent: string; name: string; code: string }
  >();
  // Inverse patch keyed by "parent.name": the state to restore on revert. The
  // FIRST time the agent touches a script we record what was there before (its
  // prior source, or a delete if it didn't exist) so a later revert is correct
  // even across multiple edits to the same file within one run.
  const revertPatch = new Map<
    string,
    { action: string; type: string; parent: string; name: string; code: string }
  >();

  const usage = { inputTokens: 0, outputTokens: 0 };
  let playtestPassed: boolean | null = null;
  let fixAttempts = 0;
  let timedOut = false;
  const deadline = Date.now() + timeBudgetMs;

  const messages: LlmMessage[] = [
    {
      role: "system",
      content: extraContext
        ? `${SYSTEM_PROMPT}\n\n## Additional context\n${extraContext}`
        : SYSTEM_PROMPT,
    },
    ...history.slice(-10).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: prompt },
  ];

  let finalMessage = "";
  let iterations = 0;

  for (; iterations < maxIterations; iterations++) {
    if (signal?.aborted) {
      return wrap("Generation cancelled.");
    }

    // Wall-clock budget: stop starting new turns once we're close to the
    // function's hard limit. Inject a system note so the model's NEXT (already
    // in-flight allowance) wraps up cleanly with a finish().
    if (Date.now() > deadline) {
      timedOut = true;
      if (!finalMessage) {
        finalMessage =
          playtestPassed === true
            ? "Built and verified, but I hit the time limit before fully finishing. The passing work is applied in Studio."
            : "I ran out of time before fully finishing. The changes so far are applied in Studio — send another message to continue.";
      }
      break;
    }

    const turn = await runLlmTurn({
      modelId,
      messages,
      tools: AGENT_TOOLS,
      signal,
    });
    usage.inputTokens += turn.usage.inputTokens;
    usage.outputTokens += turn.usage.outputTokens;

    if (turn.error) {
      return wrap(`The model call failed: ${turn.error}`, turn.error);
    }

    if (turn.content && turn.content.trim()) {
      onProgress({ kind: "thinking", text: turn.content.trim() });
    }

    // No tool calls → the model is done talking. Treat content as the final
    // answer (models sometimes finish without calling finish()).
    if (turn.toolCalls.length === 0) {
      finalMessage = turn.content.trim() || finalMessage;
      break;
    }

    // Record the assistant turn (with its tool calls) before appending results.
    messages.push({
      role: "assistant",
      content: turn.content || "",
      tool_calls: turn.toolCalls,
    });

    let finished = false;

    for (const call of turn.toolCalls) {
      if (signal?.aborted) return wrap("Generation cancelled.");

      const args = parseToolArgs(call.arguments);

      // ── finish ──────────────────────────────────────────────────────────
      if (call.name === "finish") {
        finalMessage = String(args.summary ?? turn.content ?? "Done.").trim();
        finished = true;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: "Acknowledged. Task closed.",
        });
        break;
      }

      // ── run_playtest ────────────────────────────────────────────────────
      if (call.name === "run_playtest") {
        onProgress({ kind: "phase", phase: "Running playtest" });
        onProgress({
          kind: "tool_start",
          tool: "run_playtest",
          label: "Running playtest in Studio",
        });
        const outcome = await runPlaytest(sessionKey);
        playtestPassed = outcome.passed;
        onProgress({
          kind: "tool_end",
          tool: "run_playtest",
          ok: outcome.passed,
          label: outcome.passed ? "Playtest passed" : "Playtest failed",
        });
        onProgress({
          kind: "playtest",
          passed: outcome.passed,
          summary: outcome.summary,
        });

        if (!outcome.passed) fixAttempts += 1;

        const budgetNote =
          !outcome.passed && fixAttempts >= maxFixAttempts
            ? `\n\nNOTE: You have reached the fix-attempt limit (${maxFixAttempts}). Make a final correction if you are confident, otherwise call finish() and clearly tell the user what remains.`
            : "";

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content:
            (outcome.passed
              ? `PLAYTEST PASSED. ${outcome.summary}`
              : `PLAYTEST FAILED.\n${outcome.summary}\n\nDiagnose the root cause, read the offending script, rewrite the complete corrected source, then run the playtest again.`) +
            budgetNote,
        });
        continue;
      }

      // ── studio passthrough tools ─────────────────────────────────────────
      const mapped = toStudioCall(call.name, args);
      if (!mapped) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.name,
          content: `Unknown tool "${call.name}".`,
        });
        continue;
      }

      onProgress({ kind: "tool_start", tool: call.name, label: mapped.label });

      // ── Revert capture ──────────────────────────────────────────────────
      // Before the FIRST mutation of a given script, snapshot its prior state
      // so we can build an accurate inverse patch for the dashboard's per-prompt
      // revert. (create → prior source restore, or delete if it didn't exist.)
      if (
        (call.name === "write_script" || call.name === "delete_instance") &&
        args.parent &&
        args.name
      ) {
        const keyName = `${args.parent}.${args.name}`;
        if (!revertPatch.has(keyName)) {
          const prior = await runStudioTool(sessionKey, "studio_read_script", {
            path: keyName,
          });
          const existed =
            prior.ok &&
            typeof prior.data === "string" &&
            prior.data.length > 0 &&
            !prior.data.includes("APPLE_JUICE_ERROR_FILE_NOT_FOUND");
          revertPatch.set(
            keyName,
            existed
              ? {
                  action: "create",
                  type: String(args.type ?? "Script"),
                  parent: String(args.parent),
                  name: String(args.name),
                  code: prior.data as string,
                }
              : {
                  action: "delete",
                  type: String(args.type ?? "Script"),
                  parent: String(args.parent),
                  name: String(args.name),
                  code: "",
                },
          );
        }
      }

      const res = await runStudioTool(sessionKey, mapped.tool, mapped.args);
      onProgress({
        kind: "tool_end",
        tool: call.name,
        ok: res.ok,
        label: mapped.label,
      });

      // Track written scripts for the dashboard's diff/checkpoint surface.
      if (call.name === "write_script" && res.ok) {
        const keyName = `${args.parent}.${args.name}`;
        writtenScripts.set(keyName, {
          action: "create",
          type: String(args.type ?? "Script"),
          parent: String(args.parent ?? "ServerScriptService"),
          name: String(args.name ?? "Script"),
          code: String(args.code ?? ""),
        });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        content: res.ok
          ? res.data && res.data.length > 0
            ? res.data.slice(0, 24_000)
            : "OK."
          : `ERROR: ${res.error ?? "tool failed"}`,
      });
    }

    if (finished) break;
  }

  if (!finalMessage) {
    finalMessage =
      playtestPassed === true
        ? "Done — built and verified with a passing playtest."
        : playtestPassed === false
          ? "I built the feature but the playtest still reports issues. See the log above."
          : "Done.";
  }

  return wrap(finalMessage);

  function wrap(message: string, error?: string): AgentResult {
    return {
      message,
      scripts: Array.from(writtenScripts.values()),
      revert: Array.from(revertPatch.values()),
      playtestPassed,
      iterations,
      usage,
      timedOut,
      error,
    };
  }
}
