import { upsertSession } from "@/lib/store";

type ChatBody = {
  prompt?: string;
  pairingCode?: string;
  apiKey?: string;
  model?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatBody;
  const prompt = body.prompt?.trim() || "";
  const pairingCode = body.pairingCode?.trim() || "";
  const apiKey = body.apiKey?.trim() || "";
  const model = body.model?.trim() || "gpt-4o-mini";

  if (!prompt || !pairingCode || !apiKey) {
    return Response.json({ error: "prompt, pairingCode, and apiKey are required" }, { status: 400 });
  }

  const modelResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "Output ONLY valid Luau code. Do not use markdown formatting or backticks. Keep code deterministic and production-ready.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!modelResponse.ok) {
    const detail = await modelResponse.text();
    return Response.json({ error: "Provider request failed", detail, model }, { status: 502 });
  }

  const payload = (await modelResponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const code = payload.choices?.[0]?.message?.content?.trim() || "-- No code generated";
  const messageId = crypto.randomUUID();
  upsertSession(pairingCode, { code, messageId, hasNewCode: true });

  return Response.json({ messageId, code, pairingCode, model, ok: true });
}