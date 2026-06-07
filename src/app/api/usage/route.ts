import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUsage, setUserPlan, setUserUsage } from "@/lib/store";
import { isAdmin } from "@/lib/admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await getUserUsage(userId);
  return Response.json(usage);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Setting your own plan / balance is an admin-only operation. Without this
  // check any logged-in user could POST { plan: "pure_ultra" } and upgrade
  // themselves for free. Real grants flow through the Roblox webhook (purchase)
  // and the redeem-code route (Partner / bonus mL).
  if (!isAdmin(userId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { plan, remainingMl, totalMl } = await req.json();

    if (plan) {
      await setUserPlan(userId, plan);

      if (remainingMl !== undefined && totalMl !== undefined) {
        const usedMl = Math.max(0, totalMl - remainingMl);
        await setUserUsage(userId, usedMl);
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: "Failed to update usage" }, { status: 500 });
  }
}
