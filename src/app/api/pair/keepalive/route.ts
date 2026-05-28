import { updateSession } from "@/lib/store";

/**
 * POST /api/pair/keepalive
 *
 * Called every ~10 seconds by the CLI to keep dashboardLastPingTime fresh.
 * Without this the Roblox plugin will disconnect after 20 seconds.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { sessionKey } = (await req.json()) as { sessionKey?: string };
    if (!sessionKey)
      return Response.json({ error: "Missing sessionKey" }, { status: 400 });

    await updateSession(sessionKey, {
      dashboardLastPingTime: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
