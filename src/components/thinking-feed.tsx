"use client";
import { Sparkles, Eye, Cpu, Loader2, Check } from "lucide-react";

export type ThinkingStep = { icon: "thinking" | "looking" | "generating"; label: string; done: boolean; };

const stepIcons = { thinking: Sparkles, looking: Eye, generating: Cpu };

export function ThinkingFeed({ steps }: { steps: ThinkingStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5 py-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {steps.map((step, i) => {
        const Icon = stepIcons[step.icon];
        return (
          <div key={i} className="flex items-center gap-3 text-sm">
            {step.done ? (
              <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 text-[#ccff00] animate-spin flex-shrink-0" />
            )}
            <Icon className={`h-4 w-4 flex-shrink-0 ${step.done ? "text-[#8a8f98]" : "text-[#ccff00]"}`} />
            <span className={step.done ? "text-[#8a8f98]" : "text-white font-medium"}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
