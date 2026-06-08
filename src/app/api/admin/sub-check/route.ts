import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { subscriptionProducts } from "@/lib/roblox-products";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/admin/sub-check?userId=<robloxUserId>&product=<EXP-... | productId>
 *
 * DIAGNOSTIC (admin-only): hits the Open Cloud subscription endpoint for a given
 * user + subscription product and returns the RAW status + body, so you can see
 * exactly what Roblox reports for a known subscriber. Use this to confirm
 * whether the official subscription verification works for your setup before
 * wiring it into the real grant flow.
 *
 * If `product` is omitted it tries every subscription product in the registry
 * and returns all results.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (!adminId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(adminId)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim();
  const productParam = url.searchParams.get("product")?.trim();

  if (!userId) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  const apiKey = process.env.ROBLOX_OPEN_CLOUD_KEY || "";
  const universeId = process.env.ROBLOX_UNIVERSE_ID || "";

  const config = {
    hasApiKey: !!apiKey,
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 6)}…(${apiKey.length} chars)` : "(not set)",
    universeId: universeId || "(not set)",
  };

  if (!apiKey || !universeId) {
    return Response.json({
      config,
      error: "ROBLOX_OPEN_CLOUD_KEY and/or ROBLOX_UNIVERSE_ID are not set in env.",
    });
  }

  // Which subscription products to probe.
  const products = productParam
    ? [productParam]
    : subscriptionProducts().map((p) => p.id);

  const results: Array<Record<string, unknown>> = [];

  for (const productId of products) {
    const endpoint =
      `https://apis.roblox.com/cloud/v2/universes/${encodeURIComponent(universeId)}` +
      `/subscription-products/${encodeURIComponent(productId)}` +
      `/subscriptions/${encodeURIComponent(userId)}`;
    try {
      const res = await fetch(endpoint, {
        headers: { "x-api-key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* leave raw */
      }
      results.push({
        productId,
        endpoint,
        httpStatus: res.status,
        ok: res.ok,
        rawBody: text.slice(0, 2000),
        parsed,
      });
    } catch (err) {
      results.push({
        productId,
        endpoint,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return Response.json({ config, userId, results });
}
