import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUsage, setUserPlan, setUserUsage } from "@/lib/store";

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
