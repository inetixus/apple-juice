"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Eye, Cpu, Brain, Zap, Check } from "lucide-react";

export type ThinkingStep = {
  icon: "thinking" | "looking" | "generating" | "reasoning" | "optimizing";
  label: string;
  done: boolean;
};

const stepIcons = {
  thinking: Sparkles,
  looking: Eye,
  generating: Cpu,
  reasoning: Brain,
  optimizing: Zap,
};

export function ThinkingFeed({
  steps,
  isDeepSeek,
}: {
  steps: ThinkingStep[];
  isDeepSeek?: boolean;
}) {
  if (steps.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 py-3 relative pl-4 select-none">
      {/* Dynamic Animated Timeline vertical connector line */}
      <div className="absolute left-[7px] top-4 bottom-4 w-[1.5px] bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div
          className={`w-full h-full bg-gradient-to-b ${
            isDeepSeek ? "from-blue-500 to-indigo-500" : "from-[#ccff00] to-emerald-500"
          }`}
          initial={{ y: "-100%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      </div>

      {isDeepSeek && (
        <div className="flex items-center gap-2 mb-2 -ml-4">
          <div className="h-px w-4 bg-blue-500/20" />
          <span className="text-[9px] font-black text-blue-400/60 uppercase tracking-[0.25em]">
            DeepSeek Chain of Thought
          </span>
          <div className="h-px flex-1 bg-blue-500/20" />
        </div>
      )}

      <AnimatePresence initial={false}>
        {steps.map((step, i) => {
          const Icon = stepIcons[step.icon];
          const isCurrent = !step.done && (i === steps.length - 1 || steps[i + 1]?.done);
          const accentColor = isDeepSeek ? "text-blue-400" : "text-[#ccff00]";
          const accentBg = isDeepSeek ? "bg-blue-500/10" : "bg-[#ccff00]/10";
          const glowColor = isDeepSeek ? "shadow-[0_0_12px_rgba(59,130,246,0.4)]" : "shadow-[0_0_12px_rgba(204,255,0,0.4)]";

          return (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, x: -12, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="flex items-start gap-4 text-xs relative group"
            >
              {/* Timeline Bullet Node with Spring Animations */}
              <div className="relative z-10 flex items-center justify-center mt-0.5">
                <motion.div
                  layout
                  className={`w-[18px] h-[18px] rounded-full flex items-center justify-center border transition-all ${
                    step.done
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : isCurrent
                      ? `${accentBg} border-[#ccff00]/30 ${accentColor} ${glowColor}`
                      : "bg-white/[0.02] border-white/5 text-white/20"
                  }`}
                  animate={step.done ? { scale: [1, 1.25, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {step.done ? (
                    <Check className="h-2.5 w-2.5 flex-shrink-0 stroke-[3]" />
                  ) : (
                    <motion.div
                      animate={isCurrent ? { rotate: 360 } : {}}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="flex items-center justify-center"
                    >
                      <Icon className="h-2.5 w-2.5 flex-shrink-0" />
                    </motion.div>
                  )}
                </motion.div>

                {/* Pulse ring for active step */}
                {isCurrent && (
                  <span className={`absolute -inset-1 rounded-full border border-dashed animate-spin ${
                    isDeepSeek ? "border-blue-500/30" : "border-[#ccff00]/30"
                  }`} style={{ animationDuration: '6s' }} />
                )}
              </div>

              {/* Text details */}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5 mt-0.5">
                <motion.span
                  layout
                  className={`font-semibold transition-colors truncate tracking-wide ${
                    step.done
                      ? "text-white/30 line-through"
                      : isCurrent
                      ? "text-white font-bold"
                      : "text-white/50"
                  }`}
                >
                  {step.label}
                </motion.span>

                {/* Subtext description / shimmer progress bar for the active step */}
                {isCurrent && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    className="h-[1.5px] rounded-full overflow-hidden bg-white/5 mt-1 max-w-[150px]"
                  >
                    <motion.div
                      className={`h-full bg-gradient-to-r ${
                        isDeepSeek ? "from-blue-500 to-indigo-500" : "from-[#ccff00] to-emerald-400"
                      }`}
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: "linear",
                      }}
                      style={{ width: "50%" }}
                    />
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
