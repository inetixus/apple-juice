import { getUserPlan } from "@/lib/store";
import { findProduct, applyProductGrant } from "@/lib/roblox-products";

/**
 * POST /api/webhooks/roblox
 *
 * Called by the IN-GAME ProcessReceipt / subscription handler in the Roblox
 * shop experience. This is the AUTHORITATIVE purchase path: Roblox has already
 * processed the transaction server-side, and the call is authenticated with the
 * shared ROBLOX_WEBHOOK_SECRET that only the game server knows. We trust it and
 * grant directly.
 *
 * (The browser-extension relay at /api/extension/purchase is the SECONDARY path
 * for purchases made on roblox.com outside the game; that one independently
 * re-verifies with Roblox because the extension can't hold this secret.)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, subscriptionId, apiKey } = body;

    if (!userId || !subscriptionId || !apiKey) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify this request is actually coming from your official Roblox game.
    const expectedKey =
      process.env.ROBLOX_WEBHOOK_SECRET || "default_dev_secret_key";
    if (apiKey !== expectedKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const product = findProduct(subscriptionId);
    if (!product) {
      return Response.json(
        { success: false, message: "Unknown ID" },
        { status: 400 },
      );
    }

    const message = await applyProductGrant(userId.toString(), product);
    return Response.json({ success: true, message });
  } catch (error) {
    console.error("Roblox webhook error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "Missing userId" }, { status: 400 });
    }

    const plan = await getUserPlan(userId);
    return Response.json({ success: true, plan });
  } catch (error) {
    console.error("Roblox GET webhook error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
