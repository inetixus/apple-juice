import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingContent } from "@/components/landing-content";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  
  let avatarUrl = "";
  if (session && (session.user as any)?.id) {
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

  return <LandingContent session={session} avatarUrl={avatarUrl} />;
}
