import { getSession } from "@/lib/store";
import { enqueueCommand } from "@/lib/mcp-bridge";

export const dynamic = "force-dynamic";

/**
 * POST /api/mcp/enqueue   (called by the MCP server on the VPS)
 * Auth: Bearer AJ_BRIDGE_SECRET
 * Body: { key, tool, args }
 *
 * Enqueues a Studio command for the plugin to execute. Returns { requestId }.
 */

const STUDIO_TOOLS = new Set([
  "studio_get_tree",
  "studio_read_script",
  "studio_write_script",
  "studio_create_instance",
  "studio_delete",
  "studio_rename",
  "studio_move",
  "studio_run_playtest",
  "studio_get_logs",
]);

export async function POST(req: Request) {
  // Authorize the MCP server via shared secret.
  const secret = process.env.AJ_BRIDGE_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const sessionKey = String(body.key ?? "").trim();
    const tool = String(body.tool ?? "").trim();
    const args = (body.args && typeof body.args === "object") ? body.args : {};

    if (!sessionKey || !tool) {
      return Response.json({ error: "Missing key or tool" }, { status: 400 });
    }
    if (!STUDIO_TOOLS.has(tool)) {
      return Response.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    const session = await getSession(sessionKey);
    if (!session || Date.now() > session.expiresAt) {
      return Response.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    const requestId = await enqueueCommand(sessionKey, tool, args);
    return Response.json({ requestId });
  } catch (err) {
    console.error("/api/mcp/enqueue error", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
