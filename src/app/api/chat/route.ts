import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSession, upsertGeneratedCode } from "@/lib/store";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatBody = {
  prompt?: string;
  messages?: ChatMessage[];
  sessionKey?: string;
  apiKey?: string;
  model?: string;
  provider?: string;
  openaiKey?: string;
  mode?: "fast" | "thinking";
  fileContents?: { name: string; content: string }[];
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const ownerUserId = (session?.user as { id?: string } | undefined)?.id;

  if (!ownerUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as ChatBody;
  const prompt = body.prompt?.trim() ?? "";
  const sessionKey = body.sessionKey?.trim() ?? "";
  const apiKey = body.apiKey?.trim() ?? "";
  const model = body.model?.trim() ?? "gpt-4o-mini";
  const provider = (body.provider?.trim() || "openai").toString();
  const openaiKey = body.openaiKey?.trim() ?? "";
  const mode = body.mode ?? "fast";
  const fileContents = body.fileContents ?? [];

  if (!prompt || !sessionKey || !apiKey) {
    return Response.json({ error: "prompt, sessionKey, and apiKey are required" }, { status: 400 });
  }

  const pair = await getSession(sessionKey);
  if (!pair) return Response.json({ error: "Invalid session key" }, { status: 404 });
  if (pair.ownerUserId !== ownerUserId) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (Date.now() > pair.expiresAt) return Response.json({ error: "Session expired" }, { status: 410 });

  let raw = "";
  let modelUsed = model;

  type PluginPayload = { 
    action?: "create" | "delete";
    type?: "Script" | "LocalScript" | "ModuleScript";
    parent?: string; 
    name?: string; 
    code?: string; 
    message?: string; 
    suggestions?: string[];
    scripts?: PluginPayload[];
  };

  function tryParsePluginPayload(text?: string): PluginPayload | null {
    if (!text) return null;
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object" && ("code" in obj || "action" in obj || "scripts" in obj)) return obj as PluginPayload;
    } catch {
      // ignore
    }
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const obj = JSON.parse(m[0]);
        if (obj && typeof obj === "object" && ("code" in obj || "action" in obj || "scripts" in obj)) return obj as PluginPayload;
      } catch {
        // ignore
      }
    }
    return null;
  }

  // Build file context block
  let fileContextBlock = "";
  if (fileContents.length > 0) {
    fileContextBlock = "\n\nThe user has attached the following files for reference:\n";
    for (const f of fileContents) {
      fileContextBlock += `\n--- FILE: ${f.name} ---\n${f.content}\n--- END FILE ---\n`;
    }
  }

  const thinkingInstructions = mode === "thinking" 
    ? `\nBEFORE writing code, think step-by-step in the "thinking" field (a string) about:
1. What the user wants
2. Which services and APIs you'll use
3. Edge cases to handle
4. How scripts interact if making multiple
Include "thinking" as a field in your JSON output.`
    : "";

  const SYSTEM_PROMPT = `You are a Roblox Luau scripting assistant called Apple Juice.${thinkingInstructions}

When the user's request requires MULTIPLE scripts (e.g. a server script AND a client script, or a module AND a consumer), output a JSON object with:
- "scripts": an array of script objects, each with: action, type, parent, name, code
- "message": a friendly explanation of everything you created
- "suggestions": 3 short follow-up ideas
${mode === "thinking" ? '- "thinking": your step-by-step reasoning (string)' : ""}

When only ONE script is needed, output a JSON object with:
- "action": "create" or "delete"
- "type": "Script", "LocalScript", or "ModuleScript"
- "parent": dot path (e.g. "ServerScriptService", "StarterPlayer.StarterPlayerScripts", "ReplicatedStorage")
- "name": script name
- "code": valid Luau source code
- "message": a short friendly explanation (2-4 sentences)
- "suggestions": array of 3 short strings
${mode === "thinking" ? '- "thinking": your step-by-step reasoning (string)' : ""}

CRITICAL RULES FOR SCRIPT TYPE AND PARENT:
1. DEFAULT to "type": "Script" with "parent": "ServerScriptService". This is the correct choice for the vast majority of requests (game logic, NPC AI, data saving, anti-cheat, round systems, etc.).
2. Use "LocalScript" ONLY for client-side code (UI, camera, input handling). Place in "StarterPlayer.StarterPlayerScripts" or "StarterGui".
3. Use "ModuleScript" ONLY when the user explicitly asks for a reusable module/library that returns a table. Place in "ReplicatedStorage" or "ServerStorage". NEVER default to ModuleScript.
4. The code must be a standalone, runnable script. Do NOT wrap server logic in a module that returns a table unless the user specifically asked for a module.
${fileContextBlock}
Return ONLY the JSON object — no markdown, no backticks, no extra commentary outside the JSON.`;

  // Helper to call OpenAI Chat Completions
  async function callOpenAI(key: string, modelName: string) {
    const apiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
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
        temperature: mode === "thinking" ? 0.4 : 0.2,
        messages: apiMessages,
        max_tokens: mode === "thinking" ? 8192 : 4096,
      }),
    });

    const text = await res.text();
    return { ok: res.ok, text };
  }

  function extractContent(rawResponse: string, isGoogle = false): string {
    try {
      const parsed = JSON.parse(rawResponse);
      if (isGoogle) {
        return parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }
      return parsed?.choices?.[0]?.message?.content?.trim() ?? "";
    } catch {
      return "";
    }
  }

  function processResponse(content: string, rawText: string): { code: string; raw: string } {
    const structured = tryParsePluginPayload(content) || tryParsePluginPayload(rawText);
    if (structured) {
      if (structured.scripts && Array.isArray(structured.scripts)) {
        return { code: "", raw: JSON.stringify(structured) };
      }
      if (structured.code) {
        return { code: structured.code, raw: JSON.stringify(structured) };
      }
    }
    const cleanCode = content.replace(/^```(luau|lua)?\n?/gmi, "").replace(/```$/gm, "").trim();
    return {
      code: cleanCode,
      raw: JSON.stringify({
        action: "create",
        type: "Script",
        parent: "ServerScriptService",
        name: "AIGeneratedFallback",
        code: cleanCode,
      }),
    };
  }

  let code = "";

  if (model.toLowerCase().startsWith("gpt-") && openaiKey) {
    const { ok, text } = await callOpenAI(openaiKey, model);
    raw = text;
    if (!ok) return Response.json({ error: "LLM request failed", detail: raw, model }, { status: 502 });
    const content = extractContent(raw);
    const result = processResponse(content, raw);
    code = result.code;
    raw = result.raw;
    modelUsed = model;
  } else if (provider === "google") {
    const requestedModel = (model || "gemini-3-flash").trim();
    const GOOGLE_FALLBACK_MODELS = [
      "models/gemini-3.1-pro",
      "models/gemini-3-flash",
      "models/gemini-3.1-flash-lite",
      "models/gemini-2.5-pro",
      "models/gemini-2.5-flash"
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
              if (body.messages && body.messages.length > 0) {
                return body.messages.map((m, i) => ({
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: (i === 0 && m.role === "user") ? `${SYSTEM_PROMPT}\n\nUser Prompt: ${m.content}` : m.content }]
                }));
              }
              return [{ role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Prompt: ${prompt}` }] }];
            })(),
            generationConfig: { 
              temperature: mode === "thinking" ? 0.4 : 0.2, 
              maxOutputTokens: mode === "thinking" ? 8192 : 4096 
            },
          }),
        });

        const bodyText = await llmRes.text();
        lastResponseBody = bodyText;
        if (!llmRes.ok) {
          console.warn("Google generateContent failed", { model: candidate, status: llmRes.status });
          continue;
        }

        const content = extractContent(bodyText, true);
        if (content) {
          const result = processResponse(content, bodyText);
          code = result.code;
          raw = result.raw;
          modelUsed = candidate;
          break;
        }
      } catch (err) {
        lastResponseBody = String(err);
        console.warn("Google request error", err instanceof Error ? err.message : String(err));
        continue;
      }
    }

    if (!code && !raw && openaiKey) {
      const { ok, text } = await callOpenAI(openaiKey, "gpt-4o-mini");
      raw = text;
      if (ok) {
        const content = extractContent(raw);
        const result = processResponse(content, raw);
        code = result.code;
        raw = result.raw;
        modelUsed = "gpt-4o-mini";
      }
    }

    if (!code && !raw) {
      return Response.json({ error: "LLM request failed", detail: lastResponseBody, attemptedModels, provider, requestedModel }, { status: 502 });
    }
  } else {
    // Default: OpenAI using provided apiKey
    const { ok, text } = await callOpenAI(apiKey, model);
    raw = text;
    if (!ok) return Response.json({ error: "LLM request failed", detail: raw, model }, { status: 502 });
    const content = extractContent(raw);
    const result = processResponse(content, raw);
    code = result.code;
    raw = result.raw;
    modelUsed = model;
  }

  const structuredFinal = tryParsePluginPayload(raw) || null;
  const isMultiScript = structuredFinal?.scripts && Array.isArray(structuredFinal.scripts) && structuredFinal.scripts.length > 0;
  const isDelete = !isMultiScript && structuredFinal?.action === "delete";
  
  if (!code && !isDelete && !isMultiScript) return Response.json({ error: "Model returned empty output", detail: raw }, { status: 502 });

  const messageId = crypto.randomUUID();

  if (isMultiScript) {
    const scripts = structuredFinal!.scripts!;
    const scriptResults = scripts.map((s, i) => ({
      action: s.action ?? "create",
      type: s.type ?? "Script",
      parent: s.parent ?? "ServerScriptService",
      name: s.name ?? `GeneratedScript_${i}`,
      code: s.code ?? "",
      lineCount: s.code ? s.code.split("\n").length : 0,
    }));

    // Store the entire scripts array as a single plugin payload
    const pluginPayload = JSON.stringify({ scripts: scriptResults.map(s => ({
      action: s.action,
      type: s.type,
      parent: s.parent,
      name: s.name,
      code: s.code,
    }))});
    await upsertGeneratedCode(sessionKey, pluginPayload, messageId);

    const finalMessage = structuredFinal?.message ?? 
      `I've created ${scripts.length} scripts for you: ${scriptResults.map(s => s.name).join(", ")}.`;
    const finalSuggestions = structuredFinal?.suggestions ?? [
      "Test all scripts together",
      "Add error handling",
      "Create a configuration module",
    ];
    const thinking = (structuredFinal as any)?.thinking;

    return Response.json({
      ok: true,
      messageId,
      model: modelUsed,
      message: finalMessage,
      suggestions: finalSuggestions,
      scripts: scriptResults,
      thinking: thinking || undefined,
    });
  }

  // Single script path
  const finalParent = structuredFinal?.parent ?? "ServerScriptService";
  const finalName = structuredFinal?.name ?? `GeneratedScript_${messageId.slice(0, 8)}`;
  const finalCode = structuredFinal?.code ?? code;
  const finalType = structuredFinal?.type ?? "Script";
  const finalMessage = structuredFinal?.message ?? 
    (isDelete ? `I've removed the script called "${finalName}" from ${finalParent}.` : `I've created a ${finalType} called "${finalName}" and placed it in ${finalParent}. The script is ready to sync to your Studio.`);
  const finalSuggestions = structuredFinal?.suggestions ?? [
    "Add error handling and logging",
    "Create a configuration module",
    "Build a matching client-side script",
  ];
  const lineCount = finalCode ? finalCode.split("\n").length : 0;
  const thinking = (structuredFinal as any)?.thinking;

  const pluginPayload = JSON.stringify({ 
    action: isDelete ? "delete" : "create",
    type: finalType,
    parent: finalParent, 
    name: finalName, 
    code: finalCode 
  });

  await upsertGeneratedCode(sessionKey, pluginPayload, messageId);

  return Response.json({
    ok: true,
    code: finalCode,
    messageId,
    model: modelUsed,
    scriptName: finalName,
    scriptParent: finalParent,
    scriptType: finalType,
    action: isDelete ? "delete" : "create",
    lineCount,
    message: finalMessage,
    suggestions: finalSuggestions,
    thinking: thinking || undefined,
  });
}