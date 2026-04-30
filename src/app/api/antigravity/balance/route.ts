/**
 * GET /api/antigravity/balance
 *
 * Returns the current user's Antigravity credit balance.
 * Results are cached in Redis for 60 seconds to avoid
 * hammering the upstream API.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAntigravityMapping,
  checkAntigravityBalance,
} from "@/lib/antigravity";

export async function GET() {
  // 1. Verify authentication
  const session = await getServerSession(authOptions);
  const email = (session?.user as { email?: string } | undefined)?.email;

  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Look up Antigravity mapping
  const mapping = await getAntigravityMapping(email);

  if (!mapping) {
    return Response.json(
      {
        error: "account_not_linked",
        message: "Your Google account is not linked to an Antigravity account. Go to Settings to connect.",
      },
      { status: 403 }
    );
  }

  // 3. Fetch balance (uses Redis cache)
  const accessToken = (session as { accessToken?: string })?.accessToken;
  const balance = await checkAntigravityBalance(email, mapping, accessToken);

  return Response.json({
    quotas: balance.quotas,
    cached: Date.now() - balance.checkedAt < 5000 ? false : true,
  });
}
