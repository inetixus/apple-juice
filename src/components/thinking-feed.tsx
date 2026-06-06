"use client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Eye,
  Cpu,
  Brain,
  Zap,
  Check,
  FilePlus2,
  FileCode,
  Pencil,
  Trash2,
  FolderInput,
  PlayCircle,
  Loader2,
} from "lucide-react";

/**
 * Legacy step shape (kept for backward compatibility with older callers).
 */
export type ThinkingStep = {
  icon: "thinking" | "looking" | "generating" | "reasoning" | "optimizing";
  label: string;
  done: boolean;
};

/**
 * Richer activity step — what the agent is actually doing, with optional
 * detail (e.g. the destination path).
 */
export type ActivityStep = {
  kind:
    | "thinking"
    | "reading"
    | "writing"
    | "creating"
    | "editing"
    | "deleting"
    | "moving"
    | "playtesting"
    | "done";
  label: string;
  detail?: string;
  done: boolean;
};

const legacyIcons = {
  thinking: Sparkles,
  looking: Eye,
  generating: Cpu,
  reasoning: Brain,
  optimizing: Zap,
};

const activityIcons = {
  thinking: Brain,
  reading: Eye,
  writing: FileCode,
  creating: FilePlus2,
  editing: Pencil,
  deleting: Trash2,
  moving: FolderInput,
  playtesting: PlayCircle,
  done: Check,
};

/** Per-kind accent so each tool type reads at a glance. */
const activityAccent: Record<ActivityStep["kind"], string> = {
  thinking: "text-violet-300",
  reading: "text-sky-300",
  writing: "text-[#ccff00]",
  creating: "text-emerald-300",
  editing: "text-amber-300",
  deleting: "text-rose-300",
  moving: "text-cyan-300",
  playtesting: "text-fuchsia-300",
  done: "text-emerald-300",
};

type AnyStep = ThinkingStep | ActivityStep;

function isActivityStep(s: AnyStep): s is ActivityStep {
  return "kind" in s;
}

function stepIcon(step: AnyStep) {
  return isActivityStep(step) ? activityIcons[step.kind] : legacyIcons[step.icon];
}

function stepAccent(step: AnyStep, isDeepSeek?: boolean) {
  if (isActivityStep(step)) return activityAccent[step.kind];
  return isDeepSeek ? "text-sky-300" : "text-[#ccff00]";
}

export function ThinkingFeed({
  steps,
  isDeepSeek,
}: {
  steps: AnyStep[];
  isDeepSeek?: boolean;
}) {
  if (steps.length === 0) return null;

  const activeIdx = steps.findIndex((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <div className="select-none">
      {/* Header row: compact status + progress count */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-2">
          <span
            className={`relative flex h-1.5 w-1.5 ${
              allDone ? "" : ""
            }`}
          >
            {!allDone && (
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                  isDeepSeek ? "bg-sky-400" : "bg-[#ccff00]"
                }`}
              />
            )}
            <span
              className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                allDone ? "bg-emerald-400" : isDeepSeek ? "bg-sky-400" : "bg-[#ccff00]"
              }`}
            />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            {allDone ? "Completed" : isDeepSeek ? "Reasoning" : "Working in Studio"}
          </span>
        </div>
        <span className="text-[10px] font-mono tabular-nums text-white/30">
          {doneCount}/{steps.length}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <AnimatePresence initial={false} mode="popLayout">
          {steps.map((step, i) => {
            const Icon = stepIcon(step);
            const isCurrent = i === activeIdx;
            const accent = stepAccent(step, isDeepSeek);
            const detail = isActivityStep(step) ? step.detail : undefined;

            return (
              <motion.div
                key={`${step.label}-${i}`}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
                  isCurrent
                    ? "bg-white/[0.05] ring-1 ring-inset ring-white/[0.07]"
                    : "bg-transparent"
                }`}
              >
                {/* Icon / status node */}
                <div className="relative flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {step.done ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[3]" />
                    </motion.div>
                  ) : isCurrent ? (
                    <Loader2 className={`h-3.5 w-3.5 animate-spin ${accent}`} />
                  ) : (
                    <Icon className="h-3.5 w-3.5 text-white/25" />
                  )}
                </div>

                {/* Tool-type icon chip (only meaningful for activity steps) */}
                {!step.done && isCurrent && (
                  <Icon className={`h-3 w-3 flex-shrink-0 ${accent}`} />
                )}

                {/* Label + detail */}
                <div className="flex items-baseline gap-2 min-w-0 flex-1">
                  <span
                    className={`text-[12px] leading-tight truncate transition-colors ${
                      step.done
                        ? "text-white/35"
                        : isCurrent
                        ? "text-white font-medium"
                        : "text-white/55"
                    }`}
                  >
                    {step.label}
                  </span>
                  {detail && (
                    <span className="text-[10px] font-mono text-white/25 truncate flex-shrink min-w-0">
                      {detail}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
