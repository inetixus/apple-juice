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

export interface RuntimeAgentOptions {
  mcp: McpStdioClient;
  inference: InferenceOptions;
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
  maxIterations?: number;
  onProgress?: (p: RuntimeProgress) => void;
  signal?: AbortSignal;
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
  } = opts;

  if (!mcp.isRunning()) {
    return { message: "", iterations: 0, error: "Official Roblox Studio MCP is not running." };
  }

  // Discover the official tool surface once.
  let llmTools: LlmTool[] = [];
  try {
    llmTools = officialToolsToLlmTools(await mcp.listTools());
  } catch (err) {
    return { message: "", iterations: 0, error: `Could not list MCP tools: ${(err as Error).message}` };
  }

  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
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
        const result = await mcp.callTool(call.name, parseToolArgs(call.arguments));
        text = boundResult(mcpResultToText(result));
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
