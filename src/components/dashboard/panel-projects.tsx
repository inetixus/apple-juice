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
<<<<<<< HEAD
import { SlashCommandInput } from "@/components/slash-command";
=======
import { Textarea } from "@/components/ui/textarea";
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
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

  return (
    <div className="flex-1 w-full h-full relative flex flex-col items-center overflow-y-auto custom-scrollbar p-6 md:p-10 z-10 text-left">
      {/* Page Title Header */}
      <div className="w-full max-w-6xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-[#ccff00] text-[10px] font-black uppercase tracking-[0.4em] mb-2">
            <div className="w-8 h-[1px] bg-[#ccff00]/40" />
            Workspace Central
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter italic leading-none">
            Creator <span className="text-white/20">Lobby</span>
          </h2>
        </div>
        <button
          onClick={() => {
            const n = window.prompt("Game name:");
            if (n) void createNewProject(n);
          }}
          className="px-6 py-3 rounded-2xl bg-[#ccff00] text-black font-black text-xs uppercase tracking-widest hover:bg-[#d4ff33] hover:scale-105 active:scale-95 transition-all shadow-[0_10px_20px_rgba(204,255,0,0.2)] flex items-center gap-2 max-w-max"
        >
          <Plus className="w-4 h-4" /> New Game
        </button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 pb-12">
        {/* Left Side: 2 Columns for Prompt & Projects */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8 flex flex-col">
          {/* Bento Card 1: Interactive AI Prompt Box */}
          <div className="relative group p-6 rounded-[2.5rem] glossy-card-dark raycast-shine-dark text-left flex flex-col gap-4">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.01] to-transparent rounded-[2.5rem] pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#ccff00]" />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Generate Mechanic</h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-white/5 text-[9px] font-bold text-white/40 uppercase tracking-widest">
                Agentic AI Prompt
              </span>
            </div>

            <div className="relative w-full">
<<<<<<< HEAD
              <SlashCommandInput
                value={prompt}
                onChange={setPrompt}
                onSubmit={() => void submitPrompt()}
                placeholder={placeholderText || "Make shift-to-run with stamina bar UI..."}
                disabled={isGenerating || !isPluginConnected}
                className="w-full bg-transparent border-none text-base md:text-lg font-bold text-white placeholder:text-white/10 focus-visible:ring-0 resize-none min-h-[100px] md:min-h-[120px] p-0"
=======
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={placeholderText || "Make shift-to-run with stamina bar UI..."}
                className="w-full bg-transparent border-none text-base md:text-lg font-bold text-white placeholder:text-white/10 focus-visible:ring-0 resize-none min-h-[100px] md:min-h-[120px] p-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitPrompt();
                  }
                }}
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
              />
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors text-white/40 hover:text-white">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors text-white/40 hover:text-white">
                  <AtSign className="w-4 h-4" />
                </div>
              </div>
              <button
                onClick={() => void submitPrompt()}
                disabled={isGenerating || !isPluginConnected}
<<<<<<< HEAD
                className={`px-6 py-3 rounded-xl border font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${isPluginConnected
                    ? "bg-[#ccff00] text-black border-[#ccff00] hover:bg-[#d4ff33] shadow-[0_4px_12px_rgba(204,255,0,0.2)]"
                    : "text-white/10 bg-white/5 border-white/5 cursor-not-allowed"
                  }`}
=======
                className={`px-6 py-3 rounded-xl border font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                  isPluginConnected
                    ? "bg-[#ccff00] text-black border-[#ccff00] hover:bg-[#d4ff33] shadow-[0_4px_12px_rgba(204,255,0,0.2)]"
                    : "text-white/10 bg-white/5 border-white/5 cursor-not-allowed"
                }`}
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
              >
                <span>Inject Live</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bento Card 2: Active Projects Grid */}
          <div className="p-6 md:p-8 rounded-[2.5rem] glossy-card-dark raycast-shine-dark flex-1 text-left">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[#ccff00]" />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Active Games</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-white/5 text-[9px] font-black text-white/40 uppercase">
                {projects.filter((p) => p.status !== "archived").length} Active
              </span>
            </div>

            {projects.filter((p) => p.status !== "archived").length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
                <Box className="w-12 h-12 text-white mb-4" />
                <p className="text-sm font-bold uppercase tracking-wider">No Active Games</p>
                <p className="text-xs italic mt-1 text-white/50">Create a game to start pairing AI models.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects
                  .filter((p) => p.status !== "archived")
                  .map((p) => (
                    <div
                      key={p.id}
                      onClick={() => void switchProject(p)}
                      className="group relative p-5 rounded-3xl glossy-card-dark raycast-shine-dark hover:border-[#ccff00]/30 hover:bg-white/[0.03] transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[140px] shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                            <Box className="w-5 h-5 text-white/40 group-hover:text-[#ccff00]" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight truncate max-w-[130px] group-hover:text-white transition-colors">
                              {p.name}
                            </h4>
                            <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-0.5">
                              Last active: Just now
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
                            className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
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
                            className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
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

                      <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-4">
                        <div className="flex items-center gap-1.5">
                          <div
<<<<<<< HEAD
                            className={`w-1.5 h-1.5 rounded-full ${p.sessionKey ? "bg-emerald-500 animate-pulse" : "bg-white/10"
                              }`}
=======
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.sessionKey ? "bg-emerald-500 animate-pulse" : "bg-white/10"
                            }`}
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
                          />
                          <span className="text-[9px] font-black text-white/30 uppercase tracking-wider">
                            {p.sessionKey ? "Connected" : "Keyless mode"}
                          </span>
                        </div>
                        <span className="text-[9px] font-black text-[#ccff00] uppercase tracking-widest group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Enter Studio <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: 1 Column for Status/Usage & Quick Toolbox */}
        <div className="space-y-6 md:space-y-8">
          {/* Bento Card 3: Subscription & Usage Level */}
          <div className="p-6 md:p-8 rounded-[2.5rem] glossy-card-dark raycast-shine-dark text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#ccff00]/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex items-center gap-3 mb-6">
              <Crown className="w-5 h-5 text-amber-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Service Level</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/40 uppercase tracking-wider">Plan Status</span>
                <span className="px-2.5 py-0.5 rounded-md bg-[#ccff00]/10 text-[#ccff00] text-[9px] font-black uppercase tracking-widest border border-[#ccff00]/20">
                  {usage.plan === "pure_ultra" ? "Pure Ultra" : usage.plan === "fresh_pro" ? "Fresh Pro" : "Free"}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-white/40 uppercase tracking-widest">Juice Tank</span>
                  <span className="text-white/80 font-black">{((usage.remainingMl ?? 0) / 1000).toFixed(2)}L Left</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-[#ccff00] to-emerald-500 transition-all duration-1000"
                    style={{
                      width: `${Math.min(100, Math.max(0, (usage.remainingMl / (usage.totalMl || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-white/20 uppercase font-black tracking-widest pt-2">
                <Clock className="w-3.5 h-3.5" /> Refills in {refillTime || "0h 0m"}
              </div>

              <button
                onClick={() => setShowPricing(true)}
                className="w-full mt-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Manage Subscription
              </button>
            </div>
          </div>

          {/* Bento Card 4: Quick Action list */}
          <div className="p-6 md:p-8 rounded-[2.5rem] glossy-card-dark raycast-shine-dark text-left">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="w-4 h-4 text-[#ccff00]" />
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Quick Prompts</h3>
            </div>
            <div className="space-y-3">
              {[
                "Click to sprint + Stamina depletion UI",
                "Double jump logic + custom particle effect",
                "Smooth weapon recoil camera shake",
                "Save player gold data to Datastore",
              ].map((text, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(text)}
                  className="w-full text-left p-3.5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-[#ccff00]/30 hover:bg-white/[0.03] transition-all text-xs font-bold text-white/60 hover:text-white tracking-tight"
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
