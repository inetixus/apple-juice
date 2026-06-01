"use client";

import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getLandingPerfConfig } from "@/lib/landing-perf";
import { sleep } from "@/lib/human-cursor-motion";
import { useInView } from "@/hooks/use-in-view";
import {
  ClickRipple,
  DemoCursor,
  useHumanDemoCursor,
} from "@/hooks/use-human-demo-cursor";

const BRAND = "#ccff00";
const BRAND_LIGHT = "#d4ff33";
const CLI_SPINNER = ["✦", "✧", "★", "☆", "✶", "✷", "✸", "✹"];

const LAYOUT_SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

const SLASH_COMMANDS = [
  { id: "pair", cmd: "/pair", desc: "Link terminal to Roblox Studio" },
  { id: "sync", cmd: "/sync", desc: "AI-edit a file and push to Studio" },
  { id: "model", cmd: "/model", desc: "Select AI model interactively" },
  { id: "status", cmd: "/status", desc: "Refresh server + Studio status" },
];

type InputSegmentKind = "command" | "string" | "flag" | "arg";

const INPUT_STRUCTURE: { key: InputSegmentKind; text: string }[] = [
  { key: "command", text: "add " },
  { key: "string", text: "a massive double jump" },
  { key: "flag", text: " --server " },
  { key: "arg", text: "authorization" },
];

const FULL_PROMPT = INPUT_STRUCTURE.map((s) => s.text).join("");

const SEG_COLORS: Record<InputSegmentKind, string> = {
  command: "text-violet-400",
  string: "text-emerald-300",
  flag: "text-zinc-500",
  arg: "text-zinc-100",
};

type LineKind = "user" | "ai-header" | "loading" | "success";

type TerminalLine = {
  id: string;
  kind: LineKind;
  text: string;
  status?: "loading" | "done";
};

type Phase =
  | "welcome"
  | "typing"
  | "pre-enter"
  | "transcript"
  | "slash"
  | "slash-nav"
  | "sync";

type Target = "prompt-bar" | "slash-sync";

const EASE = [0.22, 1, 0.36, 1] as const;

let lineIdCounter = 0;
function nextLineId() {
  return `line-${++lineIdCounter}`;
}

function charDelay(kind: InputSegmentKind, ch: string): number {
  if (kind === "command" || kind === "string") {
    if (ch === " ") return 42 + Math.random() * 38;
    if (ch === "—" || ch === "-") return 55 + Math.random() * 40;
    return 18 + Math.random() * 26;
  }
  return 46 + Math.random() * 34;
}

async function typeHumanInput(
  onUpdate: (text: string) => void,
  gone: () => boolean,
) {
  let full = "";
  for (const seg of INPUT_STRUCTURE) {
    if (seg.key === "flag") {
      await sleep(165 + Math.random() * 85);
    }
    for (const ch of seg.text) {
      if (gone()) return;
      full += ch;
      onUpdate(full);
      await sleep(charDelay(seg.key, ch));
    }
  }
}

const APPLE_ART_LINES: { text: string; className?: string }[][] = [
  [{ text: "            ", className: "text-transparent" }, { text: "█", className: "text-[#8b4513]" }, { text: "▄▀", className: "text-[#2ecc71]" }],
  [{ text: "     ▄█████████████▄     ", className: "text-[#e61e1e]" }],
  [
    { text: "   ▄████", className: "text-[#e61e1e]" },
    { text: "██", className: "text-white" },
    { text: "███████████▄   ", className: "text-[#e61e1e]" },
  ],
  [{ text: "   ███████████████████   ", className: "text-[#e61e1e]" }],
  [{ text: "     ▀█████████████▀     ", className: "text-[#e61e1e]" }],
];

function AppleArt() {
  return (
    <div className="text-[9px] leading-[1.15] select-none text-left" aria-hidden>
      {APPLE_ART_LINES.map((parts, i) => (
        <div key={i} className="whitespace-pre">
          {parts.map((p, j) => (
            <span key={j} className={p.className}>
              {p.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function HighlightedInput({ text }: { text: string }) {
  let pos = 0;
  const parts: ReactNode[] = [];
  for (const seg of INPUT_STRUCTURE) {
    if (pos >= text.length) break;
    const end = pos + seg.text.length;
    const visible = text.slice(pos, Math.min(text.length, end));
    if (visible) {
      parts.push(
        <span key={seg.key} className={SEG_COLORS[seg.key]}>
          {visible}
        </span>,
      );
    }
    pos = end;
  }
  return <>{parts}</>;
}

function BlockCursor({ solid }: { solid: boolean }) {
  if (solid) {
    return (
      <span
        className="inline-block w-[0.52em] h-[1.05em] ml-px align-[-0.15em] rounded-[1px]"
        style={{ backgroundColor: BRAND }}
      />
    );
  }
  return (
    <motion.span
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1.05, repeat: Infinity, times: [0, 0.49, 0.5, 1], ease: "linear" }}
      className="inline-block w-[0.52em] h-[1.05em] ml-px align-[-0.15em] rounded-[1px]"
      style={{ backgroundColor: BRAND }}
    />
  );
}

function SuccessCheck() {
  return (
    <motion.span
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: [0.5, 1.2, 1], opacity: 1 }}
      transition={{ duration: 0.38, times: [0, 0.65, 1], ease: EASE }}
      className="inline-flex items-center justify-center text-[#92ff92] cli-success-glow font-bold"
    >
      ✔
    </motion.span>
  );
}

function LoadingSpinnerChar({ frame }: { frame: number }) {
  return (
    <span className="text-zinc-500 w-[1ch] inline-block text-center">
      {CLI_SPINNER[frame % CLI_SPINNER.length]}
    </span>
  );
}

function TerminalLineRow({
  line,
  spinnerFrame,
}: {
  line: TerminalLine;
  spinnerFrame: number;
}) {
  if (line.kind === "user") {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
        <p className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1.5">You</p>
        <p className="text-zinc-100 leading-relaxed">{line.text}</p>
      </div>
    );
  }

  if (line.kind === "ai-header") {
    return (
      <div className="rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/[0.06] px-3.5 py-3">
        <p className="font-semibold text-[11px] mb-1.5" style={{ color: BRAND }}>
          Apple Juice
        </p>
        <p className="text-zinc-300 leading-relaxed">{line.text}</p>
      </div>
    );
  }

  if (line.kind === "loading") {
    const done = line.status === "done";
    return (
      <p className="flex items-center gap-2 text-[10px] pl-1">
        {done ? (
          <SuccessCheck />
        ) : (
          <LoadingSpinnerChar frame={spinnerFrame} />
        )}
        <span className={done ? "text-zinc-400" : "text-zinc-500"}>{line.text}</span>
      </p>
    );
  }

  return (
    <p className="inline-flex items-center gap-2 text-[#92ff92] text-[10px] px-2.5 py-1 rounded-lg bg-[#92ff92]/[0.08] border border-[#92ff92]/15 cli-success-glow">
      <SuccessCheck />
      <span>{line.text}</span>
    </p>
  );
}

function TerminalChrome({ children }: { children: ReactNode }) {
  return (
    <div className="cli-premium-terminal cli-kinetic-terminal relative rounded-2xl md:rounded-[1.35rem] overflow-hidden border border-white/10 bg-gray-950/80 backdrop-blur-md shadow-[0_32px_80px_rgba(0,0,0,0.55)]">
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] cli-scanlines" aria-hidden />
      <div
        className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/[0.07] rounded-2xl md:rounded-[1.35rem]"
        aria-hidden
      />
      <div className="relative z-[1] flex items-center justify-between px-4 py-2.5 bg-[#0e0e11]/80 border-b border-white/[0.08] backdrop-blur-sm">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        </div>
        <span className="text-[10px] text-zinc-400 tracking-[0.12em]">aj · sync engine</span>
        <span className="text-[9px] text-zinc-600 w-8 text-right">⌘K</span>
      </div>
      <div className="relative z-[1] flex flex-col min-h-[360px] md:min-h-[400px] bg-[#050506]/90 text-zinc-100">
        <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between gap-3 text-[9px] sm:text-[10px] bg-[#070709]/85 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-zinc-500 truncate">MyObbyGame</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-600 shrink-0">v2.1.0</span>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#92ff92]/10 border border-[#92ff92]/15 text-[#92ff92] text-[8px] uppercase tracking-wider">
            <span className="h-1 w-1 rounded-full bg-[#92ff92]" />
            Paired
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LandingCliShowcase({
  className = "",
  onPillarActive,
}: {
  className?: string;
  onPillarActive?: (index: number | null) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const targets = useRef<Partial<Record<Target, HTMLElement>>>({});
  const runRef = useRef(0);
  const isInView = useInView(stageRef, { threshold: 0.08, rootMargin: "200px 0px" });
  const cliAutoplay = getLandingPerfConfig().cliDemoAutoplay;

  const [phase, setPhase] = useState<Phase>("welcome");
  const [typedInput, setTypedInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [slashPrompt, setSlashPrompt] = useState("");
  const [slashSelected, setSlashSelected] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [hasSpinner, setHasSpinner] = useState(false);

  const {
    cursorX,
    cursorY,
    cursorOn,
    setCursorOn,
    pressing,
    highlight,
    pressed,
    ripples,
    pt,
    placeCursor,
    moveAndClick,
    clearHighlight,
  } = useHumanDemoCursor<Target>({
    stageRef,
    targets,
    motionEnabled: cliAutoplay,
  });

  const showWelcome = phase === "welcome" || phase === "typing" || phase === "pre-enter";
  const showTranscript =
    phase === "transcript" ||
    phase === "slash" ||
    phase === "slash-nav" ||
    phase === "sync";
  const showSlash = phase === "slash" || phase === "slash-nav";

  const setPillar = useCallback(
    (index: number | null) => onPillarActive?.(index),
    [onPillarActive],
  );

  useEffect(() => {
    if (!hasSpinner || !isInView) return;
    const iv = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % CLI_SPINNER.length);
    }, 90);
    return () => clearInterval(iv);
  }, [hasSpinner, isInView]);

  const reg = useCallback(
    (id: Target) => (el: HTMLElement | null) => {
      if (el) targets.current[id] = el;
      else delete targets.current[id];
    },
    [],
  );

  const appendLine = useCallback((line: Omit<TerminalLine, "id">) => {
    const id = nextLineId();
    setLines((prev) => [...prev, { ...line, id }]);
    return id;
  }, []);

  const markLineDone = useCallback((id: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: "done" as const } : l)),
    );
  }, []);

  const runLoadingStep = useCallback(
    async (
      text: string,
      duration: number,
      pillar: number | null,
      gone: () => boolean,
    ) => {
      setPillar(pillar);
      setHasSpinner(true);
      const id = appendLine({ kind: "loading", text, status: "loading" });
      await sleep(duration);
      if (gone()) return;
      markLineDone(id);
      await sleep(180);
    },
    [appendLine, markLineDone, setPillar],
  );

  useLayoutEffect(() => {
    placeCursor(0.62, 0.88);
  }, [placeCursor]);

  useEffect(() => {
    if (!isInView) {
      runRef.current += 1;
      setCursorOn(false);
      setHasSpinner(false);
      return;
    }

    if (!cliAutoplay) return;

    let dead = false;
    const run = ++runRef.current;
    const gone = () => dead || runRef.current !== run;

    async function waitForTarget(id: Target, attempts = 24) {
      for (let i = 0; i < attempts; i++) {
        if (gone()) return false;
        if (pt(id)) return true;
        await sleep(50);
      }
      return false;
    }

    async function play() {
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
      if (gone()) return;

      setPhase("welcome");
      setTypedInput("");
      setIsTyping(false);
      setLines([]);
      setSlashPrompt("");
      setSlashSelected(0);
      setHasSpinner(false);
      setPillar(null);
      clearHighlight();

      await sleep(420);
      if (gone()) return;

      setCursorOn(true);
      placeCursor(0.55, 0.72);
      if (!(await waitForTarget("prompt-bar"))) return;
      await moveAndClick("prompt-bar");
      if (gone()) return;

      setCursorOn(false);
      clearHighlight();
      setPhase("typing");
      setIsTyping(true);
      await typeHumanInput(setTypedInput, gone);
      if (gone()) return;

      setIsTyping(false);
      setPhase("pre-enter");
      await sleep(300);
      if (gone()) return;

      setTypedInput("");
      setPhase("transcript");
      appendLine({ kind: "user", text: FULL_PROMPT });
      await sleep(320);
      if (gone()) return;

      appendLine({
        kind: "ai-header",
        text: "Scaffolding DoubleJump.server.lua and pushing via sync…",
      });
      await sleep(280);
      if (gone()) return;

      await runLoadingStep("Bootstrapping Roblox/server.lua…", 1200, 0, gone);
      if (gone()) return;
      await runLoadingStep("Generating DoubleJump.client.lua…", 1100, 1, gone);
      if (gone()) return;
      await runLoadingStep("Pushing sync to Studio…", 950, 1, gone);
      if (gone()) return;

      setHasSpinner(false);
      appendLine({ kind: "success", text: "Uploaded 2 scripts to Studio" });
      setPillar(null);
      await sleep(900);
      if (gone()) return;

      setPhase("slash");
      setPillar(2);
      setSlashPrompt("/");
      await sleep(280);
      setPhase("slash-nav");
      setSlashPrompt("/sy");
      await sleep(220);

      setCursorOn(true);
      await moveAndClick("slash-sync");
      if (gone()) return;
      setCursorOn(false);
      clearHighlight();
      setSlashSelected(1);
      setSlashPrompt("/sync");
      await sleep(340);

      setPhase("sync");
      appendLine({
        kind: "ai-header",
        text: "Applying /sync to DoubleJump.server.lua…",
      });
      await sleep(260);
      await runLoadingStep("Running diff against Studio…", 900, 1, gone);
      if (gone()) return;
      await runLoadingStep("Committing JumpConfig.module.lua…", 850, 1, gone);
      if (gone()) return;

      setHasSpinner(false);
      appendLine({ kind: "success", text: "Uploaded 3 scripts to Studio" });
      setPillar(null);
      await sleep(1000);

      setCursorOn(false);
      await sleep(420);
      if (!gone()) play();
    }

    play();
    return () => {
      dead = true;
      runRef.current += 1;
    };
  }, [
    isInView,
    appendLine,
    moveAndClick,
    clearHighlight,
    markLineDone,
    placeCursor,
    pt,
    runLoadingStep,
    setPillar,
    cliAutoplay,
  ]);

  const ring = (id: Target) =>
    highlight === id
      ? "ring-2 ring-[#ffb347]/50 ring-offset-2 ring-offset-[#050506] shadow-[0_0_20px_rgba(255,179,71,0.15)]"
      : "";
  const press = (id: Target) => (pressed === id ? "scale-[0.98]" : "");

  const promptHasInput = typedInput.length > 0;
  const showPromptCursor =
    phase === "welcome" || phase === "typing" || phase === "pre-enter" || showSlash;
  const cursorSolid = isTyping;

  return (
    <div ref={stageRef} className={`relative cursor-none select-none ${className}`}>
      <TerminalChrome>
        <div className="flex-1 overflow-hidden py-4 relative min-h-[240px]">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(255,140,0,0.07), transparent 55%)",
            }}
          />

          <LayoutGroup id="cli-transcript">
            <AnimatePresence mode="popLayout">
              {showWelcome && (
                <motion.div
                  key="welcome"
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  transition={LAYOUT_SPRING}
                  className="px-4 sm:px-5 text-[10px] sm:text-[11px] overflow-hidden"
                >
                  <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between gap-2 bg-black/20">
                      <span className="text-[#ffb347] font-semibold tracking-tight">Apple Juice Sync</span>
                      <span className="text-zinc-600 text-[9px]">v2.1</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,38%)_1fr] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                      <div className="px-4 py-4 flex flex-col items-center justify-center bg-[#ff8c00]/[0.03]">
                        <p className="text-white font-semibold text-[11px] mb-3 w-full text-center">Welcome back!</p>
                        <div className="rounded-lg bg-black/30 border border-white/[0.05] px-3 py-2.5">
                          <AppleArt />
                        </div>
                        <p className="text-zinc-500 text-[9px] mt-3 text-center">Google · 128K context</p>
                      </div>
                      <div className="px-4 py-4 flex flex-col justify-center gap-2.5">
                        <p className="text-white font-semibold text-[11px]">Getting started</p>
                        <p className="text-zinc-400 text-[10px] leading-relaxed">
                          Type any prompt to ask the AI, or use a slash command.
                        </p>
                        <div className="rounded-md bg-black/25 border border-white/[0.05] px-2.5 py-2 text-[10px]">
                          <span className="text-[#cc6b49] font-semibold">/sync</span>
                          <span className="text-zinc-500"> — push files to Studio</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {(showTranscript || showSlash) && (
              <motion.div
                layout
                className="px-4 sm:px-5 text-[10px] sm:text-[11px] space-y-2.5 mt-1"
              >
                <AnimatePresence mode="popLayout">
                  {lines.map((line) => (
                    <motion.div
                      key={line.id}
                      layout
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      transition={LAYOUT_SPRING}
                      className="overflow-hidden"
                    >
                      <TerminalLineRow line={line} spinnerFrame={spinnerFrame} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </LayoutGroup>

          <AnimatePresence>
            {showSlash && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.28 }}
                className="absolute bottom-0 left-0 right-0 px-4 sm:px-5 pb-1 text-[10px] sm:text-[11px]"
              >
                <p className="text-zinc-600 mb-2 text-[9px] uppercase tracking-[0.18em]">Commands</p>
                <div className="rounded-xl border border-white/[0.08] bg-black/50 backdrop-blur-sm overflow-hidden">
                  {SLASH_COMMANDS.map((c, i) => {
                    const selected = i === slashSelected;
                    const targetId = c.id === "sync" ? "slash-sync" : null;
                    return (
                      <div
                        key={c.cmd}
                        ref={targetId ? reg(targetId as Target) : undefined}
                        className={`px-3.5 py-2.5 border-b border-white/[0.04] last:border-0 flex items-baseline gap-2 transition-colors ${
                          selected ? "bg-[#ff8c00]/[0.1]" : ""
                        } ${targetId ? `${ring(targetId as Target)} ${press(targetId as Target)}` : ""}`}
                      >
                        <span
                          className="font-semibold shrink-0"
                          style={{ color: selected ? BRAND_LIGHT : BRAND }}
                        >
                          {selected ? "▸" : " "}
                          {c.cmd}
                        </span>
                        <span className="text-zinc-500 truncate">{c.desc}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-shrink-0 border-t border-white/[0.08] bg-[#030304]/90 backdrop-blur-sm">
          <p className="text-center text-zinc-700 py-1.5 text-[8px] sm:text-[9px] tracking-wide px-3">
            Tab commands · Shift+Tab agents · Ctrl+C exit
          </p>
          <div
            ref={reg("prompt-bar")}
            className={`mx-3 mb-3 rounded-lg border border-white/[0.08] bg-[#0a0a0c]/90 px-3 py-2.5 flex items-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-transform ${ring("prompt-bar")} ${press("prompt-bar")}`}
          >
            <span className="text-zinc-600 text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] shrink-0">
              normal
            </span>
            <span className="text-[#ffb347] font-bold shrink-0">{">"}</span>
            <span className="truncate flex-1 text-[10px] sm:text-[11px] min-w-0">
              {promptHasInput || phase === "typing" || phase === "pre-enter" ? (
                <HighlightedInput text={typedInput} />
              ) : showSlash ? (
                <span className="text-zinc-100">{slashPrompt}</span>
              ) : (
                <span className="text-zinc-600 italic">build a double jump with momentum…</span>
              )}
              {showPromptCursor && <BlockCursor solid={cursorSolid} />}
            </span>
          </div>
        </div>
      </TerminalChrome>

      {ripples.map((r) => (
        <ClickRipple key={r.id} id={r.id} point={r.p} />
      ))}
      <DemoCursor x={cursorX} y={cursorY} pressing={pressing} visible={cursorOn} hovering={highlight !== null} />
    </div>
  );
}
