import { grantBonusCredits } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const { code, userId } = await req.json();

    if (!code || !userId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const trimmedCode = code.trim().toLowerCase();
    const expectedCode = (process.env.REDEEM1 || "refresh").toLowerCase();

    if (trimmedCode === expectedCode) {
      // Grant 1000 credits
      await grantBonusCredits(userId, 1000);
      return Response.json({ success: true, message: "Redeemed code for 1000 credits!" });
    }

    // Invalid code
    return Response.json({ error: "Invalid or expired secret code." }, { status: 400 });
  } catch (error) {
    console.error("Redeem code error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
