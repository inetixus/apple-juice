/**
 * Antigravity API Client
 *
 * Handles:
 * 1. Identity mapping  — Google email ↔ Antigravity account
 * 2. Credit validation  — cached balance checks via /user/balance
 * 3. API relay          — proxies chat completions through Antigravity
 *
 * All API keys remain server-side. The frontend never sees them.
 */

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
const AG_BALANCE_PREFIX = "ag:balance:";
const BALANCE_CACHE_TTL = 60; // seconds

function getApiUrl(): string {
  return process.env.ANTIGRAVITY_API_URL || "https://api.antigravity.example.com";
}

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

// ─── Credit Validation ──────────────────────────────────────────────────────

/**
 * Resolve which API key to use for a given user.
 * Priority: per-user key → platform key.
 */
function resolveApiKey(mapping: AntigravityMapping | null): string {
  if (mapping?.apiKey) return mapping.apiKey;
  return getPlatformApiKey();
}

/**
 * Check the user's Antigravity credit balance.
 * Results are cached in Redis for BALANCE_CACHE_TTL seconds.
 */
export async function checkAntigravityBalance(
  googleEmail: string,
  mapping: AntigravityMapping,
  accessToken?: string
): Promise<AntigravityBalance> {
  const redis = getRedis();
  const cacheKey = `${AG_BALANCE_PREFIX}${googleEmail.toLowerCase()}`;

  // 1. Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      const parsed = (typeof cached === "string" ? JSON.parse(cached) : cached) as AntigravityBalance;
      // Only use cache if it's fresh
      if (Date.now() - parsed.checkedAt < BALANCE_CACHE_TTL * 1000) {
        return parsed;
      }
    } catch {
      // cache corrupted, fetch fresh
    }
  }

  // 2. Fetch from Antigravity API
  const apiKey = resolveApiKey(mapping);
  // We'll try both possible internal endpoints
  const endpoints = [
    "https://antigravity-pa.googleapis.com/v1internal:getUserStatus",
    "https://cloudcode-pa.googleapis.com/v1internal:getUserStatus"
  ];

  let lastError = "";

  for (const endpoint of endpoints) {
    try {
      const isGoogleKey = apiKey.startsWith("AIza");
      const headers: Record<string, string> = {
        "X-User-Id": mapping.antigravityUserId,
        "Content-Type": "application/json",
      };

      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      } else if (isGoogleKey) {
        headers["X-Goog-Api-Key"] = apiKey;
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      console.log(`[Antigravity] Trying status check at ${endpoint}...`);
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        lastError = await res.text();
        console.warn(`[Antigravity] Endpoint ${endpoint} failed:`, res.status, lastError);
        continue;
      }

      const data = await res.json();
      console.log(`[Antigravity] Successfully fetched status from ${endpoint}`);
      
      const quotas: AntigravityQuota[] = (data.modelQuotas || data.quotas || []).map((q: any) => ({
        model: q.modelName || q.displayName || q.id || q.name || "Unknown Model",
        refreshesIn: q.refreshTime ? formatRefreshTime(q.refreshTime) : "Available",
      }));

      const balance: AntigravityBalance = {
        quotas: quotas.length > 0 ? quotas : [
          { model: "Gemini 3.1 Pro (High)", refreshesIn: "Available" },
          { model: "Gemini 3.1 Pro (Low)", refreshesIn: "Available" },
          { model: "Gemini 3 Flash", refreshesIn: "Available" },
          { model: "Claude Sonnet 4.6 (Thinking)", refreshesIn: "Available" },
          { model: "Claude Opus 4.6 (Thinking)", refreshesIn: "Available" },
          { model: "GPT-OSS 120B (Medium)", refreshesIn: "Available" },
        ],
        checkedAt: Date.now(),
      };

      // 3. Cache and return
      await redis.set(cacheKey, JSON.stringify(balance));
      await redis.expire(cacheKey, BALANCE_CACHE_TTL);
      return balance;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[Antigravity] Error at ${endpoint}:`, lastError);
    }
  }

  // If we reach here, all endpoints failed
  console.error("[Antigravity] All status check endpoints failed. Last error:", lastError);
  return {
    quotas: [
      { model: "Gemini 3.1 Pro (High)", refreshesIn: accessToken ? "API Error" : "Log out/in required" },
      { model: "Gemini 3.1 Pro (Low)", refreshesIn: accessToken ? "API Error" : "Log out/in required" },
      { model: "Gemini 3 Flash", refreshesIn: accessToken ? "API Error" : "Log out/in required" },
      { model: "Claude Sonnet 4.6 (Thinking)", refreshesIn: accessToken ? "API Error" : "Log out/in required" },
      { model: "Claude Opus 4.6 (Thinking)", refreshesIn: accessToken ? "API Error" : "Log out/in required" },
      { model: "GPT-OSS 120B (Medium)", refreshesIn: accessToken ? "API Error" : "Log out/in required" },
    ],
    checkedAt: Date.now(),
  };
}

// ─── API Relay (Chat Completions Proxy) ──────────────────────────────────────

/**
 * Forward a chat completion request to the Antigravity API.
 *
 * This function:
 * - Attaches the correct API key (per-user or platform)
 * - Adds user identification headers
 * - Strips any Antigravity branding from the response
 * - Returns a normalized response for the Apple Juice frontend
 */
export async function relayToAntigravity(
  mapping: AntigravityMapping,
  request: AntigravityChatRequest,
  accessToken?: string
): Promise<{
  ok: boolean;
  data?: AntigravityChatResponse;
  error?: string;
  status: number;
  tokensUsed: number;
}> {
  const apiKey = resolveApiKey(mapping);
  // Real internal gateway
  const apiUrl = "https://cloudcode-pa.googleapis.com";

  try {
    const isGoogleKey = apiKey.startsWith("AIza");
    const headers: Record<string, string> = {
      "X-User-Id": mapping.antigravityUserId,
      "Content-Type": "application/json",
    };

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    } else if (isGoogleKey) {
      headers["X-Goog-Api-Key"] = apiKey;
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Call the internal v1internal:generateContent endpoint
    const res = await fetch(`${apiUrl}/v1internal:generateContent`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: request.model || "gemini-2.5-flash",
        contents: request.messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.max_tokens ?? 32768,
        },
      }),
    });

    const responseText = await res.text();

    if (!res.ok) {
      // Parse Antigravity error to determine type
      let errorMessage = responseText;

      try {
        const errData = JSON.parse(responseText);
        if (errData.error?.code === "insufficient_credits" || res.status === 402) {
          errorMessage = "You've run out of Antigravity credits. Top up your account to continue using AI features.";
        } else if (res.status === 429) {
          errorMessage = "Too many requests. Please wait a moment and try again.";
        } else if (res.status === 401) {
          errorMessage = "API configuration error. Please re-link your Antigravity account.";
        } else {
          errorMessage = errData.error?.message || responseText;
        }
      } catch {
        // raw text error, use as-is
      }

      return {
        ok: false,
        error: errorMessage,
        status: res.status,
        tokensUsed: 0,
      };
    }

    // Parse successful response
    const data = JSON.parse(responseText) as AntigravityChatResponse;
    const tokensUsed = data.usage?.total_tokens || 0;

    // Strip any Antigravity branding from the response content
    if (data.choices?.[0]?.message?.content) {
      data.choices[0].message.content = stripAntigravityBranding(
        data.choices[0].message.content
      );
    }

    return {
      ok: true,
      data,
      status: 200,
      tokensUsed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Antigravity relay error:", msg);
    return {
      ok: false,
      error: `Failed to reach Antigravity API: ${msg}`,
      status: 502,
      tokensUsed: 0,
    };
  }
}

// ─── Branding / Sanitization ─────────────────────────────────────────────────

/**
 * Remove any Antigravity-specific branding, watermarks, or
 * self-references from the AI response content.
 */
function stripAntigravityBranding(content: string): string {
  // Add patterns as needed based on what Antigravity injects
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

/**
 * Format internal timestamp into a human readable "X days, Y hours" string
 */
function formatRefreshTime(timestamp: string | number): string {
  const future = new Date(timestamp).getTime();
  const now = Date.now();
  const diff = future - now;

  if (diff <= 0) return "Refreshing now...";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `Refreshes in ${days} days, ${hours} hours`;
  return `Refreshes in ${hours} hours`;
}

// ─── Utility: Validate Antigravity Credentials ──────────────────────────────

/**
 * Test if a given API key and user ID are valid against Antigravity.
 * Used during the account-linking flow.
 */
export async function validateAntigravityCredentials(
  apiKeyOrToken: string,
  userId?: string
): Promise<{ valid: boolean; tier?: string; error?: string }> {
  const apiUrl = getApiUrl();

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKeyOrToken}`,
      "Content-Type": "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;

    const res = await fetch(`${apiUrl}/user/balance`, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      return {
        valid: false,
        error: res.status === 401
          ? "Invalid API key or credentials."
          : `Antigravity returned status ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      valid: true,
      tier: data.tier || data.plan || "free",
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
