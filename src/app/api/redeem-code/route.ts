import { grantBonusMl, getSession } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { code, sessionKey } = await req.json();

    if (!code || !sessionKey) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const session = await getSession(sessionKey);
    if (!session) {
      return Response.json({ error: "Invalid session" }, { status: 401 });
    }
    const userId = session.ownerUserId;

    const trimmedCode = code.trim().toLowerCase();
    const expectedCode = (process.env.REDEEM1 || "refresh").toLowerCase();

    if (trimmedCode === expectedCode) {
      // Grant 20,000 mL bonus (equivalent to a Juice Box)
      await grantBonusMl(userId, 20_000);
      return Response.json({ success: true, message: "Redeemed code for 20,000 mL of Juice! 🧃" });
    }

    // Invalid code
    return Response.json({ error: "Invalid or expired secret code." }, { status: 400 });
  } catch (error) {
    console.error("Redeem code error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
