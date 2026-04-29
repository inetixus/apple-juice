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
        message: "You have used all 50 credits for this week. Credits reset every Monday. To continue without limits, use your own API key in Settings.",
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
1. MODERN AESTHETIC: Use dark mode backgrounds (BackgroundColor3 = Color3.fromRGB(10,12,16)) with neon accent colors (e.g., Color3.fromRGB(204,255,0) for highlights). Apply glassmorphism with BackgroundTransparency = 0.15 and add UIStroke with Transparency 0.7 for glass borders.
2. CENTERING & POSITIONING: ALWAYS set AnchorPoint = Vector2.new(0.5, 0.5) and Position = UDim2.fromScale(0.5, 0.5) on root frames to center them. For non-centered elements, use UDim2.fromScale() with appropriate values.
3. DEFAULT SIZING — MANDATORY SIZE TABLE (never use {0,0,0,0}):
   - ScreenGui: No size needed, it covers the screen automatically. Set ResetOnSpawn = false, IgnoreGuiInset = true, ZIndexBehavior = Enum.ZIndexBehavior.Sibling.
   - Root/Main Frame: UDim2.fromScale(0.4, 0.55) (roughly 40% width, 55% height — adjust per context).
   - Header Frame: UDim2.new(1, 0, 0, 50) (full width, 50px tall).
   - Section/Body Frame: UDim2.new(1, 0, 1, -50) (full width, fill remaining height).
   - TextLabel: UDim2.new(1, 0, 0, 36) (full width, 36px tall) or use AutomaticSize = Enum.AutomaticSize.Y.
   - TextButton: UDim2.new(0.4, 0, 0, 44) (40% width, 44px tall).
   - ImageLabel: UDim2.fromOffset(64, 64) minimum, or fromScale for responsive.
   - ScrollingFrame: UDim2.new(1, 0, 1, -60) (fill remaining, leave room for header). Set ScrollBarThickness = 4, ScrollBarImageColor3 = Color3.fromRGB(60,60,60), AutomaticCanvasSize = Enum.AutomaticSize.Y, CanvasSize = UDim2.new(0,0,0,0).
   - Frame (card/item): UDim2.new(1, 0, 0, 80) (full width, 80px tall for list items).
4. HIERARCHY & PARENTING: For multi-part UIs, the dot-path in "parent" MUST be absolute. Example hierarchy:
   - ScreenGui → parent: "StarterGui", name: "ShopUI"
   - Main Frame → parent: "StarterGui.ShopUI", name: "MainFrame"
   - Header → parent: "StarterGui.ShopUI.MainFrame", name: "Header"
   - UICorner → parent: "StarterGui.ShopUI.MainFrame", name: "Corner"
   - Body → parent: "StarterGui.ShopUI.MainFrame", name: "Body"
   - Item → parent: "StarterGui.ShopUI.MainFrame.Body", name: "Item1"
5. LAYOUT MANAGERS: ALWAYS use a UIListLayout or UIGridLayout when a container has multiple children:
   - UIListLayout: Set Padding (UDim.new(0, 8)), FillDirection, HorizontalAlignment, VerticalAlignment, SortOrder = Enum.SortOrder.LayoutOrder.
   - UIGridLayout: Set CellSize (UDim2.fromOffset(100, 100)), CellPadding (UDim2.fromOffset(8, 8)).
6. PADDING: Add UIPadding to EVERY container. Minimum 10px on all sides: PaddingLeft=UDim.new(0,12), PaddingRight=UDim.new(0,12), PaddingTop=UDim.new(0,12), PaddingBottom=UDim.new(0,12).
7. ROUNDING: Add UICorner with CornerRadius = UDim.new(0, 12) to ALL Frames and Buttons. Use 8px for small elements, 16px for large cards.
8. RESPONSIVENESS: Prefer UDim2 Scale values (UDim2.fromScale(0.8, 0.5)) for sizing. Only use Offset for small fixed elements (icons, padding, borders).
9. COMPOSITION: Break UIs into Header, Body, Footer frames. Each gets its own UICorner, UIPadding, and appropriate sizing.
10. TEXT STYLING: Always set TextSize (18-24 for titles, 14-16 for body), Font = Enum.Font.GothamBold (titles) or Enum.Font.Gotham (body), TextColor3 = Color3.fromRGB(255,255,255). Use RichText = true for inline formatting like <b>, <i>, <font color>, <stroke>.

CRITICAL: ADVANCED UI ANIMATION & INTERACTION (USE THESE IN EVERY UI):
11. TWEENSERVICE ANIMATIONS — Use TweenService for ALL UI transitions. NEVER just set properties directly for visual changes:
   - OPEN/CLOSE: Tween the main frame from Size=UDim2.fromScale(0,0) to its target size with EasingStyle.Back, EasingDirection.Out, 0.4s. On close, reverse it.
   - FADE IN: Tween BackgroundTransparency from 1→target and TextTransparency from 1→0 on open.
   - SLIDE IN: Tween Position from off-screen (e.g., UDim2.fromScale(0.5, 1.5)) to center (UDim2.fromScale(0.5, 0.5)).
   - Example pattern in LocalScript code:
     local TweenService = game:GetService("TweenService")
     local tweenInfo = TweenInfo.new(0.35, Enum.EasingStyle.Quint, Enum.EasingDirection.Out)
     TweenService:Create(frame, tweenInfo, {Size = targetSize, BackgroundTransparency = 0.05}):Play()
12. HOVER EFFECTS — Every TextButton and clickable element MUST have hover animations:
   - On MouseEnter: Tween BackgroundColor3 to a lighter shade (+15 per channel), tween Size to 1.03x scale, add UIStroke glow.
   - On MouseLeave: Tween back to original values.
   - On MouseButton1Down: Tween Size to 0.97x (press effect), then on MouseButton1Up tween back.
   - Example: button.MouseEnter:Connect(function() TweenService:Create(button, TweenInfo.new(0.15), {BackgroundColor3 = hoverColor}):Play() end)
13. CLICK FEEDBACK — On button click, play a brief scale-bounce: shrink to 0.95 over 0.05s, then expand to 1.0 over 0.15s with EasingStyle.Back.
14. SCROLL ANIMATIONS — When items are added to a ScrollingFrame, tween each new item's Transparency from 1→0 and Position from offset to final, staggered by 0.05s per item index.
15. NOTIFICATION/TOAST SYSTEM — For feedback (purchase success, errors), create a small Frame at top-center that slides down from off-screen, displays for 2.5s, then slides back up and destroys itself.
16. TAB SYSTEMS — For multi-tab UIs, tween an "indicator bar" Frame under the active tab. On tab switch, tween indicator Position to new tab and crossfade the content frames (old fades out 0.2s, new fades in 0.2s).
17. LOADING STATES — Show a spinning indicator or pulsing dot animation while data loads. Use a repeating tween: Rotation 0→360 with RepeatCount = -1.
18. GRADIENT OVERLAYS — Add UIGradient to headers and accent elements. Use Color = ColorSequence.new({ColorSequenceKeypoint.new(0, accentColor), ColorSequenceKeypoint.new(1, darkerColor)}). Animate the Offset for a shimmer effect.
19. SHADOW/DEPTH — Create shadow layers: duplicate the main frame behind it, offset by (0,4,0,4), set BackgroundColor3 to black, BackgroundTransparency = 0.7, and add a large UICorner. This creates depth.
20. CLOSE BUTTON — Every UI MUST have a close button ("X" or similar) in the top-right of the header. It should tween-close the UI, not just set Visible=false. Apply rotation tween on hover (0→90°).

CRITICAL: COMPLETE UI ARCHITECTURE PATTERNS:
21. SHOP UI PATTERN: ScreenGui → MainFrame (centered, glassmorphic) → Header (title + close btn + coin display) → TabBar (category buttons with sliding indicator) → Body (ScrollingFrame with UIGridLayout) → ItemCards (image, name, price, buy button with hover effects) → Footer (selected item details). Include a LocalScript that handles: opening/closing tweens, tab switching with crossfade, buy button confirmation dialog, purchase RemoteEvent, coin counter animation (tween NumberValue display), error toast notifications.
22. INVENTORY UI PATTERN: Similar to shop but with: equipped indicator glow (UIStroke with animated color), drag-to-equip, item rarity color borders (Common=gray, Rare=blue, Epic=purple, Legendary=gold with gradient shimmer), item count badges, search/filter bar at top.
23. MAIN MENU PATTERN: Full-screen overlay → Logo with scale-bounce entrance → Title with typewriter effect → Buttons stack (Play, Shop, Settings, Credits) each sliding in from left with stagger delay → Background blur (set parent frame BackgroundTransparency = 0.3, add large blur via full-screen semi-transparent frame).
24. HUD PATTERN: Non-intrusive corners — health bar (top-left, gradient fill tween), currency display (top-right, coin icon + animated count), minimap frame (bottom-right), hotbar (bottom-center, slot highlight on selection).
25. DIALOG/MODAL PATTERN: Overlay (full-screen, BackgroundColor3=black, BackgroundTransparency=0.5) → Dialog box (centered, slides in from bottom) → Title + message + action buttons. Clicking overlay closes dialog.

PROPERTIES REFERENCE for the "properties" JSON field:
   - Size: "UDim2.new(sx,ox,sy,oy)" or "UDim2.fromScale(sx,sy)" or "UDim2.fromOffset(ox,oy)"
   - Position: "UDim2.new(sx,ox,sy,oy)" or "UDim2.fromScale(sx,sy)"
   - AnchorPoint: "Vector2.new(0.5, 0.5)"
   - BackgroundColor3: "Color3.fromRGB(r,g,b)" or "#hexcode"
   - BackgroundTransparency: 0.0 to 1.0 (number)
   - TextColor3: "Color3.fromRGB(255,255,255)"
   - Text: "string value"
   - TextSize: number (e.g., 18)
   - Font: "Enum.Font.GothamBold"
   - CornerRadius: "UDim.new(0, 12)" (for UICorner)
   - Padding / PaddingLeft / PaddingTop etc.: "UDim.new(0, 12)" (for UIPadding)
   - ScrollBarThickness: number (for ScrollingFrame)
   - AutomaticCanvasSize: "Enum.AutomaticSize.Y"
   - CanvasSize: "UDim2.new(0,0,0,0)" (with AutomaticCanvasSize)
   - ClipsDescendants: true
   - Visible: true
   - LayoutOrder: number
   - ZIndex: number (higher = on top)
   - ImageTransparency: 0.0 to 1.0
   - ScaleType: "Enum.ScaleType.Fit" or "Enum.ScaleType.Crop" or "Enum.ScaleType.Stretch"
   - TextWrapped: true
   - TextXAlignment: "Enum.TextXAlignment.Left"
   - TextYAlignment: "Enum.TextYAlignment.Center"
   - AutoButtonColor: false (disable default hover, use custom tweens instead)
   - Active: true
   - Selectable: false
   - BorderSizePixel: 0
   - RichText: true

ANTI-PATTERNS — NEVER DO THESE:
   - NEVER omit Size from a Frame, TextLabel, TextButton, ImageLabel, or ScrollingFrame.
   - NEVER set Size to UDim2.new(0,0,0,0) or UDim2.fromOffset(0,0).
   - NEVER forget AnchorPoint when centering with Position = UDim2.fromScale(0.5, 0.5).
   - NEVER place children inside a container without a UIListLayout or explicit Position for each child.
   - NEVER leave Text empty on TextLabels/TextButtons — always provide meaningful text.
   - NEVER use BackgroundTransparency = 1 on the main frame (it makes it invisible).
   - NEVER create a ScreenGui without at least one visible Frame child with a proper Size.
   - NEVER set Visible=false to close a UI. ALWAYS tween it closed, THEN set Visible=false after the tween completes.
   - NEVER skip hover effects on buttons. Plain buttons look amateur.
   - NEVER use default Roblox button colors (AutoButtonColor = true). Set AutoButtonColor = false and handle hover/press with TweenService.
   - NEVER hardcode pixel positions. Use Scale (UDim2.fromScale) for responsive design.

CRITICAL: WHEN THE USER ASKS FOR A UI, GENERATE A COMPLETE, PRODUCTION-READY SYSTEM. This means:
- The ScreenGui with ALL visual instances (Frames, Labels, Buttons, Corners, Padding, Gradients, Strokes, Layouts)
- A LocalScript with ALL interaction logic: open/close tweens, hover effects on every button, click handlers, tab switching, scroll item population, notification toasts, and close button behavior.
- If the UI involves data (shop items, inventory, etc.), include a ModuleScript with sample data and a ServerScript for data validation.
- The code should be 200-1000+ lines for the LocalScript alone. Do NOT produce minimal stubs. Produce COMPLETE, SHIPPABLE code.
- Include TweenService animations for EVERY state change.
- Include sound effects: create Sound instances in the LocalScript with SoundIds (use generic click: "rbxassetid://6895079853", hover: "rbxassetid://6895079853", success: "rbxassetid://6895079853", error: "rbxassetid://6895079853") and play them on interactions.

CRITICAL RULES FOR CODE QUALITY AND ARCHITECTURE:
1. ALWAYS use game:GetService(). Use task.wait() and task.spawn().
2. ERROR HANDLING: Wrap volatile logic in pcall().
3. NAMING: PascalCase for Instances, camelCase for variables.
4. CLEANUP: Handle event disconnections with :Destroy() and connection:Disconnect().
5. SECURITY: Validate RemoteEvent input on the server. Never trust the client.
6. PERFORMANCE: Use event-driven logic instead of while true do loops. Cache references. Avoid creating instances in loops when possible — reuse/pool them.
7. MODULARITY: For complex systems, break into ModuleScripts for data, utility functions, and configuration.
8. TYPING: Use Luau strict typing where possible: local x: number = 5.

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
        max_tokens: 32768,
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
              maxOutputTokens: mode === "thinking" ? 65536 : 32768,
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