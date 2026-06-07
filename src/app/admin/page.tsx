import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { AdminPanel } from "@/components/admin/admin-panel";

export const metadata = { title: "Apple Juice — Admin" };

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  // Server-side gate: non-admins never see the panel (and can't read its data,
  // since every /api/admin call re-checks admin status too).
  if (!userId || !isAdmin(userId)) {
    redirect("/dashboard");
  }

  return <AdminPanel adminName={session?.user?.name ?? "Admin"} />;
}
