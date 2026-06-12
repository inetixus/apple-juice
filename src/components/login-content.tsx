"use client";

import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import Image from "next/image";
import { LoginShowcase } from "@/components/login-showcase";

const SCOPE_NOTES = [
  {
    n: "1",
    title: "Roblox Identity Verification",
    body: "Roblox shares only your public User ID and username/avatar.",
    points: [
      "Used solely to coordinate your active game projects.",
      "We never receive passwords, emails, or recovery states.",
      "We cannot view Robux, inventories, or transactions.",
    ],
  },
  {
    n: "2",
    title: "WebSocket Pairing Tokens",
    body: "Our Creator Store plugin pairs your workspace safely.",
    points: [
      "Writes & syncs generated scripts to open projects.",
      "Maps folders so the model spots parent instances.",
    ],
  },
];

export function LoginContent() {
  const [showScopes, setShowScopes] = useState(false);
  const [loading, setLoading] = useState<"roblox" | "google" | null>(null);

  const handle = (provider: "roblox" | "google") => {
    setLoading(provider);
    signIn(provider, { callbackUrl: "/onboarding" });
  };

  return (
    <div className="min-h-screen w-full bg-[#08090c] text-white flex flex-col lg:flex-row overflow-hidden">
      {/* ───── MEDIA PANEL ───── */}
      <div className="relative lg:w-1/2 h-72 lg:h-screen overflow-hidden bg-gradient-to-br from-[#0b0c10] via-[#08090c] to-[#050508]">
        {/* brand ambient wash */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-80 w-80 rounded-full bg-[#ccff00]/[0.10] blur-[130px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-violet-500/10 blur-[130px]" />

        {/* vertical drifting product showcase — built for this tall column */}
        <div className="absolute inset-0">
          <LoginShowcase />
        </div>

        {/* fade into the login side so the split feels seamless */}
        <div className="hidden lg:block absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-transparent to-[#08090c] z-20" />
        <div className="lg:hidden absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#08090c] z-20" />

        {/* brand lockup */}
        <div className="absolute top-7 left-7 flex items-center gap-3 z-30">
          <Image
            src="/apple_juice_logo.png"
            alt="Apple Juice"
            width={40}
            height={40}
            className="h-10 w-10 object-contain drop-shadow-[0_0_18px_rgba(204,255,0,0.5)]"
          />
          <span className="font-black text-sm uppercase tracking-[0.2em]">
            Apple&nbsp;Juice
          </span>
        </div>

        {/* tagline pinned to bottom of the media on desktop */}
        <div className="hidden lg:block absolute bottom-12 left-10 right-10 z-30">
          <h2 className="text-3xl font-black leading-[1.05] tracking-tight">
            Ship Roblox games
            <br />
            <span className="text-[#ccff00]">at the speed of thought.</span>
          </h2>
          <p className="mt-4 text-sm text-white/55 font-medium max-w-sm">
            Sign in to pick up where you left off — your projects, credits, and
            paired Studio sessions are waiting.
          </p>
        </div>
      </div>

      {/* ───── LOGIN PANEL ───── */}
      <div className="relative lg:w-1/2 flex items-center justify-center px-6 py-12 lg:py-0">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-20 right-0 h-72 w-72 rounded-full bg-[#ccff00]/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-64 w-64 rounded-full bg-violet-500/10 blur-[120px]" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md"
        >
          <div className="bg-white/[0.04] border border-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 sm:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] animate-pulse" />
              Welcome back
            </span>

            <h1 className="mt-5 text-3xl font-black tracking-tight">
              Sign in to Apple&nbsp;Juice
            </h1>
            <p className="mt-2 text-sm text-white/50 font-medium">
              Choose how you want to continue. We&apos;ll get you back to
              building in seconds.
            </p>

            <div className="mt-8 space-y-3">
              {/* Roblox */}
              <button
                onClick={() => handle("roblox")}
                disabled={loading !== null}
                className="group w-full h-14 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[12px] flex items-center justify-center gap-2.5 hover:bg-[#d4ff33] shadow-[0_0_24px_rgba(204,255,0,0.3)] hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-60 disabled:hover:scale-100"
              >
                {loading === "roblox" ? (
                  <Spinner dark />
                ) : (
                  <>
                    <RobloxMark />
                    Continue with Roblox
                  </>
                )}
              </button>

              {/* Google */}
              <button
                onClick={() => handle("google")}
                disabled={loading !== null}
                className="group w-full h-14 rounded-full bg-white/5 text-white border border-white/12 font-bold uppercase tracking-wider text-[12px] flex items-center justify-center gap-2.5 hover:bg-white/10 hover:border-white/25 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-60 disabled:hover:scale-100"
              >
                {loading === "google" ? (
                  <Spinner />
                ) : (
                  <>
                    <GoogleMark />
                    Continue with Google
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setShowScopes((s) => !s)}
              className="mt-6 w-full flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/40 hover:text-white/70 transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              What data do you access?
            </button>

            <AnimatePresence initial={false}>
              {showScopes && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 space-y-3">
                    {SCOPE_NOTES.map((s) => (
                      <div
                        key={s.n}
                        className="bg-white/[0.03] border border-white/10 rounded-2xl p-4"
                      >
                        <div className="flex items-center gap-3 mb-2.5">
                          <div className="h-6 w-6 rounded-full bg-[#ccff00] text-black flex items-center justify-center font-black text-[10px] font-mono">
                            {s.n}
                          </div>
                          <h3 className="text-[11px] font-black uppercase tracking-wider">
                            {s.title}
                          </h3>
                        </div>
                        <p className="text-[11px] text-white/50 mb-2 leading-relaxed font-medium">
                          {s.body}
                        </p>
                        <ul className="text-[11px] text-white/60 space-y-1.5 list-disc pl-4 leading-relaxed font-medium">
                          {s.points.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-6 text-center text-[10px] text-white/35 font-medium leading-relaxed px-4">
            By continuing you agree to our{" "}
            <a href="/tos" className="text-white/60 hover:text-white underline underline-offset-2">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-white/60 hover:text-white underline underline-offset-2">
              Privacy Policy
            </a>
            . Independent Roblox utility — not affiliated with Roblox
            Corporation.
          </p>

          <div className="mt-4 text-center">
            <a
              href="/"
              className="text-[11px] font-bold uppercase tracking-wider text-white/40 hover:text-white/70 transition-colors"
            >
              ← Back to home
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <span
      className={`h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin ${
        dark ? "text-black/60" : "text-white/60"
      }`}
    />
  );
}

function RobloxMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M4.9 2 2 19.1 19.1 22 22 4.9 4.9 2Zm9.5 12.6-4.9-1.3 1.3-4.9 4.9 1.3-1.3 4.9Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
