import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSession, upsertGeneratedCode } from "@/lib/store";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatBody = {
  prompt?: string;
  messages?: ChatMessage[];
  pairingCode?: string;
  apiKey?: string;
  model?: string;
  provider?: string;
  openaiKey?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const ownerUserId = (session?.user as { id?: string } | undefined)?.id;

  if (!ownerUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as ChatBody;
  const prompt = body.prompt?.trim() ?? "";
  const pairingCode = body.pairingCode?.trim() ?? "";
  const apiKey = body.apiKey?.trim() ?? "";
  const model = body.model?.trim() ?? "gpt-4o-mini";
  const provider = (body.provider?.trim() || "openai").toString();
  const openaiKey = body.openaiKey?.trim() ?? "";

  if (!prompt || !pairingCode || !apiKey) {
    return Response.json({ error: "prompt, pairingCode, and apiKey are required" }, { status: 400 });
  }

  const pair = await getSession(pairingCode);
  if (!pair) return Response.json({ error: "Invalid pairing code" }, { status: 404 });
  if (pair.ownerUserId !== ownerUserId) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (Date.now() > pair.expiresAt) return Response.json({ error: "Pairing expired" }, { status: 410 });

  let raw = "";
  let code = "";
  let modelUsed = model;

  type PluginPayload = { parent?: string; name?: string; code?: string };

  function tryParsePluginPayload(text?: string): PluginPayload | null {
    if (!text) return null;
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object" && ("code" in obj)) return obj as PluginPayload;
    } catch {
      // ignore
    }
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const obj = JSON.parse(m[0]);
        if (obj && typeof obj === "object" && ("code" in obj)) return obj as PluginPayload;
      } catch {
        // ignore
      }
    }
    return null;
  }

  // Helper to call OpenAI Chat Completions and extract structured payload or raw content
  async function callOpenAI(key: string, modelName: string) {
    const apiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      {
        role: "system",
        content:
          "Output ONLY a JSON object with fields `parent` (dot path), `name` (script name), and `code` (Luau source as a string). Return only the JSON object and nothing else — no markdown, no backticks, no commentary. The `code` field must contain valid Luau code.",
      },
    ];

    if (body.messages && body.messages.length > 0) {
      apiMessages.push(...(body.messages as any[]));
    } else {
      apiMessages.push({ role: "user", content: prompt });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.2,
        messages: apiMessages,
        max_tokens: 4096,
      }),
    });

    const text = await res.text();
    return { ok: res.ok, text };
  }

  if (model.toLowerCase().startsWith("gpt-") && openaiKey) {
    const { ok, text } = await callOpenAI(openaiKey, model);
    raw = text;
    if (!ok) return Response.json({ error: "LLM request failed", detail: raw, model }, { status: 502 });
    try {
      const parsed = JSON.parse(raw);
      const content = parsed?.choices?.[0]?.message?.content?.trim() ?? "";
      const structured = tryParsePluginPayload(content) || tryParsePluginPayload(raw);
      if (structured && structured.code) {
        code = structured.code;
        raw = JSON.stringify(structured);
      } else {
        code = content;
      }
    } catch {
      code = raw;
    }
    modelUsed = model;
  } else if (provider === "google") {
    const requestedModel = (model || "text-bison-001").trim();
    const GOOGLE_FALLBACK_MODELS = [
      "models/gemini-3.1-pro",
      "models/gemini-3-flash",
      "models/gemini-3.1-flash-lite",
      "models/gemini-2.5-pro",
      "models/gemini-2.5-flash",
      "models/text-bison-001",
    ];

    let availableModels: string[] = [];
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta2/models?key=${encodeURIComponent(apiKey)}`;
      const listRes = await fetch(listUrl, { method: "GET", headers: { "Content-Type": "application/json" } });
      const listRaw = await listRes.text();
      if (listRes.ok) {
        const listParsed = JSON.parse(listRaw);
        const rawModels = listParsed?.models || [];
        availableModels = rawModels.map((m: any) => m?.name || m?.model || "").filter((id: string) => !!id);
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
      const url = `https://generativelanguage.googleapis.com/v1beta/${candidate}:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        const llmRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: (() => {
              const sysInstruction = "Output ONLY a JSON object with fields `parent` (dot path), `name` (script name), and `code` (Luau source as a string). Return only the JSON object and nothing else — no markdown, no backticks, no commentary. The `code` field must contain valid Luau code.";
              if (body.messages && body.messages.length > 0) {
                return body.messages.map((m, i) => ({
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: (i === 0 && m.role === "user") ? `${sysInstruction}\n\nUser Prompt: ${m.content}` : m.content }]
                }));
              }
              return [
                {
                  role: "user",
                  parts: [{ text: `${sysInstruction}\n\nUser Prompt: ${prompt}` }]
                }
              ];
            })(),
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
          }),
        });

        const bodyText = await llmRes.text();
        lastResponseBody = bodyText;
        if (!llmRes.ok) {
          console.warn("Google generateContent failed", { model: candidate, status: llmRes.status });
          continue;
        }

        const parsed = JSON.parse(bodyText);
        const content = parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        const structured = tryParsePluginPayload(content) || tryParsePluginPayload(bodyText);
        if (structured && structured.code) {
          code = structured.code;
          raw = JSON.stringify(structured);
          modelUsed = candidate;
          break;
        }

        if (content) {
          code = content.replace(/^```(luau|lua)?\n?/gmi, "").replace(/```$/gm, "").trim();
          modelUsed = candidate;
          break;
        }
      } catch (err) {
        lastResponseBody = String(err);
        console.warn("Google request error", err instanceof Error ? err.message : String(err));
        continue;
      }
    }

    if (!code && openaiKey) {
      const { ok, text } = await callOpenAI(openaiKey, "gpt-4o-mini");
      raw = text;
      if (ok) {
        try {
          const parsed = JSON.parse(raw);
          const content = parsed?.choices?.[0]?.message?.content?.trim() ?? "";
          const structured = tryParsePluginPayload(content) || tryParsePluginPayload(raw);
          if (structured && structured.code) {
            code = structured.code;
            raw = JSON.stringify(structured);
          } else {
            code = content;
          }
        } catch {
          code = raw;
        }
        modelUsed = "gpt-4o-mini";
      }
    }

    if (!code) {
      return Response.json({ error: "LLM request failed", detail: lastResponseBody, attemptedModels, provider, requestedModel }, { status: 502 });
    }
  } else {
    // Default: OpenAI using provided apiKey
    const { ok, text } = await callOpenAI(apiKey, model);
    raw = text;
    if (!ok) return Response.json({ error: "LLM request failed", detail: raw, model }, { status: 502 });
    try {
      const parsed = JSON.parse(raw);
      const content = parsed?.choices?.[0]?.message?.content?.trim() ?? "";
      const structured = tryParsePluginPayload(content) || tryParsePluginPayload(raw);
      if (structured && structured.code) {
        code = structured.code;
        raw = JSON.stringify(structured);
      } else {
        code = content;
      }
    } catch {
      code = raw;
    }
    modelUsed = model;
  }

  if (!code) return Response.json({ error: "Model returned empty output", detail: raw }, { status: 502 });

  const messageId = crypto.randomUUID();

  // If the LLM returned a structured payload, raw will contain that JSON; prefer those fields.
  const structuredFinal = tryParsePluginPayload(raw) || null;
  const finalParent = structuredFinal?.parent ?? "ServerScriptService";
  const finalName = structuredFinal?.name ?? `GeneratedScript_${messageId.slice(0, 8)}`;
  const finalCode = structuredFinal?.code ?? code;

  const pluginPayload = JSON.stringify({ parent: finalParent, name: finalName, code: finalCode });

  await upsertGeneratedCode(pairingCode, pluginPayload, messageId);

  return Response.json({ ok: true, code: finalCode, messageId, model: modelUsed });
}