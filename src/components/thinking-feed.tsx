"use client";
import { Sparkles, Eye, Cpu, Loader2, Check, Brain, Zap } from "lucide-react";

export type ThinkingStep = { icon: "thinking" | "looking" | "generating" | "reasoning" | "optimizing"; label: string; done: boolean; };

const stepIcons = { thinking: Sparkles, looking: Eye, generating: Cpu, reasoning: Brain, optimizing: Zap };

export function ThinkingFeed({ steps, isDeepSeek }: { steps: ThinkingStep[]; isDeepSeek?: boolean }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5 py-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {isDeepSeek && (
        <div className="flex items-center gap-2 mb-1">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          <span className="text-[9px] font-bold text-blue-400/60 uppercase tracking-widest">DeepSeek Chain of Thought</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        </div>
      )}
      {steps.map((step, i) => {
        const Icon = stepIcons[step.icon];
        const accentColor = isDeepSeek ? "text-blue-400" : "text-[#ccff00]";
        return (
          <div key={i} className={`flex items-center gap-3 text-sm ${!step.done ? "animate-in fade-in slide-in-from-left-2 duration-300" : ""}`} style={{ animationDelay: `${i * 100}ms` }}>
            {step.done ? (
              <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <Loader2 className={`h-4 w-4 ${accentColor} animate-spin flex-shrink-0`} />
            )}
            <Icon className={`h-4 w-4 flex-shrink-0 ${step.done ? "text-[#8a8f98]" : accentColor}`} />
            <span className={step.done ? "text-[#8a8f98]" : "text-white font-medium"}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
