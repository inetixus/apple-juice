type ModelsBody = {
  apiKey?: string;
  provider?: string;
};

import { KIRO_MODEL_LABELS } from "@/lib/kiro-models";
import { getByokProvider } from "@/lib/byok-providers";

const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"];
const GOOGLE_FALLBACK_MODELS = [
  "models/gemini-3.1-pro",
  "models/gemini-3-flash",
  "models/gemini-3.1-flash-lite",
  "models/gemini-2.5-pro",
  "models/gemini-2.5-flash",
  "models/text-bison-001",
];

// Shared-credit pool runs on the Kiro lineup.
const KIRO_MODELS_LIST = KIRO_MODEL_LABELS;

const OPENCODE_MODELS = [
  "big-pickle",
  "minimax-m2.5-free",
  "nemotron-3-super-free",
];

export async function POST(request: Request) {
  const body = (await request.json()) as ModelsBody;
  const apiKey = body.apiKey?.trim() || "";
  const provider = (body.provider || "openai").toString();

  if (!apiKey && provider === "google" && !process.env.GOOGLE_API_KEY) {
    return Response.json({ error: "apiKey is required" }, { status: 400 });
  }

  const effectiveApiKey =
    apiKey ||
    (provider === "google"
      ? process.env.GOOGLE_API_KEY
      : process.env.OPENAI_API_KEY) ||
    "";

  if (provider === "apple_juice_ai" || provider === "kiro") {
    return Response.json({ models: KIRO_MODELS_LIST });
  }

  if (provider === "opencode") {
    return Response.json({ models: OPENCODE_MODELS });
  }

  // ── Generic BYOK providers ──────────────────────────────────────────────
  // For any registered BYOK provider that isn't OpenAI/Google (handled with a
  // live fetch below), return the curated default model list. A live model
  // listing isn't uniformly available/cheap across providers, and the test-key
  // endpoint already validates the key, so curated defaults are the right UX.
  const byok = getByokProvider(provider);
  if (
    byok &&
    provider !== "openai" &&
    provider !== "google"
  ) {
    // OpenRouter does expose a public model list — try it, fall back to curated.
    if (provider === "openrouter") {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/models", {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          signal: AbortSignal.timeout(10000),
        });
        if (r.ok) {
          const j = await r.json();
          const ids = (j?.data || [])
            .map((m: any) => m?.id)
            .filter((id: any): id is string => typeof id === "string")
            .sort();
          if (ids.length) return Response.json({ models: ids });
        }
      } catch {
        /* fall back to curated */
      }
    }
    return Response.json({ models: byok.defaultModels });
  }

  if (provider === "google") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta2/models?key=${encodeURIComponent(
        effectiveApiKey,
      )}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const detail = await response.text();
        return Response.json(
          {
            error: "Failed to load models from Google",
            detail,
            models: GOOGLE_FALLBACK_MODELS,
          },
          { status: 502 },
        );
      }

      const payload = await response.json();
      const rawModels = (payload?.models || []) as Array<any>;
      const models = rawModels
        .map((m) => m?.name || m?.model || m?.id || "")
        .filter((id) => !!id)
        .sort();

      return Response.json({
        models: models.length > 0 ? models : GOOGLE_FALLBACK_MODELS,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return Response.json(
        {
          error: "Failed to load models from Google",
          detail,
          models: GOOGLE_FALLBACK_MODELS,
        },
        { status: 502 },
      );
    }
  }

  // Default: OpenAI
  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${effectiveApiKey}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      {
        error: "Failed to load models from provider",
        detail,
        models: FALLBACK_MODELS,
      },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };

  const models = (payload.data || [])
    .map((entry) => entry.id || "")
    .filter((id) => id.startsWith("gpt-"))
    .sort((a, b) => a.localeCompare(b));

  return Response.json({
    models: models.length > 0 ? models : FALLBACK_MODELS,
  });
}
