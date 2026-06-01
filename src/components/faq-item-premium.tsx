"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { ThinkingFeed, type ThinkingStep } from "./thinking-feed";

const THINKING_STEPS: ThinkingStep[] = [
  { icon: "thinking", label: "Parsing your question…", done: false },
  { icon: "reasoning", label: "Cross-referencing docs…", done: false },
  { icon: "optimizing", label: "Composing answer…", done: false },
];

export function FaqItemPremium({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "typing" | "done">("idle");
  const [typedLen, setTypedLen] = useState(0);
  const [helpful, setHelpful] = useState<"up" | "down" | null>(null);
  const reduceMotion = useReducedMotion();
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setPhase("idle");
      setTypedLen(0);
      setHelpful(null);
      setThinkingSteps([]);
      return;
    }

    if (reduceMotion) {
      setPhase("done");
      setTypedLen(answer.length);
      return;
    }

    setPhase("thinking");
    setTypedLen(0);
    setThinkingSteps(THINKING_STEPS.map((s, i) => ({ ...s, done: false })));

    const timers: number[] = [];
    THINKING_STEPS.forEach((_, i) => {
      timers.push(
        window.setTimeout(() => {
          setThinkingSteps((prev) =>
            prev.map((s, j) => (j <= i ? { ...s, done: true } : s)),
          );
          if (i === THINKING_STEPS.length - 1) {
            window.setTimeout(() => setPhase("typing"), 320);
          }
        }, 380 + i * 420),
      );
    });

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [answer.length, isOpen, reduceMotion]);

  useEffect(() => {
    if (phase !== "typing") return;
    let i = 0;
    const iv = window.setInterval(() => {
      i += 2;
      setTypedLen(Math.min(i, answer.length));
      if (i >= answer.length) {
        window.clearInterval(iv);
        setPhase("done");
      }
    }, 16);
    return () => window.clearInterval(iv);
  }, [answer.length, phase]);

  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-6 text-left group"
      >
        <span className="text-base font-semibold text-white/90 group-hover:text-white transition-colors tracking-tight">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 ml-6"
        >
          <ChevronDown className="h-4 w-4 text-neutral-400 group-hover:text-neutral-300 transition-colors" />
        </motion.div>
      </button>

      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="pb-6 max-w-3xl">
          {phase === "thinking" && thinkingSteps.length > 0 && (
            <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <ThinkingFeed steps={thinkingSteps} />
            </div>
          )}

          {(phase === "typing" || phase === "done") && (
            <p className="text-sm leading-relaxed text-[#9ca3af] font-medium">
              {answer.slice(0, typedLen)}
              {phase === "typing" && (
                <span className="inline-block w-0.5 h-4 bg-[#ccff00]/70 ml-0.5 align-middle animate-pulse" />
              )}
            </p>
          )}

          <AnimatePresence>
            {phase === "done" && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-3"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Was this helpful?
                </span>
                <button
                  type="button"
                  onClick={() => setHelpful("up")}
                  className={`p-1.5 rounded-lg border transition-all ${
                    helpful === "up"
                      ? "border-[#ccff00]/40 bg-[#ccff00]/15 text-[#ccff00]"
                      : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                  }`}
                  aria-label="Yes, helpful"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setHelpful("down")}
                  className={`p-1.5 rounded-lg border transition-all ${
                    helpful === "down"
                      ? "border-white/25 bg-white/10 text-white/80"
                      : "border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                  }`}
                  aria-label="Not helpful"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
