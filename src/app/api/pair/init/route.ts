import crypto from "crypto";
import { createOrReplaceSession, getRedis } from "@/lib/store";

/**
 * POST /api/pair/init
 *
 * Called by the CLI (aj.exe) to register a new pairing session.
 * The CLI generates a 6-char auth code and a stable cliUserId (UUID stored on disk).
 * The plugin then connects using this auth code via /api/connect (manual key flow).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { authCode, cliUserId } = body as {
      authCode?: string;
      cliUserId?: string;
    };

    if (!authCode || authCode.length < 4) {
      return Response.json({ error: "Invalid authCode" }, { status: 400 });
    }

    const ownerUserId = cliUserId
      ? `cli-user-${cliUserId}`
      : `cli-user-${crypto.randomBytes(8).toString("hex")}`;

    // Generate a secure 128-bit sessionKey. The authCode is only used temporarily
    // for the plugin to establish connection and fetch this sessionKey.
    const sessionKey = crypto.randomBytes(16).toString("hex");
    
    // Store authCode -> sessionKey mapping for 10 minutes so manual connect works
    await getRedis().set(`apple-juice:auth-code:${authCode.toUpperCase()}`, sessionKey, { ex: 600 });
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24; // 24 hours

    await createOrReplaceSession({
      sessionKey,
      ownerUserId,
      clientIp: "cli",
      expiresAt,
      hasNewCode: false,
      code: "",
      messageId: "",
      dashboardLastPingTime: Date.now(),
    });

    return Response.json({ ok: true, sessionKey, ownerUserId });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    console.error("/api/pair/init error", details);
    return Response.json(
      { error: "Internal server error", details },
      { status: 500 },
    );
  }
}
