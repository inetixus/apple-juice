"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const BRAND = "#cc6b49";
const BRAND_LIGHT = "#faa582";
const SPIN_FRAMES = ["✦", "✧", "★", "☆", "✶", "✷", "✸", "✹"];

const SLASH_COMMANDS = [
  { cmd: "/pair", desc: "Link terminal to Roblox Studio" },
  { cmd: "/sync", desc: "AI-edit a file and push to Studio" },
  { cmd: "/model", desc: "Select AI model interactively" },
  { cmd: "/status", desc: "Refresh server + Studio status" },
];

type Scene = "welcome" | "chat" | "slash";

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
    <div
      className="font-mono text-[9px] leading-[1.15] select-none text-left"
      aria-hidden
    >
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

function WelcomeCard() {
  return (
    <div className="px-4 sm:px-5 font-mono text-[10px] sm:text-[11px] leading-relaxed">
      <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between gap-2 bg-black/20">
          <span className="text-[#ffb347] font-semibold tracking-tight">
            Apple Juice Sync
          </span>
          <span className="text-zinc-600 text-[9px]">v2.1</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,38%)_1fr] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
          <div className="px-4 py-4 flex flex-col items-center justify-center bg-[#ff8c00]/[0.03]">
            <p className="text-white font-semibold text-[11px] mb-3 w-full text-center">
              Welcome back!
            </p>
            <div className="rounded-lg bg-black/30 border border-white/[0.05] px-3 py-2.5">
              <AppleArt />
            </div>
            <p className="text-zinc-500 text-[9px] mt-3 text-center">
              Google · 128K context
            </p>
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
            <div className="flex items-center gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#92ff92]/10 border border-[#92ff92]/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#92ff92]" />
                <span className="text-[#92ff92]">Studio paired</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatTranscript({ spinFrame }: { spinFrame: number }) {
  return (
    <div className="px-4 sm:px-5 font-mono text-[10px] sm:text-[11px] space-y-3">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
        <p className="text-zinc-500 text-[9px] uppercase tracking-wider mb-1.5">You</p>
        <p className="text-zinc-100 leading-relaxed">
          add a momentum double jump — server authoritative
        </p>
      </div>
      <div className="rounded-xl border border-[#cc6b49]/20 bg-[#cc6b49]/[0.06] px-3.5 py-3">
        <p className="font-semibold text-[11px] mb-1.5" style={{ color: BRAND }}>
          Apple Juice
        </p>
        <p className="text-zinc-300 leading-relaxed">
          Scaffolding DoubleJump.server.lua and pushing via sync…
        </p>
        <p className="mt-2.5 flex items-center gap-2 text-zinc-500 text-[10px]">
          <span style={{ color: BRAND_LIGHT }}>
            {SPIN_FRAMES[spinFrame % SPIN_FRAMES.length]}
          </span>
          Orchestrating workspace sync…
        </p>
      </div>
      <p className="inline-flex items-center gap-2 text-[#92ff92] text-[10px] px-2.5 py-1 rounded-lg bg-[#92ff92]/[0.08] border border-[#92ff92]/15">
        <span>✓</span> Synced 2 scripts to Studio
      </p>
    </div>
  );
}

function SlashMenu({ selected }: { selected: number }) {
  return (
    <div className="px-4 sm:px-5 font-mono text-[10px] sm:text-[11px]">
      <p className="text-zinc-600 mb-2 text-[9px] uppercase tracking-[0.18em]">
        Commands
      </p>
      <div className="rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden">
        {SLASH_COMMANDS.map((c, i) => (
          <div
            key={c.cmd}
            className={`px-3.5 py-2.5 border-b border-white/[0.04] last:border-0 flex items-baseline gap-2 ${
              i === selected ? "bg-[#ff8c00]/[0.08]" : ""
            }`}
          >
            <span
              className="font-semibold shrink-0"
              style={{ color: i === selected ? BRAND_LIGHT : BRAND }}
            >
              {i === selected ? "▸" : " "}
              {c.cmd}
            </span>
            <span className="text-zinc-500 truncate">{c.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusStrip() {
  return (
    <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between gap-3 text-[9px] sm:text-[10px] font-mono bg-[#070709]">
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
  );
}

function TuiChrome({
  scene,
  spinFrame,
  slashSelected,
  promptText,
}: {
  scene: Scene;
  spinFrame: number;
  slashSelected: number;
  promptText: string;
}) {
  return (
    <div className="flex flex-col min-h-[360px] md:min-h-[420px] bg-[#050506] text-zinc-100">
      <StatusStrip />

      <div className="flex-1 overflow-hidden py-4 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(255,140,0,0.07), transparent 55%)",
          }}
        />
        <AnimatePresence mode="wait">
          {scene === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <WelcomeCard />
            </motion.div>
          )}
          {scene === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <ChatTranscript spinFrame={spinFrame} />
            </motion.div>
          )}
          {scene === "slash" && (
            <motion.div
              key="slash"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col justify-end pb-1"
            >
              <div className="flex-1" />
              <SlashMenu selected={slashSelected} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-shrink-0 border-t border-white/[0.08] font-mono bg-[#030304]">
        <p className="text-center text-zinc-700 py-1.5 text-[8px] sm:text-[9px] tracking-wide px-3">
          Tab commands · Shift+Tab agents · Ctrl+C exit
        </p>
        <div className="mx-3 mb-3 rounded-lg border border-white/[0.08] bg-[#0a0a0c] px-3 py-2.5 flex items-center gap-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <span className="text-zinc-600 text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] shrink-0">
            normal
          </span>
          <span className="text-[#ffb347] font-bold shrink-0">{">"}</span>
          <span className="text-zinc-100 truncate flex-1 text-[10px] sm:text-[11px]">
            {promptText}
          </span>
          <span
            className="inline-block w-0.5 h-4 shrink-0 animate-pulse rounded-full"
            style={{ backgroundColor: BRAND }}
          />
        </div>
      </div>
    </div>
  );
}

export function CliTuiPreview({ className = "" }: { className?: string }) {
  const [scene, setScene] = useState<Scene>("welcome");
  const [spinFrame, setSpinFrame] = useState(0);
  const [slashSelected, setSlashSelected] = useState(0);
  const [promptText, setPromptText] = useState(
    "build a double jump with momentum for my obby",
  );

  useEffect(() => {
    if (scene === "welcome") {
      setPromptText("build a double jump with momentum for my obby");
    } else if (scene === "slash") {
      setPromptText("/sy");
    } else {
      setPromptText("");
    }
  }, [scene]);

  useEffect(() => {
    const spin = setInterval(() => setSpinFrame((f) => f + 1), 150);
    return () => clearInterval(spin);
  }, []);

  useEffect(() => {
    const order: Scene[] = ["welcome", "chat", "slash"];
    const durations: Record<Scene, number> = {
      welcome: 8000,
      chat: 9000,
      slash: 7000,
    };
    let idx = 0;
    let t: ReturnType<typeof setTimeout>;

    const schedule = () => {
      t = setTimeout(() => {
        idx = (idx + 1) % order.length;
        setScene(order[idx]);
        schedule();
      }, durations[order[idx]]);
    };
    schedule();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (scene !== "slash") return;
    const iv = setInterval(
      () => setSlashSelected((s) => (s + 1) % SLASH_COMMANDS.length),
      1200,
    );
    return () => clearInterval(iv);
  }, [scene]);

  return (
    <div
      className={`cli-premium-terminal relative rounded-2xl md:rounded-[1.35rem] overflow-hidden border border-white/[0.1] bg-[#060608] ${className}`}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035] cli-scanlines"
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/[0.07] rounded-2xl md:rounded-[1.35rem]"
        aria-hidden
      />

      {/* Title bar */}
      <div className="relative z-[1] flex items-center justify-between px-4 py-2.5 bg-[#0e0e11]/95 border-b border-white/[0.08]">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        </div>
        <span className="text-[10px] font-mono text-zinc-400 tracking-[0.12em]">
          aj · sync engine
        </span>
        <span className="text-[9px] font-mono text-zinc-600 w-8 text-right">⌘K</span>
      </div>

      <div className="relative z-[1]">
        <TuiChrome
          scene={scene}
          spinFrame={spinFrame}
          slashSelected={slashSelected}
          promptText={promptText}
        />
      </div>
    </div>
  );
}
