"use client";
import {
  FileCode2,
  Copy,
  ChevronDown,
  ChevronUp,
  Trash2,
  Box,
  Folder,
  Layout,
  MousePointer2,
  Image,
  Type,
  Database,
  Palette,
  Ghost,
  Zap,
  Cpu,
  Play,
  Plus,
  Move,
  Edit3,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/code-editor";

type ScriptMeta = {
  name: string;
  parent: string;
  type?: string;
  action?:
    | "create"
    | "delete"
    | "insert_asset"
    | "stop_playtest"
    | "run_playtest"
    | "create_instance"
    | "rename_instance"
    | "move_instance"
    | "read_script";
  lineCount: number;
  code: string;
  originalCode?: string;
  className?: string;
  instanceName?: string;
  oldPath?: string;
  newName?: string;
  newParentPath?: string;
};

const typeIconMap: Record<string, any> = {
  Script: FileCode2,
  LocalScript: FileCode2,
  ModuleScript: FileCode2,
  Folder: Folder,
  ScreenGui: Layout,
  Frame: Layout,
  TextButton: MousePointer2,
  ImageButton: MousePointer2,
  ImageLabel: Image,
  TextLabel: Type,
  DataStore: Database,
  Color3: Palette,
  Part: Box,
  Model: Box,
  RemoteEvent: Zap,
  BindableEvent: Zap,
  RemoteFunction: Cpu,
  BindableFunction: Cpu,
};

export function ScriptCard({
  script,
  onVault,
}: {
  script: ScriptMeta;
  onVault?: (asset: { name: string; type: string; code: string }) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!script || typeof script !== "object") {
    return (
      <div className="mt-3 p-3 rounded border border-red-500/20 bg-red-500/5 text-xs text-red-400">
        [Malformed script payload received from AI]
      </div>
    );
  }

  const isDelete = script.action === "delete";
  const isAsset = script.action === "insert_asset";
  const isPlaytest = script.action === "run_playtest";
  const isCreateInst = script.action === "create_instance";
  const isRename = script.action === "rename_instance";
  const isMove = script.action === "move_instance";
  const isRead = script.action === "read_script";
  const isSpecialAction =
    isDelete || isAsset || isPlaytest || isCreateInst || isRename || isMove || isRead;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(script.code);
    } catch {
      /* ignore */
    }
  }

  const IconComponent = typeIconMap[script.type || "Script"] || Ghost;

  return (
    <motion.div
      id={`script-${(script.name || "Unknown").replace(/\s+/g, "-")}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`mt-3 rounded border ${
        isDelete
          ? "border-red-500/20 bg-red-500/5"
          : isAsset
            ? "border-purple-500/20 bg-purple-500/5"
            : isPlaytest
              ? "border-green-500/10 bg-green-500/5"
              : isCreateInst
                ? "border-blue-500/10 bg-blue-500/5"
                : isRename
                  ? "border-amber-500/10 bg-amber-500/5"
                  : isMove
                    ? "border-indigo-500/10 bg-indigo-500/5"
                      : isRead
                        ? "border-cyan-500/10 bg-cyan-500/5"
                        : "border-white/5 bg-[#1e2028]"
      } overflow-hidden transition-colors`}
    >
      <button
        onClick={() => !isSpecialAction && setExpanded((e) => !e)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 ${!isSpecialAction ? "hover:bg-white/5 cursor-pointer" : "cursor-default"} transition-colors`}
      >
        <div
          className={`flex h-8 w-8 items-center justify-center rounded border flex-shrink-0 ${
            isDelete
              ? "bg-red-600/5 border-red-600/10"
              : isAsset
                ? "bg-black border-black shadow-lg"
                : isPlaytest
                  ? "bg-black border-black shadow-lg"
                  : isCreateInst
                    ? "bg-black border-black"
                    : isRead
                      ? "bg-black border-black"
                      : "bg-black border-black"
          }`}
        >
          {isDelete ? (
            <Trash2 className="h-4 w-4 text-red-600" />
          ) : isAsset ? (
            <Box className="h-4 w-4 text-white" />
          ) : isPlaytest ? (
            <Play className="h-4 w-4 text-white ml-0.5" />
          ) : isCreateInst ? (
            <Plus className="h-4 w-4 text-white" />
          ) : isRename ? (
            <Edit3 className="h-4 w-4 text-white" />
          ) : isMove ? (
            <Move className="h-4 w-4 text-white" />
          ) : isRead ? (
            <FileCode2 className="h-4 w-4 text-white" />
          ) : (
            <IconComponent className="h-4 w-4 text-white" />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p
            className={`text-[13px] font-black uppercase tracking-tighter truncate ${
              isDelete
                ? "text-red-600"
                : "text-white/90"
            }`}
          >
            {isPlaytest
              ? "Run Playtest"
              : isRead
                ? `Read Script: ${script.name}`
              : isRename
                ? `Rename ${script.oldPath?.split(".").pop() || "Object"} → ${script.newName}`
                : isMove
                  ? `Move ${script.oldPath?.split(".").pop() || "Object"} → ${script.newParentPath}`
                  : isCreateInst
                    ? `Create ${script.className || script.type || "Instance"}`
                    : script.name || "Unknown Script"}
          </p>
          <p className="text-[10px] text-white/40 mt-0.5 font-bold uppercase tracking-widest italic">
            {isDelete
              ? "To be deleted"
              : isAsset
                ? `Roblox Asset`
                : isPlaytest
                  ? "Remote Studio Command"
                  : isCreateInst
                    ? `Instance Name: ${script.instanceName || script.name}`
                    : isRename
                      ? `From: ${script.oldPath}`
                      : isMove
                        ? `To: ${script.newParentPath}`
                        : isRead
                          ? "Fetching live source code..."
                          : ((script.lineCount || 0) > 0
                              ? `${script.lineCount} lines · `
                              : "") +
                            (script.type || "Script") +
                            ` · ${script.parent || "Workspace"}`}
          </p>
        </div>
        {!isSpecialAction && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 text-[#ccff00] hover:text-[#ccff00] hover:bg-[#ccff00]/10"
              onClick={(e) => {
                e.stopPropagation();
                if (onVault)
                  onVault({
                    name: script.name || "AI Generated Script",
                    type: script.type || "Script",
                    code: script.code,
                  });
              }}
            >
              <Box className="h-3.5 w-3.5 mr-1" /> Vault
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={(e) => {
                e.stopPropagation();
                copyCode();
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-[#8a8f98]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#8a8f98]" />
            )}
          </div>
        )}
      </button>
      {expanded && !isDelete && (
        <div className="border-t border-black/5 bg-[#0a0a0c]">
          <CodeEditor
            code={script.code || ""}
            originalCode={script.originalCode}
            language="luau"
            height="400px"
          />
        </div>
      )}
    </motion.div>
  );
}
