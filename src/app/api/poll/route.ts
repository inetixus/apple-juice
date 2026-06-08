import { consumeCode, updateSession, getRedis, getPollIntervalForUser } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionKey = url.searchParams.get("key")?.trim() ?? "";

  if (!sessionKey) {
    return Response.json(
      { paired: false, error: "Missing session key" },
      { status: 400 },
    );
  }

  const disconnect = url.searchParams.get("disconnect") === "true";
  if (disconnect) {
    try {
      await updateSession(sessionKey, { lastPollTime: 0 });
      return Response.json({ paired: false, message: "Disconnected successfully" });
    } catch (err) {
      console.error("/api/poll disconnect error", err);
      return Response.json(
        { paired: false, error: "Failed to disconnect" },
        { status: 500 },
      );
    }
  }

  try {
    const result = await consumeCode(sessionKey);

    if (!result.ok) {
      if (result.reason === "not_found")
        return Response.json({ paired: false }, { status: 404 });
      if (result.reason === "expired")
        return Response.json(
          { paired: false, error: "expired" },
          { status: 410 },
        );
    }

    // Ensure code is always a string for the plugin — Upstash can auto-parse
    // the nested JSON payload into an object, but the plugin expects a raw JSON string.
    const codeValue = result.payload.code;
    const codeStr =
      typeof codeValue === "string" ? codeValue : JSON.stringify(codeValue);

    // Enforce dashboard connection: if the dashboard hasn't pinged in a while,
    // report unpaired. Widened to 45s (from 20s) so a briefly backgrounded tab,
    // a slow heartbeat, or a transient network hiccup doesn't drop the plugin —
    // the plugin itself also tolerates a few consecutive unpaired responses now.
    const lastPing = result.payload.dashboardLastPingTime || 0;
    if (Date.now() - lastPing > 45000) {
      return Response.json({
        paired: false,
        error: "Dashboard disconnected (close app or refresh tab).",
      });
    }

    // Stage 2: if a snapshot was requested for this session, tell the plugin
    // to send one (and clear the one-shot flag so it only fires once).
    let requestSnapshot = false;
    try {
      const redis = getRedis();
      const flag = await redis.get<string>(`requestSnapshot:${sessionKey}`);
      if (flag) {
        requestSnapshot = true;
        await redis.del(`requestSnapshot:${sessionKey}`);
      }
    } catch {
      /* best-effort; snapshot will be retried on the next agent request */
    }

    // Plan-aware poll cadence: higher tiers poll faster so generated code +
    // MCP commands land in Studio with less latency. Advisory — the plugin
    // clamps to its own safe min/max.
    let pollInterval = 0.4;
    try {
      const ownerUserId = (result.payload as { ownerUserId?: string }).ownerUserId;
      if (ownerUserId) {
        pollInterval = await getPollIntervalForUser(ownerUserId);
      }
    } catch {
      /* fall back to default cadence */
    }

    return Response.json({
      paired: true,
      hasNewCode: result.payload.hasNewCode,
      code: codeStr,
      messageId: result.payload.messageId,
      requestedFile: result.payload.requestedFile,
      requestSnapshot,
      pollInterval,
    });
  } catch (err) {
    console.error(
      "/api/poll error",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json(
      { paired: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
