import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { CliLoginApprove } from "@/components/cli-login-approve";

/**
 * /cli-login?d=DEVICE_CODE
 *
 * The page the CLI opens in the browser to authorize a device login. If the
 * user isn't signed in, bounce them through Roblox sign-in (NextAuth) and come
 * back here. Once signed in, the client component approves the device code,
 * binding the CLI to the user's real Roblox account.
 */
export default async function CliLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const deviceCode = (d ?? "").trim();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!deviceCode) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <p className="text-sm text-white/70">Missing or invalid CLI login code.</p>
      </main>
    );
  }

  // Not signed in → send through Roblox sign-in, returning to this exact page.
  if (!userId) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/cli-login?d=${deviceCode}`)}`);
  }

  const username =
    (session?.user as { name?: string } | undefined)?.name ?? "Roblox User";

  return <CliLoginApprove deviceCode={deviceCode} username={username} />;
}
