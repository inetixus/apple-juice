import {
  getByokProvider,
  endpointForProvider,
  extraHeadersForProvider,
} from "@/lib/byok-providers";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type TestKeyBody = {
  provider?: string;
  apiKey?: string;
  model?: string;
};

/**
 * POST /api/test-key
 * Body: { provider, apiKey, model? }
 *
 * Validates a pasted BYOK key by making the smallest possible real call to the
 * provider, so the user finds out a key is bad BEFORE burning a generation turn.
 * Returns { ok: true } on success, or { ok: false, error } with a friendly
 * reason. The key is used only for this request and never stored server-side.
 */
export async function POST(req: Request) {
  let body: TestKeyBody;
  try {
    body = (await req.json()) as TestKeyBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const providerId = (body.provider || "").trim();
  const apiKey = (body.apiKey || "").trim();

  if (!apiKey) {
    return Response.json({ ok: false, error: "No API key provided." }, { status: 400 });
  }

  const provider = getByokProvider(providerId);
  if (!provider) {
    return Response.json({ ok: false, error: "Unknown provider." }, { status: 400 });
  }

  try {
    if (provider.id === "google") {
      return await testGoogle(apiKey);
    }
    return await testOpenAiCompatible(provider.id, apiKey, body.model);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { ok: false, error: `Couldn't reach ${provider.label}: ${detail}` },
      { status: 502 },
    );
  }
}

/** Validate a Google AI Studio key via the lightweight models list call. */
async function testGoogle(apiKey: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (res.ok) {
    return Response.json({ ok: true });
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return Response.json(
      { ok: false, error: "That Google AI Studio key was rejected. Double-check it and that the Generative Language API is enabled." },
      { status: 200 },
    );
  }
  const detail = await res.text().catch(() => "");
  return Response.json(
    { ok: false, error: `Google returned ${res.status}. ${detail.slice(0, 160)}` },
    { status: 200 },
  );
}

/**
 * Validate an OpenAI-compatible key with a 1-token chat completion. This is the
 * most reliable check (a key can list models but be out of quota), and 1 token
 * is effectively free.
 */
async function testOpenAiCompatible(
  providerId: string,
  apiKey: string,
  model?: string,
): Promise<Response> {
  const provider = getByokProvider(providerId)!;
  const endpoint = endpointForProvider(providerId);
  const testModel = (model || "").trim() || provider.defaultModel;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...extraHeadersForProvider(providerId),
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: testModel,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (res.ok) {
    return Response.json({ ok: true, model: testModel });
  }

  // Auth failures are the common, actionable case.
  if (res.status === 401 || res.status === 403) {
    return Response.json(
      { ok: false, error: `That ${provider.label} key was rejected (unauthorized). Check the key is active and has billing/credits.` },
      { status: 200 },
    );
  }

  // A 404/400 about the model means the KEY is valid but the test model isn't
  // available to this account — still a successful auth, so treat as OK.
  if (res.status === 404 || res.status === 400) {
    const detail = (await res.text().catch(() => "")).toLowerCase();
    if (detail.includes("model")) {
      return Response.json(
        { ok: true, model: testModel, note: "Key is valid; the default test model wasn't available, pick a model you have access to." },
        { status: 200 },
      );
    }
    return Response.json(
      { ok: false, error: `${provider.label} rejected the request (${res.status}).` },
      { status: 200 },
    );
  }

  if (res.status === 429) {
    return Response.json(
      { ok: false, error: `${provider.label} rate-limited the check (429). The key looks valid but is throttled or out of quota.` },
      { status: 200 },
    );
  }

  const detail = await res.text().catch(() => "");
  return Response.json(
    { ok: false, error: `${provider.label} returned ${res.status}. ${detail.slice(0, 160)}` },
    { status: 200 },
  );
}
