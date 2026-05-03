import crypto from "crypto";
import { GoogleAuth } from "google-auth-library";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSession, upsertGeneratedCode, getUserUsage, trackMlUsage, calculateMlUsed, getRedis, getActiveGenerations, incrementActiveGenerations, decrementActiveGenerations } from "@/lib/store";
import {
  getAntigravityMapping,
  relayToAntigravity,
} from "@/lib/antigravity";

export const maxDuration = 60;

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

  // ── Antigravity provider auto-detection ──
  // If the user explicitly chose "antigravity", or if they have a linked
  // Antigravity account and aren't using a custom key, route through Antigravity.
  const userEmail = (session?.user as { email?: string } | undefined)?.email || "";
  const isAntigravityExplicit = provider === "apple_juice_ai";

  if (!isUsingCustomKey && !isAntigravityExplicit) {
    if (effectiveModel.toLowerCase().includes("deepseek")) {
      effectiveProvider = "apple_juice_ai";
    } else {
      effectiveProvider = "google";
      if (effectiveModel.toLowerCase().startsWith("gpt-")) {
        effectiveModel = "gemini-3-flash";
      }
    }
  }

  if (isAntigravityExplicit) {
    effectiveProvider = "apple_juice_ai";
  }

  const finalGoogleKey = (effectiveProvider === "google" && clientKey) ? clientKey : systemGoogleKey;
  const finalOpenAIKey = (effectiveProvider === "openai" && clientKey) ? clientKey : systemOpenAIKey;

  // Check mL of Juice balance only if NOT using a custom key
  let userUsage: Awaited<ReturnType<typeof getUserUsage>> | null = null;
  if (!isUsingCustomKey) {
    userUsage = await getUserUsage(ownerUserId);
    if (userUsage.remainingMl <= 0) {
      return Response.json({
        error: "Out of Juice",
        message: "You have reached your monthly limit! Your juice will refill next month, or you can buy an Instant Refill (Juice Box) to keep building right now.",
        usage: userUsage
      }, { status: 429 });
    }

    // ── Rank-Based Model Restrictions ──
    const plan = userUsage.plan || "free";
    const requested = effectiveModel;
    
    const freeModels = ["Gemini 2.5 Flash", "Gemini 3.1 Flash-Lite", "gemini-1.5-flash", "gpt-4o-mini"];
    const proModels = [...freeModels, "Gemini 3.1 Flash", "DeepSeek V3", "Gemini 3 Pro", "Gemini 3 Flash", "gemini-1.5-pro", "gpt-4o"];

    const isAvailable = (m: string, p: string) => {
      if (p === 'pure_ultra') return true;
      if (p === 'fresh_pro') return proModels.includes(m);
      return freeModels.includes(m);
    };

    if (!isAvailable(requested, plan)) {
      // Force fallback to the best available model for their tier
      if (plan === 'free') {
        effectiveModel = "Gemini 2.5 Flash";
      } else if (plan === 'fresh_pro') {
        effectiveModel = "DeepSeek V3";
      }
    }
  }

  // Dynamic max_output_tokens based on remaining mL balance
  const dynamicMaxOutputTokens = !isUsingCustomKey && userUsage
    ? Math.min(userUsage.maxOutputTokens, mode === "thinking" ? 65536 : 32768)
    : (mode === "thinking" ? 65536 : 32768);

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
    action?: "create" | "delete" | "insert_asset" | "stop_playtest" | "execute_luau";
    type?: string;
    parent?: string;
    name?: string;
    code?: string;
    assetId?: number | string;
    properties?: Record<string, any>;
    message?: string;
    suggestions?: string[];
    scripts?: PluginPayload[];
    thinking?: string;
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
IMPORTANT: Your ENTIRE response must be ONLY a single valid JSON object. NO markdown. NO backticks. NO explanations outside the JSON. Put ALL conversational text inside the "message" field of the JSON object. Put your reasoning inside the "thinking" field.`
    : "";

  const SYSTEM_PROMPT = `You are an expert Roblox Luau software architect and scripting assistant called Apple Juice AI.${thinkingInstructions}

## OUTPUT FORMAT
Your output MUST be a single, valid JSON object. Do not include any text, preamble, or postscript outside of this JSON.

## WORKFLOW GUIDELINES
1. **Explore & Analyze**: Use the provided PROJECT STRUCTURE to identify existing frameworks (Knit, Fusion, Roact, Rojo, etc.) and match their coding style.
2. **Plan & Design**: Architect systems that separate concerns (Server, Client, Shared).
3. **Implement**: Output precise JSON payloads. Use "execute_luau" for complex setup tasks and "create" for persistent scripts.
4. **Verify & Debug**: Use the Auto-Test system to validate your work. If errors occur, analyze the logs and apply minimal, targeted fixes.

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

When ONLY ONE action is needed, output a JSON object with:
- "action": "create", "delete", "insert_asset", "stop_playtest", or "execute_luau"
- "type": "Script", "LocalScript", "ModuleScript", or ANY valid Roblox ClassName (e.g. "ScreenGui", "Frame", "TextLabel", "Folder")
- "parent": dot path (e.g. "ServerScriptService", "StarterGui", "Workspace")
- "name": instance name
- "code": valid Luau source code (required for "create" with scripts or "execute_luau")
- "properties": (Optional) key-value object of properties to apply. Supported string formats for complex types: "Color3.fromRGB(r,g,b)", "UDim2.new(sx,ox,sy,oy)", "Vector3.new(x,y,z)", "Enum.Type.Value", or Hex strings like "#FF0000".
- "assetId": numeric Roblox asset ID (ONLY if action is "insert_asset")
- "message": a short friendly explanation (2-4 sentences)
- "suggestions": array of 3 short strings
${mode === "thinking" ? '- "thinking": your step-by-step reasoning (string)' : ""}

CRITICAL: "execute_luau" ACTION: Use this action to execute a temporary Luau script in Studio. This is ideal for one-time structural changes, building complex hierarchies, setting up physics constraints, or batch property updates that don't need a persistent script.

CRITICAL: PREMIUM UI DESIGN & HIERARCHY:
1. MODERN AESTHETIC: Use dark mode backgrounds (BackgroundColor3 = Color3.fromRGB(10,12,16)) with neon accent colors (e.g., Color3.fromRGB(204,255,0) for highlights). Apply glassmorphism with BackgroundTransparency = 0.15 and add UIStroke with Transparency 0.7 for glass borders.
2. CENTERING & POSITIONING: ALWAYS set AnchorPoint = Vector2.new(0.5, 0.5) and Position = UDim2.fromScale(0.5, 0.5) on root frames to center them. For non-centered elements, use UDim2.fromScale() with appropriate values.
3. DEFAULT SIZING — MANDATORY SIZE TABLE:
   - ScreenGui: ResetOnSpawn = false, IgnoreGuiInset = true, ZIndexBehavior = Enum.ZIndexBehavior.Sibling.
   - Root/Main Frame: UDim2.fromScale(0.4, 0.55).
   - Header Frame: UDim2.new(1, 0, 0, 50).
   - Section/Body Frame: UDim2.new(1, 0, 1, -50).
   - TextLabel: UDim2.new(1, 0, 0, 36) or AutomaticSize = Enum.AutomaticSize.Y.
   - TextButton: UDim2.new(0.4, 0, 0, 44).
   - ScrollingFrame: UDim2.new(1, 0, 1, -60). Set ScrollBarThickness = 4, AutomaticCanvasSize = Enum.AutomaticSize.Y.
4. HIERARCHY & PARENTING: For multi-part UIs, use absolute dot-paths for "parent".
5. LAYOUT MANAGERS: ALWAYS use UIListLayout or UIGridLayout for containers with multiple children.
6. PADDING & ROUNDING: Add UIPadding (12px) and UICorner (12px) to ALL Frames and Buttons.
7. TEXT STYLING: Use GothamBold for titles and Gotham for body. Set RichText = true.

CRITICAL: ADVANCED UI ANIMATION (USE IN EVERY UI):
8. TWEENSERVICE: Use for ALL transitions. Tween frames with EasingStyle.Quint or Back on open/close.
9. HOVER & CLICK: Every button MUST have hover tweens (scale up 1.03x, lighten color) and click feedback (bounce).
10. NOTIFICATIONS: Include a notification/toast system for feedback.

CRITICAL RULES FOR CODE QUALITY:
11. ALWAYS use game:GetService(). Use task.wait() and task.spawn().
12. ERROR HANDLING: Wrap volatile logic in pcall().
13. SECURITY: Validate RemoteEvent input on the server. Never trust the client.

${fileContextBlock}${treeContextBlock}
CRITICAL OUTPUT RULE: Your ENTIRE response must be ONLY a single valid JSON object. NO markdown. NO backticks. NO explanations outside the JSON. If in thinking mode, put ALL reasoning inside the "thinking" field.`;

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
        max_tokens: dynamicMaxOutputTokens,
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

  // ── REAL Priority Queue (Load-Based Concurrency) ──────────────────────────
  if (!isUsingCustomKey && userUsage) {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const activeLoad = await getActiveGenerations();
    
    // Check load dynamically
    if (userUsage.plan === 'pure_ultra') {
      // Priority Queue: Zero wait, bypasses limits
    } else if (userUsage.plan === 'fresh_pro') {
      // Standard Queue: Wait up to 3 seconds if system is heavily loaded
      if (activeLoad > 8) await delay(3000);
      else if (activeLoad > 4) await delay(1000);
    } else {
      // Free Queue: Wait up to 8 seconds if loaded. If heavily loaded, return rate limit.
      if (activeLoad > 15) {
        return Response.json({ 
          error: "Queue Full", 
          message: "The free tier queue is currently at maximum capacity due to high traffic. Please try again shortly or upgrade your plan." 
        }, { status: 429 });
      } else if (activeLoad > 8) {
        await delay(8000);
      } else if (activeLoad > 4) {
        await delay(4000);
      } else {
        await delay(1500); // Always some small wait for free tier
      }
    }
  }

  // Add ourselves to the active queue load
  if (!isUsingCustomKey) {
    await incrementActiveGenerations();
  }

  try {

  // ── Apple Juice AI Provider Path ──────────────────────────────────────────
  if (effectiveProvider === "apple_juice_ai") {
    // 1. Look up identity mapping
    const agMapping = userEmail ? await getAntigravityMapping(userEmail) : null;
    if (!agMapping && !effectiveModel.toLowerCase().includes("deepseek")) {
      return Response.json({
        error: "account_not_linked",
        message: "Your account is not linked to Antigravity. Go to Settings → Antigravity to connect your account.",
      }, { status: 403 });
    }

    // If the user wants real Antigravity proxy credits, that logic can be restored later.

    // 3. Build messages array for the relay
    const agMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];
    if (body.messages && body.messages.length > 0) {
      agMessages.push(...(body.messages as { role: "user" | "assistant"; content: string }[]));
    } else {
      agMessages.push({ role: "user", content: prompt });
    }

    // 4. Relay through Google Gemini API using user's OAuth token
    const accessToken = (session as { accessToken?: string })?.accessToken;
    const isDeepSeek = effectiveModel.toLowerCase().includes("deepseek");

    const agResult = await relayToAntigravity(agMapping, {
      model: effectiveModel,
      messages: agMessages,
      temperature: mode === "thinking" ? 0.4 : 0.2,
      max_tokens: dynamicMaxOutputTokens,
      stream: isDeepSeek,
    }, accessToken, userEmail);

    if (isDeepSeek && agResult.ok && agResult.stream) {
      // Use a TransformStream to track when the stream ends and decrement the counter
      const originalStream = agResult.stream.body!;
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
        flush() {
          void decrementActiveGenerations();
        }
      });

      // Stream the response back to the client
      return new Response(originalStream.pipeThrough(transformStream), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    if (!agResult.ok) {
      return Response.json({
        error: agResult.error || "Antigravity request failed",
        provider: "antigravity",
        model: effectiveModel,
      }, { status: agResult.status });
    }

    // 5. Extract content and process through existing pipeline
    const agContent = agResult.data?.choices?.[0]?.message?.content?.trim() || "";
    tokensUsed = agResult.tokensUsed;
    modelUsed = agResult.data?.model || effectiveModel;

    if (agContent) {
      const result = processResponse(agContent, agContent);
      code = result.code;
      raw = result.raw;
      preambleReasoning = result.preamble;
    }

    if (!code && !raw) {
      return Response.json({
        error: "Antigravity returned empty output",
        detail: agContent,
        provider: "antigravity",
      }, { status: 502 });
    }

  // ── OpenAI Provider Path ───────────────────────────────────────────────────
  } else if (effectiveModel.toLowerCase().startsWith("gpt-") && finalOpenAIKey) {
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

  // ── Google Provider Path ───────────────────────────────────────────────────
  } else if (effectiveProvider === "google") {
    const requestedModel = (effectiveModel || "gemini-1.5-flash").trim();
    let url = "";
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    let isClaude = false;

    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        // Use Google Cloud Service Account with Gemini API endpoint
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const auth = new GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/generative-language']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        
        isClaude = requestedModel.includes("claude");
        
        if (isClaude) {
          // Claude models still go through Vertex AI
          const projectId = credentials.project_id;
          const region = "us-central1";
          const publisher = "anthropic";
          const rawModelName = requestedModel.replace("models/", "");
          url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/${publisher}/models/${rawModelName}:generateContent`;
        } else {
          // Google models go through the Gemini API (generativelanguage.googleapis.com)
          const MODEL_MAPPING: Record<string, string> = {
            "Gemini 3.1 Pro": "gemini-3.1-pro-preview",
            "Gemini 3.1 Flash": "gemini-3.1-flash-preview",
            "Gemini 3.1 Flash-Lite": "gemini-3.1-flash-lite-preview",
            "Gemini 3 Pro": "gemini-3-pro-preview",
            "Gemini 3 Flash": "gemini-3-flash-preview",
            "Gemini 2.5 Pro": "gemini-2.5-pro",
            "Gemini 2.5 Flash": "gemini-2.5-flash",
            "Gemini 2.0 Flash": "gemini-2.0-flash",
            "Gemini 1.5 Pro": "gemini-1.5-pro",
            "Gemini 1.5 Flash": "gemini-1.5-flash"
          };
          const rawModelName = requestedModel.replace("models/", "");
          const finalModelName = MODEL_MAPPING[rawModelName] || MODEL_MAPPING[requestedModel] || rawModelName;
          url = `https://generativelanguage.googleapis.com/v1beta/models/${finalModelName}:generateContent`;
        }

        if (token.token) {
          headers["Authorization"] = `Bearer ${token.token}`;
        }
      } else {
        // Fallback to simple Google AI Studio API Key
        const candidate = requestedModel.startsWith("models/") ? requestedModel : `models/${requestedModel}`;
        url = `https://generativelanguage.googleapis.com/v1beta/${candidate}:generateContent?key=${encodeURIComponent(finalGoogleKey)}`;
      }
      
      let payload: any = {};
      if (isClaude) {
         // Anthropic Vertex AI Payload Format
         payload = {
            anthropic_version: "vertex-2023-10-16",
            messages: (() => {
              if (body.messages && body.messages.length > 0) {
                 return body.messages.map(m => ({ role: m.role, content: m.content }));
              }
              return [{ role: "user", content: prompt }];
            })(),
            system: SYSTEM_PROMPT,
            max_tokens: dynamicMaxOutputTokens,
            temperature: mode === "thinking" ? 0.4 : 0.2
         };
      } else {
         // Gemini Payload Format
         payload = {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
            maxOutputTokens: dynamicMaxOutputTokens,
            responseMimeType: "application/json"
          }
         };
      }

      const llmRes = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const bodyText = await llmRes.text();
      if (!llmRes.ok) {
        console.warn("Google/Vertex API failed", { model: requestedModel, status: llmRes.status, body: bodyText });
        return Response.json({ error: "LLM request failed", detail: bodyText, provider: effectiveProvider, requestedModel }, { status: 502 });
      }

      let rawResponseText = "";
      if (isClaude) {
         const parsed = JSON.parse(bodyText);
         rawResponseText = parsed?.content?.[0]?.text || "";
         tokensUsed = parsed?.usage?.output_tokens || 0;
      } else {
         try {
            const parsed = JSON.parse(bodyText);
            rawResponseText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            tokensUsed = parsed?.usageMetadata?.totalTokenCount || 0;
         } catch {}
      }

      const content = rawResponseText;
      if (content) {
        const result = processResponse(content, rawResponseText);
        code = result.code;
        raw = result.raw;
        preambleReasoning = result.preamble;
        modelUsed = requestedModel;
      }

      if (!code && !raw && finalOpenAIKey) {
        const { ok, text, tokens } = await callOpenAI(finalOpenAIKey, "gpt-4o-mini");
        raw = text;
        if (ok) {
          const fallbackContent = extractContent(raw);
          const fallbackResult = processResponse(fallbackContent, raw);
          code = fallbackResult.code;
          raw = fallbackResult.raw;
          modelUsed = "gpt-4o-mini";
          tokensUsed = tokens;
        }
      }

      if (!code && !raw) {
        return Response.json({ error: "LLM request failed", detail: bodyText, provider: effectiveProvider, requestedModel }, { status: 502 });
      }
    } catch (err) {
      console.error("Google/Vertex Error", err);
      return Response.json({ error: "LLM request failed", detail: String(err), provider: effectiveProvider, requestedModel }, { status: 502 });
    }

  // ── Default Fallback Path ──────────────────────────────────────────────────
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

  // Track mL usage only if NOT using a custom key
  if (!isUsingCustomKey) {
    let mlUsed = 0;
    if (tokensUsed > 0) {
      // Try to get separate input/output token counts for precise mL calculation
      try {
        const parsed = JSON.parse(raw);
        const inputTk = parsed?.usage?.prompt_tokens || parsed?.usageMetadata?.promptTokenCount || 0;
        const outputTk = parsed?.usage?.completion_tokens || parsed?.usageMetadata?.candidatesTokenCount || 0;
        if (inputTk > 0 || outputTk > 0) {
          mlUsed = calculateMlUsed(inputTk, outputTk, effectiveModel);
        } else {
          // Fallback: assume 20% input, 80% output split
          mlUsed = calculateMlUsed(Math.floor(tokensUsed * 0.2), Math.floor(tokensUsed * 0.8), effectiveModel);
        }
      } catch {
        mlUsed = calculateMlUsed(Math.floor(tokensUsed * 0.2), Math.floor(tokensUsed * 0.8), effectiveModel);
      }
    } else {
      // Fallback estimation if tokens not returned (approx 1 token per 4 chars)
      const estimatedInput = Math.ceil((prompt?.length || 0) / 4);
      const estimatedOutput = Math.ceil(raw.length / 4);
      mlUsed = calculateMlUsed(estimatedInput, estimatedOutput, effectiveModel);
    }
    await trackMlUsage(ownerUserId, mlUsed);
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
      tokensUsed,
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
    tokensUsed,
  });
  } finally {
    if (!isUsingCustomKey) {
      await decrementActiveGenerations();
    }
  }
}


