import { upsertGeneratedCode, getSession, checkRateLimit, extractIp } from "@/lib/store";
import { validateInstancePayload } from "@/lib/validate-instance-payload";

export async function POST(req: Request) {
  try {
    const { sessionKey, payload } = await req.json();

    if (!sessionKey || !payload) {
      return Response.json(
        { error: "Missing sessionKey or payload" },
        { status: 400 },
      );
    }

    if (typeof sessionKey !== "string" || sessionKey.length > 128) {
      return Response.json({ error: "Invalid sessionKey" }, { status: 400 });
    }

    // Rate limit per IP first (cheap, blocks blind spraying before any DB read).
    const ip = extractIp(req);
    const ipLimit = await checkRateLimit("insert-ip", ip, 120, 60);
    if (!ipLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Slow down." },
        { status: 429 },
      );
    }

    // The sessionKey is a bearer token — require a real, unexpired session.
    const session = await getSession(sessionKey);
    if (!session || Date.now() > session.expiresAt) {
      return Response.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    // Per-session rate limit (defends a leaked key from being abused at scale).
    const sessionLimit = await checkRateLimit("insert-session", sessionKey, 60, 60);
    if (!sessionLimit.allowed) {
      return Response.json(
        { error: "Session rate limit exceeded." },
        { status: 429 },
      );
    }

    // Validate the payload against the strict action allowlist.
    const validation = validateInstancePayload(payload);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const codePayload = JSON.stringify({ ...validation.payload, isManual: true });
    const messageId = `insert-${Date.now()}`;

    const result = await upsertGeneratedCode(
      sessionKey,
      codePayload,
      messageId,
      true,
    );

    if (!result) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Insert instance error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
