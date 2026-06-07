import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findProduct, applyProductGrant } from "@/lib/roblox-products";

export const dynamic = "force-dynamic";

/**
 * POST /api/extension/test
 *
 * DEV-ONLY endpoint — simulates a detected purchase without Roblox verification
 * or spending Robux. Only works when NODE_ENV !== "production".
 *
 * Usage from the browser console (while signed in to the dashboard):
 *   fetch('/api/extension/test', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ productId: 'EXP-6181762863565242936' })
 *   }).then(r => r.json()).then(console.log)
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not available in production" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
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
    note: "TEST MODE — no Roblox verification, dev only",
  });
}
