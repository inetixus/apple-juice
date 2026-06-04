import { NextRequest } from "next/server";
import { upsertGeneratedCode, getSession, checkRateLimit, extractIp } from "@/lib/store";
import { validateInstancePayload } from "@/lib/validate-instance-payload";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { sessionKey, scripts } = await req.json();
    if (!sessionKey || !scripts) {
      return Response.json(
        { error: "Missing sessionKey or scripts" },
        { status: 400 },
      );
    }

    if (typeof sessionKey !== "string" || sessionKey.length > 128) {
      return Response.json({ error: "Invalid sessionKey" }, { status: 400 });
    }
    if (!Array.isArray(scripts) || scripts.length === 0 || scripts.length > 50) {
      return Response.json({ error: "Invalid scripts payload" }, { status: 400 });
    }

    const ip = extractIp(req);
    const ipLimit = await checkRateLimit("revert-ip", ip, 60, 60);
    if (!ipLimit.allowed) {
      return Response.json({ error: "Too many requests." }, { status: 429 });
    }

    const session = await getSession(sessionKey);
    if (!session || Date.now() > session.expiresAt) {
      return Response.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    // Validate every script entry against the action allowlist.
    for (const s of scripts) {
      const v = validateInstancePayload(s);
      if (!v.ok) {
        return Response.json({ error: `Invalid script: ${v.error}` }, { status: 400 });
      }
    }

    const payload = JSON.stringify({ scripts });
    const messageId = crypto.randomUUID();

    const updated = await upsertGeneratedCode(
      sessionKey,
      payload,
      messageId,
      true,
    );
    if (!updated) {
      return Response.json(
        { error: "Session not found or failed" },
        { status: 404 },
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("revert-code error", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
