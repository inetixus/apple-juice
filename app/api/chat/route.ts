import { NextResponse } from "next/server";
import { upsertSession } from "../../../lib/store";

type ChatPayload = {
  prompt?: string;
  pairingCode?: string;
  apiKey?: string;
};

const SYSTEM_PROMPT =
  "You are an expert Roblox Luau developer. Output ONLY valid Luau code. Do not use markdown formatting or backticks in the final response string.";

export async function POST(req: Request) {
  let payload: ChatPayload;

  try {
    payload = (await req.json()) as ChatPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const prompt = payload.prompt?.trim();
  const pairingCode = payload.pairingCode?.trim();
  const apiKey = payload.apiKey?.trim();

  if (!prompt || !pairingCode || !apiKey) {
    return NextResponse.json(
      { error: "prompt, pairingCode, and apiKey are required." },
      { status: 400 },
    );
  }

  const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!llmResponse.ok) {
    const errorBody = await llmResponse.text();
    return NextResponse.json(
      { error: "OpenAI request failed.", details: errorBody },
      { status: llmResponse.status },
    );
  }

  const json = (await llmResponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const code = json.choices?.[0]?.message?.content?.trim();

  if (!code) {
    return NextResponse.json(
      { error: "Model returned an empty response." },
      { status: 502 },
    );
  }

  const messageId = crypto.randomUUID();

  upsertSession(pairingCode, {
    code,
    messageId,
    hasNewCode: true,
  });

  return NextResponse.json({ success: true, messageId });
}