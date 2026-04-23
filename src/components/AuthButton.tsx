"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";

export function AuthButton() {
  const { status } = useSession();

  if (status === "authenticated") {
    return (
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        Go to Dashboard
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("roblox", { callbackUrl: "/dashboard" })}
      disabled={status === "loading"}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
    >
      <LogIn className="h-4 w-4" />
      {status === "loading" ? "Checking session..." : "Log in with Roblox"}
    </button>
  );
}