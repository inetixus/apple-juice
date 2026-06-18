/**
 * Apple Juice Runtime — LOCAL agent loop (Option C).
 *
 * Runs the agentic explore→build→verify loop ON THE USER'S MACHINE. LLM turns
 * are proxied to the VPS (inference.ts); every TOOL call goes straight to the
 * OFFICIAL Roblox Studio MCP via McpStdioClient — all local, native speed, full
 * official tool surface (execute_luau, input sim, etc. included).
 *
 * The official MCP advertises its own tools (tools/list), so unlike the server
 * loop we don't hardcode a schema — we forward the official tools to the model
 * and pass tool calls straight through. This is the "wrap, don't reimplement"
 * principle taken to its conclusion: the Runtime is a thin agent shell over
 * Roblox's real tools.
 */

import { McpStdioClient } from "./mcp-stdio.ts";
import { ProjectManager } from "./project.ts";
import {
  runLlmTurn,
  parseToolArgs,
  type LlmMessage,
  type LlmTool,
  type InferenceOptions,
} from "./inference.ts";

export type RuntimeProgress =
  | { kind: "thinking"; text: string }
  | { kind: "tool_start"; tool: string }
  | { kind: "tool_end"; tool: string; ok: boolean }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const SYSTEM_PROMPT = `You are Apple Juice AI — an expert Roblox game developer working directly inside the user's LIVE Roblox Studio session via the official built-in Studio MCP server. You build games by calling tools that execute in Studio; you never hand the user code to paste.

Operating loop every time:
1. EXPLORE — use search_game_tree / script_search / script_grep to locate code, then read scripts and inspect instances. Never guess paths.
2. PLAN — briefly state what you'll build and how it fits the existing architecture.
3. BUILD — create dependencies (RemoteEvents/Folders) before scripts. Prefer targeted multi_edit for existing files; write complete, production-ready Luau.
4. VERIFY — run a playtest, read the console output, and fix the ROOT CAUSE of any error, then re-run until it passes.
5. Use execute_luau for batch ops, instance creation, and live runtime inspection when the focused tools don't cover it.

Rules: server logic in ServerScriptService; client/UI in StarterPlayer.StarterPlayerScripts or StarterGui; never scripts loose in Workspace. Idiomatic Luau (task.*, typed, timed WaitForChild). Validate RemoteEvent inputs server-side. Verify before claiming success. Keep natural-language turns short — the user watches them as live progress.`;

/**
 * Two-domain prompt (Option C + Rojo). Scripts are durable FILES synced by Rojo;
 * the live game is driven by MCP. The split is enforced (we don't expose the MCP
 * script-edit tools), but the prompt teaches the model to think in it.
 */
const SYSTEM_PROMPT_PROJECT = `You are Apple Juice AI — an expert Roblox game developer. You work in a hybrid setup with TWO clearly separated domains. Using the wrong domain for a task is an error.

DOMAIN 1 — CODE (files, version-controlled, synced into Studio by Rojo):
- All scripts/modules are real files. Edit them with the FILE tools: list_files, read_file, write_file, delete_file.
- Paths map into Studio automatically:
    • src/server/<Name>.server.luau   → ServerScriptService (server scripts)
    • src/client/<Name>.client.luau   → StarterPlayer.StarterPlayerScripts (local scripts)
    • src/shared/<Name>.luau          → ReplicatedStorage (ModuleScripts)
- Writing a file syncs it into the live session within moments — you do NOT need a separate "apply" step.
- NEVER use MCP/Studio tools to read or write scripts. Code lives in files, period.
- After a change verifies clean, call commit_project with a short message to checkpoint it in git.

DOMAIN 2 — LIVE GAME (Studio, via MCP tools): everything that is NOT source code.
- Playtesting: start/stop playtest, read console_output, fix the ROOT CAUSE, re-run until clean.
- Building/physical: create and position parts, models, properties; generate geometry.
- Inspection + runtime: search_game_tree, inspect_instance, execute_luau for batch/live ops.

Operating loop:
1. EXPLORE — list_files + read_file to understand existing code; search_game_tree / inspect_instance for the live datamodel.
2. PLAN — briefly state what you'll change and where (which files, which live ops).
3. BUILD — write dependency modules before dependents; complete, production-ready, idiomatic Luau (task.*, typed, timed WaitForChild, server-side validation of RemoteEvent input).
4. VERIFY — start a playtest, read console_output, fix the file, let Rojo re-sync, re-run until clean.
5. CHECKPOINT — commit_project once it passes.

Keep natural-language turns short — the user watches them as live progress.`;

/** Official MCP tools we HIDE in project mode — scripting belongs to files. */
const EXCLUDED_MCP_TOOLS = new Set([
  "script_read",
  "script_write",
  "multi_edit",
  "script_search",
  "script_grep",
  "write_script",
  "read_script",
  "edit_script",
]);

/** The file-domain tools the model gets in project mode. */
const PROJECT_TOOLS: LlmTool[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "List all script/module files in the project (the code synced into Studio by Rojo).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a project source file by its relative path (e.g. src/server/Main.server.luau).",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Create or overwrite a project source file. Rojo syncs it into the live Studio session. Use src/server/*.server.luau, src/client/*.client.luau, or src/shared/*.luau.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a project source file by relative path.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "commit_project",
      description: "Checkpoint the current project state in git with a short message. Call after a change verifies clean.",
      parameters: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"],
      },
    },
  },
];

const PROJECT_TOOL_NAMES = new Set(PROJECT_TOOLS.map((t) => t.function.name));

/** Execute a file-domain tool against the project. Returns readable text. */
function runProjectTool(
  project: ProjectManager,
  name: string,
  args: Record<string, unknown>,
): string {
  switch (name) {
    case "list_files": {
      const files = project.listFiles();
      if (files.length === 0) return "(project is empty)";
      return files.map((f) => `${f.path} (${f.bytes}b)`).join("\n");
    }
    case "read_file":
      return project.readFile(String(args.path ?? ""));
    case "write_file":
      project.writeFile(String(args.path ?? ""), String(args.content ?? ""));
      return `Wrote ${args.path} — Rojo will sync it into Studio.`;
    case "delete_file":
      project.deleteFile(String(args.path ?? ""));
      return `Deleted ${args.path}.`;
    case "commit_project":
      return `Committed: ${project.commit(String(args.message ?? "Apple Juice update"))}`;
    default:
      return `Unknown project tool: ${name}`;
  }
}

export interface RuntimeAgentOptions {
  mcp: McpStdioClient;
  inference: InferenceOptions;
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
  maxIterations?: number;
  onProgress?: (p: RuntimeProgress) => void;
  signal?: AbortSignal;
  /**
   * When provided, enables the two-domain split (Option C + Rojo): scripts are
   * edited as files here (synced by Rojo), MCP script-edit tools are hidden, and
   * the project file tools are exposed to the model.
   */
  project?: ProjectManager;
}

export interface RuntimeAgentResult {
  message: string;
  iterations: number;
  error?: string;
}

/** Map the official MCP tools/list response into OpenAI function-calling schemas. */
export function officialToolsToLlmTools(toolsListResult: unknown): LlmTool[] {
  const tools =
    (toolsListResult as { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> })
      ?.tools ?? [];
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: t.inputSchema ?? { type: "object", properties: {} },
    },
  }));
}

/** Extract a readable text result from an MCP tools/call response. */
export function mcpResultToText(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> })?.content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (c.type === "text" ? c.text ?? "" : `[${c.type}]`))
      .join("\n")
      .trim();
  }
  if (typeof result === "string") return result;
  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

/** Bound a tool result before feeding it back to the model (truncation notice). */
export function boundResult(data: string, limit = 24_000): string {
  if (data.length <= limit) return data;
  return (
    data.slice(0, limit) +
    `\n\n[⚠️ OUTPUT TRUNCATED at ${limit} chars — ${data.length} total. NOT the full content; read in ranges if you need the rest.]`
  );
}

export async function runRuntimeAgent(
  opts: RuntimeAgentOptions,
): Promise<RuntimeAgentResult> {
  const {
    mcp,
    inference,
    prompt,
    history = [],
    maxIterations = 16,
    onProgress = () => {},
    signal,
    project,
  } = opts;

  if (!mcp.isRunning()) {
    return { message: "", iterations: 0, error: "Official Roblox Studio MCP is not running." };
  }

  // Discover the official tool surface once. In project mode, HIDE the
  // script-edit tools (scripting belongs to files) and ADD the file tools.
  let llmTools: LlmTool[] = [];
  try {
    const mcpTools = officialToolsToLlmTools(await mcp.listTools());
    if (project) {
      const liveTools = mcpTools.filter((t) => !EXCLUDED_MCP_TOOLS.has(t.function.name));
      llmTools = [...PROJECT_TOOLS, ...liveTools];
    } else {
      llmTools = mcpTools;
    }
  } catch (err) {
    return { message: "", iterations: 0, error: `Could not list MCP tools: ${(err as Error).message}` };
  }

  const messages: LlmMessage[] = [
    { role: "system", content: project ? SYSTEM_PROMPT_PROJECT : SYSTEM_PROMPT },
    ...history.slice(-10),
    { role: "user", content: prompt },
  ];

  let finalMessage = "";
  let iterations = 0;

  for (; iterations < maxIterations; iterations++) {
    if (signal?.aborted) return { message: "Cancelled.", iterations };

    const turn = await runLlmTurn(inference, messages, llmTools);
    if (turn.error) {
      onProgress({ kind: "error", message: turn.error });
      return { message: "", iterations, error: turn.error };
    }
    if (turn.content.trim()) onProgress({ kind: "thinking", text: turn.content.trim() });

    // No tool calls → the model is done.
    if (turn.toolCalls.length === 0) {
      finalMessage = turn.content.trim() || finalMessage;
      break;
    }

    messages.push({
      role: "assistant",
      content: turn.content || "",
      tool_calls: turn.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.arguments },
      })),
    });

    for (const call of turn.toolCalls) {
      if (signal?.aborted) return { message: "Cancelled.", iterations };
      onProgress({ kind: "tool_start", tool: call.name });
      let text: string;
      let ok = true;
      try {
        if (project && PROJECT_TOOL_NAMES.has(call.name)) {
          // File domain → project (Rojo syncs to Studio).
          text = boundResult(runProjectTool(project, call.name, parseToolArgs(call.arguments)));
        } else {
          // Live domain → official MCP.
          const result = await mcp.callTool(call.name, parseToolArgs(call.arguments));
          text = boundResult(mcpResultToText(result));
        }
      } catch (err) {
        ok = false;
        text = `ERROR: ${(err as Error).message}`;
      }
      onProgress({ kind: "tool_end", tool: call.name, ok });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.name,
        content: text || (ok ? "OK." : "ERROR"),
      });
    }
  }

  if (!finalMessage) finalMessage = "Done.";
  onProgress({ kind: "done", message: finalMessage });
  return { message: finalMessage, iterations };
}
