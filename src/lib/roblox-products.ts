/**
 * Single source of truth for every purchasable Roblox product and what it
 * grants. Shared by the in-game webhook (/api/webhooks/roblox) and the
 * subscription verify flow (/api/verify-subscription) so grants stay consistent
 * and there's one place to add/retune products.
 */

import { setUserPlan, grantBonusMl, type UserPlan } from "@/lib/store";

export type RobloxProductKind = "subscription" | "gamepass" | "developerProduct";

export interface RobloxProduct {
  /** The id as it appears in the purchase flow / webhook. */
  id: string;
  kind: RobloxProductKind;
  /** Human label for logs + UI. */
  label: string;
  /** Plan to grant (for subscription products), if any. */
  plan?: UserPlan;
  /** Bonus mL to grant (for refill dev products), if any. */
  bonusMl?: number;
}

/**
 * NOTE on ids:
 * - Subscriptions use Roblox's "EXP-..." subscription ids.
 * - Dev products / gamepasses use numeric ids.
 * Keep these in sync with the Creator Hub configuration.
 */
export const ROBLOX_PRODUCTS: RobloxProduct[] = [
  // ── Plans (subscriptions) ──
  {
    id: "EXP-6181762863565242936",
    kind: "subscription",
    label: "Fresh Pro",
    plan: "fresh_pro",
  },
  {
    id: "EXP-2786378855714259452",
    kind: "subscription",
    label: "Pure Ultra",
    plan: "pure_ultra",
  },

  // ── Instant refills (developer products) ──
  { id: "3585012060", kind: "developerProduct", label: "Small Sip", bonusMl: 5_000 },
  { id: "3585218786", kind: "developerProduct", label: "Juice Box", bonusMl: 20_000 },
  { id: "3585218944", kind: "developerProduct", label: "Mega Jug", bonusMl: 80_000 },
];

/**
 * Optional test subscription product, configured via env so it never ships
 * hard-coded. Set TEST_SUBSCRIPTION_ID to an "EXP-..." id (and optionally
 * TEST_SUBSCRIPTION_PLAN, default fresh_pro) to let yourself verify the full
 * purchase→verify→grant flow with a cheap sub WITHOUT exposing a cheap path to
 * a real plan in production (just leave the env unset in prod).
 */
function testSubscriptionProduct(): RobloxProduct | null {
  const id = (process.env.TEST_SUBSCRIPTION_ID || "").trim();
  if (!id) return null;
  const plan = ((process.env.TEST_SUBSCRIPTION_PLAN || "fresh_pro").trim() as UserPlan);
  return { id, kind: "subscription", label: "Test Subscription", plan };
}

export function findProduct(id: string | number | undefined | null): RobloxProduct | undefined {
  if (id === undefined || id === null) return undefined;
  const key = id.toString();
  const test = testSubscriptionProduct();
  if (test && test.id === key) return test;
  return ROBLOX_PRODUCTS.find((p) => p.id === key);
}

/** All subscription products, highest plan first (so we grant the best owned). */
export function subscriptionProducts(): RobloxProduct[] {
  const rank: Record<string, number> = {
    free: 0,
    partner: 1,
    fresh_pro: 2,
    pure_ultra: 3,
  };
  const list = [...ROBLOX_PRODUCTS];
  const test = testSubscriptionProduct();
  if (test) list.push(test);
  return list
    .filter((p) => p.kind === "subscription")
    .sort((a, b) => (rank[b.plan || "free"] || 0) - (rank[a.plan || "free"] || 0));
}

/**
 * Apply a product's grant to a user. Returns a human-readable result message.
 * Pure side-effect on the store; callers handle auth, verification, and replay
 * guarding BEFORE calling this.
 */
export async function applyProductGrant(
  userId: string,
  product: RobloxProduct,
): Promise<string> {
  if (product.plan) {
    await setUserPlan(userId, product.plan);
    return `Granted ${product.label} plan.`;
  }
  if (product.bonusMl && product.bonusMl > 0) {
    await grantBonusMl(userId, product.bonusMl);
    return `Granted ${product.label} (+${product.bonusMl.toLocaleString()} mL).`;
  }
  return "No grant configured for this product.";
}
