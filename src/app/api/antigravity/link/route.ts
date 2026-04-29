/**
 * POST /api/antigravity/link
 *
 * Links a Google-authenticated user's account to their Antigravity account.
 * The frontend calls this once during onboarding or from Settings.
 *
 * Body: { antigravityUserId: string, apiKey?: string }
 * Response: { ok: true, tier: string } or { error: string }
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  linkAntigravityAccount,
  getAntigravityMapping,
  validateAntigravityCredentials,
  unlinkAntigravityAccount,
} from "@/lib/antigravity";

export async function POST(req: Request) {
  // 1. Verify the user is logged in via Google
  const session = await getServerSession(authOptions);
  const email = (session?.user as { email?: string } | undefined)?.email;
  const provider = (session?.user as { provider?: string } | undefined)?.provider;

  if (!email) {
    return Response.json({ error: "Unauthorized. Please sign in with Google." }, { status: 401 });
  }

  if (provider !== "google") {
    return Response.json(
      { error: "Antigravity linking requires a Google account. Please sign in with Google." },
      { status: 400 }
    );
  }

  // 2. Parse the request body
  const body = await req.json().catch(() => ({}));
  const antigravityUserId = (body.antigravityUserId || "").trim();
  const apiKey = (body.apiKey || "").trim();

  if (!antigravityUserId) {
    return Response.json(
      { error: "antigravityUserId is required." },
      { status: 400 }
    );
  }

  // 3. Validate the credentials against Antigravity API
  const validation = await validateAntigravityCredentials(
    apiKey || process.env.ANTIGRAVITY_API_KEY || "",
    antigravityUserId
  );

  if (!validation.valid) {
    return Response.json(
      {
        error: "Invalid Antigravity credentials.",
        detail: validation.error,
      },
      { status: 403 }
    );
  }

  // 4. Store the mapping in Redis
  const mapping = await linkAntigravityAccount(
    email,
    antigravityUserId,
    apiKey || undefined // only store per-user key if provided
  );

  return Response.json({
    ok: true,
    antigravityUserId: mapping.antigravityUserId,
    tier: validation.tier,
    linkedAt: mapping.linkedAt,
  });
}

/**
 * DELETE /api/antigravity/link
 *
 * Unlinks the current user's Antigravity account.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const email = (session?.user as { email?: string } | undefined)?.email;

  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await unlinkAntigravityAccount(email);
  return Response.json({ ok: true, unlinked: true });
}

/**
 * GET /api/antigravity/link
 *
 * Check if the current user has a linked Antigravity account.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = (session?.user as { email?: string } | undefined)?.email;

  if (!email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mapping = await getAntigravityMapping(email);

  if (!mapping) {
    return Response.json({ linked: false });
  }

  return Response.json({
    linked: true,
    antigravityUserId: mapping.antigravityUserId,
    hasCustomKey: !!mapping.apiKey,
    linkedAt: mapping.linkedAt,
  });
}
