import { getSession, checkRateLimit, extractIp } from "@/lib/store";
import { dequeueCommand } from "@/lib/mcp-bridge";

export const dynamic = "force-dynamic";

/**
 * GET /api/mcp/next?key=SESSION
 *
 * The Studio plugin long-polls this to fetch the next MCP command queued by
 * the agent's MCP server. Returns { command } or { command: null }.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionKey = url.searchParams.get("key")?.trim() ?? "";
  if (!sessionKey) {
    return Response.json({ error: "Missing session key" }, { status: 400 });
  }

  // Rate limit by IP and session. This route hands out queued commands (which
  // can contain script source), and session keys are short/shareable, so cap
  // how fast a single caller can drain a queue. Generous to allow long-polling.
  const ip = extractIp(req);
  const ipLimit = await checkRateLimit("mcp-next-ip", ip, 240, 60);
  if (!ipLimit.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  const sessLimit = await checkRateLimit("mcp-next-session", sessionKey, 240, 60);
  if (!sessLimit.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getSession(sessionKey);
  if (!session || Date.now() > session.expiresAt) {
    return Response.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  try {
    const command = await dequeueCommand(sessionKey);
    return Response.json({ command: command ?? null });
  } catch (err) {
    console.error("/api/mcp/next error", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
