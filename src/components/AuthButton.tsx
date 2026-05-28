"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useState } from "react";

export function AuthButton() {
  const { status } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (status === "authenticated") {
    return (
      <Link
        href="/dashboard"
        className="bg-transparent border border-white/10 text-white hover:bg-white/5 transition-colors rounded-lg px-4 py-2 text-sm font-medium"
      >
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
      className="inline-flex items-center gap-2 bg-transparent border border-white/10 text-white hover:bg-white/5 transition-colors rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
    >
      <LogIn className="h-4 w-4" />
      {status === "loading" || isSigningIn ? "Signing in..." : "Log in with Roblox"}
    </button>
  );
}
