import { NextRequest } from "next/server";
import { upsertGeneratedCode } from "@/lib/store";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { sessionKey, scripts } = await req.json();
    if (!sessionKey || !scripts) {
      return Response.json({ error: "Missing sessionKey or scripts" }, { status: 400 });
    }

    const payload = JSON.stringify({ scripts });
    const messageId = crypto.randomUUID();

    const updated = await upsertGeneratedCode(sessionKey, payload, messageId, true);
    if (!updated) {
      return Response.json({ error: "Session not found or failed" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("revert-code error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
