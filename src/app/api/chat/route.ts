import crypto from "crypto";
import { GoogleAuth } from "google-auth-library";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getSession,
  upsertGeneratedCode,
  getUserUsage,
  trackMlUsage,
  calculateMlUsed,
  getRedis,
  getActiveGenerations,
  incrementActiveGenerations,
  decrementActiveGenerations,
} from "@/lib/store";
import { getAntigravityMapping, relayToAntigravity } from "@/lib/antigravity";
import { buildUIExamplesBlock } from "@/lib/ui-examples";
import { getAppleJuiceUISource, isUIRelatedPrompt } from "@/lib/apple-juice-ui-library";
import { buildLibraryDeploymentPrompt, getUILibraryDeploymentScripts } from "@/lib/ui-library-deployer";
import { buildSystemsContextBlock } from "@/lib/systems";

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
  tree?: string;
  uiStyle?: "none" | "lemonade" | "dracula" | "zap" | "claude";
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  let ownerUserId = (session?.user as { id?: string } | undefined)?.id;

  const body = (await req.json()) as ChatBody;
  const sessionKey = body.sessionKey?.trim() ?? "";

  // Retrieve the paired session once at the top to enable synced settings fallbacks and authorization
  const pair = sessionKey ? await getSession(sessionKey) : null;

  // If no NextAuth session but a sessionKey is supplied, authenticate via sessionKey lookup
  if (!ownerUserId && pair) {
    ownerUserId = pair.ownerUserId;
  }

  if (!ownerUserId)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const prompt = body.prompt?.trim() ?? "";
  const fileContents = body.fileContents ?? [];
  const autoSync = body.autoSync ?? true;

  // Synced settings fallback chain: Body -> Session Pair (synced from dashboard) -> Standard Defaults
  const provider = (body.provider?.trim() || pair?.provider || "openai").toString();
  const model = body.model?.trim() || pair?.model || "gpt-4o-mini";
  const mode = body.mode || pair?.mode || "fast";

  const openaiKey = body.openaiKey?.trim() || pair?.openaiKey || "";
  const googleKey = pair?.googleKey || "";

  // Resolve apiKey
  let apiKey = body.apiKey?.trim();
  if (!apiKey) {
    if (provider === "google") {
      apiKey = googleKey;
    } else {
      apiKey = openaiKey;
    }
  }


  const systemOpenAIKey = process.env.OPENAI_API_KEY || "";
  const systemGoogleKey = process.env.GOOGLE_API_KEY || "";

  const clientKey = provider === "google" ? apiKey : openaiKey || apiKey;
  const isUsingCustomKey =
    !!clientKey &&
    clientKey !== systemOpenAIKey &&
    clientKey !== systemGoogleKey;

  let effectiveProvider = provider;
  let effectiveModel = model;

  if (effectiveModel.toLowerCase().startsWith('openrouter/')) {
    effectiveModel = effectiveModel.substring(11);
    effectiveProvider = 'openrouter';
  }

  // ── Antigravity provider auto-detection ──
  // If the user explicitly chose "antigravity", or if they have a linked
  // Antigravity account and aren't using a custom key, route through Antigravity.
  const userEmail =
    (session?.user as { email?: string } | undefined)?.email || "";
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

  const finalGoogleKey =
    effectiveProvider === "google" && clientKey ? clientKey : systemGoogleKey;
  const finalOpenAIKey =
    effectiveProvider === "openai" && clientKey ? clientKey : systemOpenAIKey;

  // Check mL of Juice balance only if NOT using a custom key
  let userUsage: Awaited<ReturnType<typeof getUserUsage>> | null = null;
  if (!isUsingCustomKey) {
    userUsage = await getUserUsage(ownerUserId);
    if (userUsage.remainingMl <= 0) {
      return Response.json(
        {
          error: "Out of Juice",
          message:
            "You have reached your daily limit! Your juice will refill tomorrow, or you can buy an Instant Refill (Juice Box) to keep building right now.",
          usage: userUsage,
        },
        { status: 429 },
      );
    }

    // ── Rank-Based Model Restrictions ──
    const plan = userUsage.plan || "free";
    const requested = effectiveModel;

    const freeModels = [
      "Gemini 2.5 Flash",
      "Gemini 3.1 Flash-Lite",
      "gemini-1.5-flash",
      "gpt-4o-mini",
      "GPT oss 120b",
    ];
    const proModels = [
      ...freeModels,
      "Gemini 3.1 Flash",
      "DeepSeek V3",
      "Gemini 3 Pro",
      "Gemini 3 Flash",
      "gemini-1.5-pro",
      "gpt-4o",
    ];

    const isAvailable = (m: string, p: string) => {
      if (p === "pure_ultra") return true;
      if (p === "fresh_pro") return proModels.includes(m);
      return freeModels.includes(m);
    };

    if (!isAvailable(requested, plan)) {
      // Force fallback to the best available model for their tier
      if (plan === "free") {
        effectiveModel = "Gemini 2.5 Flash";
      } else if (plan === "fresh_pro") {
        effectiveModel = "DeepSeek V3";
      }
    }
  }

  // Dynamic max_output_tokens based on remaining mL balance
  const dynamicMaxOutputTokens =
    !isUsingCustomKey && userUsage
      ? Math.min(userUsage.maxOutputTokens, mode === "thinking" ? 65536 : 32768)
      : mode === "thinking"
        ? 65536
        : 32768;

  if (!prompt || !sessionKey) {
    return Response.json(
      { error: "prompt and sessionKey are required" },
      { status: 400 },
    );
  }

  // pair is already loaded at the top
  if (!pair)
    return Response.json({ error: "Invalid session key" }, { status: 404 });
  if (pair.ownerUserId !== ownerUserId)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (Date.now() > pair.expiresAt)
    return Response.json({ error: "Session expired" }, { status: 410 });

  let raw = "";
  let modelUsed = model;

  type PluginPayload = {
    action?:
      | "create"
      | "delete"
      | "create_instance"
      | "rename_instance"
      | "move_instance"
      | "run_playtest"
      | "stop_playtest"
      | "execute_luau"
      | "insert_asset"
      | "read_script"
      | "edit_script";
    type?: string;
    parent?: string;
    name?: string;
    code?: string;
    assetId?: number | string;
    className?: string;
    instanceName?: string;
    oldPath?: string;
    newName?: string;
    newParentPath?: string;
    properties?: Record<string, any>;
    message?: string;
    suggestions?: string[];
    scripts?: PluginPayload[];
    edits?: { search: string; replace: string }[];
    thinking?: string;
  };

  function tryParsePluginPayload(text?: string): PluginPayload | null {
    if (!text) return null;

    // Step 1: Strip markdown fences if present
    let cleaned = text.trim();
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    // Step 2: Try direct parse
    try {
      const obj = JSON.parse(cleaned);
      if (obj && typeof obj === "object") {
        if ("code" in obj || "action" in obj || "scripts" in obj) {
          return obj as PluginPayload;
        }

        // Comprehensive normalization for alternative/capitalized JSON schemas
        const normAction = rawObj.action ?? rawObj.Action ?? "create";
        let normSource = rawObj.code ?? rawObj.Source ?? rawObj.content ?? rawObj.Content ?? rawObj.script ?? rawObj.Script;
        let normParent = rawObj.parent ?? rawObj.Parent;
        let normName = rawObj.name ?? rawObj.Name;
        const normType = rawObj.scriptType ?? rawObj.Type ?? rawObj.type ?? rawObj.ClassName ?? rawObj.className;

        if (normSource === undefined && String(normAction).toLowerCase() === "create") {
          normSource = "";
        }

        if (rawObj.path && normSource !== undefined) {
          const pathParts = String(rawObj.path).split('/');
          normName = pathParts[pathParts.length - 1];
          normParent = pathParts.slice(0, -1).join('/') || "ReplicatedStorage";
        }

        if (typeof normSource === "string") {
          let parentStr = String(normParent || "ReplicatedStorage");
          if (parentStr.startsWith("game.")) {
            parentStr = parentStr.substring(5);
          }
          return {
            scripts: [{
              action: String(normAction).toLowerCase(),
              type: String(normType || "Script"),
              scriptType: String(normType || "Script"),
              parent: parentStr,
              name: String(normName || "Script"),
              code: normSource
            }],
            message: `Successfully created ${normName} in ${parentStr}`
          } as PluginPayload;
        }
      }
    } catch {
      // ignore
    }

    // Step 3: Find JSON objects by locating balanced braces
    // This handles cases where the AI dumps thinking text before the JSON
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace === -1) return null;

    // Try progressively from each '{' to find a valid JSON object
    for (let i = firstBrace; i < cleaned.length; i++) {
      if (cleaned[i] !== "{") continue;
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let j = i; j < cleaned.length; j++) {
        const ch = cleaned[j];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\" && inString) {
          escape = true;
          continue;
        }
        if (ch === '"' && !escape) {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            const candidate = cleaned.substring(i, j + 1);
            try {
              const obj = JSON.parse(candidate);
              if (
                obj &&
                typeof obj === "object" &&
                ("code" in obj || "action" in obj || "scripts" in obj)
              ) {
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
        if (
          obj &&
          typeof obj === "object" &&
          ("code" in obj || "action" in obj || "scripts" in obj)
        )
          return obj as PluginPayload;
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
            const colonIndex = codeStr.indexOf(":");
            if (colonIndex !== -1) {
              codeStr = codeStr.substring(colonIndex + 1).trim();
              if (codeStr.startsWith('"')) {
                codeStr = codeStr.substring(1);
                codeStr = codeStr
                  .replace(/\"\s*\}\s*$/, "")
                  .replace(/\"\s*$/, "");
                try {
                  codeStr = JSON.parse('"' + codeStr + '"');
                } catch {
                  codeStr = codeStr
                    .replace(/\\n/g, "\n")
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, "\\");
                }
                return {
                  action: "create",
                  type: t || "Script",
                  parent: p || "ServerScriptService",
                  name: n || "TruncatedScript",
                  code: codeStr,
                };
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
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const firstBrace = cleaned.indexOf("{");
    if (firstBrace > 20) {
      // Return everything before the first brace as preamble
      return cleaned.substring(0, firstBrace).trim();
    }
    return null;
  }

  // Build file context block
  let fileContextBlock = "";
  if (fileContents.length > 0) {
    fileContextBlock =
      "\n\nThe user has attached the following files for reference:\n";
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

  const thinkingInstructions =
    mode === "thinking"
      ? `\n\n## THINKING MODE ACTIVE\nYour response must include a "thinking" field in the JSON with your step-by-step reasoning:\n1. Analysis of what the user wants and what already exists in the project.\n2. Step-by-step plan for a FULL, PRODUCTION-READY implementation (do not plan scaffolding or basic outlines; plan the actual complete feature with all necessary logic and UI).\n3. Any risks, edge cases, or Luau gotchas to watch out for.\nThe "thinking" field should be thorough. All final code goes in the "scripts" array as normal.`
      : "";

  // Build UI examples context block (few-shot) when prompt is UI-related
  const uiExamplesBlock = buildUIExamplesBlock(prompt);

  // Build library deployment prompt (tells AI about the full deployed component library)
  const libraryDeploymentPrompt = isUIRelatedPrompt(prompt) ? buildLibraryDeploymentPrompt() : "";

  // Build systems context block (injects matching gameplay system templates)
  const systemsContextBlock = buildSystemsContextBlock(prompt);

  const SYSTEM_PROMPT = `### ABSOLUTE OUTPUT RULE — READ THIS FIRST ###
If you are provided with the \`execute_roblox_actions\` tool (function calling), you MUST use it to execute your actions.
If the tool is NOT available, your ENTIRE response MUST be a single valid JSON object and NOTHING ELSE.
- NO plain text before or after the JSON.
- NO markdown fences (\`\`\`json ... \`\`\`).
- DO NOT describe what you are going to do. DO IT by writing the code in the "scripts" array or calling the tool.
- If using JSON mode and you output anything other than a raw JSON object starting with { and ending with }, the response will be REJECTED.

The only valid JSON fallback response shape is:
{"scripts":[...],"message":"...","suggestions":[...]}

If you cannot produce code, still return JSON: {"scripts":[],"message":"<explanation>","suggestions":[]}

### YOU ARE: Apple Juice AI ###
You are an expert Roblox game developer operating directly inside Roblox Studio via a sync plugin.
You build games by writing code — the plugin executes each entry live in Studio.
You NEVER show code for the user to paste. You ONLY use the tool or output JSON.
${thinkingInstructions}

## Workflow
1. **Explore first.** Use \`read_script\` to understand the project before changing anything. Never guess at paths or names.
2. **Edit with tools.** Use \`edit_script\` for targeted script changes and \`create_instance\` for instances. Never tell the user to paste code.
3. **Verify after.** Re-read scripts with \`read_script\` if needed.
4. **Debug with playtests.** Instrument code → \`run_playtest\` → read console output/errors → fix → repeat.

## Project Awareness
At the start of a session, identify:
- **Frameworks**: Knit, AeroGameFramework, Rojo, Nevermore, Fusion, Roact/React-lua, Rodux, ProfileService, DataStore2, etc. All new code must follow existing patterns.
- **Folder conventions**: How are scripts organized? Place new code where it belongs.
- **Module patterns**: Return table, OOP metatables, functional? Match the style.
- **Communication patterns**: Direct RemoteEvents, or wrapped (Knit, BridgeNet2, Red)? Use the same approach.
- **Naming conventions**: PascalCase, camelCase, prefix systems? Be consistent.
Carry this context throughout the session. Do not introduce new frameworks or architectural styles unless the user explicitly asks.

## Plugin Actions
(Use the \`execute_roblox_actions\` tool if available. If not, you execute actions by adding JSON objects to the "scripts" array!)

### Scripts
- \`read_script\` — Read script content. Use {"action": "read_script", "name": "ScriptName"}. Always read before editing.
- \`create\` — Create or completely replace a script. Use {"action": "create", "type": "Script", "parent": "ServerScriptService", "name": "MyScript", "code": "-- entire code"}.
- \`delete\` — Delete an instance. Use {"action": "delete", "name": "Name", "parent": "Parent"}.

### Data Model
- \`create_instance\` — Create high-level non-script objects (Folders, RemoteEvents, ScreenGuis). Do NOT use for individual UI elements.
- \`rename_instance\` — Rename an object. Use {"action": "rename_instance", "oldPath": "Workspace.OldName", "newName": "NewName"}.
- \`move_instance\` — Move an object. Use {"action": "move_instance", "oldPath": "Workspace.MyPart", "newParentPath": "ServerStorage"}.

### Playtesting & Debugging
- \`run_playtest\` — Trigger an automatic 6-second playtest. Use {"action": "run_playtest"}. MANDATORY: Always include this as the LAST entry in your scripts array to verify functionality.
- \`stop_playtest\` — Stop playtest early. Use {"action": "stop_playtest"}.

## Roblox Architecture

**DataModel**: game → Services → Instances. Key services:
- \`Workspace\` — 3D world. BaseParts, Models, Terrain, Camera. Replicated.
- \`ServerScriptService\` — Server Scripts. Never accessible from client.
- \`ServerStorage\` — Server-only assets and data. Not replicated.
- \`ReplicatedStorage\` — Shared modules, RemoteEvents, RemoteFunctions, assets.
- \`StarterPlayerScripts\` / \`StarterCharacterScripts\` — LocalScripts cloned per player.
- \`StarterGui\` — ScreenGuis/LocalScripts cloned to PlayerGui.
- \`Players\`, \`Lighting\`, \`SoundService\` — as named.
- Access all services via \`:GetService()\`.

**Client-server model**: Server is authoritative. Clients see a replicated subset. Communicate via RemoteEvents (fire-and-forget) and RemoteFunctions (request-response). **Never trust the client.** Validate all inputs server-side.

## Luau Style & Safety
- Idiomatic Luau: type annotations, string interpolation, \`if-then-else\` expressions.
- Descriptive names: \`player\` not \`p\`, \`character\` not \`char\`, \`humanoid\` not \`hum\`.
- PascalCase for services/instances/properties/methods. camelCase for locals.
- \`:GetService()\` for services. \`:WaitForChild()\` on client for instances that may not have replicated.
- \`task.spawn\`, \`task.defer\`, \`task.delay\`, \`task.wait\` — never legacy \`spawn\`/\`wait\`/\`delay\`.
- Clean up: disconnect connections, destroy clones, cancel threads.
- To edit an existing script, you MUST use \`create\` to overwrite it entirely with the updated, full code. Do NOT try to output partial snippets. Output the ENTIRE working script.
- Never invent paths, remotes, or instances without verifying they exist.
- If a change is risky or destructive, say so and proceed carefully.
- Every script MUST start with a print statement: \`print("[AppleJuice] Running ScriptName...")\`
- INFINITE YIELD GUARD: NEVER use WaitForChild() without a timeout (e.g., use \`WaitForChild("Name", 5)\`).
- DO NOT spawn Parts or any 3D objects in the Workspace unless the user explicitly asks you to create physical 3D objects.
- Place Scripts in ServerScriptService and LocalScripts in StarterPlayerScripts or StarterGui. Never put scripts directly in the Workspace.

## UI GENERATION — USE AppleJuiceUI LIBRARY
When creating ANY UI, you MUST use the AppleJuiceUI component library (auto-deployed to ReplicatedStorage.AppleJuiceUI).

### Setup:
\`\`\`luau
local UI = require(game:GetService("ReplicatedStorage"):WaitForChild("AppleJuiceUI", 10))
UI.setTheme("Juice") -- or "Midnight" or "Ember" or "Claude"
\`\`\`

### ONE-CALL TEMPLATES (preferred — use these first!):
\`\`\`luau
-- Complete shop with tabs, product grid, close button, responsive scaling:
local screen, panel = UI.ShopTemplate({Title="Game Shop", Tabs={
  {Id="Currency", Label="BUY COINS", Items={{Text="Coin", Price=49, Icon=UI.Icons.Coin}}},
  {Id="Passes", Label="GAMEPASSES", Items={{Text="VIP", Price=499, Icon=UI.Icons.VIP}}},
}})

-- Complete inventory with item grid, rarity badges, hover spin:
local screen, panel = UI.InventoryTemplate({Title="Inventory", Items={
  {Name="Sword", Icon=UI.Icons.Sword, Count=1, Rarity="Legendary"},
}})

-- Complete HUD (health, currency, XP bar):
local screen, refs = UI.HUDTemplate({StartingCoins=1000})
refs.health:Update(0.75, "75/100 HP")
refs.currency:SetAmount(5000)
\`\`\`

### INDIVIDUAL COMPONENTS:
\`\`\`luau
UI.createScreenGui("Name")                    -- ScreenGui in PlayerGui
UI.DynamicScale(screen, {BaseResolution=Vector2.new(1920,1080)})  -- responsive
UI.Card(parent, {Size, Position, Padding})     -- themed panel
UI.GradientCard(parent, {TopColor, BottomColor, GradientRotation})
UI.ElevatedCard(parent, {Size, Position})      -- card with drop shadow
UI.Button(parent, {Text, Style="Primary"|"Secondary"|"Danger"|"Ghost", OnClick})
UI.TitleBar(parent, {Title, OnClose})          -- bar with close button
UI.ScrollList(parent, {Grid=true, CellSize, Spacing})  -- scrolling container
UI.ProductCard(scroll, {Text, Price, Icon, OnClick})   -- shop item card
UI.Badge(parent, {Text, Color="Accent"|"Error"|"Success"|"Warning"})
UI.ProgressBar(parent, {Value=0..1, Label, FillColor})
UI.Tabs(parent, {Items={{Id,Label}}, Default, OnChanged})
UI.Text(parent, {Text, Bold, TextSize, Align, Wrapped})
UI.Divider(parent)
UI.Toast(screen, {Text, Type="success"|"error"|"info"|"warning"})
UI.Modal(parent, {Title, Size, OnClose})
UI.CurrencyHUD(parent, {Amount, Icon})         -- floating coin display
UI.Image(parent, {Image, Size, ScaleType})
UI.HoverSpinIcon(parent, {Image, Size})        -- returns holder, spinFn
\`\`\`

### ICON CATALOG (use UI.Icons.X instead of hardcoding asset IDs):
Coin, Cash, Crystal, Diamond, Ingot, Premium, Robux, Ticket,
VIP, Aura, Trail, Teleport, AngelHeart, Magnet, Crown, LuckyBlock,
Coil, Trophy, Shield, Sword, Gift, Potion, Rocket, Fire, Heart,
Hoverboard, Lightning, Rebirth, Star, Upgrade, Wheel

### RULES:
- Available themes: "Juice" (dark + lime), "Midnight" (dark + blue), "Ember" (warm + orange), "Claude" (developer terminal style + Claude orange & electric violet)
- NEVER use raw Instance.new() for UI — ALWAYS use UI.Button, UI.Card, etc.
- Use UI.Icons.X for asset IDs — NEVER hardcode "rbxassetid://..."
- Use UI.ShopTemplate/InventoryTemplate/HUDTemplate for common UIs
- The library handles hover animations, press feedback, theming, rounded corners, and responsive layout automatically.
- The AppleJuiceUI ModuleScript is ALREADY deployed to ReplicatedStorage — just require it.

## OUTPUT FORMAT — MANDATORY
If using the tool, call it natively. If using the JSON fallback, your output MUST be a single valid JSON object. No text outside the JSON. No markdown fences.

CORRECT JSON Fallback example:
{
  "scripts": [
    {"action": "create", "scriptType": "ModuleScript", "parent": "ReplicatedStorage", "name": "ShopConfig", "code": "-- full code here"},
    {"action": "create", "scriptType": "Script", "parent": "ServerScriptService", "name": "ShopServer", "code": "-- full code here"},
    {"action": "create", "scriptType": "LocalScript", "parent": "StarterGui", "name": "ShopClient", "code": "-- full code here"},
    {"action": "create_instance", "className": "RemoteEvent", "instanceName": "ShopPurchase", "parent": "ReplicatedStorage"},
    {"action": "run_playtest"}
  ],
  "message": "Brief summary of what you did.",
  "suggestions": ["Add more items", "Add purchase animations", "Add a currency display"]
}

FORBIDDEN JSON Fallback formats (these will cause rejection):
- Any plain text response
- Any markdown

## NO SCAFFOLDING / FULL IMPLEMENTATION MANDATE (CRITICAL)
- You are NOT just an architect outlining a project. You are the senior developer who writes the FINAL, PRODUCTION-READY code.
- NEVER generate "foundational architecture" or "basic frameworks" and tell the user to "expand with specific item logic".
- If the user asks for a feature (e.g. a "high end shop"), you MUST write the FULL feature: the complete scrolling frame UI, actual viewport frames or item cards, the full purchase logic (checking balance, deducting, handling data), the actual item data module with multiple real items, and remote events.
- Scripts should be robust and fully-featured. A UI script should NOT be 20 lines; it should create, style, and connect all necessary UI elements programmatically (using Instance.new, TweenService, etc.).
- ZERO TOLERANCE for placeholders, "TODOs", or leaving implementations to the user.
- If you find yourself thinking "I will leave the purchase logic for the user to implement," STOP. Write the logic yourself immediately.

## CRITICAL REMINDERS
- ZERO TOLERANCE for placeholder code like "-- add code here" or "-- rest of implementation". Write the FULL code for every file.
- Every script must be complete, functional, and production-ready.
- Validate RemoteEvent arguments on the server side.
- NEVER reference instances that don't exist yet — create them first or use WaitForChild().
- The LAST entry in your actions MUST be: {"action": "run_playtest"}
${fileContextBlock}${treeContextBlock}${uiExamplesBlock}${libraryDeploymentPrompt}${systemsContextBlock}
FINAL REMINDER: Call the tool if available. Otherwise, your ENTIRE response must be ONLY a single valid JSON object starting with { and ending with }.`;

  // Build context compaction summary (BloxBot-style) for long sessions.
  // After 8+ messages the AI tends to forget what scripts already exist.
  // We inject a compact summary of the existing codebase state.
  function buildContextSummary(
    msgs: { role: string; content: string }[],
  ): string | null {
    if (msgs.length < 8) return null;
    const scriptNames: string[] = [];
    const scriptSet = new Set<string>();
    for (const m of msgs) {
      if (m.role !== "assistant") continue;
      try {
        const parsed = JSON.parse(m.content);
        const scripts = parsed?.scripts ?? [];
        for (const s of scripts) {
          if (s.name && s.parent && (s.action === "create" || !s.action)) {
            const key = `${s.parent}.${s.name}`;
            if (!scriptSet.has(key)) {
              scriptSet.add(key);
              scriptNames.push(
                `${s.type ?? "Script"}: ${s.name} → ${s.parent}`,
              );
            }
          }
        }
      } catch {
        /* not JSON, skip */
      }
    }
    if (scriptNames.length === 0) return null;
    return (
      `## Session Context (${msgs.length} messages so far)\n` +
      `Scripts already created in this session:\n` +
      scriptNames.map((n) => `- ${n}`).join("\n") +
      `\n\nBefore editing any of these, call read_script to fetch the current live content.\n` +
      `Do NOT recreate scripts that already exist unless the user explicitly asks.\n` +
      `Focus ONLY on what the user is asking for NOW.`
    );
  }

  const executeRobloxActionsTool = {
    type: "function",
    function: {
      name: "execute_roblox_actions",
      description: "Executes one or more actions in the Roblox Studio environment. Use this tool to create scripts, move instances, and trigger playtests.",
      parameters: {
        type: "object",
        properties: {
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["create", "delete", "create_instance", "rename_instance", "move_instance", "run_playtest", "edit_script", "read_script"] },
                scriptType: { type: "string", description: "Script type: Script, LocalScript, or ModuleScript. Used when action is create." },
                parent: { type: "string", description: "The path to the parent instance" },
                name: { type: "string", description: "Name of the instance" },
                code: { type: "string", description: "The full Luau code for the script" },
                className: { type: "string", description: "Class name of the instance to create (e.g. RemoteEvent, Folder)" },
                instanceName: { type: "string", description: "Name of the created instance" },
                oldPath: { type: "string", description: "Old path for move_instance or rename_instance" },
                newName: { type: "string", description: "New name for rename_instance" },
                newParentPath: { type: "string", description: "New parent path for move_instance" }
              },
              required: ["action"]
            }
          },
          message: { type: "string", description: "A brief message to the user about what was done." },
          suggestions: {
            type: "array",
            items: { type: "string" },
            description: "An array of 2-3 suggestions for the user."
          }
        },
        required: ["actions"]
      }
    }
  };

  const geminiExecuteRobloxActionsTool = {
    functionDeclarations: [
      executeRobloxActionsTool.function
    ]
  };

  // Helper to call OpenAI Chat Completions
  async function callOpenAI(key: string, modelName: string, endpointUrl: string) {
    const apiMessages: {
      role: "system" | "user" | "assistant";
      content: string;
    }[] = [{ role: "system", content: SYSTEM_PROMPT }];

    if (body.messages && body.messages.length > 0) {
      const msgs = body.messages.map((m, idx) => {
        if (idx === body.messages!.length - 1 && m.role === "user" && prompt) {
          return { ...m, content: prompt };
        }
        return m;
      });
      apiMessages.push(...msgs);

      // Inject context summary for long sessions (BloxBot compaction)
      const summary = buildContextSummary(msgs);
      if (summary) {
        apiMessages.splice(1, 0, { role: "system", content: summary });
      }
    } else {
      apiMessages.push({ role: "user", content: prompt });
    }

    // Handle continuation hints for large systems
    const isContinuation =
      apiMessages.length > 0 &&
      apiMessages[apiMessages.length - 1].content
        .toLowerCase()
        .includes("continue generating");
    if (isContinuation) {
      apiMessages.push({
        role: "system",
        content:
          "CRITICAL: The previous response was truncated. Please provide ONLY the remaining scripts or fields that were not finished. Do NOT repeat scripts you already provided. Start directly with the next script in the JSON 'scripts' array.",
      });
    }

    const headers: any = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    };
    if (endpointUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "https://github.com/inetixus/apple-juice";
      headers["X-Title"] = "Apple Juice Roblox Sync";
    }

    const payload: any = {
      model: modelName,
      temperature: mode === "thinking" ? 0.4 : 0.2,
      messages: apiMessages,
      max_tokens: dynamicMaxOutputTokens,
    };

    // Tool Allowlist: Only enable tools for native OpenAI or explicitly supported models
    if (endpointUrl.includes("api.openai.com")) {
      payload.tools = [executeRobloxActionsTool];
      payload.tool_choice = "auto";
    }

    const res = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let tokens = 0;
    try {
      const parsed = JSON.parse(text);
      tokens = parsed?.usage?.total_tokens || 0;
    } catch {
      /* ignore */
    }
    return { ok: res.ok, text, tokens };
  }

  function extractContent(rawResponse: string, isGoogle = false): string {
    try {
      const parsed = JSON.parse(rawResponse);
      
      if (isGoogle) {
        const parts = parsed?.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.functionCall && part.functionCall.name === "execute_roblox_actions") {
              const args = part.functionCall.args;
              if (args && args.actions) {
                const mappedActions = args.actions.map((a: any) => ({ ...a, type: a.scriptType || a.type }));
                return JSON.stringify({ scripts: mappedActions, message: args.message, suggestions: args.suggestions });
              }
            }
          }
          return parts[0]?.text?.trim() || "";
        }
        return "";
      }
      
      const message = parsed?.choices?.[0]?.message;
      if (message?.tool_calls) {
        for (const call of message.tool_calls) {
          if (call.function?.name === "execute_roblox_actions") {
            try {
              const args = JSON.parse(call.function.arguments);
              if (args && args.actions) {
                const mappedActions = args.actions.map((a: any) => ({ ...a, type: a.scriptType || a.type }));
                return JSON.stringify({ scripts: mappedActions, message: args.message, suggestions: args.suggestions });
              }
            } catch {
              /* ignore parse errors for tool args here */
            }
          }
        }
      }
      
      return message?.content?.trim() ?? "";
    } catch {
      return "";
    }
  }

  function processResponse(
    content: string,
    rawText: string,
  ): { code: string; raw: string; preamble?: string } {
    const structured =
      tryParsePluginPayload(content) || tryParsePluginPayload(rawText);
    const preamble = getPreamble(content) || getPreamble(rawText) || undefined;
    if (structured) {
      if (structured.scripts && Array.isArray(structured.scripts)) {
        return { code: "", raw: JSON.stringify(structured), preamble };
      }
      if (structured.code) {
        return {
          code: structured.code,
          raw: JSON.stringify(structured),
          preamble,
        };
      }
    }

    // ── Unwrap common envelope formats that non-compliant models return ──
    // e.g. {"role":"assistant","content":"..."} or {"assistant":"..."} or {"text":"..."}
    const tryUnwrap = (text: string): string | null => {
      const t = text.trim();
      if (!t.startsWith("{")) return null;
      try {
        const obj = JSON.parse(t);
        if (typeof obj?.content === "string") return obj.content;
        if (typeof obj?.assistant === "string") return obj.assistant;
        if (typeof obj?.text === "string") return obj.text;
        if (typeof obj?.message === "string") return obj.message;
      } catch { /* not JSON */ }
      return null;
    };
    const unwrapped = tryUnwrap(content) || tryUnwrap(rawText);
    if (unwrapped && unwrapped !== content) {
      return processResponse(unwrapped, unwrapped);
    }

    // ── Try triple-backtick code blocks (```lua / ```luau / ```) ──
    const codeBlockMatch =
      content.match(/```(?:luau|lua)\n([\s\S]*?)```/i) ||
      content.match(/```\n([\s\S]*?)```/i);
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
        preamble: content.substring(0, codeBlockMatch.index).trim(),
      };
    }

    // ── Try loose code blocks (models that output "lua\n...code..." without backticks) ──
    // Match: optional newlines, then "lua" or "luau" on its own line, then the code
    const looseMatch = content.match(/(?:^|\n\n?)(?:lua|luau)\n([\s\S]+?)(?=\n\n[A-Za-z]|\n\nWould|\n\nWhat|\n\nWhy|\n\nTo use|$)/i);
    if (looseMatch) {
      const rawBlock = looseMatch[1];
      // Strip trailing prose: keep only lines that look like Lua
      const codeLines: string[] = [];
      for (const line of rawBlock.split("\n")) {
        const trimLine = line.trimEnd();
        // Stop when we hit a clearly non-code line (prose paragraph)
        if (codeLines.length > 0 && /^[A-Z][a-z].*:$/.test(trimLine)) break;
        codeLines.push(trimLine);
      }
      const cleanCode = codeLines.join("\n").trim();
      if (cleanCode) {
        return {
          code: cleanCode,
          raw: JSON.stringify({
            action: "create",
            type: "Script",
            parent: "ServerScriptService",
            name: "AIGeneratedFallback",
            code: cleanCode,
          }),
          preamble: content.substring(0, looseMatch.index ?? 0).trim(),
        };
      }
    }

    // ── Last resort: if the whole content looks like Lua, treat it as code ──
    const trimmed = content.trim();
    const isLikelyCode =
      trimmed.startsWith("--") ||
      trimmed.startsWith("local ") ||
      trimmed.startsWith("function") ||
      (trimmed.includes("local ") && trimmed.includes("game:GetService"));

    if (!isLikelyCode) {
      return { code: "", raw: "" };
    }

    const cleanCode = content
      .replace(/^```(luau|lua)?\n?/gim, "")
      .replace(/```$/gm, "")
      .trim();
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
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const activeLoad = await getActiveGenerations();

    // Check load dynamically
    if (userUsage.plan === "pure_ultra") {
      // Priority Queue: Zero wait, bypasses limits
    } else if (userUsage.plan === "fresh_pro") {
      // Standard Queue: Wait up to 3 seconds if system is heavily loaded
      if (activeLoad > 8) await delay(3000);
      else if (activeLoad > 4) await delay(1000);
    } else {
      // Free Queue: Wait up to 8 seconds if loaded. If heavily loaded, return rate limit.
      if (activeLoad > 15) {
        return Response.json(
          {
            error: "Queue Full",
            message:
              "The free tier queue is currently at maximum capacity due to high traffic. Please try again shortly or upgrade your plan.",
          },
          { status: 429 },
        );
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
    // ── Pre-Check Interceptor (OpenRouter / Groq) ──────────────────────────────
    const normalizedModel = effectiveModel.toLowerCase().trim();
    if (normalizedModel === "gpt oss 120b" || normalizedModel === "deepseek r1" || normalizedModel.includes("v4 flash") || normalizedModel.includes("nemotron")) {
      const isGPToss = normalizedModel === "gpt oss 120b";
      const isOpenRouter = isGPToss || normalizedModel.includes("v4 flash") || normalizedModel.includes("nemotron");
      const apiKeysStr = isOpenRouter ? process.env.OPENROUTERKEYS : process.env.GROQKEYS;
      const apiKeys = (apiKeysStr || "").replace(/["']/g, "").split(",").map(k => k.trim()).filter(Boolean);
      
      const endpoint = isOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions";
      const targetModel = isGPToss 
        ? "meta-llama/llama-3.3-70b-instruct:free" 
        : normalizedModel.includes("v4 flash")
          ? "deepseek/deepseek-v4-flash:free" 
          : normalizedModel.includes("nemotron")
            ? "nvidia/nemotron-3-super-120b-a12b:free"
            : "deepseek-r1-distill-llama-70b";
      
      const strictPrompt = prompt ? prompt + "\n\nCRITICAL INSTRUCTION: You MUST format your ENTIRE response as a single valid JSON object containing 'message', 'thinking' (optional), and 'scripts' (array of {name, type, parent, code}). DO NOT include any conversational text outside the JSON block. Start your response with {.\n\nWARNING: You DO NOT have the ability to read files dynamically or wait for user confirmation. You MUST generate the complete, finalized scripts immediately in this single response." : "";
      
      const msgs: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
      if (body.messages && body.messages.length > 0) {
        const ms = body.messages.map((m, idx) => {
          if (idx === body.messages!.length - 1 && m.role === "user" && strictPrompt) {
            return { ...m, content: strictPrompt };
          }
          return m;
        });
        msgs.push(...ms);
      } else {
        msgs.push({ role: "user", content: strictPrompt });
      }

      let successRes: Response | null = null;
      let lastRes: Response | null = null;
      
      for (const key of apiKeys) {
        if (!key) continue;
        
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
            "HTTP-Referer": "https://applejuice.ai",
            "X-Title": "Apple Juice"
          },
          body: JSON.stringify({
            model: targetModel,
            messages: msgs,
            temperature: mode === "thinking" ? 0.4 : 0.2,
            max_tokens: Math.min(dynamicMaxOutputTokens, 8192),
            stream: true
          })
        });

        lastRes = res;

        if (res.status !== 429) {
          if (res.ok && res.body) {
            successRes = res;
          }
          break; 
        }
      }

      if (!successRes) {
        if (lastRes) {
          // If OpenRouter rejected us (429 or 403), return the exact error so the UI shows it
          const bodyText = await lastRes.text();
          return Response.json(
            { error: "Provider Error", detail: bodyText },
            { status: lastRes.status }
          );
        } else {
          // Fall back if no keys were configured at all
          effectiveModel = "Gemini 3 Flash";
          effectiveProvider = "google";
        }
      } else {
        const originalStream = successRes.body!;
        let totalBytes = 0;
        const transformStream = new TransformStream({
          transform(chunk, controller) {
            totalBytes += chunk.length;
            controller.enqueue(chunk);
          },
          async flush() {
            if (!isUsingCustomKey && ownerUserId) {
              const inputTk = Math.ceil((prompt?.length || 0) / 4);
              const outputTk = Math.ceil(totalBytes / 4);
              const mlUsed = calculateMlUsed(inputTk, outputTk, effectiveModel);
              await trackMlUsage(ownerUserId, mlUsed);
            }
          },
        });

        return new Response(originalStream.pipeThrough(transformStream), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
    }

    // ── Apple Juice AI Provider Path ──────────────────────────────────────────
    if (effectiveProvider === "apple_juice_ai") {
      // 1. Look up identity mapping
      const agMapping = userEmail
        ? await getAntigravityMapping(userEmail)
        : null;

      // If the user wants real Antigravity proxy credits, that logic can be restored later.

      // 3. Build messages array for the relay
      const agMessages: {
        role: "system" | "user" | "assistant";
        content: string;
      }[] = [{ role: "system", content: SYSTEM_PROMPT }];

      if (body.messages && body.messages.length > 0) {
        // Sanitize messages to avoid context pollution from placeholders
        const sanitizedMessages = (body.messages as any[]).map((msg, index) => {
          if (msg.role === "assistant") {
            let content = msg.content || "";
            if (
              content.includes("Ready to generate Roblox scripts") ||
              content.includes("Teleport system with GUI selection")
            ) {
              return {
                ...msg,
                content: "The user is asking for a new feature.",
              };
            }
            return msg;
          }
          if (
            index === body.messages!.length - 1 &&
            msg.role === "user" &&
            prompt
          ) {
            return { ...msg, content: prompt };
          }
          return msg;
        });
        agMessages.push(...sanitizedMessages);

        // Inject context compaction summary for long sessions
        const agSummary = buildContextSummary(sanitizedMessages);
        if (agSummary) {
          agMessages.splice(1, 0, { role: "system", content: agSummary });
        }
      } else {
        agMessages.push({ role: "user", content: prompt });
      }

      // 4. Relay through Google Gemini API using user's OAuth token
      const accessToken = (session as { accessToken?: string })?.accessToken;
      const isDeepSeek = effectiveModel.toLowerCase().includes("deepseek");

      const agResult = await relayToAntigravity(
        agMapping,
        {
          model: effectiveModel,
          messages: agMessages,
          temperature: mode === "thinking" ? 0.4 : 0.2,
          max_tokens: dynamicMaxOutputTokens,
          stream: isDeepSeek,
        },
        accessToken,
        userEmail,
      );

      if (isDeepSeek && agResult.ok && agResult.stream) {
        // Use a TransformStream to track when the stream ends and decrement the counter
        const originalStream = agResult.stream.body!;
        let totalBytes = 0;
        const transformStream = new TransformStream({
          transform(chunk, controller) {
            totalBytes += chunk.length;
            controller.enqueue(chunk);
          },
          async flush() {
            // Track usage even if truncated or aborted
            if (!isUsingCustomKey && ownerUserId) {
              const inputTk = Math.ceil((prompt?.length || 0) / 4);
              const outputTk = Math.ceil(totalBytes / 4);
              const mlUsed = calculateMlUsed(inputTk, outputTk, effectiveModel);
              await trackMlUsage(ownerUserId, mlUsed);
            }
          },
        });

        // Stream the response back to the client
        return new Response(originalStream.pipeThrough(transformStream), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      if (!agResult.ok) {
        return Response.json(
          {
            error: agResult.error || "Antigravity request failed",
            provider: "antigravity",
            model: effectiveModel,
          },
          { status: agResult.status },
        );
      }

      // 5. Extract content and process through existing pipeline
      const agContent =
        agResult.data?.choices?.[0]?.message?.content?.trim() || "";
      tokensUsed = agResult.tokensUsed;
      modelUsed = agResult.data?.model || effectiveModel;

      if (agContent) {
        const result = processResponse(agContent, agContent);
        code = result.code;
        raw = result.raw;
        preambleReasoning = result.preamble;
      }

      if (!code && !raw) {
        return Response.json(
          {
            error: "Antigravity returned empty output",
            detail: agContent,
            provider: "antigravity",
          },
          { status: 502 },
        );
      }

      // ── OpenAI Provider Path ───────────────────────────────────────────────────
    } else if (
      effectiveModel.toLowerCase().startsWith("gpt-") &&
      finalOpenAIKey
    ) {
      let endpointUrl = "https://api.openai.com/v1/chat/completions";
      if (effectiveProvider === "deepseek") endpointUrl = "https://api.deepseek.com/v1/chat/completions";
      else if (effectiveProvider === "openrouter") endpointUrl = "https://openrouter.ai/api/v1/chat/completions";

      const requestKey = isUsingCustomKey ? clientKey : (effectiveProvider === "openai" ? systemOpenAIKey : "");

      const { ok, text, tokens } = await callOpenAI(
        requestKey,
        effectiveModel,
        endpointUrl
      );
      raw = text;
      tokensUsed = tokens;
      if (!ok)
        return Response.json(
          { error: "LLM request failed", detail: raw, model: effectiveModel },
          { status: 502 },
        );
      const content = extractContent(raw);
      const result = processResponse(content, raw);
      code = result.code;
      raw = result.raw;
      preambleReasoning = result.preamble;
      modelUsed = effectiveModel;

      // ── Google Provider Path ───────────────────────────────────────────────────
    } else if (effectiveProvider === "google") {
      const requestedModel = (effectiveModel || "gemini-1.5-flash").trim();
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
        "Gemini 1.5 Flash": "gemini-1.5-flash",
      };
      let url = "";
      let headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      let isClaude = false;

      try {
        if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
          // Use Google Cloud Service Account with Gemini API endpoint
          const credentials = JSON.parse(
            process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
          );
          const auth = new GoogleAuth({
            credentials,
            scopes: [
              "https://www.googleapis.com/auth/cloud-platform",
              "https://www.googleapis.com/auth/generative-language",
            ],
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
            const rawModelName = requestedModel.replace("models/", "");
            // Validate that the model is supported
            if (!MODEL_MAPPING[rawModelName] && !MODEL_MAPPING[requestedModel]) {
              return Response.json({
                error: "Unsupported model for Google provider",
                detail: `Model ${requestedModel} is not supported.`,
              }, { status: 400 });
            }
            const finalModelName =
              MODEL_MAPPING[rawModelName] ||
              MODEL_MAPPING[requestedModel];
            url = `https://generativelanguage.googleapis.com/v1beta/models/${finalModelName}:generateContent`;
          }

          if (token.token) {
            headers["Authorization"] = `Bearer ${token.token}`;
          }
        } else {
          // Fallback to simple Google AI Studio API Key
          // Use mapped model name for fallback Google API
          const finalModelName =
            MODEL_MAPPING[requestedModel] ||
            requestedModel.replace(/\s+/g, "-").toLowerCase();
          const candidate = `models/${finalModelName}`;
          url = `https://generativelanguage.googleapis.com/v1beta/${candidate}:generateContent?key=${encodeURIComponent(finalGoogleKey)}`;
        }

        let payload: any = {};
        if (isClaude) {
          // Anthropic Vertex AI Payload Format
          payload = {
            anthropic_version: "vertex-2023-10-16",
            messages: (() => {
              if (body.messages && body.messages.length > 0) {
                return body.messages.map((m, idx) => {
                  const isLastUser =
                    idx === body.messages!.length - 1 && m.role === "user";
                  return {
                    role: m.role,
                    content: isLastUser && prompt ? prompt : m.content,
                  };
                });
              }
              return [{ role: "user", content: prompt }];
            })(),
            system: SYSTEM_PROMPT,
            max_tokens: dynamicMaxOutputTokens,
            temperature: mode === "thinking" ? 0.4 : 0.2,
          };
        } else {
          // Gemini Payload Format
          const geminiMsgs = (() => {
            if (body.messages && body.messages.length > 0) {
              return body.messages.map((m, idx) => {
                const isLastUser =
                  idx === body.messages!.length - 1 && m.role === "user";
                return {
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: isLastUser && prompt ? prompt : m.content }],
                };
              });
            }
            return [{ role: "user", parts: [{ text: prompt }] }];
          })();

          // Inject context compaction for long Gemini sessions
          // Gemini doesn't support multiple system turns, so we prepend as a user/model exchange
          const geminiSummary = buildContextSummary(
            body.messages?.map((m: any) => ({
              role: m.role,
              content: m.content,
            })) ?? [],
          );
          const geminiContents = geminiSummary
            ? [
                { role: "user", parts: [{ text: geminiSummary }] },
                {
                  role: "model",
                  parts: [
                    {
                      text: "Understood. I'll use read_script before editing any existing scripts and focus on the new request.",
                    },
                  ],
                },
                ...geminiMsgs,
              ]
            : geminiMsgs;

          payload = {
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: geminiContents,
            tools: [geminiExecuteRobloxActionsTool],
            toolConfig: {
              functionCallingConfig: { mode: "AUTO" }
            },
            generationConfig: {
              temperature: mode === "thinking" ? 0.4 : 0.2,
              maxOutputTokens: dynamicMaxOutputTokens,
              // Removed responseMimeType: "application/json" because function calling models might reject this constraint depending on the exact Gemini version, and we have a fallback anyway.
            },
          };
        }

        const llmRes = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const bodyText = await llmRes.text();
        if (!llmRes.ok) {
          console.warn("Google/Vertex API failed", {
            model: requestedModel,
            status: llmRes.status,
            body: bodyText,
          });
          return Response.json(
            {
              error: "LLM request failed",
              detail: bodyText,
              provider: effectiveProvider,
              requestedModel,
            },
            { status: 502 },
          );
        }

        let rawResponseText = "";
        if (isClaude) {
          const parsed = JSON.parse(bodyText);
          rawResponseText = parsed?.content?.[0]?.text || "";
          tokensUsed = parsed?.usage?.output_tokens || 0;
        } else {
          try {
            const parsed = JSON.parse(bodyText);
            rawResponseText =
              parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
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
          const { ok, text, tokens } = await callOpenAI(
            finalOpenAIKey,
            "gpt-4o-mini",
            "https://api.openai.com/v1/chat/completions"
          );
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
          return Response.json(
            {
              error: "LLM request failed",
              detail: bodyText,
              provider: effectiveProvider,
              requestedModel,
            },
            { status: 502 },
          );
        }
      } catch (err) {
        console.error("Google/Vertex Error", err);
        return Response.json(
          {
            error: "LLM request failed",
            detail: String(err),
            provider: effectiveProvider,
            requestedModel,
          },
          { status: 502 },
        );
      }

      // ── Default Fallback Path ──────────────────────────────────────────────────
    } else if (effectiveProvider === "groq_done") {
      // Do nothing, already processed
    } else {
      // Default: OpenAI using provided apiKey
      let endpointUrl = "https://api.openai.com/v1/chat/completions";
      if (effectiveProvider === "deepseek") endpointUrl = "https://api.deepseek.com/v1/chat/completions";
      else if (effectiveProvider === "openrouter") endpointUrl = "https://openrouter.ai/api/v1/chat/completions";

      const requestKey = isUsingCustomKey ? clientKey : (effectiveProvider === "openai" ? systemOpenAIKey : "");

      const { ok, text, tokens } = await callOpenAI(
        requestKey,
        effectiveModel,
        endpointUrl
      );
      raw = text;
      tokensUsed = tokens;
      if (!ok)
        return Response.json(
          { error: "LLM request failed", detail: raw, model: effectiveModel },
          { status: 502 },
        );
      const content = extractContent(raw);
      const result = processResponse(content, raw);
      code = result.code;
      raw = result.raw;
      preambleReasoning = result.preamble;
      modelUsed = effectiveModel;
    }

    const structuredFinal = tryParsePluginPayload(raw) || null;
    const isMultiScript =
      structuredFinal?.scripts &&
      Array.isArray(structuredFinal.scripts) &&
      structuredFinal.scripts.length > 0;
    const isDelete = !isMultiScript && structuredFinal?.action === "delete";

    // ── Auto-deploy AppleJuiceUI library ──────────────────────────────────────
    // If the response contains UI-related scripts and the library isn't already
    // in the project, prepend a "create" action to deploy it to ReplicatedStorage.
    if (isMultiScript && structuredFinal?.scripts) {
      const hasUIWork = structuredFinal.scripts.some(
        (s: any) =>
          s.code &&
          (s.code.includes("AppleJuiceUI") ||
            s.code.includes("ScreenGui") ||
            s.code.includes("UI.") ||
            s.code.includes('Instance.new("TextButton')),
      );
      const treeStr =
        (await getRedis().get<string>(`tree:${sessionKey}`)) || "";
      const libraryExists = treeStr.includes("AppleJuiceUI");

      if (hasUIWork && !libraryExists) {
        try {
          const libSource = getAppleJuiceUISource();
          structuredFinal.scripts.unshift({
            action: "create",
            type: "ModuleScript",
            parent: "ReplicatedStorage",
            name: "AppleJuiceUI",
            code: libSource,
          });
          // Update raw to reflect the prepended script
          raw = JSON.stringify(structuredFinal);
        } catch {
          // If reading fails, continue without the library
        }
      }
    }

    if (!code && !isDelete && !isMultiScript)
      return Response.json(
        { error: "Model returned empty output", detail: raw },
        { status: 502 },
      );

    const messageId = crypto.randomUUID();

    // Track mL usage only if NOT using a custom key
    if (!isUsingCustomKey) {
      let mlUsed = 0;
      if (tokensUsed > 0) {
        // Try to get separate input/output token counts for precise mL calculation
        try {
          const parsed = JSON.parse(raw);
          const inputTk =
            parsed?.usage?.prompt_tokens ||
            parsed?.usageMetadata?.promptTokenCount ||
            0;
          const outputTk =
            parsed?.usage?.completion_tokens ||
            parsed?.usageMetadata?.candidatesTokenCount ||
            0;
          if (inputTk > 0 || outputTk > 0) {
            mlUsed = calculateMlUsed(inputTk, outputTk, effectiveModel);
          } else {
            // Fallback: assume 20% input, 80% output split
            mlUsed = calculateMlUsed(
              Math.floor(tokensUsed * 0.2),
              Math.floor(tokensUsed * 0.8),
              effectiveModel,
            );
          }
        } catch {
          mlUsed = calculateMlUsed(
            Math.floor(tokensUsed * 0.2),
            Math.floor(tokensUsed * 0.8),
            effectiveModel,
          );
        }
      } else {
        // Fallback estimation if tokens not returned (approx 1 token per 4 chars)
        const estimatedInput = Math.ceil((prompt?.length || 0) / 4);
        const estimatedOutput = Math.ceil(raw.length / 4);
        mlUsed = calculateMlUsed(
          estimatedInput,
          estimatedOutput,
          effectiveModel,
        );
      }
      await trackMlUsage(ownerUserId, mlUsed);
    }

    if (isMultiScript) {
      let scripts = structuredFinal!.scripts!;

      // ── ENFORCE PLAYTEST FOR AUTO-FIX ──
      // If this is an auto-fix attempt, ensure run_playtest is at the end
      const isAutoFix = prompt.includes("[AUTO-FIX attempt");
      if (isAutoFix && !scripts.some(s => s.action === "run_playtest")) {
        scripts.push({ action: "run_playtest" } as any);
      }

      // ── AUTO-DEPLOY MULTI-FILE LIBRARY ──
      const treeStr = body.tree || "";
      const libraryAlreadyExists = treeStr.includes("AppleJuiceUI");
      if (isUIRelatedPrompt(prompt) && !libraryAlreadyExists) {
        const libScripts = getUILibraryDeploymentScripts();
        if (libScripts.length > 0) {
          const libEntries = libScripts.map(ls => ({
            action: ls.action,
            type: ls.type || "ModuleScript",
            parent: ls.parent,
            name: ls.name,
            code: ls.code || "",
            className: ls.className,
            instanceName: ls.instanceName,
          }));
          scripts = [...libEntries, ...scripts];
        }
      }

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
        scripts: scriptResults.map((s) => ({
          action: s.action,
          type: s.type,
          parent: s.parent,
          name: s.name,
          code: s.code,
          assetId: (s as any).assetId,
        })),
      });
      await upsertGeneratedCode(sessionKey, pluginPayload, messageId, autoSync);

      const finalMessage =
        structuredFinal?.message ??
        `I've created ${scripts.length} scripts for you: ${scriptResults.filter(s => s.action !== "run_playtest").map((s) => s.name).join(", ")}.`;
      const finalSuggestions = structuredFinal?.suggestions ?? [
        "Test all scripts together",
        "Add error handling",
        "Create a configuration module",
      ];
      const thinking =
        (structuredFinal as any)?.thinking ||
        (typeof preambleReasoning === "string" ? preambleReasoning : undefined);

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
    const finalName =
      structuredFinal?.name ?? `GeneratedScript_${messageId.slice(0, 8)}`;
    const finalCode = structuredFinal?.code ?? code;
    const finalType = structuredFinal?.type ?? "Script";
    const finalMessage =
      structuredFinal?.message ??
      (isDelete
        ? `I've removed the script called "${finalName}" from ${finalParent}.`
        : `I've created a ${finalType} called "${finalName}" and placed it in ${finalParent}. The script is ready to sync to your Studio.`);
    const finalSuggestions = structuredFinal?.suggestions ?? [
      "Add error handling and logging",
      "Create a configuration module",
      "Build a matching client-side script",
    ];
    const lineCount = finalCode ? finalCode.split("\n").length : 0;
    const thinking =
      (structuredFinal as any)?.thinking ||
      (typeof preambleReasoning === "string" ? preambleReasoning : undefined);

    const pluginPayload = JSON.stringify({
      action: isDelete ? "delete" : structuredFinal?.action || "create",
      type: finalType,
      parent: finalParent,
      name: finalName,
      code: finalCode,
      assetId: structuredFinal?.assetId,
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
      action: isDelete ? "delete" : structuredFinal?.action || "create",
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
