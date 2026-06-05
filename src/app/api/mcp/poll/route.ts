import { getResult } from "@/lib/mcp-bridge";

export const dynamic = "force-dynamic";

/**
 * GET /api/mcp/poll?key=SESSION&requestId=ID   (called by the MCP server)
 * Auth: Bearer AJ_BRIDGE_SECRET
 *
 * Returns { result } when the plugin has completed the command, else { result: null }.
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

  try {
    const result = await getResult(sessionKey, requestId);
    return Response.json({ result: result ?? null });
  } catch (err) {
    console.error("/api/mcp/poll error", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
