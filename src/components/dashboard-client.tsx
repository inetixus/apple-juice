"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { WandSparkles, Paperclip, Zap, Brain, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { ToastContainer, useToasts } from "@/components/ui/toast";
import { ScriptCard } from "@/components/script-card";
import { ThinkingFeed, type ThinkingStep } from "@/components/thinking-feed";

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
};

const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"];

export function DashboardClient({ username, avatarUrl }: DashboardClientProps) {
  const [sessionKey, setSessionKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai" | "google">("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [availableModels, setAvailableModels] = useState<string[]>(FALLBACK_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPluginConnected, setIsPluginConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const [pluginStatus, setPluginStatus] = useState("Idle. Connect your plugin using the session key below.");
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [gameLogs, setGameLogs] = useState<string[]>([]);
  const [mode, setMode] = useState<"fast" | "thinking">("fast");
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string }[]>([]);
  const [usage, setUsage] = useState({ usedTokens: 0, totalTokens: 50000 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const autoFixPendingRef = useRef<string | null>(null);
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastPollRef = useRef<number>(0);
  const codeConsumedRef = useRef<boolean>(false);
  const lastReportedErrorRef = useRef<string | null>(null);
  const pendingPayloadRef = useRef<any>(null);
  const stepTimeoutsRef = useRef<any[]>([]);

  useEffect(() => {
    if (!sessionKey) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?key=${encodeURIComponent(sessionKey)}&t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ok") {
            // Check if the plugin consumed code
            if (codeConsumedRef.current && !data.hasNewCode) {
              codeConsumedRef.current = false;
              setPluginStatus("Plugin successfully consumed the script.");
              showToast("Plugin received the script!", "success");
            } else if (data.hasNewCode) {
              codeConsumedRef.current = true;
            }

            // Handle connection status checking
            if (data.lastPollTime > 0) {
              lastPollRef.current = data.lastPollTime;
              const serverTime = data.serverTime || Date.now();
              const timeSinceLastPoll = serverTime - data.lastPollTime;
              const isNowConnected = timeSinceLastPoll < 8000;
              
              setIsPluginConnected(prev => {
                if (isNowConnected && !prev) {
                  setPluginStatus("Plugin connected successfully.");
                  showToast("Plugin connected successfully!", "success");
                } else if (!isNowConnected && prev) {
                  setPluginStatus("Plugin disconnected. Waiting for connection...");
                }
                return isNowConnected;
              });
            }

            if (data.logs && data.logs.length > 0) {
              setGameLogs(prev => [...prev, ...data.logs].slice(-200)); // keep last 200 logs
              
              const newErrorLog = data.logs.find((log: string) => log.toLowerCase().includes("error") || log.toLowerCase().includes("exception"));
              if (newErrorLog && newErrorLog !== lastReportedErrorRef.current) {
                lastReportedErrorRef.current = newErrorLog;
                setLastError(newErrorLog);
                
                // If we were waiting for a test result, drop it because it failed
                if (isGenerating && pendingPayloadRef.current) {
                  pendingPayloadRef.current = null;
                }
                
                // Queue auto-fix
                autoFixPendingRef.current = newErrorLog;
              }

              const successLog = data.logs.find((log: string) => log.includes("[SYSTEM_TEST_SUCCESS]"));
              if (successLog && isGenerating && pendingPayloadRef.current) {
                // Test passed! Release the message to the user.
                const { payload: fp, files } = pendingPayloadRef.current;
                pendingPayloadRef.current = null;
                
                setMessages((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: fp.message || "Here is the code you requested.",
                    script: (!fp.scripts && fp.scriptName) ? {
                      name: fp.scriptName,
                      parent: fp.scriptParent || "ServerScriptService",
                      type: fp.scriptType || "Script",
                      action: fp.action || "create",
                      lineCount: fp.lineCount || (fp.code ? fp.code.split("\n").length : 0),
                      code: fp.code || "",
                      originalCode: files?.find((f: any) => f.name === fp.scriptName || f.name === fp.scriptName + ".lua")?.content
                    } : undefined,
                    scripts: fp.scripts?.map((s: any) => ({
                      name: s.name,
                      parent: s.parent,
                      type: s.type || "Script",
                      action: s.action || "create",
                      lineCount: s.lineCount || 0,
                      code: s.code || "",
                      originalCode: files?.find((f: any) => f.name === s.name || f.name === s.name + ".lua")?.content
                    })),
                    suggestions: fp.suggestions,
                    thinking: fp.thinking,
                  },
                ]);
                setThinkingSteps([]);
                setIsGenerating(false);
                setPluginStatus("Test passed! Sync complete.");
                showToast("Playtest passed with no errors!", "success");
                void fetchUsage();
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [sessionKey, showToast]);

  // Auto-fix polling: checks every second if an auto-fix is pending
  useEffect(() => {
    const autoFixInterval = setInterval(() => {
      if (autoFixPendingRef.current && !isGenerating) {
        const errorMsg = autoFixPendingRef.current;
        autoFixPendingRef.current = null;
        const fixPrompt = `The previous code failed with this error in Roblox Studio:\n${errorMsg}\n\nFix it. Make sure to output a regular Script in ServerScriptService (not a ModuleScript) unless the original was specifically a module.`;
        submitPrompt(fixPrompt);
      }
    }, 1500);
    return () => clearInterval(autoFixInterval);
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingSteps]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameLogs]);

  useEffect(() => {
    // create pairing session on the server (returns pairing code + token)
    void createPairOnServer();

    const savedProvider = (window.localStorage.getItem("apple-juice-provider") || "openai") as
      | "openai"
      | "google";
    const savedOpen =
      window.localStorage.getItem("apple-juice-openai-key") ?? window.localStorage.getItem("apple-juice-api-key") ?? "";
    const savedGoogle = window.localStorage.getItem("apple-juice-google-key") ?? "";

    setProvider(savedProvider);
    setOpenaiKey(savedOpen);
    setGoogleKey(savedGoogle);

    const effectiveKey = savedProvider === "google" ? savedGoogle : savedOpen;
    setApiKey(effectiveKey);

    const savedModel = window.localStorage.getItem("apple-juice-model") ?? "gpt-4o-mini";
    setSelectedModel(savedModel);

    const saved = window.localStorage.getItem("apple-juice-recent-prompts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as string[];
        setRecentPrompts(parsed.slice(0, 6));
      } catch {
        setRecentPrompts([]);
      }
    }

    const savedMessages = window.localStorage.getItem("apple-juice-chat-history");
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages) as ChatMessage[];
        setMessages(parsed);
      } catch {
        setMessages([]);
      }
    }

    if (effectiveKey) {
      void loadModels(effectiveKey, savedModel);
    }
    void fetchUsage();
  }, []);

  async function fetchUsage() {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage({
          usedTokens: data.usedTokens,
          totalTokens: data.totalTokens,
        });
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      window.localStorage.setItem("apple-juice-chat-history", JSON.stringify(messages));
    }
  }, [messages]);

  async function createPairOnServer() {
    setPluginStatus("Creating pairing session...");
    try {
      const res = await fetch("/api/pair", { method: "POST" });
      if (!res.ok) {
        let errMsg = res.statusText;
        let errPayload: any = null;
        try {
          errPayload = await res.json();
          errMsg = errPayload?.error || errMsg;
        } catch {
          // ignore parse errors
        }

        // If server returned a 500 with details, surface exact details in an alert for debugging
        if (res.status >= 500 && errPayload?.details) {
          const detail = errPayload.details;
          setPluginStatus(`Pair creation failed: ${detail}`);
          try {
            window.alert(`Pair creation failed (server error): ${detail}`);
          } catch {
            /* ignore */
          }
          return;
        }

        if (res.status === 401) {
          setPluginStatus("Pair creation failed: Unauthorized — please sign in and try again.");
        } else {
          setPluginStatus(`Pair creation failed: ${errMsg}`);
        }
        return;
      }

      const payload = await res.json();
      const key = (payload?.sessionKey as string) || "";
      setSessionKey(key);
      setPluginStatus("Session created. Copy the key and paste it into your plugin.");
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setPluginStatus(`Session creation failed: ${detail}`);
    }
  }

  async function loadModels(rawApiKey?: string, preferredModel?: string, providerArg?: string) {
    const key = (rawApiKey ?? apiKey).trim();
    setIsLoadingModels(true);
    const usedProvider = providerArg ?? provider;
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, provider: usedProvider }),
      });

      if (!response.ok) {
        let msg = response.statusText;
        try {
          const err = await response.json();
          msg = err?.error || msg;
        } catch {
          // ignore
        }
        setAvailableModels(FALLBACK_MODELS);
        setPluginStatus(`Model list failed: ${msg}`);
        return;
      }

      const payload = (await response.json()) as { models?: string[]; error?: string };
      const nextModels = payload.models && payload.models.length > 0 ? payload.models : FALLBACK_MODELS;
      setAvailableModels(nextModels);

      const targetModel = preferredModel || selectedModel;
      if (targetModel && nextModels.includes(targetModel)) {
        setSelectedModel(targetModel);
      } else {
        const fallbackDefault = usedProvider === "google" ? "gemini-3-flash" : "gpt-4o-mini";
        const first = nextModels[0] || fallbackDefault;
        setSelectedModel(first);
        window.localStorage.setItem("apple-juice-model", first);
      }
    } catch {
      setAvailableModels(FALLBACK_MODELS);
      setPluginStatus("Could not load model list. Using fallback model choices.");
    } finally {
      setIsLoadingModels(false);
    }
  }

  const latestCode = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") {
        return messages[i].content;
      }
    }
    return "";
  }, [messages]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard failures are safe to ignore in non-secure contexts.
    }
  }

  function looksLikeGoogleKey(k: string) {
    if (!k) return false;
    const s = k.trim();
    return /^AIza/.test(s) || /^ya29\./.test(s);
  }

  function saveApiKey() {
    const inputValue = (provider === "google" ? googleKey : openaiKey).trim();
    const detectedGoogle = looksLikeGoogleKey(inputValue);
    const finalProvider: "openai" | "google" = detectedGoogle ? "google" : provider;

    if (finalProvider === "google") {
      window.localStorage.setItem("apple-juice-google-key", inputValue);
      setGoogleKey(inputValue);
      setProvider("google");
    } else {
      window.localStorage.setItem("apple-juice-openai-key", inputValue);
      // keep legacy key for compatibility
      window.localStorage.setItem("apple-juice-api-key", inputValue);
      setOpenaiKey(inputValue);
      setProvider("openai");
    }

    window.localStorage.setItem("apple-juice-provider", finalProvider);
    setApiKey(inputValue);
    // Pass explicit provider to loadModels to avoid waiting for state update
    void loadModels(inputValue, undefined, finalProvider);
    setShowSettings(false);
  }

  function addRecentPrompt(value: string) {
    const next = [value, ...recentPrompts.filter((item) => item !== value)].slice(0, 6);
    setRecentPrompts(next);
    window.localStorage.setItem("apple-juice-recent-prompts", JSON.stringify(next));
  }

  async function submitPrompt(overridePrompt?: string | any) {
    const targetPrompt = typeof overridePrompt === "string" ? overridePrompt : prompt;
    const trimmed = targetPrompt.trim();
    if (!trimmed || !sessionKey) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      attachments: attachedFiles.length > 0 ? attachedFiles.map(f => ({ name: f.name })) : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setPrompt("");
    setLastError(null);
    addRecentPrompt(trimmed);
    setIsGenerating(true);
    setPluginStatus("Generating Luau and syncing it to the pairing session...");

    const promptSnippet = trimmed.length > 25 ? trimmed.substring(0, 25) + "..." : trimmed;
    const isAsset = trimmed.toLowerCase().includes("insert") || trimmed.toLowerCase().includes("build") || trimmed.toLowerCase().includes("model") || trimmed.toLowerCase().includes("part");
    
    if (mode === "thinking") {
      setThinkingSteps([{ icon: "thinking", label: `Deep reasoning about "${promptSnippet}"...`, done: false }]);
      
      const fileNames = attachedFiles.map(f => f.name).join(", ");
      
      const t1 = setTimeout(() => {
        setThinkingSteps(prev => {
          if (prev.length === 1 && !prev[0].done) {
            return [{ ...prev[0], done: true }, { icon: "looking", label: fileNames ? `Reading ${fileNames}...` : "Planning architecture...", done: false }];
          }
          return prev;
        });
        
        const t2 = setTimeout(() => {
          setThinkingSteps(prev => {
            if (prev.length === 2 && !prev[1].done) {
              return [prev[0], { ...prev[1], done: true }, { icon: "generating", label: isAsset ? "Locating asset..." : "Writing code...", done: false }];
            }
            return prev;
          });
        }, 2500 + Math.random() * 3000);
        stepTimeoutsRef.current.push(t2);
      }, 2000 + Math.random() * 2500);
      
      stepTimeoutsRef.current.push(t1);
    } else {
      setThinkingSteps([{ icon: "thinking", label: `Analyzing request: "${promptSnippet}"...`, done: false }]);
      
      const fileNames = attachedFiles.map(f => f.name).join(", ");
      
      const t1 = setTimeout(() => {
        setThinkingSteps(prev => {
          if (prev.length === 1 && !prev[0].done) {
            return [{ ...prev[0], done: true }, { icon: "looking", label: fileNames ? `Reading ${fileNames}...` : "Checking workspace folders...", done: false }];
          }
          return prev;
        });
        
        const t2 = setTimeout(() => {
          setThinkingSteps(prev => {
            if (prev.length === 2 && !prev[1].done) {
              const scriptTypes = ["LocalScript", "ModuleScript", "ServerScript"];
              const typeFound = scriptTypes.find(t => trimmed.toLowerCase().includes(t.toLowerCase())) || "code";
              return [prev[0], { ...prev[1], done: true }, { icon: "generating", label: isAsset ? "Preparing asset..." : `Writing ${typeFound}...`, done: false }];
            }
            return prev;
          });
        }, 1500 + Math.random() * 2000);
        stepTimeoutsRef.current.push(t2);
      }, 1000 + Math.random() * 1500);
      
      stepTimeoutsRef.current.push(t1);
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          sessionKey,
          apiKey: apiKey.trim(),
          model: selectedModel,
          provider,
          openaiKey: openaiKey.trim(),
          mode,
          fileContents: attachedFiles.length > 0 ? attachedFiles : undefined,
        }),
      });

      stepTimeoutsRef.current.forEach(clearTimeout);
      stepTimeoutsRef.current = [];
      setThinkingSteps(prev => prev.map(s => ({ ...s, done: true })));

      if (!response.ok) {
        let errText = response.statusText;
        try {
          const errPayload = await response.json();
          errText = errPayload?.detail || errPayload?.error || errText;
        } catch {
          // ignore parse error
        }
        throw new Error(errText || "Failed to generate code");
      }

      const payload = (await response.json()) as { 
        code?: string; error?: string; detail?: string; 
        scriptName?: string; scriptParent?: string; lineCount?: number; 
        scriptType?: string; action?: "create" | "delete";
        message?: string; suggestions?: string[];
        scripts?: { name: string; parent: string; type: string; action: string; lineCount: number; code: string }[];
        thinking?: string;
      };

      const payloadFiles = [...attachedFiles];
      setAttachedFiles([]);

      setPluginStatus(`New code is ready. Syncing to Studio for playtest...`);
      showToast("Script generated, syncing to Studio...", "success");

      setThinkingSteps(prev => [...prev, { icon: "generating", label: "Running playtest in Roblox...", done: false }]);

      pendingPayloadRef.current = { payload, files: payloadFiles };

      function buildAssistantMessage(p: typeof payload, files: { name: string; content: string }[]): ChatMessage {
        return {
          id: crypto.randomUUID(),
          role: "assistant",
          content: p.message || "Here is the code you requested.",
          script: (!p.scripts && p.scriptName) ? {
            name: p.scriptName,
            parent: p.scriptParent || "ServerScriptService",
            type: p.scriptType || "Script",
            action: p.action || "create",
            lineCount: p.lineCount || (p.code ? p.code.split("\n").length : 0),
            code: p.code || "",
            originalCode: files.find((f) => f.name === p.scriptName || f.name === p.scriptName + ".lua")?.content
          } : undefined,
          scripts: p.scripts?.map(s => ({
            name: s.name,
            parent: s.parent,
            type: s.type || "Script",
            action: (s.action as "create" | "delete") || "create",
            lineCount: s.lineCount || 0,
            code: s.code || "",
            originalCode: files.find((f) => f.name === s.name || f.name === s.name + ".lua")?.content
          })),
          suggestions: p.suggestions,
          thinking: p.thinking,
        };
      }

      setTimeout(() => {
        if (pendingPayloadRef.current && pendingPayloadRef.current.payload === payload) {
          const { payload: fp, files } = pendingPayloadRef.current;
          pendingPayloadRef.current = null;
          setMessages((current) => [...current, buildAssistantMessage(fp, files)]);
          setThinkingSteps([]);
          setIsGenerating(false);
          setPluginStatus("Playtest timeout. Assuming success.");
          void fetchUsage();
        }
      }, 15000);

    } catch (error) {
      stepTimeoutsRef.current.forEach(clearTimeout);
      stepTimeoutsRef.current = [];
      let detail = error instanceof Error ? error.message : "Unknown error";
      
      try {
        if (detail.startsWith("{") && detail.includes('"error"')) {
          const parsed = JSON.parse(detail);
          if (parsed?.error?.message) {
            detail = parsed.error.message;
          }
        }
      } catch {
        // ignore
      }

      if (detail.includes("503") || detail.includes("high demand") || detail.includes("UNAVAILABLE")) {
        detail = "The AI model is currently experiencing high demand. Please try again in a few moments or switch to a different model in settings.";
      }

      setPluginStatus(`Generation failed: ${detail}`);
      showToast(detail, "error");
      setTimeout(() => setThinkingSteps([]), 1000);
      setIsGenerating(false);
      void fetchUsage();
    }
  }



  const handleAutoFix = () => {
    if (!lastError) return;
    const fixPrompt = `The previous code failed with this error in Roblox Studio:\n${lastError}\n\nFix it.`;
    submitPrompt(fixPrompt);
  };

  return (
    <main className="h-screen bg-[#13151a] text-white flex flex-col overflow-hidden">
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04] px-6 py-3 bg-[#13151a]/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#ccff00] shadow-[0_0_12px_rgba(204,255,0,0.25)]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-black" fill="currentColor">
                    <path d="M5.2 6.5L7.5 3h9l2.3 3.5H5.2z" fillOpacity="0.8" />
                    <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5z" />
                    <path d="M15 3V1.5A1.5 1.5 0 0 0 13.5 0H12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M14.5 14.5c0 1.5-1 2.5-2.5 2.5s-2.5-1-2.5-2.5 1-2.5 2.5-2.5c.3 0 .7.1 1 .2-.3.4-.3 1 0 1.4.3.4.9.4 1.3.1.1.2.2.5.2.8zM12.5 11c0-1-.8-1.5-1.5-1.5 0 1 .8 1.5 1.5 1.5z" fill="#ccff00" />
                  </svg>
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Apple Juice</span>
          <span className="hidden sm:block text-white/20 text-xs">·</span>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-6 w-6 rounded-full ring-1 ring-white/20" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-[#ccff00]/20 flex items-center justify-center text-[10px] font-bold text-[#ccff00]">
              {username.charAt(0)}
            </div>
          )}
          <span className="hidden sm:block text-[13px] text-white/50">
            {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}, {username}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="px-3 py-1.5 rounded-lg text-[13px] text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all" onClick={() => { setMessages([]); window.localStorage.removeItem("apple-juice-chat-history"); }}>
            Clear
          </button>
          <button className={`px-3 py-1.5 rounded-lg text-[13px] transition-all ${showSettings ? 'text-[#ccff00] bg-[#ccff00]/10' : 'text-white/40 hover:text-white/80 hover:bg-white/[0.06]'}`} onClick={() => setShowSettings((open) => !open)}>
            Settings
          </button>
          <button className="px-3 py-1.5 rounded-lg text-[13px] text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all" onClick={() => signOut({ callbackUrl: "/" })}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 border-r border-white/[0.04] overflow-y-auto p-4 space-y-3 bg-[#13151a]">
          {showSettings && (
            <div className="bg-[#1e2028] border border-white/[0.04] rounded-2xl p-5 space-y-5 animate-in fade-in slide-in-from-top-3 duration-200">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Settings</p>
              <div>
                <label className="text-[12px] font-medium text-white/50 mb-2 block">Provider</label>
                <select
                  id="provider-select"
                  value={provider}
                  onChange={(e) => {
                    const val = (e.target.value as "openai" | "google");
                    const storedOpen = window.localStorage.getItem("apple-juice-openai-key") ?? window.localStorage.getItem("apple-juice-api-key") ?? "";
                    const storedGoogle = window.localStorage.getItem("apple-juice-google-key") ?? "";
                    setProvider(val);
                    setOpenaiKey(storedOpen);
                    setGoogleKey(storedGoogle);
                    const newKey = val === "google" ? storedGoogle : storedOpen;
                    setApiKey(newKey);
                    window.localStorage.setItem("apple-juice-provider", val);
                  }}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ccff00]/40 transition-colors"
                >
                  <option value="openai" className="bg-[#13151a]">OpenAI</option>
                  <option value="google" className="bg-[#13151a]">Google AI Studio</option>
                </select>
              </div>
              <div>
                <label className="text-[12px] font-medium text-white/50 mb-2 block" htmlFor="api-key-input">
                  API Key <span className="text-white/25 font-normal">(saved locally)</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    id="api-key-input"
                    type="password"
                    value={provider === "google" ? googleKey : openaiKey}
                    onChange={(event) => {
                      const v = event.target.value;
                      if (provider === "google") setGoogleKey(v);
                      else setOpenaiKey(v);
                      setApiKey(v);
                    }}
                    placeholder={provider === "google" ? "Google API Key" : "sk-..."}
                    className="flex-1 bg-white/[0.04] border-white/[0.08] h-9 text-sm focus:border-[#ccff00]/40"
                  />
                  <button onClick={saveApiKey} className="px-3 py-2 bg-[#ccff00] text-black text-[12px] font-semibold rounded-xl hover:bg-[#d4ff33] transition-colors whitespace-nowrap">
                    Save
                  </button>
                </div>
                <button onClick={() => loadModels()} disabled={isLoadingModels} className="mt-2 text-[12px] text-white/30 hover:text-white/60 transition-colors disabled:opacity-40">
                  {isLoadingModels ? "Loading models..." : "↻ Refresh models"}
                </button>
              </div>
              <div>
                <label className="text-[12px] font-medium text-white/50 mb-2 block" htmlFor="model-select">Model</label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedModel(value);
                    window.localStorage.setItem("apple-juice-model", value);
                  }}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#ccff00]/40 transition-colors"
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model} className="bg-[#13151a]">{model}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Plugin Status */}
          <div className="bg-[#1e2028] border border-white/[0.04] rounded-2xl p-4 animate-in fade-in slide-in-from-left-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`relative flex h-2.5 w-2.5`}>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${isPluginConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPluginConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                </span>
                <span className="text-sm font-medium text-white/80">
                  {isPluginConnected ? "Plugin connected" : "Waiting for plugin"}
                </span>
              </div>
              <button className="text-[11px] text-white/25 hover:text-white/60 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04]" onClick={() => void createPairOnServer()}>Reset</button>
            </div>
            <p className="mt-2 text-[12px] text-white/30 leading-relaxed">{pluginStatus}</p>
          </div>

          {latestCode && (
            <div className="bg-[#1e2028] border border-white/[0.04] rounded-2xl p-4 animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">Latest Script</span>
                <button className="text-[11px] text-white/30 hover:text-[#ccff00] transition-colors" onClick={() => copyText(latestCode)}>Copy ↗</button>
              </div>
              {lastError && (
                <div className="mb-3 p-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/20">
                  <p className="text-red-400/90 text-[11px] font-mono break-words leading-relaxed">{lastError}</p>
                </div>
              )}
              <pre className="max-h-44 overflow-auto font-mono text-[11px] bg-black/40 border border-white/[0.04] rounded-xl p-3 text-white/50 leading-relaxed">
                <code>{latestCode}</code>
              </pre>
            </div>
          )}

          {gameLogs.length > 0 && (
            <div className="bg-[#1e2028] border border-white/[0.04] rounded-2xl p-4 animate-in fade-in slide-in-from-left-4 duration-500 delay-150">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-semibold text-white/50 uppercase tracking-wider">Game Logs</span>
                <div className="flex gap-3">
                  <button className="text-[11px] text-white/25 hover:text-red-400 transition-colors" onClick={() => setGameLogs([])}>Clear</button>
                  <button className="text-[11px] text-[#ccff00]/60 hover:text-[#ccff00] transition-colors" onClick={() => {
                    submitPrompt("Please analyze these game logs and help me fix any errors:\n" + gameLogs.join("\n"));
                    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}>✦ Analyze</button>
                </div>
              </div>
              <div className="max-h-44 overflow-auto font-mono text-[11px] bg-black/40 border border-white/[0.04] rounded-xl p-3 text-white/40 space-y-0.5 leading-relaxed">
                {gameLogs.map((log, i) => {
                  const isError = log.toLowerCase().includes("error") || log.toLowerCase().includes("exception");
                  return <div key={i} className={isError ? "text-red-400" : ""}>{log}</div>;
                })}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE (CHAT) */}
        <div className="flex-1 flex flex-col h-full bg-[#181a20] relative overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="max-w-md text-center animate-in fade-in zoom-in-95 duration-700">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00]">
                    <WandSparkles className="h-7 w-7" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white mb-2">What do you want to build?</h2>
                  <p className="text-sm text-white/40 leading-relaxed">
                    Describe your idea and get working Luau code synced directly to Roblox Studio.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] sm:max-w-[72%] px-4 py-3.5 rounded-2xl text-[14px] leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-white/[0.08] text-white border border-white/[0.12] rounded-br-sm'
                      : 'bg-white/[0.04] text-white/85 border border-white/[0.07] rounded-bl-sm'
                  }`}>
                    <div className="space-y-3">
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {message.attachments.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/40">
                            <Paperclip className="h-2.5 w-2.5" />
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>

                    {message.thinking && (
                      <details className="group mt-2">
                        <summary className="cursor-pointer text-[11px] text-white/30 hover:text-white/50 transition-colors flex items-center gap-1">
                          <Brain className="h-3 w-3" />
                          <span>View reasoning</span>
                        </summary>
                        <div className="mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[13px] text-white/40 whitespace-pre-wrap">
                          {message.thinking}
                        </div>
                      </details>
                    )}
                    
                    {message.script && (
                      <ScriptCard script={message.script} />
                    )}

                    {message.scripts && message.scripts.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[12px] font-medium text-white/30">{message.scripts.length} scripts generated</p>
                        {message.scripts.map((s, i) => (
                          <ScriptCard key={i} script={s} />
                        ))}
                      </div>
                    )}

                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06]">
                        <div className="flex flex-wrap gap-1.5">
                          {message.suggestions.map((sugg, i) => (
                            <button 
                              key={i} 
                              className="text-[12px] px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                              onClick={() => setPrompt(sugg)}
                            >
                              {sugg}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
            
            {isGenerating && <ThinkingFeed steps={thinkingSteps} />}
            <div ref={chatEndRef} className="h-px w-full" />
          </div>

          {/* Input Bar */}
          <div className="flex-shrink-0 border-t border-white/[0.04] p-4 bg-[#13151a]">
            <div className="w-full space-y-3">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {attachedFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.12] text-[11px] text-white/80">
                      <Paperclip className="h-2.5 w-2.5" />
                      {f.name}
                      <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-0.5 hover:text-white transition-colors">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe what you want to build... (Enter to send, Shift+Enter for newline)"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
                className="bg-white/[0.03] border-white/[0.07] text-[14px] placeholder:text-white/20 resize-none rounded-xl focus:border-[#ccff00]/30 focus:ring-0 transition-colors"
              />

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".lua,.luau,.txt,.json,.md,.csv,.ts,.js"
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  Array.from(files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      setAttachedFiles(prev => [...prev, { name: file.name, content: reader.result as string }]);
                    };
                    reader.readAsText(file);
                  });
                  e.target.value = "";
                }}
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Mode toggle */}
                  <div className="flex items-center bg-white/[0.04] rounded-xl border border-white/[0.07] p-0.5">
                    <button
                      onClick={() => setMode("fast")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                        mode === "fast"
                          ? "bg-[#ccff00]/15 text-[#ccff00] shadow-sm"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      <Zap className="h-3 w-3" />
                      Fast
                    </button>
                    <button
                      onClick={() => setMode("thinking")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                        mode === "thinking"
                          ? "bg-violet-500/15 text-violet-400 shadow-sm"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      <Brain className="h-3 w-3" />
                      Thinking
                    </button>
                  </div>

                  <button
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white/70 hover:bg-white/[0.05] border border-white/[0.07] transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-3 w-3" />
                    Attach
                  </button>

                  {(provider === "google" ? googleKey.trim() : openaiKey.trim()).length === 0 ? (() => {
                    const pct = Math.max(0, Math.min(100, ((usage.totalTokens - usage.usedTokens) / usage.totalTokens) * 100));
                    const hue = Math.floor((pct / 100) * 75);
                    const colorFill = `hsla(${hue}, 100%, 50%, 0.15)`;
                    const colorSolid = `hsla(${hue}, 100%, 50%, 0.08)`;
                    const textColor = `hsl(${hue}, 100%, 50%)`;
                    return (
                      <div className="hidden sm:flex relative h-7 w-40 bg-white/[0.03] rounded-lg overflow-hidden border border-white/[0.06] items-center justify-center group">
                        <div 
                          className="absolute left-0 right-0 bottom-0 transition-all duration-700"
                          style={{ 
                            height: `${pct}%`,
                            backgroundColor: colorSolid,
                          }}
                        >
                          {pct > 0 && (
                            <div 
                              className="absolute left-0 right-0 top-[-8px] h-[8px] animate-wave"
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 800 10' preserveAspectRatio='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,5 Q100,0 200,5 T400,5 T600,5 T800,5 L800,10 L0,10 Z' fill='${encodeURIComponent(colorFill)}'/%3E%3C/svg%3E")`,
                                backgroundSize: '200% 100%'
                              }}
                            />
                          )}
                        </div>
                        <span className="relative z-10 text-[10px] font-mono tracking-tight text-white/50">
                          <span style={{ color: textColor }} className="font-medium">{Math.max(0, usage.totalTokens - usage.usedTokens).toLocaleString()}</span> / {usage.totalTokens.toLocaleString()}
                        </span>
                      </div>
                    );
                  })() : (
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-[#ccff00]/20">
                      <span className="text-[11px] font-medium text-[#ccff00]">Custom Key Active</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {lastError && (
                    <button
                      className="px-3 py-2 rounded-xl text-[12px] font-medium text-red-400 bg-red-500/[0.08] border border-red-500/20 hover:bg-red-500/15 transition-all"
                      onClick={handleAutoFix}
                      disabled={isGenerating}
                    >
                      Repair
                    </button>
                  )}
                  <button
                    onClick={() => submitPrompt()}
                    disabled={isGenerating}
                    className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-[#ccff00] text-black hover:bg-[#d4ff33] disabled:opacity-40 transition-all shadow-[0_0_16px_rgba(204,255,0,0.2)] hover:shadow-[0_0_24px_rgba(204,255,0,0.35)] disabled:shadow-none"
                  >
                    {isGenerating ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
