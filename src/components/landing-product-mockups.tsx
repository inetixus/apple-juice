"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
  History,
  Layers,
  Plus,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useInView } from "@/hooks/use-in-view";
import { getLandingPerfConfig } from "@/lib/landing-perf";
import { AppleJuiceLogo } from "./apple-juice-logo";
import {
  ClickRipple,
  DemoCursor,
  useHumanDemoCursor,
} from "@/hooks/use-human-demo-cursor";
import { sleep, type Point } from "@/lib/human-cursor-motion";

/* ─────────────────────────────────────────────────────────────
   Animated product mockups that replace the static dashboard /
   IDE screenshots. Each is driven by a throttled rAF clock that
   only runs while on-screen, plus an embedded autonomous cursor
   (the same hero cursor — speed distortion, click-image swap,
   ripples) that moves around and clicks real UI targets.
   ───────────────────────────────────────────────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const mapRange = (v: number, a: number, b: number, c: number, d: number) =>
  c + clamp01((v - a) / (b - a)) * (d - c);

/** Looping clock (seconds), throttled to ~22fps, gated on visibility. */
function useLoopClock(active: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    let lastEmit = 0;
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      if (elapsed - lastEmit >= 0.045) {
        lastEmit = elapsed;
        setT(elapsed);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return t;
}

/** Shared cursor rig bound to a mockup root element. */
function useMockCursor<T extends string>(rootRef: React.RefObject<HTMLDivElement | null>, motionOn: boolean) {
  const targets = useRef<Partial<Record<T, HTMLElement>>>({});
  const rig = useHumanDemoCursor<T>({
    stageRef: rootRef,
    contentLayerRef: rootRef,
    targets,
    motionEnabled: motionOn,
  });
  const reg = useCallback(
    (id: T) => (el: HTMLElement | null) => {
      if (el) targets.current[id] = el;
      else delete targets.current[id];
    },
    [],
  );
  const ratioPt = useCallback(
    (rx: number, ry: number): Point => {
      const el = rootRef.current;
      const w = el?.clientWidth ?? 0;
      const h = el?.clientHeight ?? 0;
      return { x: w * rx, y: h * ry };
    },
    [rootRef],
  );
  return { ...rig, targets, reg, ratioPt };
}

/* ════════════════════════════════════════════════════════════
   DASHBOARD MOCKUP — creator lobby
   ════════════════════════════════════════════════════════════ */

type Project = { name: string; meta: string; model: string; grad: string; live?: boolean };

const PROJECTS: Project[] = [
  { name: "MyObbyGame", meta: "Active now", model: "Claude 3.5", grad: "from-[#ccff00]/40 to-emerald-500/20", live: true },
  { name: "TowerDefenseSim", meta: "Edited 2h ago", model: "Gemini Pro", grad: "from-blue-500/40 to-violet-500/20" },
  { name: "PetSimWorld", meta: "Edited 1d ago", model: "GPT-4o", grad: "from-pink-500/40 to-orange-400/20" },
  { name: "RacingLeague", meta: "Edited 3d ago", model: "DeepSeek V3", grad: "from-cyan-400/40 to-blue-600/20" },
  { name: "HorrorMap_v3", meta: "Edited 5d ago", model: "o1", grad: "from-violet-500/40 to-fuchsia-500/20" },
  { name: "TycoonFactory", meta: "Edited 1w ago", model: "Gemini Flash", grad: "from-amber-400/40 to-red-500/20" },
];

const NAV = [
  { icon: Layers, label: "Projects", active: true },
  { icon: Sparkles, label: "Models" },
  { icon: History, label: "Activity" },
  { icon: Terminal, label: "CLI" },
];

type DashTarget = "new-project" | "nav-models" | `card-${number}`;

function JuiceTank({ fill }: { fill: number }) {
  const pct = Math.round(fill * 100);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-white/40">Juice tank</span>
        <span className="text-[8px] sm:text-[10px] font-bold text-[#ccff00] tabular-nums">{(fill * 5).toFixed(1)} cr</span>
      </div>
      <div className="relative h-16 sm:h-24 w-full rounded-xl overflow-hidden border border-white/10 bg-[#0a0b07]">
        <motion.div
          className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-[#ccff00]/80 to-[#9ec900]/90"
          animate={{ height: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <motion.div
            className="absolute -top-2 left-0 h-3 w-[200%]"
            style={{
              background:
                "radial-gradient(circle at 25% 100%, transparent 60%, rgba(204,255,0,0.9) 61%), radial-gradient(circle at 75% 100%, transparent 60%, rgba(204,255,0,0.9) 61%)",
              backgroundSize: "50% 100%",
            }}
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
          />
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute bottom-0 h-1 w-1 rounded-full bg-white/70"
              style={{ left: `${20 + i * 28}%` }}
              animate={{ y: [0, -40], opacity: [0, 0.8, 0] }}
              transition={{ duration: 1.8, ease: "easeOut", repeat: Infinity, delay: i * 0.6 }}
            />
          ))}
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm sm:text-xl font-black text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] tabular-nums">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

export function DashboardMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { threshold: 0.25, rootMargin: "120px 0px" });
  const motionOn = getLandingPerfConfig().heroAutoplay;
  const active = inView && motionOn;
  const t = useLoopClock(active);

  const {
    cursorX, cursorY, cursorOn, setCursorOn, pressing, highlight, pressed, ripples,
    placeCursor, moveToTarget, clickTarget, moveToPoint, clearHighlight, reg, targets, ratioPt,
  } = useMockCursor<DashTarget>(ref, motionOn);

  const intro = motionOn ? easeOutCubic(clamp01(t / 1.1)) : 1;
  const tankFill = motionOn ? mapRange(t, 0.3, 1.6, 0, 0.78) : 0.78;
  const focus = motionOn ? Math.floor((t / 1.9) % PROJECTS.length) : 0;

  // autonomous cursor choreography
  useEffect(() => {
    if (!active) {
      setCursorOn(false);
      clearHighlight();
      return;
    }
    let dead = false;
    const gone = () => dead;

    const goClick = async (id: DashTarget, fbx: number, fby: number) => {
      if (targets.current[id]) {
        await moveToTarget(id, { dwell: true, style: "arc" });
        if (gone()) return;
        await clickTarget(id);
      } else {
        await moveToPoint(ratioPt(fbx, fby), "arc");
      }
    };

    async function play() {
      await sleep(600);
      if (gone()) return;
      setCursorOn(true);
      placeCursor(0.5, 0.92);
      while (!gone()) {
        await goClick("card-1", 0.45, 0.55);
        if (gone()) return;
        await sleep(750);
        await goClick("card-4", 0.7, 0.7);
        if (gone()) return;
        await sleep(750);
        await goClick("nav-models", 0.12, 0.4);
        if (gone()) return;
        await sleep(700);
        await goClick("new-project", 0.12, 0.18);
        if (gone()) return;
        await sleep(900);
        placeCursor(0.5, 0.92);
        await sleep(200);
      }
    }
    play();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div ref={ref} className="relative w-full aspect-[16/10] bg-[#070809] text-white overflow-hidden font-sans cursor-none">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 80% 0%, rgba(204,255,0,0.08), transparent 60%), radial-gradient(ellipse 50% 50% at 0% 100%, rgba(59,130,246,0.07), transparent 60%)",
        }}
      />

      <div className="relative flex items-center justify-between h-9 sm:h-12 px-3 sm:px-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <AppleJuiceLogo className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-[9px] sm:text-xs font-black uppercase tracking-widest">Apple Juice</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#ccff00]/25 bg-[#ccff00]/10 text-[9px] font-bold text-[#ccff00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] animate-pulse" /> Studio paired
          </span>
          <div className="h-5 w-5 sm:h-7 sm:w-7 rounded-full bg-gradient-to-br from-[#ccff00] to-emerald-500" />
        </div>
      </div>

      <div className="relative flex h-[calc(100%-2.25rem)] sm:h-[calc(100%-3rem)]">
        <div className="hidden md:flex w-[20%] min-w-[140px] flex-col border-r border-white/[0.06] p-3 gap-1">
          <motion.button
            ref={reg("new-project")}
            animate={{ scale: pressed === "new-project" ? 0.95 : 1 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-[#ccff00] text-black text-[11px] font-black"
          >
            <Plus className="h-3.5 w-3.5" /> New project
          </motion.button>
          {NAV.map((n) => {
            const Icon = n.icon;
            const isModels = n.label === "Models";
            const hot = isModels && (highlight === "nav-models" || pressed === "nav-models");
            return (
              <div
                key={n.label}
                ref={isModels ? reg("nav-models") : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                  n.active ? "bg-white/[0.06] text-white" : hot ? "bg-white/[0.08] text-white" : "text-white/45"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${n.active || hot ? "text-[#ccff00]" : ""}`} />
                {n.label}
              </div>
            );
          })}
          <div className="mt-auto">
            <JuiceTank fill={tankFill} />
          </div>
        </div>

        <div className="flex-1 min-w-0 p-3 sm:p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-5">
            <div>
              <motion.h4 initial={false} animate={{ opacity: intro, y: (1 - intro) * 8 }} className="text-sm sm:text-xl font-black tracking-tight">
                Your places
              </motion.h4>
              <p className="text-[9px] sm:text-[11px] text-white/40 font-medium">Pick up where you left off</p>
            </div>
            <div className="hidden sm:flex w-40 h-8 rounded-lg border border-white/10 bg-white/[0.03] px-3 items-center text-[10px] text-white/30">
              Search places…
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
            {PROJECTS.map((p, i) => {
              const cycled = motionOn && i === focus;
              const hovered = motionOn && highlight === `card-${i}`;
              const isPressed = pressed === `card-${i}`;
              const lift = cycled || hovered;
              return (
                <motion.div
                  key={p.name}
                  ref={reg(`card-${i}`)}
                  initial={false}
                  animate={{
                    opacity: motionOn ? clamp01((intro - i * 0.06) * 2) : 1,
                    y: lift ? -3 : 0,
                    scale: isPressed ? 0.97 : 1,
                    borderColor: lift ? "rgba(204,255,0,0.45)" : "rgba(255,255,255,0.08)",
                    boxShadow: lift
                      ? "0 14px 40px rgba(0,0,0,0.5), 0 0 22px rgba(204,255,0,0.18)"
                      : "0 8px 24px rgba(0,0,0,0.3)",
                  }}
                  transition={{ duration: 0.34, ease: EASE }}
                  className="rounded-xl sm:rounded-2xl border bg-white/[0.03] overflow-hidden"
                >
                  <div className={`relative h-9 sm:h-16 bg-gradient-to-br ${p.grad}`}>
                    <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "14px 14px" }} />
                    {p.live && (
                      <span className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[7px] sm:text-[8px] font-black uppercase text-[#ccff00]">
                        <span className="h-1 w-1 rounded-full bg-[#ccff00] animate-pulse" /> live
                      </span>
                    )}
                  </div>
                  <div className="p-2 sm:p-3">
                    <p className="text-[10px] sm:text-xs font-bold truncate">{p.name}</p>
                    <p className="text-[8px] sm:text-[10px] text-white/40 mb-1.5">{p.meta}</p>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[7px] sm:text-[9px] font-semibold text-white/55">
                      <Sparkles className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-[#ccff00]" /> {p.model}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* embedded hero cursor */}
      {active && (
        <>
          {ripples.map((r) => (
            <ClickRipple key={r.id} id={r.id} point={r.p} />
          ))}
          <DemoCursor x={cursorX} y={cursorY} pressing={pressing} visible={cursorOn} hovering={highlight !== null} />
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   IDE MOCKUP — editor + streaming agent chat + paired status
   ════════════════════════════════════════════════════════════ */

type Tok = { s: string; c: string };
const C = {
  kw: "text-[#c792ea]",
  fn: "text-sky-300",
  str: "text-amber-300",
  num: "text-orange-400",
  com: "text-white/30 italic",
  id: "text-white/85",
  pu: "text-white/40",
};

const CODE: Tok[][] = [
  [{ s: "local", c: C.kw }, { s: " DoubleJump ", c: C.id }, { s: "=", c: C.pu }, { s: " {}", c: C.pu }],
  [{ s: "local", c: C.kw }, { s: " MAX_JUMPS ", c: C.id }, { s: "=", c: C.pu }, { s: " 2", c: C.num }],
  [],
  [{ s: "-- reset jump count on respawn", c: C.com }],
  [{ s: "Players", c: C.fn }, { s: ".PlayerAdded:", c: C.pu }, { s: "Connect", c: C.fn }, { s: "(", c: C.pu }, { s: "function", c: C.kw }, { s: "(plr)", c: C.pu }],
  [{ s: "  jumps[plr] ", c: C.id }, { s: "=", c: C.pu }, { s: " 0", c: C.num }],
  [{ s: "end", c: C.kw }, { s: ")", c: C.pu }],
  [],
  [{ s: "-- grant a second jump mid-air", c: C.com }],
  [{ s: "UIS", c: C.fn }, { s: ".JumpRequest:", c: C.pu }, { s: "Connect", c: C.fn }, { s: "(", c: C.pu }, { s: "function", c: C.kw }, { s: "()", c: C.pu }],
  [{ s: "  if", c: C.kw }, { s: " canDoubleJump(plr) ", c: C.id }, { s: "then", c: C.kw }],
  [{ s: "    hum:", c: C.id }, { s: "ChangeState", c: C.fn }, { s: "(Jumping)", c: C.pu }],
  [{ s: "  end", c: C.kw }],
  [{ s: "end", c: C.kw }, { s: ")", c: C.pu }],
];

const LINE_LEN = CODE.map((line) => line.reduce((n, tk) => n + tk.s.length, 0));
const TOTAL_CHARS = LINE_LEN.reduce((a, b) => a + b, 0) + CODE.length;
const LINE_START: number[] = [];
{
  let acc = 0;
  for (let i = 0; i < CODE.length; i++) {
    LINE_START.push(acc);
    acc += LINE_LEN[i] + 1;
  }
}

function CodeLine({ tokens, start, end, revealed, showCaret }: { tokens: Tok[]; start: number; end: number; revealed: number; showCaret: boolean }) {
  let pos = start;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const tkEnd = pos + tk.s.length;
    if (revealed >= tkEnd) {
      out.push(<span key={i} className={tk.c}>{tk.s}</span>);
    } else if (revealed > pos) {
      out.push(<span key={i} className={tk.c}>{tk.s.slice(0, revealed - pos)}</span>);
      break;
    } else {
      break;
    }
    pos = tkEnd;
  }
  const caretHere = showCaret && revealed >= start && revealed <= end;
  return (
    <span className="whitespace-pre">
      {out}
      {caretHere && <span className="inline-block w-[2px] h-[1em] -mb-[2px] bg-[#ccff00] align-middle" />}
      {out.length === 0 && !caretHere && <span>{"\u00A0"}</span>}
    </span>
  );
}

const AI_MSG = "Done — generated server + client scripts and pushed them straight into your open place.";

type IdeTarget = "file-client" | "prompt-input" | "send-btn";

export function IdeMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { threshold: 0.25, rootMargin: "120px 0px" });
  const motionOn = getLandingPerfConfig().heroAutoplay;
  const active = inView && motionOn;
  const t = useLoopClock(active);

  const {
    cursorX, cursorY, cursorOn, setCursorOn, pressing, highlight, pressed, ripples,
    placeCursor, moveToTarget, clickTarget, moveToPoint, clearHighlight, reg, targets, ratioPt,
  } = useMockCursor<IdeTarget>(ref, motionOn);

  const PERIOD = 13.5;
  const loop = motionOn ? t % PERIOD : PERIOD * 0.7;

  const revealed = motionOn ? Math.floor(mapRange(loop, 0.6, 6, 0, TOTAL_CHARS)) : TOTAL_CHARS;
  const currentLine = (() => {
    let ln = 0;
    for (let i = 0; i < CODE.length; i++) if (revealed >= LINE_START[i]) ln = i;
    return ln;
  })();
  const caretOn = Math.floor(t * 1.8) % 2 === 0;

  const showUser = loop > 0.4;
  const aiTyping = loop > 1.4 && loop < 3.2;
  const aiMsgChars = motionOn ? Math.floor(mapRange(loop, 3.2, 5.4, 0, AI_MSG.length)) : AI_MSG.length;
  const showArtifact = loop > 5.6;
  const fade = motionOn ? 1 - easeOutCubic(clamp01((loop - (PERIOD - 1)) / 1)) : 1;

  // autonomous cursor choreography
  useEffect(() => {
    if (!active) {
      setCursorOn(false);
      clearHighlight();
      return;
    }
    let dead = false;
    const gone = () => dead;

    const goClick = async (id: IdeTarget, fbx: number, fby: number) => {
      if (targets.current[id]) {
        await moveToTarget(id, { dwell: true, style: "arc" });
        if (gone()) return;
        await clickTarget(id);
      } else {
        await moveToPoint(ratioPt(fbx, fby), "arc");
      }
    };

    async function play() {
      await sleep(900);
      if (gone()) return;
      setCursorOn(true);
      placeCursor(0.5, 0.95);
      while (!gone()) {
        await goClick("file-client", 0.1, 0.5);
        if (gone()) return;
        await sleep(950);
        await goClick("prompt-input", 0.82, 0.86);
        if (gone()) return;
        await sleep(650);
        await goClick("send-btn", 0.95, 0.86);
        if (gone()) return;
        await sleep(1400);
        placeCursor(0.5, 0.95);
        await sleep(250);
      }
    }
    play();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const fileClientHot = highlight === "file-client" || pressed === "file-client";

  return (
    <div ref={ref} className="relative w-full aspect-[16/10] bg-[#070809] text-white overflow-hidden cursor-none" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      <div className="flex items-center h-8 sm:h-10 px-3 sm:px-4 border-b border-white/[0.06] gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <div className="ml-3 flex items-center gap-1.5">
          <div className="px-2.5 py-1 rounded-t-md bg-white/[0.06] text-[9px] sm:text-[10px] font-semibold flex items-center gap-1.5">
            <FileCode className="h-3 w-3 text-[#ccff00]" /> DoubleJump.server.lua
          </div>
          <span className="px-2 py-1 text-[9px] sm:text-[10px] text-white/30">Humanoid.lua</span>
        </div>
      </div>

      <div className="flex h-[calc(100%-3.5rem)] sm:h-[calc(100%-4rem)]">
        <div className="hidden md:flex w-[18%] min-w-[120px] flex-col border-r border-white/[0.06] py-2 text-[11px] text-white/55 font-mono">
          <p className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white/30 font-sans">Explorer</p>
          <p className="px-3 py-1 flex items-center gap-1.5"><FolderOpen className="h-3 w-3 text-[#ccff00]" /> MyObbyGame</p>
          <p className="px-3 py-1 pl-6 flex items-center gap-1.5 text-white/40"><Folder className="h-3 w-3" /> ServerScriptService</p>
          <p className="px-3 py-1 pl-9 flex items-center gap-1.5 rounded bg-[#ccff00]/10 text-[#ccff00]">
            <FileCode className="h-3 w-3" /> DoubleJump.server
          </p>
          <motion.p
            ref={reg("file-client")}
            animate={{
              backgroundColor: fileClientHot ? "rgba(204,255,0,0.10)" : "rgba(0,0,0,0)",
              color: fileClientHot ? "#ccff00" : "rgba(255,255,255,0.4)",
              scale: pressed === "file-client" ? 0.96 : 1,
            }}
            transition={{ duration: 0.15 }}
            className="px-3 py-1 pl-9 flex items-center gap-1.5 rounded"
          >
            <FileCode className="h-3 w-3" /> DoubleJump.client
          </motion.p>
          <p className="px-3 py-1 pl-6 flex items-center gap-1.5 text-white/40"><Folder className="h-3 w-3" /> ReplicatedStorage</p>
          <p className="px-3 py-1 pl-9 flex items-center gap-1.5 text-white/40"><FileCode className="h-3 w-3" /> Config.module</p>
        </div>

        <div className="flex-1 min-w-0 relative bg-[#08090c] overflow-hidden">
          <div className="p-3 sm:p-4 text-[10px] sm:text-[12px] font-mono">
            {CODE.map((line, i) => (
              <div key={i} className="flex gap-2 sm:gap-3 leading-[1.5]">
                <span className="w-4 sm:w-5 text-right text-white/15 select-none shrink-0">{i + 1}</span>
                <div className={`flex-1 rounded px-1 -mx-1 ${motionOn && i === currentLine && revealed < TOTAL_CHARS ? "bg-[#ccff00]/[0.06]" : ""}`}>
                  <CodeLine tokens={line} start={LINE_START[i]} end={LINE_START[i] + LINE_LEN[i]} revealed={revealed} showCaret={caretOn && i === currentLine && revealed < TOTAL_CHARS} />
                </div>
              </div>
            ))}
          </div>
          <AnimatePresence>
            {motionOn && revealed < TOTAL_CHARS && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-2 left-3 sm:left-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[9px] font-bold text-white/60"
              >
                <Sparkles className="h-3 w-3 text-[#ccff00] animate-pulse" /> Generating Luau…
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden sm:flex w-[34%] min-w-[200px] max-w-[340px] flex-col border-l border-white/[0.06] bg-[#0a0b10]">
          <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
            <AppleJuiceLogo className="h-3.5 w-3.5" />
            <span className="text-[9px] font-black uppercase tracking-wider text-white/40">Agent</span>
          </div>
          <div className="flex-1 p-3 space-y-2.5 overflow-hidden" style={{ opacity: fade }}>
            <AnimatePresence>
              {showUser && (
                <motion.div
                  key="user"
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-white/[0.07] px-3 py-2 text-[10px] text-white/85 font-medium"
                >
                  Build a double jump for my obby
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {aiTyping && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 px-3 py-2 w-fit rounded-2xl rounded-tl-sm bg-[#ccff00]/[0.07] border border-[#ccff00]/15"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-[#ccff00]"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {!aiTyping && aiMsgChars > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[#ccff00]/[0.08] border border-[#ccff00]/20 px-3 py-2 text-[10px] text-white/85 leading-relaxed"
              >
                <span className="font-bold text-[#a6cf00]">Apple Juice</span>
                <p className="mt-1">{AI_MSG.slice(0, aiMsgChars)}</p>
              </motion.div>
            )}

            <AnimatePresence>
              {showArtifact && (
                <motion.div
                  key="artifact"
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: EASE }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#ccff00] text-black">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-[10px] font-bold">Synced to Studio</span>
                  </div>
                  {["DoubleJump.server.lua", "DoubleJump.client.lua"].map((f) => (
                    <p key={f} className="flex items-center gap-1.5 text-[9px] text-white/50 font-mono py-0.5">
                      <FileCode className="h-2.5 w-2.5 text-[#ccff00]" /> {f}
                    </p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-2.5 border-t border-white/[0.06]">
            <motion.div
              ref={reg("prompt-input")}
              animate={{
                borderColor: highlight === "prompt-input" ? "rgba(204,255,0,0.4)" : "rgba(255,255,255,0.1)",
              }}
              className="flex items-center gap-2 rounded-xl border bg-white/[0.03] px-2.5 py-1.5"
            >
              <span className="flex-1 text-[9px] text-white/30">Ask Apple Juice…</span>
              <motion.span
                ref={reg("send-btn")}
                animate={{
                  scale: pressed === "send-btn" ? 0.88 : 1,
                  boxShadow: pressed === "send-btn" ? "0 0 16px rgba(204,255,0,0.6)" : "0 0 0 rgba(0,0,0,0)",
                }}
                transition={{ duration: 0.12 }}
                className="flex h-5 w-5 items-center justify-center rounded-md bg-[#ccff00] text-black"
              >
                <ArrowRight className="h-3 w-3" />
              </motion.span>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-5 sm:h-6 flex items-center justify-between px-3 sm:px-4 bg-[#0a0b10] border-t border-white/[0.06] text-[8px] sm:text-[9px] font-mono z-[5]">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex items-center gap-1.5 text-[#ccff00] font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] animate-pulse" /> Studio paired
          </span>
          <span className="hidden sm:flex items-center gap-1 text-white/40"><ChevronRight className="h-2.5 w-2.5" /> main</span>
          <span className="text-white/40">Luau</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-white/40">
          <span className="hidden sm:inline">UTF-8</span>
          <span className="flex items-center gap-1"><Sparkles className="h-2.5 w-2.5 text-[#ccff00]" /> Claude 3.5</span>
        </div>
      </div>

      {/* embedded hero cursor */}
      {active && (
        <>
          {ripples.map((r) => (
            <ClickRipple key={r.id} id={r.id} point={r.p} />
          ))}
          <DemoCursor x={cursorX} y={cursorY} pressing={pressing} visible={cursorOn} hovering={highlight !== null} />
        </>
      )}
    </div>
  );
}
