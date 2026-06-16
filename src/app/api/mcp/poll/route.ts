import { getResult, getResultWaiting } from "@/lib/mcp-bridge";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/mcp/poll?key=SESSION&requestId=ID[&wait=MS]   (called by the MCP server)
 * Auth: Bearer AJ_BRIDGE_SECRET
 *
 * Returns { result } when the plugin has completed the command, else { result: null }.
 * Optional `wait` (ms) holds the request open until the result lands (or the
 * bounded hold elapses), cutting result-delivery latency. Omitting it preserves
 * the original single-shot behavior.
 */
export async function GET(req: Request) {
  const secret = process.env.AJ_BRIDGE_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sessionKey = url.searchParams.get("key")?.trim() ?? "";
  const requestId = url.searchParams.get("requestId")?.trim() ?? "";
  if (!sessionKey || !requestId) {
    return Response.json({ error: "Missing key or requestId" }, { status: 400 });
  }

  const waitRaw = Number(url.searchParams.get("wait") ?? "0");
  const waitMs = Number.isFinite(waitRaw) ? Math.min(Math.max(0, waitRaw), 25_000) : 0;

  try {
    const result = waitMs > 0
      ? await getResultWaiting(sessionKey, requestId, waitMs)
      : await getResult(sessionKey, requestId);
    return Response.json({ result: result ?? null });
  } catch (err) {
    console.error("/api/mcp/poll error", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
