import { createContext, useContext, Dispatch, SetStateAction } from "react";
import {
  Project,
  ChatMessage,
  Usage,
  GlobalConfig,
  TeamMember,
  SavedAsset,
} from "./types";
import { ThinkingStep, ActivityStep } from "@/components/thinking-feed";

export interface DashboardContextType {
  // Properties passed from component props
  username: string;
  avatarUrl?: string;
  isDemoMode: "lobby" | "ide" | false;
  isTester: boolean;

  // React states
  projects: Project[];
  setProjects: Dispatch<SetStateAction<Project[]>>;
  activeProjectId: string | null;
  setActiveProjectId: Dispatch<SetStateAction<string | null>>;
  isProjectsLoading: boolean;
  setIsProjectsLoading: Dispatch<SetStateAction<boolean>>;
  sessionKey: string;
  setSessionKey: Dispatch<SetStateAction<string>>;
  prompt: string;
  setPrompt: Dispatch<SetStateAction<string>>;
  apiKey: string;
  setApiKey: Dispatch<SetStateAction<string>>;
  provider: "openai" | "google";
  setProvider: Dispatch<SetStateAction<"openai" | "google">>;
  openaiKey: string;
  setOpenaiKey: Dispatch<SetStateAction<string>>;
  googleKey: string;
  setGoogleKey: Dispatch<SetStateAction<string>>;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  availableModels: string[];
  setAvailableModels: Dispatch<SetStateAction<string[]>>;
  isLoadingModels: boolean;
  setIsLoadingModels: Dispatch<SetStateAction<boolean>>;
  showSettings: boolean;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  secretCode: string;
  setSecretCode: Dispatch<SetStateAction<string>>;
  isRedeeming: boolean;
  setIsRedeeming: Dispatch<SetStateAction<boolean>>;
  showProfileMenu: boolean;
  setShowProfileMenu: Dispatch<SetStateAction<boolean>>;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: Dispatch<SetStateAction<boolean>>;
  isGenerating: boolean;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  isPluginConnected: boolean;
  setIsPluginConnected: Dispatch<SetStateAction<boolean>>;
  vmStatus: "unknown" | "online" | "offline";
  setVmStatus: Dispatch<SetStateAction<"unknown" | "online" | "offline">>;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  activeChatIndex: number;
  setActiveChatIndex: Dispatch<SetStateAction<number>>;
  transferingChat: { sourceProjectId: string; sourceChatIndex: number } | null;
  setTransferingChat: Dispatch<SetStateAction<{ sourceProjectId: string; sourceChatIndex: number } | null>>;
  thinkingSteps: (ThinkingStep | ActivityStep)[];
  setThinkingSteps: Dispatch<SetStateAction<(ThinkingStep | ActivityStep)[]>>;
  gameLogs: string[];
  setGameLogs: Dispatch<SetStateAction<string[]>>;
  attachedFiles: { name: string; content?: string; type?: string }[];
  setAttachedFiles: Dispatch<SetStateAction<{ name: string; content?: string; type?: string }[]>>;
  usage: Usage;
  setUsage: Dispatch<SetStateAction<Usage>>;
  showPricing: boolean;
  setShowPricing: Dispatch<SetStateAction<boolean>>;
  autoRetry: boolean;
  setAutoRetry: Dispatch<SetStateAction<boolean>>;
  autoPlaytest: boolean;
  setAutoPlaytest: Dispatch<SetStateAction<boolean>>;
  selectedUIStyle: "none" | "stud" | "dracula" | "zap";
  setSelectedUIStyle: Dispatch<SetStateAction<"none" | "stud" | "dracula" | "zap">>;
  assetQuery: string;
  setAssetQuery: Dispatch<SetStateAction<string>>;
  assetResults: any[];
  setAssetResults: Dispatch<SetStateAction<any[]>>;
  showAssetSearch: boolean;
  setShowAssetSearch: Dispatch<SetStateAction<boolean>>;
  isSearchingAssets: boolean;
  setIsSearchingAssets: Dispatch<SetStateAction<boolean>>;
  attachedAsset: { id: number; name: string; thumbnail: string } | null;
  setAttachedAsset: Dispatch<SetStateAction<{ id: number; name: string; thumbnail: string } | null>>;
  globalConfigs: GlobalConfig[];
  setGlobalConfigs: Dispatch<SetStateAction<GlobalConfig[]>>;
  teamMembers: TeamMember[];
  setTeamMembers: Dispatch<SetStateAction<TeamMember[]>>;
  activeTab: "projects" | "assets" | "nexus" | "team";
  setActiveTab: Dispatch<SetStateAction<"projects" | "assets" | "nexus" | "team">>;
  workspaceStyle: "legacy" | "ide";
  setWorkspaceStyle: Dispatch<SetStateAction<"legacy" | "ide">>;// activeTab selection and main screen mode styles
  isLegacyExplorerOpen: boolean;
  setIsLegacyExplorerOpen: Dispatch<SetStateAction<boolean>>;
  openFiles: string[];
  setOpenFiles: Dispatch<SetStateAction<string[]>>;
  activeFile: string | null;
  setActiveFile: Dispatch<SetStateAction<string | null>>;
  fileContents: Record<string, string>;
  setFileContents: Dispatch<SetStateAction<Record<string, string>>>;
  idePanel: "explorer" | "search" | "chat" | "settings";
  setIdePanel: Dispatch<SetStateAction<"explorer" | "search" | "chat" | "settings">>;
  isIdeSidePanelOpen: boolean;
  setIsIdeSidePanelOpen: Dispatch<SetStateAction<boolean>>;
  activeBottomPanel: "terminal" | "logs" | "problems" | "none";
  setActiveBottomPanel: Dispatch<SetStateAction<"terminal" | "logs" | "problems" | "none">>;
  agentMode: "plan" | "build";
  setAgentMode: Dispatch<SetStateAction<"plan" | "build">>;
  savedAssets: SavedAsset[];
  setSavedAssets: Dispatch<SetStateAction<SavedAsset[]>>;
  isEditingAsset: number | null;
  setIsEditingAsset: Dispatch<SetStateAction<number | null>>;
  editingAssetName: string;
  setEditingAssetName: Dispatch<SetStateAction<string>>;
  workspaceEditorData: any[];
  setWorkspaceEditorData: Dispatch<SetStateAction<any[]>>;
  selectedWorkspaceItemId: string | null;
  setSelectedWorkspaceItemId: Dispatch<SetStateAction<string | null>>;
  simulatorView: "edit" | "test";
  setSimulatorView: Dispatch<SetStateAction<"edit" | "test">>;// asset sandbox sim modes
  insertMenuVisible: { id: string; x: number; y: number } | null;
  setInsertMenuVisible: Dispatch<SetStateAction<{ id: string; x: number; y: number } | null>>;
  insertSearch: string;
  setInsertSearch: Dispatch<SetStateAction<string>>;
  editingAssetCategory: string;
  setEditingAssetCategory: Dispatch<SetStateAction<string>>;
  newAsset: { name: string; category: string };
  setNewAsset: Dispatch<SetStateAction<{ name: string; category: string }>>;
  assetCategory: string;
  setAssetCategory: Dispatch<SetStateAction<string>>;
  newConfig: { key: string; value: string; category: "secret" | "config" | "directive" };
  setNewConfig: Dispatch<SetStateAction<{ key: string; value: string; category: "secret" | "config" | "directive" }>>;
  showConfigValues: Set<string>;
  setShowConfigValues: Dispatch<SetStateAction<Set<string>>>;
  teamInviteInput: string;
  setTeamInviteInput: Dispatch<SetStateAction<string>>;
  refillTime: string;
  placeholderText: string;
  projectTree: string[];
  setProjectTree: Dispatch<SetStateAction<string[]>>;

  // Non-state refs but packaged as functions/properties
  rankTheme: any;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;

  // Constants
  ingredients: any[];
  selectedIngredients: any[];
  setSelectedIngredients: Dispatch<SetStateAction<any[]>>;
  isJarOpen: boolean;
  setIsJarOpen: Dispatch<SetStateAction<boolean>>;
  showArchived: boolean;
  setShowArchived: Dispatch<SetStateAction<boolean>>;
  selectedTreePaths: string[];
  setSelectedTreePaths: Dispatch<SetStateAction<string[]>>;
  showHelpWindow: boolean;
  setShowHelpWindow: Dispatch<SetStateAction<boolean>>;
  helpMessages: ChatMessage[];
  setHelpMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  isHelpGenerating: boolean;
  setIsHelpGenerating: Dispatch<SetStateAction<boolean>>;
  helpInput: string;
  setHelpInput: Dispatch<SetStateAction<string>>;
  isAddingConfig: boolean;
  setIsAddingConfig: Dispatch<SetStateAction<boolean>>;
  isAddingAsset: boolean;
  setIsAddingAsset: Dispatch<SetStateAction<boolean>>;
  isShowingVaultMenu: boolean;
  setIsShowingVaultMenu: Dispatch<SetStateAction<boolean>>;
  showStyleMenu: boolean;
  setShowStyleMenu: Dispatch<SetStateAction<boolean>>;
  insertCategories: { name: string; items: string[] }[];
  defaultRobloxWorkspace: any[];
  demoCursorPos: { x: number; y: number };
  demoCursorScale: number;

  // Methods
  fetchUsage: () => Promise<void>;
  loadProjects: () => Promise<void>;
  createNewProject: (name: string) => Promise<void>;
  archiveProject: (id: string, archive?: boolean) => Promise<void>;
  renameProject: (id: string, newName: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  handleRename: (path: string, newName: string) => Promise<void>;
  handleAddInstance: (path: string, className: string, customName?: string) => Promise<void>;
  handleDelete: (path: string) => Promise<void>;
  switchProject: (p: Project) => Promise<void>;
  loadModels: (keyOverride?: string, forceSelect?: string) => Promise<void>;
  submitPrompt: (overridePrompt?: string | any, isHidden?: boolean) => Promise<void>;
  createPairOnServer: () => Promise<void>;
  switchChat: (idx: number) => void;
  handleVault: (asset: any) => void;
  revertCheckpoint: (messageId: string, checkpointId: string) => Promise<void>;
  applyToStudio: (messageId: string, scripts: any[]) => Promise<void>;
  handleAttachAsset: (asset: any) => void;
  getProjectColor: (id: string) => string;
  getRobloxIcon: (className: string) => string;
  isScriptType: (className: string) => boolean;
  isUIType: (className: string) => boolean;
  handleFileClick: (path: string) => void;
  saveApiKey: () => void;
  handleRedeemCode: () => Promise<void>;
}

export const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
