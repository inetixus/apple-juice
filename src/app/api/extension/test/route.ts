import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findProduct, applyProductGrant } from "@/lib/roblox-products";

export const dynamic = "force-dynamic";

/** Admin allowlist (same ADMIN_USER_IDS used by /api/usage). Empty = nobody. */
function isAdmin(userId: string): boolean {
  const ids = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

/**
 * POST /api/extension/test
 *
 * Simulates a detected purchase WITHOUT Roblox verification or spending Robux.
 * Gated to admins (ADMIN_USER_IDS) so it's safe to leave enabled in production
 * but can't be abused as a free-grant hole. Set your Roblox userId in
 * ADMIN_USER_IDS to use it.
 *
 * Usage from the browser console (while signed in):
 *   fetch('/api/extension/test', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ productId: 'EXP-6181762863565242936' })
 *   }).then(r => r.json()).then(console.log)
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isAdmin(userId)) {
    return Response.json(
      { error: "Forbidden — add your Roblox userId to ADMIN_USER_IDS to use the test endpoint." },
      { status: 403 },
    );
  }

  const { productId } = (await req.json()) as { productId?: string };
  const product = findProduct(productId);
  if (!product) {
    return Response.json(
      {
        error: "Unknown product",
        available: [
          "EXP-6181762863565242936 (Fresh Pro)",
          "EXP-2786378855714259452 (Pure Ultra)",
          "3585012060 (Small Sip +5k mL)",
          "3585218786 (Juice Box +20k mL)",
          "3585218944 (Mega Jug +80k mL)",
        ],
      },
      { status: 400 },
    );
  }

  const message = await applyProductGrant(userId, product);
  return Response.json({
    success: true,
    message,
    userId,
    product: product.label,
    note: "TEST MODE — no Roblox verification (admin only)",
  });
}
