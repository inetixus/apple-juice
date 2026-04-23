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
  openaiKey?: string;
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
  const openaiKey = body.openaiKey?.trim() ?? "";

  if (!prompt || !pairingCode || !apiKey) {
    return Response.json(
      { error: "prompt, pairingCode, and apiKey are required" },
      { status: 400 }
    );
  }

  const pair = await getSession(pairingCode);
  if (!pair) return Response.json({ error: "Invalid pairing code" }, { status: 404 });
  if (pair.ownerUserId !== ownerUserId) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (Date.now() > pair.expiresAt) return Response.json({ error: "Pairing expired" }, { status: 410 });

  // SYSTEM INSTRUCTION FOR STRUCTURAL JSON
  const systemInstruction = "You are a Roblox Luau expert. Output ONLY a valid JSON object. Do not use markdown formatting or backticks. The JSON must contain exactly three keys: 'parent' (the Roblox path where the script belongs, e.g., 'ServerScriptService', 'ReplicatedStorage', 'StarterPlayer.StarterPlayerScripts'), 'name' (the exact name of the script), and 'code' (the Luau code).";

  let raw = "";
  let code = "";
  let modelUsed = model;

  // 1. OPENAI PATH (If specifically requested or using OpenAI provider)
  if (model.toLowerCase().startsWith("gpt-") || provider === "openai") {
    const targetKey = provider === "openai" ? apiKey : openaiKey;
    const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${targetKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt },
        ],
      }),
    });

    raw = await llmRes.text();
    if (llmRes.ok) {
      const parsed = JSON.parse(raw);
      code = parsed?.choices?.[0]?.message?.content?.trim() ?? "";
    }
  } 
  
  // 2. GOOGLE PATH (With full model discovery and fallback logic)
  else if (provider === "google") {
    const requestedModel = (model || "gemini-1.5-flash").trim();
    const GOOGLE_FALLBACK_MODELS = [
      "models/gemini-1.5-pro",
      "models/gemini-1.5-flash",
      "models/gemini-pro",
    ];

    let availableModels: string[] = [];
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const listRes = await fetch(listUrl, { method: "GET" });
      if (listRes.ok) {
        const listParsed = await listRes.json();
        availableModels = (listParsed?.models || []).map((m: any) => m.name);
      }
    } catch (err) { console.warn("Google models list error", err); }

    const requestedNormalized = requestedModel.startsWith("models/") ? requestedModel : `models/${requestedModel}`;
    const candidatePool = Array.from(new Set([requestedNormalized, ...GOOGLE_FALLBACK_MODELS, ...availableModels]));

    let lastResponseBody = "";
    for (const candidate of candidatePool) {
      const url = `https://generativelanguage.googleapis.com/v1beta/${candidate}:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        const llmRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemInstruction + "\n\nUser Prompt: " + prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
          }),
        });

        const bodyText = await llmRes.text();
        lastResponseBody = bodyText;
        if (!llmRes.ok) continue;

        const parsed = JSON.parse(bodyText);
        code = parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (code) {
          modelUsed = candidate;
          break;
        }
      } catch (err) { continue; }
    }

    // OpenAI Fallback if Google fails completely
    if (!code && openaiKey) {
      try {
        const fallbackRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.2,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: prompt },
            ],
          }),
        });
        if (fallbackRes.ok) {
          const fParsed = await fallbackRes.json();
          code = fParsed?.choices?.[0]?.message?.content?.trim() ?? "";
          modelUsed = "gpt-4o-mini";
        }
      } catch (e) {}
    }
  }

  // 3. CLEANUP AND STORAGE
  // Strip potential markdown JSON blocks if AI ignored "No Backticks"
  code = code.replace(/^```json\n?/gmi, '').replace(/```$/gm, '').trim();

  if (!code) {
    return Response.json({ error: "Model returned empty output", detail: raw }, { status: 502 });
  }

  const messageId = crypto.randomUUID();
  try {
    await upsertGeneratedCode(pairingCode, code, messageId);
  } catch (err) {
    return Response.json({ error: "Database storage failed", detail: String(err) }, { status: 500 });
  }

  return Response.json({ ok: true, code, messageId, model: modelUsed });
}