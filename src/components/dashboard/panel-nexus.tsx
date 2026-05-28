
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Cpu,
  Zap,
  Shield,
  Settings,
  EyeOff,
  Eye,
  Copy,
  Trash2,
  Activity,
  History,
} from "lucide-react";
import { useDashboard } from "./dashboard-context";

export function NexusTab() {
  const {
    globalConfigs,
    setGlobalConfigs,
    newConfig,
    setNewConfig,
    showConfigValues,
    setShowConfigValues,
    isAddingConfig,
    setIsAddingConfig,
    showToast,
  } = useDashboard();

  return (
    <div className="flex-1 w-full h-full flex flex-col p-8 md:p-12 overflow-hidden">
      <div className="flex items-end justify-between mb-12 text-left">
        <div>
          <div className="flex items-center gap-3 text-violet-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">
            <div className="w-8 h-[1px] bg-violet-400/40" />
            Environment Core
          </div>
          <h2 className="text-5xl font-black text-white uppercase tracking-tighter italic leading-none">
            Juice <span className="text-white/20">Core</span>
          </h2>
        </div>
        <button
          onClick={() => setIsAddingConfig(!isAddingConfig)}
          className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-[0_15px_30px_rgba(139,92,246,0.3)] active:scale-95 flex items-center gap-3 ${
            isAddingConfig
              ? "bg-white/10 text-white"
              : "bg-violet-600 text-white hover:bg-violet-500"
          }`}
        >
          {isAddingConfig ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAddingConfig ? "Cancel" : "New Directive"}
        </button>
      </div>

      <AnimatePresence>
        {isAddingConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: 32 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-violet-600/5 border border-violet-600/20 rounded-[2rem] p-8 flex flex-col md:flex-row items-end gap-6 shadow-xl">
              <div className="flex-1 space-y-2 text-left">
                <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest ml-1">
                  Key Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. API_ENDPOINT or Global Rules"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-sm font-bold text-white focus:outline-none focus:border-violet-500/50 transition-all"
                  value={newConfig.key}
                  onChange={(e) =>
                    setNewConfig({ ...newConfig, key: e.target.value })
                  }
                />
              </div>
              <div className="flex-1 space-y-2 text-left">
                <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest ml-1">
                  Type
                </label>
                <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
                  {(["directive", "config", "secret"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        setNewConfig({ ...newConfig, category: cat })
                      }
                      className={`flex-1 py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        newConfig.category === cat
                          ? "bg-violet-600 text-white shadow-lg"
                          : "text-white/20 hover:text-white/40"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-[2] space-y-2 text-left">
                <label className="text-[10px] font-black text-violet-400 uppercase tracking-widest ml-1">
                  Definition / Value
                </label>
                <input
                  type={newConfig.category === "secret" ? "password" : "text"}
                  placeholder={
                    newConfig.category === "directive"
                      ? "Always use strict typing..."
                      : "Value..."
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-sm font-bold text-white focus:outline-none focus:border-violet-500/50 transition-all"
                  value={newConfig.value}
                  onChange={(e) =>
                    setNewConfig({ ...newConfig, value: e.target.value })
                  }
                />
              </div>
              <button
                onClick={() => {
                  if (newConfig.key && newConfig.value) {
                    setGlobalConfigs([
                      {
                        id: Date.now().toString(),
                        key: newConfig.key,
                        value: newConfig.value,
                        category: newConfig.category,
                        createdAt: Date.now(),
                      },
                      ...globalConfigs,
                    ]);
                    setNewConfig({ key: "", value: "", category: "config" });
                    setIsAddingConfig(false);
                    showToast("Core sync updated", "success");
                  }
                }}
                className="px-10 py-4 rounded-xl bg-violet-600 text-white font-black text-xs uppercase tracking-widest hover:bg-violet-500 transition-all shadow-lg active:scale-95"
              >
                Deploy
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex-1 overflow-hidden">
        <div className="md:col-span-2 flex flex-col min-h-0">
          <div className="glossy-card-dark raycast-shine-dark rounded-[2.5rem] flex-1 flex flex-col overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Cpu className="w-4 h-4 text-violet-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-[0.3em]">
                  Core Directives & Configs
                </h3>
              </div>
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                {globalConfigs.length} Sync Nodes
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              {globalConfigs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                  <Cpu className="w-16 h-16 text-white mb-6" />
                  <p className="text-sm font-bold uppercase tracking-widest italic">
                    Core offline
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {globalConfigs.map((config) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={config.id}
                        className="group flex items-center gap-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-violet-500/30 transition-all duration-500"
                      >
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            config.category === "directive"
                              ? "bg-amber-500/10"
                              : config.category === "secret"
                              ? "bg-red-500/10"
                              : "bg-blue-500/10"
                          }`}
                        >
                          {config.category === "directive" ? (
                            <Zap className="w-5 h-5 text-amber-400" />
                          ) : config.category === "secret" ? (
                            <Shield className="w-5 h-5 text-red-400" />
                          ) : (
                            <Settings className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-3 mb-1">
                            <h4 className="text-sm font-black text-white uppercase tracking-widest truncate">
                              {config.key}
                            </h4>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest ${
                                config.category === "directive"
                                  ? "bg-amber-500/10 text-amber-500"
                                  : config.category === "secret"
                                  ? "bg-red-500/10 text-red-500"
                                  : "bg-blue-500/10 text-blue-500"
                              }`}
                            >
                              {config.category}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-white/40 truncate">
                            {config.category === "secret" &&
                            !showConfigValues.has(config.id)
                              ? "•"
                              : config.value}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {config.category === "secret" && (
                            <button
                              onClick={() => {
                                const next = new Set(showConfigValues);
                                if (next.has(config.id)) next.delete(config.id);
                                else next.add(config.id);
                                setShowConfigValues(next);
                              }}
                              className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-white transition-all"
                            >
                              {showConfigValues.has(config.id) ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(config.value);
                              showToast("Copied to clipboard", "success");
                            }}
                            className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-white transition-all"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setGlobalConfigs(
                                globalConfigs.filter((s) => s.id !== config.id)
                              )
                            }
                            className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-gradient-to-br from-violet-600 to-indigo-800 rounded-[2.5rem] p-8 text-white text-left relative overflow-hidden shadow-2xl">
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            <Activity className="w-10 h-10 mb-6 text-white/40" />
            <h3 className="text-xl font-black uppercase tracking-tighter italic mb-4 leading-none">
              Core Sync
            </h3>
            <p className="text-xs font-bold text-white/60 leading-relaxed mb-8 italic">
              Directives are automatically injected into the AI's semantic
              context during every generation request.
            </p>
            <div className="flex items-center gap-3 py-3 px-4 rounded-2xl bg-white/10 border border-white/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Context: Active
              </span>
            </div>
          </div>

          <div className="bg-[#1e2028] border border-white/5 rounded-[2.5rem] p-8 text-left shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <History className="w-5 h-5 text-violet-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">
                Deployment History
              </h3>
            </div>
            <div className="space-y-6">
              {[
                { action: "Directive Updated", time: "2m ago", user: "You" },
                { action: "Core Calibration", time: "45m ago", user: "System" },
                { action: "Semantic Leak Check", time: "2h ago", user: "You" },
              ].map((log, i) => (
                <div key={i} className="flex items-start justify-between group">
                  <div>
                    <p className="text-[11px] font-black text-white uppercase tracking-tight group-hover:text-violet-400 transition-colors">
                      {log.action}
                    </p>
                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest italic">
                      {log.user} • {log.time}
                    </p>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-violet-500 transition-colors mt-1.5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
