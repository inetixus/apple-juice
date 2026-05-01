import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { prompt, provider, apiKey, openaiKey } = await req.json();
    if (!prompt) return Response.json({ error: "Prompt is required" }, { status: 400 });

    const systemOpenAIKey = process.env.OPENAI_API_KEY || "";
    const systemGoogleKey = process.env.GOOGLE_API_KEY || "";
    
    const clientKey = (provider === "google" || provider === "google_vertex") ? (apiKey || "") : (openaiKey || apiKey || "");

    // CRITICAL: Prevent JSON leakage into OpenAI headers
    if (clientKey && clientKey.trim().startsWith("{") && (provider === "openai" || provider === "google")) {
      return Response.json({ enhancedPrompt: prompt }); 
    }

    const isUsingCustomKey = !!clientKey && clientKey !== systemOpenAIKey && clientKey !== systemGoogleKey;
    
    let effectiveProvider = provider;
    if (!isUsingCustomKey && provider !== "google_vertex") effectiveProvider = "google";

    const finalGoogleKey = (effectiveProvider === "google" && clientKey) ? clientKey : systemGoogleKey;
    const finalOpenAIKey = (effectiveProvider === "openai" && clientKey) ? clientKey : systemOpenAIKey;

    if (effectiveProvider === "google_vertex") {
      return Response.json({ enhancedPrompt: prompt });
    }

    const SYSTEM_PROMPT = `You are an elite Roblox Software Architect and Prompt Engineer specializing in production-grade systems.
The user has provided a short or vague request for a Roblox Studio system, script, or UI.
Your job is to REWRITE their prompt into a HIGHLY DETAILED, PROFESSIONAL specification optimized for an AI code generator that outputs JSON with Roblox instances and scripts.

RULES FOR YOUR REWRITTEN PROMPT:
1. ARCHITECTURE: Always specify multi-script architecture — ServerScript for logic, ModuleScript for shared data/config, LocalScript for client UI/input. Specify exact parent locations (ServerScriptService, ReplicatedStorage, StarterGui, etc.).
2. UI REQUIREMENTS (if the request involves any GUI/UI/HUD/menu):
   - Specify dark mode aesthetic (BackgroundColor3 = Color3.fromRGB(10,12,16)) with neon accent colors
   - Demand glassmorphism (BackgroundTransparency 0.1-0.2, UIStroke borders)
   - Require TweenService animations for ALL transitions: open/close (scale + fade), hover effects on every button (color shift + slight scale), click feedback (scale bounce), slide-in for items
   - Require UICorner (12px) on all frames/buttons, UIPadding (12px) on all containers, UIListLayout/UIGridLayout for child arrangement
   - Require a close button with tween-close animation
   - Specify exact sizing: main frame ~40-50% screen width, headers 50px, buttons 44px tall, etc.
   - Require AnchorPoint(0.5,0.5) + Position fromScale(0.5,0.5) for centering
   - Require sound effects on click/hover interactions
   - Require notification/toast system for user feedback
   - If it has tabs, require a sliding indicator bar and crossfade between content panels
   - If it has scrollable content, require ScrollingFrame with AutomaticCanvasSize, thin scrollbar, and staggered item entrance animations
   - Demand the LocalScript be 200-1000+ lines with COMPLETE interaction logic, NOT minimal stubs
3. GAME SYSTEMS: For combat, rounds, shops, pets, etc. — specify server validation, RemoteEvent flow, DataStore persistence, error handling with pcall, anti-exploit checks, and clean disconnect/cleanup patterns.
4. PERFORMANCE: Specify game:GetService(), task.wait()/task.spawn(), event-driven patterns (no while true do), instance pooling where applicable.
5. Be VERY specific about what instances to create, what properties to set, and what the code should do step-by-step.

Do NOT write code. ONLY output the rewritten, improved prompt as plain text. No conversational text. No quotes. No markdown formatting.`;

    let improvedPrompt = prompt;

    if (effectiveProvider === "google") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${encodeURIComponent(finalGoogleKey)}`;
      const llmRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
        }),
      });
      if (llmRes.ok) {
        const bodyText = await llmRes.text();
        const parsed = JSON.parse(bodyText);
        improvedPrompt = parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || prompt;
      }
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${finalOpenAIKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.5,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
        }),
      });
      if (res.ok) {
        const parsed = await res.json();
        improvedPrompt = parsed?.choices?.[0]?.message?.content?.trim() || prompt;
      }
    }

    return Response.json({ enhancedPrompt: improvedPrompt });
  } catch (error) {
    return Response.json({ error: "Failed to enhance prompt" }, { status: 500 });
  }
}
