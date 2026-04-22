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

  let raw = "";
  let code = "";
  let modelUsed = model;

  // If user selected a GPT-style model and provided an OpenAI key, prefer OpenAI.
  if (model.toLowerCase().startsWith("gpt-") && openaiKey) {
    const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
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
    modelUsed = model;
  } else if (provider === "google") {
    // Try multiple Google models (requested → fallbacks → discovered models), then OpenAI fallback.
    const requestedModel = (model || "text-bison-001").trim();
    const GOOGLE_FALLBACK_MODELS = [
      "models/gemini-3.1-pro",
      "models/gemini-3-flash",
      "models/gemini-3.1-flash-lite",
      "models/gemini-2.5-pro",
      "models/gemini-2.5-flash",
      "models/text-bison-001",
    ];

    // Discover available models from Google (best-effort).
    let availableModels: string[] = [];
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta2/models?key=${encodeURIComponent(apiKey)}`;
      const listRes = await fetch(listUrl, { method: "GET", headers: { "Content-Type": "application/json" } });
      const listRaw = await listRes.text();
      if (listRes.ok) {
        const listParsed = JSON.parse(listRaw);
        const rawModels = listParsed?.models || [];
        availableModels = rawModels
          .map((m: any) => m?.name || m?.model || "")
          .filter((id: string) => !!id);
      } else {
        // keep availableModels empty; log for diagnostics (do not log API keys)
        console.warn("Google models list failed", { status: listRes.status, body: listRaw?.slice?.(0, 1000) });
      }
    } catch (err) {
      console.warn("Google models list error", err instanceof Error ? err.message : String(err));
    }

    const requestedNormalized = requestedModel.startsWith("models/") ? requestedModel : `models/${requestedModel}`;
    const candidatePool = Array.from(new Set([requestedNormalized, ...GOOGLE_FALLBACK_MODELS, ...availableModels]));

    const attemptedModels: string[] = [];
    let lastResponseBody = "";
    for (const candidate of candidatePool) {
      attemptedModels.push(candidate);
      const url = `https://generativelanguage.googleapis.com/v1beta2/${candidate}:generateText?key=${encodeURIComponent(apiKey)}`;
      try {
        const llmRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: { text: prompt },
            temperature: 0.2,
            maxOutputTokens: 1024,
          }),
        });

        const bodyText = await llmRes.text();
        lastResponseBody = bodyText;

        if (!llmRes.ok) {
          console.warn("Google generateText failed", { model: candidate, status: llmRes.status });
          continue;
        }

        try {
          const parsed = JSON.parse(bodyText);
          code =
            parsed?.candidates?.[0]?.content?.trim?.() ||
            parsed?.candidates?.[0]?.output?.[0]?.content?.trim?.() ||
            parsed?.candidates?.[0]?.text ||
            parsed?.output?.[0]?.content?.trim?.() ||
            parsed?.outputText ||
            parsed?.content ||
            "";

          if (code) {
            modelUsed = candidate;
            break;
          }
        } catch (err) {
          lastResponseBody = bodyText;
          console.warn("Failed to parse Google response", err instanceof Error ? err.message : String(err));
          continue;
        }
      } catch (err) {
        lastResponseBody = String(err);
        console.warn("Google request error", err instanceof Error ? err.message : String(err));
        continue;
      }
    }

    // If Google attempts didn't produce code, allow OpenAI fallback if configured.
    if (!code && openaiKey) {
      try {
        const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
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
        if (llmRes.ok) {
          const parsed = JSON.parse(raw);
          code = parsed?.choices?.[0]?.message?.content?.trim() ?? "";
          modelUsed = "gpt-4o-mini";
        } else {
          lastResponseBody = raw;
        }
      } catch (err) {
        lastResponseBody = String(err);
      }
    }

    if (!code) {
      return Response.json(
        {
          error: "LLM request failed",
          detail: lastResponseBody,
          attemptedModels,
          provider,
          requestedModel,
        },
        { status: 502 },
      );
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
    modelUsed = model;
  }

  if (!code) {
    return Response.json({ error: "Model returned empty output", detail: raw }, { status: 502 });
  }

  const messageId = crypto.randomUUID();
  await upsertGeneratedCode(pairingCode, code, messageId);

  return Response.json({ ok: true, code, messageId, model: modelUsed });
}