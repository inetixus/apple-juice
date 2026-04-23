import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  let avatarUrl = "";
  if ((session.user as any)?.id) {
    try {
      const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${(session.user as any).id}&size=420x420&format=Png&isCircular=false`, { next: { revalidate: 3600 } });
      const data = await res.json();
      if (data?.data?.[0]?.imageUrl) {
        avatarUrl = data.data[0].imageUrl;
      }
    } catch (err) {
      // ignore
    }
  }

  return <DashboardClient username={session.user?.name ?? "Roblox User"} avatarUrl={avatarUrl} />;
}