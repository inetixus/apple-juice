import { setUserPlan, getUserPlan, grantBonusMl } from "@/lib/store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, subscriptionId, apiKey } = body;

    if (!userId || !subscriptionId || !apiKey) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify this request is actually coming from your official Roblox game
    const expectedKey = process.env.ROBLOX_WEBHOOK_SECRET || "default_dev_secret_key";
    if (apiKey !== expectedKey) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = subscriptionId.toString();

    // ━━━ PLANS ━━━
    if (id === "EXP-6181762863565242936") {
      await setUserPlan(userId.toString(), "fresh_pro");
      return Response.json({ success: true, message: "Granted Fresh Pro plan!" });
    }
    if (id === "EXP-2786378855714259452") {
      await setUserPlan(userId.toString(), "pure_ultra");
      return Response.json({ success: true, message: "Granted Pure Ultra plan!" });
    }

    // ━━━ INSTANT REFILLS (DEV PRODUCTS) ━━━
    if (id === "3585012060") {
      await grantBonusMl(userId.toString(), 5000);
      return Response.json({ success: true, message: "Granted Small Sip (+5,000 mL)" });
    }
    if (id === "3585218786") {
      await grantBonusMl(userId.toString(), 20000);
      return Response.json({ success: true, message: "Granted Juice Box (+20,000 mL)" });
    }
    if (id === "3585218944") {
      await grantBonusMl(userId.toString(), 80000);
      return Response.json({ success: true, message: "Granted Mega Jug (+80,000 mL)" });
    }

    return Response.json({ success: false, message: "Unknown ID" }, { status: 400 });

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
    
    return Response.json({ 
      success: true, 
      plan: plan 
    });

  } catch (error) {
    console.error("Roblox GET webhook error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

