import { getRedis } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/cli/login/poll?d=DEVICE_CODE
 *
 * The CLI polls this after opening the browser login page. Returns
 * { status: "pending" } until the user approves in the browser, then
 * { status: "approved", sessionKey, userId, username } ONCE. The device code is
 * consumed on first successful read so the session key can't be re-fetched.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceCode = url.searchParams.get("d")?.trim() ?? "";
  if (!deviceCode) {
    return Response.json({ error: "Missing device code" }, { status: 400 });
  }

  const redis = getRedis();
  const key = `apple-juice:cli-login:${deviceCode}`;
  const raw = await redis.get<string>(key);
  if (!raw) {
    return Response.json({ status: "expired" });
  }

  let rec: { status?: string; sessionKey?: string; userId?: string; username?: string };
  try {
    rec = typeof raw === "string" ? JSON.parse(raw) : (raw as typeof rec);
  } catch {
    return Response.json({ status: "expired" });
  }

  if (rec.status !== "approved") {
    return Response.json({ status: "pending" });
  }

  // Approved: hand the session key to the CLI exactly once, then delete it.
  await redis.del(key);
  return Response.json({
    status: "approved",
    sessionKey: rec.sessionKey,
    userId: rec.userId,
    username: rec.username,
  });
}
