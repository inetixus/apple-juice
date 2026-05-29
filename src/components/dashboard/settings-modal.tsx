
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useDashboard } from "./dashboard-context";
import { Input } from "@/components/ui/input";

export function SettingsModal() {
  const {
    showSettings,
    setShowSettings,
    provider,
    setProvider,
    openaiKey,
    setOpenaiKey,
    googleKey,
    setGoogleKey,
    setApiKey,
    loadModels,
    isLoadingModels,
    selectedModel,
    setSelectedModel,
    availableModels,
    secretCode,
    setSecretCode,
    isRedeeming,
    autoRetry,
    setAutoRetry,
    autoPlaytest,
    setAutoPlaytest,
    usage,
    setUsage,
    showToast,

    saveApiKey,
    handleRedeemCode,
  } = useDashboard() as any;

  return (
    <AnimatePresence>
      {showSettings && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="h-full w-full max-w-xl bg-[#14161a] border-l border-white/[0.05] p-12 space-y-10 shadow-2xl overflow-y-auto custom-scrollbar"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  Settings
                </h2>
                <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] font-bold mt-1">
                  System Configuration
                </p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <label className="text-[12px] font-medium text-white/50 mb-2 block">
                Provider
              </label>
              <select
                id="provider-select"
                value={provider}
                onChange={(e) => {
                  const val = e.target.value as "openai" | "google";
                  const storedOpen =
                    window.localStorage.getItem("apple-juice-openai-key") ??
                    window.localStorage.getItem("apple-juice-api-key") ??
                    "";
                  const storedGoogle =
                    window.localStorage.getItem("apple-juice-google-key") ?? "";

                  setProvider(val);
                  setOpenaiKey(storedOpen);
                  setGoogleKey(storedGoogle);

                  const newKey = val == "google" ? storedGoogle : storedOpen;
                  setApiKey(newKey);
                  window.localStorage.setItem("apple-juice-provider", val);
                  void loadModels(newKey, undefined, val);
                }}
                className="w-full bg-black/20 border border-white/[0.1] text-white/80 text-[13px] py-2 px-3 rounded focus:outline-none focus:border-[#ccff00] transition-all cursor-pointer"
              >
                <option value="openai" className="bg-[#1a1c22] text-white">
                  OpenAI
                </option>
                <option value="google" className="bg-[#1a1c22] text-white">
                  Google AI Studio
                </option>
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-white/50 mb-2 block">
                Model{" "}
                {isLoadingModels && (
                  <span className="animate-pulse text-[10px] text-[#ccff00] ml-2">
                    (Refreshing...)
                  </span>
                )}
              </label>
              <select
                id="model-select"
                value={selectedModel}
                disabled={isLoadingModels}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  window.localStorage.setItem(
                    "apple-juice-model",
                    e.target.value
                  );
                }}
                className={`w-full bg-black/20 border border-white/[0.1] text-white/80 text-[13px] py-2 px-3 rounded focus:outline-none focus:border-[#ccff00] transition-all cursor-pointer ${
                  isLoadingModels ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {availableModels.map((m: string) => (
                  <option key={m} value={m} className="bg-[#1a1c22] text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="text-[12px] font-medium text-white/50 mb-2 block"
                htmlFor="api-key-input"
              >
                {provider === "google" ? "Google API Key" : "OpenAI API Key"}
              </label>
              <div className="relative group/key">
                <Input
                  id="api-key-input"
                  type="password"
                  value={provider === "google" ? googleKey : openaiKey}
                  onChange={(e) =>
                    provider === "google"
                      ? setGoogleKey(e.target.value)
                      : setOpenaiKey(e.target.value)
                  }
                  placeholder={provider === "google" ? "AIza..." : "sk-..."}
                  className="bg-black/20 border-white/[0.1] focus:border-[#ccff00] rounded text-[13px] pr-10"
                />
              </div>
              <p className="text-[10px] text-white/20 mt-2 italic">
                Your keys are stored locally in your browser.
              </p>
            </div>
            <button
              onClick={saveApiKey}
              className="w-full bg-[#ccff00] text-black font-bold py-2.5 rounded text-[13px] hover:bg-[#d4ff33] transition-all mt-2"
            >
              Save Configuration
            </button>

            <div className="mt-4 pt-4 border-t border-white/[0.1]">
              <label className="text-[12px] font-medium text-white/50 mb-2 block">
                Redeem Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  placeholder="Enter code..."
                  className="flex-1 bg-black/20 border border-white/[0.1] rounded px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#ccff00]/50 transition-all"
                />
                <button
                  onClick={handleRedeemCode}
                  disabled={isRedeeming || !secretCode.trim()}
                  className="bg-[#1e2028]/10 text-white px-4 py-2 rounded text-[13px] font-bold hover:bg-[#1e2028]/20 disabled:opacity-50 transition-all"
                >
                  {isRedeeming ? "..." : "Redeem"}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-dashed border-white/10 space-y-3">
              <label className="text-[10px] font-black text-[#ccff00] uppercase tracking-[0.2em] block mb-2 opacity-50">
                Admin Debug Tools (Persisted)
              </label>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[#1e2028]/[0.02] border border-white/[0.05]">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">
                    Auto-Retry on API Failure
                  </span>
                  <span className="text-xs text-white/50">
                    Automatically retry prompt if Claude/DeepSeek crashes
                  </span>
                </div>
                <div
                  className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${
                    autoRetry ? "bg-[#ccff00]" : "bg-[#1e2028]/20"
                  }`}
                  onClick={() => {
                    const next = !autoRetry;
                    setAutoRetry(next);
                    localStorage.setItem("aj_auto_retry", String(next));
                  }}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-[#1e2028] transition-transform ${
                      autoRetry ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[#1e2028]/[0.02] border border-white/[0.05]">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[#ccff00]">
                    Autonomous Mode
                  </span>
                  <span className="text-xs text-white/50">
                    Auto-sync code, auto-playtest, and auto-fix any bugs
                  </span>
                </div>
                <div
                  className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors ${
                    autoPlaytest ? "bg-[#ccff00]" : "bg-[#1e2028]/20"
                  }`}
                  onClick={() => {
                    const next = !autoPlaytest;
                    setAutoPlaytest(next);
                    localStorage.setItem("aj_auto_playtest", String(next));
                  }}
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-full bg-[#1e2028] transition-transform ${
                      autoPlaytest ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={async () => {
                    const data = {
                      plan: "free",
                      totalMl: 2000,
                      remainingMl: 2000,
                    };
                    setUsage((prev: any) => ({ ...prev, ...data }));
                    showToast("Plan set to FREE (2.0 Credits)", "success");
                    await fetch("/api/usage", {
                      method: "POST",
                      body: JSON.stringify(data),
                    });
                  }}
                  className="text-[9px] font-bold py-2 rounded-lg bg-[#1e2028]/5 hover:bg-[#1e2028]/10 border border-white/5 transition-all text-white/60"
                >
                  FREE
                </button>
                <button
                  onClick={async () => {
                    const data = {
                      plan: "fresh_pro",
                      totalMl: 10000,
                      remainingMl: 10000,
                    };
                    setUsage((prev: any) => ({ ...prev, ...data }));
                    showToast("Plan set to PRO (10.0 Credits)", "success");
                    await fetch("/api/usage", {
                      method: "POST",
                      body: JSON.stringify(data),
                    });
                  }}
                  className="text-[9px] font-bold py-2 rounded-lg bg-[#ccff00]/10 hover:bg-[#ccff00]/20 border border-[#ccff00]/20 transition-all text-[#ccff00]"
                >
                  PRO
                </button>
                <button
                  onClick={async () => {
                    const data = {
                      plan: "pure_ultra",
                      totalMl: 30000,
                      remainingMl: 30000,
                    };
                    setUsage((prev: any) => ({ ...prev, ...data }));
                    showToast("Plan set to ULTRA (30.0 Credits)", "success");
                    await fetch("/api/usage", {
                      method: "POST",
                      body: JSON.stringify(data),
                    });
                  }}
                  className="text-[9px] font-bold py-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all text-violet-400"
                >
                  ULTRA
                </button>
              </div>
              <button
                onClick={async () => {
                  const data = {
                    plan: usage.plan,
                    remainingMl: 999999,
                    totalMl: 999999,
                  };
                  setUsage((prev: any) => ({ ...prev, ...data }));
                  showToast("Juice tank filled to 999k mL!", "success");
                  await fetch("/api/usage", {
                    method: "POST",
                    body: JSON.stringify(data),
                  });
                }}
                className="w-full text-[9px] font-black py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all text-red-400 uppercase tracking-widest"
              >
                Infinite Juice
              </button>
            </div>

            {/* Apple Juice CLI (aj) Global Setup */}
            <div className="mt-8 pt-8 border-t border-dashed border-white/10 space-y-4">
              <div>
                <label className="text-[10px] font-black text-[#ccff00] uppercase tracking-[0.2em] block mb-1">
                  Apple Juice CLI (aj)
                </label>
                <p className="text-[11px] text-white/40 uppercase tracking-wider font-bold">
                  Terminal-based pairing & AI sync
                </p>
              </div>
              
              <p className="text-[12px] text-white/60 leading-relaxed">
                Run AI code edits and sync your workspace directly from the command line. Access the CLI from anywhere on your PC.
              </p>

              <div className="flex flex-col gap-3">
                <a
                  href="/install.exe"
                  download="install.exe"
                  className="w-full bg-[#ccff00] hover:bg-[#d4ff33] text-black font-bold py-2.5 rounded text-[13px] text-center transition-all block"
                >
                  Download Windows Standalone Installer (install.exe)
                </a>
                
                <div className="space-y-2">
                  <p className="text-[9px] text-white/30 uppercase tracking-[0.15em] font-black">
                    Or install globally via PowerShell
                  </p>
                  <div className="bg-black/40 border border-white/[0.05] rounded-xl p-3 select-all font-mono text-[11px] text-white/80 break-all whitespace-pre-wrap relative group cursor-pointer hover:border-white/10 transition-colors">
                    {`irm http://localhost:3000/install.ps1 | iex`}
                  </div>
                  <p className="text-[9px] text-white/20 italic">
                    Tip: Open a new command prompt / terminal to start using the 'aj' command globally.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
