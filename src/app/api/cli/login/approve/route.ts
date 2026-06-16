import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrReplaceSession, getRedis } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/cli/login/approve   Body: { deviceCode }
 *
 * Called by the in-browser /cli-login page AFTER the user has authenticated
 * with Roblox (NextAuth). Binds the pending device login to the real user and
 * mints a long-lived CLI session key tied to that user's account, so the CLI's
 * generations bill against their subscription/credits.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const username =
    (session?.user as { name?: string } | undefined)?.name ?? "Roblox User";

  let deviceCode = "";
  try {
    const body = await req.json();
    deviceCode = String(body.deviceCode ?? "").trim();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!deviceCode) {
    return Response.json({ error: "Missing deviceCode" }, { status: 400 });
  }

  const redis = getRedis();
  const key = `apple-juice:cli-login:${deviceCode}`;
  const raw = await redis.get<string>(key);
  if (!raw) {
    return Response.json({ error: "Login request expired or invalid" }, { status: 404 });
  }

  // Mint a CLI session bound to the authenticated user.
  const sessionKey = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
  await createOrReplaceSession({
    sessionKey,
    ownerUserId: userId,
    clientIp: "cli",
    expiresAt,
    hasNewCode: false,
    code: "",
    messageId: "",
    dashboardLastPingTime: Date.now(),
  });

  await redis.set(
    key,
    JSON.stringify({
      status: "approved",
      sessionKey,
      userId,
      username,
      approvedAt: Date.now(),
    }),
    { ex: 600 },
  );

  return Response.json({ ok: true });
}
