"use client";

/*
 * HeroPromptBox — prompt-first hero centerpiece.
 *
 * Inspired by the directness of competitor landing pages: a single, obvious
 * action. The visitor types (or taps a suggestion chip), hits Generate, and is
 * routed into the product. The typed prompt is stashed in localStorage
 * (`aj_pending_prompt`) so the dashboard can prefill the chat input after
 * sign-in — see the pickup effect in dashboard-client.tsx.
 *
 * Styling intentionally matches the existing landing system: lime accent
 * (#ccff00), glossy dark surfaces, rounded-full controls, framer-motion.
 */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const ROTATING_PLACEHOLDERS = [
  "Build me a tycoon with rebirths and a shop…",
  "Make an obby with checkpoints and a leaderboard…",
  "Create a zombie survival round system…",
  "Add a daily reward chest with a cooldown…",
  "Build a racing game with lap timers…",
  "Make a pet simulator with hatch eggs…",
];

const SUGGESTIONS = [
  "Tycoon game",
  "Obby with checkpoints",
  "Zombie survival",
  "Pet simulator",
  "Racing game",
  "Simulator shop",
];

const TYPE_SPEED = 38; // ms per character
const HOLD_MS = 1600; // pause once a placeholder is fully typed
const ERASE_SPEED = 18;

export function HeroPromptBox({
  signedIn,
  delay = 0.34,
}: {
  signedIn: boolean;
  delay?: number;
}) {
  const [value, setValue] = useState("");
  const [placeholder, setPlaceholder] = useState(ROTATING_PLACEHOLDERS[0]);
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Rotating typewriter placeholder (only while the field is empty/unfocused).
  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    let phraseIdx = 0;

    const run = async () => {
      while (!cancelled) {
        const phrase = ROTATING_PLACEHOLDERS[phraseIdx % ROTATING_PLACEHOLDERS.length];
        for (let i = 0; i <= phrase.length; i++) {
          if (cancelled) return;
          setPlaceholder(phrase.slice(0, i));
          await sleep(TYPE_SPEED);
        }
        await sleep(HOLD_MS);
        for (let i = phrase.length; i >= 0; i--) {
          if (cancelled) return;
          setPlaceholder(phrase.slice(0, i));
          await sleep(ERASE_SPEED);
        }
        phraseIdx++;
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [reduceMotion]);

  const go = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      try {
        if (trimmed) window.localStorage.setItem("aj_pending_prompt", trimmed);
      } catch {
        /* ignore quota */
      }
      window.location.href = signedIn ? "/dashboard" : "/login";
    },
    [signedIn],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        go(value);
      }
    },
    [go, value],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className="w-full max-w-[820px] mx-auto mt-12"
    >
      {/* Prompt surface — layered depth: soft outer radius, a radial edge-light
          ring bleeding from the top-left, a blurred top highlight line, and an
          inner surface with inset shadows. This is what gives it that premium,
          "lit glass" feel instead of a flat bordered box. */}
      <div className="group relative">
        {/* Outer glow that intensifies on focus */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-[48px] opacity-60 group-focus-within:opacity-100 blur-2xl transition-opacity duration-500"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, rgba(204,255,0,0.18), transparent 70%)",
          }}
        />

        {/* Outer frame */}
        <div
          className="relative rounded-[42px] p-[1.5px] transition-transform duration-300 group-focus-within:-translate-y-0.5"
          style={{
            background: "rgba(255,255,255,0.10)",
            boxShadow:
              "0 28px 70px -30px rgba(0,0,0,0.85), 0 10px 26px -14px rgba(0,0,0,0.6)",
          }}
        >
          {/* Edge-light ring — bright highlight bleeding from the top-left
              corner, masked to just the border. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[42px]"
            style={{
              padding: "1.5px",
              background:
                "radial-gradient(90% 75% at 0% 0%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.55) 9%, rgba(255,255,255,0.25) 24%, rgba(255,255,255,0.06) 46%, rgba(255,255,255,0) 75%)",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />

          {/* Inner surface */}
          <div
            className="relative rounded-[40.5px] backdrop-blur-xl backdrop-saturate-150 overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(28,32,40,0.72), rgba(16,18,24,0.82))",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -18px 40px -28px rgba(0,0,0,0.9)",
            }}
          >
            {/* Blurred top highlight line */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-[24px] top-0 h-[1.5px] rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 30%, rgba(204,255,0,0.45) 50%, rgba(255,255,255,0.22) 70%, transparent 100%)",
                filter: "blur(0.5px)",
              }}
            />

            <div className="relative flex flex-col gap-4 px-7 pt-7 pb-5 sm:px-9 sm:pt-9 sm:pb-7">
              <textarea
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                rows={3}
                placeholder={value ? "" : `${placeholder}\u2502`}
                aria-label="Describe the game you want to build"
                className="w-full resize-none bg-transparent text-lg sm:text-2xl text-white placeholder:text-white/35 outline-none leading-relaxed font-medium tracking-[-0.01em]"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold text-white/30 font-mono">
                  <Sparkles className="h-3.5 w-3.5 text-[#ccff00]/70" />
                  Press Enter to generate
                </span>
                <button
                  type="button"
                  onClick={() => go(value)}
                  className="ml-auto h-12 px-8 rounded-2xl bg-[#ccff00] text-black font-black uppercase tracking-wider text-xs inline-flex items-center justify-center gap-2 hover:bg-[#d4ff33] shadow-[0_8px_24px_-8px_rgba(204,255,0,0.55),inset_0_1px_0_rgba(255,255,255,0.4)] hover:scale-[1.03] active:translate-y-px transition-all duration-300"
                >
                  Generate
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go(`Build me a ${s.toLowerCase()}.`)}
            className="px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/55 text-[13px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-[#ccff00]/[0.08] hover:text-white hover:border-[#ccff00]/30 transition-all duration-200"
          >
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
