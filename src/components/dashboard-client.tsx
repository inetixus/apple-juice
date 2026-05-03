"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  Paperclip,
  Zap,
  Brain,
  X,
  Search,
  Share2,
  Sparkles,
  Network,
  Trash2,
  LayoutDashboard,
  Menu,
  ShieldAlert,
  Cpu,
  Plus,
  Undo2,
} from "lucide-react";
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

type Project = {
  id: string;
  name: string;
  ownerUserId: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  createdAt: number;
  lastActiveAt: number;
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
  tokensUsed?: number;
  isReverted?: boolean;
};

const FALLBACK_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"];

export function DashboardClient({ username, avatarUrl }: DashboardClientProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);

  const [sessionKey, setSessionKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai" | "google">("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [availableModels, setAvailableModels] =
    useState<string[]>(FALLBACK_MODELS);
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
  const [pluginStatus, setPluginStatus] = useState(
    "Idle. Connect your plugin using the session key below.",
  );
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [gameLogs, setGameLogs] = useState<string[]>([]);
  const [mode, setMode] = useState<"fast" | "thinking">("fast");
  const [attachedFiles, setAttachedFiles] = useState<
    { name: string; content: string }[]
  >([]);
  const [usage, setUsage] = useState<any>({
    isLoaded: false,
    usedMl: 0,
    dailyMl: 2000,
    totalMl: 2000,
    remainingMl: 2000,
    bonusMl: 0,
    plan: "free",
  });
  const [showPricing, setShowPricing] = useState(false);

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
  const lastGeneratedScriptsRef = useRef<
    { name: string; parent: string; type: string; code: string }[]
  >([]);
  const MAX_AUTO_FIX_RETRIES = 3;
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>("");
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [autoRetry, setAutoRetry] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Feature: Asset search
  const [assetQuery, setAssetQuery] = useState("");
  const [assetResults, setAssetResults] = useState<
    { id: number; name: string; creator: string; thumbnail: string }[]
  >([]);
  const [showAssetSearch, setShowAssetSearch] = useState(false);
  const [isSearchingAssets, setIsSearchingAssets] = useState(false);
  const [isDeepIntelligence, setIsDeepIntelligence] = useState(false);
  const [attachedAsset, setAttachedAsset] = useState<{
    id: number;
    name: string;
    thumbnail: string;
  } | null>(null);
  // Feature: Apple Juice AI integration
  const [agLinked, setAgLinked] = useState(false);
  const [agBalance, setAgBalance] = useState<{
    quotas: { model: string; refreshesIn: string }[];
  } | null>(null);
  // Feature: Juice History
  const [juiceHistory, setJuiceHistory] = useState<
    { model: string; prompt: string; mlUsed: number; time: number }[]
  >([]);

  const examplePrompts = useMemo(
    () => [
      "Create a professional sword combat system with raycast hit detection, 3-hit combos, and server-side hit validation.",
      "Build a premium Round System with an Intermission timer, Map Voting UI, and automated player teleportation logic.",
      "Create a high-end Shop UI with categories, item previews, and a robust DataStore-backed coin currency system.",
      "Develop a pet system with smooth follow physics, egg hatching animations, and a rarity-based inventory UI.",
      "Generate a glassmorphic main menu with smooth transitions, settings (SFX/Music), and a play button that tweens the camera.",
    ],
    [],
  );

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
  }, [
    placeholderText,
    isDeleting,
    promptIndex,
    messages.length,
    examplePrompts,
  ]);

  const [projectTree, setProjectTree] = useState<string[]>([]);
  const [selectedTreePaths, setSelectedTreePaths] = useState<string[]>([]);
  const [atMenu, setAtMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    filter: string;
    selectionIndex: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    filter: "",
    selectionIndex: 0,
  });

  const playSound = (
    _type?: "pop" | "glass" | "error" | "whoosh" | "success",
  ) => {
    // Sounds disabled as per user request
  };

  useEffect(() => {
    if (!sessionKey) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/status?key=${encodeURIComponent(sessionKey)}&t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ok") {
            // Check if the plugin consumed code
            if (codeConsumedRef.current && !data.hasNewCode) {
              codeConsumedRef.current = false;
              setPluginStatus("Plugin successfully consumed the script.");
              showToast("Plugin received the script!", "success");
              playSound("glass");
            } else if (data.hasNewCode) {
              codeConsumedRef.current = true;
            }

            if (data.tree) {
              const lines = (data.tree as string)
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0);
              const newTree = Array.from(new Set(lines));
              if (newTree.length > 0) {
                setProjectTree((prev) => {
                  if (JSON.stringify(prev) === JSON.stringify(newTree))
                    return prev;
                  return newTree;
                });
              }
            }

            if (data.fileResponse && data.fileResponse.name) {
              setAttachedFiles((prev) => {
                if (prev.some((f) => f.name === data.fileResponse.name))
                  return prev;
                showToast(`Attached ${data.fileResponse.name}`, "success");
                playSound("pop");
                return [...prev, data.fileResponse];
              });
            }

            // Handle connection status checking
            if (data.lastPollTime > 0) {
              lastPollRef.current = data.lastPollTime;
              const serverTime = data.serverTime || Date.now();
              const timeSinceLastPoll = serverTime - data.lastPollTime;
              const isNowConnected = timeSinceLastPoll < 8000;

              setIsPluginConnected((prev) => {
                if (isNowConnected && !prev) {
                  setPluginStatus("Plugin connected successfully.");
                  showToast("Plugin connected successfully!", "success");
                } else if (!isNowConnected && prev) {
                  setPluginStatus(
                    "Plugin disconnected. Waiting for connection...",
                  );
                }
                return isNowConnected;
              });
            }

            if (data.logs && data.logs.length > 0) {
              setGameLogs((prev) => [...prev, ...data.logs].slice(-200));

              // Detect structured test results from the plugin
              for (const log of data.logs as string[]) {
                // Test passed
                if (log.includes("[APPLE_JUICE_TEST_PASS]")) {
                  try {
                    const jsonStr = log
                      .replace("[APPLE_JUICE_TEST_PASS]", "")
                      .trim();
                    const result = jsonStr ? JSON.parse(jsonStr) : {};
                    const dur = result.duration
                      ? ` in ${result.duration.toFixed(1)}s`
                      : "";
                    setPluginStatus(`Playtest passed${dur}! No errors found.`);
                  } catch {
                    setPluginStatus("Playtest passed! No errors found.");
                  }
                  showToast("Playtest passed with no errors!", "success");
                  autoFixRetriesRef.current = 0;
                }

                // Test failed   parse structured result and build comprehensive fix prompt
                if (log.includes("[APPLE_JUICE_TEST_FAIL]")) {
                  let testResult: any = null;
                  let rawErrorText = "";
                  try {
                    const jsonStr = log
                      .replace("[APPLE_JUICE_TEST_FAIL]", "")
                      .trim();
                    testResult = JSON.parse(jsonStr);
                  } catch {
                    rawErrorText = log
                      .replace("[APPLE_JUICE_TEST_FAIL]", "")
                      .trim();
                  }

                  const errorCount = testResult?.errorCount || 1;
                  const displayError = testResult
                    ? testResult.errors
                        ?.map(
                          (e: any) =>
                            `[${e.scriptName}:${e.lineNumber}] ${e.errorText}`,
                        )
                        .join("\n")
                    : rawErrorText;
                  setLastError(displayError);
                  lastReportedErrorRef.current = displayError;

                  if (
                    autoFixRetriesRef.current < MAX_AUTO_FIX_RETRIES &&
                    !isGenerating
                  ) {
                    autoFixRetriesRef.current += 1;
                    const attempt = autoFixRetriesRef.current;
                    setPluginStatus(
                      `Auto-fixing ${errorCount} error(s) (attempt ${attempt}/${MAX_AUTO_FIX_RETRIES})...`,
                    );
                    showToast(
                      `Auto-fix attempt ${attempt}/${MAX_AUTO_FIX_RETRIES}...`,
                      "info",
                    );

                    if (autoFixTimerRef.current)
                      clearTimeout(autoFixTimerRef.current);
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
                  } else if (
                    autoFixRetriesRef.current >= MAX_AUTO_FIX_RETRIES
                  ) {
                    setPluginStatus(
                      `Auto-fix failed after ${MAX_AUTO_FIX_RETRIES} attempts. Use the Repair button to try manually.`,
                    );
                    showToast(
                      `Auto-fix exhausted ${MAX_AUTO_FIX_RETRIES} retries. Fix manually or try a different approach.`,
                      "error",
                    );
                    playSound("error");
                  }
                }

                // Test skipped (already in run mode)
                if (log.includes("[APPLE_JUICE_TEST_SKIP]")) {
                  setPluginStatus(
                    "Playtest skipped (Studio already in run mode).",
                  );
                }
              }

              // Track non-test errors for the manual Repair button
              const newErrorLog = data.logs.find(
                (log: string) =>
                  !log.includes("[APPLE_JUICE_") &&
                  (log.toLowerCase().includes("error") ||
                    log.toLowerCase().includes("exception")),
              );
              if (newErrorLog && newErrorLog !== lastReportedErrorRef.current) {
                lastReportedErrorRef.current = newErrorLog;
                // Only set lastError if it's a real playtest failure, not just a random log
              }
            }
          }
        } else if (res.status === 410 || res.status === 404) {
          // Session expired or missing on server — trigger a re-pair
          console.warn("[AppleJuice] Session expired or missing, re-pairing...");
          setSessionKey("");
          void createPairOnServer();
        }
      } catch (err) {
        console.error("Status check failed", err);
      }
    }, 1000);
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

    const savedProvider = (window.localStorage.getItem(
      "apple-juice-provider",
    ) || "openai") as "openai" | "google";
    const savedOpen =
      window.localStorage.getItem("apple-juice-openai-key") ??
      window.localStorage.getItem("apple-juice-api-key") ??
      "";
    const savedGoogle =
      window.localStorage.getItem("apple-juice-google-key") ?? "";

    setProvider(savedProvider as any);
    setOpenaiKey(savedOpen);
    setGoogleKey(savedGoogle);

    let effectiveKey = savedOpen;
    if (savedProvider === "google") effectiveKey = savedGoogle;
    setApiKey(effectiveKey);

    const savedModel =
      window.localStorage.getItem("apple-juice-model") ?? "gpt-4o-mini";
    setSelectedModel(savedModel);

    void loadProjects();

    void loadModels(effectiveKey, savedModel);

    const savedAutoRetry =
      window.localStorage.getItem("apple-juice-auto-retry") === "true";
    setAutoRetry(savedAutoRetry);

    void fetchUsage();

    // Check Antigravity link status
    void checkAntigravityLink();
  }, []);
  async function fetchUsage() {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage((prev: any) => {
          // Detect plan upgrade (only if we already loaded the initial data)
          if (prev && prev.isLoaded && prev.plan !== data.plan && (data.plan === "fresh_pro" || data.plan === "pure_ultra")) {
             const planName = data.plan === "pure_ultra" ? "Pure Ultra" : "Fresh Pro";
             showToast(`Thank you for upgrading! Your ${planName} plan is now active. 🧃`, "success");
          }
          return { ...data, isLoaded: true };
        });
      }
    } catch {
      // ignore
    }
  }

  // Poll usage every 10 seconds to catch Roblox webhook updates
  useEffect(() => {
    if ((provider as string) === "apple_juice_ai" || !apiKey) {
      void loadModels();
    }
  }, [usage?.plan]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchUsage();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  //     Multi-Project Management

  async function loadProjects() {
    setIsProjectsLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const loadedProjects = data.projects || [];
        setProjects(loadedProjects);
        setActiveProjectId(null); // Explicitly stay in the lobby
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setIsProjectsLoading(false);
    }
  }

  async function createNewProject(name: string) {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        const newProj = data.project;
        setProjects((prev) => [newProj, ...prev]);
        await switchProject(newProj);
      }
    } catch (err) {
      console.error("Failed to create project", err);
    }
  }

  async function switchProject(project: Project) {
    setActiveProjectId(project.id);
    setIsPluginConnected(false);
    setPluginStatus("Switched project. Waiting for plugin connection...");
    
    if (project.sessionKey) {
      setSessionKey(project.sessionKey);
    } else {
      setSessionKey("");
      void createPairOnServer();
    }

    // Load preferences if saved
    if (project.provider) {
      setProvider(project.provider as any);
      window.localStorage.setItem("apple-juice-provider", project.provider);
    }
    if (project.model) {
      setSelectedModel(project.model);
    }

    // Fetch messages
    try {
      const res = await fetch(`/api/projects/${project.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    }
  }

  async function deleteProject(id: string) {
    const confirm = window.confirm(
      "Are you sure you want to delete this project? This cannot be undone.",
    );
    if (!confirm) return;

    try {
      const res = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const updated = projects.filter((p) => p.id !== id);
        setProjects(updated);
        if (activeProjectId === id) {
          if (updated.length > 0) {
            await switchProject(updated[0]);
          } else {
            await createNewProject("My First Project");
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  }

  async function renameProject(id: string, newName: string) {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName }),
      });
      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: newName } : p)),
        );
      }
    } catch (err) {
      console.error("Failed to rename project", err);
    }
  }

  // Auto-save messages to the active project
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (activeProjectId && !isProjectsLoading) {
      fetch(`/api/projects/${activeProjectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      }).catch((err) => console.error("Failed to save messages", err));
    }
  }, [messages, activeProjectId, isProjectsLoading]);

  // Update session key in project when it changes
  useEffect(() => {
    if (activeProjectId && sessionKey && !isProjectsLoading) {
      fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeProjectId, sessionKey }),
      }).catch(() => {});
    }
  }, [sessionKey, activeProjectId, isProjectsLoading]);

  //

  async function checkAntigravityLink() {
    try {
      const res = await fetch("/api/antigravity/link");
      if (res.ok) {
        const data = await res.json();
        setAgLinked(!!data.linked);
        if (data.linked) {
          void fetchAntigravityBalance();
        }
      }
    } catch {
      // ignore
    }
  }

  async function fetchAntigravityBalance() {
    try {
      const res = await fetch("/api/antigravity/balance");
      if (res.ok) {
        const data = await res.json();
        setAgBalance({ quotas: data.quotas || [] });
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      window.localStorage.setItem(
        "apple-juice-chat-history",
        JSON.stringify(messages),
      );
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
          setPluginStatus(
            "Pair creation failed: Unauthorized   please sign in and try again.",
          );
        } else {
          setPluginStatus(`Pair creation failed: ${errMsg}`);
        }
        return;
      }

      const payload = await res.json();
      const key = (payload?.sessionKey as string) || "";
      setSessionKey(key);
      setPluginStatus(
        "Session created. Your plugin will auto-connect via IP, or use the key below.",
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setPluginStatus(`Session creation failed: ${detail}`);
    }
  }

  async function loadModels(
    rawApiKey?: string,
    preferredModel?: string,
    providerArg?: string,
  ) {
    const key = (rawApiKey ?? apiKey).trim();
    setIsLoadingModels(true);
    const usedProvider = providerArg ?? provider;
    const actualProvider = !key ? "apple_juice_ai" : usedProvider;
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key, provider: actualProvider }),
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

      const payload = (await response.json()) as {
        models?: string[];
        error?: string;
      };
      let nextModels =
        payload.models && payload.models.length > 0
          ? payload.models
          : FALLBACK_MODELS;

      // Filter Antigravity models by plan
      if (actualProvider === "apple_juice_ai") {
        const plan = usage?.plan || 'free';
        const freeModels = ["Gemini 2.5 Flash", "Gemini 3.1 Flash-Lite"];
        const proModels = [...freeModels, "Gemini 3.1 Flash", "DeepSeek V3", "Gemini 3 Pro", "Gemini 3 Flash"]; // Added Gemini 3 Flash as it's often a variant
        
        if (plan === 'free') {
          nextModels = nextModels.filter(m => freeModels.includes(m));
        } else if (plan === 'fresh_pro') {
          nextModels = nextModels.filter(m => proModels.includes(m));
        }
        // Ultra gets everything
      }

      setAvailableModels(nextModels);

      const targetModel = preferredModel || selectedModel;
      if (targetModel && nextModels.includes(targetModel)) {
        setSelectedModel(targetModel);
      } else {
        const fallbackDefault =
          usedProvider === "google" ? "gemini-3-flash" : "gpt-4o-mini";
        const first = nextModels[0] || fallbackDefault;
        setSelectedModel(first);
        window.localStorage.setItem("apple-juice-model", first);
      }
    } catch {
      setAvailableModels(FALLBACK_MODELS);
      setPluginStatus(
        "Could not load model list. Using fallback model choices.",
      );
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

    let finalProvider: "openai" | "google" = provider;
    if (detectedGoogle) finalProvider = "google";

    if (finalProvider === "google") {
      window.localStorage.setItem("apple-juice-google-key", inputValue);
      setGoogleKey(inputValue);
      setProvider("google");
    } else {
      window.localStorage.setItem("apple-juice-openai-key", inputValue);
      window.localStorage.setItem("apple-juice-api-key", inputValue);
      setOpenaiKey(inputValue);
      setProvider("openai");
    }

    window.localStorage.setItem("apple-juice-provider", finalProvider);
    setApiKey(inputValue);
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
        body: JSON.stringify({ code: secretCode, sessionKey }),
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


  async function submitPrompt(
    overridePrompt?: string | any,
    isHidden: boolean = false,
  ) {
    function parseChatResponse(text: string): any {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        try {
          return JSON.parse(match[1].trim());
        } catch (e) {}
      }
      try {
        return JSON.parse(text.trim());
      } catch (e) {}
      return { message: text };
    }

    function buildAssistantMessage(
      p: any,
      files: { name: string; content: string }[],
      pendingSync: boolean,
      isHidden: boolean = false,
    ): ChatMessage {
      return {
        id: crypto.randomUUID(),
        role: "assistant",
        content: p.message || "Here is the code you requested.",
        isHidden,
        script:
          !p.scripts && p.scriptName
            ? {
                name: p.scriptName,
                parent: p.scriptParent || "ServerScriptService",
                type: p.scriptType || "Script",
                action: p.action || "create",
                lineCount:
                  p.lineCount || (p.code ? p.code.split("\n").length : 0),
                code: p.code || "",
                originalCode: files.find(
                  (f) =>
                    f.name === p.scriptName ||
                    f.name === p.scriptName + ".lua",
                )?.content,
              }
            : undefined,
        scripts: p.scripts?.map((s: any) => ({
          name: s.name,
          parent: s.parent,
          type: s.type || "Script",
          action: (s.action as "create" | "delete") || "create",
          lineCount: s.lineCount || 0,
          code: s.code || "",
          originalCode: files.find(
            (f: any) => f.name === s.name || f.name === s.name + ".lua",
          )?.content,
          requires: s.requires,
        })),
        suggestions: p.suggestions,
        thinking: p.thinking,
        pendingSync,
        tokensUsed: p.tokensUsed,
      };
    }
    const isRetryObj = typeof overridePrompt === "object";
    const retryCount = isRetryObj ? overridePrompt?.retryCount || 1 : 0;
    const isRetry = retryCount > 0;

    const targetPrompt =
      typeof overridePrompt === "string"
        ? overridePrompt
        : isRetryObj
          ? overridePrompt?.text || lastPromptRef.current
          : prompt;
    const trimmed = targetPrompt.trim();
    console.log("[AppleJuice] Submit started", {
      trimmed,
      sessionKey,
      provider,
    });

    if (!trimmed) {
      console.warn("[AppleJuice] Missing prompt", { trimmed, sessionKey });
      return;
    }

    if (!sessionKey) {
      const fallbackKey = projects.find(
        (p) => p.id === activeProjectId,
      )?.sessionKey;
      if (fallbackKey) {
        setSessionKey(fallbackKey);
      } else {
        showToast(
          "No pairing session found. Please create a new project or connect your plugin.",
          "error"
        );
        playSound("error");
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    let messageId = "";
    let contextMessages = messages;

    if (!isRetry) {
      const generateId = () => {
        try {
          return crypto.randomUUID();
        } catch {
          return (
            Math.random().toString(36).substring(2) + Date.now().toString(36)
          );
        }
      };
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        attachments:
          attachedFiles.length > 0
            ? attachedFiles.map((f) => ({ name: f.name }))
            : undefined,
        attachedAsset: attachedAsset || undefined,
        isHidden,
      };

      messageId = userMessage.id;
      contextMessages = [...messages, userMessage];
      setMessages(contextMessages);
      setPrompt("");
      setLastError(null);
      lastPromptRef.current = trimmed;
    } else {
      // Find the ID of the existing message we're retrying for
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      messageId = lastUser?.id || "";
      contextMessages = messages;
    }

    setIsGenerating(true);
    playSound("whoosh");
    setPluginStatus("Generating Luau and syncing it to the pairing session...");

    const promptSnippet =
      trimmed.length > 25 ? trimmed.substring(0, 25) + "..." : trimmed;
    const isAsset =
      trimmed.toLowerCase().includes("insert") ||
      trimmed.toLowerCase().includes("build") ||
      trimmed.toLowerCase().includes("model") ||
      trimmed.toLowerCase().includes("part");

    try {
      let finalPromptText = trimmed;

      if (autoEnhance && !overridePrompt && !isAsset) {
        setThinkingSteps([
          { icon: "thinking", label: "Enhancing prompt...", done: false },
        ]);
        const enhanceRes = await fetch("/api/enhance-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            provider,
            apiKey: apiKey.trim(),
            openaiKey: openaiKey.trim(),
          }),
          signal: abortControllerRef.current.signal,
        });
        if (enhanceRes.ok) {
          const enhanceData = await enhanceRes.json();
          if (enhanceData.enhancedPrompt) {
            finalPromptText = enhanceData.enhancedPrompt;
            setPluginStatus("Prompt enhanced. Generating Luau...");
          }
        }
      }

      if (mode === "thinking") {
        const isDeepSeekModel = selectedModel.toLowerCase().includes("deepseek");
        const isR1 = selectedModel.toLowerCase().includes("r1");

        if (isDeepSeekModel) {
          // DeepSeek-specific thinking chain
          setThinkingSteps([
            {
              icon: "reasoning",
              label: isR1 ? `R1 deep reasoning: "${promptSnippet}"...` : `DeepSeek analyzing: "${promptSnippet}"...`,
              done: false,
            },
          ]);

          const fileNames = attachedFiles.map((f) => f.name).join(", ");
          const t1 = setTimeout(() => {
            setThinkingSteps((prev) => {
              if (prev.length === 1 && !prev[0].done) {
                return [
                  { ...prev[0], done: true },
                  {
                    icon: "looking",
                    label: fileNames
                      ? `Scanning ${fileNames} for patterns...`
                      : "Mapping project architecture...",
                    done: false,
                  },
                ];
              }
              return prev;
            });

            const t2 = setTimeout(() => {
              setThinkingSteps((prev) => {
                if (prev.length === 2 && !prev[1].done) {
                  return [
                    prev[0],
                    { ...prev[1], done: true },
                    {
                      icon: "optimizing",
                      label: isR1 ? "Chain-of-thought synthesis..." : "Optimizing Luau output...",
                      done: false,
                    },
                  ];
                }
                return prev;
              });

              if (isR1) {
                const t3 = setTimeout(() => {
                  setThinkingSteps((prev) => {
                    if (prev.length === 3 && !prev[2].done) {
                      return [
                        ...prev.slice(0, 2),
                        { ...prev[2], done: true },
                        {
                          icon: "generating",
                          label: "Generating verified solution...",
                          done: false,
                        },
                      ];
                    }
                    return prev;
                  });
                }, 3000 + Math.random() * 4000);
                stepTimeoutsRef.current.push(t3);
              }
            }, 2000 + Math.random() * 2500);
            stepTimeoutsRef.current.push(t2);
          }, 1500 + Math.random() * 2000);
          stepTimeoutsRef.current.push(t1);
        } else {
        // Original Gemini thinking flow
        setThinkingSteps([
          {
            icon: "thinking",
            label: `Deep reasoning about "${promptSnippet}"...`,
            done: false,
          },
        ]);

        const fileNames = attachedFiles.map((f) => f.name).join(", ");

        const t1 = setTimeout(
          () => {
            setThinkingSteps((prev) => {
              if (prev.length === 1 && !prev[0].done) {
                return [
                  { ...prev[0], done: true },
                  {
                    icon: "looking",
                    label: fileNames
                      ? `Reading ${fileNames}...`
                      : "Planning architecture...",
                    done: false,
                  },
                ];
              }
              return prev;
            });

            const t2 = setTimeout(
              () => {
                setThinkingSteps((prev) => {
                  if (prev.length === 2 && !prev[1].done) {
                    return [
                      prev[0],
                      { ...prev[1], done: true },
                      {
                        icon: "generating",
                        label: isAsset
                          ? "Locating asset..."
                          : "Writing code...",
                        done: false,
                      },
                    ];
                  }
                  return prev;
                });
              },
              2500 + Math.random() * 3000,
            );
            stepTimeoutsRef.current.push(t2);
          },
          2000 + Math.random() * 2500,
        );

        stepTimeoutsRef.current.push(t1);
        }
      } else if (selectedModel.toLowerCase().includes("deepseek")) {
        // DeepSeek fast mode
        setThinkingSteps([
          {
            icon: "reasoning",
            label: `DeepSeek processing: "${promptSnippet}"...`,
            done: false,
          },
        ]);

        const fileNames = attachedFiles.map((f) => f.name).join(", ");
        const t1 = setTimeout(() => {
          setThinkingSteps((prev) => {
            if (prev.length === 1 && !prev[0].done) {
              return [
                { ...prev[0], done: true },
                {
                  icon: "generating",
                  label: fileNames ? `Writing code with context from ${fileNames}...` : "Generating optimized Luau...",
                  done: false,
                },
              ];
            }
            return prev;
          });
        }, 1500 + Math.random() * 2000);
        stepTimeoutsRef.current.push(t1);
      } else {
        setThinkingSteps([
          {
            icon: "thinking",
            label: `Analyzing request: "${promptSnippet}"...`,
            done: false,
          },
        ]);

        const fileNames = attachedFiles.map((f) => f.name).join(", ");

        const t1 = setTimeout(
          () => {
            setThinkingSteps((prev) => {
              if (prev.length === 1 && !prev[0].done) {
                return [
                  { ...prev[0], done: true },
                  {
                    icon: "looking",
                    label: fileNames
                      ? `Reading ${fileNames}...`
                      : "Checking workspace folders...",
                    done: false,
                  },
                ];
              }
              return prev;
            });

            const t2 = setTimeout(
              () => {
                setThinkingSteps((prev) => {
                  if (prev.length === 2 && !prev[1].done) {
                    const scriptTypes = [
                      "LocalScript",
                      "ModuleScript",
                      "ServerScript",
                    ];
                    const typeFound =
                      scriptTypes.find((t) =>
                        trimmed.toLowerCase().includes(t.toLowerCase()),
                      ) || "code";
                    return [
                      prev[0],
                      { ...prev[1], done: true },
                      {
                        icon: "generating",
                        label: isAsset
                          ? "Preparing asset..."
                          : `Writing ${typeFound}...`,
                        done: false,
                      },
                    ];
                  }
                  return prev;
                });
              },
              1500 + Math.random() * 2000,
            );
            stepTimeoutsRef.current.push(t2);
          },
          1000 + Math.random() * 1500,
        );

        stepTimeoutsRef.current.push(t1);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: (attachedAsset
            ? `[System Note: The user has attached the Roblox asset "${attachedAsset.name}" (ID: ${attachedAsset.id}) to this message. Please fulfill their request, using this asset if appropriate. If they don't specify what to do with it, insert it into Workspace.]\n\n${finalPromptText}`
            : finalPromptText) + (isDeepIntelligence ? "\n\n[System Note: Deep Intelligence Mode ACTIVE. Please analyze the entire provided project structure and relationships carefully to ensure cross-script compatibility and optimal architectural patterns.]" : ""),
          messages: contextMessages.map((m) => ({
            role: m.role,
            content: m.attachedAsset
              ? `[System Note: Attached Asset "${m.attachedAsset.name}" (ID: ${m.attachedAsset.id})]\n${m.content}`
              : m.content,
          })),
          sessionKey,
          apiKey: apiKey.trim(),
          model: selectedModel,
          provider,
          openaiKey: openaiKey.trim(),
          mode,
          fileContents: attachedFiles.length > 0 ? attachedFiles : undefined,
          autoSync: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to read stream body");
        const decoder = new TextDecoder();
        let accumulated = "";

        const assistantMsgId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: "",
            pendingSync: false,
          },
        ]);

        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // The last element might be an incomplete line, so keep it for the next chunk
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim().startsWith("data: ")) {
                const dataStr = line.replace(/^data:\s*/, "").trim();
                if (dataStr === "[DONE]") continue;
                try {
                  const data = JSON.parse(dataStr);
                  const delta = data.choices?.[0]?.delta?.content || "";
                  const reasoning = data.choices?.[0]?.delta?.reasoning_content || data.choices?.[0]?.delta?.reasoning || data.choices?.[0]?.delta?.thinking || "";
                  
                  if (reasoning) {
                    setThinkingSteps((prev) => {
                      const index = prev.findIndex(s => s.icon === "reasoning");
                      if (index !== -1) {
                         const newSteps = [...prev];
                         const snippet = reasoning.length > 50 ? "..." + reasoning.substring(reasoning.length - 50) : reasoning;
                         newSteps[index] = { ...newSteps[index], label: `Reasoning: ${snippet.replace(/\n/g, " ")}`, done: false };
                         return newSteps;
                      }
                      return prev;
                    });
                  }

                  if (delta) {
                    accumulated += delta;
                    
                    let displayContent = accumulated;
                    let extractedThinking = "";
                    
                    // If the response looks like a JSON object (common for structured DeepSeek output)
                    if (accumulated.trim().startsWith("{")) {
                        try {
                            // Extract "thinking": "..." field
                            const thinkingMatch = accumulated.match(/"thinking"\s*:\s*"([\s\S]*?)(?:"(?:\s*[,}])|$)/);
                            if (thinkingMatch) {
                                extractedThinking = thinkingMatch[1]
                                    .replace(/\\n/g, "\n")
                                    .replace(/\\"/g, '"')
                                    .replace(/\\\\/g, "\\");
                            }
                            
                            // Extract "message": "..." field
                            const messageMatch = accumulated.match(/"message"\s*:\s*"([\s\S]*?)(?:"(?:\s*[,}])|$)/);
                            if (messageMatch) {
                                displayContent = messageMatch[1]
                                    .replace(/\\n/g, "\n")
                                    .replace(/\\"/g, '"')
                                    .replace(/\\\\/g, "\\");
                            } else {
                                // If we're still in the middle of "thinking" and haven't hit "message" yet, 
                                // show a "Generating..." placeholder for the message
                                displayContent = extractedThinking ? "..." : "";
                            }
                        } catch (e) {
                            // Fallback to raw if regex fails
                        }
                    }

                    if (extractedThinking) {
                        setThinkingSteps((prev) => {
                          const index = prev.findIndex(s => s.icon === "reasoning");
                          if (index !== -1) {
                             const newSteps = [...prev];
                             const snippet = extractedThinking.length > 50 ? "..." + extractedThinking.substring(extractedThinking.length - 50) : extractedThinking;
                             newSteps[index] = { ...newSteps[index], label: `Reasoning: ${snippet.replace(/\n/g, " ")}`, done: false };
                             return newSteps;
                          }
                          return prev;
                        });
                    }

                    setMessages((prev) => {
                      const last = prev[prev.length - 1];
                      if (last?.id === assistantMsgId) {
                        return [
                          ...prev.slice(0, -1),
                          { ...last, content: displayContent, thinking: extractedThinking || last.thinking },
                        ];
                      }
                      return prev;
                    });
                  }
                } catch (e) {}
              }
            }
          }
          
          // Mark steps as done only after stream completes
          setThinkingSteps((prev) => prev.map((s) => ({ ...s, done: true })));

          // Process the finalized content for scripts
          const result = parseChatResponse(accumulated);
          const payloadFiles = [...attachedFiles];
          setAttachedFiles([]);
          setAttachedAsset(null);

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.id === assistantMsgId) {
              const structured = buildAssistantMessage(
                result,
                payloadFiles,
                true,
              );
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  ...structured,
                  content: structured.content || accumulated,
                },
              ];
            }
            return prev;
          });
        } finally {
          setIsGenerating(false);
          playSound("success");
          setThinkingSteps([]);
          void fetchUsage();
        }
        return;
      }

      if (!response.ok) {
        let errText = response.statusText;
        try {
          const errPayload = await response.json();
          errText = errPayload?.detail || errPayload?.error || errText;
        } catch (err: any) {
          console.error("AI Error:", err);
          setLastError(err.message || "Failed to generate code.");
          playSound("error");
        }
        throw new Error(errText || "Failed to generate code");
      }

      const payload = (await response.json()) as {
        code?: string;
        error?: string;
        detail?: string;
        scriptName?: string;
        scriptParent?: string;
        lineCount?: number;
        scriptType?: string;
        action?: "create" | "delete";
        message?: string;
        suggestions?: string[];
        scripts?: {
          name: string;
          parent: string;
          type: string;
          action: string;
          lineCount: number;
          code: string;
          requires?: string[];
        }[];
        thinking?: string;
        tokensUsed?: number;
      };

      const payloadFiles = [...attachedFiles];
      setAttachedFiles([]);
      setAttachedAsset(null);

      // Track juice history
      if (payload.tokensUsed) {
        const mlUsed = payload.tokensUsed; // already in mL from server
        setJuiceHistory((prev) => [
          { model: selectedModel, prompt: trimmed.substring(0, 60), mlUsed, time: Date.now() },
          ...prev.slice(0, 19), // keep last 20
        ]);
      }


      setPluginStatus(`Script synced to Studio. Running playtest...`);
      showToast("Script generated and synced!", "success");
      playSound("success");
      
      const assistantMsg = buildAssistantMessage(payload, payloadFiles, true, isHidden);
      
      // Feature: Simulated Streaming / Typing Effect
      const fullText = assistantMsg.content;
      assistantMsg.content = ""; // Start empty
      setMessages((prev) => [...prev, assistantMsg]);
      
      let currentIdx = 0;
      const words = fullText.split(" ");
      const typingInterval = setInterval(() => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (!last || last.role !== "assistant") return prev;
          
          if (currentIdx >= words.length) {
            clearInterval(typingInterval);
            return prev;
          }
          
          const newText = last.content + (currentIdx === 0 ? "" : " ") + words[currentIdx];
          currentIdx++;
          
          return [
            ...prev.slice(0, -1),
            { ...last, content: newText }
          ];
        });
      }, 30);
      
      setIsGenerating(false);
      playSound("success");
      
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
        lastGeneratedScriptsRef.current = [
          {
            name: payload.scriptName || "AIScript",
            parent: payload.scriptParent || "ServerScriptService",
            type: payload.scriptType || "Script",
            code: payload.code || "",
          },
        ];
      }
      void fetchUsage();
    } catch (error) {
      stepTimeoutsRef.current.forEach(clearTimeout);
      stepTimeoutsRef.current = [];

      if (error instanceof DOMException && error.name === "AbortError") {
        setPluginStatus("Generation stopped by user.");
        showToast("Generation stopped.", "success");
        setTimeout(() => setThinkingSteps([]), 1000);
        setIsGenerating(false);

        // Remove the user message bubble if the request was cancelled
        if (messageId) {
          setMessages((current) => current.filter((m) => m.id !== messageId));
          if (!isHidden) setPrompt(trimmed);
        }
        return;
      }

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

      const retryTriggers = [
        "500",
        "502",
        "503",
        "504",
        "429",
        "high demand",
        "unavailable",
        "fetch failed",
        "network error",
        "overloaded",
        "antigravity request failed",
      ];
      const detailLower = detail.toLowerCase();
      const shouldRetry = retryTriggers.some((t) => detailLower.includes(t));

      if (detailLower.includes("denied access")) {
        detail =
          "Your Google API Key project has been suspended or denied access by Google. Please generate a new key in Google AI Studio.";
      } else if (shouldRetry) {
        if (autoRetry && retryCount < 3) {
          setPluginStatus(
            `AI is busy/failed. Auto-retrying in 3 seconds (Attempt ${retryCount + 1}/3)...`,
          );
          setTimeout(() => {
            submitPrompt(
              { text: trimmed, retryCount: retryCount + 1 },
              isHidden,
            );
          }, 3000);
          return;
        }
        detail =
          "The AI model is currently experiencing high demand or failed. Please try again in a few moments.";
      }

      setPluginStatus(`Generation failed: ${detail}`);
      showToast(detail, "error");
      playSound("error");
      setTimeout(() => setThinkingSteps([]), 1000);
      setIsGenerating(false);
      setLastError(detail);

      // Remove the user message bubble if the request failed and we're not retrying
      if (messageId) {
        setMessages((current) => current.filter((m) => m.id !== messageId));
        if (!isHidden) setPrompt(trimmed);
      }

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
      const res = await fetch(
        `/api/search-assets?q=${encodeURIComponent(assetQuery)}&category=Models`,
      );
      if (res.ok) {
        const data = await res.json();
        setAssetResults(data.results || []);
      }
    } catch {
      /* ignore */
    } finally {
      setIsSearchingAssets(false);
    }
  }, [assetQuery]);

  // Feature: Copy share link
  const copyShareLink = useCallback(() => {
    if (!sessionKey) return;
    const url = `${window.location.origin}/dashboard?join=${sessionKey}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        showToast(
          "Share link copied! Others can join your session.",
          "success",
        );
      })
      .catch(() => {});
  }, [sessionKey, showToast]);

  // Feature: Insert instance from Explorer tree
  const handleRename = useCallback(
    async (path: string, newName: string) => {
      if (!sessionKey) return;
      try {
        await fetch("/api/insert-instance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionKey,
            payload: { action: "rename_instance", oldPath: path, newName },
          }),
        });
        // Give the plugin a brief moment to process before the tree updates
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error("Rename error:", err);
      }
    },
    [sessionKey],
  );

  const handleDelete = useCallback(
    async (path: string, name: string) => {
      if (!sessionKey) return;
      try {
        const parts = path.split(".");
        const parent = parts.slice(0, -1).join(".") || "Workspace";
        await fetch("/api/insert-instance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionKey,
            payload: { action: "delete", parent, name },
          }),
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error("Delete error:", err);
      }
    },
    [sessionKey],
  );

  const handleAddInstance = useCallback(
    async (parentPath: string, className: string, name: string) => {
      if (!sessionKey) {
        showToast("No active session. Connect your plugin first.", "error");
        return;
      }

      const isScript = ["Script", "LocalScript", "ModuleScript"].includes(
        className,
      );

      const payload = isScript
        ? {
            parent: parentPath,
            name,
            type: className,
            action: "create",
            code: `-- ${className}: ${name}\n`,
          }
        : {
            parent: parentPath,
            action: "create_instance",
            className,
            instanceName: name,
          };

      try {
        const res = await fetch("/api/insert-instance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey, payload }),
        });
        if (res.ok) {
          showToast(
            `Inserted ${className} "${name}" into ${parentPath}`,
            "success",
          );
        } else {
          showToast(`Failed to insert ${className}`, "error");
        }
      } catch {
        showToast(`Failed to insert ${className}`, "error");
      }
    },
    [sessionKey, showToast],
  );
  const sessionTokensUsed = messages.reduce((acc, m) => acc + (m.tokensUsed || 0), 0);

  const rankTheme = useMemo(() => {
    const plan = usage?.plan || 'free';
    if (plan === 'pure_ultra') return {
      bg: 'bg-[radial-gradient(circle_at_70%_20%,rgba(124,58,237,0.3),transparent_60%),radial-gradient(circle_at_15%_85%,rgba(91,33,182,0.2),transparent_50%),radial-gradient(circle_at_center,rgba(76,29,149,0.12),transparent_70%)]',
      accent: '#a78bfa',
      accentBg: 'bg-violet-500',
      accentHover: 'hover:bg-violet-400',
      accentText: 'text-violet-400',
      accentGlow: 'shadow-[0_0_25px_rgba(124,58,237,0.5)] border-violet-400/50 animate-pulse-slow',
      borderAccent: 'border-violet-500/20',
      badgeBg: 'bg-violet-500',
      badgeText: 'ULTRA',
      badgeColor: 'text-violet-400',
      btnBg: 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white',
      fixBtnBg: 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white',
    };
    if (plan === 'fresh_pro') return {
      bg: 'bg-[radial-gradient(circle_at_70%_20%,rgba(204,255,0,0.15),transparent_60%),radial-gradient(circle_at_15%_85%,rgba(163,230,53,0.1),transparent_50%),radial-gradient(circle_at_center,rgba(132,204,22,0.08),transparent_70%)]',
      accent: '#ccff00',
      accentBg: 'bg-[#ccff00]',
      accentHover: 'hover:bg-[#d4ff33]',
      accentText: 'text-[#ccff00]',
      accentGlow: 'shadow-[0_0_15px_rgba(204,255,0,0.2)]',
      borderAccent: 'border-[#ccff00]/20',
      badgeBg: 'bg-[#ccff00]',
      badgeText: 'PRO',
      badgeColor: 'text-[#ccff00]',
      btnBg: 'bg-[#ccff00] hover:bg-[#d4ff33] text-black',
      fixBtnBg: 'bg-[#ccff00] hover:bg-[#d4ff33] text-black',
    };
    return {
      bg: 'bg-[radial-gradient(circle_at_70%_20%,rgba(29,78,216,0.25),transparent_60%),radial-gradient(circle_at_15%_85%,rgba(37,99,235,0.15),transparent_50%),radial-gradient(circle_at_center,rgba(30,58,138,0.1),transparent_70%)]',
      accent: '#3b82f6',
      accentBg: 'bg-blue-500',
      accentHover: 'hover:bg-blue-400',
      accentText: 'text-blue-400',
      accentGlow: '',
      borderAccent: 'border-blue-500/20',
      badgeBg: 'bg-white/10',
      badgeText: 'FREE',
      badgeColor: 'text-white/50',
      btnBg: 'bg-white hover:bg-zinc-200 text-black',
      fixBtnBg: 'bg-white hover:bg-zinc-200 text-black',
    };
  }, [usage?.plan]);

  const handleRevert = useCallback(
    async (message: ChatMessage) => {
      const plan = usage.plan || "free";
      const assistantMsgs = messages.filter((m) => m.role === "assistant");
      const idx = assistantMsgs.findIndex((m) => m.id === message.id);
      if (idx === -1) return;

      const msgsFromEnd = assistantMsgs.length - 1 - idx;
      const limit =
        plan === "pure_ultra" ? 10 : plan === "fresh_pro" ? 3 : 1;

      if (msgsFromEnd >= limit) {
        showToast(
          `Revert limit reached for your plan (${limit} message${limit > 1 ? "s" : ""}).`,
          "error",
        );
        return;
      }

      showToast("Reverting changes in Studio...", "info");

      const scriptsToRevert = message.scripts || (message.script ? [message.script] : []);
      if (scriptsToRevert.length === 0) {
        showToast("No scripts to revert in this message.", "error");
        return;
      }

      // Build inverse payload
      const revertPayload = scriptsToRevert.map((s) => {
        // If it was a create, we delete it
        if (s.action === "create" || !s.action) {
          return { ...s, action: "delete" };
        }
        // If it was an edit or delete, we restore originalCode
        return {
          ...s,
          action: "create", // Re-create with original code
          code: s.originalCode || "",
        };
      });

      try {
        const res = await fetch("/api/revert-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionKey, scripts: revertPayload }),
        });

        if (res.ok) {
          showToast("Game state reverted successfully!", "success");
          setMessages((msgs) =>
            msgs.map((m) =>
              m.id === message.id
                ? { ...m, pendingSync: false, isReverted: true }
                : m,
            ),
          );
        } else {
          showToast("Failed to revert code in Studio.", "error");
        }
      } catch (err) {
        showToast("Connection error during revert.", "error");
      }
    },
    [messages, sessionKey, usage.plan, showToast],
  );

  return (
    <main className="h-screen bg-[#060a12] text-white flex overflow-hidden font-sans relative">
      {/*     PREMIUM FIXED GRADIENT BACKGROUND     */}
      <div className={`fixed inset-0 ${rankTheme.bg} pointer-events-none z-0 transition-all duration-1000`} />
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none z-0" />
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-[#080c16]/30 to-[#0a0e1a]/90 pointer-events-none z-0" />

      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-[#0b101b]/90 backdrop-blur-xl border-b border-white/[0.04] flex items-center justify-between px-4 z-[50]">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-[#ccff00] shadow-[0_0_10px_rgba(204,255,0,0.2)]">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-black"
              fill="currentColor"
            >
              <path d="M5.2 6.5L7.5 3h9l2.3 3.5H5.2z" fillOpacity="0.8" />
              <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5z" />
              <path
                d="M15 3V1.5A1.5 1.5 0 0 0 13.5 0H12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M14.5 14.5c0 1.5-1 2.5-2.5 2.5s-2.5-1-2.5-2.5 1-2.5 2.5-2.5c.3 0 .7.1 1 .2-.3.4-.3 1 0 1.4.3.4.9.4 1.3.1.1.2.2.5.2.8zM12.5 11c0-1-.8-1.5-1.5-1.5 0 1 .8 1.5 1.5 1.5z"
                fill="#ccff00"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-tight text-lg leading-none">
              Apple Juice
            </span>
            <span className="text-[8px] text-white/20 mt-0.5 italic leading-none">
              Made from developers to developers
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-white/70 hover:text-white p-2 focus:outline-none"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[55] md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-[60] w-[260px] md:w-[220px] flex-shrink-0 border-r border-white/[0.04] bg-[#080c16]/80 backdrop-blur-xl flex flex-col justify-between transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg ${rankTheme.accentBg} transition-colors duration-500`}>
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-black"
                fill="currentColor"
              >
                <path d="M5.2 6.5L7.5 3h9l2.3 3.5H5.2z" fillOpacity="0.8" />
                <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5z" />
                <path
                  d="M15 3V1.5A1.5 1.5 0 0 0 13.5 0H12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M14.5 14.5c0 1.5-1 2.5-2.5 2.5s-2.5-1-2.5-2.5 1-2.5 2.5-2.5c.3 0 .7.1 1 .2-.3.4-.3 1 0 1.4.3.4.9.4 1.3.1.1.2.2.5.2.8zM12.5 11c0-1-.8-1.5-1.5-1.5 0 1 .8 1.5 1.5 1.5z"
                  fill="#ccff00"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-tight text-lg leading-none">
                  Apple Juice
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-widest font-bold leading-none mt-0.5 ${rankTheme.badgeBg} ${rankTheme.badgeColor} transition-colors duration-500`}>
                  {rankTheme.badgeText}
                </span>
              </div>
              <span className="text-[9px] text-white/20 mt-1 italic">
                Made from developers to developers
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              const name = window.prompt("Enter project name:", "New Project");
              if (name) {
                void createNewProject(name);
              }
            }}
            className={`w-full font-semibold py-2 rounded-xl transition-all flex items-center justify-center gap-2 text-[13px] ${rankTheme.btnBg} ${rankTheme.accentGlow}`}
          >
            + New Project
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 space-y-6">
            <div>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest block mb-3">
                Projects
              </span>
              <div className="space-y-1">
                {isProjectsLoading ? (
                  <div className="text-[11px] text-white/20 animate-pulse px-3">
                    Loading projects...
                  </div>
                ) : (
                  projects.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => switchProject(p)}
                      className={`group relative text-[13px] cursor-pointer py-2 px-3 rounded-xl transition-all flex items-center justify-between ${
                        activeProjectId === p.id
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/50 hover:bg-white/[0.03] hover:text-white/80"
                      }`}
                    >
                      <span className="truncate flex-1 pr-2">{p.name}</span>
                      {activeProjectId === p.id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const n = window.prompt(
                                "Rename project:",
                                p.name,
                              );
                              if (n) renameProject(p.id, n);
                            }}
                            className="p-1 hover:text-white transition-colors"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProject(p.id);
                            }}
                            className="p-1 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {agLinked && (
            <div className="bg-[#ccff00]/5 border border-[#ccff00]/10 rounded-xl p-3 space-y-2 mx-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#ccff00] uppercase tracking-widest">
                  Antigravity
                </span>
                <div className="flex h-1.5 w-1.5 rounded-full bg-[#ccff00]" />
              </div>
              {agBalance?.quotas.map((q, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[11px] text-white/80 font-medium">
                    {q.model}
                  </span>
                  <span className="text-[9px] text-white/40">
                    Refreshes in {q.refreshesIn}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Settings removed from sidebar per user request */}

          {/* Plugin Status Summary */}
          <div className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`relative flex h-2 w-2`}>
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${isPluginConnected ? "bg-emerald-400" : "bg-amber-400"}`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${isPluginConnected ? "bg-emerald-400" : "bg-amber-400"}`}
                />
              </span>
              <span className="text-[11px] font-medium text-white/80">
                {isPluginConnected ? "Connected" : "Waiting"}
              </span>
            </div>
            <p
              className="text-[10px] text-white/40 leading-snug truncate"
              title={pluginStatus}
            >
              {pluginStatus}
            </p>
          </div>

          {/* Share Session */}
          {sessionKey && (
            <button
              onClick={copyShareLink}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.04] text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all"
            >
              <Share2 className="h-3 w-3" />
              <span>Share Session</span>
              <span className="ml-auto text-[9px] font-mono text-white/20 truncate max-w-[80px]">
                {sessionKey.slice(0, 8)}{" "}
              </span>
            </button>
          )}

          {/* Roblox Explorer Tree */}
          {projectTree.length > 0 && (
            <div className="flex flex-col gap-2">
              <div
                className="overflow-y-auto overflow-x-hidden custom-scrollbar -mx-5 px-0"
                style={{ maxHeight: "calc(100vh - 380px)" }}
              >
                <WorkspaceTree
                  paths={projectTree}
                  onAddInstance={handleAddInstance}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  selectedPaths={selectedTreePaths}
                  onSelectionChange={setSelectedTreePaths}
                />
              </div>
              {selectedTreePaths.length > 0 && (
                <button
                  onClick={() => {
                    const fileMentions = selectedTreePaths
                      .map((p) => `@${p}`)
                      .join(", ");
                    const promptText = `Please analyze and fix any bugs in the following files: ${fileMentions}. If there are errors, please resolve them completely.`;
                    setPrompt(promptText);

                    // Trigger fetching the files to attach them
                    selectedTreePaths.forEach((file) => {
                      fetch("/api/request-file", {
                        method: "POST",
                        body: JSON.stringify({
                          key: sessionKey,
                          fileName: file,
                        }),
                      }).catch(() => {});
                    });

                    // We don't submit immediately to let the user see the prompt and files attach,
                    // or we could auto-submit. The instructions say "sends the specified files to the ai".
                    // Let's submit after a short delay to allow files to attach.
                    setTimeout(() => submitPrompt(promptText), 500);
                    setSelectedTreePaths([]);
                  }}
                  className={`w-full font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-2 text-[13px] ${rankTheme.fixBtnBg} ${rankTheme.accentGlow}`}
                >
                  <Sparkles className="w-4 h-4" />
                  Fix Bugs ({selectedTreePaths.length})
                </button>
              )}
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
          <button
            className="w-full text-white/30 hover:text-white py-1.5 rounded-xl text-[11px] transition-colors"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full bg-transparent relative overflow-hidden pt-14 md:pt-0">
        {/* Top Right Header */}
        <header className="absolute top-14 md:top-0 right-0 p-3 md:p-6 flex items-center gap-2 md:gap-4 z-40 pointer-events-none w-full justify-end">
          <div className="pointer-events-auto flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setShowPricing(true)}
              className="hidden md:block bg-[#10b981] text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer hover:bg-[#0ea5e9] transition-all"
            >
              Store Purchases
            </button>
            {/* Profile avatar with dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu((p) => !p)}
                className="focus:outline-none flex items-center justify-center"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    className="w-8 h-8 rounded-full ring-2 ring-white/10 hover:ring-[#ccff00]/40 transition-all cursor-pointer object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold ring-2 ring-white/10 hover:ring-[#ccff00]/40 transition-all cursor-pointer">
                    {username.charAt(0)}
                  </div>
                )}
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 top-11 w-48 bg-[#0b101b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-[100]">
                <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-sm font-semibold text-white truncate">
                      {username}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        usage.plan === 'pure_ultra' ? 'bg-[#7c3aed]/20 text-[#7c3aed]' :
                        usage.plan === 'fresh_pro' ? 'bg-[#ccff00]/10 text-[#ccff00]' :
                        'bg-white/5 text-white/40'
                      }`}>
                        {usage.plan === 'pure_ultra' ? 'Ultra' : usage.plan === 'fresh_pro' ? 'Pro' : 'Free'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowSettings((s) => !s);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      setShowDebug((d) => !d);
                      setShowProfileMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${showDebug ? "text-[#ccff00] bg-[#ccff00]/5" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                  >
                    <Network className="h-3.5 w-3.5" />
                    {showDebug ? "Hide Auto-Fix Logs" : "Show Auto-Fix Logs"}
                  </button>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors flex items-center gap-2 border-t border-white/5"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {/* Conditional Rendering: Lobby vs Chat */}
        {!activeProjectId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-[#ccff00]/20 to-transparent border border-[#ccff00]/10 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="h-10 w-10 text-[#ccff00]"
                fill="currentColor"
              >
                <path d="M5.2 6.5L7.5 3h9l2.3 3.5H5.2z" fillOpacity="0.8" />
                <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5z" />
                <path
                  d="M15 3V1.5A1.5 1.5 0 0 0 13.5 0H12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M14.5 14.5c0 1.5-1 2.5-2.5 2.5s-2.5-1-2.5-2.5 1-2.5 2.5-2.5c.3 0 .7.1 1 .2-.3.4-.3 1 0 1.4.3.4.9.4 1.3.1.1.2.2.5.2.8zM12.5 11c0-1-.8-1.5-1.5-1.5 0 1 .8 1.5 1.5 1.5z"
                  fill="#ccff00"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-3">
              Welcome to Apple Juice
            </h1>
            <p className="text-white/40 max-w-md text-sm leading-relaxed mb-8">
              Select an existing project from the sidebar to continue your work,
              or create a new one to start building a new game mechanic.
            </p>
            <button
              onClick={() => {
                const name = window.prompt(
                  "Enter project name:",
                  "New Project",
                );
                if (name) {
                  void createNewProject(name);
                }
              }}
              className="bg-[#ccff00] text-black px-6 py-3 rounded-xl font-bold hover:bg-[#d4ff33] transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Create New Project
            </button>
          </div>
        ) : (
          <>
            {/* Dynamic Chat Area */}
            <div className="flex-1 overflow-y-auto relative z-10 flex flex-col w-full items-center">
              {messages.length == 0 && (
                /* EMPTY STATE BACKGROUND */
                <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-0">
                  <div className="relative w-full max-w-5xl h-[600px] flex items-center justify-center">
                    <div className="absolute top-[15%] left-[5%] w-48 h-32 bg-[#16191f]/80 rounded-xl opacity-40 rotate-[-8deg] blur-[2px] overflow-hidden border border-white/5">
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 mix-blend-overlay"></div>
                    </div>
                    <div className="absolute top-[20%] right-[10%] w-56 h-36 bg-[#16191f]/80 rounded-xl opacity-50 rotate-[6deg] blur-[1px] overflow-hidden border border-white/5">
                      <div className="w-full h-full bg-gradient-to-bl from-[#ccff00]/10 to-transparent mix-blend-overlay"></div>
                    </div>
                    <div className="absolute bottom-[20%] left-[15%] w-40 h-28 bg-[#16191f]/80 rounded-xl opacity-30 rotate-[12deg] blur-[3px] overflow-hidden border border-white/5">
                      <div className="w-full h-full bg-gradient-to-tr from-sky-500/10 to-transparent mix-blend-overlay"></div>
                    </div>
                    <div className="absolute bottom-[15%] right-[20%] w-64 h-40 bg-[#16191f]/80 rounded-xl opacity-60 rotate-[-4deg] overflow-hidden border border-white/5">
                      <div className="w-full h-full bg-gradient-to-tl from-emerald-500/10 to-transparent mix-blend-overlay"></div>
                    </div>
                  </div>
                </div>
              )}

              {messages.length > 0 && (
                /* CHAT MESSAGES */
                <div className="flex-1 flex flex-col pt-24 pb-56 px-4 md:px-10 lg:px-20 max-w-5xl w-full">
                  <div className="space-y-4">
                    {messages
                      .filter((m) => showDebug || !m.isHidden)
                      .map((message) => (
                        <div
                          key={message.id}
                          className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${message.role == "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] sm:max-w-[72%] px-4 py-3.5 rounded-xl text-[14px] leading-relaxed ${
                              message.role == "user"
                                ? "bg-[#1a1d24] text-white border border-[#ccff00]/30"
                                : "bg-[#1a1d24] text-white border border-white/10"
                            }`}
                          >
                            {message.isHidden && (
                              <div className="mb-2 px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-[9px] text-violet-300 uppercase font-bold tracking-widest flex items-center gap-1.5 self-start">
                                <div className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
                                Background Auto-Fix Loop
                              </div>
                            )}
                            <div className="space-y-3">
                              {message.attachments &&
                                message.attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {message.attachments.map((a, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/40"
                                      >
                                        <Paperclip className="h-2.5 w-2.5" />
                                        {a.name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                              {message.attachedAsset && (
                                <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-purple-500/20 text-[11px] text-white/90 mb-2">
                                  <img
                                    src={message.attachedAsset.thumbnail}
                                    className="w-5 h-5 rounded object-cover"
                                  />
                                  <span className="truncate max-w-[150px]">
                                    {message.attachedAsset.name}
                                  </span>
                                </div>
                              )}

                              <p className="whitespace-pre-wrap leading-relaxed text-white/90">
                                {message.content}
                              </p>

                              {message.thinking && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                  <details className="group bg-[#111318] border border-white/10 rounded-xl overflow-hidden">
                                    <summary className="cursor-pointer text-[12px] font-bold text-violet-300/80 hover:text-violet-200 hover:bg-white/5 transition-all flex items-center justify-between px-4 py-3 select-none list-none [&::-webkit-details-marker]:hidden border-b border-white/5">
                                      <div className="flex items-center gap-3">
                                        <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 group-open:animate-pulse">
                                          <Brain className="h-4 w-4" />
                                        </div>
                                        <span className="tracking-wide uppercase text-[10px]">
                                          Reasoning
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono opacity-40 uppercase">
                                          {message.thinking.length > 500
                                            ? "Deep Analysis"
                                            : "Detailed"}
                                        </span>
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5 group-open:rotate-180 transition-transform duration-300">
                                          <svg
                                            width="10"
                                            height="6"
                                            viewBox="0 0 10 6"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="stroke-violet-400/60"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="M1 1L5 5L9 1" />
                                          </svg>
                                        </div>
                                      </div>
                                    </summary>
                                    <div className="p-5 text-[13px] leading-relaxed text-white/60 whitespace-pre-wrap bg-[#16191f] font-medium selection:bg-violet-500/30 selection:text-white backdrop-blur-md">
                                      {message.thinking}
                                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[10px] text-white/20 italic">
                                        <Sparkles className="h-3 w-3" />
                                        <span>
                                          Reasoning generated by Advanced Apple
                                          Juice Logic
                                        </span>
                                      </div>
                                    </div>
                                  </details>
                                </div>
                              )}

                              {message.script && (
                                <ScriptCard script={message.script} />
                              )}

                              {message.scripts &&
                                message.scripts.length > 0 && (
                                  <div className="space-y-2 w-full max-w-[500px]">
                                    {message.scripts.length > 1 && (
                                      <SystemArchitecture
                                        scripts={message.scripts}
                                      />
                                    )}
                                    <p className="text-[11px] font-medium text-white/20 tracking-tight uppercase ml-1">
                                      {message.scripts.length} instances created
                                    </p>
                                    {message.scripts.map((s, i) => (
                                      <ScriptCard key={i} script={s} />
                                    ))}
                                  </div>
                                )}

                              {message.suggestions &&
                                message.suggestions.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                                    <div className="flex flex-wrap gap-1.5">
                                      {message.suggestions.map((sugg, i) => (
                                        <button
                                          key={i}
                                          className="text-[12px] px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                                          onClick={() => setPrompt(sugg)}
                                        >
                                          {sugg}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {message.pendingSync && (
                                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between gap-3">
                                    <button
                                      onClick={() => handleRevert(message)}
                                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400 font-bold hover:bg-red-500/20 transition-all"
                                      title="Restore game state to before this prompt"
                                    >
                                      <Undo2 className="h-3.5 w-3.5" />
                                      Revert
                                    </button>

                                    <button
                                      className="flex-1 bg-[#ccff00] text-black font-bold px-5 py-2 rounded-xl text-[13px] hover:bg-[#d4ff33] transition-all flex items-center justify-center gap-2"
                                      onClick={async () => {
                                        showToast("Accepting changes...", "info");
                                        
                                        // If this was a streamed message, we need to push the payload first
                                        // because it was never stored as 'pendingCode' on the server.
                                        const scripts = message.scripts || (message.script ? [message.script] : []);
                                        
                                        // Use /api/revert-code (forced sync) if we have explicit scripts
                                        const endpoint = scripts.length > 0 ? "/api/revert-code" : "/api/accept-code";
                                        const body = scripts.length > 0 ? { sessionKey, scripts } : { sessionKey };

                                        const res = await fetch(endpoint, {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify(body),
                                        });

                                        if (res.ok) {
                                          showToast(
                                            "Changes sent to Roblox Studio!",
                                            "success",
                                          );
                                          setMessages((msgs) =>
                                            msgs.map((m) =>
                                              m.id === message.id
                                                ? { ...m, pendingSync: false }
                                                : m,
                                            ),
                                          );
                                        } else {
                                          showToast(
                                            "Failed to sync code.",
                                            "error",
                                          );
                                        }
                                      }}
                                    >
                                      Accept & Sync to Studio
                                    </button>
                                  </div>
                                )}

                                {message.isReverted && (
                                  <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[11px] text-red-400/60 font-bold italic">
                                    <Undo2 className="h-3 w-3" />
                                    Changes Reverted
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  {isGenerating && <ThinkingFeed steps={thinkingSteps} isDeepSeek={selectedModel.toLowerCase().includes("deepseek")} />}
                  <div ref={chatEndRef} className="h-px w-full mt-4" />
                </div>
              )}
            </div>

            {/* The Universal Input Bar wrapper */}
            <div
              className={`transition-all duration-700 ease-in-out ${messages.length == 0 ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl px-4 z-30 bg-transparent" : "absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/95 to-transparent pt-12 pb-6 px-4 flex justify-center z-20"}`}
            >
              <div className="w-full flex flex-col items-center">
                {messages.length == 0 && (
                  <div className="text-center mb-6">
                    <h1 className="text-[32px] md:text-[42px] font-black uppercase tracking-tight text-white leading-tight">
                      DESCRIBE A{" "}
                      <span className="text-[#ccff00]">GAME MECHANIC</span>
                    </h1>
                  </div>
                )}

                <div
                  className={`w-full ${messages.length == 0 ? "bg-[#1a1d24] border border-white/10" : "max-w-4xl bg-[#1a1d24] border border-white/10"} rounded-xl p-3`}
                >
                  <div className="w-full space-y-3">
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {attachedAsset && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/[0.06] border border-purple-500/30 text-[11px] text-white/90">
                            <img
                              src={attachedAsset.thumbnail}
                              className="w-4 h-4 rounded-sm object-cover"
                            />
                            <span className="truncate max-w-[120px]">
                              {attachedAsset.name}
                            </span>
                            <button
                              onClick={() => setAttachedAsset(null)}
                              className="ml-0.5 text-white/40 hover:text-white transition-colors"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        )}
                        {attachedFiles.map((f, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/[0.12] text-[11px] text-white/80"
                          >
                            <Paperclip className="h-2.5 w-2.5" />
                            {f.name}
                            <button
                              onClick={() =>
                                setAttachedFiles((prev) =>
                                  prev.filter((_, idx) => idx != i),
                                )
                              }
                              className="ml-0.5 hover:text-white transition-colors"
                            >
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
                          const lastAt = textBeforeCursor.lastIndexOf("@");

                          if (
                            lastAt != -1 &&
                            (lastAt == 0 || textBeforeCursor[lastAt - 1] == " ")
                          ) {
                            const filter = textBeforeCursor.slice(lastAt + 1);
                            if (!filter.includes(" ")) {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setAtMenu({
                                visible: true,
                                x: rect.left,
                                y: rect.top - 120,
                                filter,
                                selectionIndex: 0,
                              });
                              return;
                            }
                          }
                          setAtMenu((prev) => ({ ...prev, visible: false }));
                        }}
                        onKeyDown={(e) => {
                          if (atMenu.visible) {
                            const filtered = projectTree.filter((f) =>
                              f
                                .toLowerCase()
                                .includes(atMenu.filter.toLowerCase()),
                            );
                            if (e.key == "ArrowDown") {
                              e.preventDefault();
                              setAtMenu((prev) => ({
                                ...prev,
                                selectionIndex:
                                  (prev.selectionIndex + 1) % filtered.length,
                              }));
                            } else if (e.key == "ArrowUp") {
                              e.preventDefault();
                              setAtMenu((prev) => ({
                                ...prev,
                                selectionIndex:
                                  (prev.selectionIndex - 1 + filtered.length) %
                                  filtered.length,
                              }));
                            } else if (e.key == "Enter" || e.key == "Tab") {
                              e.preventDefault();
                              const selected = filtered[atMenu.selectionIndex];
                              if (selected) {
                                const textBeforeAt = prompt.slice(
                                  0,
                                  prompt.lastIndexOf("@"),
                                );
                                const textAfterAt = prompt.slice(
                                  e.currentTarget.selectionStart,
                                );
                                setPrompt(
                                  textBeforeAt +
                                    "@" +
                                    selected +
                                    " " +
                                    textAfterAt,
                                );
                                setAtMenu((prev) => ({
                                  ...prev,
                                  visible: false,
                                }));

                                fetch("/api/request-file", {
                                  method: "POST",
                                  body: JSON.stringify({
                                    key: sessionKey,
                                    fileName: selected,
                                  }),
                                }).catch(() => {});
                              }
                            } else if (e.key == "Escape") {
                              setAtMenu((prev) => ({
                                ...prev,
                                visible: false,
                              }));
                            }
                          } else if (e.key == "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submitPrompt();
                          }
                        }}
                        placeholder={
                          !isPluginConnected
                            ? "Connect your Roblox Studio plugin to start building..."
                            : prompt == "" && messages.length == 0
                              ? placeholderText
                              : "Ask the AI to build something... (use @ to mention a script)"
                        }
                        className="min-h-[70px] max-h-[250px] w-full resize-none bg-transparent border-transparent px-2 pt-2 text-[15px] text-white placeholder:text-white/30 focus-visible:ring-0 focus:outline-none rounded-none"
                        disabled={isGenerating}
                      />

                      {atMenu.visible && (
                        <div
                          className="fixed z-[200] w-64 bg-[#16191f] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                          style={{
                            left: atMenu.x,
                            top:
                              atMenu.y -
                              Math.min(
                                projectTree.filter((f) =>
                                  f
                                    .toLowerCase()
                                    .includes(atMenu.filter.toLowerCase()),
                                ).length,
                                5,
                              ) *
                                40,
                          }}
                        >
                          <div className="px-3 py-2 border-b border-white/5 bg-white/5">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                              Select Script
                            </span>
                          </div>
                          <div className="max-h-[200px] overflow-y-auto">
                            {projectTree
                              .filter((f) =>
                                f
                                  .toLowerCase()
                                  .includes(atMenu.filter.toLowerCase()),
                              )
                              .slice(0, 10)
                              .map((file, i) => (
                                <div
                                  key={file}
                                  className={`px-4 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors ${i == atMenu.selectionIndex ? "bg-[#ccff00]/10 text-[#ccff00]" : "text-white/60 hover:bg-white/5"}`}
                                  onClick={() => {
                                    const textBeforeAt = prompt.slice(
                                      0,
                                      prompt.lastIndexOf("@"),
                                    );
                                    const textAfterAt = prompt.slice(
                                      prompt.lastIndexOf("@") +
                                        atMenu.filter.length +
                                        1,
                                    );
                                    setPrompt(
                                      textBeforeAt +
                                        "@" +
                                        file +
                                        " " +
                                        textAfterAt,
                                    );
                                    setAtMenu((prev) => ({
                                      ...prev,
                                      visible: false,
                                    }));
                                    fetch("/api/request-file", {
                                      method: "POST",
                                      body: JSON.stringify({
                                        key: sessionKey,
                                        fileName: file,
                                      }),
                                    }).catch(() => {});
                                  }}
                                >
                                  <Brain className="h-3.5 w-3.5 opacity-50" />
                                  <span className="truncate">{file}</span>
                                </div>
                              ))}
                            {projectTree.filter((f) =>
                              f
                                .toLowerCase()
                                .includes(atMenu.filter.toLowerCase()),
                            ).length == 0 && (
                              <div className="px-4 py-3 text-xs text-white/30 italic">
                                No scripts found...
                              </div>
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
                        Array.from(files).forEach((file) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setAttachedFiles((prev) => [
                              ...prev,
                              {
                                name: file.name,
                                content: reader.result as string,
                              },
                            ]);
                          };
                          reader.readAsText(file);
                        });
                        e.target.value = "";
                      }}
                    />

                    <div className="flex items-center justify-between gap-2 md:gap-3 pt-2 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar flex-1 min-w-0">
                        {/* Mode toggle */}
                        <div className="relative flex items-center bg-black/20 rounded-xl border border-white/[0.04] p-0.5 w-[140px] flex-shrink-0">
                          {/* Sliding pill background */}
                          <div
                            className="absolute top-0.5 bottom-0.5 rounded-lg transition-all duration-300 ease-in-out"
                            style={{
                              left: mode === "fast" ? "2px" : "50%",
                              width: "calc(50% - 2px)",
                              background:
                                mode === "fast"
                                  ? "white"
                                  : "rgba(139, 92, 246, 0.15)",
                            }}
                          />
                          <button
                            onClick={() => setMode("fast")}
                            className={`relative z-10 flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-200 ${
                              mode == "fast"
                                ? "text-black"
                                : "text-white/40 hover:text-white/70"
                            }`}
                          >
                            <Zap className="h-3 w-3" />
                            Fast
                          </button>
                          <button
                            onClick={() => setMode("thinking")}
                            className={`relative z-10 flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-200 ${
                              mode == "thinking"
                                ? "text-violet-400"
                                : "text-white/40 hover:text-white/70"
                            }`}
                          >
                            <Brain className="h-3 w-3" />
                            Think
                          </button>
                        </div>

                        <button
                          onClick={() => setIsDeepIntelligence(!isDeepIntelligence)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all border ${
                            isDeepIntelligence 
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]" 
                              : "bg-white/[0.02] border-white/[0.04] text-white/30 hover:text-white/60"
                          }`}
                          title="Deep Intelligence: AI scans your entire project structure for better results"
                        >
                          <Brain className={`h-3 w-3 ${isDeepIntelligence ? "animate-pulse" : ""}`} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Deep Intelligence</span>
                        </button>

                        <button
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-white/40 hover:text-white hover:bg-white/[0.05] transition-all"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          Attach
                        </button>

                        <button
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all ${autoEnhance ? "text-[#ccff00] bg-[#ccff00]/10 border border-[#ccff00]/20" : "text-white/40 hover:text-white hover:bg-white/[0.05] border border-transparent"}`}
                          onClick={() => setAutoEnhance(!autoEnhance)}
                          title="AI will review and improve your prompt before generating"
                        >
                          <Sparkles className="h-3 w-3" />
                          Enhance
                        </button>


                      </div>

                      <div className="flex items-center gap-2">
                        {lastError && (
                          <>
                            {!lastError.toLowerCase().includes("out of juice") && (
                              <button
                                className="px-3 py-2 rounded-xl text-[12px] font-medium text-[#ccff00] hover:bg-[#ccff00]/10 border border-[#ccff00]/20 transition-all"
                                onClick={() => {
                                  setPrompt(lastPromptRef.current);
                                  submitPrompt(lastPromptRef.current);
                                }}
                                disabled={isGenerating}
                              >
                                Retry
                              </button>
                            )}
                            {!lastError.toLowerCase().includes("out of juice") && !lastError.toLowerCase().includes("limit reached") && !lastError.toLowerCase().includes("failed to generate") && !lastError.toLowerCase().includes("experiencing high demand") && (
                              <button
                                className="px-3 py-2 rounded-xl text-[12px] font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
                                onClick={handleAutoFix}
                                disabled={isGenerating}
                              >
                                Repair
                              </button>
                            )}
                            {!lastError.toLowerCase().includes("out of juice") && (
                              <button
                                className="p-2 rounded-xl text-white/30 hover:text-white/60 transition-all"
                                onClick={() => setLastError(null)}
                                title="Dismiss Error"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </>
                        )}
                        {isGenerating ? (
                          <button
                            onClick={() => {
                              if (abortControllerRef.current) {
                                abortControllerRef.current.abort();
                              }
                            }}
                            title="Stop Generation"
                            className="p-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <rect
                                x="7"
                                y="7"
                                width="10"
                                height="10"
                                rx="1.5"
                              />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => submitPrompt()}
                            disabled={isGenerating || prompt.trim() == ""}
                            className={`p-2 rounded-xl disabled:opacity-40 transition-all disabled:shadow-none ${usage?.plan === 'pure_ultra' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-400 hover:to-purple-500 shadow-[0_0_20px_rgba(124,58,237,0.4)]' : 'bg-white text-black hover:bg-zinc-200'}`}
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 px-1">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => {
                            if(
                              confirm(
                                "Are you sure you want to clear your chat history?",
                              )
                            ) {
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
                            if (isAnalyzing || !isPluginConnected) return;
                            setIsAnalyzing(true);
                            const allCode = lastGeneratedScriptsRef.current
                              .map((s) => `--- ${s.name} ---\n${s.code}`)
                              .join("\n\n");
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
                          disabled={!isPluginConnected || isAnalyzing}
                          className={`flex items-center gap-1.5 text-[11px] transition-colors ${!isPluginConnected ? "opacity-30 cursor-not-allowed text-white/20" : isAnalyzing ? "text-violet-400 animate-pulse" : "text-white/20 hover:text-violet-400/60"}`}
                        >
                          <LayoutDashboard className="h-3 w-3" />
                          {isAnalyzing ? "Analyzing..." : "Analyze Project"}
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="bg-black/20 text-[11px] text-white/60 hover:text-white hover:bg-white/[0.05] border border-white/[0.04] rounded-lg px-2 py-1.5 outline-none focus:border-white/20 transition-all custom-scrollbar max-w-[120px] truncate cursor-pointer appearance-none"
                          title="Select Model"
                        >
                          {availableModels.map((m) => (
                            <option key={m} value={m} className="bg-[#080c16] text-white">
                              {m}
                            </option>
                          ))}
                        </select>

                        {sessionTokensUsed > 0 && (
                          <div 
                            className="text-[10px] flex items-center gap-1 text-white/40 bg-white/[0.02] border border-white/[0.04] px-2 py-1 rounded-lg truncate max-w-[100px]"
                            title={`Session Usage: ${(sessionTokensUsed / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ml`}
                          >
                            <span className="w-2 h-2 rounded-full bg-violet-500/50 flex-shrink-0" />
                            {(sessionTokensUsed / 1000).toFixed(1)} ml
                          </div>
                        )}

                        {(provider == "google" ? googleKey.trim() : openaiKey.trim()).length == 0 ? (() => {
                          const mlAvailable = usage.remainingMl !== undefined 
                            ? usage.remainingMl 
                            : Math.max(0, (usage.totalMl || 2000) - (usage.usedMl || 0));
                          const pct = Math.max(0, Math.min(100, (mlAvailable / Math.max(1, usage.totalMl || 2000)) * 100));
                          const hue = Math.round(pct * 1.2);
                          const planLabel = usage.plan === 'pure_ultra' ? 'Ultra' : usage.plan === 'fresh_pro' ? 'Pro' : 'Free';
                          return (
                            <div 
                              onClick={() => setShowPricing(true)}
                              className="hidden sm:flex relative h-7 bg-black/50 rounded-lg overflow-hidden border border-white/[0.08] items-center gap-2 px-2.5 group cursor-pointer hover:border-[#ccff00]/30 transition-all"
                            >
                              <span className={`text-[9px] font-bold z-10 flex-shrink-0 uppercase tracking-wider ${
                                usage.plan === 'pure_ultra' ? 'text-[#7c3aed]' : 
                                usage.plan === 'fresh_pro' ? 'text-[#ccff00]' : 
                                'text-white/60'
                              }`}>{planLabel}</span>
                              <div className="flex items-baseline gap-1 z-10">
                                <span className="text-[10px] font-mono font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                  {mlAvailable.toLocaleString()} mL
                                </span>
                                <span className="text-[8px] text-white/30 font-medium leading-none">
                                  / {(usage.totalMl || 2000).toLocaleString()}
                                </span>
                              </div>
                              <div
                                className="absolute left-0 bottom-0 top-0 transition-all duration-1000 opacity-30"
                                style={{
                                  width: `${pct}%`,
                                  background: `linear-gradient(90deg, hsla(${hue}, 100%, 50%, 0.8), hsla(${hue}, 100%, 65%, 1))`,
                                }}
                              />
                            </div>
                          );
                        })() : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {messages.length == 0 && isPluginConnected && (
                <div className="mt-8 flex flex-col items-center gap-4 w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 relative z-10">
                  <p className="text-[10px] text-white/20 uppercase font-bold tracking-widest mb-2">
                    Quick Start Blueprints
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      className="flex items-center gap-2.5 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 rounded-full text-[13px] font-medium text-white/60 hover:text-white transition-all shadow-xl group"
                      onClick={() =>
                        submitPrompt(
                          "Create a professional sword combat system with raycast hit detection, 3-hit combos, and server-side hit validation.",
                        )
                      }
                    >
                      <span className="text-[16px] group-hover:scale-110 transition-transform">
                        {" "}
                      </span>{" "}
                      Sword Combat System
                    </button>
                    <button
                      className="flex items-center gap-2.5 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 rounded-full text-[13px] font-medium text-white/60 hover:text-white transition-all shadow-xl group"
                      onClick={() =>
                        submitPrompt(
                          "Build a premium Round System with an Intermission timer, Map Voting UI, and automated player teleportation logic.",
                        )
                      }
                    >
                      <span className="text-[16px] group-hover:scale-110 transition-transform">
                        {" "}
                      </span>{" "}
                      Advanced Round System
                    </button>
                    <button
                      className="flex items-center gap-2.5 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 rounded-full text-[13px] font-medium text-white/60 hover:text-white transition-all shadow-xl group"
                      onClick={() =>
                        submitPrompt(
                          "Create a high-end Shop UI with categories, item previews, and a robust DataStore-backed coin currency system.",
                        )
                      }
                    >
                      <span className="text-[16px] group-hover:scale-110 transition-transform">
                        {" "}
                      </span>{" "}
                      Premium Item Shop
                    </button>
                    <button
                      className="flex items-center gap-2.5 px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 rounded-full text-[13px] font-medium text-white/60 hover:text-white transition-all shadow-xl group"
                      onClick={() =>
                        submitPrompt(
                          "Generate a glassmorphic main menu with smooth transitions, settings (SFX/Music), and a play button that tweens the camera.",
                        )
                      }
                    >
                      <span className="text-[16px] group-hover:scale-110 transition-transform">
                        {" "}
                      </span>{" "}
                      Glassmorphic Menu UI
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {showSettings && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div className="bg-[#1e2028] border border-white/[0.04] rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-white uppercase tracking-wider">
                Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
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
                className="w-full bg-black/20 border border-white/[0.04] text-white/80 text-[13px] py-2 px-3 rounded-xl focus:outline-none focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] transition-all cursor-pointer"
              >
                <option value="openai" className="bg-[#13151a]">
                  OpenAI
                </option>
                <option value="google" className="bg-[#13151a]">
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
                    e.target.value,
                  );
                }}
                className={`w-full bg-black/20 border border-white/[0.04] text-white/80 text-[13px] py-2 px-3 rounded-xl focus:outline-none focus:border-[#ccff00] focus:ring-1 focus:ring-[#ccff00] transition-all cursor-pointer ${isLoadingModels ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {availableModels.map((m) => (
                  <option key={m} value={m} className="bg-[#13151a]">
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
                  className="bg-black/20 border-white/[0.04] focus:border-[#ccff00] rounded-xl text-[13px] pr-10"
                />
              </div>
              <p className="text-[10px] text-white/20 mt-2 italic">
                Your keys are stored locally in your browser.
              </p>
            </div>
            <button
              onClick={saveApiKey}
              className="w-full bg-[#ccff00] text-black font-bold py-2.5 rounded-xl text-[13px] hover:bg-[#d4ff33] transition-all mt-2"
            >
              Save Configuration
            </button>
            
            <div className="mt-4 pt-4 border-t border-white/[0.04]">
              <label className="text-[12px] font-medium text-white/50 mb-2 block">
                Redeem Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={secretCode}
                  onChange={(e) => setSecretCode(e.target.value)}
                  placeholder="Enter code..."
                  className="flex-1 bg-black/20 border border-white/[0.04] rounded-xl px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#ccff00]/50 transition-all"
                />
                <button
                  onClick={handleRedeemCode}
                  disabled={isRedeeming || !secretCode.trim()}
                  className="bg-white/10 text-white px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isRedeeming ? "..." : "Redeem"}
                </button>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-dashed border-white/10 space-y-3">
              <label className="text-[10px] font-black text-[#ccff00] uppercase tracking-[0.2em] block mb-2 opacity-50">
                Admin Debug Tools (Persisted)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={async () => {
                    const data = { plan: 'free', totalMl: 2000, remainingMl: 2000 };
                    setUsage((prev: any) => ({...prev, ...data}));
                    showToast("Plan set to FREE (2,000 mL)", "success");
                    await fetch("/api/usage", { method: "POST", body: JSON.stringify(data) });
                  }}
                  className="text-[9px] font-bold py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-white/60"
                >
                  FREE
                </button>
                <button 
                  onClick={async () => {
                    const data = { plan: 'fresh_pro', totalMl: 10000, remainingMl: 10000 };
                    setUsage((prev: any) => ({...prev, ...data}));
                    showToast("Plan set to PRO (10,000 mL)", "success");
                    await fetch("/api/usage", { method: "POST", body: JSON.stringify(data) });
                  }}
                  className="text-[9px] font-bold py-2 rounded-lg bg-[#ccff00]/10 hover:bg-[#ccff00]/20 border border-[#ccff00]/20 transition-all text-[#ccff00]"
                >
                  PRO
                </button>
                <button 
                  onClick={async () => {
                    const data = { plan: 'pure_ultra', totalMl: 30000, remainingMl: 30000 };
                    setUsage((prev: any) => ({...prev, ...data}));
                    showToast("Plan set to ULTRA (30,000 mL)", "success");
                    await fetch("/api/usage", { method: "POST", body: JSON.stringify(data) });
                  }}
                  className="text-[9px] font-bold py-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-all text-violet-400"
                >
                  ULTRA
                </button>
              </div>
              <button 
                onClick={async () => {
                  const data = { plan: usage.plan, remainingMl: 999999, totalMl: 999999 };
                  setUsage((prev: any) => ({...prev, ...data}));
                  showToast("Juice tank filled to 999k mL!", "success");
                  await fetch("/api/usage", { method: "POST", body: JSON.stringify(data) });
                }}
                className="w-full text-[9px] font-black py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all text-red-400 uppercase tracking-widest"
              >
                Infinite Juice
              </button>
            </div>

            {/* JUICE HISTORY INSIGHTS */}
            <div className="mt-6 pt-6 border-t border-white/[0.04] space-y-3">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block mb-2">
                Usage Insights (Last 20)
              </label>
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                {juiceHistory.length === 0 ? (
                  <p className="text-[10px] text-white/20 italic text-center py-4">No recent generation history</p>
                ) : (
                  juiceHistory.map((item, i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/[0.03] rounded-lg p-2 flex items-center justify-between group">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] font-bold text-white/80 truncate pr-2">{item.prompt}</span>
                        <span className="text-[8px] text-white/30 uppercase tracking-tighter">{item.model}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono font-bold text-[#ccff00]">{(item.mlUsed / 1000).toFixed(1)}</span>
                        <span className="text-[8px] text-white/20 ml-0.5">ml</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showPricing && (
        <div 
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setShowPricing(false)}
        >
          <div className="bg-[#0f1115] border border-white/10 rounded-[2.5rem] w-full max-w-[1000px] shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden my-auto">
            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ccff00] to-transparent opacity-50" />
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#ccff00]/5 blur-[100px] rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full" />

            <button 
              onClick={() => setShowPricing(false)}
              className="absolute top-6 right-8 text-white/20 hover:text-white transition-all hover:rotate-90 z-20"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="p-8 md:p-12">
              <div className="text-center mb-10">
                <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/40 mb-4">
                  The Developer's Edge
                </div>
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-white mb-2 italic">
                  Stop <span className="text-[#ccff00]">Coding</span>. Start <span className="text-violet-400 text-glow">Building.</span>
                </h2>
                <p className="text-white/40 text-sm max-w-xl mx-auto">
                  Why waste hours debugging or optimizing? Let Apple Juice handle the heavy lifting while you focus on what actually makes your game fun.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {/* FREE TIER */}
                <div className={`group bg-white/[0.02] border rounded-3xl p-6 flex flex-col transition-all duration-500 hover:bg-white/[0.04] ${usage.plan === 'free' ? 'border-[#ccff00]/40 ring-1 ring-[#ccff00]/20' : 'border-white/5'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">Hobbyist</div>
                    {usage.plan === 'free' && <span className="bg-[#ccff00]/10 text-[#ccff00] text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Active</span>}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">Free Sip</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-black text-white italic">0 R$</span>
                    <span className="text-white/20 text-xs">/mo</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-2.5 text-[12px] text-white/60">
                      <Zap className="w-4 h-4 text-[#ccff00] mt-0.5 flex-shrink-0" />
                      <span><strong>2,000 mL</strong> daily quota</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-[12px] text-white/60">
                      <Brain className="w-4 h-4 text-[#ccff00] mt-0.5 flex-shrink-0" />
                      <span>Basic code snippets & logic</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-[12px] text-white/30">
                      <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Single-script context only</span>
                    </li>
                  </ul>
                  <button disabled className="mt-auto w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/20 font-bold text-xs cursor-not-allowed">
                    {usage.plan === 'free' ? 'Current Plan' : 'Free Tier'}
                  </button>
                </div>

                {/* PRO TIER */}
                <div className={`group bg-gradient-to-b from-[#ccff00]/10 to-transparent border rounded-3xl p-6 flex flex-col relative transition-all duration-500 hover:scale-[1.02] ${usage.plan === 'fresh_pro' ? 'border-[#ccff00] shadow-[0_0_40px_rgba(204,255,0,0.1)]' : 'border-[#ccff00]/30'}`}>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ccff00] text-black text-[10px] font-black uppercase px-4 py-1 rounded-full shadow-lg">Most Popular</div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[#ccff00] text-[10px] font-black uppercase tracking-widest">The Scripter</div>
                    {usage.plan === 'fresh_pro' && <span className="bg-[#ccff00]/20 text-[#ccff00] text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Active</span>}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">Fresh Pro</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-black text-white italic">600 R$</span>
                    <span className="text-white/20 text-xs">/mo</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-2.5 text-[12px] text-white">
                      <Sparkles className="w-4 h-4 text-[#ccff00] mt-0.5 flex-shrink-0" />
                      <span><strong>10,000 mL</strong> daily quota</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-[12px] text-white/80">
                      <ShieldAlert className="w-4 h-4 text-[#ccff00] mt-0.5 flex-shrink-0" />
                      <span><strong>One-Click Debugger:</strong> Fix logic errors instantly</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-[12px] text-white/80">
                      <LayoutDashboard className="w-4 h-4 text-[#ccff00] mt-0.5 flex-shrink-0" />
                      <span><strong>Multi-Script Logic:</strong> AI understands your files</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-[12px] text-white/80">
                      <Zap className="w-4 h-4 text-[#ccff00] mt-0.5 flex-shrink-0" />
                      <span>Gemini 1.5 Pro + 2M Token Window</span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank")}
                    className="mt-auto w-full py-3 rounded-2xl bg-[#ccff00] text-black font-black text-xs hover:bg-white transition-all shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
                  >
                    {usage.plan === 'fresh_pro' ? 'Manage' : 'Upgrade Now'}
                  </button>
                </div>

                {/* ULTRA TIER */}
                <div className={`group bg-gradient-to-b from-violet-600/20 to-transparent border rounded-3xl p-6 flex flex-col transition-all duration-500 hover:scale-[1.02] ${usage.plan === 'pure_ultra' ? 'border-violet-500 shadow-[0_0_40px_rgba(124,58,237,0.2)]' : 'border-violet-500/30'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-violet-400 text-[10px] font-black uppercase tracking-widest">The Architect</div>
                    {usage.plan === 'pure_ultra' && <span className="bg-violet-500/20 text-violet-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Active</span>}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">Pure Ultra</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-black text-white italic">1,500 R$</span>
                    <span className="text-white/20 text-xs">/mo</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-start gap-2.5 text-[12px] text-white">
                      <Sparkles className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span><strong>30,000 mL</strong> daily (Refillable)</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-[12px] text-white/90">
                      <Cpu className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span><strong>Anti-Lag Engine:</strong> Automated code optimization</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-[12px] text-white/90">
                      <Search className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span><strong>System Design:</strong> AI handles full project architecture</span>
                    </li>
                    <li className="flex items-start gap-2.5 text-[12px] text-white/90">
                      <Zap className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span>DeepSeek V3.2 + Gemini 3.1 Pro (Priority Queue)</span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank")}
                    className="mt-auto w-full py-3 rounded-2xl bg-violet-600 text-white font-black text-xs hover:bg-violet-400 transition-all shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                  >
                    {usage.plan === 'pure_ultra' ? 'Manage' : 'Go Ultra'}
                  </button>
                </div>
              </div>

              {/* WHY UPGRADE? */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-0.5 italic uppercase tracking-tight">Tired of "Script Error"?</h4>
                    <p className="text-[11px] text-white/40">Pro tiers identify and fix bugs in seconds. Stop staring at the Output window.</p>
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#ccff00]/10 flex items-center justify-center text-[#ccff00] flex-shrink-0">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-0.5 italic uppercase tracking-tight">Is your game laggy?</h4>
                    <p className="text-[11px] text-white/40">Ultra tier uses advanced optimization models to refactor slow code into efficient Luau.</p>
                  </div>
                </div>
              </div>

              {/* REFILLS */}
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Sparkles size={120} className="text-[#ccff00]" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Instant <span className="text-[#ccff00]">Juice Box</span> Refills</h3>
                    <div className="px-2 py-0.5 rounded-md bg-[#ccff00]/10 text-[#ccff00] text-[9px] font-bold">REFILLS TANK TO 100%</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group/item hover:border-white/20 transition-all cursor-pointer" onClick={() => {
                      showToast("Redirecting to Shop...", "success");
                      window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank");
                    }}>
                      <div>
                        <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Small Sip</div>
                        <div className="text-xl font-black text-white italic">350 R$</div>
                        <div className="text-[11px] text-[#ccff00] font-bold">5,000 mL Refill</div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover/item:bg-[#ccff00] group-hover/item:text-black transition-all">
                        <Plus size={16} />
                      </div>
                    </div>
                    <div className="bg-[#ccff00]/5 border border-[#ccff00]/30 rounded-2xl p-4 flex items-center justify-between relative group/item hover:bg-[#ccff00]/10 transition-all cursor-pointer" onClick={() => {
                      showToast("Opening Juice Box Shop...", "success");
                      window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank");
                    }}>
                      <div className="absolute top-0 left-0 bg-[#ccff00] text-black text-[8px] font-black px-2 py-0.5 rounded-br-lg uppercase">Best Value</div>
                      <div>
                        <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1 mt-2">Juice Box</div>
                        <div className="text-xl font-black text-white italic">950 R$</div>
                        <div className="text-[11px] text-[#ccff00] font-bold">20,000 mL Refill</div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-[#ccff00] text-black flex items-center justify-center group-hover/item:scale-110 transition-all">
                        <Plus size={16} />
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group/item hover:border-white/20 transition-all cursor-pointer" onClick={() => {
                      showToast("Opening Roblox Shop...", "success");
                      window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank");
                    }}>
                      <div>
                        <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Mega Jug</div>
                        <div className="text-xl font-black text-white italic">3,000 R$</div>
                        <div className="text-[11px] text-[#ccff00] font-bold">80,000 mL Refill</div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover/item:bg-[#ccff00] group-hover/item:text-black transition-all">
                        <Plus size={16} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssetSearch && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAssetSearch(false);
          }}
        >
          <div className="bg-[#1e2028] border border-white/[0.04] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-[#ccff00]" />
                Toolbox Search
              </h2>
              <button
                onClick={() => setShowAssetSearch(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={assetQuery}
                onChange={(e) => setAssetQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchAssets()}
                placeholder="Search for models, particles, etc..."
                className="flex-1 bg-black/20 border border-white/[0.04] text-white text-[13px] py-2 px-3 rounded-xl focus:outline-none focus:border-[#ccff00] transition-all"
              />
              <button
                onClick={searchAssets}
                disabled={isSearchingAssets}
                className="bg-[#ccff00] text-black px-4 py-2 rounded-xl text-[13px] font-bold hover:bg-[#d4ff33] transition-all"
              >
                {isSearchingAssets ? "..." : "Search"}
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto grid grid-cols-2 gap-3 pr-2 custom-scrollbar">
              {assetResults.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => {
                    setAttachedAsset(asset);
                    setShowAssetSearch(false);
                  }}
                  className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-2 hover:bg-white/[0.06] transition-all cursor-pointer group"
                >
                  <img
                    src={asset.thumbnail}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                  <p className="text-[11px] font-bold text-white truncate">
                    {asset.name}
                  </p>
                  <p className="text-[9px] text-white/30 truncate">
                    by {asset.creator}
                  </p>
                </div>
              ))}
              {assetResults.length === 0 && !isSearchingAssets && (
                <div className="col-span-2 py-8 text-center text-white/20 text-xs italic">
                  No results found. Search for something to start!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
