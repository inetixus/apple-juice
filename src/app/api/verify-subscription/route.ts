import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  setUserPlan,
  getUserPlan,
  setUserSubscription,
  getUserSubscription,
  clearUserSubscription,
  checkRateLimit,
  extractIp,
} from "@/lib/store";
import { subscriptionProducts } from "@/lib/roblox-products";
import { userHasActiveSubscription } from "@/lib/roblox-verify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/verify-subscription
 *
 * The clean, official subscription flow (no extension / screenshots / cookies):
 *   1. User buys a subscription on roblox.com (Roblox is the payment processor).
 *   2. They click "I subscribed — verify" (or this runs on dashboard load).
 *   3. We ask the Open Cloud subscription API whether THIS user (their
 *      authenticated Roblox userId) has any of our subscription products active.
 *   4. Active  -> grant the matching plan + remember the subscription.
 *      Inactive -> if they previously had a verified sub that's now lapsed,
 *      downgrade them to free.
 *
 * Authoritative and forge-proof: the userId is the session's Roblox id and the
 * check is server-to-server with our Open Cloud key.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const provider = (session?.user as { provider?: string } | undefined)?.provider;
  if (!userId) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (provider && provider !== "roblox") {
    return Response.json(
      { error: "Sign in with Roblox to verify a subscription." },
      { status: 403 },
    );
  }

  // Light rate limit — this hits Roblox, so cap per user/IP.
  const ip = extractIp(req);
  const ipLimit = await checkRateLimit("verify-sub-ip", ip, 30, 60 * 10);
  if (!ipLimit.allowed) {
    return Response.json({ error: "Too many checks. Try again shortly." }, { status: 429 });
  }
  const userLimit = await checkRateLimit("verify-sub-user", userId, 20, 60 * 10);
  if (!userLimit.allowed) {
    return Response.json({ error: "Too many checks. Try again shortly." }, { status: 429 });
  }

  // Check each subscription product (best plan first); grant the first active one.
  const products = subscriptionProducts();
  for (const product of products) {
    const result = await userHasActiveSubscription(userId, product.id);
    if (result.ok && product.plan) {
      await setUserPlan(userId, product.plan);
      await setUserSubscription(userId, {
        productId: product.id,
        plan: product.plan,
        lastVerifiedAt: Date.now(),
        willRenew: true,
      });
      return Response.json({
        success: true,
        active: true,
        plan: product.plan,
        message: `Verified! Your ${product.label} subscription is active.`,
      });
    }
  }

  // No active subscription found. If they previously had one (now lapsed),
  // downgrade them to free so a cancelled sub doesn't keep premium forever.
  const existing = await getUserSubscription(userId);
  if (existing) {
    const currentPlan = await getUserPlan(userId);
    if (currentPlan !== "free") {
      await setUserPlan(userId, "free");
    }
    await clearUserSubscription(userId);
    return Response.json({
      success: true,
      active: false,
      plan: "free",
      message: "Your subscription is no longer active. Plan set to Free.",
    });
  }

  return Response.json({
    success: true,
    active: false,
    message: "No active subscription found for your account yet. If you just subscribed, wait a moment and try again.",
  });
}
