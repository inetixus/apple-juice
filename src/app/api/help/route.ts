/**
 * Lightweight Help Assistant endpoint.
 * Talks directly to the self-hosted Ollama VM — no auth, no session, no juice checks.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const maxDuration = 30;

const OLLAMA_HOST = "http://130.110.14.224:11434";
const OLLAMA_MODEL = "qwen2.5-coder:1.5b";

type HelpBody = {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
};

export async function POST(req: Request) {
  // Light auth check — just make sure the user is logged in
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as HelpBody;
  const messages = body.messages || [];

  if (messages.length === 0) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    const res = await fetch(`${OLLAMA_HOST}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[Help] Ollama error ${res.status}:`, detail);
      return Response.json(
        { error: "Ollama request failed", detail },
        { status: 502 },
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "";

    return Response.json({ content, model: OLLAMA_MODEL });
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    console.error(`[Help] ${isTimeout ? "Timeout" : "Error"}:`, err?.message);
    return Response.json(
      {
        error: isTimeout ? "Request timed out" : "Connection failed",
        message: err?.message || "Could not reach the Ollama VM",
      },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
