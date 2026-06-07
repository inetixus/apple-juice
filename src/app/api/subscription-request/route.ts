import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createSubscriptionRequest,
  checkRateLimit,
  extractIp,
  listSubscriptionRequests,
  PLAN_LIMITS,
  type UserPlan,
} from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PURCHASABLE_PLANS: UserPlan[] = ["fresh_pro", "pure_ultra"];

// Cap each screenshot payload (data URL). ~1.5MB of base64 ≈ ~1.1MB image.
const MAX_PROOF_CHARS = 1_500_000;

/**
 * POST /api/subscription-request
 *
 * The under-16 manual-verification flow: a user who can't enter the 16+ shop
 * game buys the Roblox subscription directly, then submits proof here for an
 * admin to review and grant. We DON'T grant anything automatically — this only
 * files a pending request into the admin review queue.
 *
 * Body: { plan, robloxUsername, cancelled, purchaseProof, ownershipProof }
 * (proofs are compressed data-URL screenshots from the client).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  // Rate limit: a few submissions per hour is plenty; stops proof spam.
  const ip = extractIp(req);
  const ipLimit = await checkRateLimit("subreq-ip", ip, 8, 60 * 60);
  if (!ipLimit.allowed) {
    return Response.json({ error: "Too many submissions. Try again later." }, { status: 429 });
  }
  const userLimit = await checkRateLimit("subreq-user", userId, 8, 60 * 60);
  if (!userLimit.allowed) {
    return Response.json({ error: "Too many submissions. Try again later." }, { status: 429 });
  }

  let body: {
    plan?: string;
    robloxUsername?: string;
    cancelled?: boolean;
    purchaseProof?: string;
    ownershipProof?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const plan = (body.plan || "").trim() as UserPlan;
  if (!PURCHASABLE_PLANS.includes(plan) || !PLAN_LIMITS[plan]) {
    return Response.json({ error: "Invalid plan." }, { status: 400 });
  }

  const robloxUsername = (body.robloxUsername || "").trim();
  if (!robloxUsername || robloxUsername.length > 50) {
    return Response.json({ error: "Enter your Roblox username." }, { status: 400 });
  }

  const purchaseProof = body.purchaseProof || "";
  const ownershipProof = body.ownershipProof || "";
  if (!purchaseProof || !ownershipProof) {
    return Response.json(
      { error: "Both screenshots are required." },
      { status: 400 },
    );
  }
  if (
    !purchaseProof.startsWith("data:image/") ||
    !ownershipProof.startsWith("data:image/")
  ) {
    return Response.json({ error: "Screenshots must be images." }, { status: 400 });
  }
  if (purchaseProof.length > MAX_PROOF_CHARS || ownershipProof.length > MAX_PROOF_CHARS) {
    return Response.json(
      { error: "Screenshots too large. Please use smaller images." },
      { status: 413 },
    );
  }

  // Prevent stacking: if the user already has a pending request, reject.
  const existing = await listSubscriptionRequests({ status: "pending", limit: 1000 });
  if (existing.some((r) => r.userId === userId)) {
    return Response.json(
      { error: "You already have a pending request under review. Please wait." },
      { status: 409 },
    );
  }

  const request = await createSubscriptionRequest({
    userId,
    robloxUsername,
    plan,
    cancelled: body.cancelled === true,
    purchaseProof,
    ownershipProof,
  });

  return Response.json({
    success: true,
    message: "Submitted! An admin will review your proof and activate your plan soon.",
    requestId: request.id,
  });
}
