"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight, Zap, Radio, Command } from "lucide-react";
import { LandingCliShowcase } from "./landing-cli-showcase";

const PILLARS = [
  {
    icon: Radio,
    label: "Studio bridge",
    title: "Direct Studio pairing",
    body: "A persistent terminal link to your live hierarchy — not a one-off export.",
  },
  {
    icon: Zap,
    label: "Sync engine",
    title: "Agent output, pushed live",
    body: "Luau lands in Studio the moment the agent finishes. Zero copy-paste pipeline.",
  },
  {
    icon: Command,
    label: "Command surface",
    title: "Full terminal control",
    body: "Slash commands, autocomplete, and agent orchestration from one shell.",
  },
] as const;

const PROTOCOLS = ["/pair", "/sync", "/model", "/status"];

const METRICS = [
  { value: "1", label: "Terminal layer" },
  { value: "0ms", label: "Copy-paste" },
  { value: "∞", label: "Session depth" },
];

export function LandingCliSection({
  onCta,
}: {
  onCta: () => void;
}) {
  const [activePillar, setActivePillar] = useState<number | null>(null);

  return (
    <section
      id="cli"
      className="relative z-10 scroll-mt-24 w-full max-w-[1320px] mx-auto py-24 md:py-32 lg:py-40"
    >
      {/* Atmospheric field */}
      <div
        className="absolute -inset-x-12 -top-20 bottom-0 -z-10 pointer-events-none"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 30%, rgba(255,140,0,0.09), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 70%, rgba(204,255,0,0.05), transparent 50%)",
        }}
      />

      {/* System manifest — above the product frame */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-[880px] mx-auto mb-14 md:mb-20 px-4"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#ffb347] mb-6 font-mono">
          Introducing · Terminal Operating Layer
        </p>
        <h2 className="text-[2.5rem] sm:text-5xl md:text-6xl lg:text-[4.25rem] font-black tracking-[-0.04em] text-white leading-[0.95] mb-6">
          A second interface
          <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-[#ff8c00] via-[#ffb347] to-[#ccff00]">
            for all of Roblox.
          </span>
        </h2>
        <p className="text-lg md:text-xl text-zinc-400 leading-relaxed max-w-[640px] mx-auto font-medium">
          Apple Juice CLI is not a sidebar feature. It is the command surface that
          connects your terminal, your agent, and Roblox Studio into one system.
        </p>
      </motion.div>

      {/* Product system frame */}
      <div className="relative rounded-[2rem] md:rounded-[2.75rem] border border-white/[0.12] bg-[#050508]/80 backdrop-blur-2xl shadow-[0_48px_140px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden">
        {/* Left accent — system stripe */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 z-20 pointer-events-none"
          aria-hidden
          style={{
            background:
              "linear-gradient(to bottom, transparent, #ff8c00 20%, #ccff00 50%, #ff8c00 80%, transparent)",
          }}
        />

        {/* Top system bar */}
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-8 md:px-12 py-5 border-b border-white/[0.08] bg-gradient-to-r from-[#ff8c00]/[0.06] via-transparent to-[#ccff00]/[0.04]">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono font-bold text-white/30 tracking-[0.2em]">
              SYS·01
            </span>
            <span className="h-4 w-px bg-white/10" aria-hidden />
            <span className="text-sm md:text-base font-semibold text-white tracking-tight">
              Apple Juice Terminal System
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {METRICS.map((m) => (
              <div
                key={m.label}
                className="flex items-baseline gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08]"
              >
                <span className="text-sm font-black text-[#ccff00] font-mono">{m.value}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1.08fr]">
          {/* Doctrine column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="px-8 md:px-12 lg:px-14 py-12 md:py-16 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-white/[0.08]"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500 mb-4 font-mono">
              Core protocols
            </p>
            <div className="flex flex-wrap gap-2 mb-10">
              {PROTOCOLS.map((cmd) => (
                <span
                  key={cmd}
                  className="px-3 py-1.5 rounded-md bg-[#ff8c00]/[0.08] border border-[#ff8c00]/20 text-[11px] font-mono text-[#ffb347] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  {cmd}
                </span>
              ))}
            </div>

            <div className="space-y-5 mb-12">
              {PILLARS.map((p, i) => {
                const lit = activePillar === i;
                return (
                <motion.div
                  key={p.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.45 }}
                  animate={{
                    opacity: activePillar === null ? 1 : lit ? 1 : 0.42,
                    scale: lit ? 1.01 : 1,
                  }}
                  className={`group rounded-xl border p-4 transition-all duration-500 ${
                    lit
                      ? "border-[#ffb347]/40 bg-[#ff8c00]/[0.08] shadow-[0_0_32px_rgba(255,140,0,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`h-9 w-9 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                        lit
                          ? "bg-gradient-to-br from-[#ff8c00]/30 to-[#ccff00]/20 border-[#ffb347]/30 shadow-[0_0_16px_rgba(255,179,71,0.2)]"
                          : "bg-gradient-to-br from-[#ff8c00]/15 to-[#ccff00]/10 border-white/10"
                      }`}
                    >
                      <p.icon className={`w-4 h-4 transition-colors duration-500 ${lit ? "text-[#ffb347]" : "text-[#ffb347]/70"}`} strokeWidth={2} />
                    </div>
                    <div>
                      <p className={`text-[10px] font-mono uppercase tracking-wider mb-1 transition-colors duration-500 ${lit ? "text-[#ffb347]" : "text-zinc-500"}`}>
                        {p.label}
                      </p>
                      <p className="text-sm font-semibold text-white mb-1">{p.title}</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">{p.body}</p>
                    </div>
                  </div>
                </motion.div>
              );
              })}
            </div>

            <button
              onClick={onCta}
              className="group h-12 px-9 rounded-full bg-gradient-to-r from-[#ff8c00] via-[#ffb347] to-[#ccff00] text-black text-[11px] font-black uppercase tracking-[0.16em] hover:brightness-110 shadow-[0_0_40px_rgba(255,140,0,0.25),0_16px_40px_rgba(0,0,0,0.4)] transition-all duration-300 flex items-center gap-2.5 w-fit"
            >
              Enter the terminal layer
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <p className="mt-4 text-[11px] text-zinc-600 font-mono uppercase tracking-wider">
              Early access · Windows terminal
            </p>
          </motion.div>

          {/* Live system console */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="relative p-6 md:p-10 lg:p-12 flex flex-col items-center justify-center bg-gradient-to-br from-black/40 via-[#0a0a0c] to-[#ff8c00]/[0.05]"
          >
            <div className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#92ff92] opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#92ff92]" />
              </span>
              <span className="text-[10px] font-mono text-[#92ff92]/90 uppercase tracking-[0.18em]">
                System online
              </span>
            </div>

            <p className="absolute top-6 right-6 md:top-8 md:right-8 text-[10px] font-mono text-zinc-600 uppercase tracking-widest hidden sm:block">
              Live console
            </p>

            <div className="relative w-full max-w-[560px] mt-8 md:mt-0">
              <div
                className="absolute -inset-6 rounded-[2.5rem] opacity-60 blur-3xl pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, rgba(255,140,0,0.15), rgba(204,255,0,0.05), transparent 70%)",
                }}
              />
              <LandingCliShowcase className="relative w-full" onPillarActive={setActivePillar} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
