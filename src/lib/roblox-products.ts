/**
 * Single source of truth for every purchasable Roblox product and what it
 * grants. Shared by the in-game webhook (/api/webhooks/roblox) and the browser-
 * extension purchase relay (/api/extension/purchase) so both paths grant
 * identically and there's one place to add/retune products.
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

export function findProduct(id: string | number | undefined | null): RobloxProduct | undefined {
  if (id === undefined || id === null) return undefined;
  const key = id.toString();
  return ROBLOX_PRODUCTS.find((p) => p.id === key);
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
