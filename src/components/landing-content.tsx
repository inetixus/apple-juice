// @ts-nocheck
"use client";

import {
  ArrowRight,
  ChevronDown,
  Sparkles,
  Plus,
  Layers,
  CheckCircle2,
  History,
  ShieldCheck,
  ChevronRight,
  Crown,
  Terminal
} from "lucide-react";
import dynamic from "next/dynamic";
import { LandingCliSection } from "./landing-cli-section";
import { LandingHeroShowcase } from "./landing-hero-showcase";
// import { LandingAdShowcase } from "./landing-ad-showcase"; // hidden: Product film section commented out

import { LandingWebIdeSection } from "./landing-web-ide-section";
import { SpineSection } from "./landing-spine";
import { MagneticButton } from "./magnetic-button";
import { FaqItemPremium } from "./faq-item-premium";
import { NavLiquidTabs } from "./nav-liquid-tabs";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const Medusae = dynamic(
  () => import("./medusae-effect").then((m) => m.Medusae),
  { ssr: false },
);
const StripeWave = dynamic(
  () => import("./stripe-wave").then((m) => m.StripeWave),
  { ssr: false },
);

export { LazySpline } from "./lazy-spline";

const LANDING_AMBIENT_GRADIENT =
  "radial-gradient(circle at 50% -20%, rgba(204,255,0,0.08), transparent 70%)," +
  "radial-gradient(circle at 20% 40%, rgba(59,130,246,0.05), transparent 60%)," +
  "radial-gradient(circle at 80% 60%, rgba(139,92,246,0.05), transparent 60%)," +
  "radial-gradient(ellipse 90% 70% at 50% 105%, rgba(255,255,255,0.09), transparent 55%)," +
  "radial-gradient(ellipse 55% 45% at 15% 88%, rgba(59,130,246,0.07), transparent 60%)," +
  "radial-gradient(ellipse 50% 40% at 88% 78%, rgba(204,255,0,0.06), transparent 55%)";

/* ─── FAQ data ─── */
const FAQ_ITEMS = [
  {
    question: "Is Apple Juice affiliated with Roblox Corporation?",
    answer:
      "No. Apple Juice is an independent, open-source project. It is not affiliated with, endorsed by, or sponsored by Roblox Corporation. Sign-in is performed through the official Roblox OAuth 2.0 API — a publicly available developer program — so the authorization screen you see is hosted and operated by Roblox, not us.",
  },
  {
    question: "Is Apple Juice free to use?",
    answer:
      "Yes. Apple Juice is free and open-source (MIT License). You only pay for AI inference — either through your own provider key (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Groq, xAI, Mistral, and more), or by using the platform's shared credit pool.",
  },
  {
    question: "What data do you receive when I sign in?",
    answer:
      "If you authorize via Roblox, we receive only your User ID and public profile. If you use Google, we receive your email and basic profile. We NEVER receive your password, Robux balance, purchase history, or inventory. You can revoke access at any time from your account settings.",
  },
  {
    question: "Do you store my AI provider API keys?",
    answer:
      "Never. Your API keys are stored exclusively in your browser's localStorage. They are sent directly from your browser to your chosen provider — our servers are not in that data path.",
  },
  {
    question: "How does the Studio plugin work?",
    answer:
      "You install a lightweight plugin from the Roblox Creator Store. It opens a persistent WebSocket connection to your dashboard using a short-lived pairing token. When the AI generates code, scripts are pushed through this connection and created in Studio automatically. The plugin operates only within the Studio sandbox and has no access to your account or game data outside the open place.",
  },
  {
    question: "Which AI models are supported?",
    answer:
      "We route through Kiro's frontier and open-weight lineup: Claude Opus 4.8/4.7/4.6/4.5, Claude Sonnet 4.6/4.5/4.0, Claude Haiku 4.5, plus open-weight models like GLM-5, MiniMax M2.5/M2.1, DeepSeek 3.2 and Qwen3 Coder Next. An Auto router picks the best model per task, or you can choose one yourself in the dashboard.",
  },
];

/* ─── Main Landing Component ─── */
export function LandingContent({
  session,
  avatarUrl: _avatarUrl,
}: {
  session: any;
  avatarUrl?: string;
}) {
  const [showAuthGuide, setShowAuthGuide] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pricingSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div suppressHydrationWarning className="relative min-h-screen bg-gradient-to-b from-[#050508] via-[#08080d] to-[#101015] text-white/90 selection:bg-[#ccff00]/20 selection:text-white font-sans overflow-x-hidden antialiased">

      {/* ━━━ STRIPE SIGNATURE HERO ANIMATED TWISTED WAVE LINES (under particles) ━━━ */}
      <StripeWave />

      {/* Cursor / particle backdrop — sticky viewport canvas, no mask (transparent) */}
      <div className="absolute inset-x-0 top-0 h-[100vh] max-h-[900px] z-[1] pointer-events-none">
        <div className="sticky top-0 h-screen w-full">
          <Medusae
            config={{
              background: { color: "transparent" },
              cursor: {
                radius: 0.05,
                strength: 2.2,
                dragFactor: 0.014,
              },
              halo: {
                radiusBase: 1.35,
                radiusAmplitude: 0.28,
                shapeAmplitude: 0.45,
                rimWidth: 1.05,
                outerStartOffset: 0.65,
                outerEndOffset: 1.35,
                scaleX: 1.1,
              },
              particles: {
                colorBase: "#ffffff",
                colorOne: "#3b82f6",
                colorTwo: "#8b5cf6",
                colorThree: "#ccff00",
                baseSize: 0.042,
                activeSize: 0.072,
                blobScaleX: 1,
                blobScaleY: 0.58,
                cursorFollowStrength: 0.72,
                rotationSpeed: 0.06,
              },
            }}
          />
        </div>
      </div>

      {/* Stripe animated grid pattern & ambient highlights */}
      <div className="fixed inset-0 stripe-grid pointer-events-none z-[2] opacity-30"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.35) 45%, black 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.35) 45%, black 100%)",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none z-[2]"
        style={{ background: LANDING_AMBIENT_GRADIENT }}
        aria-hidden
      />

      {/* ━━━ NAVBAR ━━━ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 flex justify-center py-0 px-0`}>
        <div
          className={`w-full max-w-[1400px] transition-all duration-300 flex items-center justify-between mx-auto ${scrolled
              ? "h-14 px-6 md:px-12 glossy-panel-dark border-b border-white/5 shadow-2xl"
              : "h-20 px-6 md:px-10 bg-transparent border-b border-transparent"
            }`}
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.35)] transition-transform hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                className="h-4.5 w-4.5 text-black font-black"
                fill="currentColor"
              >
                <path d="M5.2 6.5L7.5 3h9l2.3 3.5H5.2z" fillOpacity="0.8" />
                <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5z" />
                <path
                  d="M15 3V1.5A1.5 1.5 0 0 0 13.5 0H12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="text-sm font-black tracking-widest text-white uppercase font-mono">
              APPLE JUICE
            </span>
          </div>

          <NavLiquidTabs scrolled={scrolled} />

          <button
            onClick={() =>
              session
                ? (window.location.href = "/dashboard")
                : setShowAuthGuide(true)
            }
            className="h-9 px-6 rounded-full bg-[#ccff00] text-black text-[11px] font-black uppercase tracking-wider hover:bg-[#d4ff33] shadow-[0_0_15px_rgba(204,255,0,0.25)] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5"
          >
            {session ? "Enter Studio" : "Get Started"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* ━━━ HERO & DEMO PANEL ━━━ */}
      <section className="relative pt-36 pb-24 px-6 md:px-12 xl:px-20 z-10 flex flex-col items-center overflow-visible">
        {/* Continuation glow — fills hero below the first viewport so lighting doesn't hard-stop */}
        <div
          className="absolute inset-x-0 top-[55vh] bottom-0 pointer-events-none -z-10"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,0.06), transparent 68%),
              radial-gradient(ellipse 70% 50% at 20% 30%, rgba(59,130,246,0.05), transparent 62%),
              radial-gradient(ellipse 65% 45% at 85% 40%, rgba(204,255,0,0.04), transparent 58%),
              radial-gradient(ellipse 80% 40% at 50% 100%, rgba(139,92,246,0.05), transparent 65%)
            `,
          }}
        />
        <div className="w-full max-w-[1300px] mx-auto text-center flex flex-col items-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-4.5 py-1.5 rounded-full glossy-pill-dark border border-white/5 shadow-sm mb-6"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#ccff00]" />
            <span className="text-[10px] tracking-wider uppercase font-bold text-white/40 font-mono">
              Next-Gen Roblox Companion · Secure WebSocket Link
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[44px] sm:text-[68px] md:text-[84px] font-black leading-[1.05] tracking-[-0.04em] mb-8 text-slate-400 max-w-5xl"
          >
            Roblox Studio, <br />
            <span className="text-white">
              elevated by weightless AI.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-[620px] text-lg md:text-xl text-slate-400 mb-10 leading-relaxed font-medium"
          >
            Describe the game elements you want to engineer. Apple Juice generates high-quality Luau code and injects it dynamically into your active Roblox Studio session.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <MagneticButton
              type="button"
              onClick={() =>
                session
                  ? (window.location.href = "/dashboard")
                  : setShowAuthGuide(true)
              }
              className="h-12 w-full sm:w-auto px-8 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-[#d4ff33] shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-105 active:scale-95 transition-all duration-300"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </MagneticButton>
            <MagneticButton
              as="a"
              href="#explore"
              className="h-12 w-full sm:w-auto px-8 rounded-full bg-white/5 border border-white/10 text-white/80 font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              See Web IDE
            </MagneticButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-8"
          >
            <MagneticButton
              as="a"
              href="#cli"
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#ff8c00]/25 bg-[#ff8c00]/[0.08] hover:bg-[#ff8c00]/15 hover:border-[#ff8c00]/40 transition-all group shadow-[0_0_24px_rgba(255,140,0,0.12)]"
            >
              <Terminal className="w-3.5 h-3.5 text-[#ffb347]" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#ffb347] group-hover:text-[#ffd700]">
                New system — Apple Juice CLI
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-[#ff8c00]/60 group-hover:translate-x-0.5 transition-transform" />
            </MagneticButton>
          </motion.div>
        </div>

        {/* ━━━ FEATURE SHOWCASE (Cowork-style cinematic loop) ━━━ */}
        <LandingHeroShowcase />

        {/* Ambient bridge glow — connects hero lighting into the section below */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-[40%] w-[min(100%,1200px)] h-[520px] pointer-events-none z-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 90% 80% at 50% 100%, rgba(255,255,255,0.07), rgba(255,255,255,0.025) 45%, transparent 72%)",
          }}
        />
      </section>

      {/* ━━━ PRODUCT FILM (looping ad — same demo as hero, narrated) ━━━ */}
      {/* Hidden for now — section commented out per request.
      <section
        id="film"
        className="relative py-20 md:py-28 px-6 md:px-12 z-10"
      >
        <div className="max-w-[1100px] mx-auto text-center mb-10 md:mb-14">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ccff00] mb-4">
            Product film
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            See the full story
          </h2>
          <p className="text-white/50 text-base md:text-lg font-medium max-w-2xl mx-auto leading-relaxed">
            A 25-second cut from prompt to playtest — describe a mechanic, watch the Luau get written, and see it sync straight into Roblox Studio.
          </p>
        </div>
        <LandingAdShowcase
          onCta={() =>
            session
              ? (window.location.href = "/dashboard")
              : setShowAuthGuide(true)
          }
        />
      </section>
      */}

      {/* Seamless light bleed into Web IDE — overlaps hero boundary */}
      <div
        className="relative h-0 z-[5] pointer-events-none"
        aria-hidden
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-[280px] w-[min(100%,1400px)] h-[360px]"
          style={{
            background:
              "radial-gradient(ellipse 85% 70% at 50% 100%, rgba(139,92,246,0.06), rgba(59,130,246,0.03) 40%, transparent 70%)",
          }}
        />
      </div>

      <SpineSection id="explore" className="relative overflow-visible z-10 w-full -mt-8">
        <LandingWebIdeSection />

        <div className="relative">
        <div
          className="absolute inset-0 pointer-events-none -z-10"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 85% 50% at 50% 0%, rgba(255,255,255,0.06), transparent 68%),
              radial-gradient(ellipse 70% 55% at 12% 45%, rgba(59,130,246,0.05), transparent 62%),
              radial-gradient(ellipse 65% 50% at 90% 60%, rgba(204,255,0,0.04), transparent 58%),
              radial-gradient(ellipse 100% 45% at 50% 100%, rgba(255,255,255,0.08), transparent 52%)
            `,
          }}
        />

      {/* ━━━ CORE FEATURES (THREE COLUMNS ROW) ━━━ */}
      <section id="features" className="px-6 py-24 md:py-32 relative">
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
              We handle the hard stuff
            </h2>
            <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto font-medium leading-relaxed">
              Autonomously synchronize code files, run diagnostics, and roll back configurations instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

            {/* COLUMN 1 */}
            <div className="flex flex-col items-start bg-white/[0.04] border border-white/10 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center mb-6 shadow-sm">
                <Layers className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-3 tracking-tight uppercase">
                No More Copy-Pasting
              </h3>
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                Our lightweight Roblox Creator Store plugin creates script and module instances automatically. Any files synthesized by the AI dashboard write instantly to your workspace.
              </p>
            </div>

            {/* COLUMN 2 */}
            <div className="flex flex-col items-start bg-white/[0.04] border border-white/10 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center mb-6 shadow-sm">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-3 tracking-tight uppercase">
                Diagnostics & Playtests
              </h3>
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                Apple Juice runs real-time playtest checks, parses client output lines, and catches runtime issues or compiler warnings in your Luau script blocks, rolling out immediate fixes.
              </p>
            </div>

            {/* COLUMN 3 */}
            <div className="flex flex-col items-start bg-white/[0.04] border border-white/10 rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center mb-6 shadow-sm">
                <History className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-black text-white mb-3 tracking-tight uppercase">
                Version Rollbacks
              </h3>
              <p className="text-sm text-white/60 leading-relaxed font-medium">
                Accidents happen. Review execution logs, scan previous code blocks, and roll back components to clean states in one click. Every file adjustment is archived safely on your dashboard.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ━━━ APPLE JUICE CLI — TERMINAL SYSTEM ━━━ */}
      <div className="px-6 md:px-12 xl:px-20 relative z-10">
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0 w-[min(100%,900px)] h-[480px] pointer-events-none -z-10 opacity-70"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,140,0,0.08), transparent 65%)",
          }}
        />
        <LandingCliSection
          onCta={() =>
            session
              ? (window.location.href = "/dashboard")
              : setShowAuthGuide(true)
          }
        />
        </div>
        </div>
      </SpineSection>

      <div className="relative">

      {/* ━━━ PRICING (Sleek fully rounded cards with gorgeous video backdrop) ━━━ */}
      <section
        id="pricing"
        ref={pricingSectionRef}
        className="px-6 py-24 md:py-32 relative overflow-hidden isolate bg-transparent"
      >
        
        <div className="max-w-[1200px] mx-auto relative z-10">
          
          {/* Removed Hard Container Box; using relative wrapper */}
          <div className="relative py-20 px-6 md:px-0 mb-16">

            
            {/* Lively Ambient Pulsating Glow */}
            <div className="absolute inset-0 z-0 opacity-60 pointer-events-none overflow-hidden flex items-center justify-center">
              <div className="absolute w-[900px] h-[900px] rounded-full bg-[#ccff00]/[0.025] blur-[150px] animate-pulse duration-[10000ms] mix-blend-screen" />
              <div className="absolute w-[700px] h-[700px] rounded-full bg-[#ff8c00]/[0.035] blur-[130px] animate-pulse duration-[7000ms] mix-blend-screen" />
              <div className="absolute w-[500px] h-[400px] rounded-full bg-white/[0.04] blur-[100px]" />
            </div>

            {/* Header Content */}
            <div className="text-center mb-20 relative z-10">
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
                Pick your squeeze
              </h2>
              <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto font-medium leading-relaxed">
                Flexible credit tiers billed securely in Robux, or connect your personal API key to build completely free forever.
              </p>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">

            {/* TIER 1: FREE */}
            <div className="bg-[#08090c]/45 border border-white/5 rounded-[2.5rem] p-10 flex flex-col hover:border-white/10 hover:shadow-2xl transition-all duration-500 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[40px] opacity-30 group-hover:scale-125 transition-transform" />
              <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3 font-mono">
                Free Sip
              </div>
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                0 R$
                <span className="text-xs text-white/40 font-bold ml-1">/ forever</span>
              </div>
              <p className="text-xs text-white/40 mb-8 border-b border-white/5 pb-6 font-medium">
                Perfect for hobbyists and learning Luau.
              </p>

              <ul className="flex flex-col gap-4 mb-10 text-[13px] text-white/70 font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>1.0 Credit Allowance</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>Auto router & Haiku 4.5</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>Roblox Studio Plugin Sync</span>
                </li>
              </ul>

              <button
                onClick={() => setShowAuthGuide(true)}
                className="mt-auto w-full h-12 rounded-full border border-white/10 text-white font-bold py-3 hover:bg-white/5 transition-all uppercase tracking-wider text-[11px] shadow-sm"
              >
                Sign Up Free
              </button>
            </div>

            {/* TIER 2: PRO (Solid Accent) */}
            <div className="bg-[#08090c]/70 border-2 border-[#ccff00] rounded-[2.5rem] p-10 flex flex-col relative transform md:-translate-y-4 shadow-[0_0_35px_rgba(204,255,0,0.12)] z-20 hover:scale-[1.02] transition-transform duration-300">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#ccff00] text-black text-[9px] font-black uppercase tracking-wider py-1.5 px-6 rounded-full shadow-md">
                Highly Recommended
              </div>
              <div className="text-[#ccff00] text-xs font-bold uppercase tracking-wider mb-3 font-mono">
                Fresh Pro
              </div>
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                600 R$
                <span className="text-xs text-white/40 font-bold ml-1">/ month</span>
              </div>
              <p className="text-xs text-white/40 mb-8 border-b border-white/5 pb-6 font-medium">
                Engineered for serious studio builders.
              </p>

              <ul className="flex flex-col gap-4 mb-10 text-[13px] text-white/80 font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#ccff00] flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Plus className="w-3.5 h-3.5 text-black" />
                  </div>
                  <span className="text-white font-black">5.0 Credits Allowance</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>Claude Sonnet 4.6 & GLM-5</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>Full Studio Context Scans</span>
                </li>
              </ul>

              <button
                onClick={() =>
                  window.open(
                    "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                    "_blank"
                  )
                }
                className="mt-auto w-full h-12 rounded-full bg-[#ccff00] text-black font-black py-3 hover:bg-[#d4ff33] transition-all uppercase tracking-wider text-[11px] shadow-sm flex items-center justify-center gap-1.5"
              >
                Upgrade to Pro
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* TIER 3: ULTRA */}
            <div className="bg-[#08090c]/45 border border-white/5 rounded-[2.5rem] p-10 flex flex-col hover:border-white/10 hover:shadow-2xl transition-all duration-500 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-[40px] opacity-30 group-hover:scale-125 transition-transform" />
              <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3 font-mono">
                Pure Ultra
              </div>
              <div className="text-4xl font-black text-white mb-2 tracking-tight">
                1,500 R$
                <span className="text-xs text-white/40 font-bold ml-1">/ month</span>
              </div>
              <p className="text-xs text-white/40 mb-8 border-b border-white/5 pb-6 font-medium">
                Uncompromising agent-first performance.
              </p>

              <ul className="flex flex-col gap-4 mb-10 text-[13px] text-white/70 font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>15.0 Credits Allowance</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>Claude Opus 4.8 & 4.7</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <span>8 Parallel Studio Workspace Tasks</span>
                </li>
              </ul>

              <button
                onClick={() =>
                  window.open(
                    "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                    "_blank"
                  )
                }
                className="mt-auto w-full h-12 rounded-full border border-white/10 text-white font-bold py-3 hover:bg-white/5 transition-all uppercase tracking-wider text-[11px] shadow-sm"
              >
                Get Ultra Pack
              </button>
            </div>

          </div>
          </div> {/* Close Unified Shop Container Box */}

          {/* MODEL COMPARISON TABLE */}
          <div className="bg-[#08090c]/45 border border-white/5 rounded-[2.5rem] p-8 md:p-10 mb-16 overflow-x-auto shadow-2xl relative z-20">
            <h4 className="text-xs font-black uppercase tracking-wider text-white/40 mb-8 text-center font-mono">
              Compare Tiers
            </h4>
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-4 text-white/40 font-bold px-4 uppercase tracking-wider text-[10px] font-mono">
                    Tier
                  </th>
                  <th className="text-left py-4 text-white/40 font-bold px-4 uppercase tracking-wider text-[10px] font-mono">
                    Primary Model
                  </th>
                  <th className="text-left py-4 text-white/40 font-bold px-4 uppercase tracking-wider text-[10px] font-mono">
                    Context Window
                  </th>
                  <th className="text-left py-4 text-white/40 font-bold px-4 uppercase tracking-wider text-[10px] font-mono">
                    Speed
                  </th>
                </tr>
              </thead>
              <tbody className="text-white/80 font-medium">
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-5 px-4 text-white font-bold">Free</td>
                  <td className="py-5 px-4">Haiku 4.5 / Qwen3 Coder</td>
                  <td className="py-5 px-4 text-white/40">Standard (128k)</td>
                  <td className="py-5 px-4 text-[#ccff00] font-black uppercase text-xs tracking-wider">Lightning</td>
                </tr>
                <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-5 px-4 text-[#ccff00] font-black">Pro</td>
                  <td className="py-5 px-4">Sonnet 4.6 / GLM-5</td>
                  <td className="py-5 px-4 text-white/40">Enhanced (200k)</td>
                  <td className="py-5 px-4 text-emerald-400 font-bold uppercase text-xs tracking-wider">Instant</td>
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-5 px-4 text-[#00f0ff] font-bold">Ultra</td>
                  <td className="py-5 px-4">Claude Opus 4.8 / 4.7</td>
                  <td className="py-5 px-4 text-white/40">Deep Window (1M+)</td>
                  <td className="py-5 px-4 text-blue-400 font-bold uppercase text-xs tracking-wider">Priority Queue</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* JUICE REFILL PACKS */}
          <div className="bg-[#08090c]/45 border border-white/5 rounded-[2.5rem] p-10 md:p-12 shadow-2xl text-center relative overflow-hidden z-20">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-3">
              Need a quick squeeze?
            </h3>
            <p className="text-white/60 text-sm mb-10 max-w-md mx-auto font-medium">
              Refill your workspace credits instantly using safe, secure one-off Robux packs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Refill 1 */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2 font-mono">Small Sip</span>
                <div className="text-2xl font-black text-white mb-1">350 R$</div>
                <div className="text-xs text-[#ccff00] font-black uppercase tracking-wide mb-6">5.0 Credits Refill</div>
                <button
                  onClick={() =>
                    window.open(
                      "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                      "_blank"
                    )
                  }
                  className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all uppercase tracking-wider"
                >
                  Buy Pack
                </button>
              </div>

              {/* Refill 2 */}
              <div className="bg-[#08090c]/70 border-2 border-[#ccff00] rounded-2xl p-6 flex flex-col items-center relative shadow-[0_0_20px_rgba(204,255,0,0.1)]">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ccff00] text-black text-[8px] font-black uppercase tracking-wider py-1 px-4 rounded-full">
                  Best Value
                </div>
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2 mt-1 font-mono">Juice Box</span>
                <div className="text-2xl font-black text-white mb-1">950 R$</div>
                <div className="text-xs text-[#ccff00] font-black uppercase tracking-wide mb-6">20.0 Credits Refill</div>
                <button
                  onClick={() =>
                    window.open(
                      "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                      "_blank"
                    )
                  }
                  className="w-full h-10 rounded-xl bg-[#ccff00] text-black font-black text-xs hover:bg-[#d4ff33] transition-all uppercase tracking-wider"
                >
                  Buy Pack
                </button>
              </div>

              {/* Refill 3 */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2 font-mono">Mega Jug</span>
                <div className="text-2xl font-black text-white mb-1">3,000 R$</div>
                <div className="text-xs text-[#ccff00] font-black uppercase tracking-wide mb-6">80.0 Credits Refill</div>
                <button
                  onClick={() =>
                    window.open(
                      "https://www.roblox.com/games/137859423074162/Apple-Juice-Shop",
                      "_blank"
                    )
                  }
                  className="w-full h-10 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all uppercase tracking-wider"
                >
                  Buy Pack
                </button>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ━━━ FAQ (Light Accents Accordion) ━━━ */}
      <section id="faq" className="px-6 py-24 md:py-32 relative">
        <div className="max-w-[850px] mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white">
              Questions?
            </h2>
            <p className="text-white/50 text-sm mt-3 font-medium">
              Everything you need to know about setting up Apple Juice.
            </p>
          </div>
          <div className="rounded-3xl border border-white/12 bg-white/[0.04] backdrop-blur-md px-8 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
            {FAQ_ITEMS.map((item, i) => (
              <FaqItemPremium key={i} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>      {/* ━━━ BOTTOM CALL-TO-ACTION ━━━ */}
      <section className="px-6 pb-28">
        <div className="max-w-[1000px] mx-auto text-center p-12 md:p-24 rounded-[3rem] bg-white/[0.06] border border-white/15 backdrop-blur-2xl text-white relative overflow-hidden shadow-[0_32px_100px_rgba(0,0,0,0.45)]">
          <div className="absolute -top-36 left-1/4 w-[400px] h-[400px] bg-blue-500/[0.1] rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-36 right-1/4 w-[400px] h-[400px] bg-[#ccff00]/[0.06] rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(100%,520px)] h-[280px] bg-white/[0.07] rounded-full blur-[90px] pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tight mb-8 leading-none">
              Ship your next <br /> mechanic <span className="text-[#ccff00]">tonight.</span>
            </h2>
            <p className="text-base text-white/60 mb-12 max-w-lg mx-auto font-medium leading-relaxed">
              Join developers building Roblox games at weightless speeds. Completely independent, MIT licensed, and fully secure.
            </p>

            <button
              onClick={() =>
                session
                  ? (window.location.href = "/dashboard")
                  : setShowAuthGuide(true)
              }
              className="h-14 px-10 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-[#d4ff33] transition-all mx-auto shadow-[0_0_20px_rgba(204,255,0,0.35)] hover:scale-105 active:scale-95"
            >
              Start Engineering Free
              <ArrowRight className="h-4 w-4 text-black font-black" />
            </button>
          </div>
        </div>
      </section>

      {/* ━━━ FOOTER with stark black Antigravity-style typography ━━━ */}
      <footer className="px-6 md:px-12 xl:px-20 py-24 border-t border-white/10 relative z-10 flex flex-col items-center bg-gradient-to-b from-transparent via-white/[0.02] to-white/[0.05]">

        {/* Top footer row: Title and Link Columns */}
        <div className="w-full max-w-[1400px] flex flex-col md:flex-row justify-between items-start gap-12 mb-12">
          <div className="text-xl md:text-2xl font-black tracking-tight text-white">
            Experience weightless coding.
          </div>

          <div className="flex gap-16 md:gap-28">
            <div className="flex flex-col gap-3.5">
              <span className="text-[10px] uppercase font-bold text-white/40 font-mono tracking-wider">Product</span>
              <a href="#explore" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">Web IDE</a>
              <a href="#features" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">Features</a>
              <a href="#cli" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">CLI</a>
              <a href="#pricing" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">Pricing</a>
            </div>

            <div className="flex flex-col gap-3.5">
              <span className="text-[10px] uppercase font-bold text-white/40 font-mono tracking-wider">Connect</span>
              <a
                href="https://github.com/inetixus/apple-juice"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-white/60 hover:text-white transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://discord.gg/EV5QSefDKc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-white/60 hover:text-white transition-colors"
              >
                Discord
              </a>
              <a href="/support" className="text-xs font-semibold text-white/60 hover:text-white transition-colors">Support</a>
            </div>
          </div>
        </div>

        {/* Stark, fully visible, massive glowing premium branding signature text */}
        <div className="w-full select-none py-10 relative overflow-hidden">
          {/* Background glow behind text */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.12),transparent_55%)] pointer-events-none" />
          <h2 className="text-[13vw] font-black tracking-[-0.04em] text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/25 leading-[0.85] text-center select-none font-sans filter drop-shadow-[0_0_40px_rgba(255,255,255,0.15)]">
            Apple Juice
          </h2>
        </div>

        {/* Bottom footer metadata row */}
        <div className="w-full max-w-[1400px] border-t border-white/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#ccff00] flex items-center justify-center text-black text-[10px] font-black shadow-[0_0_10px_rgba(204,255,0,0.3)] font-mono">
              +
            </div>
            <span className="text-xs font-black tracking-wider text-white uppercase font-mono">
              Apple Juice
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 text-[11px] text-white/40 font-semibold">
            <a href="/tos" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a
              href="/dashboard?tester=1"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 text-white/35 hover:text-white hover:border-white/25 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00]/70" />
              Tester access
            </a>
            <span className="text-[10px] text-white/30 font-medium">Not affiliated with Roblox Corporation.</span>
          </div>
        </div>
      </footer>

      </div>

      {/* ━━━ OAUTH GUIDE DIALOG MODAL ━━━ */}
      {showAuthGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthGuide(false);
          }}
        >
          <div className="w-full max-w-2xl bg-[#08090c]/90 border border-white/10 rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200 backdrop-blur-2xl">
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-transparent">
              <span className="font-bold text-xs tracking-widest uppercase text-white/40 font-mono">
                Secure Client Identification
              </span>
              <button
                onClick={() => setShowAuthGuide(false)}
                className="text-white/40 hover:text-white p-2 transition-colors rounded-full"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto max-h-[70vh]">
              <p className="text-white/60 text-sm leading-relaxed mb-8 font-medium">
                Entering Apple Juice opens an official Roblox or Google OAuth 2.0 authorization screen. Here is a secure overview of the scope parameters:
              </p>

              <div className="space-y-6">

                {/* Section 1 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="h-8 w-8 rounded-full bg-[#ccff00] text-black flex items-center justify-center font-black text-xs shadow-sm font-mono">
                      1
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Roblox Identity Verification
                    </h3>
                  </div>
                  <p className="text-xs text-white/60 mb-4 leading-relaxed font-medium">
                    Roblox shares only your public User ID and public username/avatar.
                  </p>
                  <ul className="text-xs text-white/70 space-y-2 list-disc pl-5 leading-relaxed font-medium">
                    <li>We utilize credentials only to coordinate active game projects.</li>
                    <li><span className="font-semibold text-white">We never receive passwords, emails, or recovery states.</span></li>
                    <li><span className="font-semibold text-white">We cannot view Robux balances, inventories, or transactions.</span></li>
                  </ul>
                </div>

                {/* Section 2 */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="h-8 w-8 rounded-full bg-[#ccff00] text-black flex items-center justify-center font-black text-xs shadow-sm font-mono">
                      2
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      WebSocket pairing tokens
                    </h3>
                  </div>
                  <p className="text-xs text-white/60 mb-4 leading-relaxed font-medium">
                    Our Roblox Creator Store plugin pairs workspace structures safely.
                  </p>
                  <ul className="text-xs text-white/70 space-y-2 leading-relaxed font-medium list-disc pl-5">
                    <li><span className="font-semibold text-white">Writes Scripts:</span> Appends or syncs generated codes to open projects.</li>
                    <li><span className="font-semibold text-white">Workspace Outline:</span> Maps folders and local layouts so the model spots parent instances.</li>
                  </ul>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-white/5 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest font-mono text-center sm:text-left">
                Independent Roblox utility
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAuthGuide(false)}
                  className="px-6 py-2.5 rounded-full border border-white/10 text-white/60 hover:bg-white/5 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    signIn("google", { callbackUrl: "/dashboard" })
                  }
                  className="px-6 py-2.5 rounded-full bg-white/5 text-white border border-white/10 hover:bg-white/10 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                  >
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
                  Google
                </button>
                <button
                  onClick={() =>
                    signIn("roblox", { callbackUrl: "/dashboard" })
                  }
                  className="px-6 py-2.5 rounded-full bg-[#ccff00] text-black font-black hover:bg-[#d4ff33] text-xs uppercase tracking-wider transition-all shadow-sm"
                >
                  Roblox
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
