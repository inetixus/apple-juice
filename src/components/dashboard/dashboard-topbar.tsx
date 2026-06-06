"use client";

import { Box, Sparkles, ShoppingCart, ChevronDown, Settings, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { useDashboard } from "./dashboard-context";

export function DashboardTopbar() {
  const {
    workspaceStyle,
    activeProjectId,
    projects,
    isPluginConnected,
    openFiles,
    setShowPricing,
    showStyleMenu,
    setShowStyleMenu,
    setWorkspaceStyle,
    showProfileMenu,
    setShowProfileMenu,
    username,
    avatarUrl,
    usage,
    setShowSettings,
    sessionKey,
  } = useDashboard();

  return (
    <div
      className={`${
        workspaceStyle === "ide" ? "h-11" : "h-16"
      } border-b border-white/[0.06] flex items-center justify-between px-8 bg-white/[0.02] backdrop-blur-xl z-[100]`}
    >
      <div className="flex items-center gap-4">
        {activeProjectId ? (
          <div className="flex items-center gap-2 text-white/40 text-[11px] font-black uppercase tracking-widest">
            <Box className="w-3.5 h-3.5" />
            <span>Projects</span>
            <span className="text-white/10">/</span>
            <span className="text-white">
              {projects.find((p) => p.id === activeProjectId)?.name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[#ccff00] text-[11px] font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Dashboard Hub</span>
          </div>
        )}
        {activeProjectId &&
          (isPluginConnected ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                Live Sync Active
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">
                Studio Disconnected
              </span>
              {sessionKey && (
                <span className="text-[9px] font-black text-white/50 uppercase tracking-widest ml-1 pl-2 border-l border-white/10 select-all cursor-text">
                  Key: {sessionKey}
                </span>
              )}
            </div>
          ))}
      </div>

      <div className="flex items-center gap-3">
        {workspaceStyle === "ide" && activeProjectId && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
              Tabs:
            </span>
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">
              {openFiles.length + 1}
            </span>
          </div>
        )}
        <button
          onClick={() => setShowPricing(true)}
          className="group relative flex items-center gap-2 px-5 py-2 rounded-xl bg-[#ccff00]/10 border border-[#ccff00]/20 hover:bg-[#ccff00] transition-all duration-500 overflow-hidden animate-shop-pulse"
        >
          <div className="absolute inset-0 bg-[#ccff00]/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <ShoppingCart className="w-3.5 h-3.5 text-[#ccff00] group-hover:text-black transition-colors z-10" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#ccff00] group-hover:text-black transition-colors z-10">
            Shop
          </span>
          <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:left-[100%] transition-all duration-1000" />
        </button>

        {/* Workspace Mode Switcher */}
        {activeProjectId && (
          <div className="relative group/mode">
            <button
              onClick={() => setShowStyleMenu(!showStyleMenu)}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/5 transition-all"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  workspaceStyle === "ide" ? "bg-[#ccff00] shadow-[0_0_8px_#ccff00]" : "bg-blue-400"
                }`}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Mode: {workspaceStyle === "ide" ? "IDE" : "Legacy"}
              </span>
              <ChevronDown
                className={`w-3 h-3 text-white/10 transition-transform ${
                  showStyleMenu ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {showStyleMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="absolute right-0 top-12 w-44 bg-[#14161a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[110]"
                >
                  <div className="px-3 py-2.5 border-b border-white/5 bg-black/20">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">
                      Workspace Style
                    </span>
                  </div>
                  {(["legacy", "ide"] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => {
                        setWorkspaceStyle(style);
                        setShowStyleMenu(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-3 ${
                        workspaceStyle === style
                          ? "bg-[#ccff00]/10 text-[#ccff00]"
                          : "text-white/40 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          style === "ide" ? "bg-[#ccff00]" : "bg-blue-400"
                        }`}
                      />
                      {style}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        <div className="w-px h-6 bg-white/5 mx-2" />
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu((p) => !p)}
            className="flex items-center gap-3 hover:bg-white/5 px-2 py-1.5 rounded-xl transition-all"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-white/5"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black uppercase">
                {username[0]}
              </div>
            )}
            <ChevronDown
              className={`w-3 h-3 text-white/20 transition-transform ${
                showProfileMenu ? "rotate-180" : ""
              }`}
            />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="absolute right-0 top-14 w-48 bg-[#1a1c22] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100]"
              >
                <div className="px-4 py-3 border-b border-white/5 bg-black/20">
                  <p className="text-[10px] font-black text-white truncate uppercase tracking-widest">
                    {username}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        usage.plan === "pure_ultra"
                          ? "bg-[#ccff00] text-black"
                          : "bg-white/5 text-white/40"
                      }`}
                    >
                      {usage.plan === "pure_ultra"
                        ? "Ultra"
                        : usage.plan === "fresh_pro"
                        ? "Pro"
                        : usage.plan === "partner"
                        ? "Partner"
                        : "Free"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowSettings(true);
                  }}
                  className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 uppercase tracking-widest"
                >
                  <Settings className="h-3.5 w-3.5" /> Settings
                </button>

                <button
                  onClick={() => void signOut({ callbackUrl: "/" })}
                  className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors flex items-center gap-2 border-t border-white/5 uppercase tracking-widest"
                >
                  <X className="h-3.5 w-3.5" /> Log Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
export default DashboardTopbar;
