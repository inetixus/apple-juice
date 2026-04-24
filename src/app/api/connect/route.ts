import { findSessionKeyByIp, extractIp } from "@/lib/store";

/**
 * GET /api/connect
 * 
 * Called by the Roblox plugin with NO parameters.
 * The server reads the plugin's IP from the request headers,
 * looks up the session created from the same IP (the dashboard),
 * and returns the sessionKey for auto-pairing.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const clientIp = extractIp(req);

  if (!clientIp || clientIp === "unknown") {
    return Response.json(
      { connected: false, error: "Could not determine your IP address." },
      { status: 400 }
    );
  }

  try {
    const sessionKey = await findSessionKeyByIp(clientIp);

    if (!sessionKey) {
      return Response.json(
        { connected: false, error: "No active dashboard session found for your IP. Make sure the dashboard is open.", ip: clientIp },
        { status: 404 }
      );
    }

    return Response.json({ connected: true, sessionKey, ip: clientIp });
  } catch (err) {
    console.error("/api/connect error", err instanceof Error ? err.message : String(err));
    return Response.json(
      { connected: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
