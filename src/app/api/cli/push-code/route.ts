import { NextRequest } from "next/server";
import { upsertGeneratedCode } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { sessionKey, name, type, parent, code } = await req.json();
    if (!sessionKey || !name || !code) {
      return Response.json({ error: "Missing required fields (sessionKey, name, code)" }, { status: 400 });
    }

    const pluginPayload = JSON.stringify({
      scripts: [{
        action: "create",
        type: type || "Script",
        parent: parent || "Workspace",
        name,
        code
      }]
    });

    const messageId = "cli-" + Math.random().toString(36).substring(2, 10);
    const result = await upsertGeneratedCode(sessionKey, pluginPayload, messageId, true);

    if (!result) {
      return Response.json({ error: "Failed to sync with Roblox Studio. Check your pairing status." }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return Response.json({ error: "Internal Server Error", details }, { status: 500 });
  }
}
