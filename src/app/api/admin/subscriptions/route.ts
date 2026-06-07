import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  listSubscriptionRequests,
  getSubscriptionRequest,
  reviewSubscriptionRequest,
  setUserPlan,
  logAdminAction,
  type SubReqStatus,
} from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/admin/subscriptions?status=pending        → list (no images)
 * GET /api/admin/subscriptions?id=<reqId>            → one request WITH images
 *
 * The list view omits the heavy screenshot data; the detail view includes it so
 * the admin can inspect proof before approving.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(adminId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const request = await getSubscriptionRequest(id);
    if (!request) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ request });
  }

  const status = (url.searchParams.get("status") || "pending") as SubReqStatus;
  const requests = await listSubscriptionRequests({ status, limit: 200 });
  return Response.json({ requests });
}

/**
 * POST /api/admin/subscriptions — approve or reject a request.
 * Body: { id, action: "approve" | "reject", note? }
 * Approving grants the plan to the request's userId.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(adminId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: { id?: string; action?: "approve" | "reject"; note?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id, action, note } = body;
  if (!id || (action !== "approve" && action !== "reject")) {
    return Response.json({ error: "Missing id/action" }, { status: 400 });
  }

  const existing = await getSubscriptionRequest(id);
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "pending") {
    return Response.json(
      { error: `Already ${existing.status}.` },
      { status: 409 },
    );
  }

  if (action === "approve") {
    await setUserPlan(existing.userId, existing.plan);
    await reviewSubscriptionRequest(id, "approved", adminId, note);
    await logAdminAction({
      action: "approveSubscription",
      targetUserId: existing.userId,
      adminUserId: adminId,
      detail: `${existing.plan} (@${existing.robloxUsername})`,
    });
    return Response.json({
      success: true,
      message: `Approved — granted ${existing.plan} to ${existing.userId}.`,
    });
  }

  await reviewSubscriptionRequest(id, "rejected", adminId, note);
  await logAdminAction({
    action: "rejectSubscription",
    targetUserId: existing.userId,
    adminUserId: adminId,
    detail: note || existing.plan,
  });
  return Response.json({ success: true, message: "Request rejected." });
}
