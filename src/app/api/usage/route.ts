import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUsage } from "@/lib/store";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await getUserUsage(userId);
  return Response.json(usage);
}
