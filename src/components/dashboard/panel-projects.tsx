"use client";

import {
  Plus,
  Sparkles,
  LayoutGrid,
  Box,
  Archive,
  Trash2,
  ArrowRight,
  Crown,
  Clock,
  Zap,
  Image as ImageIcon,
  AtSign,
} from "lucide-react";
import { SlashCommandInput } from "@/components/slash-command";
import { useDashboard } from "./dashboard-context";

export function ProjectsTab() {
  const {
    activeTab,
    createNewProject,
    prompt,
    setPrompt,
    placeholderText,
    submitPrompt,
    isGenerating,
    isPluginConnected,
    isTester,
    projects,
    switchProject,
    renameProject,
    archiveProject,
    deleteProject,
    usage,
    refillTime,
    setShowPricing,
  } = useDashboard();

  if (activeTab !== "projects") return null;

  const activeProjects = projects.filter((p) => p.status !== "archived");
  const usagePct = Math.min(100, Math.max(0, (usage.remainingMl / (usage.totalMl || 1)) * 100));
  const promptReady = isTester || isPluginConnected;

  return (
    <div className="flex-1 w-full h-full relative flex flex-col items-center overflow-y-auto custom-scrollbar p-6 md:p-10 z-10 text-left">
      {/* Page Title Header */}
      <div className="w-full max-w-6xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-[#ccff00] text-[11px] font-bold tracking-wide mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Creator Lobby
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
            Welcome back
          </h2>
          <p className="text-sm text-white/45 mt-1.5 font-medium">
            Start a new game or jump back into one of your projects.
          </p>
        </div>
        <button
          onClick={() => {
            const n = window.prompt("Game name:");
            if (n) void createNewProject(n);
          }}
          className="px-5 py-3 rounded-xl bg-[#ccff00] text-black font-bold text-sm hover:bg-[#d4ff33] hover:scale-[1.02] active:scale-95 transition-all shadow-[0_8px_24px_rgba(204,255,0,0.25)] flex items-center gap-2 max-w-max"
        >
          <Plus className="w-4 h-4" /> New Game
        </button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
        {/* Left Side: Prompt & Projects */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          {/* Card 1: AI Prompt Box */}
          <div className="relative p-6 rounded-3xl bg-white/[0.04] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.25)] text-left flex flex-col gap-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#ccff00]" />
                <h3 className="text-sm font-bold text-white tracking-tight">Generate a mechanic</h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-[10px] font-semibold text-white/50">
                Agentic AI
              </span>
            </div>

            <div className="relative w-full">
              <SlashCommandInput
                value={prompt}
                onChange={setPrompt}
                onSubmit={() => void submitPrompt()}
                placeholder={placeholderText || "Make shift-to-run with a stamina bar UI..."}
                disabled={isGenerating || !promptReady}
                className="w-full bg-transparent border-none text-base md:text-lg font-medium text-white placeholder:text-white/25 focus-visible:ring-0 resize-none min-h-[96px] md:min-h-[112px] p-0"
              />
            </div>

            <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
              <div className="flex items-center gap-2">
                <button className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors text-white/45 hover:text-white">
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors text-white/45 hover:text-white">
                  <AtSign className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => void submitPrompt()}
                disabled={isGenerating || !promptReady}
                className={`px-5 py-2.5 rounded-xl border font-bold text-sm transition-all flex items-center gap-2 ${
                  promptReady
                    ? "bg-[#ccff00] text-black border-[#ccff00] hover:bg-[#d4ff33] shadow-[0_4px_14px_rgba(204,255,0,0.25)]"
                    : "text-white/25 bg-white/[0.04] border-white/[0.06] cursor-not-allowed"
                }`}
              >
                <span>Inject Live</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card 2: Active Projects */}
          <div className="p-6 rounded-3xl bg-white/[0.04] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.25)] flex-1 text-left backdrop-blur-sm">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#ccff00]" />
                <h3 className="text-sm font-bold text-white tracking-tight">Your games</h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] text-[10px] font-semibold text-white/50">
                {activeProjects.length} active
              </span>
            </div>

            {activeProjects.length === 0 ? (
              <div className="py-14 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                  <Box className="w-7 h-7 text-white/30" />
                </div>
                <p className="text-sm font-semibold text-white/70">No games yet</p>
                <p className="text-xs mt-1 text-white/40">Create one to start pairing AI models.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => void switchProject(p)}
                    className="group relative p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-[#ccff00]/35 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[130px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                          <Box className="w-5 h-5 text-white/50 group-hover:text-[#ccff00] transition-colors" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white tracking-tight truncate max-w-[130px]">
                            {p.name}
                          </h4>
                          <p className="text-[10px] text-white/35 font-medium mt-0.5">
                            Last active: just now
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const n = window.prompt("Rename game:", p.name);
                            if (n) void renameProject(p.id, n);
                          }}
                          className="p-2 rounded-lg bg-white/[0.06] text-white/45 hover:text-white hover:bg-white/10 transition-colors"
                          title="Rename"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void archiveProject(p.id, true);
                          }}
                          className="p-2 rounded-lg bg-white/[0.06] text-white/45 hover:text-white hover:bg-white/10 transition-colors"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteProject(p.id);
                          }}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:text-white hover:bg-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 mt-4">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            p.sessionKey ? "bg-emerald-500 animate-pulse" : "bg-white/15"
                          }`}
                        />
                        <span className="text-[10px] font-semibold text-white/40">
                          {p.sessionKey ? "Connected" : "Keyless mode"}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[#ccff00] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Enter Studio <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Status/Usage & Quick Prompts */}
        <div className="space-y-6">
          {/* Card 3: Subscription & Usage */}
          <div className="p-6 rounded-3xl bg-white/[0.04] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.25)] text-left relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#ccff00]/12 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex items-center gap-2.5 mb-5">
              <Crown className="w-4.5 h-4.5 text-amber-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">Service level</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/50">Plan</span>
                <span className="px-2.5 py-1 rounded-lg bg-[#ccff00]/12 text-[#ccff00] text-[10px] font-bold border border-[#ccff00]/25">
                  {usage.plan === "pure_ultra" ? "Pure Ultra" : usage.plan === "fresh_pro" ? "Fresh Pro" : usage.plan === "partner" ? "Partner" : "Free"}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-white/50">Juice tank</span>
                  <span className="text-white/85 font-bold">{((usage.remainingMl ?? 0) / 1000).toFixed(2)}L left</span>
                </div>
                <div className="h-2.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#ccff00] to-emerald-500 transition-all duration-1000 rounded-full"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-medium pt-1">
                <Clock className="w-3.5 h-3.5" /> Refills in {refillTime || "0h 0m"}
              </div>

              <button
                onClick={() => setShowPricing(true)}
                className="w-full mt-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/55 hover:text-white hover:bg-white/[0.08] text-xs font-semibold transition-all"
              >
                Manage subscription
              </button>
            </div>
          </div>

          {/* Card 4: Quick Prompts */}
          <div className="p-6 rounded-3xl bg-white/[0.04] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.25)] text-left backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-[#ccff00]" />
              <h3 className="text-sm font-bold text-white tracking-tight">Quick prompts</h3>
            </div>
            <div className="space-y-2.5">
              {[
                "Click to sprint + stamina depletion UI",
                "Double jump logic + custom particle effect",
                "Smooth weapon recoil camera shake",
                "Save player gold data to DataStore",
              ].map((text, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(text)}
                  className="w-full text-left p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#ccff00]/30 hover:bg-white/[0.05] transition-all text-xs font-medium text-white/65 hover:text-white"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default ProjectsTab;
