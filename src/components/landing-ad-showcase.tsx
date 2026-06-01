"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useInView } from "@/hooks/use-in-view";
import { getLandingPerfConfig } from "@/lib/landing-perf";
import {
  LandingHeroShowcase,
  type HeroDemoStep,
} from "./landing-hero-showcase";
import { MagneticButton } from "./magnetic-button";
import { AppleJuiceLogo } from "./apple-juice-logo";

type AdPhase = "idle" | "intro" | "playing" | "outro";

const STAGE_HEIGHT = "min(520px, 72vw)";

const EASE = [0.22, 1, 0.36, 1] as const;

type AdBeat = {
  step: HeroDemoStep;
  eyebrow: string;
  headline: string;
  line: string;
};

const BEATS: AdBeat[] = [
  {
    step: "INITIAL",
    eyebrow: "01 · Studio mode",
    headline: "One surface for chat & Studio",
    line: "Open the Cowork-style builder tuned for your active place.",
  },
  {
    step: "MENU",
    eyebrow: "02 · Intent",
    headline: "Tell us what to build",
    line: "Generate Luau, sync scripts, run playtests — pick an action.",
  },
  {
    step: "PROMPT",
    eyebrow: "03 · Context",
    headline: "Attach the place you're editing",
    line: "Every script lands in the right hierarchy.",
  },
  {
    step: "LOADING",
    eyebrow: "04 · Warp build",
    headline: "AI synthesizes at full throttle",
    line: "Same cinematic warp loader as the hero preview.",
  },
  {
    step: "INJECTION",
    eyebrow: "05 · Injection",
    headline: "Bytecode streams into Studio",
    line: "Secure plugin — zero clipboard workflow.",
  },
  {
    step: "PROGRESS",
    eyebrow: "06 · Transparency",
    headline: "Watch every step complete",
    line: "Read → generate → push → diagnostics.",
  },
  {
    step: "DASHBOARD",
    eyebrow: "07 · Command center",
    headline: "Ship from one dashboard",
    line: "Chat, artifacts, and parallel tasks in one view.",
  },
];

const STEP_TO_BEAT: Record<HeroDemoStep, number> = {
  INITIAL: 0,
  TOGGLE: 0,
  MENU: 1,
  PROMPT: 2,
  FOLDER: 2,
  LOADING: 3,
  INJECTION: 4,
  PROGRESS: 5,
  DASHBOARD: 6,
  TASKS: 6,
};

function stepToBeatIndex(step: HeroDemoStep): number {
  return STEP_TO_BEAT[step] ?? 0;
}

function progressForBeatIndex(idx: number): number {
  if (BEATS.length <= 1) return 0.5;
  return 0.1 + (idx / (BEATS.length - 1)) * 0.75;
}

function AdLogoIntro() {
  return (
    <motion.div
      key="intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      className="absolute inset-0 z-[120] flex flex-col items-center justify-center bg-[#050508] text-center px-8 pointer-events-none"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.65, ease: EASE }}
        className="relative mb-6"
      >
        <div className="absolute inset-0 rounded-full bg-[#ccff00]/15 blur-3xl scale-125" aria-hidden />
        <AppleJuiceLogo className="relative h-14 w-14 sm:h-[4.25rem] sm:w-[4.25rem] drop-shadow-[0_8px_32px_rgba(204,255,0,0.25)]" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.5, ease: EASE }}
        className="text-[10px] font-black uppercase tracking-[0.38em] text-[#ccff00] mb-2"
      >
        Apple Juice
      </motion.p>
      <motion.h3
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.55, ease: EASE }}
        className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight max-w-md"
      >
        Roblox Studio,{" "}
        <span className="text-[#ccff00]">elevated by AI</span>
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.45 }}
        className="mt-3 text-xs sm:text-sm text-white/45 font-medium max-w-sm"
      >
        Luau generation · live Studio sync · zero copy-paste
      </motion.p>
    </motion.div>
  );
}

function AdReadyToShip() {
  return (
    <motion.div
      key="outro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      className="absolute inset-0 z-[120] flex flex-col items-center justify-center bg-[#050508] text-center px-8 pointer-events-none"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#ccff00]/30 bg-[#ccff00]/10 mb-5"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00]" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ccff00]">
          Ready to ship
        </span>
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: EASE }}
        className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight"
      >
        Build faster.{" "}
        <span className="text-[#ccff00]">Ship to Studio.</span>
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="mt-3 text-sm text-white/45 font-medium"
      >
        Generated Luau, pushed live to your open place.
      </motion.p>
    </motion.div>
  );
}

function AdInVideoCopy({ beat, visible }: { beat: AdBeat; visible: boolean }) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={`${beat.step}-${beat.headline}`}
          className="absolute inset-0 z-[108] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="absolute top-4 left-4 sm:top-5 sm:left-5 max-w-[min(100%,280px)]"
          >
            <span className="inline-block px-2.5 py-1 rounded-md border border-[#ccff00]/25 bg-black/70 backdrop-blur-md text-[9px] font-black uppercase tracking-[0.22em] text-[#ccff00]">
              {beat.eyebrow}
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06, ease: EASE }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[min(100%,440px)] px-4 sm:px-5"
          >
            <div className="rounded-2xl border border-white/[0.12] bg-black/80 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.55)] px-4 py-3 text-center">
              <p className="text-xs sm:text-sm font-bold text-white/95 leading-snug tracking-tight">
                {beat.headline}
              </p>
              <p className="mt-1 text-[10px] sm:text-[11px] text-white/55 font-medium leading-snug">
                {beat.line}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function LandingAdShowcase() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(wrapRef, { threshold: 0.12, rootMargin: "100px 0px" });
  const autoplay = getLandingPerfConfig().heroAutoplay;

  const [phase, setPhase] = useState<AdPhase>("idle");
  const [beatIndex, setBeatIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [runKey, setRunKey] = useState(0);

  const beat = BEATS[beatIndex] ?? BEATS[0];

  const startCycle = useCallback(() => {
    setBeatIndex(0);
    setProgress(0);
    setPhase("intro");
  }, []);

  useEffect(() => {
    if (!isInView || !autoplay || phase !== "idle") return;
    const t = window.setTimeout(startCycle, 500);
    return () => window.clearTimeout(t);
  }, [autoplay, isInView, phase, startCycle]);

  useEffect(() => {
    if (phase !== "intro") return;
    const t = window.setTimeout(() => {
      setRunKey((k) => k + 1);
      setPhase("playing");
    }, 2600);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "outro") return;
    const t = window.setTimeout(() => {
      startCycle();
    }, 2800);
    return () => window.clearTimeout(t);
  }, [phase, startCycle]);

  useEffect(() => {
    if (phase === "idle") setProgress(0);
    else if (phase === "intro") setProgress(0.06);
    else if (phase === "outro") setProgress(1);
  }, [phase]);

  const onStepChange = useCallback((step: HeroDemoStep) => {
    const idx = stepToBeatIndex(step);
    setBeatIndex(idx);
    setProgress(Math.max(0.1, progressForBeatIndex(idx)));
  }, []);

  const onDemoComplete = useCallback(() => {
    setProgress(1);
    setPhase("outro");
  }, []);

  const stageOverlay = <AdInVideoCopy beat={beat} visible={phase === "playing"} />;

  return (
    <div ref={wrapRef} className="relative w-full max-w-[1100px] mx-auto">
      <div
        className="relative overflow-hidden border border-white/[0.08] bg-[#030304]"
        style={{ minHeight: STAGE_HEIGHT }}
      >
        <div className="relative z-[10]" style={{ minHeight: STAGE_HEIGHT }}>
          {phase === "playing" && (
            <LandingHeroShowcase
              key={runKey}
              loop={false}
              active
              runKey={runKey}
              layoutGroupId="ad-hero-demo"
              layoutCardId="ad-hero-card"
              showCaptions={false}
              sharpFrame
              stageOverlay={stageOverlay}
              onStepChange={onStepChange}
              onComplete={onDemoComplete}
              className="max-w-none px-0"
              stageClassName="border-0 shadow-none"
            />
          )}

          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[#050508] cursor-none"
              >
                <MagneticButton
                  type="button"
                  onClick={startCycle}
                  className="flex flex-col items-center gap-5 group pointer-events-auto"
                >
                  <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#ccff00] text-black shadow-[0_0_50px_rgba(204,255,0,0.4)] group-hover:scale-105 transition-transform duration-300">
                    <Play className="w-10 h-10 ml-1" fill="currentColor" />
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-[0.25em] text-white/50 group-hover:text-white/75">
                    Play product film
                  </span>
                </MagneticButton>
              </motion.div>
            )}

            {phase === "intro" && <AdLogoIntro />}
            {phase === "outro" && <AdReadyToShip />}
          </AnimatePresence>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-[140] h-[3px] bg-white/[0.06] pointer-events-none">
          <motion.div
            className="h-full bg-gradient-to-r from-[#ccff00] via-[#faa582] to-white/90"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}
