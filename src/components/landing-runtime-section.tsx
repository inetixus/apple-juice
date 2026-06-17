"use client";

import { useEffect, useState } from "react";
import {
  Download,
  ShieldCheck,
  Zap,
  Gauge,
  Lock,
  FileCheck2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Reveal, RevealStagger, RevealItem } from "./reveal";
import {
  runtimeDownloadUrl,
  detectOS,
  isRuntimeAvailable,
  RUNTIME_VIRUSTOTAL_URL,
  RUNTIME_RELEASES_PAGE,
  type RuntimeOS,
} from "@/lib/runtime-client";

const OS_LABEL: Record<RuntimeOS, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

const FEATURES = [
  {
    icon: Gauge,
    color: "text-[#ccff00]",
    wrap: "bg-[#ccff00]/12 border-[#ccff00]/25",
    title: "400 KB. Really.",
    desc: "A single native binary — no installer, no Node, no dependencies. Smaller than most images. Download, double-click, done.",
  },
  {
    icon: Zap,
    color: "text-amber-300",
    wrap: "bg-amber-400/12 border-amber-400/25",
    title: "Native-speed AI",
    desc: "Runs the agent locally against Roblox Studio's official tools, so every edit and playtest round-trips on your machine instead of the cloud.",
  },
  {
    icon: Lock,
    color: "text-emerald-400",
    wrap: "bg-emerald-400/12 border-emerald-400/25",
    title: "Loopback-only",
    desc: "Binds strictly to 127.0.0.1 — never exposed to your network. A per-session pair code plus Origin and Host checks gate every request.",
  },
  {
    icon: FileCheck2,
    color: "text-blue-400",
    wrap: "bg-blue-400/12 border-blue-400/25",
    title: "Verified & open",
    desc: "Publicly scanned on VirusTotal and built from open source. Nothing hidden — inspect it, scan it, then run it.",
  },
];

/**
 * Landing section spotlighting the optional native Apple Juice Runtime.
 * Emphasis: tiny size + security/protection, with an OS-aware download CTA.
 */
export function LandingRuntimeSection() {
  const [os, setOs] = useState<RuntimeOS>("windows");

  useEffect(() => {
    setOs(detectOS());
  }, []);

  const available = isRuntimeAvailable(os);
  const downloadOS: RuntimeOS = available ? os : "windows";

  return (
    <section id="runtime" className="px-6 py-16 sm:py-24 md:py-32 relative">
      {/* Ambient glow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 w-[min(100%,1000px)] h-[520px] pointer-events-none -z-10 opacity-70"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(204,255,0,0.08), transparent 65%)",
        }}
      />

      <div className="max-w-[1200px] mx-auto relative z-10">
        <Reveal className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glossy-pill-dark border border-[#ccff00]/20 mb-5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#ccff00]" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
              Optional Turbo · Local Runtime
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            Native speed in a 400 KB app.
          </h2>
          <p className="text-white/60 text-base md:text-lg max-w-2xl mx-auto font-medium leading-relaxed">
            For the fastest experience, drop in the Apple Juice Runtime — a tiny,
            secure local app that links your browser straight to Roblox Studio.
            Built for size and protection. The cloud version works without it, so
            it&apos;s always optional.
          </p>
        </Reveal>

        <RevealStagger
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12"
          stagger={0.1}
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <RevealItem
                key={f.title}
                className="group hover-lift flex flex-col items-start bg-white/[0.04] border border-white/10 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] hover:border-white/20 hover:bg-white/[0.06] backdrop-blur-sm"
              >
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center mb-5 ${f.wrap}`}
                >
                  <Icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-base font-black text-white mb-2 tracking-tight uppercase">
                  {f.title}
                </h3>
                <p className="text-[13px] text-white/60 leading-relaxed font-medium">
                  {f.desc}
                </p>
              </RevealItem>
            );
          })}
        </RevealStagger>

        {/* CTA band */}
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#ccff00]/[0.06] to-white/[0.02] p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#ccff00]/10 rounded-full blur-[80px] opacity-40 pointer-events-none" />
            <div className="relative">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
                Get the Runtime
              </h3>
              <p className="text-sm text-white/55 font-medium max-w-md leading-relaxed">
                {available
                  ? `Tiny, native, and verified. Download for ${OS_LABEL[os]}, run it, and pair with a 6-digit code.`
                  : `The ${OS_LABEL[os]} build isn't out yet — Windows only for now. The cloud version works on every platform.`}
              </p>
            </div>

            <div className="relative flex flex-col sm:flex-row items-center gap-3 shrink-0">
              <a
                href={runtimeDownloadUrl(downloadOS)}
                className="h-12 px-7 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-[#d4ff33] shadow-[0_0_25px_rgba(204,255,0,0.35)] hover:scale-105 active:scale-95 transition-all duration-300 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                Download ({OS_LABEL[downloadOS]})
              </a>
              <a
                href="/connect"
                className="h-12 px-6 rounded-full border border-white/15 bg-white/[0.03] text-white/85 font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:bg-white/[0.08] hover:border-white/25 transition-all duration-300 whitespace-nowrap"
              >
                How it connects
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </Reveal>

        {/* Trust line */}
        <Reveal>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-medium text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70" /> No installer
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70" /> Loopback-only
            </span>
            <a
              href={RUNTIME_VIRUSTOTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#ccff00] hover:text-[#d4ff33] underline underline-offset-2"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> VirusTotal report
            </a>
            <a
              href={RUNTIME_RELEASES_PAGE}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-white"
            >
              All downloads
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default LandingRuntimeSection;
