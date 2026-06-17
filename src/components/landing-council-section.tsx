"use client";

import { Scale, Trophy, Sparkles, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { Reveal, RevealStagger, RevealItem } from "./reveal";

const COMPETITORS = [
  { model: "Claude Sonnet 4.6", score: 94, winner: true },
  { model: "GLM-5", score: 88, winner: false },
  { model: "MiniMax M2.5", score: 81, winner: false },
];

const POINTS = [
  {
    icon: Sparkles,
    title: "Many models, one prompt",
    desc: "Several frontier and open-weight models solve your request in parallel — not one guess, but a field of them.",
  },
  {
    icon: Scale,
    title: "A judge scores them",
    desc: "An impartial judge model grades every solution on correctness, efficiency, and robustness — then explains the verdict.",
  },
  {
    icon: Trophy,
    title: "The best code wins",
    desc: "You get the winning Luau, the scoreboard, and one-click Apply to Studio. MAX mode pits the top-tier models against each other.",
  },
];

/**
 * Landing section spotlighting the Code Council — the multi-model
 * judge-and-pick feature. Replaces the old nav button with a real section.
 */
export function LandingCouncilSection() {
  return (
    <section id="council" className="px-6 py-16 sm:py-24 md:py-32 relative">
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 w-[min(100%,1000px)] h-[520px] pointer-events-none -z-10 opacity-70"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.10), transparent 65%)",
        }}
      />

      <div className="max-w-[1200px] mx-auto relative z-10 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left: copy + points + CTA */}
        <div>
          <Reveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glossy-pill-dark border border-[#8b5cf6]/25 mb-5">
              <Scale className="h-3.5 w-3.5 text-[#c4b5fd]" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">
                Code Council
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4 leading-[1.05]">
              The AI that judges
              <br />
              <span className="text-[#c4b5fd]">the other AIs.</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg font-medium leading-relaxed max-w-xl mb-8">
              Don&apos;t settle for one model&apos;s first answer. The Council runs
              several models against your prompt at once, then a judge picks the
              strongest solution — and you ship that one.
            </p>
          </Reveal>

          <RevealStagger className="space-y-3 mb-8" stagger={0.1}>
            {POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <RevealItem
                  key={p.title}
                  className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-white/20 hover:bg-white/[0.05] transition-all"
                >
                  <div className="h-9 w-9 shrink-0 rounded-xl bg-[#8b5cf6]/15 border border-[#8b5cf6]/25 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-[#c4b5fd]" />
                  </div>
                  <div>
                    <div className="text-[13px] font-black text-white">{p.title}</div>
                    <div className="text-[12px] text-white/55 font-medium mt-0.5 leading-snug">
                      {p.desc}
                    </div>
                  </div>
                </RevealItem>
              );
            })}
          </RevealStagger>

          <Reveal>
            <a
              href="/council"
              className="inline-flex h-12 px-7 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] items-center justify-center gap-2 hover:bg-[#d4ff33] shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-105 active:scale-95 transition-all duration-300"
            >
              Convene the council
              <ArrowRight className="h-4 w-4" />
            </a>
          </Reveal>
        </div>

        {/* Right: stylized scoreboard mock */}
        <Reveal direction="left">
          <div className="relative rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#8b5cf6]/[0.08] to-white/[0.02] p-5 sm:p-6 shadow-[0_30px_70px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#8b5cf6]/15 rounded-full blur-[70px] opacity-50 pointer-events-none" />
            <div className="relative flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-[#c4b5fd]" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                Council verdict
              </span>
            </div>

            <div className="relative space-y-2.5">
              {COMPETITORS.map((c) => (
                <div
                  key={c.model}
                  className={`rounded-2xl border p-4 ${
                    c.winner
                      ? "border-[#ccff00]/40 bg-[#ccff00]/[0.06] shadow-[0_0_24px_rgba(204,255,0,0.12)]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-sm font-black text-white flex items-center gap-1.5">
                      {c.winner && <Trophy className="h-3.5 w-3.5 text-[#ccff00]" />}
                      {c.model}
                    </span>
                    <span
                      className={`text-lg font-black ${
                        c.winner ? "text-[#ccff00]" : "text-white/60"
                      }`}
                    >
                      {c.score}
                      <span className="text-[10px] text-white/30 font-bold">/100</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        c.winner ? "bg-[#ccff00]" : "bg-white/30"
                      }`}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/[0.05] px-4 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#ccff00] shrink-0" />
              <span className="text-[11px] font-medium text-white/65 leading-snug">
                Winning code applied straight to Studio.
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default LandingCouncilSection;
