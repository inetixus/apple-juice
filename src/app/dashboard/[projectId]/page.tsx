import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard-client";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tester?: string }>;
}) {
  const resolvedParams = await params;
  const projectId = resolvedParams.projectId;
  const session = await getServerSession(authOptions);
  const sp = await searchParams;
  const isTester = sp?.tester === "1";

  // Tester bypass: allow viewing a project workspace without an account.
  if (!session && !isTester) {
    redirect("/");
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
      initialProjectId={projectId}
      isTester={!session && isTester}
    />
  );
}
