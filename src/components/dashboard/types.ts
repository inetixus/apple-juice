export interface DashboardClientProps {
  username: string;
  avatarUrl?: string;
  initialProjectId?: string | null;
  isDemoMode?: "lobby" | "ide" | false;
}

export interface Project {
  id: string;
  name: string;
  ownerUserId: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  createdAt: number;
  lastActiveAt: number;
  status?: "active" | "archived";
}

export interface ScriptMeta {
  name: string;
  parent: string;
  type?: string;
  action?:
    | "create"
    | "delete"
    | "create_instance"
    | "rename_instance"
    | "move_instance";
  lineCount: number;
  code: string;
  originalCode?: string;
  className?: string;
  instanceName?: string;
  oldPath?: string;
  newName?: string;
  newParentPath?: string;
  requires?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  script?: ScriptMeta;
  scripts?: ScriptMeta[];
  suggestions?: string[];
  thinking?: string;
  attachments?: { name: string; content?: string; type?: string }[];
  attachedAsset?: { id: number; name: string; thumbnail: string };
  pendingSync?: boolean;
  isHidden?: boolean;
  tokensUsed?: number;
  isReverted?: boolean;
  /** Stage 2: id of the stored inverse patch so this prompt can be reverted. */
  checkpointId?: string;
  simulatedWorkspace?: any[];
  selectedNodeContext?: any;
}

export interface Usage {
  isLoaded: boolean;
  usedMl: number;
  dailyMl: number;
  totalMl: number;
  remainingMl: number;
  bonusMl: number;
  plan: string;
}

export interface GlobalConfig {
  id: string;
  key: string;
  value: string;
  category: "secret" | "config" | "directive";
  createdAt: number;
}

export interface TeamMember {
  id: string;
  username: string;
  role: "owner" | "admin" | "developer" | "viewer";
  joinedAt: number;
  isOnline: boolean;
}

export interface SavedAsset {
  id: number;
  name: string;
  color: string;
  category: string;
  workspace: any[];
  thumbnail?: string;
}
