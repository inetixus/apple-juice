type ModelsBody = {
  apiKey?: string;
};

const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"];

export async function POST(request: Request) {
  const body = (await request.json()) as ModelsBody;
  const apiKey = body.apiKey?.trim() || "";

  if (!apiKey) {
    return Response.json({ error: "apiKey is required" }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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