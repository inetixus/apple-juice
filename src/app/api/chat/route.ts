import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSession, upsertGeneratedCode } from "@/lib/store";

type ChatBody = {
  prompt?: string;
  pairingCode?: string;
  apiKey?: string;
  model?: string;
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
          content:
            "Output ONLY valid Luau code. Do not use markdown formatting or backticks.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  const raw = await llmRes.text();

  if (!llmRes.ok) {
    return Response.json(
      { error: "LLM request failed", status: llmRes.status, detail: raw, model },
      { status: 502 }
    );
  }

  const parsed = JSON.parse(raw);
  const code = parsed?.choices?.[0]?.message?.content?.trim() ?? "";

  if (!code) {
    return Response.json({ error: "Model returned empty output", detail: raw }, { status: 502 });
  }

  const messageId = crypto.randomUUID();
  upsertGeneratedCode(pairingCode, code, messageId);

  return Response.json({ ok: true, code, messageId, model });
}