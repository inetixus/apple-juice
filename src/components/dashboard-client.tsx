"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, LogOut, RefreshCw, Settings2, WandSparkles } from "lucide-react";
import { signOut } from "next-auth/react";

type DashboardClientProps = {
  username: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type MessageSegment = {
  type: "text" | "code";
  value: string;
  language?: string;
};

const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"];

function parseSegments(content: string): MessageSegment[] {
  const regex = /```([\w-]+)?\n([\s\S]*?)```/g;
  const segments: MessageSegment[] = [];
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        segments.push({ type: "text", value: text });
      }
    }

    segments.push({
      type: "code",
      value: (match[2] ?? "").trim(),
      language: match[1] || "luau",
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      segments.push({ type: "text", value: text });
    }
  }

  return segments.length > 0 ? segments : [{ type: "code", value: content.trim(), language: "luau" }];
}

export function DashboardClient({ username }: DashboardClientProps) {
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

      const payload = (await response.json()) as { code?: string; error?: string; detail?: string };

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.code || "-- No code generated",
        },
      ]);
      setPluginStatus(`New code is ready from ${selectedModel}. Plugin can pull it via /api/poll.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setPluginStatus(`Generation failed: ${detail}`);
    } finally {
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
      } else {
        setPluginStatus("No new script yet. Generate code or poll again.");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setPluginStatus(`Polling failed: ${detail}`);
    }
  }

  return (
    <main className="min-h-screen bg-[#030303] text-white">

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[#ccff00]">Apple Juice Dashboard</p>
            <h1 className="mt-2 text-xl font-medium tracking-tight text-white">Welcome, {username}</h1>
            <p className="mt-1 text-sm text-[#8a8f98]">Generate Luau, pair with your plugin, and sync instantly.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings((open) => !open)}
              className="inline-flex items-center gap-2 bg-transparent border border-white/10 text-white hover:bg-white/5 transition-colors rounded-lg px-4 py-2 text-sm font-medium"
            >
              <Settings2 className="h-4 w-4" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex items-center gap-2 bg-transparent border border-white/10 text-white hover:bg-white/5 transition-colors rounded-lg px-4 py-2 text-sm font-medium"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </header>

        {showSettings && (
          <section className="mt-5 bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
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
              <input
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
                className="min-w-[280px] flex-1 w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8a8f98] focus:outline-none focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] transition-all"
              />
              <button
                type="button"
                onClick={saveApiKey}
                className="bg-[#ccff00] text-black hover:bg-[#bbf000] font-semibold transition-colors rounded-lg px-4 py-2 text-sm"
              >
                Save Key
              </button>
              <button
                type="button"
                onClick={() => loadModels()}
                disabled={isLoadingModels}
                className="rounded-lg border border-white/10 bg-white/5 px-5 py-2 text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98] mb-1 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingModels ? "Loading Models..." : "Refresh Models"}
              </button>
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
          </section>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98]">Pairing Session Code</p>
                <p className="mt-2 text-4xl font-semibold tracking-widest text-white">{pairingCode}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyText(pairingCode)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98] mb-1 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => void createPairOnServer()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98] mb-1 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>
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
                <button
                  type="button"
                  onClick={() => copyText(pairToken)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98] mb-1 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Copy Token
                </button>
              </div>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/5 pt-5">
              <button
                type="button"
                onClick={pollPluginSession}
                className="flex items-center gap-1.5 text-xs font-medium text-[#ccff00] bg-[#ccff00]/10 border border-[#ccff00]/20 px-3 py-1.5 rounded-md hover:bg-[#ccff00]/20 transition-colors"
              >
                Simulate Plugin Poll
              </button>
              <p className="text-sm text-[#8a8f98]">{pluginStatus}</p>
            </div>
          </div>

          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98]">Recent Prompts</p>
            {recentPrompts.length === 0 ? (
              <p className="mt-3 text-sm text-[#8a8f98]">No recent prompts yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {recentPrompts.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPrompt(item)}
                    className="bg-transparent border border-white/10 text-[#8a8f98] hover:bg-white/5 hover:text-white transition-colors rounded-lg px-3 py-1.5 text-xs font-medium"
                  >
                    {item.length > 64 ? `${item.slice(0, 64)}...` : item}
                  </button>
                ))}
              </div>
            )}

            {latestCode && (
              <div className="mt-5 border-t border-white/5 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98]">Latest Script</p>
                  <button
                    type="button"
                    onClick={() => copyText(latestCode)}
                    className="inline-flex items-center gap-1.5 bg-transparent border border-white/10 text-white hover:bg-white/5 transition-colors rounded-md px-2 py-1 text-xs font-medium"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                </div>
                <pre className="max-h-56 overflow-auto font-mono text-[13px] bg-[#050505] border border-white/5 rounded-lg p-4 text-[#d1d5db]">
                  <code>{latestCode}</code>
                </pre>
              </div>
            )}
          </div>
        </section>

        <section className="relative mt-8 bg-[#0a0a0a] border border-white/5 rounded-xl p-6">

          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98]">Prompt</p>
          <div className="mt-4 flex flex-col gap-4">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: Create a server-side anti-speed script with logs and a warning threshold."
              rows={5}
              className="w-full resize-y bg-transparent border border-white/10 rounded-lg px-3 py-3 text-sm text-white placeholder:text-[#8a8f98] focus:outline-none focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] transition-all"
            />
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-4">
              <p className="text-sm text-[#8a8f98]">Output target: raw Luau code (no markdown). Model: <span className="font-medium text-white">{selectedModel}</span></p>
              <button
                type="button"
                onClick={submitPrompt}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 bg-[#ccff00] text-black hover:bg-[#bbf000] font-semibold transition-colors rounded-lg px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <WandSparkles className="h-4 w-4" />
                {isGenerating ? "Generating..." : "Generate Script"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 space-y-4 pb-10">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98]">Conversation</p>
          {messages.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-8 text-center text-sm text-[#8a8f98]">
              Start by writing a prompt above. Responses are stored in this thread and can be copied into Studio.
            </div>
          ) : (
            messages.map((message) => (
              <article key={message.id} className="bg-[#0a0a0a] border border-white/5 rounded-xl p-6">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${message.role === 'user' ? 'bg-[#111111] text-[#8a8f98] border border-white/5' : 'bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20'}`}>
                    {message.role === "user" ? "U" : "AJ"}
                  </div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-[#8a8f98] mb-1">
                    {message.role === "user" ? "You" : "Apple Juice Assistant"}
                  </p>
                </div>
                <div className="mt-4 space-y-4">
                  {parseSegments(message.content).map((segment, index) =>
                    segment.type === "code" ? (
                      <div key={`${message.id}-segment-${index}`} className="group relative">
                        <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#8a8f98]">
                          <span className="uppercase tracking-wider">{segment.language || "luau"}</span>
                          <button
                            type="button"
                            onClick={() => copyText(segment.value)}
                            className="inline-flex items-center gap-1.5 bg-transparent border border-white/10 text-white hover:bg-white/5 transition-colors rounded-md px-2 py-1 text-xs opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </button>
                        </div>
                        <pre className="overflow-auto font-mono text-[13px] bg-[#050505] border border-white/5 rounded-lg p-4 text-[#d1d5db]">
                          <code>{segment.value}</code>
                        </pre>
                      </div>
                    ) : (
                      <p key={`${message.id}-segment-${index}`} className="whitespace-pre-wrap text-sm leading-relaxed text-white">
                        {segment.value}
                      </p>
                    ),
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
