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
  // Feature: Live Share
  // Feature: Live Share

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
      const nextModels =
        payload.models && payload.models.length > 0
          ? payload.models
          : FALLBACK_MODELS;
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
          prompt: attachedAsset
            ? `[System Note: The user has attached the Roblox asset "${attachedAsset.name}" (ID: ${attachedAsset.id}) to this message. Please fulfill their request, using this asset if appropriate. If they don't specify what to do with it, insert it into Workspace.]\n\n${finalPromptText}`
            : finalPromptText,
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

      stepTimeoutsRef.current.forEach(clearTimeout);
      stepTimeoutsRef.current = [];
      setThinkingSteps((prev) => prev.map((s) => ({ ...s, done: true })));

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

      function buildAssistantMessage(
        p: typeof payload,
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
          scripts: p.scripts?.map((s) => ({
            name: s.name,
            parent: s.parent,
            type: s.type || "Script",
            action: (s.action as "create" | "delete") || "create",
            lineCount: s.lineCount || 0,
            code: s.code || "",
            originalCode: files.find(
              (f) => f.name === s.name || f.name === s.name + ".lua",
            )?.content,
            requires: s.requires,
          })),
          suggestions: p.suggestions,
          thinking: p.thinking,
          pendingSync,
          tokensUsed: p.tokensUsed,
        };
      }

      setPluginStatus(`Script synced to Studio. Running playtest...`);
      showToast("Script generated and synced!", "success");
      playSound("success");
      setIsGenerating(false);
      setMessages((current) => [
        ...current,
        buildAssistantMessage(payload, payloadFiles, false, isHidden),
      ]);
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

  return (
    <main className="h-screen bg-[#060a12] text-white flex overflow-hidden font-sans relative">
      {/*     PREMIUM FIXED GRADIENT BACKGROUND     */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(29,78,216,0.25),transparent_60%),radial-gradient(circle_at_15%_85%,rgba(37,99,235,0.15),transparent_50%),radial-gradient(circle_at_center,rgba(30,58,138,0.1),transparent_70%)] pointer-events-none z-0" />
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
            <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-[#ccff00]">
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
                <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/50 uppercase tracking-widest font-bold leading-none mt-0.5">
                  pre-beta
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
            className="w-full bg-white text-black font-semibold py-2 rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 text-[13px]"
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
                  className="w-full bg-[#ccff00] text-black font-bold py-2 rounded-xl hover:bg-[#d4ff33] transition-colors flex items-center justify-center gap-2 text-[13px]"
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
                                <div className="mt-4 pt-3 border-t border-[#ccff00]/20 flex justify-end">
                                  <button
                                    className="bg-[#ccff00] text-black font-bold px-5 py-2 rounded-xl text-[13px] hover:bg-[#d4ff33] transition-all"
                                    onClick={async () => {
                                      showToast("Accepting changes...", "info");
                                      const res = await fetch(
                                        "/api/accept-code",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({ sessionKey }),
                                        },
                                      );
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
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar w-full sm:w-auto flex-shrink-0">
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

                        <div className="flex items-center gap-2 border-l border-white/10 pl-2 ml-1">
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
                        </div>

                        {(provider == "google"
                          ? googleKey.trim()
                          : openaiKey.trim()
                        ).length == 0
                            ? (() => {
                              const mlAvailable = usage.remainingMl !== undefined 
                                ? usage.remainingMl 
                                : Math.max(0, (usage.totalMl || 2000) - (usage.usedMl || 0));
                              const pct = Math.max(
                                0,
                                Math.min(
                                  100,
                                  (mlAvailable / Math.max(1, usage.totalMl || 2000)) * 100,
                                ),
                              );
                              const hue = Math.round(pct * 1.2);
                              const planLabel = usage.plan === 'pure_ultra' ? 'Ultra' : usage.plan === 'fresh_pro' ? 'Pro' : 'Free';
                              return (
                                <div 
                                  onClick={() => setShowPricing(true)}
                                  className="hidden sm:flex relative h-9 bg-black/50 rounded-xl overflow-hidden border border-white/[0.08] items-center gap-2 px-3 group ml-2 shadow-[inset_0_0_12px_rgba(0,0,0,0.6)] cursor-pointer hover:border-[#ccff00]/30 transition-all"
                                >
                                  <span className={`text-[10px] font-bold z-10 flex-shrink-0 uppercase tracking-wider ${
                                    usage.plan === 'pure_ultra' ? 'text-[#7c3aed]' : 
                                    usage.plan === 'fresh_pro' ? 'text-[#ccff00]' : 
                                    'text-white/60'
                                  }`}>{planLabel}</span>
                                  <div className="flex flex-col items-end z-10 min-w-[60px]">
                                    <span className="text-[11px] font-mono font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] leading-none">
                                      {mlAvailable.toLocaleString()} mL
                                    </span>
                                    <span className="text-[8px] text-white/30 font-medium leading-none mt-0.5">
                                      / {(usage.totalMl || 2000).toLocaleString()}
                                    </span>
                                  </div>
                                  {/* Background fill bar */}
                                  <div
                                    className="absolute left-0 bottom-0 top-0 transition-all duration-1000 opacity-30"
                                    style={{
                                      width: `${pct}%`,
                                      background: `linear-gradient(90deg, hsla(${hue}, 100%, 50%, 0.8), hsla(${hue}, 100%, 65%, 1))`,
                                    }}
                                  />
                                </div>
                              );
                            })()
                          : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {lastError && (
                          <>
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
                            {!lastError.toLowerCase().includes("limit reached") && !lastError.toLowerCase().includes("failed to generate") && !lastError.toLowerCase().includes("experiencing high demand") && (
                              <button
                                className="px-3 py-2 rounded-xl text-[12px] font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
                                onClick={handleAutoFix}
                                disabled={isGenerating}
                              >
                                Repair
                              </button>
                            )}
                            <button
                              className="p-2 rounded-xl text-white/30 hover:text-white/60 transition-all"
                              onClick={() => setLastError(null)}
                              title="Dismiss Error"
                            >
                              <X size={14} />
                            </button>
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
                            className="p-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40 transition-all disabled:shadow-none"
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
                            if (
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

                      <div className="flex items-center gap-3"></div>
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
          </div>
        </div>
      )}
      {showPricing && (
        <div 
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200 p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setShowPricing(false)}
        >
          <div className="bg-[#13151a] border border-white/10 rounded-[2rem] w-full max-w-[960px] shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden my-auto">
            <button 
              onClick={() => setShowPricing(false)}
              className="absolute top-5 right-6 text-white/40 hover:text-white transition-colors z-20"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 md:p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white mb-1">
                  Pick Your <span className="text-[#ccff00]">Squeeze</span>
                </h2>
                <p className="text-white/30 text-xs">All plans billed monthly via Roblox Subscriptions</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* FREE TIER */}
                <div className={`bg-white/[0.02] border rounded-2xl p-5 flex flex-col transition-all duration-300 ${usage.plan === 'free' ? 'border-[#ccff00]/50 bg-[#ccff00]/5' : 'border-white/5'}`}>
                  {usage.plan === 'free' && <div className="text-[9px] font-black uppercase tracking-wider text-[#ccff00] bg-[#ccff00]/10 self-start px-2 py-0.5 rounded-full mb-2">Current Plan</div>}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-white text-sm font-bold uppercase tracking-wider">Free</div>
                  </div>
                  <div className="text-2xl font-black text-white mb-1">0 R$</div>
                  <p className="text-[11px] text-white/40 mb-4 border-b border-white/5 pb-4">Hobbyists testing the waters.</p>
                  <ul className="flex flex-col gap-2 mb-4 text-[11px]">
                    <li className="flex items-center gap-2 text-white/70"><Sparkles className="w-3 h-3 text-[#ccff00] flex-shrink-0" /> 2,000 mL / day</li>
                    <li className="flex items-center gap-2 text-white/70"><Zap className="w-3 h-3 text-[#ccff00] flex-shrink-0" /> Gemini Flash</li>
                    <li className="flex items-center gap-2 text-white/70"><Brain className="w-3 h-3 text-[#ccff00] flex-shrink-0" /> Basic code snippets</li>
                    <li className="flex items-center gap-2 text-white/40"><X className="w-3 h-3 flex-shrink-0" /> 1 project limit</li>
                    <li className="flex items-center gap-2 text-white/40"><X className="w-3 h-3 flex-shrink-0" /> No stacking</li>
                    <li className="flex items-center gap-2 text-white/40"><X className="w-3 h-3 flex-shrink-0" /> Standard rate limits</li>
                  </ul>
                </div>

                {/* PRO TIER */}
                <div className={`bg-white/[0.03] border rounded-2xl p-5 flex flex-col relative transition-all duration-300 ${usage.plan === 'fresh_pro' ? 'border-[#ccff00]/50 bg-[#ccff00]/5' : 'border-[#ccff00]/20 shadow-[0_0_20px_rgba(204,255,0,0.05)]'}`}>
                  {usage.plan !== 'fresh_pro' && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#ccff00] text-black text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full whitespace-nowrap">Most Popular</div>}
                  {usage.plan === 'fresh_pro' && <div className="text-[9px] font-black uppercase tracking-wider text-[#ccff00] bg-[#ccff00]/10 self-start px-2 py-0.5 rounded-full mb-2">Current Plan</div>}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-white text-sm font-bold uppercase tracking-wider">Fresh Pro</div>
                  </div>
                  <div className="text-2xl font-black text-white mb-1">600 R$ <span className="text-xs text-white/40 font-normal">/mo</span></div>
                  <p className="text-[11px] text-white/40 mb-4 border-b border-white/5 pb-4">The sweet spot for serious devs.</p>
                  <ul className="flex flex-col gap-2 mb-4 text-[11px]">
                    <li className="flex items-center gap-2 text-white"><Sparkles className="w-3 h-3 text-[#ccff00] flex-shrink-0" /> <strong>10,000 mL / day</strong></li>
                    <li className="flex items-center gap-2 text-white/80"><Zap className="w-3 h-3 text-[#ccff00] flex-shrink-0" /> Gemini 1.5 Pro</li>
                    <li className="flex items-center gap-2 text-white/80"><Brain className="w-3 h-3 text-[#ccff00] flex-shrink-0" /> 2M+ token context window</li>
                    <li className="flex items-center gap-2 text-white/80"><Sparkles className="w-3 h-3 text-[#ccff00] flex-shrink-0" /> Reads your entire codebase</li>
                    <li className="flex items-center gap-2 text-white/80"><Sparkles className="w-3 h-3 text-[#ccff00] flex-shrink-0" /> Up to 10 projects</li>
                    <li className="flex items-center gap-2 text-white/80"><Sparkles className="w-3 h-3 text-[#ccff00] flex-shrink-0" /> Complex multi-script logic</li>
                  </ul>
                  {usage.plan === 'fresh_pro' ? (
                    <button disabled className="mt-auto w-full bg-white/5 border border-white/10 text-white/40 font-bold py-2 rounded-xl cursor-not-allowed text-xs">Active</button>
                  ) : usage.plan === 'pure_ultra' ? (
                    <button 
                      onClick={() => window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank")}
                      className="mt-auto w-full bg-white/5 text-white/60 font-bold py-2 rounded-xl hover:bg-white/10 transition-colors text-xs border border-white/10"
                    >
                      Downgrade
                    </button>
                  ) : (
                    <button 
                      onClick={() => window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank")}
                      className="mt-auto w-full bg-[#ccff00] text-black font-bold py-2 rounded-xl hover:bg-[#b3e600] transition-colors text-xs"
                    >
                      Upgrade
                    </button>
                  )}
                </div>

                {/* ULTRA TIER */}
                <div className={`bg-white/[0.03] border rounded-2xl p-5 flex flex-col transition-all duration-300 ${usage.plan === 'pure_ultra' ? 'border-[#7c3aed]/50 bg-[#7c3aed]/5' : 'border-[#7c3aed]/30 shadow-[0_0_20px_rgba(124,58,237,0.05)]'}`}>
                  {usage.plan === 'pure_ultra' && <div className="text-[9px] font-black uppercase tracking-wider text-[#7c3aed] bg-[#7c3aed]/10 self-start px-2 py-0.5 rounded-full mb-2">Current Plan</div>}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-[#7c3aed] text-sm font-bold uppercase tracking-wider">Pure Ultra</div>
                  </div>
                  <div className="text-2xl font-black text-white mb-1">1,500 R$ <span className="text-xs text-white/40 font-normal">/mo</span></div>
                  <p className="text-[11px] text-white/40 mb-4 border-b border-white/5 pb-4">Full power. Zero compromises.</p>
                  <ul className="flex flex-col gap-2 mb-4 text-[11px]">
                    <li className="flex items-center gap-2 text-white"><Sparkles className="w-3 h-3 text-[#7c3aed] flex-shrink-0" /> <strong>30,000 mL / day</strong></li>
                    <li className="flex items-center gap-2 text-white/80"><Zap className="w-3 h-3 text-[#7c3aed] flex-shrink-0" /> Claude Opus + Gemini Pro</li>
                    <li className="flex items-center gap-2 text-white/80"><Brain className="w-3 h-3 text-[#7c3aed] flex-shrink-0" /> Expert-level Luau logic</li>
                    <li className="flex items-center gap-2 text-white/80"><Sparkles className="w-3 h-3 text-[#7c3aed] flex-shrink-0" /> Priority queue (zero latency)</li>
                    <li className="flex items-center gap-2 text-white/80"><Sparkles className="w-3 h-3 text-[#7c3aed] flex-shrink-0" /> Unlimited projects</li>
                    <li className="flex items-center gap-2 text-white/80"><Sparkles className="w-3 h-3 text-[#7c3aed] flex-shrink-0" /> Deep Research Mode</li>
                  </ul>
                  {usage.plan === 'pure_ultra' ? (
                    <button disabled className="mt-auto w-full bg-white/5 border border-white/10 text-white/40 font-bold py-2 rounded-xl cursor-not-allowed text-xs">Active</button>
                  ) : (
                    <button 
                      onClick={() => window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank")}
                      className="mt-auto w-full bg-[#7c3aed] text-white font-bold py-2 rounded-xl hover:bg-[#6d28d9] transition-colors text-xs"
                    >
                      Get Ultra
                    </button>
                  )}
                </div>
              </div>

              {/* MODEL COMPARISON TABLE */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 mb-6 overflow-x-auto">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Compare the Brains</h4>
                <table className="w-full text-[11px]">
                  <thead><tr className="border-b border-white/5">
                    <th className="text-left py-2 text-white/40 font-medium">Rank</th>
                    <th className="text-left py-2 text-white/40 font-medium">Primary Model</th>
                    <th className="text-left py-2 text-white/40 font-medium">Logic Capabilties</th>
                    <th className="text-left py-2 text-white/40 font-medium">Context Window</th>
                    <th className="text-left py-2 text-white/40 font-medium">Response Speed</th>
                  </tr></thead>
                  <tbody>
                    <tr className="border-b border-white/[0.03]"><td className="py-2 text-white/60">Free</td><td className="py-2 text-white/80">Gemini Flash</td><td className="py-2">Basic bug fixes</td><td className="py-2 text-white/50">Small (Single Script)</td><td className="py-2 text-green-400">Lightning</td></tr>
                    <tr className="border-b border-white/[0.03]"><td className="py-2 text-white/60">Pro</td><td className="py-2 text-white/80">Gemini 1.5 Pro</td><td className="py-2">Complex Multi-Script</td><td className="py-2 text-[#ccff00]">Massive (2M+ Tokens)</td><td className="py-2 text-white/80">Standard</td></tr>
                    <tr><td className="py-2 text-white/60">Ultra</td><td className="py-2 text-white/80">Claude Opus + Gemini</td><td className="py-2">Expert / System Design</td><td className="py-2 text-white/50">Large (Full Workspace)</td><td className="py-2 text-[#7c3aed]">Priority Queue</td></tr>
                  </tbody>
                </table>
              </div>

              {/* REFILLS */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white tracking-tight mb-4">Need an Instant Refill?</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                    <div className="text-[10px] text-white/40 font-bold mb-0.5">Small Sip</div>
                    <div className="text-sm font-black text-white">350 R$</div>
                    <div className="text-[10px] text-[#ccff00] font-bold mb-2">5,000 mL</div>
                    <button 
                      onClick={() => window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank")}
                      className="w-full bg-white/10 text-white font-bold py-1.5 rounded-lg text-[11px] hover:bg-white/20 transition-colors"
                    >
                      Buy
                    </button>
                  </div>
                  <div className="bg-white/5 border border-[#ccff00]/20 rounded-xl p-3 flex flex-col items-center text-center relative">
                    <div className="absolute -top-2 bg-[#ccff00] text-black text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Best</div>
                    <div className="text-[10px] text-white/40 font-bold mb-0.5">Juice Box</div>
                    <div className="text-sm font-black text-white">950 R$</div>
                    <div className="text-[10px] text-[#ccff00] font-bold mb-2">20,000 mL</div>
                    <button 
                      onClick={() => window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank")}
                      className="w-full bg-[#ccff00] text-black font-bold py-1.5 rounded-lg text-[11px] hover:bg-[#b3e600] transition-colors"
                    >
                      Buy
                    </button>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center text-center">
                    <div className="text-[10px] text-white/40 font-bold mb-0.5">Mega Jug</div>
                    <div className="text-sm font-black text-white">3,000 R$</div>
                    <div className="text-[10px] text-[#ccff00] font-bold mb-2">80,000 mL</div>
                    <button 
                      onClick={() => window.open("https://www.roblox.com/games/137859423074162/Apple-Juice-Shop", "_blank")}
                      className="w-full bg-white/10 text-white font-bold py-1.5 rounded-lg text-[11px] hover:bg-white/20 transition-colors"
                    >
                      Buy
                    </button>
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
