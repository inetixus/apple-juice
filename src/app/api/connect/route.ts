import { findSessionKeyByIp, extractIp, createOrReplaceSession } from "@/lib/store";
import crypto from "crypto";

/**
 * GET /api/connect
 *
 * Called by the Roblox plugin with no parameters.
 * Reads the plugin's IP, looks up an existing session, and returns the sessionKey.
 * If no session exists (e.g., during local development), a temporary session is created.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const clientIpRaw = extractIp(req);
  const clientIp = clientIpRaw && clientIpRaw !== "unknown" ? clientIpRaw : "localhost";

  try {
    // Attempt to find an existing session for this IP
    let sessionKey = await findSessionKeyByIp(clientIp);

    // If none exists, create a temporary session (useful for local dev)
    if (!sessionKey) {
      sessionKey = crypto.randomBytes(4).toString("hex").toUpperCase();
      const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour
      await createOrReplaceSession({
        sessionKey,
        ownerUserId: "dev-local",
        clientIp,
        expiresAt,
        hasNewCode: false,
        code: "",
        messageId: "",
        dashboardLastPingTime: Date.now(),
      });
    }

    return Response.json({ connected: true, sessionKey, ip: clientIp });
  } catch (err) {
    console.error(
      "/api/connect error",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json(
      { connected: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
