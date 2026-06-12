import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getUserOnboarded } from "@/lib/store";
import { LoginContent } from "@/components/login-content";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  // Already signed in? Skip the login screen entirely.
  if (userId) {
    const onboarded = await getUserOnboarded(userId);
    redirect(onboarded ? "/dashboard" : "/onboarding");
  }

  return <LoginContent />;
}
