"use client";

import { LogIn } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/utils/cn";

type AuthControlsProps = {
  compact?: boolean;
};

export function AuthControls({ compact = false }: AuthControlsProps) {
  const { status } = useSession();

  if (status === "authenticated") {
    return (
      <Link
        href="/dashboard"
        className={cn(
          "inline-flex items-center gap-2 rounded border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/35",
          compact && "px-2.5"
        )}
      >
        <LogIn className="h-4 w-4" />
        Go to Dashboard
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("roblox", { callbackUrl: "/dashboard" })}
      className="inline-flex items-center gap-2 rounded border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/35"
    >
      <LogIn className="h-4 w-4" />
      {status === "loading" ? "Checking session..." : "Log in with Roblox"}
    </button>
  );
}