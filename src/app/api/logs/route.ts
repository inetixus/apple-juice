import { appendLogs } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, token, logs } = body;

    if (!code || !token || !logs || !Array.isArray(logs)) {
      return Response.json({ error: "Missing or invalid code, token, or logs" }, { status: 400 });
    }

    const result = await appendLogs(code, token, logs);
    if (!result.ok) {
      if (result.reason === "not_found") return Response.json({ error: "Session not found" }, { status: 404 });
      if (result.reason === "bad_token") return Response.json({ error: "Invalid token" }, { status: 401 });
      return Response.json({ error: "Failed to append logs" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("/api/logs error", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
