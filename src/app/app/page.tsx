import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  History,
  KeyRound,
  Send,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import AuthControls from "../../components/auth-controls";

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

const STORAGE_KEY = "rbx-openai-key";
const PROMPTS_KEY = "rbx-recent-prompts";

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 44" fill="none" aria-hidden="true" className={className}>
      <path
        d="M18 12C11.4 12 7.2 16.8 7.2 23.7 7.2 31.6 11.9 37 18 37s10.8-5.4 10.8-13.3C28.8 16.8 24.6 12 18 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M21.5 8.2c-.7 2.3-2.3 3.9-4.6 4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20.8 7.4c2.2-2.1 4.8-2.4 6.7-1.6-1 1.9-2.8 3.2-5.1 3.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function parseSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const blockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let pointer = 0;

  for (const match of content.matchAll(blockRegex)) {
    const start = match.index ?? 0;
    if (start > pointer) {
      segments.push({ type: "text", value: content.slice(pointer, start).trim() });
    }
    segments.push({
      type: "code",
      language: match[1]?.toLowerCase() || "luau",
      value: (match[2] || "").trim(),
    });
    pointer = start + match[0].length;
  }

  const trailing = content.slice(pointer).trim();
  if (trailing) segments.push({ type: "text", value: trailing });
  return segments.length ? segments : [{ type: "text", value: content }];
}

function createSessionCode() {
  const value = Math.floor(100000 + Math.random() * 900000).toString();
  return `${value.slice(0, 3)}-${value.slice(3)}`;
}

async function requestAssistant(prompt: string, apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a Roblox Studio assistant. Return concise implementation guidance and production-ready Luau code.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "No response returned.";
}

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState("");
  const [sessionCode, setSessionCode] = useState("260-453");
  const [copyState, setCopyState] = useState<"idle" | "done">("idle");
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Apple Juice AI ready. Ask for a script, refactor, or gameplay system.\n\n```luau\n-- Example request:\n-- Build a fading door with proximity prompt\n```",
    },
  ]);

  useEffect(() => {
    const key = localStorage.getItem(STORAGE_KEY);
    const prompts = localStorage.getItem(PROMPTS_KEY);
    if (key) setApiKey(key);
    if (prompts) setRecentPrompts(JSON.parse(prompts) as string[]);
  }, []);

  const keyStatus = useMemo(() => (apiKey.trim() ? "Configured" : "Missing"), [apiKey]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(sessionCode);
    setCopyState("done");
    setTimeout(() => setCopyState("idle"), 1200);
  };

  const copyCodeBlock = async (key: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedBlock(key);
    setTimeout(() => setCopiedBlock(null), 1000);
  };

  const saveKey = () => {
    localStorage.setItem(STORAGE_KEY, apiKey.trim());
    setSettingsOpen(false);
  };

  const sendPrompt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim() || !apiKey.trim() || isLoading) return;

    const promptText = prompt.trim();
    setPrompt("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: promptText }]);
    setIsLoading(true);

    const nextPrompts = [promptText, ...recentPrompts.filter((item) => item !== promptText)].slice(0, 10);
    setRecentPrompts(nextPrompts);
    localStorage.setItem(PROMPTS_KEY, JSON.stringify(nextPrompts));

    try {
      const answer = await requestAssistant(promptText, apiKey.trim());
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: answer }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Request failed: ${error instanceof Error ? error.message : "Unknown error."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside className="h-full overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-4">
          <Link to="/" className="inline-flex items-center gap-2 px-2 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-red-700/50 bg-red-900/30 text-red-300">
              <Code2 size={13} />
            </span>
            Apple Juice
          </Link>

          <button
            onClick={() => setSettingsOpen(true)}
            className="mt-4 flex w-full items-center justify-between border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm hover:bg-zinc-900"
          >
            <span className="inline-flex items-center gap-2">
              <Settings size={14} />
              Settings
            </span>
            <span className="text-xs text-zinc-400">{keyStatus}</span>
          </button>

          <div className="mt-6">
            <p className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <History size={13} /> Recent Prompts
            </p>
            <div className="space-y-2">
              {recentPrompts.length === 0 ? (
                <p className="border border-zinc-800 px-3 py-2 text-xs text-zinc-500">No prompts yet.</p>
              ) : (
                recentPrompts.map((item) => (
                  <button
                    key={item}
                    onClick={() => setPrompt(item)}
                    className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-900"
                  >
                    {item}
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="flex h-full min-h-0 flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3 md:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Pairing Session Code</p>
              <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-red-900/70 bg-zinc-900 px-3 py-1.5 font-mono text-base text-red-300">
                {sessionCode}
                <button onClick={copyCode} className="p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" aria-label="Copy pairing code">
                  {copyState === "done" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AuthControls callbackUrl="/app" />
              <button
                onClick={() => setSessionCode(createSessionCode())}
                className="inline-flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs uppercase tracking-[0.12em] text-zinc-200 hover:border-red-800 hover:text-red-300"
              >
                <Sparkles size={13} className="text-red-400" />
                Regenerate
              </button>
              <button
                onClick={() => setSessionCode(createSessionCode())}
                className="inline-flex items-center gap-2 border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs uppercase tracking-[0.12em] text-zinc-200 hover:border-red-800 hover:text-red-300"
              >
                <Code2 size={13} className="text-red-400" />
                Pair New Session
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 md:px-6">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 pb-4">
              {messages.map((message) => (
                <div key={message.id} className={`${message.role === "user" ? "flex justify-end" : "flex justify-start"} message-enter`}>
                  <div className={message.role === "user" ? "max-w-3xl" : "max-w-4xl"}>
                    {message.role === "assistant" && (
                      <p className="mb-2 inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-red-900/70 bg-red-950/30 text-red-400">
                          <AppleGlyph className="h-3.5 w-3.5" />
                        </span>
                        Apple Juice AI
                      </p>
                    )}

                    <div
                      className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "border-zinc-700 bg-zinc-800/90 text-zinc-100"
                          : "border-zinc-800 bg-zinc-900/50 text-zinc-200"
                      }`}
                    >
                      {message.role === "user" ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <div className="space-y-3">
                          {parseSegments(message.content).map((segment, index) => {
                            if (segment.type === "text") {
                              return (
                                <p key={`${message.id}-text-${index}`} className="whitespace-pre-wrap text-zinc-200">
                                  {segment.value}
                                </p>
                              );
                            }

                            const blockKey = `${message.id}-code-${index}`;
                            return (
                              <div key={blockKey} className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
                                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
                                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-400">{segment.language || "luau"}</span>
                                   <button
                                     onClick={() => copyCodeBlock(blockKey, segment.value)}
                                     className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 hover:border-red-800 hover:text-red-200"
                                   >
                                    {copiedBlock === blockKey ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedBlock === blockKey ? "Copied" : "Copy"}
                                  </button>
                                </div>
                                <pre className="overflow-x-auto p-3 font-mono text-xs leading-6 text-zinc-200">{segment.value}</pre>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={sendPrompt} className="shrink-0 px-4 pb-4 pt-2 md:px-6 md:pb-6">
            <label htmlFor="prompt" className="sr-only">
              Prompt input
            </label>
            <div className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-700 bg-zinc-900/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-sm">
              <textarea
                id="prompt"
                rows={2}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask Apple Juice AI to generate a Luau script..."
                className="w-full resize-none bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              />
              <div className="flex items-center justify-between border-t border-zinc-800 px-2 pt-2">
                <p className="inline-flex items-center gap-2 text-xs text-zinc-500">
                  <KeyRound size={13} className="text-red-400" />
                  <span className="text-red-300/80">Add API key in Settings. Key is only stored in localStorage.</span>
                </p>
                <button
                  type="submit"
                  disabled={isLoading || !apiKey.trim()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 transition-colors hover:border-red-800 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  {isLoading ? <Sparkles size={15} className="animate-pulse" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100">Settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300">
                <X size={16} />
              </button>
            </div>

            <p className="mt-3 text-sm text-zinc-400">OpenAI API key is saved only in this browser using localStorage.</p>

            <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-zinc-500">OpenAI API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              className="mt-2 w-full border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setSettingsOpen(false)} className="border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                Cancel
              </button>
              <button onClick={saveKey} className="border border-zinc-700 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200">
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
