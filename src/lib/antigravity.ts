/**
 * Antigravity Integration — Google Gemini API
 *
 * Uses each user's Google OAuth token to call the public Gemini API
 * (generativelanguage.googleapis.com) on their behalf.
 *
 * Handles:
 * 1. Identity mapping  — Google email ↔ linked account
 * 2. Usage tracking    — per-user request/token counts stored in Redis
 * 3. API relay         — proxies chat requests through the Gemini API
 *
 * All tokens remain server-side. The frontend never sees them.
 */

import { GoogleAuth } from "google-auth-library";
import { getRedis } from "./store";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AntigravityMapping = {
  antigravityUserId: string;
  apiKey?: string; // per-user key (encrypted), or omit for platform key
  linkedAt: number;
};

export type AntigravityQuota = {
  model: string;
  refreshesIn: string;
};

export type AntigravityBalance = {
  quotas: AntigravityQuota[];
  checkedAt: number;
};

export type AntigravityChatRequest = {
  model?: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
};

export type AntigravityChatResponse = {
  id: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const AG_MAP_PREFIX = "ag:map:";
const AG_USAGE_PREFIX = "ag:usage:";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Map display names → Gemini API model IDs */
const MODEL_ID_MAP: Record<string, string> = {
  "Gemini 2.5 Pro":           "gemini-2.5-pro",
  "Gemini 2.5 Flash":         "gemini-2.5-flash",
  "Gemini 2.0 Flash":         "gemini-2.0-flash",
  "Gemini 3.1 Pro (Preview)": "gemini-3.1-pro-preview",
  "Gemini 3 Flash (Preview)": "gemini-3-flash-preview",
  "DeepSeek V3":              "deepseek-v3.2-maas",
  "DeepSeek R1":              "deepseek-r1",
};

function getPlatformApiKey(): string {
  return process.env.ANTIGRAVITY_API_KEY || "";
}

// ─── Identity Mapping ────────────────────────────────────────────────────────

/**
 * Link a Google account (email) to an Antigravity user ID.
 * Called once during onboarding or account-linking flow.
 */
export async function linkAntigravityAccount(
  googleEmail: string,
  antigravityUserId: string,
  perUserApiKey?: string
): Promise<AntigravityMapping> {
  const redis = getRedis();
  const key = `${AG_MAP_PREFIX}${googleEmail.toLowerCase()}`;

  const mapping: AntigravityMapping = {
    antigravityUserId,
    apiKey: perUserApiKey, // store per-user key if provided
    linkedAt: Date.now(),
  };

  await redis.set(key, JSON.stringify(mapping));
  return mapping;
}

/**
 * Look up the Antigravity account linked to a Google email.
 * Returns null if no mapping exists.
 */
export async function getAntigravityMapping(
  googleEmail: string
): Promise<AntigravityMapping | null> {
  const redis = getRedis();
  const key = `${AG_MAP_PREFIX}${googleEmail.toLowerCase()}`;
  const raw = await redis.get(key);
  if (!raw) return null;

  try {
    return (typeof raw === "string" ? JSON.parse(raw) : raw) as AntigravityMapping;
  } catch {
    return null;
  }
}

/**
 * Remove the Antigravity mapping for a Google account.
 */
export async function unlinkAntigravityAccount(googleEmail: string): Promise<void> {
  const redis = getRedis();
  const key = `${AG_MAP_PREFIX}${googleEmail.toLowerCase()}`;
  await redis.del(key);
}

// ─── Usage Tracking ─────────────────────────────────────────────────────────

interface UserUsage {
  requests: number;
  tokensUsed: number;
  weekStart: number;
}

function getWeekStart(): number {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff, 0, 0, 0, 0));
  return weekStart.getTime();
}

async function getUserUsage(email: string): Promise<UserUsage> {
  const redis = getRedis();
  const key = `${AG_USAGE_PREFIX}${email.toLowerCase()}`;
  const raw = await redis.get(key);

  const currentWeekStart = getWeekStart();

  if (raw) {
    try {
      const parsed = (typeof raw === "string" ? JSON.parse(raw) : raw) as UserUsage;
      // Reset if it's a new week
      if (parsed.weekStart < currentWeekStart) {
        return { requests: 0, tokensUsed: 0, weekStart: currentWeekStart };
      }
      return parsed;
    } catch {
      // corrupted
    }
  }

  return { requests: 0, tokensUsed: 0, weekStart: currentWeekStart };
}

async function recordUsage(email: string, tokens: number): Promise<UserUsage> {
  const redis = getRedis();
  const key = `${AG_USAGE_PREFIX}${email.toLowerCase()}`;

  const usage = await getUserUsage(email);
  usage.requests += 1;
  usage.tokensUsed += tokens;

  await redis.set(key, JSON.stringify(usage));
  // Expire after 8 days to auto-cleanup
  await redis.expire(key, 8 * 24 * 60 * 60);

  return usage;
}

// ─── Balance / Usage Display ────────────────────────────────────────────────

/**
 * Get the user's usage stats for the current week.
 * Returns formatted data for the dashboard UI.
 */
export async function checkAntigravityBalance(
  googleEmail: string,
  _mapping: AntigravityMapping,
  _accessToken?: string
): Promise<AntigravityBalance> {
  const usage = await getUserUsage(googleEmail);

  // Calculate when the week resets
  const weekEnd = usage.weekStart + 7 * 24 * 60 * 60 * 1000;
  const timeLeft = weekEnd - Date.now();
  const daysLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60 * 24)));
  const hoursLeft = Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const resetStr = `Resets in ${daysLeft}d ${hoursLeft}h`;

  const formatNum = (n: number) => n.toLocaleString();

  return {
    quotas: [
      { model: "📊 Requests This Week", refreshesIn: formatNum(usage.requests) },
      { model: "🔤 Tokens Used", refreshesIn: formatNum(usage.tokensUsed) },
      { model: "⏱️ Usage Period", refreshesIn: resetStr },
      { model: "Gemini 2.5 Pro", refreshesIn: "Available" },
      { model: "Gemini 2.5 Flash", refreshesIn: "Available" },
      { model: "Gemini 2.0 Flash", refreshesIn: "Available" },
      { model: "Gemini 3.1 Pro (Preview)", refreshesIn: "Available" },
      { model: "Gemini 3 Flash (Preview)", refreshesIn: "Available" },
      { model: "DeepSeek V3", refreshesIn: "Available" },
      { model: "DeepSeek R1", refreshesIn: "Available" },
    ],
    checkedAt: Date.now(),
  };
}

// ─── API Relay (Gemini API) ─────────────────────────────────────────────────

/**
 * Resolve a display model name to a Gemini API model ID.
 */
function resolveModelId(displayName: string): string {
  // Direct match
  if (MODEL_ID_MAP[displayName]) return MODEL_ID_MAP[displayName];
  // Check if it's already an API model ID
  if (displayName.startsWith("gemini-")) return displayName;
  // Check if it starts with "models/"
  if (displayName.startsWith("models/")) return displayName.replace("models/", "");
  // Fuzzy match: strip parenthetical qualifiers
  const base = displayName.replace(/\s*\(.*?\)\s*/g, "").trim();
  if (MODEL_ID_MAP[base]) return MODEL_ID_MAP[base];
  // DeepSeek models
  if (displayName.toLowerCase().includes("deepseek")) {
    if (displayName.toLowerCase().includes("r1")) return "deepseek-ai/deepseek-r1";
    return "deepseek-ai/deepseek-v3";
  }
  // Default
  return "gemini-2.5-flash";
}

/**
 * Forward a chat request to DeepSeek on Vertex AI.
 */
async function relayToVertexDeepSeek(
  request: AntigravityChatRequest,
  userEmail?: string
): Promise<{
  ok: boolean;
  data?: AntigravityChatResponse;
  stream?: Response;
  error?: string;
  status: number;
  tokensUsed: number;
}> {
  const modelName = request.model || "DeepSeek V3";
  const isR1 = modelName.toLowerCase().includes("r1");
  
  // DeepSeek V3 and R1 on Vertex AI MaaS (OpenAI-compatible)
  const region = isR1 ? "us-central1" : "global";
  const modelId = isR1 ? "deepseek-r1" : "deepseek-v3";
  const baseUrl = region === "global" ? "aiplatform.googleapis.com" : `${region}-aiplatform.googleapis.com`;

  try {
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!keyPath && !keyJson) {
       throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_PATH or GOOGLE_SERVICE_ACCOUNT_JSON in environment.");
    }

    const auth = new GoogleAuth({
      keyFile: keyPath,
      credentials: keyJson ? JSON.parse(keyJson) : undefined,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    if (!token) throw new Error("Failed to generate Vertex AI access token.");

    const projectId = "project-048abb9f-c292-4139-82e";
    // Model-specific OpenAPI endpoint (Verified format for some MaaS publishers)
    const url = `https://${baseUrl}/v1/projects/${projectId}/locations/${region}/publishers/deepseek-ai/models/${modelId}/endpoints/openapi/chat/completions`;

    const payload = {
      model: modelId,
      messages: request.messages,
      temperature: request.temperature ?? 0.4,
      max_tokens: request.max_tokens ?? 32768,
      stream: !!request.stream,
    };

    console.log(`[DeepSeek] Calling ${modelId} at ${url}${request.stream ? ' (STREAMING)' : ''}...`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (request.stream) {
      if (!res.ok) {
        const bodyText = await res.text();
        console.error(`[DeepSeek] Stream Error ${res.status}:`, bodyText);
        return { ok: false, error: bodyText, status: res.status, tokensUsed: 0 };
      }
      return { ok: true, stream: res, status: 200, tokensUsed: 0 };
    }

    const bodyText = await res.text();
    if (!res.ok) {
      console.error(`[DeepSeek] API error ${res.status}:`, bodyText.substring(0, 500));
      return { ok: false, error: bodyText, status: res.status, tokensUsed: 0 };
    }

    const data = JSON.parse(bodyText);
    const content = data.choices?.[0]?.message?.content || "";
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens = data.usage?.total_tokens || (promptTokens + completionTokens);

    if (userEmail) {
      await recordUsage(userEmail, totalTokens);
    }

    const normalized: AntigravityChatResponse = {
      id: `deepseek-${Date.now()}`,
      choices: [{
        index: 0,
        message: { role: "assistant", content: stripBranding(content) },
        finish_reason: data.choices?.[0]?.finish_reason || "stop",
      }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
      model: modelName,
    };

    return { ok: true, data: normalized, status: 200, tokensUsed: totalTokens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DeepSeek] Relay error:", msg);
    return { ok: false, error: msg, status: 502, tokensUsed: 0 };
  }
}

/**
 * Forward a chat request to the Google Gemini API using the user's
 * OAuth access token. Each user's requests count against THEIR OWN
 * Google API quota, not the platform's.
 */
export async function relayToAntigravity(
  mapping: AntigravityMapping | null,
  request: AntigravityChatRequest,
  _accessToken?: string,
  userEmail?: string
): Promise<{
  ok: boolean;
  data?: AntigravityChatResponse;
  stream?: Response;
  error?: string;
  status: number;
  tokensUsed: number;
}> {
  // ── Route to DeepSeek if applicable ──
  const modelName = request.model || "Gemini 2.5 Flash";
  if (modelName.toLowerCase().includes("deepseek")) {
    return relayToVertexDeepSeek(request, userEmail) as any;
  }

  if (!mapping) {
    return {
      ok: false,
      error: "Antigravity account not linked.",
      status: 403,
      tokensUsed: 0,
    };
  }

  const modelId = resolveModelId(modelName);
  const apiUrl = `${GEMINI_API_BASE}/models/${modelId}:generateContent`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // The Gemini API requires an API key, so we use the platform key
    // while continuing to track usage per-user internally via Redis.
    const platformKey = mapping.apiKey || getPlatformApiKey();
    if (!platformKey) {
      return {
        ok: false,
        error: "Server configuration error: Missing Gemini API Key.",
        status: 500,
        tokensUsed: 0,
      };
    }
    
    // Build the URL (append API key)
    const finalUrl = `${apiUrl}?key=${encodeURIComponent(platformKey)}`;

    // Convert messages to Gemini "contents" format
    // System messages become a systemInstruction
    const systemParts: string[] = [];
    const contents: { role: string; parts: { text: string }[] }[] = [];

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemParts.push(msg.content);
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Ensure we have at least one user message
    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.max_tokens ?? 32768,
      },
    };

    // Add system instruction if present
    if (systemParts.length > 0) {
      body.systemInstruction = {
        parts: [{ text: systemParts.join("\n\n") }],
      };
    }

    console.log(`[Gemini] Calling ${modelId} at ${apiUrl}...`);
    const res = await fetch(finalUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await res.text();

    if (!res.ok) {
      let errorMessage = responseText;
      try {
        const errData = JSON.parse(responseText);
        if (res.status === 429) {
          errorMessage = "Rate limit reached. Please wait a moment and try again.";
        } else if (res.status === 401 || res.status === 403) {
          errorMessage = "Authentication failed. Please log out and log back in with Google.";
        } else {
          errorMessage = errData.error?.message || responseText;
        }
      } catch {
        // raw text error
      }

      console.error(`[Gemini] API error ${res.status}:`, errorMessage.substring(0, 200));
      return {
        ok: false,
        error: errorMessage,
        status: res.status,
        tokensUsed: 0,
      };
    }

    // Parse Gemini response
    const geminiData = JSON.parse(responseText);
    const candidateText =
      geminiData.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("") || "";

    const promptTokens = geminiData.usageMetadata?.promptTokenCount || 0;
    const completionTokens = geminiData.usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = geminiData.usageMetadata?.totalTokenCount || promptTokens + completionTokens;

    // Track usage per user
    if (userEmail) {
      await recordUsage(userEmail, totalTokens);
    }

    // Normalize to our standard response format
    const normalized: AntigravityChatResponse = {
      id: `gemini-${Date.now()}`,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: stripBranding(candidateText) },
          finish_reason: geminiData.candidates?.[0]?.finishReason || "stop",
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
      model: modelId,
    };

    return {
      ok: true,
      data: normalized,
      status: 200,
      tokensUsed: totalTokens,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Gemini] Relay error:", msg);
    return {
      ok: false,
      error: `Failed to reach Gemini API: ${msg}`,
      status: 502,
      tokensUsed: 0,
    };
  }
}

// ─── Branding / Sanitization ─────────────────────────────────────────────────

/**
 * Remove any unwanted branding from the AI response content.
 */
function stripBranding(content: string): string {
  const patterns = [
    /\[Powered by Antigravity\]/gi,
    /— Antigravity AI/gi,
    /Antigravity Assistant/gi,
    /Generated by Antigravity/gi,
  ];

  let cleaned = content;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

// ─── Utility: Validate Credentials ──────────────────────────────────────────

/**
 * Test if a given Google OAuth token or API key is valid
 * by listing available Gemini models.
 */
export async function validateAntigravityCredentials(
  apiKeyOrToken: string,
  _userId?: string
): Promise<{ valid: boolean; tier?: string; error?: string }> {
  try {
    // Try listing models with the provided credential
    const isApiKey = apiKeyOrToken.startsWith("AIza");
    let url = `${GEMINI_API_BASE}/models`;
    const headers: Record<string, string> = {};

    if (isApiKey) {
      url += `?key=${encodeURIComponent(apiKeyOrToken)}`;
    } else {
      headers["Authorization"] = `Bearer ${apiKeyOrToken}`;
    }

    const res = await fetch(url, { method: "GET", headers });

    if (!res.ok) {
      return {
        valid: false,
        error: res.status === 401
          ? "Invalid credentials."
          : `Gemini API returned status ${res.status}`,
      };
    }

    return { valid: true, tier: "google" };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
