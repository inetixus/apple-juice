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
        className="inline-flex items-center gap-2 rounded border border-white/20 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/40"
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
      className="inline-flex items-center gap-2 rounded border border-white/20 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/40 disabled:opacity-60"
    >
      <LogIn className="h-4 w-4" />
      {status === "loading" ? "Checking session..." : "Log in with Roblox"}
    </button>
  );
}