import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  setUserPlan,
  setUserUsage,
  grantBonusMl,
  banUser,
  unbanUser,
  unbanIp,
  warnUser,
  clearWarnings,
  logAdminAction,
  getAdminUserSnapshot,
  getAdminAudit,
  getUserRecord,
  isUserRegistered,
  findUserByUsername,
  listUsers,
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

  if (url.searchParams.get("users")) {
    const users = await listUsers(300);
    return Response.json({ users });
  }

  // Resolve a username → registered user (for cross-checking sub requests).
  const username = url.searchParams.get("username")?.trim();
  if (username) {
    const record = await findUserByUsername(username);
    return Response.json({ registered: !!record, record });
  }

  const targetUserId = url.searchParams.get("userId")?.trim();
  if (!targetUserId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }
  const snapshot = await getAdminUserSnapshot(targetUserId);
  const record = await getUserRecord(targetUserId);
  const registered = await isUserRegistered(targetUserId);
  return Response.json({ ...snapshot, record, registered });
}

type AdminAction =
  | { action: "grantPlan"; userId: string; plan: UserPlan }
  | { action: "setBalance"; userId: string; remainingMl: number; totalMl: number }
  | { action: "grantMl"; userId: string; ml: number }
  | { action: "ban"; userId: string; reason: string; durationDays?: number; appealable?: boolean; ipBan?: boolean }
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
        // Look up the user's last-known IP for optional IP ban.
        const rec = body.ipBan ? await getUserRecord(targetUserId) : null;
        const ban = await banUser(targetUserId, body.reason, adminId, {
          durationDays: body.durationDays,
          appealable: body.appealable ?? true,
          ipBan: body.ipBan,
          ip: rec?.lastIp,
        });
        await logAdminAction({
          action: "ban",
          targetUserId,
          adminUserId: adminId,
          detail:
            (ban.expiresAt ? `${body.reason} (${body.durationDays}d)` : `${body.reason} (permanent)`) +
            (ban.appealable ? "" : " [no-appeal]") +
            (ban.ipBan ? ` [ip:${ban.bannedIp}]` : ""),
        });
        return Response.json({ success: true, message: "User banned.", ban });
      }

      case "unban": {
        // Also lift any IP ban tied to this user.
        const existing = await getAdminUserSnapshot(targetUserId);
        if (existing.ban?.bannedIp) await unbanIp(existing.ban.bannedIp);
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
