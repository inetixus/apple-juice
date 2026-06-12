import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserOnboarded, setUserOnboarded, setUserPlan } from "@/lib/store";
import type { UserPlan } from "@/lib/store";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const onboarded = await getUserOnboarded(userId);
  return Response.json({ onboarded });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Body is optional — onboarding can record a non-binding plan preference the
  // user selected during the flow. This never grants a paid plan; only the
  // "free" plan can be self-assigned here. Real upgrades flow through the
  // Roblox webhook / redeem-code routes.
  try {
    const body = await req.json().catch(() => ({}));
    const preferredPlan = (body?.plan as UserPlan | undefined) ?? undefined;
    if (preferredPlan === "free") {
      await setUserPlan(userId, "free");
    }
  } catch {
    // ignore malformed body — completing onboarding should still succeed
  }

  await setUserOnboarded(userId, true);
  return Response.json({ success: true });
}
