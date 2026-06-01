"use client";

import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { getLandingPerfConfig } from "@/lib/landing-perf";
import { sleep } from "@/lib/human-cursor-motion";
import { useInView } from "@/hooks/use-in-view";
import {
  ClickRipple,
  DemoCursor,
  useHumanDemoCursor,
} from "@/hooks/use-human-demo-cursor";
import {
  ArrowRight,
  ChevronDown,
  FileCode,
  Folder,
  FolderOpen,
  Loader2,
  Sparkles,
} from "lucide-react";
type Step =
  | "INITIAL"
  | "TOGGLE"
  | "MENU"
  | "PROMPT"
  | "FOLDER"
  | "LOADING"
  | "PROGRESS"
  | "DASHBOARD"
  | "TASKS";

type Target =
  | "chat-pill"
  | "studio-tab"
  | "action-generate"
  | "folder-btn"
  | "folder-row"
  | "folder-open"
  | "lets-go"
  | "new-task";

type HeroCursorTarget = Target | `progress-${number}`;

type ShellContent = "pill" | "toggle" | "menu" | "prompt";
type ItemPhase = "pending" | "active" | "done";

const ACTIONS = [
  { id: "generate", label: "Generate Luau", icon: FileCode },
  { id: "sync", label: "Sync scripts", icon: Sparkles },
  { id: "playtest", label: "Run playtest", icon: Loader2 },
  { id: "fix", label: "Fix errors", icon: Sparkles },
  { id: "scan", label: "Scan workspace", icon: FolderOpen },
  { id: "deploy", label: "Deploy module", icon: FileCode },
];

const PROGRESS_STEPS = [
  "Read workspace hierarchy in MyObbyGame",
  "Generate DoubleJump.server.lua",
  "Push scripts to Roblox Studio",
  "Run playtest diagnostics",
];

const TASKS = [
  { title: "Draft jump mechanic", dot: true },
  { title: "Sync obby scripts", dot: true },
  { title: "Fix Humanoid timeout", dot: false },
];

const PROJECTS = [
  "TowerDefenseSim",
  "PetSimWorld",
  "RacingLeague",
  "MyObbyGame",
  "HorrorMap_v3",
  "TycoonFactory",
];

const SPIN_FRAMES = ["✦", "✧", "★", "☆", "✶", "✷", "✸", "✹"];
const CLI_LOADING_VERBS = [
  "Tomfoolering",
  "Beboppin'",
  "Booping",
  "Flibbertigibbeting",
  "Lollygagging",
  "Skedaddling",
  "Shenaniganing",
  "Bamboozling",
  "Dilly-dallying",
  "Boondoggling",
  "Discombobulating",
  "Juicing",
  "Squeezing",
  "Blending",
  "Fermenting",
];
const EASE = [0.22, 1, 0.36, 1] as const;
const CAMERA_EASE = [0.45, 0, 0.15, 1] as const;
const MORPH_SPRING = { type: "spring" as const, stiffness: 200, damping: 25, mass: 1 };

type CameraFrame = { scale: number; x: number; y: number };

function cameraForStep(step: Step): CameraFrame {
  switch (step) {
    case "INITIAL":
    case "TOGGLE":
      return { scale: 1.12, x: 0, y: 12 };
    case "MENU":
      return { scale: 1.1, x: 0, y: 4 };
    case "PROMPT":
    case "FOLDER":
      return { scale: 1.08, x: 0, y: -6 };
    case "LOADING":
      return { scale: 1.1, x: 0, y: 0 };
    case "PROGRESS":
      return { scale: 1.14, x: 0, y: 0 };
    case "DASHBOARD":
      return { scale: 1.04, x: 0, y: 0 };
    case "TASKS":
      return { scale: 1.08, x: -24, y: 0 };
    default:
      return { scale: 1.06, x: 0, y: 0 };
  }
}

const CARD_SHADOW =
  "shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_32px_100px_rgba(255,255,255,0.06),0_48px_120px_rgba(0,0,0,0.55)]";

const DARK_CARD_SHADOW =
  "shadow-2xl shadow-black/50 border border-white/10";

function shellContentFor(step: Step): ShellContent | null {
  if (step === "INITIAL") return "pill";
  if (step === "TOGGLE") return "toggle";
  if (step === "MENU") return "menu";
  if (step === "PROMPT" || step === "FOLDER") return "prompt";
  return null;
}

function shellDimensions(content: ShellContent) {
  switch (content) {
    case "pill":
      return { width: 112, height: 44, borderRadius: 9999 };
    case "toggle":
      return { width: 220, height: 44, borderRadius: 9999 };
    case "menu":
    case "prompt":
      return { width: 540, height: 360, borderRadius: 24 };
  }
}

function cardDimensions(step: Step) {
  if (step === "PROGRESS") {
    return { width: 340, height: 300, borderRadius: 16 };
  }
  return { width: "100%", height: "100%", borderRadius: 14 };
}

function StoryCaption({ text }: { text: string }) {
  return (
    <motion.div
      key={text}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[110] w-[min(100%,420px)] px-5 py-2.5 rounded-2xl border border-white/[0.12] bg-black/75 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-none"
    >
      <p className="text-[11px] sm:text-xs text-white/85 font-medium text-center leading-snug tracking-wide">
        {text}
      </p>
    </motion.div>
  );
}

function getProgressPhase(index: number, currentLoadingStep: number): ItemPhase {
  if (index < currentLoadingStep) return "done";
  if (index === currentLoadingStep) return "active";
  return "pending";
}


function ProgressStepIcon({ phase }: { phase: ItemPhase }) {
  if (phase === "pending") {
    return (
      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-neutral-600 bg-neutral-800/60" />
    );
  }

  if (phase === "active") {
    return (
      <span className="mt-0.5 h-4 w-4 shrink-0 relative flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="#374151" strokeWidth="1.5" />
          <motion.circle
            cx="8"
            cy="8"
            r="6.5"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="28"
            animate={{ strokeDashoffset: [28, 0] }}
            transition={{ duration: 0.65, ease: "linear", repeat: Infinity }}
          />
        </svg>
      </span>
    );
  }

  return (
    <motion.span
      initial={{ scale: 0.72 }}
      animate={{ scale: 1 }}
      transition={MORPH_SPRING}
      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white text-[9px] font-bold"
    >
      ✓
    </motion.span>
  );
}

function DashboardPanes() {
  return (
    <>
      <div className="w-[28%] min-w-[100px] border-r border-neutral-200 bg-white flex flex-col">
        <div className="px-3 py-2 border-b border-neutral-100 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
          Chat
        </div>
        <div className="p-3 space-y-2 flex-1 overflow-hidden">
          <div className="rounded-lg bg-neutral-100 px-2.5 py-2 text-[10px] text-neutral-600">
            Build a double jump for my obby
          </div>
          <div className="rounded-lg bg-[#ccff00]/15 border border-[#ccff00]/30 px-2.5 py-2 text-[10px] text-neutral-800">
            <span className="font-bold text-[#6b8f00]">Apple Juice</span>
            <p className="mt-1">Generated server + client scripts and synced to Studio.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <div className="px-3 py-2 border-b border-neutral-100 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-neutral-700 truncate">
            DoubleJump.server.lua
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 shrink-0">
            Open in Studio
          </span>
        </div>
        <div className="p-4 flex-1">
          <h4 className="text-sm font-bold text-neutral-900 mb-3">Double Jump System</h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: "2", l: "Max jumps" },
              { n: "3", l: "Scripts synced" },
              { n: "0", l: "Runtime errors" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-neutral-900 text-white p-3 text-center">
                <p className="text-lg font-black">{s.n}</p>
                <p className="text-[8px] text-white/50 uppercase tracking-wide mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
          <pre className="mt-3 text-[9px] font-mono text-neutral-500 leading-relaxed bg-neutral-50 rounded-lg p-2 overflow-hidden">
            {`local MAX_JUMPS = 2\n-- server authoritative jump logic…`}
          </pre>
        </div>
      </div>
      <div className="w-[26%] min-w-[90px] border-l border-neutral-200 bg-[#fafafa] p-3 space-y-4 overflow-hidden">
        <div>
          <p className="text-[9px] font-bold uppercase text-neutral-400 mb-2">Progress</p>
          {PROGRESS_STEPS.map((t) => (
            <p key={t} className="text-[9px] text-neutral-500 flex gap-1.5 mb-1">
              <span className="text-blue-500">✓</span>
              <span className="truncate">{t.split(" ")[0]}…</span>
            </p>
          ))}
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-neutral-400 mb-2">Artifacts</p>
          {["DoubleJump.server.lua", "DoubleJump.client.lua"].map((f) => (
            <p key={f} className="text-[9px] text-neutral-600 truncate mb-1">{f}</p>
          ))}
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-neutral-400 mb-2">Context</p>
          {["Workspace.rbxl", "Humanoid.lua", "Config.module.lua"].map((f) => (
            <p key={f} className="text-[9px] text-neutral-500 truncate mb-1">{f}</p>
          ))}
        </div>
      </div>
    </>
  );
}

export function LandingHeroShowcase() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraLayerRef = useRef<HTMLDivElement>(null);
  const targets = useRef<Partial<Record<HeroCursorTarget, HTMLElement>>>({});

  const [step, setStep] = useState<Step>("INITIAL");
  const [mode, setMode] = useState<"chat" | "studio">("chat");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [spinFrame, setSpinFrame] = useState(0);
  const [currentLoadingStep, setCurrentLoadingStep] = useState(-1);
  const [progressStarted, setProgressStarted] = useState(false);

  const [caption, setCaption] = useState<string | null>(null);

  // Cinematic custom loader states
  const [loadingVerb, setLoadingVerb] = useState("Tomfoolering");
  const [zoomActive, setZoomActive] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [currentDelay, setCurrentDelay] = useState(300);
  const runRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(rootRef, { threshold: 0.1, rootMargin: "120px 0px" });
  const heroAutoplay = getLandingPerfConfig().heroAutoplay;

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
    moveAndClick,
    clearHighlight,
  } = useHumanDemoCursor<HeroCursorTarget>({
    stageRef,
    contentLayerRef: cameraLayerRef,
    targets,
    motionEnabled: heroAutoplay,
  });

  const shellContent = shellContentFor(step);
  const isShell = shellContent !== null;
  const isCardPhase = step === "PROGRESS" || step === "DASHBOARD" || step === "TASKS";
  const isLoading = step === "LOADING";

  useEffect(() => {
    if (!isLoading) return;
    const iv = setInterval(() => setSpinFrame((f) => (f + 1) % SPIN_FRAMES.length), 95);
    return () => clearInterval(iv);
  }, [isLoading]);

  const reg = useCallback(
    (id: HeroCursorTarget) => (el: HTMLElement | null) => {
      if (el) targets.current[id] = el;
      else delete targets.current[id];
    },
    [],
  );

  const reset = useCallback(() => {
    setStep("INITIAL");
    setMode("chat");
    setSelectedAction(null);
    setProjectName(null);
    setPromptText("");
    setCurrentLoadingStep(-1);
    setProgressStarted(false);
    clearHighlight();
    setCaption(null);
    setLoadingVerb("Tomfoolering");
    setZoomActive(false);
    setFlashActive(false);
    setCurrentDelay(350);
  }, [clearHighlight]);

  useLayoutEffect(() => {
    placeCursor(0.72, 0.58);
  }, [placeCursor]);

  useEffect(() => {
    if (!isInView) {
      runRef.current += 1;
      setCursorOn(false);
      return;
    }

    if (!heroAutoplay) return;

    let dead = false;
    const run = ++runRef.current;
    const gone = () => dead || runRef.current !== run;

    async function runProgressItem(i: number) {
      setCurrentLoadingStep(i);
      await sleep(280);
      if (gone()) return;
      setCurrentLoadingStep(i + 1);
      await sleep(80);
    }

    async function play() {
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
      if (gone()) return;

      reset();
      await sleep(320);
      if (gone()) return;

      setCursorOn(true);
      placeCursor(0.78, 0.62);

      await moveAndClick("chat-pill");
      if (gone()) return;
      setStep("TOGGLE");
      await sleep(320);

      await moveAndClick("studio-tab");
      if (gone()) return;
      setMode("studio");
      setStep("MENU");
      await sleep(400);

      await moveAndClick("action-generate");
      if (gone()) return;
      setSelectedAction("generate");
      setStep("PROMPT");
      setPromptText("Build a double jump system for");
      await sleep(360);

      await moveAndClick("folder-btn");
      if (gone()) return;
      setStep("FOLDER");
      await sleep(280);

      await moveAndClick("folder-row");
      if (gone()) return;
      await sleep(140);

      await moveAndClick("folder-open");
      if (gone()) return;
      setProjectName("MyObbyGame");
      setStep("PROMPT");
      setPromptText("Build a double jump system for my obby");
      setCaption("Describe your game in plain language — Apple Juice handles the rest.");
      await sleep(1850);

      await moveAndClick("lets-go");
      if (gone()) return;
      setCaption(null);
      setCursorOn(false);
      clearHighlight();

      setStep("LOADING");
      setCaption(
        "Apple Juice automatically syncs ability scripts to Roblox Studio — no copy-paste.",
      );
      
      let currentDelayVal = 350;
      let starIndex = 0;
      let verbIndex = 0;

      while (currentDelayVal > 12) {
        if (gone()) return;
        setSpinFrame(starIndex);
        setLoadingVerb(CLI_LOADING_VERBS[verbIndex % CLI_LOADING_VERBS.length]);
        setCurrentDelay(currentDelayVal);

        await sleep(currentDelayVal);

        starIndex = (starIndex + 1) % SPIN_FRAMES.length;
        verbIndex++;
        currentDelayVal = Math.max(12, currentDelayVal * 0.85);
      }

      // Max speed warp drive!
      for (let f = 0; f < 22; f++) {
        if (gone()) return;
        setSpinFrame(starIndex);
        setLoadingVerb(CLI_LOADING_VERBS[verbIndex % CLI_LOADING_VERBS.length]);
        setCurrentDelay(12);

        await sleep(12);

        starIndex = (starIndex + 1) % SPIN_FRAMES.length;
        verbIndex++;
      }

      // Trigger zoom & flash peak
      setZoomActive(true);
      setFlashActive(true);

      await sleep(220); // wait for peak zoom and peak brightness
      if (gone()) return;

      setStep("PROGRESS");
      setCaption("Each build step completes in Studio while you watch.");
      setProgressStarted(true);
      setCurrentLoadingStep(0);

      // Reset zoom immediately so subsequent views are normal scale
      setZoomActive(false);

      // Wait for flash to fully complete and then turn it off
      await sleep(350);
      if (gone()) return;
      setFlashActive(false);
      await sleep(160);
      for (let i = 0; i < PROGRESS_STEPS.length; i++) {
        if (gone()) return;
        await runProgressItem(i);
      }
      await sleep(140);

      setStep("DASHBOARD");
      setCaption(null);
      setCursorOn(false);
      await sleep(1400);

      setStep("TASKS");
      setCursorOn(true);
      await sleep(200);
      await moveAndClick("new-task");
      if (gone()) return;
      await sleep(980);

      setCursorOn(false);
      await sleep(360);
      if (!gone()) play();
    }

    play();
    return () => {
      dead = true;
      runRef.current += 1;
    };
  }, [isInView, moveAndClick, placeCursor, reset, clearHighlight, heroAutoplay]);

  const ring = (id: Target) =>
    highlight === id ? "ring-2 ring-white/35 ring-offset-2 ring-offset-black shadow-[0_0_28px_rgba(255,255,255,0.1)]" : "";
  const press = (id: Target) => (pressed === id ? "scale-[0.97]" : "");

  const dims = shellContent ? shellDimensions(shellContent) : null;
  const cardDims = isCardPhase ? cardDimensions(step) : null;
  const camera = cameraForStep(step);

  const stageInner = (
    <div
      ref={stageRef}
      className="relative w-full h-full min-h-[480px] overflow-hidden cursor-none select-none bg-black"
      style={{ height: "min(520px, 72vw)" }}
    >
      <motion.div
        ref={cameraLayerRef}
        className="absolute inset-0 flex items-center justify-center p-4 md:p-6 origin-center"
        animate={{
          scale: camera.scale,
          x: camera.x,
          y: camera.y,
        }}
        transition={{ duration: 0.75, ease: CAMERA_EASE }}
      >
        <LayoutGroup id="hero-demo">
          {/* ── Morphing shell (single layout element, no inner unmount) ── */}
          {isShell && shellContent && dims && (
            <motion.div
              layout
              layoutId="hero-card"
              transition={MORPH_SPRING}
              className={`relative bg-[#050508] text-white/90 overflow-hidden flex flex-col z-10 max-w-[calc(100%-1rem)] border border-white/10 ${CARD_SHADOW}`}
              style={{
                width: dims.width,
                height: dims.height,
                borderRadius: dims.borderRadius,
              }}
            >
              <div className="h-full w-full flex flex-col relative overflow-hidden">
                {shellContent === "pill" && (
                  <button
                    ref={reg("chat-pill")}
                    type="button"
                    tabIndex={-1}
                    className={`flex-1 flex items-center justify-center text-sm font-semibold text-white/90 transition-transform ${ring("chat-pill")} ${press("chat-pill")}`}
                  >
                    Chat
                  </button>
                )}

                {shellContent === "toggle" && (
                  <div className="flex h-full w-full">
                    <div className="flex-1 flex items-center justify-center text-sm font-medium text-white/50">
                      Chat
                    </div>
                    <button
                      ref={reg("studio-tab")}
                      type="button"
                      tabIndex={-1}
                      className={`flex-1 flex items-center justify-center text-sm font-semibold rounded-full mx-1 my-1 transition-all ${
                        mode === "studio" ? "bg-white/10 text-white" : "text-white/50"
                      } ${ring("studio-tab")} ${press("studio-tab")}`}
                    >
                      Studio
                    </button>
                  </div>
                )}

                {shellContent === "menu" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, delay: 0.06 }}
                    className="p-5 h-full flex flex-col"
                  >
                    <p className="text-xs font-semibold text-white/50 mb-4">
                      What should Apple Juice do?
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
                      {ACTIONS.map((a) => {
                        const Icon = a.icon;
                        const isGen = a.id === "generate";
                        return (
                          <button
                            key={a.id}
                            ref={isGen ? reg("action-generate") : undefined}
                            type="button"
                            tabIndex={-1}
                            className={`flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-colors duration-200 hover:bg-white/5 ${
                              isGen ? "border-[#ccff00]/40 bg-[#ccff00]/10" : "border-white/10"
                            } ${isGen ? `${ring("action-generate")} ${press("action-generate")}` : ""}`}
                          >
                            <Icon className={`h-4 w-4 ${isGen ? "text-[#ccff00]" : "text-white/50"}`} />
                            <span className="text-xs font-semibold text-white/90 leading-tight">
                              {a.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {shellContent === "prompt" && selectedAction && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    className="p-5 h-full flex flex-col relative"
                  >
                    <p className="text-xs font-semibold text-white/50 mb-3">Generate Luau</p>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 min-h-[48px] mb-4">
                      {promptText}
                      {step === "PROMPT" && !projectName && (
                        <span className="inline-block w-0.5 h-4 bg-white/50 ml-0.5 animate-pulse align-middle" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-auto">
                      <button
                        ref={reg("folder-btn")}
                        type="button"
                        tabIndex={-1}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-medium text-white/70 transition-all ${ring("folder-btn")} ${press("folder-btn")}`}
                      >
                        <Folder className="h-3.5 w-3.5" />
                        {projectName ?? "Work in a place +"}
                      </button>
                      <button
                        ref={reg("lets-go")}
                        type="button"
                        tabIndex={-1}
                        className={`ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ccff00] text-black text-xs font-bold transition-all shadow-[0_4px_14px_rgba(204,255,0,0.25)] ${ring("lets-go")} ${press("lets-go")}`}
                      >
                        Let&apos;s go
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <AnimatePresence>
                      {step === "FOLDER" && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98, y: 4 }}
                          transition={MORPH_SPRING}
                          className="absolute inset-3 rounded-2xl bg-[#0a0a0f] border border-white/10 shadow-2xl overflow-hidden flex flex-col z-20"
                        >
                          <div className="h-8 bg-[#141416] border-b border-white/10 flex items-center px-3 gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-[#ff5f56]" />
                            <div className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
                            <div className="h-2 w-2 rounded-full bg-[#27c93f]" />
                            <span className="ml-2 text-[10px] text-white/50 font-medium">
                              Choose a Roblox place
                            </span>
                          </div>
                          <div className="flex flex-1 min-h-0">
                            <div className="w-28 bg-[#050508] border-r border-white/10 p-2 text-[10px] text-white/50 space-y-1">
                              <p className="font-semibold text-white/80 px-1">Favorites</p>
                              <p className="px-1 py-0.5 rounded bg-white/10">Documents</p>
                              <p className="px-1 py-0.5">Desktop</p>
                            </div>
                            <div className="flex-1 p-2 overflow-y-auto min-h-0 space-y-0.5">
                              {PROJECTS.map((name) => {
                                const selected = name === "MyObbyGame";
                                return (
                                  <button
                                    key={name}
                                    ref={selected ? reg("folder-row") : undefined}
                                    type="button"
                                    tabIndex={-1}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-white/90 transition-all ${
                                      selected
                                        ? `bg-[#ccff00]/10 border border-[#ccff00]/30 text-[#ccff00] ${ring("folder-row")} ${press("folder-row")}`
                                        : "border border-transparent hover:bg-white/5 text-white/60"
                                    }`}
                                  >
                                    <FolderOpen
                                      className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-[#ccff00]" : "text-white/40"}`}
                                    />
                                    <span className="truncate">{name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="h-10 border-t border-white/10 flex items-center justify-end px-3 gap-2 bg-[#0a0a0f]">
                            <button type="button" tabIndex={-1} className="text-[10px] px-2 py-1 text-white/50 hover:text-white">
                              Cancel
                            </button>
                            <button
                              ref={reg("folder-open")}
                              type="button"
                              tabIndex={-1}
                              className={`text-[10px] px-3 py-1 rounded-md bg-[#ccff00] text-black font-semibold transition-all ${ring("folder-open")} ${press("folder-open")}`}
                            >
                              Open
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Cinematic high-energy accelerating loading screen ── */}
          {isLoading && (
            <motion.div
              layout
              layoutId="hero-card"
              transition={MORPH_SPRING}
              className="relative z-10 overflow-hidden max-w-[calc(100%-1rem)] rounded-3xl border border-white/[0.12] bg-[#050508] shadow-[0_0_80px_rgba(204,107,73,0.15)] flex items-center justify-center"
              style={{ width: 560, height: 380, borderRadius: 28 }}
            >
              {/* Radial space glow effect */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle 300px at 50% 50%, rgba(204,107,73,0.12), rgba(204,255,0,0.03), transparent 70%)",
                }}
              />
              
              <motion.div 
                className="flex flex-col items-center justify-center gap-6 text-center select-none p-8 w-full"
                animate={{
                  scale: zoomActive ? 3.5 : 1,
                  opacity: zoomActive ? 0 : 1,
                  filter: zoomActive ? "blur(8px)" : "blur(0px)",
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                {/* Giant Star Icon / ASCII Spinner */}
                <div className="relative h-20 sm:h-24 flex items-center justify-center animate-pulse">
                  {/* Ambient radial glow behind the star */}
                  <div 
                    className="absolute rounded-full bg-[#cc6b49]/10 blur-xl transition-all duration-300"
                    style={{
                      width: currentDelay < 50 ? 120 : 80,
                      height: currentDelay < 50 ? 120 : 80,
                    }}
                  />
                  <motion.span
                    key={spinFrame}
                    className="relative block font-mono text-6xl sm:text-7xl font-extralight leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] via-[#faa582] to-[#cc6b49] filter drop-shadow-[0_0_15px_rgba(204,107,73,0.4)]"
                    animate={currentDelay < 40 ? {
                      scale: [1, 1.15, 1],
                      rotate: [0, 5, -5, 0],
                    } : {}}
                    transition={{ duration: 0.15 }}
                  >
                    {SPIN_FRAMES[spinFrame % SPIN_FRAMES.length]}
                  </motion.span>
                </div>
                
                {/* Massive Verb Text */}
                <h2
                  className="font-mono text-xl sm:text-3xl font-extrabold tracking-[0.18em] uppercase transition-transform"
                  style={{
                    transform: `translate(${zoomActive ? 0 : (currentDelay < 50 ? (Math.random() - 0.5) * (150 / currentDelay) : 0)}px, ${zoomActive ? 0 : (currentDelay < 50 ? (Math.random() - 0.5) * (150 / currentDelay) : 0)}px)`,
                    color: "#ffffff",
                    textShadow: "0 0 12px rgba(255,255,255,0.1), 0 0 25px rgba(204,107,73,0.15)",
                  }}
                >
                  {loadingVerb}
                  <span className="text-[#ccff00]">...</span>
                </h2>
                
                {/* Speed sub-indicator */}
                <div className="absolute bottom-4 left-0 right-0 text-[9px] font-mono text-neutral-600 uppercase tracking-widest">
                  Warp Engine · Speed: {Math.round(1000 / currentDelay)} hz
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── Unified progress → dashboard card (same layout element) ── */}
          {isCardPhase && cardDims && (
            <motion.div
              layout
              layoutId="hero-card"
              transition={MORPH_SPRING}
              className={`overflow-hidden z-20 flex flex-col ${
                step === "PROGRESS"
                  ? `bg-[#141416] ${DARK_CARD_SHADOW}`
                  : "absolute inset-3 bg-[#050508] border border-white/10 shadow-2xl"
              }`}
              style={{
                width: cardDims.width,
                height: cardDims.height,
                borderRadius: cardDims.borderRadius,
                position: step === "PROGRESS" ? "relative" : undefined,
              }}
            >
              {step === "PROGRESS" ? (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
                    <span className="text-sm font-semibold text-white/90">Progress</span>
                    <ChevronDown className="h-4 w-4 text-white/40" />
                  </div>
                  <ul className="px-4 py-3 space-y-3 min-h-[200px]">
                    {PROGRESS_STEPS.map((text, i) => {
                      if (!progressStarted) return null;
                      const phase = getProgressPhase(i, currentLoadingStep);
                      return (
                        <motion.li
                          key={text}
                          ref={reg(`progress-${i}` as `progress-${number}`)}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-3 text-xs"
                        >
                          <ProgressStepIcon phase={phase} />
                          <span
                            className={
                              phase === "done"
                                ? "text-neutral-500"
                                : phase === "active"
                                  ? "text-white"
                                  : "text-neutral-500"
                            }
                          >
                            {text}
                          </span>
                        </motion.li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="flex flex-1 min-h-0">
                  <DashboardPanes />
                </div>
              )}
            </motion.div>
          )}
        </LayoutGroup>

        {/* Task slide-over (inside modal stage) */}
        <AnimatePresence>
          {step === "TASKS" && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="absolute inset-y-4 right-4 left-4 md:left-auto md:w-[320px] bg-[#050508] rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-30"
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-bold text-white/90">Apple Juice</span>
                <button
                  ref={reg("new-task")}
                  type="button"
                  tabIndex={-1}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-[#ccff00] text-black transition-all ${ring("new-task")} ${press("new-task")}`}
                >
                  + New task
                </button>
              </div>
              <ul className="p-2">
                {TASKS.map((t) => (
                  <li
                    key={t.title}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-white/80"
                  >
                    {t.dot ? (
                      <span className="h-2 w-2 rounded-full bg-[#ccff00] shrink-0" />
                    ) : (
                      <span className="h-2 w-2 shrink-0" />
                    )}
                    {t.title}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {ripples.map((r) => (
          <ClickRipple key={r.id} id={r.id} point={r.p} />
        ))}
        <DemoCursor x={cursorX} y={cursorY} pressing={pressing} visible={cursorOn} hovering={highlight !== null} />
      </motion.div>

      {/* Cinematic Flash Overlay */}
      <AnimatePresence>
        {flashActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, times: [0, 0.25, 0.5, 1], ease: "easeInOut" }}
            className="absolute inset-0 bg-gradient-to-br from-[#ccff00]/40 via-[#faa582] to-white z-[140] mix-blend-screen pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div ref={rootRef} className="relative w-full max-w-[940px] mx-auto px-2">
      <div
        className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.06] shadow-[0_48px_120px_rgba(0,0,0,0.65)] bg-black"
        style={{ height: "min(520px, 72vw)" }}
      >
        {stageInner}
        <AnimatePresence>
          {caption ? <StoryCaption text={caption} /> : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
