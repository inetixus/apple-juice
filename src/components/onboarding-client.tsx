"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "@/utils/cn";

type Goal = "build" | "scripts" | "learn" | "ship";

const GOALS: { id: Goal; emoji: string; title: string; desc: string }[] = [
  { id: "build", emoji: "🎮", title: "Build a full game", desc: "Maps, mechanics, systems — end to end." },
  { id: "scripts", emoji: "⚡", title: "Generate scripts", desc: "Drop in working Luau on demand." },
  { id: "learn", emoji: "🧠", title: "Learn as I go", desc: "Understand what the AI writes." },
  { id: "ship", emoji: "🚀", title: "Ship faster", desc: "Cut my dev time on existing projects." },
];

const PLANS: {
  id: "free" | "fresh_pro" | "pure_ultra";
  name: string;
  price: string;
  blurb: string;
  accent: string;
  ring: string;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "Kick the tires with a daily pour of Juice.",
    accent: "text-white",
    ring: "hover:border-white/30",
  },
  {
    id: "fresh_pro",
    name: "Fresh Pro",
    price: "$12",
    blurb: "For builders shipping real projects every week.",
    accent: "text-[#ccff00]",
    ring: "hover:border-[#ccff00]/50",
  },
  {
    id: "pure_ultra",
    name: "Pure Ultra",
    price: "$30",
    blurb: "Maximum Juice for full-time creators.",
    accent: "text-violet-400",
    ring: "hover:border-violet-400/50",
  },
];

const STEPS = ["Welcome", "Your goal", "Pick a plan", "Connect Studio", "Done"] as const;

export function OnboardingClient({
  username,
  avatarUrl,
}: {
  username: string;
  avatarUrl: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [plan, setPlan] = useState<"free" | "fresh_pro" | "pure_ultra" | null>(null);
  const [finishing, setFinishing] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async (target: "/dashboard") => {
    setFinishing(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan === "free" ? "free" : undefined, goal }),
      });
    } catch {
      // even if persistence fails, don't trap the user on onboarding
    }
    router.push(target);
  };

  return (
    <div className="min-h-screen w-full bg-[#08090c] text-white flex flex-col items-center px-5 py-10 sm:py-16 overflow-hidden">
      {/* ambient glows */}
      <div className="pointer-events-none fixed -top-24 left-1/2 -translate-x-1/2 h-80 w-[40rem] rounded-full bg-[#ccff00]/[0.07] blur-[140px]" />
      <div className="pointer-events-none fixed bottom-0 right-10 h-72 w-72 rounded-full bg-violet-500/10 blur-[130px]" />

      {/* progress */}
      <div className="w-full max-w-xl mb-10">
        <div className="flex items-center justify-between mb-3">
          <Image
            src="/apple_juice_logo.png"
            alt="Apple Juice"
            width={32}
            height={32}
            className="h-8 w-8 object-contain drop-shadow-[0_0_14px_rgba(204,255,0,0.5)]"
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#ccff00] shadow-[0_0_14px_rgba(204,255,0,0.5)]"
            initial={false}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="relative w-full max-w-xl flex-1 flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {step === 0 && (
              <StepCard>
                <div className="flex items-center gap-4 mb-6">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={username}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-2xl object-cover border border-white/10"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-[#ccff00]/15 border border-[#ccff00]/30 flex items-center justify-center text-2xl font-black text-[#ccff00]">
                      {username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] animate-pulse" />
                    Account created
                  </span>
                </div>
                <h1 className="text-4xl font-black tracking-tight leading-[1.05]">
                  Welcome aboard,
                  <br />
                  <span className="text-[#ccff00]">{username}.</span>
                </h1>
                <p className="mt-4 text-sm text-white/55 font-medium leading-relaxed">
                  Let&apos;s get your workspace dialed in. This takes about a
                  minute — we&apos;ll learn what you&apos;re building, set your
                  plan, and pair Roblox Studio so you can start pouring Juice.
                </p>
                <PrimaryRow>
                  <Primary onClick={next}>Let&apos;s go →</Primary>
                </PrimaryRow>
              </StepCard>
            )}

            {step === 1 && (
              <StepCard>
                <h2 className="text-3xl font-black tracking-tight">
                  What brings you here?
                </h2>
                <p className="mt-2 text-sm text-white/50 font-medium">
                  Pick what fits best — we&apos;ll tune your experience around
                  it.
                </p>
                <div className="mt-7 grid sm:grid-cols-2 gap-3">
                  {GOALS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGoal(g.id)}
                      className={cn(
                        "text-left rounded-2xl border p-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                        goal === g.id
                          ? "border-[#ccff00]/60 bg-[#ccff00]/[0.07] shadow-[0_0_24px_rgba(204,255,0,0.15)]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25",
                      )}
                    >
                      <div className="text-2xl mb-2">{g.emoji}</div>
                      <div className="text-sm font-black">{g.title}</div>
                      <div className="text-[11px] text-white/50 font-medium mt-0.5 leading-snug">
                        {g.desc}
                      </div>
                    </button>
                  ))}
                </div>
                <PrimaryRow>
                  <Ghost onClick={back}>Back</Ghost>
                  <Primary onClick={next} disabled={!goal}>
                    Continue →
                  </Primary>
                </PrimaryRow>
              </StepCard>
            )}

            {step === 2 && (
              <StepCard>
                <h2 className="text-3xl font-black tracking-tight">
                  Choose your pour.
                </h2>
                <p className="mt-2 text-sm text-white/50 font-medium">
                  Start free and upgrade anytime — no pressure.
                </p>
                <div className="mt-7 space-y-3">
                  {PLANS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlan(p.id)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-2xl border p-4 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]",
                        plan === p.id
                          ? "border-[#ccff00]/60 bg-[#ccff00]/[0.06] shadow-[0_0_24px_rgba(204,255,0,0.12)]"
                          : cn("border-white/10 bg-white/[0.03]", p.ring),
                      )}
                    >
                      <div className="text-left">
                        <div className={cn("text-sm font-black", p.accent)}>
                          {p.name}
                        </div>
                        <div className="text-[11px] text-white/50 font-medium mt-0.5">
                          {p.blurb}
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-4">
                        <span className="text-xl font-black">{p.price}</span>
                        <span className="text-[10px] text-white/40 font-bold">
                          {p.id === "free" ? "" : "/mo"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-white/35 font-medium text-center">
                  Paid plans are activated after onboarding via your Roblox
                  purchase. We&apos;ll remember your pick.
                </p>
                <PrimaryRow>
                  <Ghost onClick={back}>Back</Ghost>
                  <Primary onClick={next} disabled={!plan}>
                    Continue →
                  </Primary>
                </PrimaryRow>
              </StepCard>
            )}

            {step === 3 && (
              <StepCard>
                <h2 className="text-3xl font-black tracking-tight">
                  Connect Roblox Studio.
                </h2>
                <p className="mt-2 text-sm text-white/50 font-medium">
                  Install the Apple Juice plugin so generated scripts land
                  straight in your workspace.
                </p>
                <ol className="mt-7 space-y-3">
                  {[
                    "Open Roblox Studio and head to the Creator Store.",
                    "Search “Apple Juice” and install the official plugin.",
                    "Click the plugin and pair using this same account.",
                  ].map((t, i) => (
                    <li
                      key={t}
                      className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <span className="h-6 w-6 shrink-0 rounded-full bg-[#ccff00] text-black flex items-center justify-center font-black text-[11px] font-mono">
                        {i + 1}
                      </span>
                      <span className="text-[13px] text-white/70 font-medium leading-snug">
                        {t}
                      </span>
                    </li>
                  ))}
                </ol>
                <PrimaryRow>
                  <Ghost onClick={back}>Back</Ghost>
                  <div className="flex items-center gap-3">
                    <Ghost onClick={next}>Skip for now</Ghost>
                    <Primary onClick={next}>I&apos;ve installed it →</Primary>
                  </div>
                </PrimaryRow>
              </StepCard>
            )}

            {step === 4 && (
              <StepCard>
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="h-20 w-20 rounded-3xl bg-[#ccff00]/15 border border-[#ccff00]/40 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(204,255,0,0.25)]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-10 h-10 text-[#ccff00]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </motion.div>
                  <h2 className="text-3xl font-black tracking-tight">
                    You&apos;re all set!
                  </h2>
                  <p className="mt-3 text-sm text-white/55 font-medium leading-relaxed max-w-sm">
                    Your workspace is ready. Jump into the dashboard and start
                    pouring Juice into your next Roblox project.
                  </p>
                  <div className="mt-8 w-full">
                    <Primary onClick={() => finish("/dashboard")} disabled={finishing} full>
                      {finishing ? "Setting things up…" : "Enter dashboard →"}
                    </Primary>
                  </div>
                </div>
              </StepCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-white/[0.04] border border-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 sm:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
      {children}
    </div>
  );
}

function PrimaryRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">{children}</div>
  );
}

function Primary({
  children,
  onClick,
  disabled,
  full,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  full?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 px-7 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-[#d4ff33] shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed disabled:shadow-none",
        full && "w-full",
      )}
    >
      {children}
    </button>
  );
}

function Ghost({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-12 px-6 rounded-full border border-white/12 text-white/60 hover:bg-white/5 hover:text-white text-[11px] font-bold uppercase tracking-wider transition-all"
    >
      {children}
    </button>
  );
}
