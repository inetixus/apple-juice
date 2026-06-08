/**
 * Server-side Roblox purchase verification.
 *
 * Used to confirm purchases with Roblox before granting anything, server-to-
 * server with our credentials (never trusting the client):
 *
 *   • Subscriptions→ verified via Open Cloud (needs ROBLOX_OPEN_CLOUD_KEY +
 *                    ROBLOX_UNIVERSE_ID). This is the PRIMARY plan flow: a user
 *                    subscribes on roblox.com, then /api/verify-subscription
 *                    confirms it here and grants the plan.
 *   • Gamepasses   → verifiable (inventory / game-passes API).
 *   • Dev products → NOT verifiable after the fact (Roblox exposes no ownership
 *                    check for one-shot dev-product receipts). These rely on the
 *                    in-game ProcessReceipt webhook, which is authoritative.
 *
 * Everything fails CLOSED: if we can't positively confirm ownership, we return
 * false and the caller refuses to grant.
 */

export type VerifyResult = {
  ok: boolean;
  /** True only when we positively confirmed via a Roblox API. */
  verified: boolean;
  reason?: string;
};

const FETCH_TIMEOUT_MS = 12_000;

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

/**
 * Verify a user owns a gamepass. Uses the documented game-passes endpoint and
 * falls back to the inventory endpoint. Returns verified=false on any doubt.
 */
export async function userOwnsGamepass(
  userId: string,
  gamepassId: string,
): Promise<VerifyResult> {
  // Primary: game-passes API (the one Roblox now points developers to).
  try {
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const url = new URL(
        `https://apis.roblox.com/game-passes/v1/users/${encodeURIComponent(userId)}/game-passes`,
      );
      url.searchParams.set("count", "100");
      if (cursor) url.searchParams.set("exclusiveStartId", cursor);

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: timeoutSignal(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) break;
      const data = (await res.json()) as {
        gamePasses?: Array<{ gamePassId?: number | string }>;
        nextPageCursor?: string;
      };
      const passes = data.gamePasses || [];
      if (passes.some((p) => p.gamePassId?.toString() === gamepassId)) {
        return { ok: true, verified: true };
      }
      if (!data.nextPageCursor) break;
      cursor = data.nextPageCursor;
    }
  } catch {
    /* try the inventory fallback */
  }

  // Fallback: inventory items endpoint (works when the user's inventory is public).
  try {
    const url = `https://inventory.roblox.com/v1/users/${encodeURIComponent(
      userId,
    )}/items/GamePass/${encodeURIComponent(gamepassId)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: timeoutSignal(FETCH_TIMEOUT_MS),
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: unknown[] };
      if (Array.isArray(data.data) && data.data.length > 0) {
        return { ok: true, verified: true };
      }
      // Empty array = confirmed NOT owned (only trustworthy if inventory public).
      return { ok: false, verified: true, reason: "Gamepass not owned." };
    }
  } catch {
    /* fall through */
  }

  return {
    ok: false,
    verified: false,
    reason: "Could not verify gamepass ownership (inventory may be private).",
  };
}

/**
 * Verify an active experience subscription via Open Cloud. Requires:
 *   ROBLOX_OPEN_CLOUD_KEY  — an Open Cloud API key with subscriptions:read
 *   ROBLOX_UNIVERSE_ID     — the universe that owns the subscription product
 * The subscriptionProductId is the "EXP-..." id; the user reference is the
 * Roblox user id. Returns verified=false when creds are absent.
 */
export async function userHasActiveSubscription(
  userId: string,
  subscriptionProductId: string,
): Promise<VerifyResult> {
  const apiKey = process.env.ROBLOX_OPEN_CLOUD_KEY || "";
  const universeId = process.env.ROBLOX_UNIVERSE_ID || "";
  if (!apiKey || !universeId) {
    return {
      ok: false,
      verified: false,
      reason: "Subscription verification unavailable (Open Cloud not configured).",
    };
  }

  try {
    // Open Cloud subscription instance lookup. The subscription id used by the
    // membership endpoint is the per-user subscription id; Roblox keys these by
    // user, so we query the product's subscription for this user.
    const url =
      `https://apis.roblox.com/cloud/v2/universes/${encodeURIComponent(universeId)}` +
      `/subscription-products/${encodeURIComponent(subscriptionProductId)}` +
      `/subscriptions/${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
      signal: timeoutSignal(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        ok: false,
        verified: false,
        reason: `Subscription lookup failed (${res.status}).`,
      };
    }
    const data = (await res.json()) as {
      active?: boolean;
      state?: string;
    };
    const active = data.active === true || data.state === "SUBSCRIPTION_STATE_SUBSCRIBED";
    return active
      ? { ok: true, verified: true }
      : { ok: false, verified: true, reason: "Subscription is not active." };
  } catch {
    return {
      ok: false,
      verified: false,
      reason: "Subscription verification request failed.",
    };
  }
}
