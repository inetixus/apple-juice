/**
 * Apple Juice Runtime — inference client.
 *
 * The Runtime agent loop runs locally, but LLM inference is proxied to the
 * existing VPS (kiro-proxy, OpenAI-compatible /v1/chat/completions) so API keys
 * never live on the user's machine or in the browser. Only model turns go out;
 * all TOOL calls stay local (McpStdioClient → official MCP).
 */

export interface LlmTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string; // raw JSON string
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface LlmTurn {
  content: string;
  toolCalls: LlmToolCall[];
  error?: string;
}

export interface InferenceOptions {
  /** Base URL of the VPS proxy, e.g. https://api.apple-juice.online */
  baseUrl: string;
  /** Session key / bearer the VPS uses to authorize + bill the user. */
  sessionKey: string;
  model?: string;
  requestTimeoutMs?: number;
}

/**
 * Execute one LLM turn against the VPS proxy. Sends messages + tool schemas,
 * returns assistant content and any tool calls (OpenAI function-calling shape).
 */
export async function runLlmTurn(
  opts: InferenceOptions,
  messages: LlmMessage[],
  tools: LlmTool[],
): Promise<LlmTurn> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.requestTimeoutMs ?? 120_000,
  );
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.sessionKey}`,
      },
      body: JSON.stringify({
        model: opts.model ?? "auto",
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { content: "", toolCalls: [], error: `Inference HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
        };
      }>;
    };
    const msg = data.choices?.[0]?.message;
    const toolCalls: LlmToolCall[] = (msg?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments ?? "{}",
    }));
    return { content: msg?.content ?? "", toolCalls };
  } catch (err) {
    return {
      content: "",
      toolCalls: [],
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a tool call's JSON arguments, tolerant of malformed output. */
export function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
