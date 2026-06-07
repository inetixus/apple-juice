import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  checkRateLimit,
  extractIp,
  hasRedeemed,
  markRedeemed,
} from "@/lib/store";
import { findProduct, applyProductGrant } from "@/lib/roblox-products";
import { userOwnsGamepass, userHasActiveSubscription } from "@/lib/roblox-verify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/extension/purchase   (called by the Apple Juice browser extension)
 *
 * The extension runs on roblox.com and DETECTS a purchase the user just made
 * through Roblox's own flow (it does not make the purchase). It then reports
 * { productId } here so we can grant the plan/refill.
 *
 * TRUST MODEL — the extension is public, untrusted code:
 *   1. The grant target is NOT taken from the extension. It's the Roblox userId
 *      from the user's authenticated NextAuth session (they sign in with Roblox,
 *      so session.user.id === their Roblox userId). A forged call can only ever
 *      affect the caller's own account.
 *   2. We INDEPENDENTLY re-verify the purchase with Roblox before granting:
 *        - gamepass     → ownership check
 *        - subscription → Open Cloud active-subscription check
 *      If we can't positively confirm, we refuse (fail closed).
 *   3. Dev-product refills CANNOT be verified after the fact (Roblox exposes no
 *      ownership API for one-shot receipts), so they are NOT accepted here —
 *      they must flow through the authoritative in-game ProcessReceipt webhook.
 *   4. Subscriptions are replay-guarded per user so a single active sub can't be
 *      re-relayed to stack grants.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const provider = (session?.user as { provider?: string } | undefined)?.provider;

  if (!userId) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  // The userId must be a Roblox id for verification to mean anything.
  if (provider && provider !== "roblox") {
    return Response.json(
      { error: "Sign in with Roblox to use extension purchases." },
      { status: 403 },
    );
  }

  // Rate limit by IP + user so the relay can't be hammered.
  const ip = extractIp(req);
  const ipLimit = await checkRateLimit("ext-purchase-ip", ip, 30, 60 * 60);
  if (!ipLimit.allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }
  const userLimit = await checkRateLimit("ext-purchase-user", userId, 30, 60 * 60);
  if (!userLimit.allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: { productId?: string | number };
  try {
    body = (await req.json()) as { productId?: string | number };
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const product = findProduct(body.productId);
  if (!product) {
    return Response.json({ error: "Unknown product" }, { status: 400 });
  }

  // ── Verify with Roblox (fail closed) ──
  if (product.kind === "gamepass") {
    const v = await userOwnsGamepass(userId, product.id);
    if (!v.ok) {
      return Response.json(
        {
          error: "verification_failed",
          message: v.reason || "Could not confirm this purchase with Roblox.",
        },
        { status: 402 },
      );
    }
  } else if (product.kind === "subscription") {
    const v = await userHasActiveSubscription(userId, product.id);
    if (!v.ok) {
      return Response.json(
        {
          error: "verification_failed",
          message: v.reason || "Could not confirm an active subscription with Roblox.",
        },
        { status: 402 },
      );
    }
    // Replay guard: an active subscription should only grant once per relay.
    // (The plan stays until the subscription lapses; this just stops repeated
    // relays of the same active sub from doing anything weird.)
    const replayKey = `ext-sub:${product.id}`;
    if (await hasRedeemed(userId, replayKey)) {
      return Response.json({
        success: true,
        alreadyApplied: true,
        message: `${product.label} is already active on your account.`,
      });
    }
    await markRedeemed(userId, replayKey);
  } else {
    // developerProduct (refills) — not verifiable after the fact.
    return Response.json(
      {
        error: "unverifiable_product",
        message:
          "Refill purchases are granted in-game automatically and can't be claimed via the extension.",
      },
      { status: 422 },
    );
  }

  const message = await applyProductGrant(userId, product);
  return Response.json({ success: true, message });
}
