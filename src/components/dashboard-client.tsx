"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { Copy, LogOut, RefreshCw, Settings2, WandSparkles } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ToastContainer, useToasts } from "@/components/ui/toast";
import { ScriptCard } from "@/components/script-card";
import { ThinkingFeed, type ThinkingStep } from "@/components/thinking-feed";

type DashboardClientProps = {
  username: string;
  avatarUrl?: string;
};

type ScriptMeta = { name: string; parent: string; lineCount: number; code: string; };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  script?: ScriptMeta;
  suggestions?: string[];
};

const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"];

export function DashboardClient({ username, avatarUrl }: DashboardClientProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };
  const [pairingCode, setPairingCode] = useState("");
  const [pairToken, setPairToken] = useState("");
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const [pluginStatus, setPluginStatus] = useState("Idle. Pair your plugin using the code below.");
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingSteps]);

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

    if (effectiveKey) {
      void loadModels(effectiveKey, savedModel);
    }
  }, []);

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
      const code = (payload?.pairingCode as string) || "";
      const token = (payload?.pairToken as string) || "";
      setPairingCode(code);
      setPairToken(token);
      setPluginStatus("Pair created. Copy the token and paste it into the plugin.");
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setPluginStatus(`Pair creation failed: ${detail}`);
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
        const fallbackDefault = usedProvider === "google" ? "text-bison-001" : "gpt-4o-mini";
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

  async function submitPrompt() {
    const trimmed = prompt.trim();
    if (!trimmed || !pairingCode) {
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
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setPrompt("");
    addRecentPrompt(trimmed);
    setIsGenerating(true);
    setPluginStatus("Generating Luau and syncing it to the pairing session...");

    setThinkingSteps([{ icon: "thinking", label: "Thinking about the request...", done: false }]);
    
    // Simulate thinking steps
    const stepInterval = setInterval(() => {
      setThinkingSteps(prev => {
        if (prev.length === 1 && !prev[0].done) {
          return [{ ...prev[0], done: true }, { icon: "looking", label: "Looking at Roblox API docs...", done: false }];
        }
        if (prev.length === 2 && !prev[1].done) {
          return [prev[0], { ...prev[1], done: true }, { icon: "generating", label: "Writing Luau script...", done: false }];
        }
        return prev;
      });
    }, 1500);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          pairingCode,
          apiKey: apiKey.trim(),
          model: selectedModel,
          provider,
          openaiKey: openaiKey.trim(),
        }),
      });

      clearInterval(stepInterval);
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
        message?: string; suggestions?: string[] 
      };

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.message || "Here is the code you requested.",
          script: payload.code ? {
            name: payload.scriptName || "Script",
            parent: payload.scriptParent || "ServerScriptService",
            lineCount: payload.lineCount || payload.code.split("\\n").length,
            code: payload.code
          } : undefined,
          suggestions: payload.suggestions,
        },
      ]);
      setPluginStatus(`New code is ready from ${selectedModel}. Plugin can pull it via /api/poll.`);
      showToast("Script generated successfully!", "success");
    } catch (error) {
      clearInterval(stepInterval);
      const detail = error instanceof Error ? error.message : "Unknown error";
      setPluginStatus(`Generation failed: ${detail}`);
      showToast(`Generation failed: ${detail}`, "error");
    } finally {
      setTimeout(() => setThinkingSteps([]), 1000);
      setIsGenerating(false);
    }
  }

  async function pollPluginSession() {
    if (!pairingCode) {
      setPluginStatus("No pairing code. Create one first.");
      return;
    }

    if (!pairToken) {
      setPluginStatus("No pair token. Create pairing session and copy token to plugin.");
      return;
    }

    setPluginStatus("Checking /api/poll for plugin sync...");
    try {
      const response = await fetch(
        `/api/poll?code=${encodeURIComponent(pairingCode)}&token=${encodeURIComponent(pairToken)}`,
      );
      if (!response.ok) {
        let msg = response.statusText;
        try {
          const err = await response.json();
          msg = err?.error || msg;
        } catch {
          // ignore
        }
        throw new Error(msg || "Poll failed");
      }

      const payload = (await response.json()) as { hasNewCode?: boolean; code?: string; error?: string };

      if (payload.hasNewCode && payload.code) {
        setPluginStatus("Plugin pull successful. New script consumed from session.");
        showToast("Plugin successfully received the script!", "success");
      } else {
        setPluginStatus("No new script yet. Generate code or poll again.");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setPluginStatus(`Polling failed: ${detail}`);
      showToast("Polling failed", "error");
    }
  }

  return (
    <main className="h-screen bg-[#030303] text-white flex flex-col overflow-hidden">
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 lg:px-10 py-5">
        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-[#ccff00]">Apple Juice Dashboard</p>
          <div className="mt-2 flex items-center gap-4">
            {avatarUrl ? (
              <div className="relative h-12 w-12 rounded-full p-0.5 bg-gradient-to-br from-[#ccff00] to-emerald-400 shadow-[0_0_15px_rgba(204,255,0,0.2)]">
                <img src={avatarUrl} alt="Avatar" className="rounded-full w-full h-full object-cover bg-[#0a0c14]" />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-full bg-[#1e212b] border border-white/10 flex items-center justify-center text-lg font-bold text-[#8a8f98]">
                {username.charAt(0)}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-[#ccff00] font-bold tracking-widest uppercase text-[10px] mb-0.5">{getGreeting()}</span>
              <h1 className="text-2xl font-bold tracking-tight text-white">{username}</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowSettings((open) => !open)}>
            <Settings2 className="h-4 w-4" />
            Settings
          </Button>
          <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div className="w-full lg:w-[450px] xl:w-[500px] flex-shrink-0 border-r border-white/5 overflow-y-auto p-6 lg:p-8 space-y-6">
          {showSettings && (
            <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
              <CardContent className="p-6 space-y-5">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98] mb-1">Provider</label>
              <div className="mt-2 flex items-center gap-3">
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
                  className="w-48 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] transition-all"
                >
                  <option value="openai">OpenAI</option>
                  <option value="google">Google AI Studio</option>
                </select>
                <p className="text-sm text-[#8a8f98]">Select API provider for model calls</p>
              </div>

              <label className="mt-4 block text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98] mb-1" htmlFor="api-key-input">
                Provider API Key <span className="text-[#8a8f98] font-normal">(stored in your browser localStorage)</span>
              </label>
              <div className="mt-2 flex flex-wrap gap-3">
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
                  className="min-w-[280px] flex-1"
                />
                <Button onClick={saveApiKey}>
                  Save Key
                </Button>
                <Button
                  variant="outline"
                  onClick={() => loadModels()}
                  disabled={isLoadingModels}
                >
                  {isLoadingModels ? "Loading Models..." : "Refresh Models"}
                </Button>
              </div>

              <div className="mt-5">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98] mb-1" htmlFor="model-select">
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
                  className="mt-2 w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] transition-all"
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              </CardContent>
            </Card>
          )}

          <Card className="animate-in fade-in slide-in-from-left-4 duration-500 delay-100 fill-mode-both">
            <CardContent className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-widest font-bold text-[#8a8f98]">Pairing Session Code</p>
                <p className="mt-2 text-6xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] to-emerald-400 drop-shadow-sm">{pairingCode}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => copyText(pairingCode)}>
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={() => void createPairOnServer()}>
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-[#8a8f98]">
              Enter this code in your Studio plugin. The plugin can poll <code>/api/poll?code=...</code> and receive
              generated Luau once available.
            </p>
            {pairToken && (
              <div className="mt-5 flex items-center gap-3">
                <p className="text-sm font-medium text-[#8a8f98]">Pair Token:</p>
                <pre className="font-mono text-[13px] bg-[#050505] border border-white/5 rounded-lg px-3 py-1.5 text-[#d1d5db]">{pairToken}</pre>
                <Button variant="ghost" size="sm" onClick={() => copyText(pairToken)}>
                  Copy Token
                </Button>
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/5 pt-5">
              <Badge className="cursor-pointer hover:bg-[#ccff00]/20" onClick={pollPluginSession}>
                Simulate Plugin Poll
              </Badge>
              <p className="text-sm text-[#8a8f98]">{pluginStatus}</p>
            </div>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-left-4 duration-500 delay-200 fill-mode-both">
            <CardContent className="p-6">
            <p className="text-[11px] uppercase tracking-widest font-bold text-[#8a8f98]">Recent Prompts</p>
            {recentPrompts.length === 0 ? (
              <p className="mt-3 text-sm text-[#8a8f98]">No recent prompts yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {recentPrompts.map((item) => (
                  <Button key={item} variant="ghost" size="sm" className="text-xs text-[#8a8f98]" onClick={() => setPrompt(item)}>
                    {item.length > 64 ? `${item.slice(0, 64)}...` : item}
                  </Button>
                ))}
              </div>
            )}

            {latestCode && (
              <div className="mt-5 border-t border-white/5 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98]">Latest Script</p>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => copyText(latestCode)}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <pre className="max-h-56 overflow-auto font-mono text-[13px] bg-[#050505] border border-white/5 rounded-lg p-4 text-[#d1d5db]">
                  <code>{latestCode}</code>
                </pre>
              </div>
            )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT SIDE (CHAT) */}
        <div className="flex-1 flex flex-col h-full bg-[#050505] relative overflow-hidden">
          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="max-w-md text-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00] mb-4">
                    <WandSparkles className="h-8 w-8" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 mb-3">How can I help you build?</h2>
                  <p className="text-sm text-[#8a8f98]">
                    Write a prompt below to generate Luau code. Your responses will be stored here and can be synced directly to Studio.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <Card key={message.id} className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-300 bg-transparent border-white/5">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${message.role === 'user' ? 'bg-[#111111] text-[#8a8f98] border border-white/5' : 'bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20'}`}>
                      {message.role === "user" ? "U" : "AJ"}
                    </div>
                    {message.role !== "user" && (
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98] mb-1">
                        Apple Juice Assistant
                      </p>
                    )}
                  </div>
                  <div className="mt-5 space-y-5">
                    <p className={`whitespace-pre-wrap leading-relaxed ${message.role === 'user' ? 'text-lg text-white' : 'text-base text-white/90'}`}>
                      {message.content}
                    </p>
                    
                    {message.script && (
                      <ScriptCard script={message.script} />
                    )}

                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-6 pt-5 border-t border-white/5">
                        <p className="text-[11px] uppercase tracking-widest font-bold text-[#8a8f98] mb-3">Suggested Next Steps</p>
                        <div className="flex flex-wrap gap-2">
                          {message.suggestions.map((sugg, i) => (
                            <Button 
                              key={i} 
                              variant="outline" 
                              size="sm" 
                              className="text-xs bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                              onClick={() => setPrompt(sugg)}
                            >
                              <Sparkles className="h-3 w-3 mr-1.5 text-[#ccff00]" />
                              {sugg}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
            
            {isGenerating && <ThinkingFeed steps={thinkingSteps} />}
            <div ref={chatEndRef} className="h-px w-full" />
          </div>

          {/* Prompt Input Fixed Bottom */}
          <div className="flex-shrink-0 border-t border-white/5 p-6 bg-[#0a0a0a]">
            <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
              <p className="text-[11px] uppercase tracking-widest font-bold text-[#8a8f98]">Prompt</p>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: Create a server-side anti-speed script with logs and a warning threshold."
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitPrompt();
                  }
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-4">
                <p className="text-sm text-[#8a8f98]">Output target: raw Luau code. Model: <span className="font-medium text-white">{selectedModel}</span></p>
                <Button onClick={submitPrompt} disabled={isGenerating}>
                  <WandSparkles className="h-4 w-4" />
                  {isGenerating ? "Generating..." : "Generate Script"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
