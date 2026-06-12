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
  { name: "Tower Defense Sim", meta: "Active now", model: "Claude 3.5", grad: "from-blue-400/50 to-violet-300/40", live: true },
  { name: "Pet Sim World", meta: "Edited 2h ago", model: "GPT-4o", grad: "from-pink-300/50 to-orange-200/40" },
  { name: "Racing League", meta: "Edited 1d ago", model: "Gemini Pro", grad: "from-cyan-300/50 to-blue-300/40" },
];

const ACTIVITY = [
  { who: "Apple Juice", what: "synced DoubleJump.client.lua", when: "2m" },
  { who: "You", what: "opened Tower Defense Sim", when: "14m" },
  { who: "Apple Juice", what: "fixed 2 Luau warnings", when: "1h" },
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
    <div className="rounded-xl border border-[#e6ebf1] bg-white p-2.5 sm:p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8792a2]">Juice tank</span>
        <span className="text-[8px] sm:text-[9px] font-semibold text-[#5a8a00] tabular-nums">{(fill * 5).toFixed(1)} cr</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#eef1f6]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#9ec900] to-[#ccff00]"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[8px] sm:text-[9px] text-[#8792a2]">{pct}% remaining</span>
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
        await goClick("card-1", 0.45, 0.5);
        if (gone()) return;
        await sleep(750);
        await goClick("card-2", 0.72, 0.5);
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
    <div ref={ref} className="relative w-full aspect-[16/10] bg-white text-[#0a2540] overflow-hidden font-sans cursor-none">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 80% 0%, rgba(204,255,0,0.10), transparent 60%), radial-gradient(ellipse 50% 50% at 0% 100%, rgba(99,91,255,0.06), transparent 60%)",
        }}
      />

      <div className="relative flex items-center justify-between h-9 sm:h-12 px-3 sm:px-5 border-b border-[#e6ebf1] bg-white">
        <div className="flex items-center gap-2">
          <AppleJuiceLogo className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-[9px] sm:text-xs font-bold tracking-tight text-[#0a2540]">Apple Juice</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#d7e8a8] bg-[#f4fbdf] text-[9px] font-semibold text-[#5a8a00]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9ec900] animate-pulse" /> Studio paired
          </span>
          <div className="h-5 w-5 sm:h-7 sm:w-7 rounded-full bg-gradient-to-br from-[#ccff00] to-emerald-400" />
        </div>
      </div>

      <div className="relative flex h-[calc(100%-2.25rem)] sm:h-[calc(100%-3rem)]">
        <div className="hidden md:flex w-[20%] min-w-[140px] flex-col border-r border-[#e6ebf1] bg-[#fbfcfe] p-3 gap-1">
          <motion.button
            ref={reg("new-project")}
            animate={{ scale: pressed === "new-project" ? 0.95 : 1 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-[#0a2540] text-white text-[11px] font-semibold shadow-[0_2px_5px_rgba(10,37,64,0.18)]"
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
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                  n.active ? "bg-[#eef1f6] text-[#0a2540]" : hot ? "bg-[#f3f5f9] text-[#0a2540]" : "text-[#697386]"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${n.active || hot ? "text-[#635bff]" : "text-[#8792a2]"}`} />
                {n.label}
              </div>
            );
          })}
          <div className="mt-auto">
            <JuiceTank fill={tankFill} />
          </div>
        </div>

        <div className="flex-1 min-w-0 p-4 sm:p-6 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <motion.h4 initial={false} animate={{ opacity: intro, y: (1 - intro) * 8 }} className="text-base sm:text-2xl font-bold tracking-tight text-[#0a2540]">
                Your places
              </motion.h4>
              <p className="text-[10px] sm:text-xs text-[#8792a2] font-medium mt-0.5">Pick up where you left off</p>
            </div>
            <div className="hidden sm:flex w-44 h-9 rounded-lg border border-[#e6ebf1] bg-[#f6f9fc] px-3 items-center text-[11px] text-[#8792a2]">
              Search places…
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-5">
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
                    borderColor: lift ? "rgba(99,91,255,0.45)" : "rgba(230,235,241,1)",
                    boxShadow: lift
                      ? "0 14px 34px rgba(10,37,64,0.12), 0 2px 6px rgba(10,37,64,0.06)"
                      : "0 1px 3px rgba(10,37,64,0.06)",
                  }}
                  transition={{ duration: 0.34, ease: EASE }}
                  className="rounded-2xl border bg-white overflow-hidden"
                >
                  <div className={`relative h-14 sm:h-20 bg-gradient-to-br ${p.grad}`}>
                    <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
                    {p.live && (
                      <span className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-[8px] font-bold uppercase text-[#5a8a00] shadow-sm">
                        <span className="h-1 w-1 rounded-full bg-[#9ec900] animate-pulse" /> live
                      </span>
                    )}
                  </div>
                  <div className="p-3 sm:p-3.5">
                    <p className="text-[11px] sm:text-[13px] font-semibold text-[#0a2540] truncate">{p.name}</p>
                    <p className="text-[9px] sm:text-[11px] text-[#8792a2] mb-2">{p.meta}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#f3f5f9] text-[8px] sm:text-[10px] font-medium text-[#525f7f]">
                      <Sparkles className="h-2.5 w-2.5 text-[#635bff]" /> {p.model}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="hidden sm:block mt-auto pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8792a2] mb-2">Recent activity</p>
            <div className="rounded-xl border border-[#e6ebf1] bg-white divide-y divide-[#f1f3f7]">
              {ACTIVITY.map((a) => (
                <div key={a.what} className="flex items-center gap-2.5 px-3.5 py-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.who === "You" ? "bg-[#8792a2]" : "bg-[#635bff]"}`} />
                  <span className="text-[11px] text-[#0a2540]"><span className="font-semibold">{a.who}</span> <span className="text-[#697386]">{a.what}</span></span>
                  <span className="ml-auto text-[10px] text-[#b0b8c4] tabular-nums">{a.when}</span>
                </div>
              ))}
            </div>
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
  kw: "text-[#9333ea]",
  fn: "text-[#2563eb]",
  str: "text-[#16a34a]",
  num: "text-[#c2410c]",
  com: "text-[#8792a2] italic",
  id: "text-[#0a2540]",
  pu: "text-[#697386]",
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
      {caretHere && <span className="inline-block w-[2px] h-[1em] -mb-[2px] bg-[#635bff] align-middle" />}
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
    <div ref={ref} className="relative w-full aspect-[16/10] bg-white text-[#0a2540] overflow-hidden cursor-none" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      <div className="flex items-center h-8 sm:h-10 px-3 sm:px-4 border-b border-[#e6ebf1] bg-[#fbfcfe] gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <div className="ml-3 flex items-center gap-1.5">
          <div className="px-2.5 py-1 rounded-t-md bg-white border border-b-0 border-[#e6ebf1] text-[9px] sm:text-[10px] font-semibold flex items-center gap-1.5 text-[#0a2540]">
            <FileCode className="h-3 w-3 text-[#635bff]" /> DoubleJump.server.lua
          </div>
          <span className="px-2 py-1 text-[9px] sm:text-[10px] text-[#8792a2]">Humanoid.lua</span>
        </div>
      </div>

      <div className="flex h-[calc(100%-3.5rem)] sm:h-[calc(100%-4rem)]">
        <div className="hidden md:flex w-[18%] min-w-[120px] flex-col border-r border-[#e6ebf1] bg-[#fbfcfe] py-2 text-[11px] text-[#525f7f] font-mono">
          <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8792a2] font-sans">Explorer</p>
          <p className="px-3 py-1 flex items-center gap-1.5 text-[#0a2540]"><FolderOpen className="h-3 w-3 text-[#635bff]" /> MyObbyGame</p>
          <p className="px-3 py-1 pl-6 flex items-center gap-1.5 text-[#697386]"><Folder className="h-3 w-3" /> ServerScriptService</p>
          <p className="px-3 py-1 pl-9 flex items-center gap-1.5 rounded bg-[#eceff5] text-[#635bff] font-semibold">
            <FileCode className="h-3 w-3" /> DoubleJump.server
          </p>
          <motion.p
            ref={reg("file-client")}
            animate={{
              backgroundColor: fileClientHot ? "rgba(99,91,255,0.08)" : "rgba(0,0,0,0)",
              color: fileClientHot ? "#635bff" : "rgba(105,115,134,1)",
              scale: pressed === "file-client" ? 0.96 : 1,
            }}
            transition={{ duration: 0.15 }}
            className="px-3 py-1 pl-9 flex items-center gap-1.5 rounded"
          >
            <FileCode className="h-3 w-3" /> DoubleJump.client
          </motion.p>
          <p className="px-3 py-1 pl-6 flex items-center gap-1.5 text-[#697386]"><Folder className="h-3 w-3" /> ReplicatedStorage</p>
          <p className="px-3 py-1 pl-9 flex items-center gap-1.5 text-[#697386]"><FileCode className="h-3 w-3" /> Config.module</p>
        </div>

        <div className="flex-1 min-w-0 relative bg-white overflow-hidden">
          <div className="p-3 sm:p-4 text-[10px] sm:text-[12px] font-mono">
            {CODE.map((line, i) => (
              <div key={i} className="flex gap-2 sm:gap-3 leading-[1.5]">
                <span className="w-4 sm:w-5 text-right text-[#c1c9d2] select-none shrink-0">{i + 1}</span>
                <div className={`flex-1 rounded px-1 -mx-1 ${motionOn && i === currentLine && revealed < TOTAL_CHARS ? "bg-[#635bff]/[0.06]" : ""}`}>
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
                className="absolute bottom-2 left-3 sm:left-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-white border border-[#e6ebf1] shadow-sm text-[9px] font-semibold text-[#525f7f]"
              >
                <Sparkles className="h-3 w-3 text-[#635bff] animate-pulse" /> Generating Luau…
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden sm:flex w-[34%] min-w-[200px] max-w-[340px] flex-col border-l border-[#e6ebf1] bg-[#fbfcfe]">
          <div className="px-3 py-2 border-b border-[#e6ebf1] flex items-center gap-2">
            <AppleJuiceLogo className="h-3.5 w-3.5" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#8792a2]">Agent</span>
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
                  className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#0a2540] px-3 py-2 text-[10px] text-white font-medium shadow-[0_2px_5px_rgba(10,37,64,0.12)]"
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
                  className="flex items-center gap-1.5 px-3 py-2 w-fit rounded-2xl rounded-tl-sm bg-white border border-[#e6ebf1]"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-[#635bff]"
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
                className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white border border-[#e6ebf1] px-3 py-2 text-[10px] text-[#425466] leading-relaxed shadow-[0_1px_3px_rgba(10,37,64,0.05)]"
              >
                <span className="font-semibold text-[#635bff]">Apple Juice</span>
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
                  className="rounded-xl border border-[#e6ebf1] bg-white p-2.5 shadow-[0_1px_3px_rgba(10,37,64,0.05)]"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#16a34a] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-[10px] font-semibold text-[#0a2540]">Synced to Studio</span>
                  </div>
                  {["DoubleJump.server.lua", "DoubleJump.client.lua"].map((f) => (
                    <p key={f} className="flex items-center gap-1.5 text-[9px] text-[#697386] font-mono py-0.5">
                      <FileCode className="h-2.5 w-2.5 text-[#635bff]" /> {f}
                    </p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-2.5 border-t border-[#e6ebf1]">
            <motion.div
              ref={reg("prompt-input")}
              animate={{
                borderColor: highlight === "prompt-input" ? "rgba(99,91,255,0.5)" : "rgba(230,235,241,1)",
              }}
              className="flex items-center gap-2 rounded-xl border bg-white px-2.5 py-1.5"
            >
              <span className="flex-1 text-[9px] text-[#8792a2]">Ask Apple Juice…</span>
              <motion.span
                ref={reg("send-btn")}
                animate={{
                  scale: pressed === "send-btn" ? 0.88 : 1,
                  boxShadow: pressed === "send-btn" ? "0 0 14px rgba(99,91,255,0.5)" : "0 0 0 rgba(0,0,0,0)",
                }}
                transition={{ duration: 0.12 }}
                className="flex h-5 w-5 items-center justify-center rounded-md bg-[#635bff] text-white"
              >
                <ArrowRight className="h-3 w-3" />
              </motion.span>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-5 sm:h-6 flex items-center justify-between px-3 sm:px-4 bg-[#0a2540] text-white border-t border-[#0a2540] text-[8px] sm:text-[9px] font-mono z-[5]">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex items-center gap-1.5 text-[#ccff00] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ccff00] animate-pulse" /> Studio paired
          </span>
          <span className="hidden sm:flex items-center gap-1 text-white/60"><ChevronRight className="h-2.5 w-2.5" /> main</span>
          <span className="text-white/60">Luau</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-white/60">
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
