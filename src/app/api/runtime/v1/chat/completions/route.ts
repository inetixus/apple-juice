import { getSession, trackMlUsage, calculateMlUsed } from "@/lib/store";
import { resolveKiroModelId } from "@/lib/kiro-models";

/**
 * Runtime inference proxy — the "brain doorway" for the local Apple Juice
 * Runtime (Option C).
 *
 * The local runtime agent loop runs on the user's machine, but it has no valid
 * place to send LLM turns: the Kiro VPS only trusts THIS server (not random
 * client machines), and direct access would skip auth + billing. So the runtime
 * POSTs an OpenAI-style request here with its session key as the bearer; we:
 *   1. authenticate the session key (getSession → ownerUserId),
 *   2. forward the request (messages + the runtime's own tools) to Kiro,
 *   3. meter the usage against the user's credits (same estimator as /api/chat),
 *   4. return the OpenAI-shaped response unchanged.
 *
 * This is intentionally a THIN passthrough: it reuses the exact Kiro endpoint,
 * model resolution, and metering the dashboard already uses, so billing stays
 * consistent with the normal chat path.
 *
 * NOTE (billing): usage is metered AFTER the call using the same estimator as
 * the chat route's fallback path. Hard pre-call quota enforcement is not done
 * here yet — a follow-up should reject over-quota users before forwarding.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatMessage {
  role: string;
  content?: string;
}

export async function POST(req: Request): Promise<Response> {
  // ── auth: Authorization: Bearer <sessionKey> ──────────────────────────
  const authHeader = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const sessionKey = m ? m[1].trim() : "";
  if (!sessionKey) {
    return Response.json({ error: "Missing session key" }, { status: 401 });
  }

  let pair: Awaited<ReturnType<typeof getSession>> = null;
  try {
    pair = await getSession(sessionKey);
  } catch (e) {
    // Session store (Turso) unreachable/unconfigured — fail closed, don't 500.
    return Response.json(
      { error: "Session store unavailable", detail: String(e).slice(0, 200) },
      { status: 503 },
    );
  }
  if (!pair?.ownerUserId) {
    return Response.json({ error: "Invalid or expired session" }, { status: 401 });
  }
  const ownerUserId = pair.ownerUserId;

  // ── parse the OpenAI-style request from the runtime ───────────────────
  let body: {
    model?: string;
    messages?: ChatMessage[];
    tools?: unknown[];
    tool_choice?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ error: "messages are required" }, { status: 400 });
  }
  // ── pick the inference backend ────────────────────────────────────────
  // Production: Kiro (its key lives in the deployment env). Local/dev: fall
  // back to OpenRouter using the platform key so the loop is testable without
  // the Kiro key. Kiro takes precedence whenever its key is present.
  const kiroKey = process.env.KIRO_API_KEY || "";
  const kiroUrl = (process.env.KIRO_API_URL || "https://api.kiro.dev/v1").replace(/\/$/, "");

  let endpoint: string;
  let authKey: string;
  let forwardModel: string;
  let referer = false;
  if (kiroKey) {
    endpoint = `${kiroUrl}/chat/completions`;
    authKey = kiroKey;
    forwardModel = resolveKiroModelId(body.model || "Auto");
    referer = true;
  } else {
    // Dev/test fallback — OpenRouter (OpenAI-compatible, supports tool-calling).
    const orKey = (process.env.OPENROUTERKEYS || "")
      .replace(/["']/g, "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)[0] || "";
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    authKey = orKey;
    forwardModel = "anthropic/claude-3.5-sonnet";
    referer = true;
  }
  if (!authKey) {
    return Response.json(
      { error: "No inference backend configured (set KIRO_API_KEY or OPENROUTERKEYS)" },
      { status: 503 },
    );
  }
  const targetModel = forwardModel;

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authKey}`,
        ...(referer ? { "HTTP-Referer": "https://applejuice.ai", "X-Title": "Apple Juice" } : {}),
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature: 0.2,
        max_tokens: 8192,
        stream: false,
        // Forward the runtime's OWN tools (official MCP tools + project file
        // tools) so the model can do real tool-calling locally.
        ...(tools ? { tools, tool_choice: toolChoice ?? "auto" } : {}),
      }),
    });
  } catch (e) {
    return Response.json(
      { error: "Inference upstream unreachable", detail: String(e) },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    return Response.json(
      { error: "Inference upstream error", status: upstream.status, detail: text.slice(0, 500) },
      { status: 502 },
    );
  }

  // ── meter usage against the user's credits (best-effort, never blocks) ─
  try {
    const inputChars = messages.reduce(
      (n, msg) => n + (typeof msg.content === "string" ? msg.content.length : 0),
      0,
    );
    const inputTk = Math.ceil(inputChars / 4);
    const outputTk = Math.ceil(text.length / 4);
    await trackMlUsage(ownerUserId, calculateMlUsed(inputTk, outputTk, targetModel));
  } catch {
    /* metering must never break inference */
  }

  // Return the OpenAI-shaped response straight back to the runtime.
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
