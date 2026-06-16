import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSession, getUserUsage } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/cli/usage?key=SESSION_KEY
 *
 * Returns the owning user's plan + credit balance for display in the CLI. Auth
 * is via the CLI session key (preferred) OR a browser NextAuth session. The
 * session key resolves to ownerUserId, so a logged-in CLI shows the real
 * subscription + remaining credits.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionKey = url.searchParams.get("key")?.trim() ?? "";

  let userId: string | undefined;

  if (sessionKey) {
    const pair = await getSession(sessionKey);
    if (pair && Date.now() <= pair.expiresAt) {
      userId = pair.ownerUserId;
    }
  }

  // Fallback: browser session (e.g. when called from a logged-in context).
  if (!userId) {
    const session = await getServerSession(authOptions);
    userId = (session?.user as { id?: string } | undefined)?.id;
  }

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await getUserUsage(userId);
  // Treat CLI-only anonymous accounts (cli-user-*) as not "logged in" for plan
  // display purposes — they have no Roblox subscription bound.
  const isRobloxLinked = !userId.startsWith("cli-user-");

  return Response.json({
    loggedIn: isRobloxLinked,
    plan: usage.plan,
    remainingMl: usage.remainingMl,
    totalMl: usage.totalMl,
    usedMl: usage.usedMl,
    bonusMl: usage.bonusMl,
    monthlyCapped: (usage as { monthlyCapped?: boolean }).monthlyCapped ?? false,
  });
}
