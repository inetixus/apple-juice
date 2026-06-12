"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  FileCode,
  FolderOpen,
  Sparkles,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

/**
 * Vertical product showcase purpose-built for the tall login media column.
 * Two columns of Apple-Juice UI cards drift in opposite directions on an
 * infinite loop, filling the full height of the panel without dead space.
 */
export function LoginShowcase() {
  const reduce = useReducedMotion();

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* top & bottom fades so cards emerge / vanish softly */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 z-20 bg-gradient-to-b from-[#08090c] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 z-20 bg-gradient-to-t from-[#08090c] to-transparent" />

      <div className="absolute inset-0 flex justify-center gap-4 px-6">
        <MarqueeColumn direction="up" duration={reduce ? 0 : 34}>
          {COLUMN_A}
        </MarqueeColumn>
        <MarqueeColumn
          direction="down"
          duration={reduce ? 0 : 40}
          className="hidden xl:flex"
        >
          {COLUMN_B}
        </MarqueeColumn>
      </div>
    </div>
  );
}

function MarqueeColumn({
  children,
  direction,
  duration,
  className = "",
}: {
  children: ReactNode[];
  direction: "up" | "down";
  duration: number;
  className?: string;
}) {
  const from = direction === "up" ? "0%" : "-50%";
  const to = direction === "up" ? "-50%" : "0%";

  return (
    <div className={`relative w-[290px] max-w-[44%] overflow-hidden ${className}`}>
      <motion.div
        className="flex flex-col gap-4"
        initial={{ y: from }}
        animate={duration ? { y: [from, to] } : { y: "-25%" }}
        transition={
          duration
            ? { duration, ease: "linear", repeat: Infinity }
            : undefined
        }
      >
        {/* duplicate the set so the loop is seamless */}
        {[...children, ...children].map((child, i) => (
          <div key={i}>{child}</div>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Card shell ─── */
function Card({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: "lime" | "violet" | "blue";
}) {
  const ring =
    accent === "lime"
      ? "border-[#ccff00]/30 shadow-[0_0_30px_rgba(204,255,0,0.10)]"
      : accent === "violet"
        ? "border-violet-400/30 shadow-[0_0_30px_rgba(139,92,246,0.12)]"
        : accent === "blue"
          ? "border-blue-400/25 shadow-[0_0_30px_rgba(59,130,246,0.10)]"
          : "border-white/10";
  return (
    <div
      className={`rounded-3xl border bg-white/[0.04] backdrop-blur-xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45)] ${ring}`}
    >
      {children}
    </div>
  );
}

/* ─── Individual product cards ─── */

const PromptCard = (
  <Card accent="lime">
    <div className="flex items-center gap-2 mb-3">
      <div className="h-7 w-7 rounded-lg bg-[#ccff00]/15 border border-[#ccff00]/30 flex items-center justify-center">
        <Sparkles className="h-3.5 w-3.5 text-[#ccff00]" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
        Generate Luau
      </span>
    </div>
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] text-white/85 leading-snug">
      Build a double jump system for my obby
    </div>
    <div className="mt-3 flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-white/50">
        <FolderOpen className="h-3 w-3" /> MyObbyGame
      </span>
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ccff00] text-black text-[9px] font-black uppercase tracking-wider">
        Let&apos;s go <ArrowRight className="h-3 w-3" />
      </span>
    </div>
  </Card>
);

const SyncCard = (
  <Card accent="blue">
    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
      Syncing to Studio
    </span>
    <div className="mt-3 space-y-2">
      {[
        "Read workspace hierarchy",
        "Generate DoubleJump.server.lua",
        "Push scripts to Studio",
        "Run playtest diagnostics",
      ].map((t, i) => (
        <div key={t} className="flex items-center gap-2.5">
          {i < 3 ? (
            <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
          ) : (
            <span className="h-4 w-4 rounded-full border-2 border-blue-400/60 border-t-transparent animate-spin shrink-0" />
          )}
          <span
            className={`text-[11px] font-medium ${i < 3 ? "text-white/70" : "text-white/45"}`}
          >
            {t}
          </span>
        </div>
      ))}
    </div>
  </Card>
);

const StatsCard = (
  <Card>
    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
      Double Jump System
    </span>
    <div className="mt-3 grid grid-cols-3 gap-2">
      {[
        { n: "2", l: "Max jumps" },
        { n: "3", l: "Scripts" },
        { n: "0", l: "Errors" },
      ].map((s) => (
        <div
          key={s.l}
          className="rounded-xl bg-black/40 border border-white/10 p-2.5 text-center"
        >
          <p className="text-lg font-black text-white">{s.n}</p>
          <p className="text-[8px] text-white/40 uppercase tracking-wide mt-0.5">
            {s.l}
          </p>
        </div>
      ))}
    </div>
  </Card>
);

const CodeCard = (
  <Card accent="violet">
    <div className="flex items-center gap-2 mb-3">
      <FileCode className="h-3.5 w-3.5 text-violet-300" />
      <span className="text-[10px] font-semibold text-white/60 font-mono truncate">
        DoubleJump.server.lua
      </span>
    </div>
    <pre className="text-[10px] font-mono leading-relaxed text-white/55 whitespace-pre-wrap">
      {`local MAX_JUMPS = 2
local jumps = {}

Humanoid.StateChanged:Connect(
  function(_, new)
    -- server-authoritative
  end)`}
    </pre>
  </Card>
);

const JuiceMeterCard = (
  <Card accent="lime">
    <div className="flex items-center justify-between mb-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
        Daily Juice
      </span>
      <Zap className="h-3.5 w-3.5 text-[#ccff00]" />
    </div>
    <div className="h-2.5 w-full rounded-full bg-white/8 overflow-hidden">
      <div className="h-full w-[68%] rounded-full bg-[#ccff00] shadow-[0_0_14px_rgba(204,255,0,0.5)]" />
    </div>
    <p className="mt-2 text-[10px] text-white/45 font-medium">
      3,400 / 5,000 mL remaining today
    </p>
  </Card>
);

const ProjectsCard = (
  <Card>
    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
      Your Projects
    </span>
    <div className="mt-3 space-y-1.5">
      {["TowerDefenseSim", "PetSimWorld", "MyObbyGame"].map((p, i) => (
        <div
          key={p}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[11px] font-medium ${
            i === 2
              ? "bg-[#ccff00]/10 border border-[#ccff00]/30 text-[#ccff00]"
              : "bg-white/[0.03] border border-white/10 text-white/70"
          }`}
        >
          <FolderOpen
            className={`h-3.5 w-3.5 ${i === 2 ? "text-[#ccff00]" : "text-white/40"}`}
          />
          <span className="truncate">{p}</span>
        </div>
      ))}
    </div>
  </Card>
);

const COLUMN_A = [PromptCard, SyncCard, StatsCard];
const COLUMN_B = [JuiceMeterCard, CodeCard, ProjectsCard];
