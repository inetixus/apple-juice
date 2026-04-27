import { upsertGeneratedCode } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { sessionKey, payload } = await req.json();
    
    if (!sessionKey || !payload) {
      return Response.json({ error: "Missing sessionKey or payload" }, { status: 400 });
    }

    const codePayload = JSON.stringify({ ...payload, isManual: true });
    const messageId = `insert-${Date.now()}`;
    
    const result = await upsertGeneratedCode(sessionKey, codePayload, messageId, true);
    
    if (!result) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Insert instance error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
