import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  setUserPlan,
  setUserUsage,
  grantBonusMl,
  banUser,
  unbanUser,
  warnUser,
  clearWarnings,
  logAdminAction,
  getAdminUserSnapshot,
  getAdminAudit,
  PLAN_LIMITS,
  type UserPlan,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const VALID_PLANS = Object.keys(PLAN_LIMITS) as UserPlan[];

/**
 * GET /api/admin?userId=...   → snapshot of a user (plan, usage, ban, warnings)
 * GET /api/admin?audit=1      → recent admin audit log
 *
 * Admin-gated via ADMIN_USER_IDS.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(adminId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  if (url.searchParams.get("audit")) {
    const audit = await getAdminAudit(150);
    return Response.json({ audit });
  }

  const targetUserId = url.searchParams.get("userId")?.trim();
  if (!targetUserId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }
  const snapshot = await getAdminUserSnapshot(targetUserId);
  return Response.json(snapshot);
}

type AdminAction =
  | { action: "grantPlan"; userId: string; plan: UserPlan }
  | { action: "setBalance"; userId: string; remainingMl: number; totalMl: number }
  | { action: "grantMl"; userId: string; ml: number }
  | { action: "ban"; userId: string; reason: string; durationDays?: number }
  | { action: "unban"; userId: string }
  | { action: "warn"; userId: string; reason: string }
  | { action: "clearWarnings"; userId: string };

/**
 * POST /api/admin — perform a moderation/account action.
 * Body: { action, userId, ... } (see AdminAction union).
 * Every action is written to the admin audit log.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(adminId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: AdminAction;
  try {
    body = (await req.json()) as AdminAction;
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const targetUserId = (body as { userId?: string }).userId?.toString().trim();
  if (!targetUserId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "grantPlan": {
        if (!VALID_PLANS.includes(body.plan)) {
          return Response.json({ error: "Invalid plan" }, { status: 400 });
        }
        await setUserPlan(targetUserId, body.plan);
        await logAdminAction({
          action: "grantPlan",
          targetUserId,
          adminUserId: adminId,
          detail: body.plan,
        });
        return Response.json({ success: true, message: `Granted ${body.plan} to ${targetUserId}.` });
      }

      case "setBalance": {
        const total = Number(body.totalMl);
        const remaining = Number(body.remainingMl);
        if (!Number.isFinite(total) || !Number.isFinite(remaining)) {
          return Response.json({ error: "Invalid balance" }, { status: 400 });
        }
        const usedMl = Math.max(0, total - remaining);
        await setUserUsage(targetUserId, usedMl);
        await logAdminAction({
          action: "setBalance",
          targetUserId,
          adminUserId: adminId,
          detail: `remaining=${remaining}/${total}`,
        });
        return Response.json({ success: true, message: "Balance updated." });
      }

      case "grantMl": {
        const ml = Number(body.ml);
        if (!Number.isFinite(ml) || ml <= 0) {
          return Response.json({ error: "Invalid mL amount" }, { status: 400 });
        }
        await grantBonusMl(targetUserId, ml);
        await logAdminAction({
          action: "grantMl",
          targetUserId,
          adminUserId: adminId,
          detail: `+${ml} mL`,
        });
        return Response.json({ success: true, message: `Granted ${ml} mL.` });
      }

      case "ban": {
        const rec = await banUser(
          targetUserId,
          body.reason,
          adminId,
          body.durationDays,
        );
        await logAdminAction({
          action: "ban",
          targetUserId,
          adminUserId: adminId,
          detail: rec.expiresAt
            ? `${body.reason} (${body.durationDays}d)`
            : `${body.reason} (permanent)`,
        });
        return Response.json({ success: true, message: "User banned.", ban: rec });
      }

      case "unban": {
        await unbanUser(targetUserId);
        await logAdminAction({ action: "unban", targetUserId, adminUserId: adminId });
        return Response.json({ success: true, message: "User unbanned." });
      }

      case "warn": {
        const w = await warnUser(targetUserId, body.reason, adminId);
        await logAdminAction({
          action: "warn",
          targetUserId,
          adminUserId: adminId,
          detail: body.reason,
        });
        return Response.json({ success: true, message: "Warning issued.", warning: w });
      }

      case "clearWarnings": {
        await clearWarnings(targetUserId);
        await logAdminAction({ action: "clearWarnings", targetUserId, adminUserId: adminId });
        return Response.json({ success: true, message: "Warnings cleared." });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("/api/admin error", err);
    return Response.json({ error: "Action failed" }, { status: 500 });
  }
}
