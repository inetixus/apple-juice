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
  const [usage, setUsage] = useState({ usedCredits: 0, totalCredits: 50 });
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
                const fp = pendingPayloadRef.current;
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
                      code: fp.code || ""
                    } : undefined,
                    scripts: fp.scripts?.map((s: any) => ({
                      name: s.name,
                      parent: s.parent,
                      type: s.type || "Script",
                      action: s.action || "create",
                      lineCount: s.lineCount || 0,
                      code: s.code || "",
                    })),
                    suggestions: fp.suggestions,
                    thinking: fp.thinking,
                  },
                ]);
                setThinkingSteps([]);
                setIsGenerating(false);
                setPluginStatus("Test passed! Sync complete.");
                showToast("Playtest passed with no errors!", "success");
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
          usedCredits: data.usedCredits,
          totalCredits: data.totalCredits,
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
    if (!key) {
      setPluginStatus("Add your API key in Settings to load model choices.");
      return;
    }
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
    if (!apiKey.trim()) {
      setPluginStatus("Add your API key in Settings before generating code.");
      setShowSettings(true);
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

    if (mode === "thinking") {
      setThinkingSteps([{ icon: "thinking", label: "Deep reasoning about the request...", done: false }]);
      
      const fileNames = attachedFiles.map(f => f.name).join(", ");
      
      const t1 = setTimeout(() => {
        setThinkingSteps(prev => {
          if (prev.length === 1 && !prev[0].done) {
            return [{ ...prev[0], done: true }, { icon: "looking", label: fileNames ? `Analyzing attached files: ${fileNames}...` : "Analyzing architecture and dependencies...", done: false }];
          }
          return prev;
        });
        
        const t2 = setTimeout(() => {
          setThinkingSteps(prev => {
            if (prev.length === 2 && !prev[1].done) {
              const keywords = ["ServerScriptService", "StarterPlayer", "ReplicatedStorage", "GUI", "LocalScript", "Module"];
              const found = keywords.find(k => trimmed.toLowerCase().includes(k.toLowerCase()));
              return [prev[0], { ...prev[1], done: true }, { icon: "generating", label: found ? `Drafting scripts for ${found}...` : "Writing and verifying Luau scripts...", done: false }];
            }
            return prev;
          });
        }, 2000 + Math.random() * 3000);
        stepTimeoutsRef.current.push(t2);
      }, 1500 + Math.random() * 2500);
      
      stepTimeoutsRef.current.push(t1);
    } else {
      setThinkingSteps([{ icon: "thinking", label: "Thinking about the request...", done: false }]);
      
      const fileNames = attachedFiles.map(f => f.name).join(", ");
      
      const t1 = setTimeout(() => {
        setThinkingSteps(prev => {
          if (prev.length === 1 && !prev[0].done) {
            return [{ ...prev[0], done: true }, { icon: "looking", label: fileNames ? `Reading ${fileNames}...` : "Looking at Roblox API docs...", done: false }];
          }
          return prev;
        });
        
        const t2 = setTimeout(() => {
          setThinkingSteps(prev => {
            if (prev.length === 2 && !prev[1].done) {
              const scriptTypes = ["LocalScript", "ModuleScript"];
              const typeFound = scriptTypes.find(t => trimmed.includes(t)) || "Script";
              return [prev[0], { ...prev[1], done: true }, { icon: "generating", label: `Writing ${typeFound}...`, done: false }];
            }
            return prev;
          });
        }, 1000 + Math.random() * 2000);
        stepTimeoutsRef.current.push(t2);
      }, 800 + Math.random() * 1500);
      
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

      // Clear attached files after successful send
      setAttachedFiles([]);

      setPluginStatus(`New code is ready. Syncing to Studio for playtest...`);
      showToast("Script generated, syncing to Studio...", "success");

      setThinkingSteps(prev => [...prev, { icon: "generating", label: "Running playtest in Roblox...", done: false }]);

      // Hold the payload in the ref. The polling interval will release it on success.
      pendingPayloadRef.current = payload;

      // Helper to build assistant message from payload
      function buildAssistantMessage(p: typeof payload): ChatMessage {
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
            code: p.code || ""
          } : undefined,
          scripts: p.scripts?.map(s => ({
            name: s.name,
            parent: s.parent,
            type: s.type || "Script",
            action: (s.action as "create" | "delete") || "create",
            lineCount: s.lineCount || 0,
            code: s.code || "",
          })),
          suggestions: p.suggestions,
          thinking: p.thinking,
        };
      }

      // 15-second timeout fallback in case the plugin never responds
      setTimeout(() => {
        if (pendingPayloadRef.current === payload) {
          pendingPayloadRef.current = null;
          setMessages((current) => [...current, buildAssistantMessage(payload)]);
          setThinkingSteps([]);
          setIsGenerating(false);
          setPluginStatus("Playtest timeout. Assuming success.");
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
    <main className="h-screen bg-[#0c0d10] text-white flex flex-col overflow-hidden">
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ccff00]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-black" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2v3" />
              <rect x="5" y="5" width="14" height="17" rx="3" />
              <path d="M5 10h14" />
            </svg>
          </div>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-7 w-7 rounded-full ring-1 ring-white/10" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-medium text-white/40">
              {username.charAt(0)}
            </div>
          )}
          <span className="text-sm font-medium text-white/70">{username}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="px-3 py-1.5 rounded-lg text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors" onClick={() => { setMessages([]); window.localStorage.removeItem("apple-juice-chat-history"); }}>
            Clear
          </button>
          <button className="px-3 py-1.5 rounded-lg text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors" onClick={() => setShowSettings((open) => !open)}>
            Settings
          </button>
          <button className="px-3 py-1.5 rounded-lg text-[13px] text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors" onClick={() => signOut({ callbackUrl: "/" })}>
            Sign Out
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-r border-white/[0.06] overflow-y-auto p-5 space-y-4">
          {showSettings && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-white/40 mb-1.5 block">Provider</label>
                <div className="flex items-center gap-3">
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
                    className="w-48 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-white/80 focus:outline-none focus:border-[#ccff00]/50 transition-colors"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="google">Google AI Studio</option>
                  </select>
                  <p className="text-[12px] text-white/30">Select API provider</p>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-white/40 mb-1.5 block" htmlFor="api-key-input">
                  Provider API Key <span className="font-normal">(local)</span>
                </label>
                <div className="flex flex-wrap gap-2">
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
                    className="min-w-[200px] flex-1 bg-white/[0.02] border-white/[0.06] h-9 text-[13px]"
                  />
                  <button onClick={saveApiKey} className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] rounded-lg text-[12px] font-medium transition-colors">
                    Save Key
                  </button>
                  <button
                    onClick={() => loadModels()}
                    disabled={isLoadingModels}
                    className="px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg text-[12px] font-medium transition-colors disabled:opacity-50"
                  >
                    {isLoadingModels ? "Loading..." : "Refresh"}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-white/40 mb-1.5 block" htmlFor="model-select">
                  Model
                </label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedModel(value);
                    window.localStorage.setItem("apple-juice-model", value);
                  }}
                  className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-white/80 focus:outline-none focus:border-[#ccff00]/50 transition-colors"
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model} className="bg-[#0c0d10]">
                      {model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isPluginConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-[13px] font-medium text-white/80">
                  {isPluginConnected ? "Plugin connected" : "Waiting for plugin..."}
                </span>
              </div>
              <button className="text-[12px] text-white/30 hover:text-white/60 transition-colors" onClick={() => void createPairOnServer()}>Reset</button>
            </div>
            <p className="mt-2 text-[12px] text-white/30">{pluginStatus}</p>
          </div>

          {latestCode && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-medium text-white/40">Latest Script</span>
                <button className="text-[12px] text-white/30 hover:text-white/60 transition-colors" onClick={() => copyText(latestCode)}>Copy</button>
              </div>
              <div className={lastError ? "border border-red-500/[0.15] bg-red-500/[0.05] p-2 rounded-lg" : ""}>
                {lastError && (
                  <p className="mb-2 text-red-400/80 text-[11px] font-mono break-words">{lastError}</p>
                )}
                <pre className="max-h-48 overflow-auto font-mono text-[12px] bg-[#0c0d10] border border-white/[0.06] rounded-lg p-3 text-white/50">
                  <code>{latestCode}</code>
                </pre>
              </div>
            </div>
          )}

          {gameLogs.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-medium text-white/40">Game Logs</span>
                <div className="flex gap-2">
                  <button className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors" onClick={() => setGameLogs([])}>Clear</button>
                  <button className="text-[11px] text-[#ccff00]/60 hover:text-[#ccff00] transition-colors" onClick={() => {
                    submitPrompt("Please analyze these game logs and help me fix any errors:\n" + gameLogs.join("\n"));
                    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  }}>Analyze</button>
                </div>
              </div>
              <div className="max-h-48 overflow-auto font-mono text-[11px] bg-[#0c0d10] border border-white/[0.06] rounded-lg p-3 text-white/40 space-y-0.5">
                {gameLogs.map((log, i) => {
                  const isError = log.toLowerCase().includes("error") || log.toLowerCase().includes("exception");
                  return (
                    <div key={i} className={isError ? "text-red-400/80" : ""}>{log}</div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE (CHAT) */}
        <div className="flex-1 flex flex-col h-full bg-[#0a0b0e] relative overflow-hidden">
          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="max-w-sm text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/30 mb-4">
                    <WandSparkles className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-semibold text-white/80 mb-2">What do you want to build?</h2>
                  <p className="text-[13px] text-white/30">
                    Describe your idea and get working Luau code synced to Studio.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-xl text-[14px] ${
                    message.role === 'user' 
                      ? 'bg-white/[0.06] text-white/90 border border-white/[0.06]' 
                      : 'bg-white/[0.02] text-white/70 border border-white/[0.06]'
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

          {/* Prompt Input */}
          <div className="flex-shrink-0 border-t border-white/[0.06] p-4 bg-[#0c0d10]">
            <div className="max-w-3xl mx-auto space-y-2">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {attachedFiles.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/40">
                      <Paperclip className="h-2.5 w-2.5" />
                      {f.name}
                      <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-0.5 hover:text-white/70 transition-colors">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe what you want to build..."
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
                className="bg-white/[0.02] border-white/[0.06] text-[14px] placeholder:text-white/20 resize-none"
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white/[0.03] rounded-lg border border-white/[0.06] p-0.5">
                    <button
                      onClick={() => setMode("fast")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${mode === "fast" ? "bg-white/[0.06] text-white/80" : "text-white/30 hover:text-white/50"}`}
                    >
                      <Zap className="h-3 w-3" />
                      Fast
                    </button>
                    <button
                      onClick={() => setMode("thinking")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors ${mode === "thinking" ? "bg-white/[0.06] text-white/80" : "text-white/30 hover:text-white/50"}`}
                    >
                      <Brain className="h-3 w-3" />
                      Thinking
                    </button>
                  </div>

                  <button className="px-2.5 py-1 rounded-lg text-[12px] text-white/30 hover:text-white/50 bg-white/[0.03] border border-white/[0.06] transition-colors" onClick={() => fileInputRef.current?.click()}>
                    Attach
                  </button>

                  <span className="text-[11px] text-white/20 hidden sm:block">{selectedModel}</span>

                  <span className="text-[11px] text-white/20">
                    {Math.max(0, usage.totalCredits - usage.usedCredits)}/{usage.totalCredits} credits
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {lastError && (
                    <button className="px-3 py-1.5 rounded-lg text-[12px] text-red-400/70 hover:text-red-400 bg-red-500/[0.05] border border-red-500/[0.1] transition-colors" onClick={handleAutoFix} disabled={isGenerating}>
                      Repair
                    </button>
                  )}
                  <button
                    onClick={() => submitPrompt()}
                    disabled={isGenerating}
                    className="px-4 py-1.5 rounded-lg text-[13px] font-medium bg-[#ccff00] text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
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
