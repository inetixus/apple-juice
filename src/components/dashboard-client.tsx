"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { Paperclip, Zap, Brain, X, Search, Share2, Sparkles, Network, Trash2, LayoutDashboard } from "lucide-react";
import { signOut } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const [autoSync, setAutoSync] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Feature: Asset search
  const [assetQuery, setAssetQuery] = useState("");
  const [assetResults, setAssetResults] = useState<{ id: number; name: string; creator: string; thumbnail: string }[]>([]);
  const [showAssetSearch, setShowAssetSearch] = useState(false);
  const [isSearchingAssets, setIsSearchingAssets] = useState(false);
  const [attachedAsset, setAttachedAsset] = useState<{ id: number; name: string; thumbnail: string } | null>(null);
  // Feature: Live Share

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
  const [atMenu, setAtMenu] = useState<{ visible: boolean; x: number; y: number; filter: string; selectionIndex: number }>({
    visible: false,
    x: 0,
    y: 0,
    filter: "",
    selectionIndex: 0
  });

  const playSound = (_type?: 'pop' | 'glass' | 'error' | 'whoosh' | 'success') => {
    // Sounds disabled as per user request
  };

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
              playSound('glass');
            } else if (data.hasNewCode) {
              codeConsumedRef.current = true;
            }

            if (data.tree) {
              const lines = (data.tree as string).split('\n').map(l => l.trim()).filter(l => l.length > 0);
              const newTree = Array.from(new Set(lines));
              if (newTree.length > 0) {
                setProjectTree(prev => {
                  if (JSON.stringify(prev) === JSON.stringify(newTree)) return prev;
                  return newTree;
                });
              }
            }

            if (data.fileResponse && data.fileResponse.name) {
              setAttachedFiles(prev => {
                if (prev.some(f => f.name === data.fileResponse.name)) return prev;
                showToast(`Attached ${data.fileResponse.name}`, "success");
                playSound('pop');
                return [...prev, data.fileResponse];
              });
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
              setGameLogs(prev => [...prev, ...data.logs].slice(-200));

              // Detect structured test results from the plugin
              for (const log of data.logs as string[]) {
                // Test passed
                if (log.includes("[APPLE_JUICE_TEST_PASS]")) {
                  try {
                    const jsonStr = log.replace("[APPLE_JUICE_TEST_PASS]", "").trim();
                    const result = jsonStr ? JSON.parse(jsonStr) : {};
                    const dur = result.duration ? ` in ${result.duration.toFixed(1)}s` : "";
                    setPluginStatus(`Playtest passed${dur}! No errors found.`);
                  } catch {
                    setPluginStatus("Playtest passed! No errors found.");
                  }
                  showToast("Playtest passed with no errors!", "success");
                  autoFixRetriesRef.current = 0;
                }

                // Test failed — parse structured result and build comprehensive fix prompt
                if (log.includes("[APPLE_JUICE_TEST_FAIL]")) {
                  let testResult: any = null;
                  let rawErrorText = "";
                  try {
                    const jsonStr = log.replace("[APPLE_JUICE_TEST_FAIL]", "").trim();
                    testResult = JSON.parse(jsonStr);
                  } catch {
                    rawErrorText = log.replace("[APPLE_JUICE_TEST_FAIL]", "").trim();
                  }

                  const errorCount = testResult?.errorCount || 1;
                  const displayError = testResult
                    ? testResult.errors?.map((e: any) => `[${e.scriptName}:${e.lineNumber}] ${e.errorText}`).join("\n")
                    : rawErrorText;
                  setLastError(displayError);
                  lastReportedErrorRef.current = displayError;

                  if (autoFixRetriesRef.current < MAX_AUTO_FIX_RETRIES && !isGenerating) {
                    autoFixRetriesRef.current += 1;
                    const attempt = autoFixRetriesRef.current;
                    setPluginStatus(`Auto-fixing ${errorCount} error(s) (attempt ${attempt}/${MAX_AUTO_FIX_RETRIES})...`);
                    showToast(`Auto-fix attempt ${attempt}/${MAX_AUTO_FIX_RETRIES}...`, "info");

                    if (autoFixTimerRef.current) clearTimeout(autoFixTimerRef.current);
                    autoFixTimerRef.current = setTimeout(() => {
                      // Build comprehensive fix prompt with full code context
                      let fixPrompt = `The following scripts were generated and synced to Roblox Studio, but the playtest FAILED with errors.\n\n`;

                      // Include full source code of all generated scripts
                      const scripts = lastGeneratedScriptsRef.current;
                      if (scripts.length > 0) {
                        fixPrompt += `=== GENERATED SCRIPTS ===\n`;
                        for (const s of scripts) {
                          fixPrompt += `--- ${s.type}: ${s.name} (in ${s.parent}) ---\n${s.code}\n--- END ${s.name} ---\n\n`;
                        }
                      }

                      // Include detailed error info
                      fixPrompt += `=== PLAYTEST ERRORS (${errorCount} total) ===\n`;
                      if (testResult?.errors) {
                        for (const err of testResult.errors) {
                          fixPrompt += `[${err.scriptPath || err.scriptName}:${err.lineNumber}] ${err.errorText}\n`;
                        }
                      } else {
                        fixPrompt += rawErrorText + "\n";
                      }

                      // Include warnings if any
                      if (testResult?.warnings?.length > 0) {
                        fixPrompt += `\n=== WARNINGS ===\n${testResult.warnings.join("\n")}\n`;
                      }

                      fixPrompt += `\n=== INSTRUCTIONS ===\n`;
                      fixPrompt += `Fix ALL errors above. This is auto-fix attempt ${attempt} of ${MAX_AUTO_FIX_RETRIES}.\n`;
                      fixPrompt += `Requirements:\n`;
                      fixPrompt += `1. Output the COMPLETE corrected script(s), not just the changed lines\n`;
                      fixPrompt += `2. Ensure all variables are defined before use\n`;
                      fixPrompt += `3. Ensure all services are accessed via game:GetService()\n`;
                      fixPrompt += `4. Respect the server/client boundary (no client APIs in server scripts)\n`;
                      fixPrompt += `5. Keep the same script name(s) and parent location(s) so they overwrite the broken version\n`;

                      submitPrompt(fixPrompt, true);
                    }, 2000);
                  } else if (autoFixRetriesRef.current >= MAX_AUTO_FIX_RETRIES) {
                    setPluginStatus(`Auto-fix failed after ${MAX_AUTO_FIX_RETRIES} attempts. Use the Repair button to try manually.`);
                    showToast(`Auto-fix exhausted ${MAX_AUTO_FIX_RETRIES} retries. Fix manually or try a different approach.`, "error");
                    playSound('error');
                  }
                }

                // Test skipped (already in run mode)
                if (log.includes("[APPLE_JUICE_TEST_SKIP]")) {
                  setPluginStatus("Playtest skipped (Studio already in run mode).");
                }
              }

              // Track non-test errors for the manual Repair button
              const newErrorLog = data.logs.find((log: string) => !log.includes("[APPLE_JUICE_") && (log.toLowerCase().includes("error") || log.toLowerCase().includes("exception")));
              if (newErrorLog && newErrorLog !== lastReportedErrorRef.current) {
                lastReportedErrorRef.current = newErrorLog;
                setLastError(newErrorLog);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }, 800);
    return () => clearInterval(interval);
  }, [sessionKey, showToast]);



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
      setPluginStatus("Session created. Your plugin will auto-connect via IP, or use the key below.");
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

  const handleRedeemCode = async () => {
    if (!secretCode.trim() || !sessionKey) return;
    setIsRedeeming(true);
    try {
      const res = await fetch("/api/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: secretCode, sessionKey })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, "success");
        setSecretCode("");
        void fetchUsage(); // Refresh credit count
      } else {
        showToast(data.error || "Invalid code", "error");
      }
    } catch (e) {
      showToast("Failed to redeem code", "error");
    } finally {
      setIsRedeeming(false);
    }
  };

  function addRecentPrompt(value: string) {
    const next = [value, ...recentPrompts.filter((item) => item !== value)].slice(0, 6);
    setRecentPrompts(next);
    window.localStorage.setItem("apple-juice-recent-prompts", JSON.stringify(next));
  }

  async function submitPrompt(overridePrompt?: string | any, isHidden: boolean = false) {
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
      attachedAsset: attachedAsset || undefined,
      isHidden,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setPrompt("");
    setLastError(null);
    addRecentPrompt(trimmed);
    setIsGenerating(true);
    playSound('whoosh');
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
          prompt: attachedAsset
            ? `[System Note: The user has attached the Roblox asset "${attachedAsset.name}" (ID: ${attachedAsset.id}) to this message. Please fulfill their request, using this asset if appropriate. If they don't specify what to do with it, insert it into Workspace.]\n\n${trimmed}`
            : trimmed,
          messages: newMessages.map(m => ({
            role: m.role,
            content: m.attachedAsset
              ? `[System Note: Attached Asset "${m.attachedAsset.name}" (ID: ${m.attachedAsset.id})]\n${m.content}`
              : m.content
          })),
          sessionKey,
          apiKey: apiKey.trim(),
          model: selectedModel,
          provider,
          openaiKey: openaiKey.trim(),
          mode,
          fileContents: attachedFiles.length > 0 ? attachedFiles : undefined,
          autoSync,
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
        } catch (err: any) {
          console.error("AI Error:", err);
          setLastError(err.message || "Failed to generate code.");
          playSound('error');
        }
        throw new Error(errText || "Failed to generate code");
      }

      const payload = (await response.json()) as {
        code?: string; error?: string; detail?: string;
        scriptName?: string; scriptParent?: string; lineCount?: number;
        scriptType?: string; action?: "create" | "delete";
        message?: string; suggestions?: string[];
        scripts?: { name: string; parent: string; type: string; action: string; lineCount: number; code: string; requires?: string[] }[];
        thinking?: string;
      };

      const payloadFiles = [...attachedFiles];
      setAttachedFiles([]);
      setAttachedAsset(null);

      function buildAssistantMessage(p: typeof payload, files: { name: string; content: string }[], pendingSync: boolean, isHidden: boolean = false): ChatMessage {
        return {
          id: crypto.randomUUID(),
          role: "assistant",
          content: p.message || "Here is the code you requested.",
          isHidden,
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
            originalCode: files.find((f) => f.name === s.name || f.name === s.name + ".lua")?.content,
            requires: s.requires
          })),
          suggestions: p.suggestions,
          thinking: p.thinking,
          pendingSync,
        };
      }

      if (autoSync) {
        setPluginStatus(`Script synced to Studio. Running playtest...`);
        showToast("Script generated and synced!", "success");
        playSound('success');
        setIsGenerating(false);
        setMessages((current) => [...current, buildAssistantMessage(payload, payloadFiles, false, isHidden)]);
        setThinkingSteps([]);
        // Reset auto-fix retries for this new generation
        autoFixRetriesRef.current = 0;
        // Store the generated scripts for auto-fix context
        if (payload.scripts && Array.isArray(payload.scripts)) {
          lastGeneratedScriptsRef.current = payload.scripts.map((s: any) => ({
            name: s.name || "Unknown",
            parent: s.parent || "ServerScriptService",
            type: s.type || "Script",
            code: s.code || "",
          }));
        } else if (payload.code) {
          lastGeneratedScriptsRef.current = [{
            name: payload.scriptName || "AIScript",
            parent: payload.scriptParent || "ServerScriptService",
            type: payload.scriptType || "Script",
            code: payload.code || "",
          }];
        }
        void fetchUsage();
      } else {
        setPluginStatus("Code generated. Review changes before syncing.");
        setIsGenerating(false);
        setMessages((current) => [...current, buildAssistantMessage(payload, payloadFiles, true, isHidden)]);
        setThinkingSteps([]);
        void fetchUsage();
      }

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
      playSound('error');
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

  // Feature: Asset Search
  const searchAssets = useCallback(async () => {
    if (!assetQuery.trim()) return;
    setIsSearchingAssets(true);
    try {
      const res = await fetch(`/api/search-assets?q=${encodeURIComponent(assetQuery)}&category=Models`);
      if (res.ok) {
        const data = await res.json();
        setAssetResults(data.results || []);
      }
    } catch { /* ignore */ } finally {
      setIsSearchingAssets(false);
    }
  }, [assetQuery]);

  // Feature: Copy share link
  const copyShareLink = useCallback(() => {
    if (!sessionKey) return;
    const url = `${window.location.origin}/dashboard?join=${sessionKey}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast("Share link copied! Others can join your session.", "success");
    }).catch(() => { });
  }, [sessionKey, showToast]);

  // Feature: Insert instance from Explorer tree
  const handleRename = useCallback(async (path: string, newName: string) => {
    if (!sessionKey) return;
    try {
      await fetch("/api/insert-instance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionKey,
          payload: { action: "rename_instance", oldPath: path, newName }
        }),
      });
      // Give the plugin a brief moment to process before the tree updates
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error("Rename error:", err);
    }
  }, [sessionKey]);

  const handleDelete = useCallback(async (path: string, name: string) => {
    if (!sessionKey) return;
    try {
      const parts = path.split(".");
      const parent = parts.slice(0, -1).join(".") || "Workspace";
      await fetch("/api/insert-instance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionKey,
          payload: { action: "delete", parent, name }
        }),
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error("Delete error:", err);
    }
  }, [sessionKey]);

  const handleAddInstance = useCallback(async (parentPath: string, className: string, name: string) => {
    if (!sessionKey) {
      showToast("No active session. Connect your plugin first.", "error");
      return;
    }

    const isScript = ["Script", "LocalScript", "ModuleScript"].includes(className);

    const payload = isScript
      ? { parent: parentPath, name, type: className, action: "create", code: `-- ${className}: ${name}\n` }
      : { parent: parentPath, action: "create_instance", className, instanceName: name };

    try {
      const res = await fetch("/api/insert-instance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, payload }),
      });
      if (res.ok) {
        showToast(`Inserted ${className} "${name}" into ${parentPath}`, "success");
      } else {
        showToast(`Failed to insert ${className}`, "error");
      }
    } catch {
      showToast(`Failed to insert ${className}`, "error");
    }
  }, [sessionKey, showToast]);

  return (
    <main className="h-screen bg-[#24262b] text-white flex overflow-hidden font-sans">
      {/* SIDEBAR */}
      <div className="w-[220px] flex-shrink-0 border-r border-white/[0.04] bg-[#1e1f24] flex flex-col justify-between relative z-40">
        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-[#ccff00] shadow-[0_0_10px_rgba(204,255,0,0.2)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-black" fill="currentColor">
                <path d="M5.2 6.5L7.5 3h9l2.3 3.5H5.2z" fillOpacity="0.8" />
                <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5z" />
                <path d="M15 3V1.5A1.5 1.5 0 0 0 13.5 0H12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-tight text-lg leading-none">Apple Juice</span>
              <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/50 uppercase tracking-widest font-bold leading-none mt-0.5">pre-beta</span>
            </div>
          </div>

          <button
            onClick={() => {
              const name = window.prompt("Enter project name:", "New Project");
              if (name) {
                setProjectName(name);
                setMessages([]);
                window.localStorage.removeItem("apple-juice-chat-history");
              }
            }}
            className="w-full bg-white text-black font-semibold py-2 rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 text-[13px] shadow-sm"
          >
            + New Project
          </button>

          <div>
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest block mb-3">Projects</span>
            <div className="text-sm text-white/90 cursor-pointer py-1.5 flex items-center gap-2 bg-white/5 px-3 -mx-3 rounded-lg truncate">
              {projectName}
            </div>
          </div>

          {/* Settings removed from sidebar per user request */}

          {/* Plugin Status Summary */}
          <div className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`relative flex h-2 w-2`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${isPluginConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isPluginConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </span>
              <span className="text-[11px] font-medium text-white/80">
                {isPluginConnected ? "Connected" : "Waiting"}
              </span>
            </div>
            <p className="text-[10px] text-white/40 leading-snug truncate" title={pluginStatus}>{pluginStatus}</p>
          </div>

          {/* Share Session */}
          {sessionKey && (
            <button
              onClick={copyShareLink}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04] text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all"
            >
              <Share2 className="h-3 w-3" />
              <span>Share Session</span>
              <span className="ml-auto text-[9px] font-mono text-white/20 truncate max-w-[80px]">{sessionKey.slice(0, 8)}…</span>
            </button>
          )}

          {/* Roblox Explorer Tree */}
          {projectTree.length > 0 && (
            <div className="overflow-y-auto overflow-x-hidden custom-scrollbar -mx-5 px-0" style={{ maxHeight: "calc(100vh - 380px)" }}>
              <WorkspaceTree 
                paths={projectTree} 
                onAddInstance={handleAddInstance} 
                onRename={handleRename}
                onDelete={handleDelete}
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/[0.04] space-y-2">
          {/* Asset Search Button */}
          <button
            onClick={() => setShowAssetSearch(!showAssetSearch)}
            className="w-full bg-white/[0.03] border border-white/[0.04] text-white/70 hover:text-white py-2 rounded-xl flex items-center justify-between px-4 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-[#ccff00]/60" />
              <span className="text-[12px] font-semibold">Toolbox Search</span>
            </div>
            <span className="text-white/30">&rsaquo;</span>
          </button>
          <button className="w-full bg-white/[0.03] border border-white/[0.04] text-white/70 hover:text-white py-2.5 rounded-xl flex items-center justify-between px-4 transition-colors">
            <div className="flex flex-col items-start">
              <span className="text-[13px] font-semibold">Discord</span>
              <span className="text-[10px] text-white/40">Join for gifts</span>
            </div>
            <span className="text-white/30">&rsaquo;</span>
          </button>
          <button className="w-full text-white/30 hover:text-white py-1.5 rounded-lg text-[11px] transition-colors" onClick={() => signOut({ callbackUrl: "/" })}>
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full bg-[#1c1d21] relative overflow-hidden">
        {/* Top Right Header */}
        <header className="absolute top-0 right-0 p-6 flex items-center gap-4 z-50 pointer-events-none w-full justify-end">
          <div className="pointer-events-auto flex items-center gap-4">
            <div className="bg-[#10b981] text-white font-bold px-4 py-2 rounded-full text-xs shadow-lg shadow-[#10b981]/20 cursor-pointer hover:bg-[#0ea5e9] hover:shadow-[#0ea5e9]/20 transition-all">
              Store Purchases
            </div>
            {/* Profile avatar with dropdown */}
            <div className="relative">
              <button onClick={() => setShowProfileMenu(p => !p)} className="focus:outline-none flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} className="w-8 h-8 rounded-full ring-2 ring-white/10 hover:ring-[#ccff00]/40 transition-all cursor-pointer object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold ring-2 ring-white/10 hover:ring-[#ccff00]/40 transition-all cursor-pointer">{username.charAt(0)}</div>
                )}
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-11 w-48 bg-[#111113] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-[100]">
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-semibold text-white truncate">{username}</p>
                    <p className="text-[10px] text-white/30">Roblox Developer</p>
                  </div>
                  <button
                    onClick={() => { setShowProfileMenu(false); setShowSettings(s => !s); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                    Settings
                  </button>
                  <button
                    onClick={() => { setShowDebug(d => !d); setShowProfileMenu(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${showDebug ? 'text-[#ccff00] bg-[#ccff00]/5' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  >
                    <Network className="h-3.5 w-3.5" />
                    {showDebug ? "Hide Auto-Fix Logs" : "Show Auto-Fix Logs"}
                  </button>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors flex items-center gap-2 border-t border-white/5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Chat Area */}
        <div className="flex-1 overflow-y-auto relative z-10 flex flex-col w-full items-center">
          {messages.length == 0 && (
            /* EMPTY STATE BACKGROUND */
            <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-0">
              <div className="relative w-full max-w-5xl h-[600px] flex items-center justify-center">
                <div className="absolute top-[15%] left-[5%] w-48 h-32 bg-[#2a2c33]/80 rounded-xl opacity-40 rotate-[-8deg] blur-[2px] shadow-2xl overflow-hidden border border-white/5">
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 mix-blend-overlay"></div>
                </div>
                <div className="absolute top-[20%] right-[10%] w-56 h-36 bg-[#2a2c33]/80 rounded-xl opacity-50 rotate-[6deg] blur-[1px] shadow-2xl overflow-hidden border border-white/5">
                  <div className="w-full h-full bg-gradient-to-bl from-[#ccff00]/10 to-transparent mix-blend-overlay"></div>
                </div>
                <div className="absolute bottom-[20%] left-[15%] w-40 h-28 bg-[#2a2c33]/80 rounded-xl opacity-30 rotate-[12deg] blur-[3px] shadow-2xl overflow-hidden border border-white/5">
                  <div className="w-full h-full bg-gradient-to-tr from-sky-500/10 to-transparent mix-blend-overlay"></div>
                </div>
                <div className="absolute bottom-[15%] right-[20%] w-64 h-40 bg-[#2a2c33]/80 rounded-xl opacity-60 rotate-[-4deg] shadow-2xl overflow-hidden border border-white/5">
                  <div className="w-full h-full bg-gradient-to-tl from-emerald-500/10 to-transparent mix-blend-overlay"></div>
                </div>
              </div>
            </div>
          )}

          {messages.length > 0 && (
            /* CHAT MESSAGES */
            <div className="flex-1 flex flex-col pt-24 pb-56 px-4 md:px-10 lg:px-20 max-w-5xl w-full">
              <div className="space-y-4">
                {messages.filter(m => showDebug || !m.isHidden).map((message) => (
                  <div key={message.id} className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${message.role == 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[72%] px-4 py-3.5 rounded-2xl text-[14px] leading-relaxed ${message.role == 'user'
                        ? 'bg-white/[0.08] text-white border border-white/[0.12] rounded-br-sm'
                        : 'bg-transparent text-white border border-white/[0.07] rounded-bl-sm bg-gradient-to-b from-white/[0.03] to-white/[0.01] shadow-lg'
                      }`}>
                      {message.isHidden && (
                        <div className="mb-2 px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-[9px] text-violet-300 uppercase font-bold tracking-widest flex items-center gap-1.5 self-start">
                          <div className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
                          Background Auto-Fix Loop
                        </div>
                      )}
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

                        {message.attachedAsset && (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-purple-500/20 text-[11px] text-white/90 shadow-sm shadow-purple-500/5 mb-2">
                            <img src={message.attachedAsset.thumbnail} className="w-5 h-5 rounded object-cover" />
                            <span className="truncate max-w-[150px]">{message.attachedAsset.name}</span>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap leading-relaxed text-white/90">
                          {message.content}
                        </p>

                        {message.thinking && (
                          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-500">
                            <details className="group bg-gradient-to-br from-violet-500/[0.05] to-fuchsia-500/[0.05] border border-violet-500/10 rounded-2xl overflow-hidden shadow-lg shadow-violet-500/5">
                              <summary className="cursor-pointer text-[12px] font-bold text-violet-300/80 hover:text-violet-200 hover:bg-violet-500/10 transition-all flex items-center justify-between px-4 py-3 select-none list-none [&::-webkit-details-marker]:hidden group-open:border-b border-violet-500/10">
                                <div className="flex items-center gap-3">
                                  <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 group-open:animate-pulse">
                                    <Brain className="h-4 w-4" />
                                  </div>
                                  <span className="tracking-wide uppercase text-[10px]">Reasoning</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-mono opacity-40 uppercase">
                                    {message.thinking.length > 500 ? "Deep Analysis" : "Detailed"}
                                  </span>
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-violet-500/10 group-open:rotate-180 transition-transform duration-300">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-violet-400/60" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M1 1L5 5L9 1" />
                                    </svg>
                                  </div>
                                </div>
                              </summary>
                              <div className="p-5 text-[13px] leading-relaxed text-white/60 whitespace-pre-wrap bg-black/40 font-medium selection:bg-violet-500/30 selection:text-white backdrop-blur-md">
                                {message.thinking}
                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/20 italic">
                                  <Sparkles className="h-3 w-3" />
                                  <span>Reasoning generated by Advanced Apple Juice Logic</span>
                                </div>
                              </div>
                            </details>
                          </div>
                        )}

                        {message.script && (
                          <ScriptCard script={message.script} />
                        )}

                        {message.scripts && message.scripts.length > 0 && (
                          <div className="space-y-2 w-full max-w-[500px]">
                            {message.scripts.length > 1 && <SystemArchitecture scripts={message.scripts} />}
                            <p className="text-[11px] font-medium text-white/20 tracking-tight uppercase ml-1">{message.scripts.length} instances created</p>
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

                        {message.pendingSync && (
                          <div className="mt-4 pt-3 border-t border-[#ccff00]/20 flex justify-end">
                            <button
                              className="bg-[#ccff00] text-black font-bold px-5 py-2 rounded-lg text-[13px] shadow-[0_0_15px_rgba(204,255,0,0.3)] hover:bg-[#d4ff33] transition-all"
                              onClick={async () => {
                                showToast("Accepting changes...", "info");
                                const res = await fetch("/api/accept-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionKey }) });
                                if (res.ok) {
                                  showToast("Changes sent to Roblox Studio!", "success");
                                  setMessages(msgs => msgs.map(m => m.id === message.id ? { ...m, pendingSync: false } : m));
                                } else {
                                  showToast("Failed to sync code.", "error");
                                }
                              }}
                            >
                              Accept & Sync to Studio
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {isGenerating && <ThinkingFeed steps={thinkingSteps} />}
              <div ref={chatEndRef} className="h-px w-full mt-4" />
            </div>
          )}
        </div>

        {/* The Universal Input Bar wrapper */}
        <div className={`transition-all duration-700 ease-in-out ${messages.length == 0 ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl px-4 z-30 bg-transparent" : "absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#1c1d21] via-[#1c1d21] to-transparent pt-12 pb-6 px-4 flex justify-center z-20"}`}>

          <div className="w-full flex flex-col items-center">
            {messages.length == 0 && (
              <div className="text-center mb-6">
                <h1 className="text-[32px] md:text-[42px] font-medium tracking-tight text-white drop-shadow-xl leading-tight">
                  Describe a <span className="font-serif italic text-white/80">game mechanic...</span>
                </h1>
              </div>
            )}

            <div className={`w-full ${messages.length == 0 ? "bg-[#2b2d31]/90 backdrop-blur-xl shadow-2xl" : "max-w-4xl bg-[#26282d]"} border border-white/[0.05] rounded-2xl p-3`}>
              <div className="w-full space-y-3">
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {attachedAsset && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.06] border border-purple-500/30 text-[11px] text-white/90 shadow-sm shadow-purple-500/10">
                        <img src={attachedAsset.thumbnail} className="w-4 h-4 rounded-sm object-cover" />
                        <span className="truncate max-w-[120px]">{attachedAsset.name}</span>
                        <button onClick={() => setAttachedAsset(null)} className="ml-0.5 text-white/40 hover:text-white transition-colors">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {attachedFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.12] text-[11px] text-white/80">
                        <Paperclip className="h-2.5 w-2.5" />
                        {f.name}
                        <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx != i))} className="ml-0.5 hover:text-white transition-colors">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative group/input">
                  <Textarea
                    value={prompt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPrompt(val);

                      const selectionStart = e.target.selectionStart;
                      const textBeforeCursor = val.slice(0, selectionStart);
                      const lastAt = textBeforeCursor.lastIndexOf('@');

                      if (lastAt != -1 && (lastAt == 0 || textBeforeCursor[lastAt - 1] == ' ')) {
                        const filter = textBeforeCursor.slice(lastAt + 1);
                        if (!filter.includes(' ')) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setAtMenu({
                            visible: true,
                            x: rect.left,
                            y: rect.top - 120,
                            filter,
                            selectionIndex: 0
                          });
                          return;
                        }
                      }
                      setAtMenu(prev => ({ ...prev, visible: false }));
                    }}
                    onKeyDown={(e) => {
                      if (atMenu.visible) {
                        const filtered = projectTree.filter(f => f.toLowerCase().includes(atMenu.filter.toLowerCase()));
                        if (e.key == "ArrowDown") {
                          e.preventDefault();
                          setAtMenu(prev => ({ ...prev, selectionIndex: (prev.selectionIndex + 1) % filtered.length }));
                        } else if (e.key == "ArrowUp") {
                          e.preventDefault();
                          setAtMenu(prev => ({ ...prev, selectionIndex: (prev.selectionIndex - 1 + filtered.length) % filtered.length }));
                        } else if (e.key == "Enter" || e.key == "Tab") {
                          e.preventDefault();
                          const selected = filtered[atMenu.selectionIndex];
                          if (selected) {
                            const textBeforeAt = prompt.slice(0, prompt.lastIndexOf('@'));
                            const textAfterAt = prompt.slice(e.currentTarget.selectionStart);
                            setPrompt(textBeforeAt + "@" + selected + " " + textAfterAt);
                            setAtMenu(prev => ({ ...prev, visible: false }));

                            fetch('/api/request-file', {
                              method: 'POST',
                              body: JSON.stringify({ key: sessionKey, fileName: selected })
                            }).catch(() => { });
                          }
                        } else if (e.key == "Escape") {
                          setAtMenu(prev => ({ ...prev, visible: false }));
                        }
                      } else if (e.key == "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitPrompt();
                      }
                    }}
                    placeholder={!isPluginConnected ? "Connect your Roblox Studio plugin to start building..." : (prompt == "" && messages.length == 0 ? placeholderText : "Ask the AI to build something... (use @ to mention a script)")}
                    className="min-h-[70px] max-h-[250px] w-full resize-none bg-transparent border-transparent px-2 pt-2 text-[15px] text-white placeholder:text-white/30 focus-visible:ring-0 focus:outline-none rounded-none"
                    disabled={!isPluginConnected || isGenerating}
                  />

                  {atMenu.visible && (
                    <div
                      className="fixed z-[200] w-64 bg-[#111113] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                      style={{ left: atMenu.x, top: atMenu.y - (Math.min(projectTree.filter(f => f.toLowerCase().includes(atMenu.filter.toLowerCase())).length, 5) * 40) }}
                    >
                      <div className="px-3 py-2 border-b border-white/5 bg-white/5">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Select Script</span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {projectTree
                          .filter(f => f.toLowerCase().includes(atMenu.filter.toLowerCase()))
                          .slice(0, 10)
                          .map((file, i) => (
                            <div
                              key={file}
                              className={`px-4 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors ${i == atMenu.selectionIndex ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'text-white/60 hover:bg-white/5'}`}
                              onClick={() => {
                                const textBeforeAt = prompt.slice(0, prompt.lastIndexOf('@'));
                                const textAfterAt = prompt.slice(prompt.lastIndexOf('@') + atMenu.filter.length + 1);
                                setPrompt(textBeforeAt + "@" + file + " " + textAfterAt);
                                setAtMenu(prev => ({ ...prev, visible: false }));
                                fetch('/api/request-file', {
                                  method: 'POST',
                                  body: JSON.stringify({ key: sessionKey, fileName: file })
                                }).catch(() => { });
                              }}
                            >
                              <Brain className="h-3.5 w-3.5 opacity-50" />
                              <span className="truncate">{file}</span>
                            </div>
                          ))}
                        {projectTree.filter(f => f.toLowerCase().includes(atMenu.filter.toLowerCase())).length == 0 && (
                          <div className="px-4 py-3 text-xs text-white/30 italic">No scripts found...</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

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

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    {/* Mode toggle */}
                    <div className="relative flex items-center bg-black/20 rounded-xl border border-white/[0.04] p-0.5 w-[140px]">
                      {/* Sliding pill background */}
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded-lg transition-all duration-300 ease-in-out"
                        style={{
                          left: mode === "fast" ? "2px" : "50%",
                          width: "calc(50% - 2px)",
                          background: mode === "fast" ? "white" : "rgba(139, 92, 246, 0.15)",
                        }}
                      />
                      <button
                        onClick={() => setMode("fast")}
                        className={`relative z-10 flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-200 ${mode == "fast"
                            ? "text-black"
                            : "text-white/40 hover:text-white/70"
                          }`}
                      >
                        <Zap className="h-3 w-3" />
                        Fast
                      </button>
                      <button
                        onClick={() => setMode("thinking")}
                        className={`relative z-10 flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-200 ${mode == "thinking"
                            ? "text-violet-400"
                            : "text-white/40 hover:text-white/70"
                          }`}
                      >
                        <Brain className="h-3 w-3" />
                        Think
                      </button>
                    </div>

                    <button
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white hover:bg-white/[0.05] transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Attach
                    </button>

                    {(provider == "google" ? googleKey.trim() : openaiKey.trim()).length == 0 ? (() => {
                      const pct = Math.max(0, Math.min(100, ((usage.totalTokens - usage.usedTokens) / usage.totalTokens) * 100));
                      const hue = Math.round(pct * 1.2); // green at 100%, red at 0%
                      const creditsAvailable = Math.max(0, usage.totalTokens - usage.usedTokens);
                      return (
                        <div className="hidden sm:flex relative h-8 w-32 bg-black/40 rounded-lg overflow-hidden border border-white/[0.08] items-center justify-center group ml-2 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                          {/* Main Wave Layer */}
                          <div
                            className="absolute left-0 right-0 bottom-0 transition-all duration-1000 animate-wave opacity-100"
                            style={{
                              height: `${pct}%`,
                              background: `linear-gradient(90deg, hsla(${hue}, 100%, 50%, 0.7) 0%, hsla(${hue}, 100%, 65%, 0.95) 50%, hsla(${hue}, 100%, 50%, 0.7) 100%)`,
                              backgroundSize: '200% 100%',
                              boxShadow: `0 0 20px hsla(${hue}, 100%, 50%, 0.5)`,
                            }}
                          />
                          {/* Secondary Wave Layer for Depth */}
                          <div
                            className="absolute left-0 right-0 bottom-0 transition-all duration-1000 animate-wave-fast opacity-40 blur-[2px]"
                            style={{
                              height: `${Math.min(100, pct + 5)}%`,
                              background: `linear-gradient(90deg, transparent 0%, hsla(${hue}, 100%, 70%, 0.8) 50%, transparent 100%)`,
                              backgroundSize: '200% 100%',
                            }}
                          />
                          <span className="relative z-10 text-[11px] font-mono font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                            {creditsAvailable.toLocaleString()} Credits
                          </span>
                        </div>
                      );
                    })() : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {lastError && (
                      <button
                        className="px-3 py-2 rounded-xl text-[12px] font-medium text-red-400 hover:bg-red-500/10 transition-all"
                        onClick={handleAutoFix}
                        disabled={isGenerating}
                      >
                        Repair
                      </button>
                    )}
                    <button
                      onClick={() => submitPrompt()}
                      disabled={!isPluginConnected || isGenerating || prompt.trim() == ""}
                      className="p-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40 transition-all disabled:shadow-none"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 px-1">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to clear your chat history?")) {
                          setMessages([]);
                          setGameLogs([]);
                          lastGeneratedScriptsRef.current = [];
                        }
                      }}
                      className="flex items-center gap-1.5 text-[11px] text-white/20 hover:text-red-400/60 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear History
                    </button>

                    <button
                      onClick={() => {
                        if (isAnalyzing) return;
                        setIsAnalyzing(true);
                        const allCode = lastGeneratedScriptsRef.current.map(s => `--- ${s.name} ---\n${s.code}`).join("\n\n");
                        submitPrompt(`CRITICAL PROJECT ANALYSIS REQUEST:
Please analyze all the scripts generated so far for:
1. Performance bottlenecks or memory leaks.
2. Architectural inconsistencies.
3. Potential bugs or edge cases.
4. UI polish suggestions.

Current Project Code:
${allCode}

Provide a structured report with scores (0-100) and specific improvement tasks.`);
                        setTimeout(() => setIsAnalyzing(false), 5000);
                      }}
                      className={`flex items-center gap-1.5 text-[11px] transition-colors ${isAnalyzing ? 'text-violet-400 animate-pulse' : 'text-white/20 hover:text-violet-400/60'}`}
                    >
                      <LayoutDashboard className="h-3 w-3" />
                      {isAnalyzing ? "Analyzing..." : "Analyze Project"}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Auto-Sync</span>
                      <button
                        onClick={() => setAutoSync(!autoSync)}
                        className={`relative w-8 h-4 rounded-full transition-all duration-300 ${autoSync ? 'bg-[#ccff00]' : 'bg-white/10'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-black transition-all duration-300 ${autoSync ? 'left-4.5' : 'left-0.5'}`} style={{ left: autoSync ? '18px' : '2px' }} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>

        {messages.length == 0 && isPluginConnected && (
          <div className="mt-8 flex flex-col items-center gap-4 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 relative z-10">
            <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest mb-2">Quick Start Blueprints</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button 
                className="flex items-center gap-2.5 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 rounded-full text-[13px] font-medium text-white/60 hover:text-white transition-all shadow-xl group" 
                onClick={() => submitPrompt("Create a professional sword combat system with raycast hit detection, 3-hit combos, and server-side hit validation.")}
              >
                <span className="text-[16px] group-hover:scale-110 transition-transform">⚔️</span> Sword Combat System
              </button>
              <button 
                className="flex items-center gap-2.5 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 rounded-full text-[13px] font-medium text-white/60 hover:text-white transition-all shadow-xl group" 
                onClick={() => submitPrompt("Build a premium Round System with an Intermission timer, Map Voting UI, and automated player teleportation logic.")}
              >
                <span className="text-[16px] group-hover:scale-110 transition-transform">⏱️</span> Advanced Round System
              </button>
              <button 
                className="flex items-center gap-2.5 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 rounded-full text-[13px] font-medium text-white/60 hover:text-white transition-all shadow-xl group" 
                onClick={() => submitPrompt("Create a high-end Shop UI with categories, item previews, and a robust DataStore-backed coin currency system.")}
              >
                <span className="text-[16px] group-hover:scale-110 transition-transform">🛒</span> Premium Item Shop
              </button>
              <button 
                className="flex items-center gap-2.5 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 rounded-full text-[13px] font-medium text-white/60 hover:text-white transition-all shadow-xl group" 
                onClick={() => submitPrompt("Generate a glassmorphic main menu with smooth transitions, settings (SFX/Music), and a play button that tweens the camera.")}
              >
                <span className="text-[16px] group-hover:scale-110 transition-transform">🖼️</span> Glassmorphic Menu UI
              </button>
            </div>
          </div>
        )}
      </div>
      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="bg-[#1e2028] border border-white/[0.04] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-white uppercase tracking-wider">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-white/40 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="text-[12px] font-medium text-white/50 mb-2 block">Provider</label>
              <select
                id="provider-select"
                value={provider}
                onChange={(e) => {
                  const val = e.target.value as "openai" | "google";
                  const storedOpen = window.localStorage.getItem("apple-juice-openai-key") ?? window.localStorage.getItem("apple-juice-api-key") ?? "";
                  const storedGoogle = window.localStorage.getItem("apple-juice-google-key") ?? "";
                  setProvider(val);
                  setOpenaiKey(storedOpen);
                  setGoogleKey(storedGoogle);
                  const newKey = val == "google" ? storedGoogle : storedOpen;
                  setApiKey(newKey);
                  window.localStorage.setItem("apple-juice-provider", val);
                }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00]/40 transition-colors"
              >
                <option value="openai" className="bg-[#13151a]">OpenAI</option>
                <option value="google" className="bg-[#13151a]">Google AI Studio</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-white/50 mb-2 block" htmlFor="api-key-input">
                API Key
              </label>
              <div className="flex gap-2">
                <Input
                  id="api-key-input"
                  type="password"
                  value={provider == "google" ? googleKey : openaiKey}
                  onChange={(event) => {
                    const v = event.target.value;
                    if (provider == "google") setGoogleKey(v);
                    else setOpenaiKey(v);
                    setApiKey(v);
                  }}
                  placeholder={provider == "google" ? "Google API Key" : "sk-..."}
                  className="flex-1 bg-white/[0.04] border-white/[0.08] h-8 text-xs focus:border-[#ccff00]/40"
                />
                <button onClick={saveApiKey} className="px-2.5 py-1.5 bg-white/10 text-white text-[11px] rounded-lg hover:bg-white/20 transition-colors">
                  Save
                </button>
              </div>
              <button onClick={() => loadModels()} disabled={isLoadingModels} className="mt-2 text-[11px] text-white/30 hover:text-white/60 transition-colors disabled:opacity-40">
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
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00]/40 transition-colors"
              >
                {availableModels.length === 0 && (
                  <option value="" disabled>No models available</option>
                )}
                {availableModels.map((model) => (
                  <option key={model} value={model} className="bg-[#13151a]">{model}</option>
                ))}
              </select>
            </div>

            <div className="pt-4 border-t border-white/[0.04]">
              <label className="text-[12px] font-medium text-white/50 mb-2 block" htmlFor="secret-code-input">
                Secret Code
              </label>
              <div className="flex gap-2">
                <Input
                  id="secret-code-input"
                  type="text"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  placeholder="Enter code..."
                  className="flex-1 bg-white/[0.04] border-white/[0.08] h-8 text-xs focus:border-[#ccff00]/40"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRedeemCode();
                  }}
                />
                <button 
                  onClick={handleRedeemCode} 
                  disabled={isRedeeming || !secretCode.trim()}
                  className="px-3 py-1.5 bg-[#ccff00]/10 text-[#ccff00] text-[11px] font-medium rounded-lg hover:bg-[#ccff00]/20 transition-colors disabled:opacity-40"
                >
                  {isRedeeming ? "..." : "Redeem"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      {showAssetSearch && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={(e) => { if (e.target === e.currentTarget) setShowAssetSearch(false); }}>
          <div className="bg-[#1e2028] border border-white/[0.04] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Search className="h-4 w-4 text-[#ccff00]" />
                Roblox Toolbox Search
              </h2>
              <button onClick={() => setShowAssetSearch(false)} className="text-white/40 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <Input
                value={assetQuery}
                onChange={(e) => setAssetQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchAssets()}
                placeholder="Search for models, meshes, images..."
                className="flex-1 bg-white/[0.04] border-white/[0.08] h-9 text-sm focus:border-[#ccff00]/40"
              />
              <button
                onClick={searchAssets}
                disabled={isSearchingAssets}
                className="px-4 py-2 bg-[#ccff00] text-black text-[12px] font-bold rounded-lg hover:bg-[#d4ff33] transition-colors disabled:opacity-40"
              >
                {isSearchingAssets ? "..." : "Search"}
              </button>
            </div>
            <div className="max-h-[350px] overflow-y-auto">
              {assetResults.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {assetResults.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => {
                        setAttachedAsset({ id: asset.id, name: asset.name, thumbnail: asset.thumbnail });
                        setShowAssetSearch(false);
                      }}
                      className="group relative bg-white/[0.04] border border-white/[0.08] rounded-xl p-2 hover:bg-white/[0.08] hover:border-[#ccff00]/30 transition-all text-left"
                    >
                      <div className="aspect-square bg-black/30 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                        <img
                          src={asset.thumbnail}
                          alt={asset.name}
                          className="w-full h-full object-cover rounded-lg opacity-80 group-hover:opacity-100 transition-opacity"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                      <p className="text-[11px] font-medium text-white/80 truncate">{asset.name}</p>
                      <p className="text-[9px] text-white/30 truncate">{asset.creator}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/20 text-sm">
                  {isSearchingAssets ? "Searching..." : "Search for assets to insert into your game"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
