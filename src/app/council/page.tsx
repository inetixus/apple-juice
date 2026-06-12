import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CouncilClient } from "@/components/council-client";

export default async function CouncilPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  // Signed-in only — the council runs several billed model calls.
  if (!userId) {
    redirect("/login");
  }

  return <CouncilClient />;
}
