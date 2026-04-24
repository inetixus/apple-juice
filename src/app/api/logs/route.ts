import { appendLogs } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { key, logs } = body;

    if (!key || !logs || !Array.isArray(logs)) {
      return Response.json({ error: "Missing or invalid key or logs" }, { status: 400 });
    }

    const result = await appendLogs(key, logs);
    if (!result.ok) {
      if (result.reason === "not_found") return Response.json({ error: "Session not found" }, { status: 404 });
      return Response.json({ error: "Failed to append logs" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("/api/logs error", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
