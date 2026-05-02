import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUsage, getRedis } from "@/lib/store";

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
    const redis = getRedis();

    if (plan) {
      await redis.set(`apple-juice:user-plan:${userId}`, plan);
      
      if (remainingMl !== undefined && totalMl !== undefined) {
        // In store.ts, usage is stored as usedMl. 
        // usageKeyFor(userId) returns `apple-juice:usage:${userId}`
        const usedMl = Math.max(0, totalMl - remainingMl);
        await redis.set(`apple-juice:usage:${userId}`, usedMl);
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: "Failed to update usage" }, { status: 500 });
  }
}
