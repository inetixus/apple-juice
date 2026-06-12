"use client";

import { motion } from "framer-motion";
import { useRef, type ReactNode } from "react";
import {
  Check,
  CornerDownLeft,
  FileCode,
  Search,
} from "lucide-react";
import { Reveal, RevealStagger, RevealItem } from "./reveal";
import { AppleJuiceLogo } from "./apple-juice-logo";
import { BentoTwirl } from "./bento-twirl";

/* ─────────────────────────────────────────────────────────────
   Stripe-style BENTO grid — a faithful re-creation of Stripe's
   "Flexible solutions for every business model" section.

   Each card is a light surface with a warm gradient wash bleeding
   from a corner, a title top-left, a corner expand-arrow, a
   mouse-following border glow, and a subtle lift/shift toward the
   cursor. The mini-UIs are clean, detailed product mockups.
   ───────────────────────────────────────────────────────────── */

const CARD_SHADOW =
  "0 1px 1px rgba(10,37,64,0.04), 0 8px 24px rgba(10,37,64,0.10), 0 24px 56px rgba(10,37,64,0.08)";
const EASE = [0.16, 1, 0.3, 1] as const;

/* ── The card shell with Stripe's exact interaction model ───── */
function BentoCard({
  title,
  gradient,
  wave,
  className = "",
  children,
}: {
  title: ReactNode;
  gradient: string;
  wave: { position: string; scale: number; hueRotate?: number };
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // mouse position for the border glow
    el.style.setProperty("--card-mouse-x", `${x}px`);
    el.style.setProperty("--card-mouse-y", `${y}px`);
    // subtle shift toward the cursor (Stripe nudges the card a few px)
    const relX = (x / rect.width - 0.5) * 2; // -1 .. 1
    const relY = (y / rect.height - 0.5) * 2;
    el.style.setProperty("--card-shift-x", `${relX * 4}px`);
    el.style.setProperty("--card-shift-y", `${relY * 4}px`);
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--card-shift-x", "0px");
    el.style.setProperty("--card-shift-y", "0px");
  };

  return (
    <RevealItem className={className}>
      <div
        ref={ref}
        className="sb-card h-full"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div className="sb-card__wash" aria-hidden style={{ background: gradient }} />
        <div className="sb-card__twirl" aria-hidden>
          <BentoTwirl position={wave.position} scale={wave.scale} hueRotate={wave.hueRotate} />
        </div>
        <div className="sb-card__hairline" aria-hidden />
        <div className="sb-card__border" aria-hidden />
        <div className="sb-card__inner">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h3 className="sb-card__title">{title}</h3>
            <span className="sb-card__expand" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.75 6.75L10.25 6.75L10.25 5L15.5 5L15.5 10.25L13.75 10.25L13.75 6.75Z" fill="currentColor" />
                <path d="M6.75 10.25L5 10.25L5 15.5L10.25 15.5L10.25 13.75L6.75 13.75L6.75 10.25Z" fill="currentColor" />
              </svg>
            </span>
          </div>
          <div className="sb-card__graphic">{children}</div>
        </div>
      </div>
    </RevealItem>
  );
}

/* ════════════════════════════════════════════════════════════
   AGENT CONVERSATION — prompt → reply with a real diff preview
   ════════════════════════════════════════════════════════════ */
function AgentMock() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[#e6ebf1] bg-white"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-center gap-2 border-b border-[#eef1f6] bg-[#fbfcfe] px-4 py-2.5">
        <AppleJuiceLogo className="h-4 w-4" />
        <span className="text-[11px] font-semibold text-[#0a2540]">MyObbyGame</span>
        <span className="text-[10px] text-[#b0b8c4]">/ Agent</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#f4fbdf] px-2 py-0.5 text-[9px] font-semibold text-[#5a8a00] ring-1 ring-[#d7e8a8]">
          <span className="h-1 w-1 rounded-full bg-[#9ec900]" /> Studio paired
        </span>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#0a2540] px-3 py-2 text-[11px] font-medium leading-relaxed text-white">
            Add a double-jump with a 0.4s cooldown
          </div>
        </div>

        <div className="flex gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#eef0ff]">
            <AppleJuiceLogo className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] leading-relaxed text-[#425466]">
              Done. Added a client controller and wired the cooldown into your state module.
            </p>

            <div className="mt-2.5 overflow-hidden rounded-xl border border-[#e6ebf1] bg-[#fbfcfe]">
              <div className="flex items-center gap-1.5 border-b border-[#eef1f6] px-3 py-1.5">
                <FileCode className="h-3 w-3 text-[#635bff]" />
                <span className="font-mono text-[10px] text-[#425466]">DoubleJump.client.lua</span>
                <span className="ml-auto font-mono text-[9px] font-semibold text-[#16a34a] tabular-nums">+14 −2</span>
              </div>
              <div className="px-3 py-2 font-mono text-[10px] leading-[1.6]">
                <div className="flex gap-3 text-[#9aa4b2]">
                  <span className="select-none tabular-nums">12</span>
                  <span><span className="text-[#9333ea]">local</span> jumps = 0</span>
                </div>
                <div className="-mx-3 flex gap-3 bg-[#e7f9ee] px-3 text-[#0a2540]">
                  <span className="select-none tabular-nums text-[#16a34a]">13</span>
                  <span>
                    <span className="text-[#16a34a]">+</span>{" "}
                    <span className="text-[#9333ea]">if</span> tick() - last &gt;{" "}
                    <span className="text-[#c2410c]">0.4</span>{" "}
                    <span className="text-[#9333ea]">then</span>
                  </span>
                </div>
                <div className="-mx-3 flex gap-3 bg-[#e7f9ee] px-3 text-[#0a2540]">
                  <span className="select-none tabular-nums text-[#16a34a]">14</span>
                  <span className="pl-3">hum:<span className="text-[#2563eb]">ChangeState</span>(Jump)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[#eef1f6] px-4 py-2.5">
        <span className="flex-1 text-[11px] text-[#9aa4b2]">Ask Apple Juice to change something…</span>
        <span className="flex h-6 items-center gap-1 rounded-md bg-[#eef1f6] px-2 text-[9px] font-medium text-[#697386]">
          <CornerDownLeft className="h-3 w-3" /> Send
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   JUICE USAGE — Pro-plan card + animated bar chart (mirrors
   Stripe's "Enable any billing model" graphic)
   ════════════════════════════════════════════════════════════ */
function UsageMock() {
  const bars = [
    4.7, 8, 15.4, 22.1, 31.5, 45, 24.8, 28.9, 12.8, 8, 33.6, 28.9, 40.9, 52.3,
    42.3, 75.8, 100, 53, 40.3, 26.8, 33.6, 36.9, 32.2, 47.7, 59.1, 63.8, 74.5,
    57, 45, 40.9, 52.3,
  ];
  return (
    <div className="space-y-3">
      <div
        className="rounded-2xl border border-[#e6ebf1] bg-white p-3.5"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef0ff]">
            <AppleJuiceLogo className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-[#0a2540]">Pro Plan</p>
            <p className="text-[10px] text-[#8792a2]">Billed monthly</p>
          </div>
        </div>
        <div className="mt-3 border-t border-[#eef1f6] pt-2.5">
          <p className="text-[10px] font-semibold text-[#0a2540]">Juice credits</p>
          <p className="text-[10px] text-[#8792a2]">
            <span className="tabular-nums">$0.01</span> per <span className="tabular-nums">1,000</span> tokens
          </p>
        </div>
        <div className="mt-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#635bff] to-[#ccff00]" />
            <span className="text-[9px] font-medium text-[#697386]">Usage meter</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#eef1f6]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#635bff] via-[#a78bfa] to-[#ccff00]"
              initial={{ width: 0 }}
              whileInView={{ width: "78%" }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: EASE }}
            />
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl border border-[#e6ebf1] bg-white p-3.5"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <p className="text-[9px] font-medium text-[#8792a2]">
          Tokens used in the last <span className="tabular-nums">30</span> days
        </p>
        <p className="mt-0.5 text-[15px] font-semibold text-[#0a2540] tabular-nums">2,010,569,010</p>
        <div className="mt-3 flex h-14 items-end gap-[3px]">
          {bars.map((h, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-[1px] bg-gradient-to-t from-[#635bff] to-[#a78bfa]"
              initial={{ height: 0 }}
              whileInView={{ height: `${h}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.015, ease: EASE }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DIAGNOSTICS CONSOLE — timestamped log ending in a clean pass
   ════════════════════════════════════════════════════════════ */
function DiagnosticsMock() {
  const logs = [
    { t: "12:04:02", tag: "build", cls: "text-[#635bff]", msg: "Compiled 3 scripts" },
    { t: "12:04:03", tag: "lint", cls: "text-[#635bff]", msg: "0 warnings, 0 errors" },
    { t: "12:04:05", tag: "test", cls: "text-[#d97706]", msg: "Playtest started" },
    { t: "12:04:11", tag: "pass", cls: "text-[#16a34a]", msg: "All checks green" },
  ];
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[#e6ebf1] bg-white"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-center gap-2 border-b border-[#eef1f6] px-4 py-2.5">
        <span className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-[#ff5f56]" />
          <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
          <span className="h-2 w-2 rounded-full bg-[#27c93f]" />
        </span>
        <span className="ml-1 font-mono text-[10px] text-[#697386]">output — luau</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#e7f9ee] px-2 py-0.5 text-[9px] font-semibold text-[#1a7f43] ring-1 ring-[#bfe9cd]">
          <Check className="h-2.5 w-2.5" /> Passing
        </span>
      </div>
      <div className="space-y-1.5 px-4 py-3 font-mono text-[10px] leading-relaxed">
        {logs.map((l) => (
          <div key={l.t} className="flex items-center gap-2">
            <span className="text-[#b0b8c4] tabular-nums">{l.t}</span>
            <span className={`w-9 font-semibold ${l.cls}`}>{l.tag}</span>
            <span className="text-[#425466]">{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STUDIO SYNC — file artifact card (compact, for the globe-ish
   third column of row 2)
   ════════════════════════════════════════════════════════════ */
function SyncMock() {
  const files = [
    { name: "SprintController.client.lua", add: "+48" },
    { name: "Stamina.module.lua", add: "+31" },
    { name: "PlayerState.server.lua", add: "+12" },
  ];
  return (
    <div
      className="rounded-2xl border border-[#e6ebf1] bg-white p-4"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#16a34a] text-white">
          <Check className="h-3 w-3" />
        </span>
        <span className="text-[11px] font-semibold text-[#0a2540]">Synced to Studio</span>
        <span className="ml-auto text-[10px] font-medium text-[#8792a2] tabular-nums">3 files</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {files.map((f) => (
          <div
            key={f.name}
            className="flex items-center gap-2 rounded-lg bg-[#fbfcfe] px-2.5 py-1.5 ring-1 ring-[#eef1f6]"
          >
            <FileCode className="h-3 w-3 shrink-0 text-[#635bff]" />
            <span className="truncate font-mono text-[10px] text-[#425466]">{f.name}</span>
            <span className="ml-auto font-mono text-[10px] font-semibold text-[#16a34a] tabular-nums">{f.add}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   EXPERIENCES TABLE — dense dashboard (full-width row, mirrors
   Stripe's "Embed payments in your platform" connected accounts)
   ════════════════════════════════════════════════════════════ */
type Row = {
  name: string;
  grad: string;
  status: "live" | "review" | "draft";
  ccu: string;
  rev: string;
};
const ROWS: Row[] = [
  { name: "Tower Defense Sim", grad: "from-blue-500 to-violet-500", status: "live", ccu: "4,182", rev: "$2,940.18" },
  { name: "Pet Sim World", grad: "from-pink-500 to-orange-400", status: "live", ccu: "2,907", rev: "$1,655.40" },
  { name: "Racing League", grad: "from-cyan-400 to-blue-600", status: "review", ccu: "1,340", rev: "$874.02" },
  { name: "Horror Map v3", grad: "from-violet-500 to-fuchsia-500", status: "live", ccu: "988", rev: "$612.75" },
  { name: "Tycoon Factory", grad: "from-amber-400 to-red-500", status: "draft", ccu: "—", rev: "$0.00" },
];
const STATUS: Record<Row["status"], { label: string; cls: string; dot: string }> = {
  live: { label: "Live", cls: "bg-[#e7f9ee] text-[#1a7f43] ring-[#bfe9cd]", dot: "bg-[#16a34a]" },
  review: { label: "In review", cls: "bg-[#fff4e5] text-[#9a5b00] ring-[#f5d9ad]", dot: "bg-[#d97706]" },
  draft: { label: "Draft", cls: "bg-[#eef1f6] text-[#697386] ring-[#e0e5ee]", dot: "bg-[#9aa4b2]" },
};

function ExperiencesMock() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[#e6ebf1] bg-white"
      style={{ boxShadow: CARD_SHADOW }}
    >
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-[#eef1f6] bg-[#fbfcfe] px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#d7dee8]" />
          <span className="h-2 w-2 rounded-full bg-[#d7dee8]" />
          <span className="h-2 w-2 rounded-full bg-[#d7dee8]" />
        </span>
        <span className="ml-2 flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 ring-1 ring-[#eef1f6]">
          <Search className="h-2.5 w-2.5 text-[#9aa4b2]" />
          <span className="font-mono text-[10px] text-[#8792a2]">dashboard.applejuice.gg</span>
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#0a2540]">Your experiences</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#9aa4b2]">
          <span>Experience</span>
          <span className="w-16 text-right">Players</span>
          <span className="w-24 text-right">Revenue</span>
        </div>
        <div className="divide-y divide-[#f1f3f7]">
          {ROWS.map((r) => {
            const s = STATUS[r.status];
            return (
              <div
                key={r.name}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-2 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`h-6 w-6 shrink-0 rounded-md bg-gradient-to-br ${r.grad}`} />
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-[11px] font-medium text-[#0a2540]">{r.name}</p>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[8px] font-semibold ring-1 ${s.cls}`}>
                      <span className={`h-1 w-1 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                  </div>
                </div>
                <span className="w-16 text-right font-mono text-[11px] text-[#425466] tabular-nums">{r.ccu}</span>
                <span className="w-24 text-right font-mono text-[11px] font-semibold text-[#0a2540] tabular-nums">{r.rev}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LandingBentoSection() {
  return (
    <section className="relative px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[1140px]">
        <Reveal className="mb-12 max-w-2xl md:mb-16">
          <h2 className="text-3xl font-semibold leading-[1.12] tracking-[-0.02em] text-white md:text-[2.75rem]">
            Flexible tools for every kind of game.
            <span className="text-white/45"> Build with a complete set of AI and Studio tools, designed to work on their own or together.</span>
          </h2>
        </Reveal>

        <RevealStagger className="grid grid-cols-1 gap-5 md:grid-cols-3" stagger={0.09}>
          <BentoCard
            title="Describe a change, watch the agent ship it"
            gradient="radial-gradient(130% 120% at 0% 0%, #ffe7d6 0%, #ffd9e8 32%, #efe7ff 62%, #ffffff 100%)"
            wave={{ position: "12% 26%", scale: 2.4 }}
            className="md:col-span-2 md:row-span-2"
          >
            <AgentMock />
          </BentoCard>

          <BentoCard
            title="Track every drop of juice"
            gradient="radial-gradient(140% 130% at 100% 0%, #efe7ff 0%, #fbe7f4 45%, #ffffff 100%)"
            wave={{ position: "85% 40%", scale: 2.6, hueRotate: 35 }}
            className="md:row-span-2"
          >
            <UsageMock />
          </BentoCard>

          <BentoCard
            title="Synced straight into Studio"
            gradient="radial-gradient(140% 130% at 0% 100%, #e7f9ee 0%, #f2fbf6 45%, #ffffff 100%)"
            wave={{ position: "30% 80%", scale: 2.8, hueRotate: 80 }}
          >
            <SyncMock />
          </BentoCard>

          <BentoCard
            title="Diagnostics and playtests on autopilot"
            gradient="radial-gradient(150% 130% at 100% 100%, #fff1de 0%, #ffe7ea 45%, #ffffff 100%)"
            wave={{ position: "75% 75%", scale: 2.5, hueRotate: -15 }}
            className="md:col-span-2"
          >
            <DiagnosticsMock />
          </BentoCard>

          <BentoCard
            title="Every place you run, in one dashboard"
            gradient="radial-gradient(150% 130% at 50% 0%, #ffe7d6 0%, #f3e7ff 40%, #e7f0ff 70%, #ffffff 100%)"
            wave={{ position: "50% 20%", scale: 2.0, hueRotate: 20 }}
            className="md:col-span-3"
          >
            <ExperiencesMock />
          </BentoCard>
        </RevealStagger>
      </div>
    </section>
  );
}

export default LandingBentoSection;
