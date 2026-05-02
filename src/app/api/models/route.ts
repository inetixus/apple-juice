type ModelsBody = {
  apiKey?: string;
  provider?: string;
};

const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"];
const GOOGLE_FALLBACK_MODELS = [
  "models/gemini-3.1-pro",
  "models/gemini-3-flash",
  "models/gemini-3.1-flash-lite",
  "models/gemini-2.5-pro",
  "models/gemini-2.5-flash",
  "models/text-bison-001",
];

const ANTIGRAVITY_MODELS = [
  "Gemini 2.0 Flash",
  "Gemini 1.5 Pro",
  "Gemini 1.5 Flash",
  "Gemini 2.0 Flash Lite (Preview)",
];

export async function POST(request: Request) {
  const body = (await request.json()) as ModelsBody;
  const apiKey = body.apiKey?.trim() || "";
  const provider = (body.provider || "openai").toString();

  if (!apiKey && provider === "google" && !process.env.GOOGLE_API_KEY) {
    return Response.json({ error: "apiKey is required" }, { status: 400 });
  }

  const effectiveApiKey = apiKey || (provider === "google" ? process.env.GOOGLE_API_KEY : process.env.OPENAI_API_KEY) || "";

  if (provider === "apple_juice_ai") {
    return Response.json({ models: ANTIGRAVITY_MODELS });
  }

  if (provider === "google") {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta2/models?key=${encodeURIComponent(
        effectiveApiKey,
      )}`;
      const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
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

      return Response.json({ models: models.length > 0 ? models : GOOGLE_FALLBACK_MODELS });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return Response.json({ error: "Failed to load models from Google", detail, models: GOOGLE_FALLBACK_MODELS }, { status: 502 });
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

  return Response.json({ models: models.length > 0 ? models : FALLBACK_MODELS });
}