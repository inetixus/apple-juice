import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderTree,
  Search,
  MessageSquare,
  Settings2,
  Network,
  Settings,
  X,
  Brain,
  Zap,
  LayoutGrid,
  Play,
  Paperclip,
  ImageIcon,
  Box,
  ArrowRight,
  FileCode,
  ChevronRight,
  ChevronDown,
  Terminal,
  Activity,
  Sparkles,
} from "lucide-react";
import { useDashboard } from "./dashboard-context";
import { WorkspaceTree } from "@/components/workspace-tree";
import { ScriptCard } from "@/components/script-card";
import { SlashCommandInput } from "@/components/slash-command";
import { JuiceLoader } from "./juice-loader";
import { ThinkingFeed } from "@/components/thinking-feed";

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

export function IdeLayout() {
  const router = useRouter();
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  const {
    activeProjectId,
    setActiveProjectId,
    setWorkspaceStyle,
    idePanel,
    setIdePanel,
    isIdeSidePanelOpen,
    setIsIdeSidePanelOpen,
    isPluginConnected,
    agentMode,
    setAgentMode,
    projectTree,
    handleAddInstance,
    handleRename,
    handleDelete,
    selectedTreePaths,
    handleVault,
    setSelectedTreePaths,
    handleFileClick,
    messages,
    workspaceEditorData,
    setWorkspaceEditorData,
    setSimulatorView,
    showToast,
    isGenerating,
    attachedFiles,
    setAttachedFiles,
    attachedAsset,
    setAttachedAsset,
    selectedWorkspaceItemId,
    setSelectedWorkspaceItemId,
    setShowAssetSearch,
    isShowingVaultMenu,
    setIsShowingVaultMenu,
    savedAssets,
    handleAttachAsset,
    prompt,
    setPrompt,
    submitPrompt,
    provider,
    setProvider,
    googleKey,
    openaiKey,
    loadModels,
    selectedModel,
    setSelectedModel,
    isLoadingModels,
    availableModels,
    openFiles,
    setOpenFiles,
    activeFile,
    setActiveFile,
    fileContents,
    activeBottomPanel,
    setActiveBottomPanel,
    gameLogs,
    usage,
    setShowPricing,
    selectedUIStyle,
    setSelectedUIStyle,
    setShowSettings,
    thinkingSteps,
  } = useDashboard() as any;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (idePanel === "chat" && isIdeSidePanelOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isGenerating, idePanel, isIdeSidePanelOpen]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (activeBottomPanel === "logs") {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [gameLogs, activeBottomPanel]);

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-gradient-to-br from-[#090a0d] to-[#0c0d10]">
      {/* Hidden file input for attachments */}
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
              setAttachedFiles((prev: any[]) => [
                ...prev,
                { name: file.name, content: reader.result as string },
              ]);
            };
            reader.readAsText(file);
          });
          e.target.value = "";
        }}
      />

      {/* Hidden image input for attachments */}
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (!files) return;
          Array.from(files).forEach((file) => {
            setAttachedFiles((prev: any[]) => [
              ...prev,
              { name: file.name, type: "image" },
            ]);
          });
          e.target.value = "";
        }}
      />

      {/* 1. ACTIVITY BAR (United Sidebars) */}
      <div className="w-12 flex-shrink-0 bg-[#0a0a0c]/80 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-4 gap-2 z-50">
        {/* Lobby Button */}
        <button
          onClick={() => {
            setActiveProjectId(null);
            setWorkspaceStyle("legacy");
            router.push("/dashboard");
          }}
          className="w-8 h-8 rounded-lg bg-[#ccff00] flex items-center justify-center hover:scale-110 transition-transform mb-4 shadow-sm"
        >
          <LayoutDashboard className="w-4 h-4 text-black" />
        </button>

        <div className="w-full h-[1px] bg-white/[0.05] mb-2" />

        <button
          onClick={() => {
            if (idePanel === "explorer" && isIdeSidePanelOpen) {
              setIsIdeSidePanelOpen(false);
            } else {
              setIdePanel("explorer");
              setIsIdeSidePanelOpen(true);
            }
          }}
          className={`p-2.5 rounded-lg transition-all ${idePanel === "explorer" && isIdeSidePanelOpen
              ? "text-[#ccff00] bg-white/5 shadow-[0_0_15px_rgba(204,255,0,0.1)]"
              : "text-white/20 hover:text-white/60 hover:bg-white/5"
            }`}
        >
          <FolderTree className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            if (idePanel === "search" && isIdeSidePanelOpen) {
              setIsIdeSidePanelOpen(false);
            } else {
              setIdePanel("search");
              setIsIdeSidePanelOpen(true);
            }
          }}
          className={`p-2.5 rounded-lg transition-all ${idePanel === "search" && isIdeSidePanelOpen
              ? "text-[#ccff00] bg-white/5 shadow-[0_0_15px_rgba(204,255,0,0.1)]"
              : "text-white/20 hover:text-white/60 hover:bg-white/5"
            }`}
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            if (idePanel === "chat" && isIdeSidePanelOpen) {
              setIsIdeSidePanelOpen(false);
            } else {
              setIdePanel("chat");
              setIsIdeSidePanelOpen(true);
            }
          }}
          className={`p-2.5 rounded-lg transition-all ${idePanel === "chat" && isIdeSidePanelOpen
              ? "text-[#ccff00] bg-white/5 shadow-[0_0_15px_rgba(204,255,0,0.1)]"
              : "text-white/20 hover:text-white/60 hover:bg-white/5"
            }`}
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => {
            if (idePanel === "settings" && isIdeSidePanelOpen) {
              setIsIdeSidePanelOpen(false);
            } else {
              setIdePanel("settings");
              setIsIdeSidePanelOpen(true);
            }
          }}
          className={`p-2.5 rounded-lg transition-all ${idePanel === "settings" && isIdeSidePanelOpen
              ? "text-[#ccff00] bg-white/5 shadow-[0_0_15px_rgba(204,255,0,0.1)]"
              : "text-white/20 hover:text-white/60 hover:bg-white/5"
            }`}
        >
          <Settings2 className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        {/* Connection Status Icon */}
        <div
          className={`p-2.5 rounded-lg transition-all ${isPluginConnected ? "text-emerald-500" : "text-red-500/40"
            }`}
        >
          <Network className="w-5 h-5" />
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="p-2.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* 2. SIDE PANEL (Collapsible) */}
      <AnimatePresence mode="wait">
        {isIdeSidePanelOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="flex-shrink-0 bg-[#101115]/80 backdrop-blur-xl border-r border-white/5 flex flex-col overflow-hidden relative"
          >
            <div className="h-10 flex flex-shrink-0 items-center justify-between px-4 border-b border-white/5 bg-transparent z-[100]">
              {idePanel === "chat" ? (
                <div className="relative">
                  <button
                    onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/20 transition-all text-xs font-semibold text-slate-200 select-none group"
                  >
                    {agentMode === "plan" ? (
                      <Brain className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-[#ccff00] group-hover:scale-110 transition-transform" />
                    )}
                    <span className="capitalize">{agentMode} Mode</span>
                    <ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${isModeDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {isModeDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsModeDropdownOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute left-0 mt-2 w-56 bg-[#0f1115]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-1.5 z-50 overflow-hidden"
                        >
                          <button
                            onClick={() => {
                              setAgentMode("plan");
                              setIsModeDropdownOpen(false);
                            }}
                            className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all ${agentMode === "plan"
                                ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                                : "hover:bg-white/5 border border-transparent text-slate-400 hover:text-white"
                              }`}
                          >
                            <div className={`p-1.5 rounded-lg ${agentMode === "plan" ? "bg-blue-500/20" : "bg-white/5"} flex-shrink-0`}>
                              <Brain className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold tracking-wide">Plan Mode</p>
                              <p className="text-[9px] opacity-60 leading-normal mt-0.5">Brainstorm and research steps before writing code.</p>
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              setAgentMode("build");
                              setIsModeDropdownOpen(false);
                            }}
                            className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all mt-1 ${agentMode === "build"
                                ? "bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00]"
                                : "hover:bg-white/5 border border-transparent text-slate-400 hover:text-white"
                              }`}
                          >
                            <div className={`p-1.5 rounded-lg ${agentMode === "build" ? "bg-[#ccff00]/20" : "bg-white/5"} flex-shrink-0`}>
                              <Zap className="w-4 h-4 text-[#ccff00]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold tracking-wide">Build Mode</p>
                              <p className="text-[9px] opacity-60 leading-normal mt-0.5">Directly generate code, execute scripts, and edit files.</p>
                            </div>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <span className="text-xs font-semibold text-white/50 tracking-wide">
                  {idePanel === "explorer"
                    ? "Explorer"
                    : idePanel === "search"
                      ? "Global Search"
                      : "System Settings"}
                </span>
              )}
              <button
                onClick={() => setIsIdeSidePanelOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-md text-white/40 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {idePanel === "explorer" && (
                <div className="p-2">
                  {activeProjectId ? (
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
                  ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-center p-6 opacity-20">
                      <LayoutGrid className="w-6 h-6 mb-3" />
                      <p className="text-[9px] font-black uppercase tracking-widest">
                        Select a project
                      </p>
                    </div>
                  )}
                </div>
              )}

              {idePanel === "search" && (
                <div className="p-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                    <input
                      placeholder="Search project..."
                      className="w-full bg-white/[0.03] border border-white/5 rounded-lg py-2 pl-9 pr-3 text-[11px] text-white focus:outline-none focus:border-[#ccff00]/30 transition-all"
                    />
                  </div>
                  <div className="space-y-1 opacity-20 py-10 text-center">
                    <span className="text-[10px] font-bold uppercase">
                      No results found
                    </span>
                  </div>
                </div>
              )}

              {idePanel === "chat" && (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center opacity-20 text-center p-8">
                        <Brain className="w-10 h-10 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                          Agent Ready
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {messages.map((m: any) => (
                          <div
                            key={m.id}
                            className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"
                              }`}
                          >
                            <div
                              className={`text-xs font-medium text-slate-500 ${m.role === "user" ? "text-right" : "text-left"
                                }`}
                            >
                              {m.role === "user" ? "You" : "Agent"}
                            </div>
                            <div
                              className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${m.role === "user"
                                  ? "bg-white/5 text-slate-200 border border-white/10 rounded-br-sm"
                                  : "bg-[#ccff00]/10 border border-[#ccff00]/20 text-slate-100 rounded-bl-sm backdrop-blur-md"
                                }`}
                            >
                              {m.content}
                            </div>
                            {m.script && (
                              <div className="mt-3 flex flex-col gap-2 w-full">
                                <ScriptCard
                                  script={m.script}
                                  onVault={handleVault}
                                />
                                <button
                                  onClick={() => {
                                    setWorkspaceEditorData([
                                      ...workspaceEditorData,
                                      {
                                        id: Math.random().toString(),
                                        name:
                                          m.script?.name || "GeneratedScript",
                                        className:
                                          m.script?.className || "Script",
                                        content:
                                          m.script?.code ||
                                          m.script?.originalCode ||
                                          m.content,
                                        children: [],
                                      },
                                    ]);
                                    setSimulatorView("edit");
                                    setWorkspaceStyle("ide");
                                    showToast(
                                      "Injected into Simulator",
                                      "success"
                                    );
                                  }}
                                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  Simulate in Studio
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {isGenerating && (
                          <div className="py-3 px-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] shadow-inner space-y-3.5 my-2">
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
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>

                  {/* Side Chat Input */}
                  <div className="p-3 bg-[#050505] border-t border-white/[0.05]">
                    <div className="flex flex-col gap-2">
                      {/* Attachments Preview (IDE) */}
                      {(attachedFiles.length > 0 ||
                        attachedAsset ||
                        selectedWorkspaceItemId) && (
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {selectedWorkspaceItemId && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#00a2ff]/10 border border-[#00a2ff]/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00a2ff] animate-pulse" />
                                <span className="text-[8px] font-black text-[#00a2ff] uppercase truncate max-w-[120px]">
                                  Editing:{" "}
                                  {
                                    findNodeById(
                                      workspaceEditorData,
                                      selectedWorkspaceItemId
                                    )?.name
                                  }
                                </span>
                                <button
                                  onClick={() => setSelectedWorkspaceItemId(null)}
                                  className="text-[#00a2ff]/40 hover:text-red-400"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                            {attachedFiles.map((file: any, i: number) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10"
                              >
                                <span className="text-[8px] font-black text-white/40 uppercase truncate max-w-[60px]">
                                  {file.name}
                                </span>
                                <button
                                  onClick={() =>
                                    setAttachedFiles((f: any[]) =>
                                      f.filter((_, idx) => idx !== i)
                                    )
                                  }
                                  className="text-white/20 hover:text-red-400"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                            {attachedAsset && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#ccff00]/10 border border-[#ccff00]/20">
                                <span className="text-[8px] font-black text-[#ccff00] uppercase truncate max-w-[60px]">
                                  {attachedAsset.name}
                                </span>
                                <button
                                  onClick={() => setAttachedAsset(null)}
                                  className="text-[#ccff00]/40 hover:text-red-400"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      <div className="flex items-center gap-1 mb-1 relative">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
                          title="Attach Script"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
                          title="Attach Image"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowAssetSearch(true)}
                          className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
                          title="Toolbox"
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setIsShowingVaultMenu(!isShowingVaultMenu)
                          }
                          className={`p-1.5 rounded-lg transition-all ${isShowingVaultMenu
                              ? "text-[#ccff00] bg-[#ccff00]/10"
                              : "text-white/20 hover:text-white/60 hover:bg-white/5"
                            }`}
                          title="Insert from Vault"
                        >
                          <Box className="w-3.5 h-3.5" />
                        </button>

                        {isShowingVaultMenu && (
                          <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#0f1115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[300] animate-in slide-in-from-bottom-2">
                            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                                Asset Vault
                              </span>
                              <button
                                onClick={() => setIsShowingVaultMenu(false)}
                                className="text-white/20 hover:text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                              {savedAssets.length === 0 ? (
                                <div className="p-4 text-center text-[10px] text-white/20 uppercase tracking-widest italic">
                                  Vault is Empty
                                </div>
                              ) : (
                                savedAssets.map((asset: any) => (
                                  <button
                                    key={asset.id}
                                    onClick={() => {
                                      handleAttachAsset(asset);
                                      setIsShowingVaultMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 text-left transition-colors group"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-black/40 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                      {asset.thumbnail ? (
                                        <img
                                          src={asset.thumbnail}
                                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                          alt=""
                                        />
                                      ) : (
                                        <div
                                          className="w-full h-full"
                                          style={{
                                            backgroundColor: asset.color,
                                          }}
                                        />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-black text-white truncate uppercase tracking-tight">
                                        {asset.name}
                                      </p>
                                      <p className="text-[9px] text-white/20 uppercase font-bold tracking-widest">
                                        {asset.category}
                                      </p>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="relative group">
                        <SlashCommandInput
                          value={prompt}
                          onChange={setPrompt}
                          onSubmit={() => submitPrompt()}
                          placeholder="Type a command or press / for commands..."
                          disabled={isGenerating}
                          className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-3 pl-3 pr-10 text-[11px] text-white focus:outline-none focus:border-[#ccff00]/30 min-h-[44px] max-h-32 custom-scrollbar transition-all"
                          extraCommands={[
                            { command: "/gpt-4o-mini", label: "/gpt-4o-mini", description: "Switch to GPT-4o Mini model", category: "Models", icon: "◆" },
                            ...availableModels.filter((m: string) => !m.toLowerCase().includes(selectedModel.toLowerCase())).map((m: string) => ({
                              command: `/${m.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
                              label: `/${m.split("/").pop()}`,
                              description: `Switch to ${m.split("/").pop()} model`,
                              category: "Models",
                              icon: "◇" as string,
                            })),
                          ]}
                        />
                        <button
                          onClick={() => submitPrompt()}
                          disabled={isGenerating || !prompt.trim()}
                          className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-[#ccff00] text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Real-time Model & Euro Money Usage Display */}
                      <div className="flex items-center justify-between text-[10px] text-white/40 px-1.5 mt-1 font-medium select-none">
                        <div className="flex items-center gap-1.5 hover:text-white/60 transition-colors">
                          <Activity className="w-3 h-3 text-[#ccff00]/70 animate-pulse flex-shrink-0" />
                          <span>Usage: <strong className="text-white/70 font-semibold">€{((usage?.usedMl || 0) * 0.00005).toFixed(2)}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 hover:text-white/60 transition-colors text-right max-w-[150px] min-w-0">
                          <Sparkles className="w-3 h-3 text-[#ccff00]/70 flex-shrink-0" />
                          <span className="truncate uppercase tracking-wider font-semibold text-white/60 text-[9px]">{selectedModel?.split("/").pop() || "gpt-4o-mini"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {idePanel === "settings" && (
                <div className="p-4 space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-white/20 tracking-widest">
                      Environment
                    </h4>
                    <div className="space-y-2">
                      <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
                        <span className="text-[11px] font-bold group-hover:text-white transition-colors">
                          Auto-Sync
                        </span>
                        <div className="w-8 h-4 rounded-full bg-[#ccff00]/20 border border-[#ccff00]/40 p-0.5 flex justify-end">
                          <div className="w-3 h-3 rounded-full bg-[#ccff00]" />
                        </div>
                      </button>
                      <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
                        <span className="text-[11px] font-bold group-hover:text-white transition-colors">
                          Strict Mode
                        </span>
                        <div className="w-8 h-4 rounded-full bg-white/10 border border-white/10 p-0.5 flex justify-start">
                          <div className="w-3 h-3 rounded-full bg-white/20" />
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-white/20 tracking-widest">
                      AI Intelligence
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[9px] font-black uppercase text-white/40 mb-1.5 block tracking-widest">
                          Provider
                        </label>
                        <select
                          value={provider}
                          onChange={(e) => {
                            const val = e.target.value as "openai" | "google";
                            setProvider(val);
                            const newKey =
                              val === "google" ? googleKey : openaiKey;
                            loadModels(newKey, undefined, val);
                          }}
                          className="w-full bg-white/[0.03] border border-white/5 text-white/80 text-[10px] font-bold py-2 px-3 rounded-lg focus:outline-none focus:border-[#ccff00]/30 transition-all cursor-pointer uppercase tracking-tight"
                        >
                          <option value="openai" className="bg-[#1a1c22]">
                            OpenAI
                          </option>
                          <option value="google" className="bg-[#1a1c22]">
                            Google AI Studio
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-black uppercase text-white/40 mb-1.5 block tracking-widest">
                          Active Model{" "}
                          {isLoadingModels && (
                            <span className="animate-pulse text-[#ccff00] lowercase">
                              (loading...)
                            </span>
                          )}
                        </label>
                        <select
                          value={selectedModel}
                          disabled={isLoadingModels}
                          onChange={(e) => {
                            setSelectedModel(e.target.value);
                            window.localStorage.setItem(
                              "apple-juice-model",
                              e.target.value
                            );
                          }}
                          className={`w-full bg-white/[0.03] border border-white/5 text-white/80 text-[10px] font-bold py-2 px-3 rounded-lg focus:outline-none focus:border-[#ccff00]/30 transition-all cursor-pointer uppercase tracking-tight ${isLoadingModels ? "opacity-50" : ""
                            }`}
                        >
                          {availableModels.map((m: string) => (
                            <option
                              key={m}
                              value={m}
                              className="bg-[#1a1c22]"
                            >
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MAIN EDITOR AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0c0d10] overflow-hidden rounded-tl-xl border-t border-l border-white/5 shadow-2xl z-10 relative">
        {/* Editor Tabs */}
        <div className="h-10 flex-shrink-0 bg-[#0a0b0d]/80 backdrop-blur-md border-b border-white/5 flex items-center overflow-x-auto no-scrollbar">
          {openFiles.length === 0 ? (
            <div className="px-4 text-[10px] font-semibold text-white/20 uppercase tracking-widest italic">
              No active workspace
            </div>
          ) : (
            openFiles.map((path: string) => (
              <div
                key={path}
                className={`group h-full flex items-center border-r border-white/5 transition-all relative ${activeFile === path ? "bg-[#101115]" : "hover:bg-white/5"
                  }`}
              >
                <button
                  onClick={() => setActiveFile(path)}
                  className={`flex items-center gap-2.5 px-4 h-full min-w-[140px] text-xs font-medium transition-all ${activeFile === path ? "text-slate-200" : "text-slate-500"
                    }`}
                >
                  <FileCode
                    className={`w-3.5 h-3.5 ${activeFile === path ? "text-blue-400" : "text-white/10"
                      }`}
                  />
                  <span className="truncate max-w-[120px]">
                    {path.split(".").pop() || path}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const nextFiles = openFiles.filter((f: any) => f !== path);
                    setOpenFiles(nextFiles);
                    if (activeFile === path) {
                      setActiveFile(nextFiles[nextFiles.length - 1] || null);
                    }
                  }}
                  className={`w-5 h-5 flex items-center justify-center rounded-md hover:bg-white/10 text-white/20 hover:text-white transition-all mr-1 opacity-0 group-hover:opacity-100 ${activeFile === path ? "opacity-100" : ""
                    }`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
                {activeFile === path && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] rounded-full mx-2" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Breadcrumbs */}
        {activeFile && (
          <div className="h-8 bg-[#0a0a0c] border-b border-white/5 flex items-center px-4 gap-2 flex-shrink-0">
            <FolderTree className="w-3 h-3 text-white/20" />
            <span className="text-xs font-medium text-slate-500 tracking-wide">
              Projects
            </span>
            <ChevronRight className="w-3 h-3 text-white/10" />
            <span className="text-xs font-medium text-[#ccff00]/70 tracking-wide">
              {activeFile.split("/").pop()}
            </span>
          </div>
        )}

        {/* Editor Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {!activeFile ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-32 h-32 mb-8 opacity-10"
              >
                <img
                  src="/logo-icon.png"
                  className="w-full h-full object-contain grayscale"
                  alt="Apple Juice"
                />
              </motion.div>
              <div className="grid grid-cols-2 gap-4 max-w-md w-full">
                {[
                  { label: "Find File", key: "Ctrl + P" },
                  { label: "Agentic Search", key: "Ctrl + Shift + F" },
                  { label: "Project View", key: "Ctrl + B" },
                  { label: "Quick Command", key: "Ctrl + Shift + P" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col items-center gap-2 hover:bg-white/[0.04] transition-all"
                  >
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                      {item.label}
                    </span>
                    <span className="text-[11px] font-black text-[#ccff00] opacity-60">
                      {item.key}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Line Numbers */}
              <div className="w-12 flex-shrink-0 bg-[#0c0d10] border-r border-white/5 flex flex-col items-center py-6 text-white/10 font-mono text-[11px] select-none">
                {Array.from({
                  length: Math.max(
                    20,
                    (fileContents[activeFile]?.split("\n").length || 0) + 10
                  ),
                }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[21px] flex items-center justify-center w-full"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Code Content */}
              <div className="flex-1 overflow-auto custom-scrollbar bg-[#0c0d10] p-6 pt-6">
                {fileContents[activeFile] ? (
                  <pre className="text-[13px] font-mono leading-[21px] text-blue-100/70 selection:bg-blue-500/30 whitespace-pre">
                    <code>{fileContents[activeFile]}</code>
                  </pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-4 opacity-10">
                    <div className="w-6 h-6 rounded-full border-2 border-white/5 border-t-[#ccff00] animate-spin" />
                    <span className="text-[8px] font-black uppercase tracking-[0.4em]">
                      Deciphering Source...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BOTTOM PANEL */}
          <AnimatePresence>
            {activeBottomPanel !== "none" && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 260 }}
                exit={{ height: 0 }}
                className="flex-shrink-0 bg-[#0a0a0c]/90 backdrop-blur-md border-t border-white/5 flex flex-col overflow-hidden z-20"
              >
                <div className="h-9 flex items-center px-4 bg-transparent border-b border-white/5 gap-6">
                  {["terminal", "logs", "problems"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveBottomPanel(tab as any)}
                      className={`h-full text-xs font-semibold tracking-wide transition-all relative capitalize ${activeBottomPanel === tab
                          ? "text-slate-200"
                          : "text-slate-500 hover:text-slate-300"
                        }`}
                    >
                      {tab}
                      {activeBottomPanel === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_-2px_8px_rgba(59,130,246,0.3)] rounded-t-full" />
                      )}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button
                    onClick={() => setActiveBottomPanel("none")}
                    className="p-1 hover:bg-white/5 rounded text-white/20 hover:text-white transition-colors"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 font-mono text-[12px]">
                  {activeBottomPanel === "logs" && (
                    <div className="space-y-1">
                      {gameLogs.map((log: string, i: number) => (
                        <div
                          key={i}
                          className={`flex gap-3 ${log.toLowerCase().includes("error")
                              ? "text-red-400"
                              : "text-white/40"
                            }`}
                        >
                          <span className="opacity-20 select-none">
                            [{new Date().toLocaleTimeString()}]
                          </span>
                          <span>{log}</span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  )}
                  {activeBottomPanel === "terminal" && (
                    <div className="text-emerald-400/60">
                      <p className="mb-2 text-white/20 italic tracking-wider">
                        // Apple Juice Virtual Terminal v1.0.4
                      </p>
                      <div className="flex gap-2">
                        <span className="text-[#ccff00]">$</span>
                        <span className="animate-pulse">_</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status Bar */}
        <div className="h-8 bg-[#0a0a0c]/80 backdrop-blur-md border-t border-white/5 flex items-center justify-between px-3 z-50 flex-shrink-0">
          <div className="flex items-center gap-4 h-full">
            <div className="flex items-center gap-2 px-1.5 hover:bg-white/5 cursor-pointer transition-colors h-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              <span className="text-[11px] font-medium text-slate-400">
                main
              </span>
            </div>
            <div className="flex items-center gap-2 px-1.5 hover:bg-white/5 cursor-pointer transition-colors h-full">
              <Activity className="w-3.5 h-3.5 text-[#ccff00]/70" />
              <span className="text-[11px] font-medium text-slate-400">
                Sync: 12ms
              </span>
            </div>
            <button
              onClick={() =>
                setActiveBottomPanel(
                  activeBottomPanel === "terminal" ? "none" : "terminal"
                )
              }
              className={`flex items-center gap-1.5 px-2 h-full text-[11px] font-medium transition-colors ${activeBottomPanel === "terminal"
                  ? "bg-white/10 text-slate-200"
                  : "text-slate-400 hover:bg-white/5"
                }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </button>
            <button
              onClick={() =>
                setActiveBottomPanel(
                  activeBottomPanel === "logs" ? "none" : "logs"
                )
              }
              className={`flex items-center gap-1.5 px-2 h-full text-[11px] font-medium transition-colors ${activeBottomPanel === "logs"
                  ? "bg-white/10 text-slate-200"
                  : "text-slate-400 hover:bg-white/5"
                }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Output</span>
            </button>
          </div>
          <div className="flex items-center gap-2 h-full">
            {/* Usage Pill */}
            <div
              onClick={() => setShowPricing(true)}
              className="flex items-center gap-1.5 px-2 hover:bg-white/5 cursor-pointer h-full border-l border-white/5 group/usage-ide relative overflow-hidden"
            >
              <div
                className="absolute bottom-0 left-0 w-full bg-[#ccff00]/5 transition-all duration-1000"
                style={{
                  height: `${Math.min(
                    100,
                    Math.max(
                      0,
                      (usage.remainingMl / (usage.totalMl || 1)) * 100
                    )
                  )}%`,
                }}
              />
              <Zap
                className={`w-2.5 h-2.5 relative z-10 ${usage.remainingMl < 500
                    ? "text-amber-400 animate-pulse"
                    : "text-[#ccff00]/60"
                  }`}
              />
              <span className="text-[9px] font-black text-[#ccff00]/60 relative z-10">
                {((usage.remainingMl ?? 0) / 1000).toFixed(2)}
              </span>
            </div>

            {/* Style Selector */}
            <div className="relative group/style-ide h-full">
              <button className="flex items-center gap-1.5 px-2 hover:bg-white/5 h-full transition-all">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${selectedUIStyle === "dracula"
                      ? "bg-[#bd93f9]"
                      : selectedUIStyle === "zap"
                        ? "bg-[#ccff00]"
                        : selectedUIStyle === "claude"
                          ? "bg-[#d77757]"
                          : "bg-blue-400"
                    }`}
                />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                  {selectedUIStyle === "none" ? "Stud" : selectedUIStyle}
                </span>
              </button>
              <div className="absolute bottom-full right-0 pb-1 w-32 opacity-0 translate-y-1 pointer-events-none group-hover/style-ide:opacity-100 group-hover/style-ide:translate-y-0 group-hover/style-ide:pointer-events-auto transition-all z-[200]">
                <div className="bg-[#14161a] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                  {(["zap", "stud", "dracula", "claude"] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => setSelectedUIStyle(style)}
                      className={`w-full text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${selectedUIStyle === style
                          ? "bg-[#d77757]/10 text-[#d77757]"
                          : "text-white/40 hover:bg-white/5 hover:text-white"
                        }`}
                    >
                      <div
                        className={`w-1 h-1 rounded-full ${style === "dracula"
                            ? "bg-[#bd93f9]"
                            : style === "zap"
                              ? "bg-[#ccff00]"
                              : style === "claude"
                                ? "bg-[#d77757]"
                                : "bg-blue-400"
                          }`}
                      />
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Model Selector */}
            <div className="relative group/model-ide h-full">
              <button className="flex items-center gap-1.5 px-2 hover:bg-white/5 h-full transition-all">
                {selectedModel.toLowerCase().includes("deepseek") ? (
                  <img
                    src="/icons/deepseek.png"
                    className="w-3 h-3 rounded-full grayscale group-hover/model-ide:grayscale-0 transition-all"
                    alt=""
                  />
                ) : selectedModel.toLowerCase().includes("gemini") ? (
                  <img
                    src="/icons/google.webp"
                    className="w-3 h-3 rounded-full"
                    alt=""
                  />
                ) : selectedModel.toLowerCase().includes("gpt") ? (
                  <img
                    src="/icons/chatgpt.png"
                    className="w-3 h-3 rounded-full"
                    alt=""
                  />
                ) : (
                  <Sparkles className="w-2.5 h-2.5 text-white/20" />
                )}
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest truncate max-w-[80px]">
                  {selectedModel
                    .split("/")
                    .pop()
                    ?.replace("-flash", "")
                    .replace("gemini-", "Gemini ")}
                </span>
              </button>
              <div className="absolute bottom-full right-0 pb-1 w-56 opacity-0 translate-y-1 pointer-events-none group-hover/model-ide:opacity-100 group-hover/model-ide:translate-y-0 group-hover/model-ide:pointer-events-auto transition-all z-[200]">
                <div className="bg-[#14161a] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                  <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                    {availableModels.map((m: string) => (
                      <button
                        key={m}
                        onClick={() => setSelectedModel(m)}
                        className={`w-full text-left px-3 py-2 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 ${selectedModel === m
                            ? "bg-[#ccff00]/10 text-[#ccff00]"
                            : "text-white/40 hover:bg-white/5 hover:text-white"
                          }`}
                      >
                        {m.toLowerCase().includes("deepseek") ? (
                          <img
                            src="/icons/deepseek.png"
                            className="w-2.5 h-2.5 rounded-full"
                            alt=""
                          />
                        ) : m.toLowerCase().includes("gemini") ? (
                          <img
                            src="/icons/google.webp"
                            className="w-2.5 h-2.5 rounded-full"
                            alt=""
                          />
                        ) : m.toLowerCase().includes("gpt") ? (
                          <img
                            src="/icons/chatgpt.png"
                            className="w-2.5 h-2.5 rounded-full"
                            alt=""
                          />
                        ) : (
                          <Sparkles className="w-2 h-2 opacity-20" />
                        )}
                        {m.split("/").pop()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-1.5 hover:bg-white/5 cursor-pointer transition-colors h-full">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                UTF-8
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-1.5 hover:bg-white/5 cursor-pointer transition-colors h-full">
              <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                Spaces: 2
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-1.5 bg-[#ccff00] h-full font-black text-black">
              <span className="text-[9px] uppercase tracking-widest">
                Pure Ultra
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
