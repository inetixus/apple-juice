import { consumeCode } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionKey = url.searchParams.get("key")?.trim() ?? "";

  if (!sessionKey) {
    return Response.json({ paired: false, error: "Missing session key" }, { status: 400 });
  }

  try {
    const result = await consumeCode(sessionKey);

    if (!result.ok) {
      if (result.reason === "not_found") return Response.json({ paired: false }, { status: 404 });
      if (result.reason === "expired") return Response.json({ paired: false, error: "expired" }, { status: 410 });
    }

    // Ensure code is always a string for the plugin — Upstash can auto-parse
    // the nested JSON payload into an object, but the plugin expects a raw JSON string.
    const codeValue = result.payload.code;
    const codeStr = typeof codeValue === "string" ? codeValue : JSON.stringify(codeValue);

    // Enforce dashboard connection: If the dashboard hasn't pinged in 20 seconds, disconnect.
    const lastPing = result.payload.dashboardLastPingTime || 0;
    if (Date.now() - lastPing > 20000) {
      return Response.json({ paired: false, error: "Dashboard disconnected (close app or refresh tab)." });
    }

    return Response.json({
      paired: true,
      hasNewCode: result.payload.hasNewCode,
      code: codeStr,
      messageId: result.payload.messageId,
      requestedFile: result.payload.requestedFile,
    });
  } catch (err) {
    console.error("/api/poll error", err instanceof Error ? err.message : String(err));
    return Response.json({ paired: false, error: "Internal server error" }, { status: 500 });
  }
}