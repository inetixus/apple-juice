import {
  getSession,
  consumeLogs,
  getRedis,
  updateSession,
  extractIp,
  ipKeyFor,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionKey = url.searchParams.get("key")?.trim() ?? "";

  if (!sessionKey) {
    return Response.json({ error: "Missing session key" }, { status: 400 });
  }

  try {
    const session = await getSession(sessionKey);
    if (!session)
      return Response.json({ status: "not_found" }, { status: 404 });

    // Check if there are logs
    let logs: string[] = [];
    if (session.logs && session.logs.length > 0) {
      const consumed = await consumeLogs(sessionKey);
      if (consumed.ok && consumed.logs) {
        logs = consumed.logs;
      }
    }

    const model = url.searchParams.get("model")?.trim() ?? "";
    const provider = url.searchParams.get("provider")?.trim() ?? "";
    const openaiKey = url.searchParams.get("openaiKey")?.trim() ?? "";
    const googleKey = url.searchParams.get("googleKey")?.trim() ?? "";
    const mode = url.searchParams.get("mode")?.trim() ?? "";

    // Ping dashboard presence, refresh expiry, and sync configuration
    const updates: Record<string, any> = {
      dashboardLastPingTime: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60,
    };
    if (model) updates.model = model;
    if (provider) updates.provider = provider;
    if (openaiKey) updates.openaiKey = openaiKey;
    if (googleKey) updates.googleKey = googleKey;
    if (mode) updates.mode = mode;

    await updateSession(sessionKey, updates);

    const redis = getRedis();
    const clientIp = extractIp(req);
    if (clientIp && clientIp !== "unknown") {
      // Force IP to point to the active project session
      await redis.set(ipKeyFor(clientIp), sessionKey, { ex: 3600 });
    }

    const tree = await redis.get(`tree:${sessionKey}`);

    // If there's a file response, we should probably consume it too so it doesn't keep showing up
    // but for now let's just send it.

    const pendingIps = await redis.smembers("apple-juice:pending-ips");

    return Response.json({
      status: "ok",
      hasNewCode: session.hasNewCode,
      lastPollTime: session.lastPollTime || 0,
      serverTime: Date.now(),
      logs: logs,
      tree: tree || "",
      fileResponse: session.fileResponse,
      pendingIps: pendingIps || [],
    });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
