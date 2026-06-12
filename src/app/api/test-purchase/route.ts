import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  setUserPlan,
  setUserSubscription,
  getUserPlan,
  type UserPlan,
} from "@/lib/store";
import { subscriptionProducts } from "@/lib/roblox-products";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/test-purchase   (DEV / STAGING ONLY)
 *
 * Simulates a completed Roblox subscription purchase end-to-end so you can test
 * the post-purchase app behaviour (plan gating, dashboard state, usage limits,
 * the verify UI) WITHOUT spending Robux. It applies the EXACT same grant the
 * real paths apply:
 *   • setUserPlan(plan)             — same as /api/webhooks/roblox
 *   • setUserSubscription({...})    — same as /api/verify-subscription
 *
 * Hard safety gate: this route is a no-op (404) unless ENABLE_TEST_PURCHASE=1
 * is set in the environment. Leave it UNSET in production so there is no cheap
 * path to a paid plan. It also requires a signed-in session — it only ever
 * grants to the caller's own account.
 *
 * Body (all optional): { plan?: "fresh_pro" | "pure_ultra", willRenew?: boolean }
 * Defaults to "pure_ultra".
 */
export async function POST(req: Request) {
  if (process.env.ENABLE_TEST_PURCHASE !== "1") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  let plan: UserPlan = "pure_ultra";
  let willRenew = true;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.plan === "fresh_pro" || body?.plan === "pure_ultra") {
      plan = body.plan;
    }
    if (typeof body?.willRenew === "boolean") willRenew = body.willRenew;
  } catch {
    /* use defaults */
  }

  // Resolve the matching subscription product so the stored subscription looks
  // exactly like a real one (correct productId for the chosen plan).
  const product =
    subscriptionProducts().find((p) => p.plan === plan) ?? null;

  await setUserPlan(userId, plan);
  await setUserSubscription(userId, {
    productId: product?.id ?? `EXP-TEST-${plan}`,
    plan,
    lastVerifiedAt: Date.now(),
    willRenew,
    simulated: true,
  });

  const current = await getUserPlan(userId);
  return Response.json({
    success: true,
    simulated: true,
    userId,
    plan: current,
    productId: product?.id ?? `EXP-TEST-${plan}`,
    message: `Simulated ${product?.label ?? plan} subscription — plan is now ${current}.`,
  });
}
