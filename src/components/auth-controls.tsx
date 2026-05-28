"use client";

import { LogIn } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { useState } from "react";

type AuthControlsProps = {
  compact?: boolean;
};

export function AuthControls({ compact = false }: AuthControlsProps) {
  const { status } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (status === "authenticated") {
    return (
      <Link
        href="/dashboard"
        className={cn(
          "inline-flex items-center gap-2 rounded border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/35",
          compact && "px-2.5",
        )}
      >
        <LogIn className="h-4 w-4" />
        Go to Dashboard
      </Link>
    );
  }

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signIn("roblox", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("Sign in failed:", error);
      setIsSigningIn(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={status === "loading" || isSigningIn}
      className={cn(
        "inline-flex items-center gap-2 rounded border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:border-white/35 disabled:opacity-60",
        compact && "px-2.5",
      )}
    >
      <LogIn className="h-4 w-4" />
      {status === "loading" || isSigningIn ? "Signing in..." : "Log in with Roblox"}
    </button>
  );
}
