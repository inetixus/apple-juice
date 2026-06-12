"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { MessageSquare, Cpu, Plug, PlayCircle, Wrench, ArrowRight } from "lucide-react";
import { cn } from "@/utils/cn";

// Same animated Stripe-style wave backdrop the landing page uses.
const StripeWave = dynamic(
  () => import("./stripe-wave-animated").then((m) => m.StripeWaveAnimated),
  { ssr: false },
);

// Matches the landing page's ambient gradient wash.
const LANDING_AMBIENT_GRADIENT =
  "radial-gradient(circle at 50% -20%, rgba(204,255,0,0.08), transparent 70%)," +
  "radial-gradient(circle at 20% 40%, rgba(59,130,246,0.05), transparent 60%)," +
  "radial-gradient(circle at 80% 60%, rgba(139,92,246,0.05), transparent 60%)," +
  "radial-gradient(ellipse 90% 70% at 50% 105%, rgba(255,255,255,0.09), transparent 55%)";

type Goal = "build" | "scripts" | "learn" | "ship";

const GOALS: { id: Goal; emoji: string; title: string; desc: string }[] = [
  { id: "build", emoji: "🎮", title: "Build a full game", desc: "Maps, mechanics, systems — end to end." },
  { id: "scripts", emoji: "⚡", title: "Generate scripts", desc: "Drop in working Luau on demand." },
  { id: "learn", emoji: "🧠", title: "Learn as I go", desc: "Understand what the AI writes." },
  { id: "ship", emoji: "🚀", title: "Ship faster", desc: "Cut my dev time on existing projects." },
];

/** How the Apple Juice agent actually works — shown during onboarding. */
const HOW_IT_WORKS: {
  icon: typeof MessageSquare;
  title: string;
  desc: string;
}[] = [
  {
    icon: MessageSquare,
    title: "1 · Describe it",
    desc: "Tell Apple Juice what you want in plain English — “add a double jump”, “build a shop UI”, “fix this bug”.",
  },
  {
    icon: Cpu,
    title: "2 · The agent plans & writes",
    desc: "It reads your project, plans the change, and writes complete, production-ready Luau — no copy-pasting snippets.",
  },
  {
    icon: Plug,
    title: "3 · It syncs to Studio",
    desc: "Scripts and instances are created live in your open place through the paired Studio plugin.",
  },
  {
    icon: PlayCircle,
    title: "4 · It playtests",
    desc: "The agent runs a real playtest and reads the actual runtime errors — it verifies the work, not just guesses.",
  },
  {
    icon: Wrench,
    title: "5 · It fixes & repeats",
    desc: "If the playtest fails, it diagnoses the root cause, rewrites the script, and re-tests until it passes.",
  },
];

const STEPS = ["Welcome", "Your goal", "How it works", "Connect Studio", "Done"] as const;

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
  const [finishing, setFinishing] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async (target: "/dashboard") => {
    setFinishing(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
    } catch {
      // even if persistence fails, don't trap the user on onboarding
    }
    router.push(target);
  };

  return (
    <div className="relative min-h-[100dvh] w-full bg-gradient-to-b from-[#050508] via-[#08080d] to-[#101015] text-white/90 selection:bg-[#ccff00]/20 selection:text-white font-sans overflow-x-hidden antialiased flex flex-col items-center px-4 sm:px-5 py-6 sm:py-16">
      {/* Landing-style animated wave backdrop */}
      <StripeWave />

      {/* Stripe-style grid pattern (matches landing) */}
      <div
        className="fixed inset-0 stripe-grid pointer-events-none z-[2] opacity-30"
        style={{
          maskImage:
            "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.35) 45%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.35) 45%, black 100%)",
        }}
      />
      {/* Ambient gradient wash (matches landing) */}
      <div
        className="fixed inset-0 pointer-events-none z-[2]"
        style={{ background: LANDING_AMBIENT_GRADIENT }}
        aria-hidden
      />

      {/* progress */}
      <div className="w-full max-w-xl mb-6 sm:mb-10 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <Image
            src="/apple_juice_logo.png"
            alt="Apple Juice"
            width={32}
            height={32}
            className="h-7 w-7 sm:h-8 sm:w-8 object-contain drop-shadow-[0_0_14px_rgba(204,255,0,0.5)]"
          />
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-white/40">
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

      <div className="relative z-10 w-full max-w-xl flex-1 flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="w-full"
          >
            {step === 0 && (
              <StepCard>
                <div className="flex items-center gap-3.5 sm:gap-4 mb-5 sm:mb-6">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={username}
                      width={64}
                      height={64}
                      className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover border border-white/10"
                    />
                  ) : (
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-[#ccff00]/15 border border-[#ccff00]/30 flex items-center justify-center text-xl sm:text-2xl font-black text-[#ccff00]">
                      {username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glossy-pill-dark border border-white/5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-white/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] animate-pulse" />
                    Account created
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.05]">
                  Welcome aboard,
                  <br />
                  <span className="text-[#ccff00]">{username}.</span>
                </h1>
                <p className="mt-4 text-sm text-white/55 font-medium leading-relaxed">
                  Let&apos;s get your workspace dialed in. This takes about a
                  minute — we&apos;ll learn what you&apos;re building, show you
                  how the agent works, and pair Roblox Studio.
                </p>
                <PrimaryRow>
                  <Primary onClick={next} full>
                    Let&apos;s go
                    <ArrowRight className="h-4 w-4" />
                  </Primary>
                </PrimaryRow>
              </StepCard>
            )}

            {step === 1 && (
              <StepCard>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  What brings you here?
                </h2>
                <p className="mt-2 text-sm text-white/50 font-medium">
                  Pick what fits best — we&apos;ll tune your experience around
                  it.
                </p>
                <div className="mt-6 sm:mt-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {GOALS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGoal(g.id)}
                      className={cn(
                        "text-left rounded-2xl border p-4 transition-all duration-200 active:scale-[0.98] sm:hover:scale-[1.02]",
                        goal === g.id
                          ? "border-[#ccff00]/60 bg-[#ccff00]/[0.07] shadow-[0_0_24px_rgba(204,255,0,0.15)]"
                          : "border-white/10 bg-white/[0.03] hover:border-white/25",
                      )}
                    >
                      <div className="flex items-center gap-3 sm:block">
                        <div className="text-2xl sm:mb-2">{g.emoji}</div>
                        <div>
                          <div className="text-sm font-black">{g.title}</div>
                          <div className="text-[11px] text-white/50 font-medium mt-0.5 leading-snug">
                            {g.desc}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <PrimaryRow>
                  <Ghost onClick={back}>Back</Ghost>
                  <Primary onClick={next} disabled={!goal}>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Primary>
                </PrimaryRow>
              </StepCard>
            )}

            {step === 2 && (
              <StepCard>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  How Apple Juice works
                </h2>
                <p className="mt-2 text-sm text-white/50 font-medium">
                  It&apos;s a real agent — it writes code, runs it, and fixes
                  what breaks. No copy-pasting, ever.
                </p>
                <div className="mt-6 sm:mt-7 space-y-2.5 sm:space-y-3">
                  {HOW_IT_WORKS.map((h) => {
                    const Icon = h.icon;
                    return (
                      <div
                        key={h.title}
                        className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4"
                      >
                        <div className="h-9 w-9 shrink-0 rounded-xl bg-[#ccff00]/12 border border-[#ccff00]/25 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-[#ccff00]" />
                        </div>
                        <div>
                          <div className="text-[13px] font-black text-white">
                            {h.title}
                          </div>
                          <div className="text-[11px] sm:text-xs text-white/55 font-medium mt-0.5 leading-snug">
                            {h.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <PrimaryRow>
                  <Ghost onClick={back}>Back</Ghost>
                  <Primary onClick={next}>
                    Got it
                    <ArrowRight className="h-4 w-4" />
                  </Primary>
                </PrimaryRow>
              </StepCard>
            )}

            {step === 3 && (
              <StepCard>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                  Connect Roblox Studio.
                </h2>
                <p className="mt-2 text-sm text-white/50 font-medium">
                  Install the Apple Juice plugin so the agent can write and
                  playtest straight in your workspace.
                </p>
                <ol className="mt-6 sm:mt-7 space-y-2.5 sm:space-y-3">
                  {[
                    "Open Roblox Studio and head to the Creator Store.",
                    "Search “Apple Juice” and install the official plugin.",
                    "Click the plugin and pair using this same account.",
                  ].map((t, i) => (
                    <li
                      key={t}
                      className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 sm:p-4"
                    >
                      <span className="h-6 w-6 shrink-0 rounded-full bg-[#ccff00] text-black flex items-center justify-center font-black text-[11px] font-mono">
                        {i + 1}
                      </span>
                      <span className="text-[12px] sm:text-[13px] text-white/70 font-medium leading-snug">
                        {t}
                      </span>
                    </li>
                  ))}
                </ol>
                <PrimaryRow>
                  <Ghost onClick={back}>Back</Ghost>
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <Ghost onClick={next}>Skip</Ghost>
                    <Primary onClick={next}>
                      Installed
                      <ArrowRight className="h-4 w-4" />
                    </Primary>
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
                    className="h-18 w-18 sm:h-20 sm:w-20 rounded-3xl bg-[#ccff00]/15 border border-[#ccff00]/40 flex items-center justify-center mb-5 sm:mb-6 shadow-[0_0_40px_rgba(204,255,0,0.25)] p-4"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-9 h-9 sm:w-10 sm:h-10 text-[#ccff00]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </motion.div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                    You&apos;re all set!
                  </h2>
                  <p className="mt-3 text-sm text-white/55 font-medium leading-relaxed max-w-sm">
                    Your workspace is ready. Jump into the dashboard and start
                    pouring Juice into your next Roblox project.
                  </p>
                  <div className="mt-7 sm:mt-8 w-full">
                    <Primary onClick={() => finish("/dashboard")} disabled={finishing} full>
                      {finishing ? "Setting things up…" : (
                        <>
                          Enter dashboard
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
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
    <div className="w-full glossy-panel-dark rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-10 shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
      {children}
    </div>
  );
}

function PrimaryRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-7 sm:mt-8 flex items-center justify-between gap-3">
      {children}
    </div>
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
        "h-12 px-6 sm:px-8 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-[#d4ff33] shadow-[0_0_20px_rgba(204,255,0,0.3)] active:scale-95 sm:hover:scale-105 transition-all duration-300 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed disabled:shadow-none",
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
      className="h-12 px-5 sm:px-8 rounded-full bg-white/5 border border-white/10 text-white/80 font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white hover:border-white/20 sm:hover:scale-105 active:scale-95 transition-all duration-300"
    >
      {children}
    </button>
  );
}
