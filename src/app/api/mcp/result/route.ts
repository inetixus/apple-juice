import { getSession } from "@/lib/store";
import { submitResult, type BridgeResult } from "@/lib/mcp-bridge";

export const dynamic = "force-dynamic";

/**
 * POST /api/mcp/result
 * Body: { key, requestId, ok, data?, error? }
 *
 * The Studio plugin posts the result of an executed MCP command here. The
 * agent's MCP server is polling getResult() for the matching requestId.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessionKey = String(body.key ?? "").trim();
    const requestId = String(body.requestId ?? "").trim();
    if (!sessionKey || !requestId) {
      return Response.json({ error: "Missing key or requestId" }, { status: 400 });
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
