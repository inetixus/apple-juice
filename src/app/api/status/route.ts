import { getSession, consumeLogs } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  
  if (!code) {
    return Response.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    const session = await getSession(code);
    if (!session) return Response.json({ status: "not_found" }, { status: 404 });
    
    // Check if there are logs
    let logs: string[] = [];
    if (session.logs && session.logs.length > 0) {
      const consumed = await consumeLogs(code);
      if (consumed.ok && consumed.logs) {
        logs = consumed.logs;
      }
    }

    return Response.json({
      status: "ok",
      hasNewCode: session.hasNewCode,
      lastPollTime: session.lastPollTime || 0,
      logs: logs
    });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
