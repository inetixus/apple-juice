import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSession, upsertGeneratedCode, getUserUsage, trackUserUsage, getRedis } from "@/lib/store";

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
  autoSync?: boolean;
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
  const autoSync = body.autoSync ?? true;

  const systemOpenAIKey = process.env.OPENAI_API_KEY || "";
  const systemGoogleKey = process.env.GOOGLE_API_KEY || "";

  const clientKey = provider === "google" ? apiKey : (openaiKey || apiKey);
  const isUsingCustomKey = !!clientKey && clientKey !== systemOpenAIKey && clientKey !== systemGoogleKey;

  let effectiveProvider = provider;
  let effectiveModel = model;

  if (!isUsingCustomKey) {
    effectiveProvider = "google";
    if (effectiveModel.toLowerCase().startsWith("gpt-")) {
      effectiveModel = "gemini-3-flash";
    }
  }

  const finalGoogleKey = (effectiveProvider === "google" && clientKey) ? clientKey : systemGoogleKey;
  const finalOpenAIKey = (effectiveProvider === "openai" && clientKey) ? clientKey : systemOpenAIKey;

  // Check credits only if NOT using a custom key
  if (!isUsingCustomKey) {
    const usage = await getUserUsage(ownerUserId);
    if (usage.usedTokens >= usage.totalTokens) {
      return Response.json({
        error: "Daily limit reached",
        message: "You have used all 50 apple credits for today. Credits will reset tomorrow. To continue without limits, use your own API key in Settings.",
        usage
      }, { status: 429 });
    }
  }

  if (!prompt || !sessionKey) {
    return Response.json({ error: "prompt and sessionKey are required" }, { status: 400 });
  }

  const pair = await getSession(sessionKey);
  if (!pair) return Response.json({ error: "Invalid session key" }, { status: 404 });
  if (pair.ownerUserId !== ownerUserId) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (Date.now() > pair.expiresAt) return Response.json({ error: "Session expired" }, { status: 410 });

  let raw = "";
  let modelUsed = model;

  type PluginPayload = {
    action?: "create" | "delete" | "insert_asset" | "stop_playtest";
    type?: "Script" | "LocalScript" | "ModuleScript" | "Asset";
    parent?: string;
    name?: string;
    code?: string;
    assetId?: number | string;
    message?: string;
    suggestions?: string[];
    scripts?: PluginPayload[];
  };

  function tryParsePluginPayload(text?: string): PluginPayload | null {
    if (!text) return null;

    // Step 1: Strip markdown fences if present
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    // Step 2: Try direct parse
    try {
      const obj = JSON.parse(cleaned);
      if (obj && typeof obj === "object" && ("code" in obj || "action" in obj || "scripts" in obj)) return obj as PluginPayload;
    } catch {
      // ignore
    }

    // Step 3: Find JSON objects by locating balanced braces
    // This handles cases where the AI dumps thinking text before the JSON
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace === -1) return null;

    // Try progressively from each '{' to find a valid JSON object
    for (let i = firstBrace; i < cleaned.length; i++) {
      if (cleaned[i] !== '{') continue;
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let j = i; j < cleaned.length; j++) {
        const ch = cleaned[j];
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"' && !escape) { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const candidate = cleaned.substring(i, j + 1);
            try {
              const obj = JSON.parse(candidate);
              if (obj && typeof obj === "object" && ("code" in obj || "action" in obj || "scripts" in obj)) {
                return obj as PluginPayload;
              }
            } catch {
              // not valid JSON, try next brace
            }
            break;
          }
        }
      }
    }

    // Step 4: Regex fallback for truncated JSON
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const obj = JSON.parse(m[0]);
        if (obj && typeof obj === "object" && ("code" in obj || "action" in obj || "scripts" in obj)) return obj as PluginPayload;
      } catch {
        // Handle truncated JSON fallback
        const raw = m[0];
        if (raw.includes('"code"')) {
          const t = raw.match(/"type"\s*:\s*"([^"]+)"/)?.[1] as any;
          const p = raw.match(/"parent"\s*:\s*"([^"]+)"/)?.[1];
          const n = raw.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
          const codeIndex = raw.indexOf('"code"');
          if (codeIndex !== -1) {
            let codeStr = raw.substring(codeIndex + 6);
            const colonIndex = codeStr.indexOf(':');
            if (colonIndex !== -1) {
              codeStr = codeStr.substring(colonIndex + 1).trim();
              if (codeStr.startsWith('"')) {
                codeStr = codeStr.substring(1);
                codeStr = codeStr.replace(/\"\s*\}\s*$/, '').replace(/\"\s*$/, '');
                try {
                  codeStr = JSON.parse('"' + codeStr + '"');
                } catch {
                  codeStr = codeStr.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                }
                return { action: "create", type: t || "Script", parent: p || "ServerScriptService", name: n || "TruncatedScript", code: codeStr };
              }
            }
          }
        }
      }
    }
    return null;
  }

  function getPreamble(text?: string): string | null {
    if (!text) return null;
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 20) {
      // Return everything before the first brace as preamble
      return cleaned.substring(0, firstBrace).trim();
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

  let treeContextBlock = "";
  try {
    const tree = await getRedis().get<string>(`tree:${sessionKey}`);
    if (tree) {
      treeContextBlock = `\n\n=== CURRENT ROBLOX PROJECT STRUCTURE ===\n${tree}\n=======================================\nUse this structure to understand where scripts and folders are located. You can refer to existing folders or scripts without asking the user to create them.`;
    }
  } catch (err) {
    // ignore redis error
  }

  const thinkingInstructions = mode === "thinking"
    ? `\nYou MUST include a "thinking" field (a string) in your JSON output that contains your HIGHLY ADVANCED, step-by-step reasoning about:
1. Deep conceptual and mechanical breakdown of the user's request.
2. Advanced Roblox architecture, including data flow, state management, and network optimization.
3. Specific Roblox services, APIs, and physics constraints, detailing *why* they are the best choice.
4. Edge cases, potential bugs, race conditions, memory leaks, and server/client boundary security.
5. How multiple scripts will interact (RemoteEvents, BindableEvents, shared state via ModuleScripts).
6. A comprehensive, scalable architectural plan.
IMPORTANT: Put ALL of your advanced reasoning INSIDE the "thinking" field of the JSON object. Do NOT write any text outside the JSON. Your ENTIRE response must be a single valid JSON object.`
    : "";

  const SYSTEM_PROMPT = `You are an expert Roblox Luau software architect and scripting assistant called Apple Juice.${thinkingInstructions}

CRITICAL: ALWAYS favor a Multi-Script Architecture for complex systems (like Round Systems, Combat, Tycoons, Shops, etc.). 
A professional system separates concerns:
1. Server logic in ServerScriptService (Script)
2. Shared/Reusable logic or state in ReplicatedStorage (ModuleScript)
3. Client-side UI/Input handling in StarterPlayerScripts or StarterGui (LocalScript)

When the user's request requires MULTIPLE scripts or a complex system, output a JSON object with:
- "scripts": an array of objects, each with: action, type (ANY ClassName, e.g. "Script", "ScreenGui", "Folder"), parent, name, code, assetId, "properties" (optional key-value object for GUI/part properties), and OPTIONALLY "requires" (an array of strings indicating the names of other scripts this one depends on).
- "message": a friendly explanation of everything you created
- "suggestions": 3 short follow-up ideas
${mode === "thinking" ? '- "thinking": your step-by-step reasoning (string)' : ""}

When ONLY ONE simple script or action is needed, output a JSON object with:
- "action": "create", "delete", "insert_asset", or "stop_playtest"
- "type": "Script", "LocalScript", "ModuleScript", or ANY valid Roblox ClassName (e.g. "ScreenGui", "Frame", "TextLabel", "Folder")
- "parent": dot path (e.g. "ServerScriptService", "StarterGui", "Workspace")
- "name": instance name
- "code": valid Luau source code (only if type is a Script)
- "properties": (Optional) key-value object of properties to apply. Supported string formats for complex types: "Color3.fromRGB(r,g,b)", "UDim2.new(sx,ox,sy,oy)", "Vector3.new(x,y,z)", "Enum.Type.Value", or Hex strings like "#FF0000". (e.g. {"Size": "UDim2.new(1,0,1,0)", "BackgroundColor3": "#FF0000", "Text": "Hello"})
- "assetId": numeric Roblox asset ID (ONLY if action is "insert_asset")
- "message": a short friendly explanation (2-4 sentences)
- "suggestions": array of 3 short strings
${mode === "thinking" ? '- "thinking": your step-by-step reasoning (string)' : ""}

CRITICAL: PREMIUM UI DESIGN & HIERARCHY:
1. MODERN AESTHETIC: Use dark mode (#0A0C10) with neon accents and glassmorphism (Transparency 0.2, BackgroundBlur).
2. CENTERING & POSITIONING: To prevent UI from being stuck in corners, ALWAYS set the AnchorPoint of main frames to Vector2.new(0.5, 0.5) and the Position to UDim2.fromScale(0.5, 0.5) to center them perfectly.
3. HIERARCHY & PARENTING: For multi-part UIs, ensure the dot-path in "parent" is absolute. (e.g., Parent a Frame to "StarterGui.MyUI", and parent a Button to "StarterGui.MyUI.Frame").
4. LAYOUT MANAGERS: When placing multiple parts together (buttons, items, etc.), ALWAYS use a UIListLayout or UIGridLayout inside the parent container. Set Padding and FillDirection appropriately.
5. PADDING: Never let content touch the edges. Always add a UIPadding child (e.g., 15px) to any container with child elements.
6. ROUNDING: Apply UICorner to ALL interactive elements.
7. RESPONSIVENESS: Use UDim2 SCALE ({0.8, 0}, {0.4, 0}). Only use Offset for tiny fixed elements like borders or icon margins.
8. COMPOSITION: Break complex UIs into logical sections (Header, Body, Footer) using separate Frames.

CRITICAL RULES FOR CODE QUALITY AND ARCHITECTURE:
1. ALWAYS use game:GetService(). Use task.wait() and task.spawn().
2. ERROR HANDLING: Wrap volatile logic in pcall().
3. NAMING: PascalCase for Instances, camelCase for variables.
4. CLEANUP: Handle event disconnections.
5. SECURITY: Validate RemoteEvent input on the server.
6. PERFORMANCE: Use event-driven logic instead of while true do loops.

${fileContextBlock}${treeContextBlock}
CRITICAL OUTPUT RULE: Your ENTIRE response must be ONLY a single valid JSON object. NO text before the opening {. NO text after the closing }. NO markdown. NO backticks. NO explanations outside the JSON. If you are in thinking mode, put ALL reasoning inside the "thinking" field.`;

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
        max_tokens: 8192,
      }),
    });

    const text = await res.text();
    let tokens = 0;
    try {
      const parsed = JSON.parse(text);
      tokens = parsed?.usage?.total_tokens || 0;
    } catch { /* ignore */ }
    return { ok: res.ok, text, tokens };
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

  function processResponse(content: string, rawText: string): { code: string; raw: string; preamble?: string } {
    const structured = tryParsePluginPayload(content) || tryParsePluginPayload(rawText);
    const preamble = getPreamble(content) || getPreamble(rawText) || undefined;
    if (structured) {
      if (structured.scripts && Array.isArray(structured.scripts)) {
        return { code: "", raw: JSON.stringify(structured), preamble };
      }
      if (structured.code) {
        return { code: structured.code, raw: JSON.stringify(structured), preamble };
      }
    }

    // If we have a markdown code block, extract it
    const codeBlockMatch = content.match(/```(?:luau|lua)\n([\s\S]*?)```/i) || content.match(/```\n([\s\S]*?)```/i);
    if (codeBlockMatch) {
      const cleanCode = codeBlockMatch[1].trim();
      return {
        code: cleanCode,
        raw: JSON.stringify({
          action: "create",
          type: "Script",
          parent: "ServerScriptService",
          name: "AIGeneratedFallback",
          code: cleanCode,
        }),
        preamble: content.substring(0, codeBlockMatch.index).trim()
      };
    }

    // Check if the content is clearly NOT Luau code
    const trimmed = content.trim();
    const isLikelyCode = trimmed.includes('local ') || trimmed.includes('function') || trimmed.includes('game:GetService');

    if (!isLikelyCode) {
      // This is thinking text or malformed output, not code.
      return { code: "", raw: "" };
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
  let tokensUsed = 0;
  let preambleReasoning: string | undefined = undefined;

  if (effectiveModel.toLowerCase().startsWith("gpt-") && finalOpenAIKey) {
    const { ok, text, tokens } = await callOpenAI(finalOpenAIKey, effectiveModel);
    raw = text;
    tokensUsed = tokens;
    if (!ok) return Response.json({ error: "LLM request failed", detail: raw, model: effectiveModel }, { status: 502 });
    const content = extractContent(raw);
    const result = processResponse(content, raw);
    code = result.code;
    raw = result.raw;
    preambleReasoning = result.preamble;
    modelUsed = effectiveModel;
  } else if (effectiveProvider === "google") {
    const requestedModel = (effectiveModel || "gemini-3-flash").trim();
    const GOOGLE_FALLBACK_MODELS = [
      "models/gemini-3.1-pro",
      "models/gemini-3-flash",
      "models/gemini-3.1-flash-lite",
      "models/gemini-2.5-pro",
      "models/gemini-2.5-flash"
    ];

    let availableModels: string[] = [];
    try {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta2/models?key=${encodeURIComponent(finalGoogleKey)}`;
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
      const url = `https://generativelanguage.googleapis.com/v1beta/${candidate}:generateContent?key=${encodeURIComponent(finalGoogleKey)}`;
      try {
        const llmRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }]
            },
            contents: (() => {
              if (body.messages && body.messages.length > 0) {
                return body.messages.map((m) => ({
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: m.content }]
                }));
              }
              return [{ role: "user", parts: [{ text: prompt }] }];
            })(),
            generationConfig: {
              temperature: mode === "thinking" ? 0.4 : 0.2,
              maxOutputTokens: mode === "thinking" ? 16384 : 8192,
              responseMimeType: "application/json"
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

          // If processResponse returned empty (thinking text detected), skip this result
          if (!result.code && !result.raw) {
            console.warn("Model returned thinking text instead of JSON, trying next model...");
            continue;
          }

          code = result.code;
          raw = result.raw;
          preambleReasoning = result.preamble;
          modelUsed = candidate;

          try {
            const parsed = JSON.parse(bodyText);
            tokensUsed = parsed?.usageMetadata?.totalTokenCount || 0;
          } catch { /* ignore */ }

          break;
        }
      } catch (err) {
        lastResponseBody = String(err);
        console.warn("Google request error", err instanceof Error ? err.message : String(err));
        continue;
      }
    }

    if (!code && !raw && finalOpenAIKey) {
      const { ok, text, tokens } = await callOpenAI(finalOpenAIKey, "gpt-4o-mini");
      raw = text;
      if (ok) {
        const content = extractContent(raw);
        const result = processResponse(content, raw);
        code = result.code;
        raw = result.raw;
        modelUsed = "gpt-4o-mini";
        tokensUsed = tokens;
      }
    }

    if (!code && !raw) {
      return Response.json({ error: "LLM request failed", detail: lastResponseBody, attemptedModels, provider: effectiveProvider, requestedModel }, { status: 502 });
    }
  } else {
    // Default: OpenAI using provided apiKey
    const { ok, text, tokens } = await callOpenAI(finalGoogleKey || finalOpenAIKey, effectiveModel);
    raw = text;
    tokensUsed = tokens;
    if (!ok) return Response.json({ error: "LLM request failed", detail: raw, model: effectiveModel }, { status: 502 });
    const content = extractContent(raw);
    const result = processResponse(content, raw);
    code = result.code;
    raw = result.raw;
    preambleReasoning = result.preamble;
    modelUsed = effectiveModel;
  }

  const structuredFinal = tryParsePluginPayload(raw) || null;
  const isMultiScript = structuredFinal?.scripts && Array.isArray(structuredFinal.scripts) && structuredFinal.scripts.length > 0;
  const isDelete = !isMultiScript && structuredFinal?.action === "delete";

  if (!code && !isDelete && !isMultiScript) return Response.json({ error: "Model returned empty output", detail: raw }, { status: 502 });

  const messageId = crypto.randomUUID();

  // Track usage only if NOT using a custom key
  if (!isUsingCustomKey) {
    if (tokensUsed > 0) {
      await trackUserUsage(ownerUserId, tokensUsed);
    } else {
      // Fallback estimation if tokens not returned (approx 1 token per 4 chars)
      const estimatedTokens = Math.ceil((raw.length + (prompt?.length || 0)) / 4);
      await trackUserUsage(ownerUserId, estimatedTokens);
    }
  }

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
    const pluginPayload = JSON.stringify({
      scripts: scriptResults.map(s => ({
        action: s.action,
        type: s.type,
        parent: s.parent,
        name: s.name,
        code: s.code,
        assetId: (s as any).assetId,
      }))
    });
    await upsertGeneratedCode(sessionKey, pluginPayload, messageId, autoSync);

    const finalMessage = structuredFinal?.message ??
      `I've created ${scripts.length} scripts for you: ${scriptResults.map(s => s.name).join(", ")}.`;
    const finalSuggestions = structuredFinal?.suggestions ?? [
      "Test all scripts together",
      "Add error handling",
      "Create a configuration module",
    ];
    const thinking = (structuredFinal as any)?.thinking || (typeof preambleReasoning === 'string' ? preambleReasoning : undefined);

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
  const thinking = (structuredFinal as any)?.thinking || (typeof preambleReasoning === 'string' ? preambleReasoning : undefined);

  const pluginPayload = JSON.stringify({
    action: isDelete ? "delete" : (structuredFinal?.action || "create"),
    type: finalType,
    parent: finalParent,
    name: finalName,
    code: finalCode,
    assetId: structuredFinal?.assetId
  });

  await upsertGeneratedCode(sessionKey, pluginPayload, messageId, autoSync);

  return Response.json({
    ok: true,
    code: finalCode,
    messageId,
    model: modelUsed,
    scriptName: finalName,
    scriptParent: finalParent,
    scriptType: finalType,
    action: isDelete ? "delete" : (structuredFinal?.action || "create"),
    lineCount,
    message: finalMessage,
    suggestions: finalSuggestions,
    thinking: thinking || undefined,
  });
}