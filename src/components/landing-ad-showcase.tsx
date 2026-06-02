"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Play, RotateCcw, ArrowRight, Check } from "lucide-react";
import { useInView } from "@/hooks/use-in-view";
import { getLandingPerfConfig } from "@/lib/landing-perf";
import { MagneticButton } from "./magnetic-button";
import { AppleJuiceLogo } from "./apple-juice-logo";
import {
  ClickRipple,
  DemoCursor,
  useHumanDemoCursor,
} from "@/hooks/use-human-demo-cursor";
import { sleep } from "@/lib/human-cursor-motion";

/* ─────────────────────────────────────────────────────────────
   Self-contained cinematic ad — its own script, not a replay of
   the hero product demo. A rAF clock drives the camera, scrubber
   and timecode; the on-screen pointer reuses the exact hero cursor
   system (curved arcs, speed-based deform, click-image swap).
   ───────────────────────────────────────────────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;
const STAGE_HEIGHT = "min(560px, 74vw)";

type AdTarget = "describe-input" | "describe-go" | "cta-start";

type Scene = { id: string; label: string; duration: number };

const SCENE_DEFS: Scene[] = [
  { id: "cold-open", label: "Intro", duration: 3.4 },
  { id: "brand", label: "Apple Juice", duration: 3.0 },
  { id: "describe", label: "Describe", duration: 4.4 },
  { id: "generate", label: "Generate", duration: 4.0 },
  { id: "sync", label: "Sync to Studio", duration: 3.8 },
  { id: "proof", label: "Results", duration: 3.4 },
  { id: "cta", label: "Get started", duration: 4.0 },
];

const SCENES = SCENE_DEFS.reduce<(Scene & { start: number })[]>((acc, s) => {
  const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].duration : 0;
  acc.push({ ...s, start });
  return acc;
}, []);
const TOTAL = SCENES.reduce((sum, s) => sum + s.duration, 0);

/* ─── math helpers ─── */
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
/** Short gaussian impulse — snap "punch". */
const punch = (p: number, center: number, amp: number) =>
  amp * Math.exp(-Math.pow((p - center) / 0.05, 2));

function sceneIndexAt(elapsed: number): number {
  for (let i = 0; i < SCENES.length; i++) {
    if (elapsed < SCENES[i].start + SCENES[i].duration) return i;
  }
  return SCENES.length - 1;
}

function formatTC(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* ─── camera rig (scale + pan, origin center) ─── */
function cameraFor(id: string, p: number, on: boolean) {
  if (!on) return { scale: 1, x: 0, y: 0 };
  switch (id) {
    case "cold-open":
      return { scale: 1.05 + 0.07 * easeInOut(p), x: 0, y: 0 };
    case "brand": {
      const settle = easeOutCubic(Math.min(1, p / 0.35));
      return { scale: 1.18 - 0.18 * settle, x: 0, y: 0 };
    }
    case "describe":
      return { scale: 1.05 + 0.08 * easeInOut(p), x: 10 * easeInOut(p), y: 0 };
    case "generate":
      return { scale: 1.03 + 0.1 * easeInOut(p), x: 0, y: -18 * easeInOut(p) };
    case "sync":
      return { scale: 1.08 + 0.06 * easeInOut(p) - punch(p, 0.72, 0.05), x: 0, y: 0 };
    case "proof": {
      const settle = easeOutCubic(Math.min(1, p / 0.35));
      return { scale: 1.16 - 0.16 * settle, x: 0, y: 0 };
    }
    case "cta":
      return { scale: 1.02 + 0.06 * easeInOut(p), x: 0, y: 0 };
    default:
      return { scale: 1, x: 0, y: 0 };
  }
}

/* ─── per-scene grading + accents ─── */
const SCENE_WASH: Record<string, string> = {
  "cold-open": "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.05), transparent 70%)",
  brand: "radial-gradient(ellipse 80% 70% at 50% 45%, rgba(204,255,0,0.12), transparent 68%)",
  describe: "radial-gradient(ellipse 75% 65% at 30% 55%, rgba(59,130,246,0.12), transparent 66%)",
  generate: "radial-gradient(ellipse 80% 70% at 70% 50%, rgba(139,92,246,0.13), transparent 66%)",
  sync: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(204,255,0,0.12), transparent 64%)",
  proof: "radial-gradient(ellipse 78% 68% at 50% 50%, rgba(255,140,0,0.12), transparent 66%)",
  cta: "radial-gradient(ellipse 90% 80% at 50% 55%, rgba(204,255,0,0.16), transparent 62%)",
};

const SCENE_FLASH: Record<string, string> = {
  "cold-open": "rgba(255,255,255,0.35)",
  brand: "rgba(204,255,0,0.5)",
  describe: "rgba(59,130,246,0.45)",
  generate: "rgba(139,92,246,0.45)",
  sync: "rgba(204,255,0,0.45)",
  proof: "rgba(255,140,0,0.45)",
  cta: "rgba(204,255,0,0.5)",
};

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

function SpeedBurst({ tint }: { tint: string }) {
  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 z-[22] pointer-events-none mix-blend-screen"
      style={{
        background: `repeating-conic-gradient(from 0deg, ${tint} 0deg 0.6deg, transparent 0.6deg 6deg)`,
        maskImage: "radial-gradient(circle at 50% 50%, transparent 28%, black 78%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 50%, transparent 28%, black 78%)",
      }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 0.45, 0], scale: 1.5, rotate: 6 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    />
  );
}

/* ════════════════ SCENES ════════════════ */

function ColdOpen({ p }: { p: number }) {
  const words = ["Copy.", "Paste.", "Repeat."];
  const reveal = p > 0.62;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 relative">
        {words.map((w, i) => {
          const on = p > 0.08 + i * 0.13;
          return (
            <motion.span
              key={w}
              initial={false}
              animate={{
                opacity: on ? (reveal ? 0.25 : 0.85) : 0,
                y: on ? 0 : 18,
                filter: on ? "blur(0px)" : "blur(6px)",
              }}
              transition={{ duration: 0.45, ease: EASE }}
              className="font-mono text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white"
            >
              {w}
            </motion.span>
          );
        })}
        <motion.span
          aria-hidden
          initial={false}
          animate={{ scaleX: reveal ? 1 : 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          style={{ originX: 0 }}
          className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 bg-[#ccff00] rounded-full shadow-[0_0_16px_rgba(204,255,0,0.7)]"
        />
      </div>
      <AnimatePresence>
        {reveal && (
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-7 text-base sm:text-xl font-bold text-white/70"
          >
            There&apos;s a faster way to ship Roblox code.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function BrandReveal({ p }: { p: number }) {
  const show = p > 0.05;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
      <motion.span
        aria-hidden
        initial={false}
        animate={{ scale: show ? 2.6 : 0.2, opacity: show ? 0 : 0.5 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        className="absolute h-40 w-40 rounded-full border border-[#ccff00]/40"
      />
      <motion.div
        initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative mb-5"
      >
        <div className="absolute inset-0 rounded-3xl bg-[#ccff00]/25 blur-3xl scale-125" aria-hidden />
        <AppleJuiceLogo className="relative h-16 w-16 sm:h-20 sm:w-20 drop-shadow-[0_10px_40px_rgba(204,255,0,0.4)]" />
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, letterSpacing: "0.5em", y: 10 }}
        animate={{ opacity: 1, letterSpacing: "0.28em", y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
        className="text-2xl sm:text-4xl font-black uppercase text-white"
      >
        Apple Juice
      </motion.h3>
      <div className="relative mt-4">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="text-sm sm:text-lg font-semibold text-white/55"
        >
          Roblox Studio, elevated by AI.
        </motion.p>
        <motion.span
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={{ scaleX: p > 0.5 ? 1 : 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ originX: 0.5 }}
          className="block mx-auto mt-2 h-[2px] w-32 bg-gradient-to-r from-transparent via-[#ccff00] to-transparent"
        />
      </div>
    </div>
  );
}

function SceneFrame({
  index,
  eyebrow,
  headline,
  children,
}: {
  index: string;
  eyebrow: string;
  headline: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 px-8 md:px-14">
      <div className="w-full md:w-[42%] text-center md:text-left">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="inline-flex items-center gap-2 mb-4"
        >
          <span className="text-[10px] font-black tracking-[0.3em] text-[#ccff00]">{index}</span>
          <span className="h-px w-8 bg-[#ccff00]/40" />
          <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/40">{eyebrow}</span>
        </motion.div>
        <motion.h3
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.06, ease: EASE }}
          className="text-2xl sm:text-4xl md:text-[2.6rem] font-black text-white leading-[1.05] tracking-tight"
        >
          {headline}
        </motion.h3>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
        className="w-full md:w-[52%] max-w-[460px]"
      >
        {children}
      </motion.div>
    </div>
  );
}

function BeatDescribe({
  p,
  pressed,
  reg,
}: {
  p: number;
  pressed: boolean;
  reg: (id: AdTarget) => (el: HTMLElement | null) => void;
}) {
  const full = "Build a double jump for my obby";
  const chars = Math.floor(full.length * clamp01((p - 0.2) * 1.5));
  const typed = full.slice(0, chars);
  const done = chars >= full.length;
  return (
    <SceneFrame
      index="01"
      eyebrow="Describe"
      headline={
        <>
          Just say what
          <br />
          you want to build.
        </>
      }
    >
      <div className="rounded-2xl border border-white/10 bg-[#0a0b10]/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-9 border-b border-white/[0.06]">
          <AppleJuiceLogo className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Apple Juice · Studio chat</span>
        </div>
        <div className="p-4">
          <div
            ref={reg("describe-input")}
            className="rounded-xl border border-[#ccff00]/25 bg-[#ccff00]/[0.06] px-4 py-3 min-h-[58px] text-sm text-white/90 font-medium"
          >
            {typed}
            {!done && <span className="inline-block w-0.5 h-4 bg-[#ccff00] ml-0.5 align-middle animate-pulse" />}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-semibold text-white/50">
              MyObbyGame.rbxl
            </span>
            <motion.span
              ref={reg("describe-go")}
              animate={{
                opacity: done ? 1 : 0.45,
                scale: pressed ? 0.92 : 1,
                boxShadow: pressed
                  ? "0 0 0 3px rgba(204,255,0,0.35), 0 0 22px rgba(204,255,0,0.6)"
                  : "0 0 0 0 rgba(204,255,0,0)",
              }}
              transition={{ duration: 0.12 }}
              className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ccff00] text-black text-[11px] font-black"
            >
              Let&apos;s go <ArrowRight className="h-3 w-3" />
            </motion.span>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

const CODE_LINES: { text: string; tone: "plain" | "kw" | "com" | "fn" }[] = [
  { text: "local DoubleJump = {}", tone: "kw" },
  { text: "local MAX_JUMPS = 2", tone: "kw" },
  { text: "", tone: "plain" },
  { text: "-- reset jumps on respawn", tone: "com" },
  { text: "Players.PlayerAdded:Connect(function(p)", tone: "fn" },
  { text: "  jumps[p] = 0", tone: "plain" },
  { text: "end)", tone: "fn" },
];
const TONE_CLASS: Record<string, string> = {
  plain: "text-white/70",
  kw: "text-[#ccff00]",
  com: "text-white/30 italic",
  fn: "text-sky-300",
};

function BeatGenerate({ p }: { p: number }) {
  const visible = Math.floor(CODE_LINES.length * clamp01((p - 0.12) * 1.6));
  return (
    <SceneFrame
      index="02"
      eyebrow="Generate"
      headline={
        <>
          Production Luau,
          <br />
          written for you.
        </>
      }
    >
      <div className="rounded-2xl border border-white/10 bg-[#08090d]/95 shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden font-mono">
        <div className="flex items-center gap-1.5 px-4 h-9 border-b border-white/[0.06]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          <span className="ml-2 text-[10px] text-white/45 font-sans font-semibold">DoubleJump.server.lua</span>
        </div>
        <div className="p-4 space-y-1 min-h-[180px]">
          {CODE_LINES.map((line, i) => (
            <motion.div
              key={i}
              initial={false}
              animate={{ opacity: i < visible ? 1 : 0, x: i < visible ? 0 : -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex gap-3 text-[12px] leading-5"
            >
              <span className="w-4 text-right text-white/20 select-none">{i + 1}</span>
              <span className={TONE_CLASS[line.tone]}>{line.text || "\u00A0"}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
}

function BeatSync({ p }: { p: number }) {
  const travel = easeOutCubic(clamp01((p - 0.2) * 1.5));
  const landed = p > 0.72;
  return (
    <SceneFrame
      index="03"
      eyebrow="Sync to Studio"
      headline={
        <>
          It lands in Studio.
          <br />
          <span className="text-[#ccff00]">Live.</span>
        </>
      }
    >
      <div className="rounded-2xl border border-white/10 bg-[#0a0b10]/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="relative h-16 border-b border-white/[0.06] flex items-center px-5">
          <span className="text-[10px] font-black uppercase tracking-wider text-white/40">AI</span>
          <div className="relative flex-1 mx-3 h-px bg-gradient-to-r from-[#ccff00]/30 via-white/15 to-[#ccff00]/30">
            <motion.div
              initial={false}
              animate={{ left: `${travel * 100}%` }}
              transition={{ ease: "linear" }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            >
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#ccff00] text-black text-[9px] font-black whitespace-nowrap shadow-[0_0_14px_rgba(204,255,0,0.5)]">
                .lua
              </span>
            </motion.div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Studio</span>
        </div>
        <div className="p-4 text-[11px] font-mono text-white/55 space-y-1">
          <p className="flex items-center gap-2">📁 Workspace</p>
          <p className="flex items-center gap-2 pl-4">📁 MyObbyGame</p>
          <motion.p
            initial={false}
            animate={{
              opacity: landed ? 1 : 0.15,
              backgroundColor: landed ? "rgba(204,255,0,0.10)" : "rgba(0,0,0,0)",
            }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2 pl-8 rounded-md py-0.5 text-[#ccff00]"
          >
            📄 DoubleJump.server.lua
            <AnimatePresence>
              {landed && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-auto flex items-center gap-1 text-[9px] font-sans font-bold"
                >
                  <Check className="h-3 w-3" /> synced
                </motion.span>
              )}
            </AnimatePresence>
          </motion.p>
        </div>
      </div>
    </SceneFrame>
  );
}

function Counter({ target, p, suffix = "" }: { target: number; p: number; suffix?: string }) {
  const val = Math.round(target * easeOutCubic(clamp01((p - 0.1) * 1.4)));
  return (
    <span>
      {val}
      {suffix}
    </span>
  );
}

function ProofScene({ p }: { p: number }) {
  const stats = [
    { value: 0, suffix: "", label: "Lines copy-pasted" },
    { value: 3, suffix: "", label: "Scripts synced live" },
    { value: 100, suffix: "%", label: "Clean Luau output" },
  ];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="text-[10px] font-black uppercase tracking-[0.32em] text-[#ccff00] mb-8"
      >
        From prompt to playtest
      </motion.p>
      <div className="grid grid-cols-3 gap-5 sm:gap-10 w-full max-w-[640px]">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
            className="text-center"
          >
            <div className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight tabular-nums">
              <Counter target={s.value} p={p} suffix={s.suffix} />
            </div>
            <div className="mt-2 text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-white/45 leading-tight">
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CtaScene({
  onCta,
  pressed,
  reg,
}: {
  onCta?: () => void;
  pressed: boolean;
  reg: (id: AdTarget) => (el: HTMLElement | null) => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#ccff00]/30 bg-[#ccff00]/10 mb-6"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00] animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ccff00]">Free & open source</span>
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
        className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.05]"
      >
        Build faster.
        <br />
        <span className="text-[#ccff00]">Ship to Studio.</span>
      </motion.h3>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.22, ease: EASE }}
        className="mt-8"
      >
        <motion.div animate={{ scale: pressed ? 0.94 : 1 }} transition={{ duration: 0.12 }}>
          <MagneticButton
            ref={reg("cta-start") as never}
            type="button"
            onClick={onCta}
            className="h-12 px-8 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] inline-flex items-center justify-center gap-2 hover:bg-[#d4ff33] shadow-[0_0_28px_rgba(204,255,0,0.4)] transition-all pointer-events-auto"
          >
            Start engineering free
            <ArrowRight className="h-4 w-4" />
          </MagneticButton>
        </motion.div>
      </motion.div>
    </div>
  );
}

type SceneCtx = {
  onCta?: () => void;
  reg: (id: AdTarget) => (el: HTMLElement | null) => void;
  pressedId: AdTarget | null;
};

function renderScene(id: string, p: number, ctx: SceneCtx): ReactNode {
  switch (id) {
    case "cold-open":
      return <ColdOpen p={p} />;
    case "brand":
      return <BrandReveal p={p} />;
    case "describe":
      return <BeatDescribe p={p} pressed={ctx.pressedId === "describe-go"} reg={ctx.reg} />;
    case "generate":
      return <BeatGenerate p={p} />;
    case "sync":
      return <BeatSync p={p} />;
    case "proof":
      return <ProofScene p={p} />;
    case "cta":
      return <CtaScene onCta={ctx.onCta} pressed={ctx.pressedId === "cta-start"} reg={ctx.reg} />;
    default:
      return null;
  }
}

/* ════════════════ MAIN ════════════════ */

export function LandingAdShowcase({ onCta }: { onCta?: () => void } = {}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cameraLayerRef = useRef<HTMLDivElement>(null);
  const targets = useRef<Partial<Record<AdTarget, HTMLElement>>>({});
  const isInView = useInView(wrapRef, { threshold: 0.2, rootMargin: "80px 0px" });
  const motionOn = getLandingPerfConfig().heroAutoplay;

  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clickAt, setClickAt] = useState(-10);
  const elapsedRef = useRef(0);
  const seqRef = useRef(0);

  // Hero cursor system — curved arcs, speed-based deform, click-image swap.
  const {
    cursorX,
    cursorY,
    cursorOn,
    setCursorOn,
    pressing,
    highlight,
    pressed,
    ripples,
    placeCursor,
    moveToTarget,
    clickTarget,
    clearHighlight,
  } = useHumanDemoCursor<AdTarget>({
    stageRef: cameraLayerRef,
    contentLayerRef: cameraLayerRef,
    targets,
    motionEnabled: motionOn,
  });

  const reg = useCallback(
    (id: AdTarget) => (el: HTMLElement | null) => {
      if (el) targets.current[id] = el;
      else delete targets.current[id];
    },
    [],
  );

  const sceneIdx = sceneIndexAt(elapsed);
  const scene = SCENES[sceneIdx];
  const sceneP = clamp01((elapsed - scene.start) / scene.duration);
  const playing = started && !ended && isInView;

  const start = useCallback(() => {
    elapsedRef.current = 0;
    setClickAt(-10);
    setElapsed(0);
    setEnded(false);
    setStarted(true);
  }, []);

  // autoplay once in view
  useEffect(() => {
    if (!motionOn || started || !isInView) return;
    const t = window.setTimeout(start, 400);
    return () => window.clearTimeout(t);
  }, [motionOn, started, isInView, start]);

  // master clock
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      let next = elapsedRef.current + dt;
      if (next >= TOTAL) {
        next = TOTAL;
        elapsedRef.current = next;
        setElapsed(next);
        setEnded(true);
        return;
      }
      elapsedRef.current = next;
      setElapsed(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // cursor choreography — runs per interactive scene using the hero cursor
  useEffect(() => {
    if (!motionOn || !playing) {
      setCursorOn(false);
      clearHighlight();
      return;
    }
    const token = ++seqRef.current;
    const gone = () => token !== seqRef.current;

    async function describeSeq() {
      await sleep(140);
      if (gone()) return;
      setCursorOn(true);
      placeCursor(0.52, 0.96);
      await moveToTarget("describe-input", { dwell: true, style: "arc" });
      if (gone()) return;
      await sleep(1400); // let the prompt type out
      if (gone()) return;
      await moveToTarget("describe-go", { dwell: true, style: "arc" });
      if (gone()) return;
      setClickAt(elapsedRef.current);
      await clickTarget("describe-go");
    }

    async function ctaSeq() {
      await sleep(900);
      if (gone()) return;
      setCursorOn(true);
      placeCursor(0.5, 0.98);
      await moveToTarget("cta-start", { dwell: true, style: "arc" });
      if (gone()) return;
      setClickAt(elapsedRef.current);
      await clickTarget("cta-start");
    }

    if (scene.id === "describe") describeSeq();
    else if (scene.id === "cta") ctaSeq();
    else {
      setCursorOn(false);
      clearHighlight();
    }

    return () => {
      seqRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, playing, motionOn]);

  const seek = useCallback((fraction: number) => {
    const t = clamp01(fraction) * TOTAL;
    elapsedRef.current = t;
    setClickAt(-10);
    setElapsed(t);
    setEnded(false);
    setStarted(true);
  }, []);

  const onScrubClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      seek((e.clientX - rect.left) / rect.width);
    },
    [seek],
  );

  const progress = elapsed / TOTAL;
  const showChrome = started;
  const wash = SCENE_WASH[scene.id] ?? SCENE_WASH["cold-open"];

  // camera + click "kick" punch-zoom
  const base = cameraFor(scene.id, sceneP, motionOn);
  const sinceClick = elapsed - clickAt;
  const kick = motionOn && sinceClick >= 0 && sinceClick < 0.6 ? 0.05 * Math.exp(-Math.pow(sinceClick / 0.12, 2)) : 0;
  const cam = { scale: base.scale + kick, x: base.x, y: base.y };

  return (
    <div ref={wrapRef} className="relative w-full max-w-[1100px] mx-auto">
      <div
        className="group relative overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#030304] shadow-[0_40px_120px_rgba(0,0,0,0.6)] ring-1 ring-white/5"
        style={{ minHeight: STAGE_HEIGHT }}
      >
        {/* color-graded wash */}
        <motion.div
          key={`wash-${scene.id}`}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{ background: wash }}
        />

        {/* light sweep */}
        {showChrome && motionOn && (
          <motion.div
            aria-hidden
            className="absolute inset-y-0 -left-1/3 w-1/3 z-[3] pointer-events-none"
            style={{ background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.045), transparent)" }}
            animate={{ x: ["0%", "420%"] }}
            transition={{ duration: 7, ease: "easeInOut", repeat: Infinity }}
          />
        )}

        {/* ── CAMERA LAYER (scenes + cursor live here so they zoom together) ── */}
        <div
          ref={cameraLayerRef}
          className="absolute inset-0 z-[10] origin-center will-change-transform"
          style={{
            minHeight: STAGE_HEIGHT,
            transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
          }}
        >
          {showChrome && (
            <AnimatePresence mode="sync">
              <motion.div
                key={scene.id}
                initial={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
                transition={{ duration: 0.5, ease: EASE }}
                className="absolute inset-0"
              >
                {renderScene(scene.id, sceneP, { onCta, reg, pressedId: pressed })}
              </motion.div>
            </AnimatePresence>
          )}

          {/* speed burst on impact scenes */}
          {showChrome && motionOn && (scene.id === "brand" || scene.id === "sync") && (
            <SpeedBurst key={`burst-${scene.id}`} tint={scene.id === "brand" ? "rgba(204,255,0,0.10)" : "rgba(255,255,255,0.08)"} />
          )}

          {/* hero cursor + click ripples */}
          {showChrome && motionOn && (
            <>
              {ripples.map((r) => (
                <ClickRipple key={r.id} id={r.id} point={r.p} />
              ))}
              <DemoCursor x={cursorX} y={cursorY} pressing={pressing} visible={cursorOn} hovering={highlight !== null} />
            </>
          )}
        </div>

        {/* scene-cut flash */}
        {showChrome && motionOn && (
          <motion.div
            key={`flash-${scene.id}`}
            aria-hidden
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="absolute inset-0 z-[24] pointer-events-none"
            style={{ background: `radial-gradient(ellipse 85% 75% at 50% 50%, ${SCENE_FLASH[scene.id]}, transparent 72%)` }}
          />
        )}

        {/* vignette */}
        <div
          aria-hidden
          className="absolute inset-0 z-[25] pointer-events-none"
          style={{ background: "radial-gradient(ellipse 78% 70% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)" }}
        />

        {/* film grain */}
        {showChrome && motionOn && (
          <motion.div
            aria-hidden
            className="absolute inset-0 z-[26] pointer-events-none mix-blend-overlay opacity-[0.12]"
            style={{ backgroundImage: GRAIN_URL, backgroundSize: "140px 140px" }}
            animate={{ backgroundPosition: ["0px 0px", "140px 70px", "70px 140px"] }}
            transition={{ duration: 0.6, ease: "linear", repeat: Infinity }}
          />
        )}

        {/* letterbox bars */}
        <motion.div
          aria-hidden
          className="absolute top-0 inset-x-0 z-[30] bg-black pointer-events-none"
          animate={{ height: showChrome ? "5%" : "0%" }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <motion.div
          aria-hidden
          className="absolute bottom-0 inset-x-0 z-[30] bg-black pointer-events-none"
          animate={{ height: showChrome ? "5%" : "0%" }}
          transition={{ duration: 0.6, ease: EASE }}
        />

        {/* HUD */}
        <AnimatePresence>
          {showChrome && (
            <>
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-3 left-4 z-[40] flex items-center gap-2 pointer-events-none"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.24em] text-white/55">{scene.label}</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-3 right-4 z-[40] flex items-center gap-2 pointer-events-none"
              >
                <AppleJuiceLogo className="h-3.5 w-3.5 opacity-70" />
                <span className="font-mono text-[10px] font-semibold text-white/45 tabular-nums">
                  {formatTC(elapsed)} / {formatTC(TOTAL)}
                </span>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* IDLE poster */}
        <AnimatePresence>
          {!started && (
            <motion.div
              key="poster"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[50] flex flex-col items-center justify-center bg-[#050508]"
            >
              <div aria-hidden className="absolute inset-0" style={{ background: SCENE_WASH.brand }} />
              <MagneticButton
                type="button"
                onClick={start}
                className="relative flex flex-col items-center gap-5 group/play pointer-events-auto"
              >
                <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#ccff00] text-black shadow-[0_0_50px_rgba(204,255,0,0.45)] group-hover/play:scale-105 transition-transform duration-300">
                  <Play className="w-9 h-9 ml-1" fill="currentColor" />
                </span>
                <span className="text-[11px] font-black uppercase tracking-[0.25em] text-white/55 group-hover/play:text-white/85">
                  Play the film · {formatTC(TOTAL)}
                </span>
              </MagneticButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ENDED — replay */}
        <AnimatePresence>
          {ended && (
            <motion.button
              key="replay"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={start}
              className="absolute bottom-5 right-5 z-[45] flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 border border-white/10 backdrop-blur-md text-white/80 hover:text-white hover:border-white/25 transition-all text-[10px] font-black uppercase tracking-wider pointer-events-auto"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Replay
            </motion.button>
          )}
        </AnimatePresence>

        {/* SCRUBBER */}
        {showChrome && (
          <div
            onClick={onScrubClick}
            className="absolute bottom-0 left-0 right-0 z-[42] h-4 flex items-end cursor-pointer group/scrub"
          >
            <div className="relative w-full h-[3px] group-hover/scrub:h-[5px] transition-all bg-white/[0.08]">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#ccff00] via-[#faa582] to-white/90"
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.12, ease: "linear" }}
              />
              {SCENES.slice(1).map((s) => (
                <span
                  key={s.id}
                  className="absolute top-1/2 -translate-y-1/2 h-2 w-px bg-white/25"
                  style={{ left: `${(s.start / TOTAL) * 100}%` }}
                />
              ))}
              <motion.span
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(204,255,0,0.8)] opacity-0 group-hover/scrub:opacity-100 transition-opacity"
                animate={{ left: `${progress * 100}%` }}
                transition={{ duration: 0.12, ease: "linear" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* chapter strip */}
      <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => seek((s.start + 0.01) / TOTAL)}
            className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all ${
              started && i === sceneIdx
                ? "border-[#ccff00]/40 bg-[#ccff00]/10 text-[#ccff00]"
                : "border-white/10 text-white/35 hover:text-white/60 hover:border-white/20"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
