import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getBan,
  getWarnings,
  acknowledgeWarnings,
  recordUserSeen,
  extractIp,
  getLatestSubscriptionRequestForUser,
  getUserSubscription,
  setUserSubscription,
  clearUserSubscription,
  setUserPlan,
  getUserPlan,
} from "@/lib/store";
import { userHasActiveSubscription } from "@/lib/roblox-verify";

export const dynamic = "force-dynamic";

const SEEN_SUB_PREFIX = "apple-juice:seen-sub:";

/**
 * Re-verify a subscriber's Open Cloud status at most once per ~6h. Keeps plans
 * honest without a cron: if their Roblox subscription lapsed/cancelled, they
 * get downgraded to free on a later dashboard load; if still active, the
 * lastVerifiedAt stamp refreshes. No-op for users with no tracked subscription.
 */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
async function maybeRecheckSubscription(userId: string) {
  try {
    const sub = await getUserSubscription(userId);
    if (!sub) return;
    if (Date.now() - sub.lastVerifiedAt < RECHECK_INTERVAL_MS) return;

    const result = await userHasActiveSubscription(userId, sub.productId);
    // Only act on a POSITIVE verification signal. If the check itself failed
    // (network / API down — verified=false but not an authoritative "inactive"),
    // leave the plan alone so an outage can't mass-downgrade paying users.
    if (result.ok) {
      await setUserSubscription(userId, { ...sub, lastVerifiedAt: Date.now() });
    } else if (result.verified) {
      // Authoritatively inactive → downgrade.
      const plan = await getUserPlan(userId);
      if (plan !== "free") await setUserPlan(userId, "free");
      await clearUserSubscription(userId);
    }
  } catch {
    /* non-fatal */
  }
}

/**
 * GET /api/account/status
 *
 * Returns the things the dashboard should surface on load:
 *   - ban: active ban record (so we can show the "you're banned" screen)
 *   - newWarnings: warnings not yet acknowledged (red popup), then marks them ack'd
 *   - subscriptionDecision: latest approved/rejected sub request the user hasn't
 *     been notified about yet
 * Also records the user in the registry (first-seen / last-seen / ip / username).
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = extractIp(req);
  const username = session?.user?.name || undefined;
  // Register / refresh presence (fire and forget semantics, but await for IP).
  await recordUserSeen(userId, { username, ip });

  // Lazily re-verify an existing subscription (throttled) so lapsed/cancelled
  // subs downgrade automatically without a cron job.
  await maybeRecheckSubscription(userId);

  const [ban, warnings] = await Promise.all([getBan(userId), getWarnings(userId)]);

  const newWarnings = warnings.filter((w) => !w.acknowledged);
  if (newWarnings.length > 0) {
    // Mark them acknowledged so the popup only shows once.
    await acknowledgeWarnings(userId);
  }

  // Subscription decision the user hasn't seen yet.
  let subscriptionDecision: { status: string; plan: string; note?: string } | null = null;
  try {
    const latest = await getLatestSubscriptionRequestForUser(userId);
    if (latest && (latest.status === "approved" || latest.status === "rejected")) {
      const { getRedis } = await import("@/lib/store");
      const redis = getRedis();
      const seenKey = `${SEEN_SUB_PREFIX}${userId}`;
      const seenId = await redis.get(seenKey);
      if (seenId !== latest.id) {
        subscriptionDecision = {
          status: latest.status,
          plan: latest.plan,
          note: latest.reviewNote,
        };
        await redis.set(seenKey, latest.id);
      }
    }
  } catch {
    /* non-fatal */
  }

  return Response.json({
    ban: ban
      ? {
          reason: ban.reason,
          expiresAt: ban.expiresAt || null,
          appealable: ban.appealable ?? true,
          hasAppeal: !!ban.appeal,
        }
      : null,
    newWarnings: newWarnings.map((w) => ({ reason: w.reason, warnedAt: w.warnedAt })),
    subscriptionDecision,
  });
}
