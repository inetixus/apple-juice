import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getUserOnboarded } from "@/lib/store";
import { DashboardClient } from "@/components/dashboard-client";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tester?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const isTester = params?.tester === "1";

  // Tester bypass: allow viewing the dashboard without an account.
  if (!session && !isTester) {
    redirect("/");
  }

  // First-run gate: signed-in users who haven't completed onboarding are
  // routed through it before they can reach the dashboard. Testers skip this.
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (userId && !isTester) {
    const onboarded = await getUserOnboarded(userId);
    if (!onboarded) {
      redirect("/onboarding");
    }
  }

  let avatarUrl = "";
  if (session && (session.user as any)?.id) {
    try {
      const res = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${(session.user as any).id}&size=420x420&format=Png&isCircular=false`,
        { next: { revalidate: 3600 } },
      );
      const data = await res.json();
      if (data?.data?.[0]?.imageUrl) {
        avatarUrl = data.data[0].imageUrl;
      }
    } catch (err) {
      // ignore
    }
  }

  return (
    <DashboardClient
      username={session?.user?.name ?? (isTester ? "Tester" : "Roblox User")}
      avatarUrl={avatarUrl}
      isTester={!session && isTester}
    />
  );
}
