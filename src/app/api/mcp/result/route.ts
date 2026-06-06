import { getSession, checkRateLimit, extractIp } from "@/lib/store";
import { submitResult, type BridgeResult } from "@/lib/mcp-bridge";

export const dynamic = "force-dynamic";

// Hard cap on the result payload a plugin can post back. The agent trusts this
// data, so bound it to avoid memory/KV abuse from a forged or buggy poster.
const MAX_RESULT_BYTES = 256 * 1024; // 256 KB

/**
 * POST /api/mcp/result
 * Body: { key, requestId, ok, data?, error? }
 *
 * The Studio plugin posts the result of an executed MCP command here. The
 * agent's MCP server is polling getResult() for the matching requestId.
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_RESULT_BYTES) {
      return Response.json({ error: "Result too large" }, { status: 413 });
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const sessionKey = String(body.key ?? "").trim();
    const requestId = String(body.requestId ?? "").trim();
    if (!sessionKey || !requestId) {
      return Response.json({ error: "Missing key or requestId" }, { status: 400 });
    }

    // Rate limit by IP and by session so a guessed/leaked session key can't be
    // used to flood the result store. Session keys are short and shareable, so
    // they're not a strong credential on their own.
    const ip = extractIp(req);
    const ipLimit = await checkRateLimit("mcp-result-ip", ip, 120, 60);
    if (!ipLimit.allowed) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    const sessLimit = await checkRateLimit("mcp-result-session", sessionKey, 120, 60);
    if (!sessLimit.allowed) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const session = await getSession(sessionKey);
    if (!session || Date.now() > session.expiresAt) {
      return Response.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    const result: BridgeResult = {
      requestId,
      ok: body.ok !== false,
      data: body.data,
      error: typeof body.error === "string" ? body.error : undefined,
      completedAt: Date.now(),
    };
    await submitResult(sessionKey, result);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("/api/mcp/result error", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
