import { NextRequest } from "next/server";
import { acceptPendingCode } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const { sessionKey } = await req.json();
    if (!sessionKey) return Response.json({ error: "Missing sessionKey" }, { status: 400 });

    const updated = await acceptPendingCode(sessionKey);
    if (!updated) {
      return Response.json({ error: "Session not found or failed" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
