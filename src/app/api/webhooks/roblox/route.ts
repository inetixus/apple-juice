import { setUserPlan, getUserPlan } from "@/lib/store";

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

    // Determine the plan based on the subscription ID
    // Fresh Pro: EXP-6181762863565242936
    if (subscriptionId === "EXP-6181762863565242936") {
      // The user ID in our system is the Roblox UserId as a string
      await setUserPlan(userId.toString(), "fresh_pro");
      return Response.json({ success: true, message: "Granted Fresh Pro plan!" });
    }

    // Pure Ultra: EXP-2786378855714259452
    if (subscriptionId === "EXP-2786378855714259452") {
      await setUserPlan(userId.toString(), "pure_ultra");
      return Response.json({ success: true, message: "Granted Pure Ultra plan!" });
    }

    return Response.json({ success: false, message: "Unknown subscription ID" }, { status: 400 });

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

