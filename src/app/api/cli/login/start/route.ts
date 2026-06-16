import crypto from "crypto";
import { getRedis } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/cli/login/start
 *
 * Begins a CLI device-authorization login (like `gh auth login`). The CLI calls
 * this, gets a one-time deviceCode + a verify URL, opens that URL in the user's
 * browser, and then polls /api/cli/login/poll. The browser page authenticates
 * the user with Roblox (existing NextAuth) and approves the device, binding the
 * CLI session to the user's REAL Roblox account — so their subscription/credits
 * apply to CLI usage.
 */
export async function POST() {
  const deviceCode = crypto.randomBytes(32).toString("hex");
  const base = process.env.NEXTAUTH_URL || "https://apple-juice.online";

  // Pending record, short-lived. 10 minutes to complete the browser flow.
  await getRedis().set(
    `apple-juice:cli-login:${deviceCode}`,
    JSON.stringify({ status: "pending", createdAt: Date.now() }),
    { ex: 600 },
  );

  return Response.json({
    deviceCode,
    verifyUrl: `${base}/cli-login?d=${deviceCode}`,
    pollIntervalMs: 2000,
    expiresInSec: 600,
  });
}
