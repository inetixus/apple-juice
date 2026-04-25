"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { LogOut, RefreshCw, Settings2, Sparkles, Paperclip, X, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
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
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };
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
    <main className="h-screen bg-[#f1f3f4] dark:bg-[#0b0e14] text-[#3c4043] dark:text-[#e8eaed] flex flex-col overflow-hidden font-sans">
      <header className="flex-shrink-0 flex items-center justify-between gap-4 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] px-6 py-3 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-8 w-8 rounded-full border border-gray-200 dark:border-white/10" />
            ) : (
              <div className="h-8 w-8 bg-[#fbcc05] rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-black text-xs">{username.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <h1 className="text-lg font-medium tracking-tight text-[#202124] dark:text-white">Apple Juice <span className="text-gray-400 font-normal">/</span> <span className="text-gray-500 dark:text-gray-400">{username}</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5" onClick={() => setShowSettings((open) => !open)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="ghost" className="text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5" onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div className="w-[320px] lg:w-[380px] flex-shrink-0 bg-white dark:bg-[#161b22] border-r border-gray-200 dark:border-white/10 overflow-y-auto flex flex-col">
          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Connection Status</p>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${isPluginConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="font-medium text-sm">{isPluginConnected ? "Connected" : "Idle"}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-500" onClick={() => void createPairOnServer()}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 px-1">{pluginStatus}</p>
            </div>

            {gameLogs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Live Game Logs</p>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-blue-500" onClick={() => {
                    submitPrompt("Analyze these logs:\n" + gameLogs.join("\n"));
                  }}>
                    Analyze
                  </Button>
                </div>
                <div className="bg-gray-900 rounded-xl p-3 h-[200px] overflow-y-auto font-mono text-[10px] text-gray-400 border border-black shadow-inner">
                  {gameLogs.map((log, i) => (
                    <div key={i} className={log.toLowerCase().includes("error") ? "text-red-400" : ""}>{log}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}

            {latestCode && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Latest Script</p>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => copyText(latestCode)}>
                    Copy
                  </Button>
                </div>
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 overflow-hidden">
                  <pre className="p-4 text-[12px] font-mono overflow-x-auto max-h-[300px]">
                    <code>{latestCode}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#0b0e14] relative overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
            <div className="max-w-4xl mx-auto w-full space-y-8">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center py-20">
                <div className="text-center space-y-4 max-w-sm">
                  <div className="h-16 w-16 bg-[#fbcc05]/10 text-[#fbcc05] rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">How can I help you build?</h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">Describe a script or a feature you want to add to your Roblox game.</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl ${
                    message.role === 'user' 
                      ? 'bg-[#fbcc05] text-white shadow-sm rounded-br-sm' 
                      : 'bg-[#f1f3f4] dark:bg-[#1d2127] text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-white/5 rounded-bl-sm'
                  }`}>
                    <div className="space-y-4">
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {message.attachments.map((a, i) => (
                            <span key={i} className="text-[10px] bg-white/20 px-2 py-1 rounded-md flex items-center gap-1">
                              <Paperclip className="h-2.5 w-2.5" />
                              {a.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      
                      {message.thinking && (
                        <details className="mt-4 border-t border-black/5 dark:border-white/5 pt-4">
                          <summary className="text-[11px] font-bold uppercase tracking-wider text-gray-400 cursor-pointer hover:text-gray-600 transition-colors">Internal Reasoning</summary>
                          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-mono italic leading-relaxed">
                            {message.thinking}
                          </div>
                        </details>
                      )}

                      {(message.script || (message.scripts && message.scripts.length > 0)) && (
                        <div className="mt-4 space-y-3">
                          {message.script && <ScriptCard script={message.script} />}
                          {message.scripts?.map((s, i) => <ScriptCard key={i} script={s} />)}
                        </div>
                      )}

                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-6 flex flex-wrap gap-2 border-t border-black/5 dark:border-white/5 pt-4">
                          {message.suggestions.map((s, i) => (
                            <button 
                              key={i} 
                              onClick={() => setPrompt(s)}
                              className="text-[11px] bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 border border-black/5 dark:border-white/10 px-3 py-1.5 rounded-full transition-all text-gray-600 dark:text-gray-300"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isGenerating && <ThinkingFeed steps={thinkingSteps} />}
            <div ref={chatEndRef} />
            </div>
          </div>

          {/* Prompt Input Fixed Bottom */}
          {/* INPUT AREA */}
          <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-[#161b22]">
            <div className="max-w-4xl mx-auto">
              <div className="relative bg-[#f8fafc] dark:bg-[#0b0e14] border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-[#fbcc05]/20 focus-within:border-[#fbcc05] transition-all overflow-hidden">
                {attachedFiles.length > 0 && (
                  <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-gray-100 dark:border-white/5">
                    {attachedFiles.map((f, i) => (
                      <span key={i} className="text-[10px] bg-gray-200 dark:bg-white/10 px-2 py-1 rounded flex items-center gap-2">
                        {f.name}
                        <button onClick={() => setAttachedFiles(p => p.filter((_, idx) => idx !== i))} className="hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask for a Roblox script..."
                  className="w-full bg-transparent border-none focus:ring-0 min-h-[100px] p-4 text-[15px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitPrompt();
                    }
                  }}
                />
                <div className="px-4 py-3 flex items-center justify-between bg-white/50 dark:bg-black/10 border-t border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-8 text-[11px]" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="h-3.5 w-3.5 mr-1.5" />
                      Attach
                    </Button>
                    <div className="h-4 w-px bg-gray-200 dark:bg-white/10 mx-1" />
                    <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-lg">
                      <button onClick={() => setMode("fast")} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${mode === "fast" ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white" : "text-gray-400"}`}>FAST</button>
                      <button onClick={() => setMode("thinking")} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${mode === "thinking" ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white" : "text-gray-400"}`}>THINKING</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="text-[11px] font-black text-gray-900 dark:text-white">
                        {Math.max(0, usage.totalCredits - usage.usedCredits)} <span className="text-gray-400">/ {usage.totalCredits}</span>
                      </span>
                      <div className="w-16 h-1 bg-gray-100 dark:bg-white/10 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-[#fbcc05]" style={{ width: `${Math.max(0, Math.min(100, ((usage.totalCredits - usage.usedCredits) / usage.totalCredits) * 100))}%` }} />
                      </div>
                    </div>
                    <Button 
                      onClick={() => submitPrompt()} 
                      disabled={isGenerating || !prompt.trim()} 
                      className="bg-[#fbcc05] hover:bg-[#e6b800] text-white font-bold px-6"
                    >
                      {isGenerating ? "..." : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold">Dashboard Settings</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">AI Provider</label>
                <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
                  <button 
                    onClick={() => {
                      setProvider("openai");
                      const k = window.localStorage.getItem("apple-juice-openai-key") || "";
                      setOpenaiKey(k);
                      setApiKey(k);
                    }} 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${provider === "openai" ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white" : "text-gray-400"}`}
                  >
                    OpenAI
                  </button>
                  <button 
                    onClick={() => {
                      setProvider("google");
                      const k = window.localStorage.getItem("apple-juice-google-key") || "";
                      setGoogleKey(k);
                      setApiKey(k);
                    }} 
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${provider === "google" ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white" : "text-gray-400"}`}
                  >
                    Google Gemini
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">API Key</label>
                <div className="flex gap-2">
                  <Input 
                    type="password"
                    value={provider === "google" ? googleKey : openaiKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (provider === "google") setGoogleKey(v);
                      else setOpenaiKey(v);
                    }}
                    placeholder={provider === "google" ? "Paste Google API Key..." : "sk-..."}
                    className="flex-1 bg-gray-50 dark:bg-black/20 border-gray-100 dark:border-white/5"
                  />
                  <Button onClick={saveApiKey} className="bg-blue-600 hover:bg-blue-700 text-white">Save</Button>
                </div>
                <p className="text-[10px] text-gray-400 italic">Keys are stored locally in your browser.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Model Selection</label>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-500" onClick={() => loadModels()} disabled={isLoadingModels}>
                    {isLoadingModels ? "..." : "Refresh List"}
                  </Button>
                </div>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedModel(v);
                    window.localStorage.setItem("apple-juice-model", v);
                  }}
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                <Button variant="outline" className="w-full text-red-500 border-red-500/10 hover:bg-red-500/5" onClick={() => { setMessages([]); window.localStorage.removeItem("apple-juice-chat-history"); setShowSettings(false); }}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Chat History
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
