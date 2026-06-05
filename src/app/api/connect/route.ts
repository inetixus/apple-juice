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
  // Cloudflare presence => real deployment. Don't fabricate throwaway sessions
  // there: doing so makes the plugin falsely report "connected" against a
  // session the dashboard never created.
  const isProd = !!(req.headers.get("cf-connecting-ip") || req.headers.get("true-client-ip"));

  try {
    // Attempt to find an existing session for this IP
    const sessionKey = await findSessionKeyByIp(clientIp);

    if (sessionKey) {
      return Response.json({ connected: true, sessionKey, ip: clientIp });
    }

    // No dashboard session for this IP.
    if (isProd) {
      return Response.json({
        connected: false,
        ip: clientIp,
        error:
          "No active dashboard found for your network. Open the Apple Juice dashboard in your browser first, then click Connect — or paste the pairing key shown in the dashboard.",
      });
    }

    // Local dev convenience only: fabricate a temporary session.
    const tempKey = crypto.randomBytes(4).toString("hex").toUpperCase();
    const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour
    await createOrReplaceSession({
      sessionKey: tempKey,
      ownerUserId: "dev-local",
      clientIp,
      expiresAt,
      hasNewCode: false,
      code: "",
      messageId: "",
      dashboardLastPingTime: Date.now(),
    });
    return Response.json({ connected: true, sessionKey: tempKey, ip: clientIp });
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
