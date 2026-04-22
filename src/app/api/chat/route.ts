import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSession, upsertGeneratedCode } from "@/lib/store";

type ChatBody = {
  prompt?: string;
  pairingCode?: string;
  apiKey?: string;
  model?: string;
  provider?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const ownerUserId = (session?.user as { id?: string } | undefined)?.id;

  if (!ownerUserId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as ChatBody;
  const prompt = body.prompt?.trim() ?? "";
  const pairingCode = body.pairingCode?.trim() ?? "";
  const apiKey = body.apiKey?.trim() ?? "";
  const model = body.model?.trim() ?? "gpt-4o-mini";
  const provider = (body.provider?.trim() || "openai").toString();

  if (!prompt || !pairingCode || !apiKey) {
    return Response.json(
      { error: "prompt, pairingCode, and apiKey are required" },
      { status: 400 }
    );
  }

  const pair = getSession(pairingCode);
  if (!pair) return Response.json({ error: "Invalid pairing code" }, { status: 404 });
  if (pair.ownerUserId !== ownerUserId) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (Date.now() > pair.expiresAt) return Response.json({ error: "Pairing expired" }, { status: 410 });

  let raw = "";
  let code = "";

  if (provider === "google") {
    // Use the requested model name (normalize to models/<name>) or fallback to text-bison-001
    const requestedModel = (model || "text-bison-001").trim();
    const googleModelPath = requestedModel.startsWith("models/") ? requestedModel : `models/${requestedModel}`;
    const url = `https://generativelanguage.googleapis.com/v1beta2/${googleModelPath}:generateText?key=${encodeURIComponent(
      apiKey,
    )}`;

    const llmRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: { text: prompt },
        temperature: 0.2,
        maxOutputTokens: 1024,
      }),
    });

    raw = await llmRes.text();

    if (!llmRes.ok) {
      return Response.json(
        { error: "LLM request failed", status: llmRes.status, detail: raw, model: requestedModel, provider },
        { status: 502 },
      );
    }

    try {
      const parsed = JSON.parse(raw);
      // Try several possible response shapes that Google may return.
      code =
        parsed?.candidates?.[0]?.content?.trim?.() ||
        parsed?.candidates?.[0]?.output?.[0]?.content?.trim?.() ||
        parsed?.candidates?.[0]?.text ||
        parsed?.output?.[0]?.content?.trim?.() ||
        parsed?.outputText ||
        parsed?.content ||
        "";
    } catch {
      code = "";
    }
  } else {
    const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "Output ONLY valid Luau code. Do not use markdown formatting or backticks.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    raw = await llmRes.text();

    if (!llmRes.ok) {
      return Response.json(
        { error: "LLM request failed", status: llmRes.status, detail: raw, model },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(raw);
    code = parsed?.choices?.[0]?.message?.content?.trim() ?? "";
  }

  if (!code) {
    return Response.json({ error: "Model returned empty output", detail: raw }, { status: 502 });
  }

  const messageId = crypto.randomUUID();
  upsertGeneratedCode(pairingCode, code, messageId);

  return Response.json({ ok: true, code, messageId, model });
}