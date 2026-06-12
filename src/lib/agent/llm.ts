/**
 * LLM layer for the agentic loop.
 *
 * Thin wrapper over the Kiro OpenAI-compatible Chat Completions endpoint that
 * the rest of the app already uses (`KIRO_API_KEY` + `KIRO_API_URL`). Unlike
 * the legacy single-shot path, this exposes a turn-based, tool-calling
 * interface: you pass the running message list + tool schemas, and get back
 * either tool calls to execute or a final assistant message.
 *
 * Non-streaming on purpose — the agent loop runs many short turns and streams
 * its OWN progress narration to the client; token-by-token streaming of each
 * internal turn would be noise.
 */

export type LlmRole = "system" | "user" | "assistant" | "tool";

export type LlmToolCall = {
  id: string;
  name: string;
  /** Raw JSON string of arguments as returned by the model. */
  arguments: string;
};

export type LlmMessage = {
  role: LlmRole;
  content: string | null;
  /** Present on assistant turns that requested tools. */
  tool_calls?: LlmToolCall[];
  /** Present on tool-result turns; links back to the originating call. */
  tool_call_id?: string;
  /** Optional label for tool messages (the tool name). */
  name?: string;
};

export type LlmToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LlmTurn = {
  /** Assistant's natural-language content for this turn (may be empty). */
  content: string;
  /** Tool calls the model wants executed before continuing. */
  toolCalls: LlmToolCall[];
  /** Rough token accounting for billing. */
  usage: { inputTokens: number; outputTokens: number };
  /** True when the upstream call itself failed. */
  error?: string;
};

function kiroConfig() {
  const key = process.env.KIRO_API_KEY || "";
  const url = (process.env.KIRO_API_URL || "https://api.kiro.dev/v1").replace(
    /\/$/,
    "",
  );
  return { key, url };
}

/** Whether the native agent loop has what it needs to call the model. */
export function isAgentLlmConfigured(): boolean {
  return !!process.env.KIRO_API_KEY;
}

function toOpenAiTools(tools: LlmToolSchema[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/** Serialize our message shape into the OpenAI Chat Completions wire format. */
function toWireMessages(messages: LlmMessage[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: m.content ?? "",
        tool_call_id: m.tool_call_id,
      };
    }
    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      return {
        role: "assistant",
        content: m.content ?? "",
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content ?? "" };
  });
}

/**
 * Run a single model turn. Returns the assistant content + any tool calls.
 * `modelId` is the resolved Kiro model id (e.g. "claude-opus-4.8" / "auto").
 */
export async function runLlmTurn(opts: {
  modelId: string;
  messages: LlmMessage[];
  tools: LlmToolSchema[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<LlmTurn> {
  const { key, url } = kiroConfig();
  if (!key) {
    return {
      content: "",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      error: "KIRO_API_KEY is not configured.",
    };
  }

  const body = {
    model: opts.modelId,
    messages: toWireMessages(opts.messages),
    tools: toOpenAiTools(opts.tools),
    tool_choice: "auto",
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 8192,
    stream: false,
  };

  let res: Response;
  try {
    res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    return {
      content: "",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      content: "",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      error: `LLM HTTP ${res.status}: ${detail.slice(0, 500)}`,
    };
  }

  let json: any;
  try {
    json = await res.json();
  } catch (err) {
    return {
      content: "",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      error: "Failed to parse LLM response JSON.",
    };
  }

  const choice = json?.choices?.[0]?.message ?? {};
  const rawToolCalls: any[] = Array.isArray(choice.tool_calls)
    ? choice.tool_calls
    : [];
  const toolCalls: LlmToolCall[] = rawToolCalls
    .filter((c) => c?.function?.name)
    .map((c, i) => ({
      id: c.id || `call_${i}`,
      name: c.function.name,
      arguments:
        typeof c.function.arguments === "string"
          ? c.function.arguments
          : JSON.stringify(c.function.arguments ?? {}),
    }));

  const usage = json?.usage ?? {};
  return {
    content: typeof choice.content === "string" ? choice.content : "",
    toolCalls,
    usage: {
      inputTokens:
        usage.prompt_tokens ??
        Math.ceil(JSON.stringify(body.messages).length / 4),
      outputTokens:
        usage.completion_tokens ??
        Math.ceil(
          ((choice.content?.length ?? 0) +
            JSON.stringify(rawToolCalls).length) /
            4,
        ),
    },
  };
}

/** Safely parse a tool-call argument string into an object. */
export function parseToolArgs(raw: string): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // Some models wrap args in markdown or add trailing prose — try to recover
    // the first balanced JSON object.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        /* give up */
      }
    }
    return {};
  }
}


/**
 * Plain (no-tools) completion. Used by the multi-model code council, where each
 * candidate model just returns code/text and a judge model scores them.
 */
export async function runPlainCompletion(opts: {
  modelId: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}): Promise<{
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  error?: string;
}> {
  const { key, url } = kiroConfig();
  if (!key) {
    return {
      content: "",
      usage: { inputTokens: 0, outputTokens: 0 },
      error: "KIRO_API_KEY is not configured.",
    };
  }

  const body = {
    model: opts.modelId,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 8192,
    stream: false,
  };

  let res: Response;
  try {
    res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    return {
      content: "",
      usage: { inputTokens: 0, outputTokens: 0 },
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return {
      content: "",
      usage: { inputTokens: 0, outputTokens: 0 },
      error: `LLM HTTP ${res.status}: ${detail.slice(0, 300)}`,
    };
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    return {
      content: "",
      usage: { inputTokens: 0, outputTokens: 0 },
      error: "Failed to parse LLM response JSON.",
    };
  }

  const content = json?.choices?.[0]?.message?.content;
  const usage = json?.usage ?? {};
  return {
    content: typeof content === "string" ? content : "",
    usage: {
      inputTokens:
        usage.prompt_tokens ??
        Math.ceil((opts.system.length + opts.user.length) / 4),
      outputTokens:
        usage.completion_tokens ??
        Math.ceil((typeof content === "string" ? content.length : 0) / 4),
    },
  };
}
