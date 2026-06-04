"use client";
// Version: 1.0.2 - Agentic IDE Update


import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  X,
  Sparkles,
  Menu,
  Check,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { ToastContainer, useToasts } from "@/components/ui/toast";
import { type ThinkingStep } from "@/components/thinking-feed";
import { buildActivityFeed, type ActivityStep } from "@/lib/activity-feed";
import { validateGeneration } from "@/lib/validate-generation";
import {
  KIRO_DEFAULT_MODEL,
  KIRO_MODEL_LABELS,
  kiroModelsForPlan,
  type KiroPlan,
} from "@/lib/kiro-models";

import { WorkspaceTree } from "@/components/workspace-tree";
import { StripeWave } from "@/components/stripe-wave";
import { SlashCommandInput } from "@/components/slash-command";

type DashboardClientProps = {
  username: string;
  avatarUrl?: string;
  initialProjectId?: string | null;
  isDemoMode?: "lobby" | "ide" | false;
  isTester?: boolean;
};

import {
  Project,
  ChatMessage,
} from "./dashboard/types";
import { DashboardSidebar } from "./dashboard/dashboard-sidebar";
import { DashboardTopbar } from "./dashboard/dashboard-topbar";
import { IdeLayout } from "./dashboard/ide-layout";
import { ProjectsTab } from "./dashboard/panel-projects";
import { AssetsTab } from "./dashboard/panel-assets";
import { NexusTab } from "./dashboard/panel-nexus";
import { TeamTab } from "./dashboard/panel-team";
import { SettingsModal } from "./dashboard/settings-modal";
import { DashboardContext, type DashboardContextType } from "./dashboard/dashboard-context";
import { JuiceLoader } from "./dashboard/juice-loader";
import { ThinkingFeed } from "@/components/thinking-feed";

const FALLBACK_MODELS = KIRO_MODEL_LABELS;

// --- NEW: Coming Soon View ---


const findNodeById = (nodes: any[], id: string): any => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

export function DashboardClient({ username, avatarUrl, initialProjectId, isDemoMode, isTester = false }: DashboardClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialProjectId || null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);

  const [sessionKey, setSessionKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<"openai" | "google">(
    "openai",
  );
  const [openaiKey, setOpenaiKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [selectedModel, setSelectedModel] = useState(KIRO_DEFAULT_MODEL);
  const [availableModels, setAvailableModels] =
    useState<string[]>(FALLBACK_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const isAutoFixingRef = useRef(false);
  const [isPluginConnected, setIsPluginConnected] = useState(false);
  const [vmStatus, setVmStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChatIndex, setActiveChatIndex] = useState(0);
  const [transferingChat, setTransferingChat] = useState<{
    sourceProjectId: string;
    sourceChatIndex: number;
  } | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync for closures (e.g. submitPrompt called from intervals)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);



  const [thinkingSteps, setThinkingSteps] = useState<(ThinkingStep | ActivityStep)[]>([]);
  const [gameLogs, setGameLogs] = useState<string[]>([]);
  const mode: "fast" | "thinking" = "fast";
  const [attachedFiles, setAttachedFiles] = useState<
    { name: string; content?: string; type?: string }[]
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

  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastPollRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const codeConsumedRef = useRef<boolean>(false);
  const lastReportedErrorRef = useRef<string | null>(null);
  const continuationRef = useRef<number>(0);
  const waitingForFileRef = useRef<string | null>(null);

  const stepTimeoutsRef = useRef<any[]>([]);
  const autoFixRetriesRef = useRef<number>(0);
  const lastGeneratedScriptsRef = useRef<
    { name: string; parent: string; type: string; code: string }[]
  >([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>("");
  const autoEnhance = false;
  const [autoRetry, setAutoRetry] = useState(false);
  const [autoPlaytest, setAutoPlaytest] = useState(false);
  // Mirror autoPlaytest in a ref so the long-lived status-poll closure always
  // reads the current value (avoids a stale-closure bug in the fix loop).
  const autoPlaytestRef = useRef(false);
  useEffect(() => {
    autoPlaytestRef.current = autoPlaytest;
  }, [autoPlaytest]);

  const [selectedUIStyle, setSelectedUIStyle] = useState<
    "none" | "stud" | "dracula" | "zap"
  >("zap");
  const missedPollsRef = useRef<number>(0);
  // Feature: Asset search
  const [assetQuery, setAssetQuery] = useState("");
  const [assetResults, setAssetResults] = useState<
    { id: number; name: string; creator: string; thumbnail: string }[]
  >([]);
  const [showAssetSearch, setShowAssetSearch] = useState(false);
  const [isSearchingAssets, setIsSearchingAssets] = useState(false);
  const isDeepIntelligence = false;
  const [attachedAsset, setAttachedAsset] = useState<{
    id: number;
    name: string;
    thumbnail: string;
  } | null>(null);

  // --- DEMO MODE SIMULATION ---
  const [demoCursorPos, setDemoCursorPos] = useState({ x: 100, y: 300 });
  const [demoCursorScale, setDemoCursorScale] = useState(1);
  
  useEffect(() => {
    if (!isDemoMode) return;

    let isActive = true;
    
    const runLobbyDemo = async () => {
      while (isActive) {
        // Move to 'Juice Core' tab
        setDemoCursorPos({ x: 300, y: 150 });
        await new Promise(r => setTimeout(r, 1000));
        setDemoCursorScale(0.8);
        await new Promise(r => setTimeout(r, 200));
        setDemoCursorScale(1);
        setActiveTab("nexus");
        
        
        await new Promise(r => setTimeout(r, 2000));
        
        // Move to 'Projects' tab
        setDemoCursorPos({ x: 150, y: 150 });
        await new Promise(r => setTimeout(r, 1000));
        setDemoCursorScale(0.8);
        await new Promise(r => setTimeout(r, 200));
        setDemoCursorScale(1);
        setActiveTab("projects");
        
        
        await new Promise(r => setTimeout(r, 2000));
      }
    };

    const runIdeDemo = async () => {
      while (isActive) {
        // Move to chat input
        setDemoCursorPos({ x: window.innerWidth - 300, y: window.innerHeight - 100 });
        await new Promise(r => setTimeout(r, 1500));
        setDemoCursorScale(0.8);
        await new Promise(r => setTimeout(r, 200));
        setDemoCursorScale(1);
        
        // Fake typing
        const text = "Add double jump";
        for (let i = 0; i <= text.length; i++) {
          if (!isActive) return;
          setPrompt(text.substring(0, i));
          await new Promise(r => setTimeout(r, 100));
        }
        
        await new Promise(r => setTimeout(r, 500));
        
        // Move to send button
        setDemoCursorPos({ x: window.innerWidth - 60, y: window.innerHeight - 100 });
        await new Promise(r => setTimeout(r, 800));
        setDemoCursorScale(0.8);
        await new Promise(r => setTimeout(r, 200));
        setDemoCursorScale(1);
        setPrompt("");
        
        await new Promise(r => setTimeout(r, 2000));
      }
    };

    if (isDemoMode === "lobby") runLobbyDemo();
    else if (isDemoMode === "ide") runIdeDemo();

    return () => { isActive = false; };
  }, [isDemoMode]);
  // Feature: Ingredients
  const [selectedIngredients, setSelectedIngredients] = useState<any[]>([]);
  const [isJarOpen, setIsJarOpen] = useState(false);
  const ingredients = useMemo(() => [
    { id: "round", name: "Round System", icon: "ÃƒÂ¢Ã‚Â Ã‚Â³", color: "#ccff00", template: "Create a [round] system with a [30]s intermission and [map] selection." },
    { id: "voting", name: "Map Voting", icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬â€ Ã‚Â³ÃƒÂ¯Ã‚Â¸Ã‚Â ", color: "#3b82f6", template: "Build a [3]-option Map Voting UI with [thumbnail] previews." },
    { id: "pets", name: "Pet System", icon: "ÃƒÂ°Ã…Â¸Ã‚Â Ã‚Â¶", color: "#f59e0b", template: "Generate a [pet] system with [egg] hatching and [follow] physics." },
    { id: "leaderboard", name: "Leaderboard", icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â ", color: "#10b981", template: "Setup a [global] leaderboard for [Most Wins] with [10] spots." },
    { id: "sounds", name: "Sound Engine", icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬Â Ã…Â ", color: "#6366f1", template: "Add a [3D] sound engine with [reverb] and [distance] scaling." },
    { id: "vfx", name: "VFX Pack", icon: "ÃƒÂ¢Ã…â€œÃ‚Â¨", color: "#ec4899", template: "Create [particle] effects for [jumping] and [landing]." },
    { id: "admin", name: "Admin Panel", icon: "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â¡ÃƒÂ¯Ã‚Â¸Ã‚Â ", color: "#ef4444", template: "Build a [moderator] panel with [kick], [ban], and [teleport] tools." },
    { id: "inventory", name: "Inventory", icon: "ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬â„¢", color: "#8b5cf6", template: "Setup an [item] inventory with [6] slots and [equip] logic." },
    { id: "sour", name: "Sour Logic", icon: "ÃƒÂ°Ã…Â¸Ã‚Â Ã¢â‚¬Â¹", color: "#d4ff33", template: "Add [challenging] difficulty modifiers and [hardcore] mechanics." },
    { id: "sparkling", name: "Sparkling UI", icon: "ÃƒÂ°Ã…Â¸Ã‚Â«Ã‚Â§", color: "#60a5fa", template: "Apply [glassmorphic] effects and [particle] trails to all UI elements." },
    { id: "golden", name: "Golden Assets", icon: "ÃƒÂ°Ã…Â¸Ã‚Â Ã¢â‚¬Â ", color: "#fbbf24", template: "Incorporate [premium] high-poly assets and [gold] material shaders." },
    { id: "spicy", name: "Spicy Combat", icon: "ÃƒÂ°Ã…Â¸Ã…â€™Ã‚Â¶ÃƒÂ¯Ã‚Â¸Ã‚Â ", color: "#f43f5e", template: "Enhance combat with [hitstop], [camera shake], and [blood] effects." },
  ], []);

  const [showArchived, setShowArchived] = useState(false);
  const [selectedTreePaths, setSelectedTreePaths] = useState<string[]>([]);
  const [showHelpWindow, setShowHelpWindow] = useState(false);
  const [helpMessages, setHelpMessages] = useState<ChatMessage[]>([]);
  const [isHelpGenerating, setIsHelpGenerating] = useState(false);
  const [helpInput, setHelpInput] = useState("");
  const [activeTab, setActiveTab] = useState<"projects" | "assets" | "nexus" | "team">("projects");
  const [workspaceStyle, setWorkspaceStyle] = useState<"legacy" | "ide">("legacy");
  const [isLegacyExplorerOpen, setIsLegacyExplorerOpen] = useState(false);
  const [isAddingConfig, setIsAddingConfig] = useState(false);
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [isShowingVaultMenu, setIsShowingVaultMenu] = useState(false);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null); // null means Chat
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [idePanel, setIdePanel] = useState<"explorer" | "search" | "chat" | "settings">("explorer");
  const [isIdeSidePanelOpen, setIsIdeSidePanelOpen] = useState(true);
  const [activeBottomPanel, setActiveBottomPanel] = useState<"terminal" | "logs" | "problems" | "none">("none");
  const [agentMode, setAgentMode] = useState<"plan" | "build">("plan");


  const defaultRobloxWorkspace = [
    { id: "ws", name: "Workspace", className: "Workspace", children: [] },
    { id: "pl", name: "Players", className: "Players", children: [] },
    { id: "lt", name: "Lighting", className: "Lighting", children: [] },
    { id: "rf", name: "ReplicatedFirst", className: "ReplicatedFirst", children: [] },
    { id: "rs", name: "ReplicatedStorage", className: "ReplicatedStorage", children: [] },
    { id: "sss", name: "ServerScriptService", className: "ServerScriptService", children: [] },
    { id: "ss", name: "ServerStorage", className: "ServerStorage", children: [] },
    { id: "sg", name: "StarterGui", className: "StarterGui", children: [] },
    { id: "sp", name: "StarterPack", className: "StarterPack", children: [] },
    { id: "stplayer", name: "StarterPlayer", className: "StarterPlayer", children: [
      { id: "sps", name: "StarterPlayerScripts", className: "StarterPlayerScripts", children: [] },
      { id: "scs", name: "StarterCharacterScripts", className: "StarterCharacterScripts", children: [] },
    ] },
    { id: "tm", name: "Teams", className: "Teams", children: [] },
    { id: "snd", name: "SoundService", className: "SoundService", children: [] },
  ];

  const getRobloxIcon = (className: string) => {
    return `/roblox-icons/${className}@2x.png`;
  };

  const isScriptType = (className: string) => ["Script", "LocalScript", "ModuleScript"].includes(className);
  const isUIType = (className: string) => ["ScreenGui", "Frame", "TextLabel", "TextButton", "TextBox", "ImageLabel", "ImageButton", "ScrollingFrame", "BillboardGui", "SurfaceGui", "StarterGui"].includes(className);

  // Tab: Assets
  const [savedAssets, _setSavedAssets] = useState<{ 
    id: number; 
    name: string; 
    color: string; 
    category: string; 
    workspace: any[]; 
    thumbnail?: string 
  }[]>([
    {
      id: 1,
      name: "Standard Combat Hub",
      color: "#3b82f6",
      category: "Core Systems",
      workspace: [
        { id: "ws", name: "Workspace", type: "folder", children: [] },
        { id: "sss", name: "ServerScriptService", type: "folder", children: [
          { id: "cs", name: "CombatServer", type: "script", content: "-- Server Logic" }
        ] },
        { id: "sg", name: "StarterGui", type: "folder", children: [] }
      ]
    }
  ]);
  const [isEditingAsset, setIsEditingAsset] = useState<number | null>(null);
  const [editingAssetName, setEditingAssetName] = useState("");
  const [workspaceEditorData, setWorkspaceEditorData] = useState<any>([]);
  const [selectedWorkspaceItemId, setSelectedWorkspaceItemId] = useState<string | null>(null);
  const [simulatorView, setSimulatorView] = useState<"edit" | "test">("edit");
  const [insertMenuVisible, setInsertMenuVisible] = useState<{ id: string, x: number, y: number } | null>(null);
  const [insertSearch, setInsertSearch] = useState("");

  const insertCategories = [
    {
      name: "Frequently Used",
      items: ["Script", "ModuleScript", "Folder", "LocalScript", "RemoteEvent", "RemoteFunction"]
    },
    {
      name: "3D Interfaces",
      items: ["ClickDetector", "Decal", "Dialog", "DialogChoice", "DragDetector", "MaterialVariant", "ProximityPrompt", "SurfaceAppearance", "TerrainDetail", "Texture"]
    },
    {
      name: "Adornments",
      items: ["ArcHandles", "BoxHandleAdornment", "ConeHandleAdornment", "CylinderHandleAdornment", "Handles", "ImageHandleAdornment", "LineHandleAdornment", "SphereHandleAdornment"]
    },
    {
      name: "GUI",
      items: ["ScreenGui", "Frame", "TextLabel", "TextButton", "ImageLabel", "ImageButton", "ScrollingFrame", "TextBox", "UIListLayout", "UIGridLayout", "UICorner", "UIGradient", "UIStroke"]
    }
  ];
  const [editingAssetCategory, setEditingAssetCategory] = useState("Scripts");
  const [newAsset, setNewAsset] = useState({ name: "", category: "Scripts" });
  const [assetCategory, setAssetCategory] = useState("All");

  // Tab: Juice Core
  const [globalConfigs, setGlobalConfigs] = useState<{ id: string; key: string; value: string; category: "secret" | "config" | "directive"; createdAt: number }[]>([
    { id: "1", key: "Naming Convention", value: "Use camelCase for all variables and PascalCase for functions.", category: "directive", createdAt: Date.now() },
    { id: "2", key: "Performance Mode", value: "Prioritize memory efficiency over execution speed.", category: "directive", createdAt: Date.now() }
  ]);
  const [newConfig, setNewConfig] = useState({ key: "", value: "", category: "config" as "secret" | "config" | "directive" });
  const [showConfigValues, setShowConfigValues] = useState<Set<string>>(new Set());

  // Tab: Team
  const [teamMembers, setTeamMembers] = useState<{ id: string; username: string; role: "owner" | "admin" | "developer" | "viewer"; joinedAt: number; isOnline: boolean }[]>([
    { id: "owner", username: "You", role: "owner", joinedAt: Date.now() - 86400000 * 30, isOnline: true },
  ]);
  const [teamInviteInput, setTeamInviteInput] = useState("");

  const handleVault = useCallback((asset: any) => {
    const assetObj = typeof asset === 'string' ? { name: asset.split('/').pop() || asset, type: 'Instance', fullPath: asset } : asset;
    const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    _setSavedAssets(prev => [
      {
        id: Date.now(),
        name: assetObj.name,
        color: randomColor,
        category: "Scripts",
        workspace: JSON.parse(JSON.stringify(defaultRobloxWorkspace)),
        thumbnail: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop"
      },
      ...prev
    ]);
    showToast(`${assetObj.name} has been saved to your vault.`, 'success');
  }, [defaultRobloxWorkspace, _setSavedAssets, showToast]);

  const handleAttachAsset = useCallback((asset: any) => {
    setAttachedAsset(asset);
    showToast(`${asset.name} attached to prompt.`, 'info');
  }, [setAttachedAsset, showToast]);

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
          `/api/status?key=${encodeURIComponent(sessionKey)}` +
            `&model=${encodeURIComponent(selectedModel)}` +
            `&provider=${encodeURIComponent(provider)}` +
            `&openaiKey=${encodeURIComponent(openaiKey)}` +
            `&googleKey=${encodeURIComponent(googleKey)}` +
            `&mode=${encodeURIComponent(mode)}` +
            `&t=${Date.now()}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === "ok") {
            // Check if the plugin consumed code
            if (codeConsumedRef.current && !data.hasNewCode) {
              codeConsumedRef.current = false;

              showToast("Plugin received the script!", "success");
              playSound("glass");
            } else if (data.hasNewCode) {
              codeConsumedRef.current = true;
            }

            if (data.tree && typeof data.tree === "string") {
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

                if (waitingForFileRef.current === data.fileResponse.name) {
                  waitingForFileRef.current = null;

                  // In IDE mode, we want to store the content in our editor state
                  if (data.fileResponse.content !== "[APPLE_JUICE_ERROR_FILE_NOT_FOUND]") {
                    setFileContents(prev => ({
                      ...prev,
                      [data.fileResponse.name]: data.fileResponse.content
                    }));
                  }

                  // Wait a brief moment to ensure state updates, then submit the file content back to the AI
                  setTimeout(() => {
                    let promptText = "";
                    if (
                      data.fileResponse.content ===
                      "[APPLE_JUICE_ERROR_FILE_NOT_FOUND]"
                    ) {
                      promptText = `I tried to read the file ${data.fileResponse.name}, but it could not be found in the project. Please check the project tree or create it if necessary.`;
                    } else {
                      promptText = `I have read the file ${data.fileResponse.name}. Here is its current content:\n\n\`\`\`luau\n${data.fileResponse.content}\n\`\`\`\n\nPlease continue your task using this information.`;
                    }
                    submitPrompt(promptText, true);
                  }, 500);
                }

                return [...prev, data.fileResponse];
              });
            }

            // Handle connection status checking
            // Use a generous 6s window + 3-miss threshold to avoid false disconnects
            // during playtests (Studio stops plugin HTTP during run mode).
            if (data.lastPollTime > 0) {
              lastPollRef.current = data.lastPollTime;
              const serverTime = data.serverTime || Date.now();
              const timeSinceLastPoll = serverTime - data.lastPollTime;
              const pollOk = timeSinceLastPoll < 6000;

              if (pollOk) {
                missedPollsRef.current = 0;
              } else {
                missedPollsRef.current += 1;
              }

              // Only flip to disconnected after 3 consecutive misses (~1.5s at 500ms intervals)
              const isNowConnected = pollOk || missedPollsRef.current < 3;

              setIsPluginConnected((prev) => {
                if (isNowConnected && !prev) {
                  showToast("Plugin connected successfully!", "success");
                }
                return isNowConnected;
              });
            } else {
              setIsPluginConnected(false);
            }

            if (data.logs && data.logs.length > 0) {
              setGameLogs((prev) => [...prev, ...data.logs].slice(-200));

              // Detect structured test results from the plugin
              for (const log of data.logs as string[]) {
                // Test passed
                if (log.includes("[APPLE_JUICE_TEST_PASS]")) {

                  showToast("Playtest passed with no errors!", "success");
                  autoFixRetriesRef.current = 0;
                }

                // Test failed — auto-fix if autonomous mode is on (bounded retries)
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

                  // De-dupe: don't react to the same failure twice.
                  if (displayError && displayError !== lastReportedErrorRef.current) {
                    lastReportedErrorRef.current = displayError;

                    const MAX_AUTO_FIX = 3;
                    if (
                      autoPlaytestRef.current &&
                      !isGeneratingRef.current &&
                      autoFixRetriesRef.current < MAX_AUTO_FIX
                    ) {
                      autoFixRetriesRef.current += 1;
                      const attempt = autoFixRetriesRef.current;
                      isAutoFixingRef.current = true;
                      showToast(
                        `Playtest failed — auto-fixing (attempt ${attempt}/${MAX_AUTO_FIX})…`,
                        "info",
                      );
                      void submitPrompt(buildAutoFixPrompt(displayError, attempt), true);
                    } else if (autoPlaytestRef.current && autoFixRetriesRef.current >= MAX_AUTO_FIX) {
                      showToast(
                        `Auto-fix gave up after ${MAX_AUTO_FIX} attempts. Here's the error so you can guide it.`,
                        "error",
                      );
                    } else {
                      showToast(
                        `Playtest failed with ${errorCount} error(s)`,
                        "error",
                      );
                    }
                  }
                }

                // Test skipped (already in run mode)
                if (log.includes("[APPLE_JUICE_TEST_SKIP]")) {

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
          // Session expired or missing on server ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â  trigger a re-pair
          console.warn(
            "[AppleJuice] Session expired or missing, re-pairing...",
          );
          setSessionKey("");
          void createPairOnServer();
        }
      } catch (err) {
        console.error("Status check failed", err);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [sessionKey, showToast, selectedModel, provider, openaiKey, googleKey, mode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingSteps]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameLogs]);
  // Synchronize activeProjectId state when initialProjectId prop updates (e.g. dynamic routing page transitions)
  useEffect(() => {
    if (initialProjectId) {
      if (activeProjectId !== initialProjectId) {
        const found = projects.find((p) => p.id === initialProjectId);
        if (found) {
          void switchProject(found);
        } else {
          setActiveProjectId(initialProjectId);
        }
      }
    } else {
      if (activeProjectId !== null) {
        setActiveProjectId(null);
      }
    }
  }, [initialProjectId, projects]);

  useEffect(() => {
    // Tester mode: skip server pairing, grant a generous local quota.
    if (isTester) {
      setUsage({
        isLoaded: true,
        usedMl: 0,
        dailyMl: 30000,
        totalMl: 30000,
        remainingMl: 30000,
        bonusMl: 0,
        plan: "pure_ultra",
      });
    } else {
      // create pairing session on the server (returns pairing code + token)
      void createPairOnServer();
    }

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
    else effectiveKey = savedOpen;
    setApiKey(effectiveKey);

    const savedModel =
      window.localStorage.getItem("apple-juice-model") ?? KIRO_DEFAULT_MODEL;
    setSelectedModel(savedModel);

    void loadProjects();

    void loadModels(effectiveKey, savedModel);

    const savedAutoRetry = localStorage.getItem("aj_auto_retry") === "true";
    setAutoRetry(savedAutoRetry);
    const savedAutoPlaytest =
      localStorage.getItem("aj_auto_playtest") === "true";
    setAutoPlaytest(savedAutoPlaytest);

    void fetchUsage();

    // Check Antigravity link status
    // checkAntigravityLink removed
  }, []);


  async function fetchUsage() {
    if (isTester) return; // tester mode uses a fixed local quota
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setUsage((prev: any) => {
          // Detect plan upgrade (only if we already loaded the initial data)
          if (
            prev &&
            prev.isLoaded &&
            prev.plan !== data.plan &&
            (data.plan === "fresh_pro" || data.plan === "pure_ultra")
          ) {
            const planName =
              data.plan === "pure_ultra" ? "Pure Ultra" : "Fresh Pro";
            showToast(
              `Thank you for upgrading! Your ${planName} plan is now active. ÃƒÂ°Ã…Â¸Ã‚Â§Ã†â€™`,
              "success",
            );
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

  const [refillTime, setRefillTime] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setRefillTime(`${h}h ${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchUsage();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  //     Multi-Project Management

  async function loadProjects() {
    setIsProjectsLoading(true);

    // Tester mode: no backend session — start with an empty local lobby.
    if (isTester) {
      try {
        const raw = window.localStorage.getItem("aj-tester-projects");
        const local: Project[] = raw ? JSON.parse(raw) : [];
        setProjects(local);
        if (initialProjectId) {
          const p = local.find((p) => p.id === initialProjectId);
          if (p) void switchProject(p);
          else setActiveProjectId(null);
        } else {
          setActiveProjectId(null);
        }
      } catch {
        setProjects([]);
        setActiveProjectId(null);
      } finally {
        setIsProjectsLoading(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        const loadedProjects = data.projects || [];
        setProjects(loadedProjects);

        if (initialProjectId) {
          const p = loadedProjects.find((p: Project) => p.id === initialProjectId);
          if (p) {
            void switchProject(p);
          } else {
            setActiveProjectId(null);
          }
        } else {
          setActiveProjectId(null); // Explicitly stay in the lobby
        }
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setIsProjectsLoading(false);
    }
  }

  // Persist tester projects to localStorage so they survive reloads.
  function persistTesterProjects(list: Project[]) {
    try {
      window.localStorage.setItem("aj-tester-projects", JSON.stringify(list));
    } catch {
      /* ignore quota errors */
    }
  }

  async function createNewProject(name: string) {
    const activeCount = projects.filter(p => p.status !== "archived").length;
    const limit = usage.plan === "pure_ultra" ? 8 : usage.plan === "fresh_pro" ? 3 : 2;

    // Tester mode: unlimited local projects, no API call.
    if (isTester) {
      const now = Date.now();
      const newProj: Project = {
        id: `tester-${now}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        ownerUserId: "tester",
        createdAt: now,
        lastActiveAt: now,
        status: "active",
      };
      setProjects((prev) => {
        const next = [newProj, ...prev];
        persistTesterProjects(next);
        return next;
      });
      await switchProject(newProj);
      showToast(`Created "${name}"`, "success");
      return;
    }

    if (activeCount >= limit) {
      showToast(`You've reached your ${limit} game limit. Archive old games to create more!`, "error");
      return;
    }

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

  async function archiveProject(id: string, archive: boolean = true) {
    if (isTester) {
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, status: (archive ? "archived" : "active") as "active" | "archived" } : p));
        persistTesterProjects(next);
        return next;
      });
      showToast(archive ? "Game archived" : "Game restored", "success");
      return;
    }
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: archive ? "archived" : "active" }),
      });
      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: archive ? "archived" : "active" } : p)),
        );
        showToast(archive ? "Game archived" : "Game restored", "success");
      }
    } catch (err) {
      console.error("Failed to archive game", err);
    }
  }

  async function renameProject(id: string, newName: string) {
    if (!newName.trim()) return;
    if (isTester) {
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, name: newName } : p));
        persistTesterProjects(next);
        return next;
      });
      return;
    }
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
      console.error("Failed to rename game", err);
    }
  }

  async function deleteProject(id: string) {
    const confirm = window.confirm(
      "Are you sure you want to delete this game? This cannot be undone.",
    );
    if (!confirm) return;

    if (isTester) {
      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);
      persistTesterProjects(updated);
      if (activeProjectId === id) {
        if (updated.length > 0) {
          await switchProject(updated[0]);
        } else {
          setActiveProjectId("");
          router.push("/dashboard?tester=1");
          setMessages([]);
        }
      }
      showToast("Game deleted", "success");
      return;
    }

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
            setActiveProjectId("");
            router.push("/dashboard");
            setMessages([]);
          }
        }
        showToast("Game deleted", "success");
      }
    } catch (err) {
      console.error("Failed to delete game", err);
    }
  }

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

  async function switchProject(project: Project) {
    setActiveProjectId(project.id);

    // Tester mode keeps everything client-side (local projects aren't in the DB,
    // and the dynamic route would bounce to login). Just switch state in place.
    if (!isTester) {
      // Only push to router if the path is different to avoid redundant reloads
      const targetPath = `/dashboard/${project.id}`;
      if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
        router.push(targetPath);
      }
    }

    setIsPluginConnected(false);
    setActiveChatIndex(0); // Reset to first chat when switching projects

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

    // Fetch messages for index 0
    await loadChatMessages(project.id, 0);
  }

  async function loadChatMessages(projectId: string, index: number) {
    try {
      const res = await fetch(`/api/projects/${projectId}/messages?index=${index}`);
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

  async function switchChat(index: number) {
    if (!activeProjectId) return;
    if (index === activeChatIndex) return;

    // Save current chat before switching
    await saveCurrentChat();

    setActiveChatIndex(index);
    await loadChatMessages(activeProjectId, index);
  }

  async function saveCurrentChat() {
    if (activeProjectId && !isProjectsLoading) {
      try {
        await fetch(`/api/projects/${activeProjectId}/messages?index=${activeChatIndex}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        });
      } catch (err) {
        console.error("Failed to save messages", err);
      }
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
      fetch(`/api/projects/${activeProjectId}/messages?index=${activeChatIndex}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      }).catch((err) => console.error("Failed to save messages", err));
    }
  }, [messages, activeProjectId, activeChatIndex, isProjectsLoading]);

  const handleFileClick = useCallback((path: string) => {
    // Add to openFiles if not already there
    setOpenFiles(prev => {
      if (prev.includes(path)) return prev;
      return [...prev, path];
    });
    // Set as active file
    setActiveFile(path);
    // Request content if we don't have it
    if (!fileContents[path]) {
      if (!sessionKey) {
        showToast("Connect your Roblox Studio plugin to read file content.", "error");
        return;
      }
      waitingForFileRef.current = path;
      fetch("/api/request-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, fileName: path })
      }).catch(err => console.error("Failed to request file:", err));
    }
  }, [sessionKey, fileContents, showToast]);

  // Update session key in project when it changes
  useEffect(() => {
    if (activeProjectId && sessionKey && !isProjectsLoading) {
      fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeProjectId, sessionKey }),
      }).catch(() => { });
    }
  }, [sessionKey, activeProjectId, isProjectsLoading]);



  //

  // antigravity functions removed

  useEffect(() => {
    if (messages.length > 0) {
      window.localStorage.setItem(
        "apple-juice-chat-history",
        JSON.stringify(messages),
      );
    }
  }, [messages]);



  async function createPairOnServer() {

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

          try {
            window.alert(`Pair creation failed (server error): ${detail}`);
          } catch {
            /* ignore */
          }
          return;
        }

        if (res.status === 401) {

        } else {

        }
        return;
      }

      const payload = await res.json();
      const key = (payload?.sessionKey as string) || "";
      setSessionKey(key);

    } catch (err) {


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

      // Filter shared-credit (Kiro) models by plan tier.
      if (actualProvider === "apple_juice_ai" || actualProvider === "kiro") {
        const plan = (usage?.plan || "free") as KiroPlan;
        nextModels = kiroModelsForPlan(plan);
      }

      setAvailableModels(nextModels);

      const targetModel = preferredModel || selectedModel;
      if (targetModel && nextModels.includes(targetModel)) {
        setSelectedModel(targetModel);
      } else {
        const fallbackDefault =
          actualProvider === "apple_juice_ai" || actualProvider === "kiro"
            ? KIRO_DEFAULT_MODEL
            : usedProvider === "google"
              ? "gemini-3-flash"
              : "gpt-4o-mini";
        const first = nextModels.includes(KIRO_DEFAULT_MODEL)
          ? KIRO_DEFAULT_MODEL
          : nextModels[0] || fallbackDefault;
        setSelectedModel(first);
        window.localStorage.setItem("apple-juice-model", first);
      }
    } catch {
      setAvailableModels(FALLBACK_MODELS);

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
    const inputValue = (
      provider === "google"
        ? googleKey
        : openaiKey
    ).trim();
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

  // Replace the placeholder "thinking…" steps with the REAL activity timeline
  // derived from the AI's actual plan, then tick each step done in sequence so
  // the user watches it read → write → create → playtest in real time.
  function playRealActivityFeed(payload: { thinking?: string; scripts?: any[] }) {
    const feed = buildActivityFeed(payload);
    if (feed.length === 0) {
      setThinkingSteps([]);
      return;
    }
    setThinkingSteps(feed);
    // Stagger completion so it reads as live progress (capped so it never lags).
    const per = Math.min(450, Math.max(180, 1600 / feed.length));
    feed.forEach((_, i) => {
      const t = setTimeout(() => {
        setThinkingSteps((prev) => {
          if (prev.length !== feed.length) return prev; // a newer run replaced us
          return prev.map((s, idx) => (idx <= i ? { ...s, done: true } : s));
        });
        if (i === feed.length - 1) {
          const clr = setTimeout(() => {
            setThinkingSteps((prev) => (prev.length === feed.length ? [] : prev));
          }, 900);
          stepTimeoutsRef.current.push(clr);
        }
      }, (i + 1) * per);
      stepTimeoutsRef.current.push(t);
    });
  }

  // Build a focused, self-contained prompt for the auto-fix loop. It hands the
  // model the exact runtime error(s) plus the current source of the scripts it
  // just generated, so it repairs in place instead of regenerating blind.
  function buildAutoFixPrompt(errorText: string, attempt: number): string {
    const scripts = lastGeneratedScriptsRef.current || [];
    let codeBlock = "";
    for (const s of scripts) {
      if (!s.code) continue;
      codeBlock += `\n--- ${s.type || "Script"}: ${s.parent}.${s.name} ---\n${s.code}\n`;
    }
    return [
      `[AUTO-FIX attempt ${attempt}] The playtest you just ran FAILED with the following runtime error(s):`,
      "",
      errorText,
      "",
      "Here is the current source of the scripts involved:",
      codeBlock || "(source unavailable — infer from the error)",
      "",
      "Diagnose the ROOT CAUSE of the error above and fix it. Rules:",
      "- Only change what is necessary to resolve the error; do not rewrite working logic or rename things.",
      "- Output the COMPLETE corrected script(s) via the create action (full file, no snippets).",
      "- If the error is a nil/index error, add the missing guard or WaitForChild with a timeout.",
      "- If it's a missing instance/remote, create it before it's referenced.",
      "- End with run_playtest so the fix is verified automatically.",
    ].join("\n");
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
    function safeExtractString(str: string, fieldName: string): string | null {
      const fieldIdx = str.indexOf(`"${fieldName}"`);
      if (fieldIdx === -1) return null;
  const colonIdx = str.indexOf(':', fieldIdx);
  if (colonIdx === -1) return null;
  const startQuote = str.indexOf('"', colonIdx);
  if (startQuote === -1) return null;
  
  let endIdx = startQuote + 1;
  let isEscaped = false;
  while (endIdx < str.length) {
    const char = str[endIdx];
    if (isEscaped) {
      isEscaped = false;
    } else if (char === '\\\\') {
      isEscaped = true;
    } else if (char === '"') {
      break;
    }
    endIdx++;
  }
  return str.substring(startQuote + 1, endIdx);
}

    function parseChatResponse(text: string): any {
      let cleaned = text.trim();

      // Remove any preamble before the first { or first ```
      const firstFence = cleaned.indexOf("```");
      const firstBrace = cleaned.indexOf("{");

      if (firstFence !== -1 && (firstBrace === -1 || firstFence < firstBrace)) {
        // It has fences. Extract content between first and last fence
        const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
        if (match) {
          cleaned = match[1].trim();
        }
      } else if (firstBrace !== -1) {
        // No fences but has a brace. Extract from first brace to end
        cleaned = cleaned.substring(firstBrace).trim();
      }

      try {
        return JSON.parse(cleaned);
      } catch (e) {
        // Truncated JSON recovery logic
        console.warn(
          "[AppleJuice] Truncated JSON detected, attempting recovery...",
        );
        let recovered = cleaned;

        // Robust stack-based JSON recovery
        let inString = false;
        let isEscaped = false;
        const stack: string[] = [];

        for (let i = 0; i < recovered.length; i++) {
          const char = recovered[i];
          if (isEscaped) {
            isEscaped = false;
            continue;
          }
          if (char === "\\") {
            isEscaped = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === "{") stack.push("}");
            else if (char === "[") stack.push("]");
            else if (char === "}" || char === "]") stack.pop();
          }
        }

        if (isEscaped) {
          recovered = recovered.slice(0, -1); // Remove trailing backslash if cut off exactly at escape
        }
        if (inString) {
          recovered += '"';
        }

        while (stack.length > 0) {
          recovered += stack.pop();
        }

        try {
          return JSON.parse(recovered);
        } catch (e2) {
          // Aggressive regex-based extraction for badly mangled/truncated JSON
          const thinkingMatch = safeExtractString(cleaned, "thinking");
          const messageMatch = safeExtractString(cleaned, "message");

          const scripts: any[] = [];
          // Safe script block extraction without catastrophic regex
          let searchIndex = 0;
          while (true) {
            const nameMatch = cleaned
              .substring(searchIndex)
              .match(/"name"\s*:\s*"([^"]+)"/);
            if (!nameMatch || nameMatch.index === undefined) break;

            const absoluteIndex = searchIndex + nameMatch.index;
            // Find the nearest opening brace before this name
            const blockStart = cleaned.lastIndexOf("{", absoluteIndex);
            if (blockStart === -1 || blockStart < searchIndex) {
              searchIndex = absoluteIndex + nameMatch[0].length;
              continue;
            }

            // Find the closing brace (heuristic: next } followed by , or ] or end of string, or just the next })
            let blockEnd = cleaned.indexOf("}", absoluteIndex);
            if (blockEnd === -1) blockEnd = cleaned.length;

            const block = cleaned.substring(blockStart, blockEnd + 1);
            const scriptBlocks = [block];
            if (scriptBlocks) {
              for (const block of scriptBlocks) {
                try {
                  let b = block.trim();
                  // Fix truncated block
                  if (b.split('"').length % 2 === 0) b += '"';
                  if (
                    (b.match(/\{/g) || []).length >
                    (b.match(/\}/g) || []).length
                  )
                    b += "}";
                  const s = JSON.parse(b);
                  if (
                    s.name &&
                    (s.code ||
                      s.action === "delete" ||
                      s.action === "create_instance" ||
                      s.action === "rename_instance" ||
                      s.action === "move_instance")
                  )
                    scripts.push(s);
                } catch {
                  // Regex fallback for the block itself - very aggressive
                  const name = block.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
                  const parent = block.match(/"parent"\s*:\s*"([^"]+)"/)?.[1];
                  const type = block.match(/"type"\s*:\s*"([^"]+)"/)?.[1];
                  const action = block.match(/"action"\s*:\s*"([^"]+)"/)?.[1];

                  // Extract code more aggressively: everything after "code": " until the end of the block
                  let code = "";
                  const codeStart = block.indexOf('"code"');
                  if (codeStart !== -1) {
                    const firstQuoteAfterCode = block.indexOf(
                      '"',
                      codeStart + 8,
                    );
                    if (firstQuoteAfterCode !== -1) {
                      // Find the end: either the next unescaped quote, or the end of the block
                      let content = block.substring(firstQuoteAfterCode + 1);
                      const nextQuote = content.match(/[^\\]"/);
                      if (nextQuote) {
                        content = content.substring(0, nextQuote.index! + 1);
                      }
                      code = content
                        .replace(/\\n/g, "\n")
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, "\\");
                    }
                  }

                  if (name && (code || action === "delete")) {
                    scripts.push({
                      name,
                      parent: parent || "ServerScriptService",
                      type: type || "Script",
                      action: action || "create",
                      code: code,
                      className: block.match(
                        /"className"\s*:\s*"([^"]+)"/,
                      )?.[1],
                      instanceName: block.match(
                        /"instanceName"\s*:\s*"([^"]+)"/,
                      )?.[1],
                      oldPath: block.match(/"oldPath"\s*:\s*"([^"]+)"/)?.[1],
                      newName: block.match(/"newName"\s*:\s*"([^"]+)"/)?.[1],
                      newParentPath: block.match(
                        /"newParentPath"\s*:\s*"([^"]+)"/,
                      )?.[1],
                    });
                  }
                }
              }

              searchIndex = blockEnd + 1;
            }

            const recoveredObj = {
              message: (
                messageMatch ||
                "The response was truncated, but I've recovered the scripts generated so far."
              )
                .replace(/\\n/g, "\n")
                .replace(/\\"/g, '"'),
              thinking: (thinkingMatch || "")
                .replace(/\\n/g, "\n")
                .replace(/\\"/g, '"'),
              scripts: scripts.length > 0 ? scripts : undefined,
              suggestions: ["Continue generating"],
            };
            return recoveredObj;
          }
        }
      }
    }

    function buildAssistantMessage(
      p: any,
      files: { name: string; content?: string; type?: string }[],
      pendingSync: boolean,
      isHidden: boolean = false,
    ): ChatMessage {
      let rawScripts = p.scripts;
      if (!rawScripts && (p.action || p.scriptName)) {
        rawScripts = [p];
      } else if (rawScripts && !Array.isArray(rawScripts)) {
        rawScripts = [rawScripts];
      }

      const scriptCount = rawScripts?.length || 0;
      const defaultMsg =
        scriptCount > 0
          ? `I've generated ${scriptCount} script${scriptCount > 1 ? "s" : ""} for your system. You can review them below. (The AI hit a limit, so some parts might be missing)`
          : "The AI was interrupted before it could finish the scripts. You can click 'Continue generating' below to have it pick up right where it left off.";

      return {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36),
        role: "assistant",
        content: p.message || defaultMsg,
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
                  f.name === p.scriptName || f.name === p.scriptName + ".lua",
              )?.content,
              className: p.className || p.type || "Script",
              instanceName: p.instanceName || p.name,
              oldPath: p.oldPath,
              newName: p.newName,
              newParentPath: p.newParentPath,
            }
            : undefined,
        scripts: rawScripts?.map((s: any, index: number) => ({
          name: s.name || `UnnamedScript_${index + 1}`,
          parent: s.parent || "ServerScriptService",
          type: s.type || "Script",
          action: (s.action as "create" | "delete") || "create",
          lineCount: s.lineCount || 0,
          code: s.code || "",
          originalCode: files.find(
            (f: any) => f.name === s.name || f.name === s.name + ".lua",
          )?.content,
          requires: s.requires || [],
          className: s.className || s.type,
          instanceName: s.instanceName || s.name,
          oldPath: s.oldPath,
          newName: s.newName,
          newParentPath: s.newParentPath,
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
    if (!isHidden) {
      continuationRef.current = 0;
    }
    console.log("[AppleJuice] Submit started", {
      trimmed,
      sessionKey,
      provider,
    });

    if (!trimmed) {
      console.warn("[AppleJuice] Missing prompt", { trimmed, sessionKey });
      return;
    }

    if (!isPluginConnected) {
      showToast(
        "Connect your Roblox Studio plugin to start building.",
        "error",
      );
      playSound("error");
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
          "error",
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
    let contextMessages = messagesRef.current;

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
        selectedNodeContext: selectedWorkspaceItemId ? findNodeById(workspaceEditorData, selectedWorkspaceItemId) : undefined,
        isHidden,
      };

      messageId = userMessage.id;
      contextMessages = [...messagesRef.current, userMessage];
      setMessages(contextMessages);
      setPrompt("");

      lastPromptRef.current = trimmed;
    } else {
      // Find the ID of the existing message we're retrying for
      const lastUser = [...messagesRef.current]
        .reverse()
        .find((m) => m.role === "user");
      messageId = lastUser?.id || "";
      contextMessages = messagesRef.current;
    }

    setIsGenerating(true);
    isGeneratingRef.current = true;
    playSound("whoosh");


    const promptSnippet =
      trimmed.length > 25 ? trimmed.substring(0, 25) + "..." : trimmed;
    const isAsset =
      trimmed.toLowerCase().includes("insert") ||
      trimmed.toLowerCase().includes("build") ||
      trimmed.toLowerCase().includes("model") ||
      trimmed.toLowerCase().includes("part");

    try {
      let finalPromptText = trimmed;
      
      const selectedNode = selectedWorkspaceItemId ? findNodeById(workspaceEditorData, selectedWorkspaceItemId) : null;
      if (selectedNode) {
        finalPromptText = `[Context: User has selected ${selectedNode.className} "${selectedNode.name}" in the Explorer] ${trimmed}`;
      }

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

          }
        }
      }

      if (mode === "thinking") {
        const isDeepSeekModel = selectedModel
          .toLowerCase()
          .includes("deepseek");
        const isR1 = selectedModel.toLowerCase().includes("r1");

        if (isDeepSeekModel) {
          // DeepSeek-specific thinking chain
          setThinkingSteps([
            {
              icon: "reasoning",
              label: isR1
                ? `R1 deep reasoning: "${promptSnippet}"...`
                : `DeepSeek analyzing: "${promptSnippet}"...`,
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
                        ? `Scanning ${fileNames} for patterns...`
                        : "Mapping project architecture...",
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
                          icon: "optimizing",
                          label: isR1
                            ? "Chain-of-thought synthesis..."
                            : "Optimizing Luau output...",
                          done: false,
                        },
                      ];
                    }
                    return prev;
                  });

                  if (isR1) {
                    const t3 = setTimeout(
                      () => {
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
                      },
                      3000 + Math.random() * 4000,
                    );
                    stepTimeoutsRef.current.push(t3);
                  }
                },
                2000 + Math.random() * 2500,
              );
              stepTimeoutsRef.current.push(t2);
            },
            1500 + Math.random() * 2000,
          );
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
        const t1 = setTimeout(
          () => {
            setThinkingSteps((prev) => {
              if (prev.length === 1 && !prev[0].done) {
                return [
                  { ...prev[0], done: true },
                  {
                    icon: "generating",
                    label: fileNames
                      ? `Writing code with context from ${fileNames}...`
                      : "Generating optimized Luau...",
                    done: false,
                  },
                ];
              }
              return prev;
            });
          },
          1500 + Math.random() * 2000,
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
          prompt:
            (attachedAsset
              ? `[System Note: The user has attached the Roblox asset "${attachedAsset.name}" (ID: ${attachedAsset.id}) to this message. Please fulfill their request, using this asset if appropriate. If they don't specify what to do with it, insert it into Workspace.]\n\n${finalPromptText}`
              : finalPromptText) +
            (isDeepIntelligence
              ? "\n\n[System Note: Deep Intelligence Mode ACTIVE. Please analyze the entire provided project structure and relationships carefully to ensure cross-script compatibility and optimal architectural patterns.]"
              : "") +
            (`\n\n[System Note: Your current mode is set to "${agentMode.toUpperCase()}". ${agentMode === 'plan'
                ? "Focus primarily on architectural planning, providing pseudocode, and discussing implementation strategy without generating full code blocks unless explicitly asked."
                : "Focus primarily on generating high-quality, production-ready Luau code and scripts that can be directly inserted into Roblox Studio. Minimize conversational filler."
              }]`),
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
          tree: projectTree.join("\n"),
          uiStyle: selectedUIStyle,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Failed to read stream body");
        const decoder = new TextDecoder();
        let accumulated = "";

        const lastAssistantMsg = [...messagesRef.current]
          .reverse()
          .find((m) => m.role === "assistant");
        const generateId = () =>
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36);
        const assistantMsgId =
          continuationRef.current > 0 && lastAssistantMsg
            ? lastAssistantMsg.id
            : generateId();

        if (continuationRef.current === 0 || !lastAssistantMsg) {
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMsgId,
              role: "assistant",
              content: "",
              pendingSync: false,
              isHidden,
            },
          ]);
        }

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
                  const reasoning =
                    data.choices?.[0]?.delta?.reasoning_content ||
                    data.choices?.[0]?.delta?.reasoning ||
                    data.choices?.[0]?.delta?.thinking ||
                    "";

                  if (reasoning) {
                    setThinkingSteps((prev) => {
                      const index = prev.findIndex(
                        (s) => "icon" in s && s.icon === "reasoning",
                      );
                      if (index !== -1) {
                        const newSteps = [...prev];
                        const snippet =
                          reasoning.length > 50
                            ? "..." + reasoning.substring(reasoning.length - 50)
                            : reasoning;
                        newSteps[index] = {
                          ...newSteps[index],
                          label: `Reasoning: ${snippet.replace(/\n/g, " ")}`,
                          done: false,
                        };
                        return newSteps;
                      }
                      return prev;
                    });
                  }

                  if (delta) {
                    accumulated += delta;

                    // THROTTLE UI UPDATES (Every 100ms) to prevent lag
                    const now = Date.now();
                    if (now - lastUpdateRef.current > 100) {
                      lastUpdateRef.current = now;

                      let displayContent = accumulated;
                      let extractedThinking = "";

                      // DeepSeek specific: Extract <think>...</think> or <think>... (ongoing)
                      const thinkStartIdx = accumulated.indexOf("<think>");
                      if (thinkStartIdx !== -1) {
                        const thinkEndIdx = accumulated.indexOf("</think>");
                        if (thinkEndIdx !== -1) {
                          // Full think block
                          extractedThinking = accumulated.substring(thinkStartIdx + 7, thinkEndIdx).trim();
                          // Strip think block from what gets parsed as JSON
                          displayContent = accumulated.substring(thinkEndIdx + 8).trim();
                        } else {
                          // Ongoing think block
                          extractedThinking = accumulated.substring(thinkStartIdx + 7).trim();
                          displayContent = ""; // Don't show anything in the main chat yet
                        }
                      }

                      // If the response looks like a JSON object
                      if (
                        displayContent.trim().startsWith("{") ||
                        displayContent.trim().startsWith("```json")
                      ) {
                        try {
                          const cleanAccumulated = displayContent
                            .trim()
                            .replace(/^```json\s*/, "");

                          // Extract "thinking": "..." field
                          const thinkingMatch = safeExtractString(cleanAccumulated, "thinking");
                          if (thinkingMatch) {
                            extractedThinking = thinkingMatch
                              .replace(/\\n/g, "\n")
                              .replace(/\\"/g, '"')
                              .replace(/\\\\/g, "\\");
                          }

                          let messageText = "";
                          const msgIdx = cleanAccumulated.indexOf('"message"');
                          if (msgIdx !== -1) {
                            const msgColon = cleanAccumulated.indexOf(':', msgIdx);
                            if (msgColon !== -1) {
                              const msgQuote = cleanAccumulated.indexOf('"', msgColon);
                              if (msgQuote !== -1) {
                                const scriptsIdx = cleanAccumulated.indexOf('"scripts"', msgQuote);
                                let rawMsg = "";
                                if (scriptsIdx !== -1) {
                                  // Found scripts array, message ends at the quote before it
                                  const endQuote = cleanAccumulated.lastIndexOf('"', scriptsIdx - 1);
                                  rawMsg = cleanAccumulated.substring(msgQuote + 1, endQuote > msgQuote ? endQuote : scriptsIdx);
                                } else {
                                  // No scripts array yet, message goes to end
                                  rawMsg = cleanAccumulated.substring(msgQuote + 1);
                                }
                                messageText = rawMsg.replace(/("(\s*,)?\s*)$/, '')
                                  .replace(/\\n/g, "\n")
                                  .replace(/\\"/g, '"')
                                  .replace(/\\\\/g, "\\");
                              }
                            }
                          }
                          
                          if (messageText) {
                            displayContent = messageText;
                          }

                          const matches = [
                            ...cleanAccumulated.matchAll(
                              /"name"\s*:\s*"([^"]+)"/g,
                            ),
                          ];
                          const scriptCount = matches.length;
                          
                          if (scriptCount > 0) {
                            const latestScript = matches[matches.length - 1][1];
                            let codeSnippet = "";
                            const codeIdx = cleanAccumulated.lastIndexOf('"code"');
                            
                            if (codeIdx !== -1) {
                              const colonIdx = cleanAccumulated.indexOf(':', codeIdx);
                              if (colonIdx !== -1) {
                                const quoteIdx = cleanAccumulated.indexOf('"', colonIdx);
                                if (quoteIdx !== -1) {
                                  let rawCode = cleanAccumulated.substring(quoteIdx + 1);
                                  rawCode = rawCode.replace(/("(\s*})?\s*]?\s*}?\s*)$/, '');
                                  codeSnippet = rawCode
                                    .replace(/\\n/g, "\n")
                                    .replace(/\\"/g, '"')
                                    .replace(/\\\\/g, "\\")
                                    .replace(/\\t/g, "\t");
                                }
                              }
                            }
                            
                            const scriptStatus = `\n\n---\n\n⚙️ **Building system (${scriptCount} script${scriptCount > 1 ? "s" : ""})...**\nCurrently generating: \`${latestScript}\`\n\n\`\`\`lua\n${codeSnippet}\n\`\`\``;
                            displayContent = messageText ? displayContent + scriptStatus : scriptStatus.trim();
                          } else if (cleanAccumulated.includes('"scripts"')) {
                            const prepStatus = "🧠 *Processing architecture and preparing scripts...*";
                            displayContent = messageText ? displayContent + `\n\n---\n\n${prepStatus}` : prepStatus;
                          }
                        } catch (e) { }
                      }

                      if (extractedThinking) {
                        setThinkingSteps((prev) => {
                          const index = prev.findIndex(
                            (s) => "icon" in s && s.icon === "reasoning",
                          );
                          const snippet =
                            extractedThinking.length > 50
                              ? "..." +
                              extractedThinking.substring(
                                extractedThinking.length - 50,
                              )
                              : extractedThinking;
                          const labelText = `Reasoning: ${snippet.replace(/\n/g, " ")}`;

                          if (index !== -1) {
                            const newSteps = [...prev];
                            newSteps[index] = {
                              ...newSteps[index],
                              label: labelText,
                              done: false,
                            };
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
                            {
                              ...last,
                              content: displayContent,
                              thinking: extractedThinking || last.thinking,
                            },
                          ];
                        }
                        return prev;
                      });
                    }
                  }
                } catch (e) { }
              }
            }
          }
        } catch (streamErr) {
          // Stream was interrupted (e.g. Vercel timeout, network drop).
          // Proceed gracefully with whatever we accumulated so far.
          console.warn("[AppleJuice] Stream interrupted:", streamErr);
        }

        // Mark steps as done only after stream completes
        setThinkingSteps((prev) => prev.map((s) => ({ ...s, done: true })));

        // Process the finalized content for scripts
        const result = parseChatResponse(accumulated);
        const payloadFiles = [...attachedFiles];
        setAttachedFiles([]);
        setAttachedAsset(null);

        const isTruncated =
          accumulated.trim().endsWith("...") ||
          (accumulated.match(/\{/g) || []).length >
          (accumulated.match(/\}/g) || []).length ||
          (accumulated.match(/\[/g) || []).length >
          (accumulated.match(/\]/g) || []).length;

        setMessages((prev) => {
          const index = prev.findIndex((m) => m.id === assistantMsgId);
          if (index !== -1) {
            const last = prev[index];
            const structured = buildAssistantMessage(
              result,
              payloadFiles,
              true,
            );

            let mergedScripts = structured.scripts || [];
            let mergedContent =
              structured.content || (structured.script ? "" : accumulated);

            if (continuationRef.current > 0 && last.content) {
              // Merge scripts
              const existingScripts =
                last.scripts || (last.script ? [last.script] : []);
              const existingNames = new Set(
                existingScripts.map((s) => s.name || ""),
              );
              const newScripts = (structured.scripts || []).filter(
                (s) => !existingNames.has(s.name || ""),
              );
              mergedScripts = [...existingScripts, ...newScripts];

              // Merge content/message
              if (
                structured.content &&
                !last.content.includes(structured.content)
              ) {
                mergedContent = last.content + "\n\n" + structured.content;
              } else {
                mergedContent = last.content;
              }
            } else {
              mergedContent =
                structured.content ||
                (structured.scripts?.length
                  ? ""
                  : structured.script
                    ? ""
                    : accumulated);
            }

            let finalScriptsToSync: any[] = [];
            const newMsgs = [...prev];
            newMsgs[index] = {
              ...last,
              ...structured,
              scripts: mergedScripts,
              content: mergedContent,
            };
            finalScriptsToSync = mergedScripts;

            // Streamed responses bypass the server's quality pass, so apply
            // the same deterministic validation client-side: dependency
            // ordering, print headers, dedupe, single trailing playtest.
            if (finalScriptsToSync.length > 0) {
              try {
                const report = validateGeneration(finalScriptsToSync as any, {
                  ensurePlaytest: autoPlaytestRef.current || isAutoFixingRef.current,
                });
                if (report.scripts.length > 0) {
                  finalScriptsToSync = report.scripts as any[];
                  newMsgs[index] = {
                    ...newMsgs[index],
                    scripts: finalScriptsToSync,
                  };
                }
              } catch {
                /* validation is best-effort; fall back to raw scripts */
              }
            }

            // Update ref for auto-fix context
            if (finalScriptsToSync.length > 0) {
              lastGeneratedScriptsRef.current = finalScriptsToSync.map(
                (s: any) => ({
                  ...s,
                  code: s.code || "",
                }),
              );
            }

            return newMsgs;
          }
          return prev;
        });

        // Automatic Continuation Logic
        if (isTruncated && continuationRef.current < 3) {
          continuationRef.current += 1;
          console.log(
            `[AppleJuice] Auto-continuing (Attempt ${continuationRef.current}/4)...`,
          );

          showToast(
            `Continuing generation of large system (Part ${continuationRef.current + 1}/4)...`,
            "info",
          );

          setTimeout(() => {
            void submitPrompt("Continue generating", true);
          }, 1000);
        } else {
          continuationRef.current = 0;

          const readScriptAction = lastGeneratedScriptsRef.current.find(
            (s: any) => s.action === "read_script",
          );

          if (readScriptAction && readScriptAction.name) {
            // Trigger read script flow
            fetch("/api/request-file", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: sessionKey,
                fileName: readScriptAction.name,
              }),
            });

            waitingForFileRef.current = readScriptAction.name;
          } else {
            // Auto-sync logic: sync if Autonomous Mode is on, OR if this is an auto-fix response
            const shouldAutoSync = autoPlaytest || isAutoFixingRef.current;
            if (
              shouldAutoSync &&
              lastGeneratedScriptsRef.current.length > 0
            ) {
              const statusMsg = isAutoFixingRef.current
                ? "Syncing auto-fix to Studio..."
                : "Auto-syncing and starting playtest...";
              showToast(statusMsg, "info");

              const endpoint = "/api/revert-code";
              const body = {
                sessionKey,
                scripts: lastGeneratedScriptsRef.current,
              };
              fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              })
                .then((res) => {
                  if (res.ok) {
                    setMessages((msgs) =>
                      msgs.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, pendingSync: false }
                          : m,
                      ),
                    );
                  }
                })
                .finally(() => {
                  // Clear auto-fix flag after sync completes
                  isAutoFixingRef.current = false;
                });
            } else {
              isAutoFixingRef.current = false;
            }
          }
        }
        setIsGenerating(false);
        isGeneratingRef.current = false;
        playSound("success");
        setThinkingSteps([]);
        void fetchUsage();
        return;
      }

      if (!response.ok) {
        let errText = response.statusText;
        try {
          const errPayload = await response.json();
          errText = errPayload?.detail || errPayload?.error || errText;
        } catch (err: any) {
          console.error("AI Error:", err);

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
        action?:
        | "create"
        | "delete"
        | "create_instance"
        | "rename_instance"
        | "move_instance"
        | "run_playtest"
        | "stop_playtest"
        | "execute_luau"
        | "insert_asset";
        name?: string;
        className?: string;
        instanceName?: string;
        parent?: string;
        type?: string;
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

      // Track juice history removed


      showToast("Script generated and synced!", "success");
      playSound("success");

      const assistantMsg = buildAssistantMessage(
        payload,
        payloadFiles,
        true,
        isHidden,
      );

      // Feature: Simulated Streaming / Typing Effect
      const fullText = assistantMsg.content;
      assistantMsg.content = ""; // Start empty
      setMessages((prev) => [...prev, assistantMsg]);

      let currentIdx = 0;
      const words = fullText.split(" ");
      const typingInterval = setInterval(() => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            !last ||
            last.role !== "assistant" ||
            currentIdx >= words.length
          ) {
            clearInterval(typingInterval);
            return prev;
          }

          const newText =
            last.content + (currentIdx === 0 ? "" : " ") + words[currentIdx];
          currentIdx++;

          return [...prev.slice(0, -1), { ...last, content: newText }];
        });
      }, 30);

      setIsGenerating(false);
      isGeneratingRef.current = false;
      playSound("success");

      // Show the real activity timeline (read/write/create/playtest) from the
      // actual plan instead of the fabricated placeholder steps.
      playRealActivityFeed(payload);
      // Store the generated scripts for auto-fix context
      if (payload.scripts && Array.isArray(payload.scripts)) {
        lastGeneratedScriptsRef.current = payload.scripts.map((s: any) => ({
          ...s,
          name: s.name || "Unknown",
          parent: s.parent || "ServerScriptService",
          type: s.type || "Script",
          code: s.code || "",
        }));
      } else if (payload.code || payload.action === "create_instance") {
        lastGeneratedScriptsRef.current = [
          {
            ...payload,
            name: payload.scriptName || payload.name || "AIScript",
            parent:
              payload.scriptParent || payload.parent || "ServerScriptService",
            type: payload.scriptType || payload.type || "Script",
            code: payload.code || "",
          },
        ];
      }

      // Auto-sync + playtest logic (same as stream path)
      const readScriptAction = lastGeneratedScriptsRef.current.find(
        (s: any) => s.action === "read_script",
      );

      if (readScriptAction && readScriptAction.name) {
        // Trigger read script flow
        fetch("/api/request-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: sessionKey,
            fileName: readScriptAction.name,
          }),
        });

        waitingForFileRef.current = readScriptAction.name;
      } else {
        // When Autonomous Mode is on, sync the generated code and trigger a playtest.
        // The auto-fix loop will handle errors reported by the plugin.
        const shouldAutoSync = autoPlaytest || isAutoFixingRef.current;
        if (shouldAutoSync && lastGeneratedScriptsRef.current.length > 0) {
          // Only reset auto-fix retries for NEW user-initiated generations, not auto-fix responses
          if (!isAutoFixingRef.current) {
            autoFixRetriesRef.current = 0;
          }
          const statusMsg = isAutoFixingRef.current
            ? "Syncing auto-fix to Studio..."
            : "Auto-syncing and starting playtest...";
          showToast(statusMsg, "info");

          fetch("/api/revert-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionKey,
              scripts: lastGeneratedScriptsRef.current,
            }),
          })
            .then((res) => {
              if (res.ok) {
                setMessages((msgs) =>
                  msgs.map((m) =>
                    m.role === "assistant" && m === msgs[msgs.length - 1]
                      ? { ...m, pendingSync: false }
                      : m,
                  ),
                );
              }
            })
            .finally(() => {
              // Clear auto-fix flag after sync completes ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â the auto-fix LOOP
              // will re-engage if the plugin reports errors from the playtest
              isAutoFixingRef.current = false;
            });
        } else {
          // Not in autonomous mode ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â reset everything
          isAutoFixingRef.current = false;
          autoFixRetriesRef.current = 0;
        }
      }
      void fetchUsage();
    } catch (error) {
      stepTimeoutsRef.current.forEach(clearTimeout);
      stepTimeoutsRef.current = [];

      if (error instanceof DOMException && error.name === "AbortError") {

        showToast("Generation stopped.", "success");
        setTimeout(() => setThinkingSteps([]), 1000);
        setIsGenerating(false);
        isGeneratingRef.current = false;
        isAutoFixingRef.current = false;

        // Remove the user message bubble if the request was cancelled (only for visible messages)
        if (messageId && !isHidden) {
          setMessages((current) => current.filter((m) => m.id !== messageId));
          setPrompt(trimmed);
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


      showToast(detail, "error");
      playSound("error");
      setTimeout(() => setThinkingSteps([]), 1000);
      setIsGenerating(false);
      isGeneratingRef.current = false;
      isAutoFixingRef.current = false;


      // Remove the user message bubble if the request failed and we're not retrying
      // IMPORTANT: Only remove visible messages. Hidden auto-fix messages should stay
      // to preserve conversation context and prevent the chat from appearing to clear.
      if (messageId && !isHidden) {
        setMessages((current) => current.filter((m) => m.id !== messageId));
        setPrompt(trimmed);
      }

      void fetchUsage();
    }
  }

  async function checkVmStatus() {
    try {
      const res = await fetch("/api/vm-status", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setVmStatus(data.status === "online" ? "online" : "offline");
      } else {
        setVmStatus("offline");
      }
    } catch {
      setVmStatus("offline");
    }
  }

  useEffect(() => {
    if (showHelpWindow) {
      void checkVmStatus();
    }
  }, [showHelpWindow]);




  // Feature: Asset Search


  // Feature: Copy share link removed









  const rankTheme = useMemo(() => {
    const style = "zap"; // Defaulting to zap for now
    const plan = "pro"; // Placeholder

    if (style === "zap") {
      return {
        bg: "bg-[#0a0a0c]",
        accent: "#ccff00",
        accentBg: "bg-[#ccff00]",
        accentGlow: "shadow-[0_0_20px_rgba(204,255,0,0.2)]",
        borderAccent: "border-[#ccff00]/20",
        badgeBg: "bg-[#ccff00]",
        badgeText: plan.toUpperCase(),
        badgeColor: "text-black",
        btnBg: "bg-[#ccff00] hover:bg-[#d4ff33] text-black",
        fixBtnBg: "bg-[#ccff00] hover:bg-[#d4ff33] text-black",
      };
    }
    return {
      bg: "bg-[#0a0a0c]",
      accent: "#3b82f6",
      accentBg: "bg-blue-600",
      accentGlow: "shadow-[0_0_20px_rgba(37,99,235,0.2)]",
      borderAccent: "border-blue-500/20",
      badgeBg: "bg-blue-600",
      badgeText: plan.toUpperCase(),
      badgeColor: "text-white",
      btnBg: "bg-blue-600 hover:bg-blue-500 text-white",
      fixBtnBg: "bg-blue-600 hover:bg-blue-500 text-white",
    };
  }, []);



  const getProjectColor = (id: string) => {
    const colors = [
      "bg-emerald-500", "bg-blue-500", "bg-purple-500",
      "bg-amber-500", "bg-rose-500", "bg-indigo-500",
      "bg-cyan-500", "bg-fuchsia-500"
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const contextValue: DashboardContextType = {
    username,
    avatarUrl,
    isDemoMode: isDemoMode ?? false,
    isTester,

    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    isProjectsLoading,
    setIsProjectsLoading,
    sessionKey,
    setSessionKey,
    prompt,
    setPrompt,
    apiKey,
    setApiKey,
    provider,
    setProvider,
    openaiKey,
    setOpenaiKey,
    googleKey,
    setGoogleKey,
    selectedModel,
    setSelectedModel,
    availableModels,
    setAvailableModels,
    isLoadingModels,
    setIsLoadingModels,
    showSettings,
    setShowSettings,
    secretCode,
    setSecretCode,
    isRedeeming,
    setIsRedeeming,
    showProfileMenu,
    setShowProfileMenu,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isGenerating,
    setIsGenerating,
    isPluginConnected,
    setIsPluginConnected,
    vmStatus,
    setVmStatus,
    messages,
    setMessages,
    activeChatIndex,
    setActiveChatIndex,
    transferingChat,
    setTransferingChat,
    thinkingSteps,
    setThinkingSteps,
    gameLogs,
    setGameLogs,
    attachedFiles,
    setAttachedFiles,
    usage,
    setUsage,
    showPricing,
    setShowPricing,
    autoRetry,
    setAutoRetry,
    autoPlaytest,
    setAutoPlaytest,
    selectedUIStyle,
    setSelectedUIStyle,
    assetQuery,
    setAssetQuery,
    assetResults,
    setAssetResults,
    showAssetSearch,
    setShowAssetSearch,
    isSearchingAssets,
    setIsSearchingAssets,
    attachedAsset,
    setAttachedAsset,
    globalConfigs,
    setGlobalConfigs,
    teamMembers,
    setTeamMembers,
    activeTab,
    setActiveTab,
    workspaceStyle,
    setWorkspaceStyle,
    isLegacyExplorerOpen,
    setIsLegacyExplorerOpen,
    openFiles,
    setOpenFiles,
    activeFile,
    setActiveFile,
    fileContents,
    setFileContents,
    idePanel,
    setIdePanel,
    isIdeSidePanelOpen,
    setIsIdeSidePanelOpen,
    activeBottomPanel,
    setActiveBottomPanel,
    agentMode,
    setAgentMode,
    savedAssets,
    setSavedAssets: _setSavedAssets,
    isEditingAsset,
    setIsEditingAsset,
    editingAssetName,
    setEditingAssetName,
    workspaceEditorData,
    setWorkspaceEditorData,
    selectedWorkspaceItemId,
    setSelectedWorkspaceItemId,
    simulatorView,
    setSimulatorView,
    insertMenuVisible,
    setInsertMenuVisible,
    insertSearch,
    setInsertSearch,
    editingAssetCategory,
    setEditingAssetCategory,
    newAsset,
    setNewAsset,
    assetCategory,
    setAssetCategory,
    newConfig,
    setNewConfig,
    showConfigValues,
    setShowConfigValues,
    teamInviteInput,
    setTeamInviteInput,
    refillTime,
    placeholderText,
    projectTree,
    setProjectTree,

    // Non-state refs but packaged as functions/properties
    rankTheme,
    showToast: showToast as any,

    // Constants
    ingredients,
    selectedIngredients,
    setSelectedIngredients,
    isJarOpen,
    setIsJarOpen,
    showArchived,
    setShowArchived,
    selectedTreePaths,
    setSelectedTreePaths,
    showHelpWindow,
    setShowHelpWindow,
    helpMessages,
    setHelpMessages,
    isHelpGenerating,
    setIsHelpGenerating,
    helpInput,
    setHelpInput,
    isAddingConfig,
    setIsAddingConfig,
    isAddingAsset,
    setIsAddingAsset,
    isShowingVaultMenu,
    setIsShowingVaultMenu,
    showStyleMenu,
    setShowStyleMenu,
    insertCategories,
    defaultRobloxWorkspace,
    demoCursorPos,
    demoCursorScale,

    // Methods
    fetchUsage,
    loadProjects,
    createNewProject,
    archiveProject,
    renameProject,
    deleteProject,
    handleRename,
    handleAddInstance: handleAddInstance as any,
    handleDelete: handleDelete as any,
    switchProject,
    loadModels,
    submitPrompt,
    createPairOnServer,
    switchChat,
    handleVault,
    handleAttachAsset,
    getProjectColor,
    getRobloxIcon,
    isScriptType,
    isUIType,
    handleFileClick,
    saveApiKey,
    handleRedeemCode,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="contents">
        <AnimatePresence mode="wait">
          {isProjectsLoading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="h-screen w-full bg-gradient-to-br from-[#14161f] via-[#101219] to-[#0c0e14] flex flex-col items-center justify-center p-8 text-center relative z-[1000] overflow-hidden"
            >
              {/* Ambient Floating Blobs */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ccff00]/5 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '8s' }} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#3b82f6]/5 blur-[150px] rounded-full animate-pulse" style={{ animationDuration: '12s' }} />
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-[#8b5cf6]/5 blur-[100px] rounded-full animate-pulse" style={{ animationDuration: '10s' }} />
              </div>

              {/* Film Grain Texture Overlay */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
              }} />

              {/* Loader with Progress Indicator */}
              <div className="relative">
                <JuiceLoader size="lg" />
                
                {/* Circular Progress (Sleek Ring) */}
                <div className="absolute inset-[-20px] pointer-events-none">
                  <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 200 200">
                    <circle 
                      cx="100" cy="100" r="85" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="1" 
                      className="opacity-[0.05]" 
                    />
                    <motion.circle 
                      cx="100" cy="100" r="85" 
                      fill="none" 
                      stroke="#ccff00" 
                      strokeWidth="1" 
                      strokeDasharray="534"
                      initial={{ strokeDashoffset: 534 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 5, ease: "linear", repeat: Infinity }}
                      className="opacity-40"
                    />
                  </svg>
                </div>
              </div>

              {/* Bottom Brand/Status text */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute bottom-12 flex flex-col items-center gap-2"
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">
                  System Initializing
                </div>
                <div className="h-[1px] w-12 bg-white/10" />
              </motion.div>
            </motion.div>
          ) : (
            <motion.main
              key="dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-screen bg-gradient-to-br from-[#14161f] via-[#101219] to-[#0c0e14] text-white flex overflow-hidden font-sans relative selection:bg-[#ccff00]/20"
            >
              <style jsx global>{`
                @keyframes shop-pulse {
                  0%, 100% { box-shadow: 0 0 10px rgba(204, 255, 0, 0.1); }
                  50% { box-shadow: 0 0 25px rgba(204, 255, 0, 0.4); }
                }
                .animate-shop-pulse {
                  animation: shop-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
              `}</style>

              {/* ━━━ STRIPE SIGNATURE HERO ANIMATED TWISTED WAVE LINES ━━━ */}
              <StripeWave />

              {/* Stripe animated grid pattern & ambient neon highlights */}
              <div className="fixed inset-0 stripe-grid pointer-events-none z-0 opacity-20" />
              <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(204,255,0,0.10),transparent_70%)] pointer-events-none z-0" />
              <div className="fixed inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(59,130,246,0.07),transparent_55%)] pointer-events-none z-0" />
              <div className="fixed inset-0 bg-[radial-gradient(circle_at_85%_70%,rgba(139,92,246,0.07),transparent_55%)] pointer-events-none z-0" />

              {/* Mobile Header */}
              <div className="md:hidden absolute top-0 left-0 right-0 h-14 bg-[#1e2028] border-b border-black/[0.04] flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-[#ccff00] shadow-[0_0_10px_rgba(204,255,0,0.2)]">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-white"
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
                    <span className="font-extrabold text-white tracking-tight text-lg leading-none">
                      {activeProjectId ? projects.find(p => p.id === activeProjectId)?.name : "Apple Juice"}
                    </span>
                    <span className="text-[8px] text-white/20 mt-0.5 italic leading-none">
                      {activeProjectId ? "Active Workspace" : "Modern AI Game Studio"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="text-white/70 hover:text-white p-2 focus:outline-none"
                >
                  <Menu className="h-5 w-5 text-white" />
                </button>
              </div>

              {/* Overlay for mobile menu */}
              {isMobileMenuOpen && (
                <div
                  className="fixed inset-0 bg-black/40 z-[55] md:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}

              {/* SIDEBAR */}
              <DashboardSidebar />

              {/* MAIN CONTENT AREA */}
              <div className="flex-1 flex flex-col min-h-0 relative w-full overflow-hidden">
                {/* Top Navigation Bar */}
                <DashboardTopbar />

                {/* MAIN WORKSPACE WRAPPER */}
                <div className="flex-1 flex min-h-0 relative z-10 w-full overflow-hidden bg-transparent">
                  {activeProjectId && workspaceStyle === 'ide' ? (
                    /* ============================================================ */
                    /* IDE MODE LAYOUT */
                    /* ============================================================ */
                    <IdeLayout />
                  ) : (
                    /* ============================================================ */
                    /* LEGACY / LOBBY MODE LAYOUT */
                    /* ============================================================ */
                    <div className="flex-1 flex min-h-0 relative z-10 w-full overflow-hidden">
                      {/* LEGACY SIDEBAR */}
                      {activeProjectId && isLegacyExplorerOpen && (
                        <div className="w-64 flex-shrink-0 border-r border-white/[0.05] glossy-panel-dark flex flex-col overflow-hidden z-20">
                          <div className="h-11 flex items-center px-4 border-b border-white/5 bg-black/20">
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Project Explorer</span>
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            <WorkspaceTree
                              paths={projectTree}
                              onAddInstance={handleAddInstance}
                              onRename={handleRename}
                              onDelete={handleDelete}
                              selectedPaths={selectedTreePaths}
                              onVault={handleVault}
                              onSelectionChange={setSelectedTreePaths}
                              onFileClick={handleFileClick}
                            />
                          </div>
                        </div>
                      )}

                      {/* MAIN CONTENT AREA */}
                      <div className="flex-1 flex flex-col min-h-0 relative w-full overflow-hidden">
                        {!activeProjectId ? (
                          <div className="flex-1 flex flex-col min-h-0 relative w-full overflow-hidden lobby-wrapper">
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative z-10 overflow-hidden">
                              {activeTab === 'projects' && <ProjectsTab />}
                              {activeTab === 'assets' && <AssetsTab />}
                              {activeTab === 'nexus' && <NexusTab />}
                              {activeTab === 'team' && <TeamTab />}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col min-h-0 relative w-full overflow-hidden chat-wrapper">
                            <div className="flex-1 overflow-y-auto relative flex flex-col w-full items-center min-h-0 custom-scrollbar">
                              {/* ORIGINAL CHAT VIEW */}
                              <div className="w-full max-w-4xl px-6 py-12 flex flex-col gap-6">
                                {messages.length === 0 ? (
                                  <div className="flex-1" />
                                ) : (
                                  <div className="space-y-8 pb-32">
                                    {messages.map((message) => (
                                      <div key={message.id} className={`flex w-full ${message.role == "user" ? "justify-end" : "justify-start"} mb-6`}>
                                        <div className={`flex items-start gap-3 md:gap-4 max-w-full md:max-w-[90%] ${message.role == "user" ? "flex-row-reverse" : "flex-row"}`}>
                                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border ${message.role !== "user" ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/10"}`}>
                                            {message.role !== "user" ? (
                                              <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" fill="currentColor">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.78l1.24-1.25c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z" />
                                              </svg>
                                            ) : (
                                              <span className="text-[10px] font-black uppercase text-white/50">{username[0]}</span>
                                            )}
                                          </div>
                                          <div className="flex flex-col gap-2 min-w-0">
                                            <div className={`rounded-3xl px-6 py-4 text-[13px] leading-relaxed shadow-xl border ${message.role == "user" ? "bg-white/[0.04] text-white border-white/5" : "bg-black/40 text-white/90 border-white/[0.03] backdrop-blur-md"}`}>
                                              {message.content}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    {isGenerating && (
                                      <div className="py-4 px-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-inner space-y-4 max-w-[400px] my-4">
                                        <div className="flex items-center gap-3">
                                          <JuiceLoader size="sm" />
                                          <span className="text-[10px] font-black uppercase text-[#ccff00] tracking-widest animate-pulse">
                                            AI Generating Code...
                                          </span>
                                        </div>
                                        <div className="h-px bg-white/5" />
                                        <ThinkingFeed
                                          steps={thinkingSteps}
                                          isDeepSeek={selectedModel.toLowerCase().includes("deepseek")}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* LEGACY CHAT INPUT */}
                              <div className="w-full max-w-4xl p-6 flex-shrink-0 mt-auto">
                                <div className="flex items-center justify-between px-2 mb-2">
                                  <div className="text-[10px] text-white/40 uppercase tracking-widest font-black">
                                    Current Model: <span className="text-[#ccff00]">{selectedModel}</span>
                                  </div>
                                  <select 
                                    className="bg-white/5 border border-white/10 text-white/60 text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded outline-none cursor-pointer"
                                    value={selectedModel}
                                    onChange={(e) => {
                                      setSelectedModel(e.target.value);
                                      window.localStorage.setItem("apple-juice-model", e.target.value);
                                    }}
                                  >
                                    {availableModels.map((m: string) => <option key={m} value={m} className="bg-[#14161a]">{m}</option>)}
                                  </select>
                                </div>
                                <div className="relative">
                                  <SlashCommandInput
                                    value={prompt}
                                    onChange={setPrompt}
                                    onSubmit={() => submitPrompt()}
                                    placeholder="Type a command or press / for commands..."
                                    disabled={isGenerating}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 pl-4 pr-12 text-[13px] text-white focus:outline-none focus:border-[#ccff00]/30 min-h-[56px] max-h-48 custom-scrollbar transition-all"
                                    extraCommands={[]}
                                  />
                                  <button
                                    onClick={() => submitPrompt()}
                                    disabled={isGenerating || !prompt.trim()}
                                    className="absolute right-3 bottom-3 p-2 rounded-xl bg-[#ccff00] text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"
                                  >
                                    <ArrowRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.main>
          )}
        </AnimatePresence>

        <SettingsModal />

        <AnimatePresence>
          {showPricing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto"
              onClick={(e) => e.target === e.currentTarget && setShowPricing(false)}
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="bg-gradient-to-b from-[#16181f] to-[#0e0f15] border border-white/10 w-full max-w-5xl rounded-[2rem] relative shadow-[0_40px_120px_rgba(0,0,0,0.6)] overflow-hidden my-auto"
              >
                {/* Ambient glow */}
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#ccff00]/[0.07] blur-[120px] pointer-events-none" />
                <div className="absolute -bottom-32 -right-20 w-[400px] h-[400px] bg-violet-500/[0.06] blur-[120px] pointer-events-none" />

                {/* Close Button */}
                <button
                  onClick={() => setShowPricing(false)}
                  className="absolute top-5 right-5 z-20 p-2.5 rounded-full bg-white/[0.04] hover:bg-white/10 transition-all text-white/50 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="relative z-10 p-8 md:p-10">
                  {/* Header */}
                  <div className="text-center max-w-2xl mx-auto mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20 mb-4">
                      <Sparkles className="w-3.5 h-3.5 text-[#ccff00]" />
                      <span className="text-[10px] font-bold text-[#ccff00] uppercase tracking-[0.2em]">Apple Juice Shop</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
                      Top up your <span className="text-[#ccff00]">juice</span>
                    </h2>
                    <p className="text-sm text-white/45 mt-2.5 font-medium">
                      More credits, smarter models, and priority processing. Cancel anytime.
                    </p>
                  </div>

                  {/* Plans */}
                  <div className="grid md:grid-cols-3 gap-5">
                    {/* Free */}
                    <div className="group relative bg-white/[0.03] border border-white/[0.08] rounded-3xl p-7 flex flex-col hover:border-white/15 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-white">Free</h3>
                      </div>
                      <p className="text-xs text-white/40 font-medium mb-5">For trying things out</p>
                      <div className="flex items-baseline gap-1 mb-6">
                        <span className="text-4xl font-bold text-white tracking-tight">$0</span>
                        <span className="text-xs text-white/30 font-medium">/mo</span>
                      </div>
                      <ul className="space-y-3 text-[13px] font-medium text-white/65 mb-8">
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#ccff00] shrink-0" /> 2.0 credits daily</li>
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#ccff00] shrink-0" /> Auto router, Haiku 4.5 &amp; Qwen3 Coder</li>
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#ccff00] shrink-0" /> DeepSeek 3.2 &amp; MiniMax M2.1</li>
                      </ul>
                      <button className="mt-auto w-full py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 font-bold text-xs transition-all">
                        Current plan
                      </button>
                    </div>

                    {/* Pro (featured) */}
                    <div className="group relative bg-gradient-to-b from-[#ccff00]/[0.08] to-transparent border-2 border-[#ccff00]/60 rounded-3xl p-7 flex flex-col shadow-[0_0_40px_rgba(204,255,0,0.12)] md:-translate-y-3">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#ccff00] text-black font-bold text-[10px] uppercase tracking-wider rounded-full shadow-lg">
                        Most popular
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-[#ccff00]">Pro</h3>
                      </div>
                      <p className="text-xs text-white/45 font-medium mb-5">For serious builders</p>
                      <div className="flex items-baseline gap-1 mb-6">
                        <span className="text-4xl font-bold text-white tracking-tight">$19</span>
                        <span className="text-xs text-white/30 font-medium">/mo</span>
                      </div>
                      <ul className="space-y-3 text-[13px] font-medium text-white/75 mb-8">
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#ccff00] shrink-0" /> 10.0 credits daily</li>
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#ccff00] shrink-0" /> Claude Sonnet 4.6, 4.5 &amp; 4.0</li>
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#ccff00] shrink-0" /> GLM-5 &amp; MiniMax M2.5</li>
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#ccff00] shrink-0" /> Priority queue</li>
                      </ul>
                      <button className="mt-auto w-full py-3 rounded-xl bg-[#ccff00] text-black font-bold text-xs hover:bg-[#d4ff33] transition-all shadow-[0_4px_20px_rgba(204,255,0,0.3)] flex items-center justify-center gap-1.5">
                        Upgrade to Pro <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Ultra */}
                    <div className="group relative bg-white/[0.03] border border-white/[0.08] rounded-3xl p-7 flex flex-col hover:border-violet-500/30 transition-all duration-300">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-violet-300">Ultra</h3>
                      </div>
                      <p className="text-xs text-white/40 font-medium mb-5">Maximum firepower</p>
                      <div className="flex items-baseline gap-1 mb-6">
                        <span className="text-4xl font-bold text-white tracking-tight">$49</span>
                        <span className="text-xs text-white/30 font-medium">/mo</span>
                      </div>
                      <ul className="space-y-3 text-[13px] font-medium text-white/65 mb-8">
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-violet-400 shrink-0" /> 30.0 credits daily</li>
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-violet-400 shrink-0" /> Claude Opus 4.8, 4.7, 4.6 &amp; 4.5</li>
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-violet-400 shrink-0" /> Every Sonnet, Haiku &amp; open-weight model</li>
                        <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-violet-400 shrink-0" /> Priority processing</li>
                      </ul>
                      <button className="mt-auto w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-bold text-xs transition-all">
                        Go Ultra
                      </button>
                    </div>
                  </div>

                  {/* Footer reassurance */}
                  <div className="flex items-center justify-center gap-6 mt-8 text-[11px] text-white/35 font-medium">
                    <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#ccff00]" /> Secure checkout</span>
                    <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#ccff00]" /> Cancel anytime</span>
                    <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#ccff00]" /> Instant activation</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </DashboardContext.Provider>
  );
}