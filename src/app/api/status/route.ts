import { getSession, consumeLogs } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionKey = url.searchParams.get("key")?.trim() ?? "";
  
  if (!sessionKey) {
    return Response.json({ error: "Missing session key" }, { status: 400 });
  }

  try {
    const session = await getSession(sessionKey);
    if (!session) return Response.json({ status: "not_found" }, { status: 404 });
    
    // Check if there are logs
    let logs: string[] = [];
    if (session.logs && session.logs.length > 0) {
      const consumed = await consumeLogs(sessionKey);
      if (consumed.ok && consumed.logs) {
        logs = consumed.logs;
      }
    }

    return Response.json({
      status: "ok",
      hasNewCode: session.hasNewCode,
      lastPollTime: session.lastPollTime || 0,
      serverTime: Date.now(),
      logs: logs
    });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
