import {
  grantBonusMl,
  getSession,
  checkRateLimit,
  extractIp,
  hasRedeemed,
  markRedeemed,
  setUserPlan,
} from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { code, sessionKey } = await req.json();

    if (!code || !sessionKey) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (typeof code !== "string" || typeof sessionKey !== "string" || code.length > 128) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }

    // Rate limit by IP and by session to make brute-forcing infeasible.
    const ip = extractIp(req);
    const ipLimit = await checkRateLimit("redeem-ip", ip, 10, 60 * 60);
    if (!ipLimit.allowed) {
      return Response.json(
        { error: "Too many redemption attempts. Try again later." },
        { status: 429 },
      );
    }

    const session = await getSession(sessionKey);
    if (!session) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }
    const userId = session.ownerUserId;

    const sessionLimit = await checkRateLimit("redeem-session", userId, 10, 60 * 60);
    if (!sessionLimit.allowed) {
      return Response.json(
        { error: "Too many redemption attempts. Try again later." },
        { status: 429 },
      );
    }

    const trimmedCode = code.trim().toLowerCase();
    const expectedCode = (process.env.REDEEM1 || "refresh").toLowerCase();

    // ── Partner plan code (invite-only) ──────────────────────────────────────
    // Partner is NOT purchasable — it's granted to partnered creators/studios via
    // a private code you hand out per partnership. Set PARTNER_CODE in the env;
    // if unset, the partner path is disabled entirely (no default, unlike REDEEM1).
    const partnerCode = (process.env.PARTNER_CODE || "").trim().toLowerCase();
    if (partnerCode && trimmedCode === partnerCode) {
      if (await hasRedeemed(userId, trimmedCode)) {
        return Response.json(
          { error: "This partner code has already been redeemed on your account." },
          { status: 409 },
        );
      }
      await markRedeemed(userId, trimmedCode);
      await setUserPlan(userId, "partner");
      return Response.json({
        success: true,
        message: "Welcome to the Apple Juice Partner program! Your Partner plan is now active. 🧃",
      });
    }

    if (trimmedCode === expectedCode) {
      // Replay guard: each code can only be redeemed once per user.
      if (await hasRedeemed(userId, trimmedCode)) {
        return Response.json(
          { error: "You have already redeemed this code." },
          { status: 409 },
        );
      }
      await markRedeemed(userId, trimmedCode);

      // Grant 20,000 mL bonus (equivalent to a Juice Box)
      await grantBonusMl(userId, 20_000);
      return Response.json({
        success: true,
        message: "Redeemed code for 20,000 mL of Juice! 🧃",
      });
    }

    // Invalid code
    return Response.json(
      { error: "Invalid or expired secret code." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Redeem code error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
