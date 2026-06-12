import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getUserOnboarded } from "@/lib/store";
import { OnboardingClient } from "@/components/onboarding-client";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  // Must be signed in to onboard.
  if (!userId) {
    redirect("/login");
  }

  // Already finished onboarding? Go straight to the dashboard.
  if (await getUserOnboarded(userId)) {
    redirect("/dashboard");
  }

  let avatarUrl = "";
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
      { next: { revalidate: 3600 } },
    );
    const data = await res.json();
    if (data?.data?.[0]?.imageUrl) {
      avatarUrl = data.data[0].imageUrl;
    }
  } catch {
    // ignore — fall back to initial-letter avatar
  }

  return (
    <OnboardingClient
      username={session?.user?.name ?? "Roblox User"}
      avatarUrl={avatarUrl}
      isLoggedIn={!!userId}
    />
  );
}
