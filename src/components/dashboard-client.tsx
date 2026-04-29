"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { Paperclip, Zap, Search, Sparkles, LayoutDashboard, RefreshCw } from "lucide-react";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";

import { ToastContainer, useToasts } from "@/components/ui/toast";
import { ScriptCard } from "@/components/script-card";
import { SystemArchitecture } from "@/components/system-architecture";
import { ThinkingFeed, type ThinkingStep } from "@/components/thinking-feed";
import { WorkspaceTree } from "@/components/workspace-tree";

type DashboardClientProps = {
  username: string;
  avatarUrl?: string;
};

type ScriptMeta = {
  name: string;
  parent: string;
  type?: string;
  action?: "create" | "delete";
  lineCount: number;
  code: string;
  originalCode?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  script?: ScriptMeta;
  scripts?: ScriptMeta[];
  suggestions?: string[];
  thinking?: string;
  attachments?: { name: string }[];
  attachedAsset?: { id: number; name: string; thumbnail: string };
  pendingSync?: boolean;
  isHidden?: boolean;
};

const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"];

export function DashboardClient({ username, avatarUrl }: DashboardClientProps) {
  const [sessionKey, setSessionKey] = useState("");
  const [projectName, setProjectName] = useState("Active Session");
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai" | "google">("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [availableModels, setAvailableModels] = useState<string[]>(FALLBACK_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPluginConnected, setIsPluginConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const [pluginStatus, setPluginStatus] = useState("Idle. Connect your plugin using the session key below.");
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [gameLogs, setGameLogs] = useState<string[]>([]);
  const [mode, setMode] = useState<"fast" | "thinking">("fast");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string }[]>([]);
  const [usage, setUsage] = useState({ usedTokens: 0, totalTokens: 50000, usedCredits: 0, totalCredits: 50 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastPollRef = useRef<number>(0);
  const codeConsumedRef = useRef<boolean>(false);
  const lastReportedErrorRef = useRef<string | null>(null);

  const stepTimeoutsRef = useRef<any[]>([]);
  const autoFixRetriesRef = useRef<number>(0);
  const autoFixTimerRef = useRef<any>(null);
  const lastGeneratedScriptsRef = useRef<{ name: string; parent: string; type: string; code: string }[]>([]);
  const MAX_AUTO_FIX_RETRIES = 3;
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>("");
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [autoRetry, setAutoRetry] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetResults, setAssetResults] = useState<{ id: number; name: string; creator: string; thumbnail: string }[]>([]);
  const [showAssetSearch, setShowAssetSearch] = useState(false);
  const [isSearchingAssets, setIsSearchingAssets] = useState(false);
  const [attachedAsset, setAttachedAsset] = useState<{ id: number; name: string; thumbnail: string } | null>(null);

  const examplePrompts = useMemo(() => [
    "Create a professional sword combat system with raycast hit detection, 3-hit combos, and server-side hit validation.",
    "Build a premium Round System with an Intermission timer, Map Voting UI, and automated player teleportation logic.",
    "Create a high-end Shop UI with categories, item previews, and a robust DataStore-backed coin currency system.",
    "Develop a pet system with smooth follow physics, egg hatching animations, and a rarity-based inventory UI.",
    "Generate a glassmorphic main menu with smooth transitions, settings (SFX/Music), and a play button that tweens the camera."
  ], []);

  const [placeholderText, setPlaceholderText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (messages.length > 0) return;
    const currentPrompt = examplePrompts[promptIndex];
    const speed = isDeleting ? 30 : 60;
    const timeout = setTimeout(() => {
      if (!isDeleting && placeholderText === currentPrompt) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (isDeleting && placeholderText === "") {
        setIsDeleting(false);
        setPromptIndex((prev) => (prev + 1) % examplePrompts.length);
      } else {
        const nextText = isDeleting
          ? currentPrompt.substring(0, placeholderText.length - 1)
          : currentPrompt.substring(0, placeholderText.length + 1);
        setPlaceholderText(nextText);
      }
    }, speed);
    return () => clearTimeout(timeout);
  }, [placeholderText, isDeleting, promptIndex, messages.length, examplePrompts]);

  const [projectTree, setProjectTree] = useState<string[]>([]);
  const [selectedTreePaths, setSelectedTreePaths] = useState<string[]>([]);
  const [atMenu, setAtMenu] = useState<{ visible: boolean; x: number; y: number; filter: string; selectionIndex: number }>({
    visible: false, x: 0, y: 0, filter: "", selectionIndex: 0
  });

  useEffect(() => {
    if (!sessionKey) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?key=${encodeURIComponent(sessionKey)}&t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ok") {
            if (codeConsumedRef.current && !data.hasNewCode) {
              codeConsumedRef.current = false;
              setPluginStatus("Plugin successfully consumed the script.");
              showToast("Plugin received the script!", "success");
            } else if (data.hasNewCode) {
              codeConsumedRef.current = true;
            }
            if (data.tree) {
              const lines = (data.tree as string).split('\n').map(l => l.trim()).filter(l => l.length > 0);
              const newTree = Array.from(new Set(lines));
              if (newTree.length > 0) {
                setProjectTree(prev => JSON.stringify(prev) === JSON.stringify(newTree) ? prev : newTree);
              }
            }
            if (data.fileResponse && data.fileResponse.name) {
              setAttachedFiles(prev => {
                if (prev.some(f => f.name === data.fileResponse.name)) return prev;
                showToast(`Attached ${data.fileResponse.name}`, "success");
                return [...prev, data.fileResponse];
              });
            }
            if (data.lastPollTime > 0) {
              lastPollRef.current = data.lastPollTime;
              const serverTime = data.serverTime || Date.now();
              const isNowConnected = (serverTime - data.lastPollTime) < 8000;
              setIsPluginConnected(prev => {
                if (isNowConnected && !prev) showToast("Plugin connected successfully!", "success");
                return isNowConnected;
              });
            }
            if (data.logs && data.logs.length > 0) {
              setGameLogs(prev => [...prev, ...data.logs].slice(-200));
              for (const log of data.logs as string[]) {
                if (log.includes("[APPLE_JUICE_TEST_PASS]")) {
                  showToast("Playtest passed with no errors!", "success");
                  autoFixRetriesRef.current = 0;
                }
                if (log.includes("[APPLE_JUICE_TEST_FAIL]")) {
                  let testResult: any = null;
                  let rawErrorText = "";
                  try {
                    const jsonStr = log.replace("[APPLE_JUICE_TEST_FAIL]", "").trim();
                    testResult = JSON.parse(jsonStr);
                  } catch {
                    rawErrorText = log.replace("[APPLE_JUICE_TEST_FAIL]", "").trim();
                  }
                  const displayError = testResult ? testResult.errors?.map((e: any) => `[${e.scriptName}:${e.lineNumber}] ${e.errorText}`).join("\n") : rawErrorText;
                  setLastError(displayError);
                  lastReportedErrorRef.current = displayError;
                  if (autoFixRetriesRef.current < MAX_AUTO_FIX_RETRIES && !isGenerating) {
                    autoFixRetriesRef.current += 1;
                    const attempt = autoFixRetriesRef.current;
                    setPluginStatus(`Auto-fixing... (attempt ${attempt}/${MAX_AUTO_FIX_RETRIES})`);
                    if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current);
                    autoFixTimerRef.current = setTimeout(() => {
                      let fixPrompt = `Playtest FAILED. Errors:\n${displayError}\nFix it. Output complete corrected scripts.`;
                      submitPrompt(fixPrompt, true);
                    }, 2000);
                  }
                }
              }
            }
          }
        }
      } catch { /* ignore */ }
    }, 800);
    return () => clearInterval(interval);
  }, [sessionKey, showToast]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinkingSteps]);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [gameLogs]);

  useEffect(() => {
    void createPairOnServer();
    const savedProvider = (window.localStorage.getItem("apple-juice-provider") || "openai") as "openai" | "google";
    const savedOpen = window.localStorage.getItem("apple-juice-openai-key") ?? "";
    const savedGoogle = window.localStorage.getItem("apple-juice-google-key") ?? "";
    setProvider(savedProvider);
    setOpenaiKey(savedOpen);
    setGoogleKey(savedGoogle);
    setApiKey(savedProvider === "google" ? savedGoogle : savedOpen);
    const savedModel = window.localStorage.getItem("apple-juice-model") ?? "gpt-4o-mini";
    setSelectedModel(savedModel);
    try {
      const savedH = window.localStorage.getItem("apple-juice-chat-history");
      if (savedH) setMessages(JSON.parse(savedH));
    } catch { /* ignore */ }
    void fetchUsage();
  }, []);

  async function fetchUsage() {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage({ usedTokens: data.usedTokens || 0, totalTokens: data.totalTokens || 50000, usedCredits: data.usedCredits || 0, totalCredits: data.totalCredits || 50 });
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (messages.length > 0) window.localStorage.setItem("apple-juice-chat-history", JSON.stringify(messages));
  }, [messages]);

  async function createPairOnServer() {
    try {
      const res = await fetch("/api/pair", { method: "POST" });
      if (res.ok) {
        const payload = await res.json();
        setSessionKey(payload?.sessionKey || "");
      }
    } catch { /* ignore */ }
  }

  async function loadModels(rawApiKey?: string, preferredModel?: string, providerArg?: string) {
    const key = (rawApiKey ?? apiKey).trim();
    if (!key) return;
    setIsLoadingModels(true);
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, provider: providerArg ?? provider }),
      });
      if (response.ok) {
        const payload = await response.json();
        const nextModels = payload.models || FALLBACK_MODELS;
        setAvailableModels(nextModels);
        if (preferredModel && nextModels.includes(preferredModel)) setSelectedModel(preferredModel);
      }
    } catch { /* ignore */ } finally { setIsLoadingModels(false); }
  }

  function saveApiKey() {
    const inputValue = (provider === "google" ? googleKey : openaiKey).trim();
    if (provider === "google") window.localStorage.setItem("apple-juice-google-key", inputValue);
    else window.localStorage.setItem("apple-juice-openai-key", inputValue);
    setApiKey(inputValue);
    void loadModels(inputValue);
    setShowSettings(false);
  }

  const handleRedeemCode = async () => {
    if (!secretCode.trim() || !sessionKey) return;
    setIsRedeeming(true);
    try {
      const res = await fetch("/api/redeem-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: secretCode, sessionKey }) });
      if (res.ok) {
        showToast("Code redeemed!", "success");
        setSecretCode("");
        void fetchUsage();
      }
    } catch { /* ignore */ } finally { setIsRedeeming(false); }
  };

  async function submitPrompt(overridePrompt?: any, isHidden: boolean = false) {
    const targetPrompt = typeof overridePrompt === "string" ? overridePrompt : (overridePrompt?.text || prompt);
    const trimmed = targetPrompt.trim();
    if (!trimmed || !sessionKey) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, attachedAsset: attachedAsset || undefined, isHidden };
    if (!isHidden) setMessages(prev => [...prev, userMessage]);
    setPrompt("");
    setLastError(null);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          sessionKey,
          apiKey: apiKey.trim(),
          model: selectedModel,
          provider,
          mode,
          fileContents: attachedFiles,
          autoSync: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Failed to generate");

      const payload = await response.json();
      setAttachedFiles([]);
      setAttachedAsset(null);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.message || "Code synced.",
        scripts: payload.scripts,
        script: payload.script,
        thinking: payload.thinking,
        suggestions: payload.suggestions,
      };
      setMessages(prev => [...prev, assistantMessage]);
      void fetchUsage();
    } catch (e) {
      showToast("Generation failed", "error");
    } finally {
      setIsGenerating(false);
    }
  }

  const handleAutoFix = () => {
    if (!lastError) return;
    submitPrompt(`The previous code failed with this error: ${lastError}. Fix it.`);
  };

  const searchAssets = useCallback(async () => {
    if (!assetQuery.trim()) return;
    setIsSearchingAssets(true);
    try {
      const res = await fetch(`/api/search-assets?q=${encodeURIComponent(assetQuery)}&category=Models`);
      if (res.ok) {
        const data = await res.json();
        setAssetResults(data.results || []);
      }
    } catch { /* ignore */ } finally { setIsSearchingAssets(false); }
  }, [assetQuery]);

  return (
    <div className="flex h-screen bg-[#020203] text-white selection:bg-[#CCFF00] selection:text-black font-sans overflow-hidden relative">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#CCFF00]/5 rounded-full blur-[120px] pointer-events-none animate-float" />
      
      {/* ━━━ SIDEBAR EXPLORER ━━━ */}
      <aside className="w-72 flex flex-col border-r border-white/[0.05] bg-[#050507] z-50">
        <div className="p-4 flex items-center justify-between border-b border-white/[0.03]">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-3.5 w-3.5 text-[#CCFF00]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Explorer</span>
          </div>
          <button onClick={() => setProjectTree([])} className="p-1.5 rounded-md hover:bg-white/5 text-white/20 transition-all"><RefreshCw className="h-3 w-3" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <WorkspaceTree tree={projectTree} onSelect={setSelectedTreePaths} selectedPaths={selectedTreePaths} />
        </div>
        <div className="p-4 border-t border-white/[0.03] bg-black/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Usage</span>
            <span className="text-[10px] font-bold text-[#CCFF00]">{usage.usedCredits} / {usage.totalCredits}</span>
          </div>
          <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(usage.usedCredits / usage.totalCredits) * 100}%` }} className="h-full bg-[#CCFF00]" />
          </div>
          <p className="text-[9px] text-white/20 mt-2 text-center uppercase tracking-tighter">Weekly credits reset every Monday</p>
        </div>
      </aside>

      {/* ━━━ MAIN CHAT AREA ━━━ */}
      <div className="flex-1 flex flex-col h-full bg-[#020203] relative overflow-hidden">
        <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.05] bg-black/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${isPluginConnected ? 'bg-[#CCFF00]' : 'bg-red-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{isPluginConnected ? 'Studio Linked' : 'Offline'}</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowSettings(true)} className="p-2 text-white/40 hover:text-white transition-all"><Zap className="h-4 w-4" /></button>
            <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold">AJ</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-xl">
                <div className="h-12 w-12 rounded-2xl bg-[#CCFF00]/10 flex items-center justify-center mx-auto mb-6 border border-[#CCFF00]/20"><Sparkles className="h-6 w-6 text-[#CCFF00]" /></div>
                <h2 className="text-4xl font-extrabold font-serif italic text-white/90 mb-4">Build the future of <span className="text-[#CCFF00]">Roblox</span></h2>
                <div className="grid grid-cols-2 gap-3 mt-8">
                  {examplePrompts.slice(0, 4).map((p, i) => (
                    <button key={i} onClick={() => setPrompt(p)} className="p-3 text-[11px] text-left text-white/30 border border-white/[0.05] rounded-xl hover:bg-white/[0.03] transition-all">{p}</button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full px-6 py-12 space-y-12 pb-40">
              {messages.filter(m => !m.isHidden).map((msg, idx) => (
                <div key={idx} className="flex flex-col gap-3">
                  <div className={`text-[10px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-white/20 text-right' : 'text-[#CCFF00]/60'}`}>
                    {msg.role === 'user' ? 'Developer' : 'Antigravity AI'}
                  </div>
                  <div className={`max-w-[90%] rounded-2xl px-5 py-4 ${msg.role === 'user' ? 'bg-white/[0.03] border border-white/[0.05] ml-auto text-white/80' : 'glass-panel text-white/90'}`}>
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    {msg.thinking && <div className="mt-4 border-t border-white/5 pt-4 text-[11px] text-white/40 font-mono italic">{msg.thinking}</div>}
                    {msg.script && <ScriptCard script={msg.script} />}
                    {msg.scripts?.map((s, i) => <ScriptCard key={i} script={s} />)}
                  </div>
                </div>
              ))}
              {isGenerating && <div className="text-[10px] text-[#CCFF00]/60 animate-pulse font-black uppercase tracking-widest">Generating...</div>}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* ━━━ COMMAND BAR ━━━ */}
        <div className={`transition-all duration-700 ease-in-out z-40 ${messages.length === 0 ? "absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-20 w-full max-w-2xl px-6" : "absolute bottom-8 left-0 w-full px-6 flex justify-center"}`}>
          <div className="w-full max-w-3xl glass-panel rounded-2xl overflow-hidden neon-border p-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submitPrompt())}
              placeholder="Ask the AI to build something..."
              className="min-h-[60px] bg-transparent border-none p-0 text-white placeholder:text-white/20 focus-visible:ring-0"
            />
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-white/20 hover:text-white"><Paperclip className="h-4 w-4" /></button>
                <button onClick={() => setShowAssetSearch(true)} className="p-2 text-white/20 hover:text-white"><Search className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-2">
                {lastError && <button onClick={handleAutoFix} className="px-3 py-1 bg-red-500/10 text-red-400 text-[10px] font-bold rounded-lg">Repair</button>}
                <button onClick={() => submitPrompt()} className="h-9 w-9 rounded-xl bg-[#CCFF00] text-black flex items-center justify-center transition-all"><Zap className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-xl bg-black/40" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-md glass-panel-strong rounded-3xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold italic mb-6">Settings</h2>
            <div className="space-y-4">
              <Input type="password" value={provider === 'openai' ? openaiKey : googleKey} onChange={e => provider === 'openai' ? setOpenaiKey(e.target.value) : setGoogleKey(e.target.value)} placeholder="API Key" className="bg-white/5" />
              <button onClick={saveApiKey} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-[#CCFF00] transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showAssetSearch && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 backdrop-blur-xl bg-black/40" onClick={() => setShowAssetSearch(false)}>
          <div className="w-full max-w-2xl glass-panel-strong rounded-3xl p-6 h-[600px] flex flex-col" onClick={e => e.stopPropagation()}>
            <Input value={assetQuery} onChange={e => setAssetQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchAssets()} placeholder="Search Toolbox..." className="bg-white/5 mb-4" />
            <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-4">
              {assetResults.map(a => (
                <div key={a.id} onClick={() => { setAttachedAsset(a); setShowAssetSearch(false); }} className="bg-white/5 rounded-xl p-2 cursor-pointer border border-white/5 hover:border-[#CCFF00]/40 transition-all">
                  <img src={a.thumbnail} className="w-full aspect-square object-cover rounded-lg mb-2" />
                  <p className="text-[10px] font-bold truncate">{a.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = () => setAttachedFiles(prev => [...prev, { name: file.name, content: reader.result as string }]);
          reader.readAsText(file);
        });
      }} />
    </div>
  );
}
