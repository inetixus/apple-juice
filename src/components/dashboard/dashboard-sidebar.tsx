"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Box,
  FolderTree,
  Network,
  MessageSquare,
  RotateCcw,
  LifeBuoy,
  Settings,
  LayoutDashboard,
  LayoutGrid,
  Package,
  Cpu,
  Users,
  Archive,
  Trash2,
  Plus,
  Database,
  Sparkles,
} from "lucide-react";
import { useDashboard } from "./dashboard-context";
import { WorkspaceTree } from "@/components/workspace-tree";

export function DashboardSidebar() {
  const router = useRouter();
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    activeTab,
    setActiveTab,
    workspaceStyle,
    isLegacyExplorerOpen,
    setIsLegacyExplorerOpen,
    isPluginConnected,
    activeChatIndex,
    switchChat,
    setTransferingChat,
    getProjectColor,
    switchProject,
    setShowHelpWindow,
    showHelpWindow,
    setShowSettings,
    rankTheme,
    showArchived,
    setShowArchived,
    renameProject,
    archiveProject,
    deleteProject,
    createNewProject,
    projectTree,
    handleAddInstance,
    handleRename,
    handleDelete,
    handleVault,
    selectedTreePaths,
    setSelectedTreePaths,
    handleFileClick,
    setPrompt,
    submitPrompt,
    isMobileMenuOpen,
    isTester,
  } = useDashboard();

  // Preserve tester access across in-app navigation.
  const dashboardHref = isTester ? "/dashboard?tester=1" : "/dashboard";

  return (
    <div
      className={`fixed md:static inset-y-0 left-0 z-[60] flex-shrink-0 border-r border-white/[0.05] glossy-panel-dark flex flex-col transition-all duration-300 ease-in-out ${
        workspaceStyle === "ide"
          ? "hidden"
          : activeProjectId
          ? "w-[280px] md:w-[72px] items-center py-6"
          : "w-[280px] p-5"
      } ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      {activeProjectId ? (
        /* NARROW SIDEBAR (Active Project) */
        <>
          {/* Logo */}
          <div
            onClick={() => {
              setActiveProjectId(null);
              router.push(dashboardHref);
            }}
            className="flex flex-col items-center gap-2 cursor-pointer group mb-8"
          >
            <div
              className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${rankTheme.accentBg} ${rankTheme.accentGlow} group-hover:scale-110 transition-transform`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-black" fill="currentColor">
                <path d="M5.2 6.5L7.5 3h9l2.3 3.5H5.2z" fillOpacity="0.8" />
                <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5z" />
                <path
                  d="M15 3V1.5A1.5 1.5 0 0 0 13.5 0H12"
                  fill="none"
                  stroke="black"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M14.5 14.5c0 1.5-1 2.5-2.5 2.5s-2.5-1-2.5-2.5 1-2.5 2.5-2.5c.3 0 .7.1 1 .2-.3.4-.3 1 0 1.4.3.4.9.4 1.3.1.1.2.2.5.2.8zM12.5 11c0-1-.8-1.5-1.5-1.5 0 1 .8 1.5 1.5 1.5z"
                  fill="#000"
                />
              </svg>
            </div>
          </div>

          {/* Action Rail */}
          <div className="flex flex-col gap-4 mb-8">
            <button
              onClick={() => setIsLegacyExplorerOpen(!isLegacyExplorerOpen)}
              className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all group relative ${
                isLegacyExplorerOpen
                  ? "bg-[#ccff00]/10 border-[#ccff00]/30 text-[#ccff00]"
                  : "border-white/10 text-white/40 hover:bg-white/5 hover:border-white/20"
              }`}
              title="Project Explorer"
            >
              <FolderTree className="w-6 h-6" />
            </button>

            <button className="w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/5 hover:border-white/20 transition-all group relative">
              <Network
                className={`w-6 h-6 ${isPluginConnected ? "text-emerald-500" : "text-red-500"}`}
              />
            </button>

            <div className="relative group/chats">
              <button
                className={`w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all relative ${
                  activeChatIndex > 0 ? "text-[#ccff00] border-[#ccff00]/30" : "text-white/40"
                }`}
              >
                <MessageSquare className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ccff00] text-black text-[9px] font-black flex items-center justify-center">
                  {activeChatIndex + 1}
                </span>
              </button>
              <div className="absolute left-full pl-2 top-0 opacity-0 translate-x-2 pointer-events-none group-hover/chats:opacity-100 group-hover/chats:translate-x-0 group-hover/chats:pointer-events-auto transition-all z-[100]">
                <div className="bg-[#14161a] border border-white/[0.08] rounded-xl shadow-2xl p-2 flex flex-col gap-1 w-32">
                  <div className="px-2 py-1 mb-1 border-b border-white/[0.05]">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                      Multi-Thread
                    </span>
                  </div>
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="group/item relative">
                      <button
                        onClick={() => switchChat(idx)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                          activeChatIndex === idx
                            ? "bg-[#ccff00]/10 text-[#ccff00]"
                            : "text-white/40 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        Chat {idx + 1}
                      </button>
                      {activeProjectId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransferingChat({
                              sourceProjectId: activeProjectId,
                              sourceChatIndex: idx,
                            });
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover/item:opacity-100 hover:text-[#ccff00] transition-all"
                          title="Transfer Chat"
                        >
                          <RotateCcw className="w-3 h-3 rotate-180" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Project Quick-Switch Rail */}
          <div className="flex-1 flex flex-col items-center gap-4 overflow-y-auto custom-scrollbar w-full px-2">
            {projects.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  void switchProject(p);
                }}
                className="group relative flex items-center justify-center w-full"
              >
                {activeProjectId === p.id && (
                  <motion.div
                    layoutId="sidebarActive"
                    className="absolute left-[-12px] w-1.5 h-8 bg-[#ccff00] rounded-r-full shadow-[0_0_15px_#ccff00]"
                  />
                )}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:rounded-xl overflow-hidden shadow-lg ${
                    activeProjectId === p.id
                      ? "bg-white text-black scale-105"
                      : `${getProjectColor(p.id)} text-white/90`
                  }`}
                >
                  <Box className="w-6 h-6" />
                </motion.div>

                {/* Tooltip */}
                <div className="absolute left-full ml-4 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-2xl">
                  {p.name}
                </div>
              </button>
            ))}
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/5 w-full mt-auto">
            <button
              onClick={() => setShowHelpWindow(true)}
              className={`w-10 h-10 flex items-center justify-center transition-all ${
                showHelpWindow ? "text-[#ccff00] bg-[#ccff00]/10 rounded-xl" : "text-white/20 hover:text-white"
              }`}
              title="Help & Debugging"
            >
              <LifeBuoy className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 flex items-center justify-center text-white/20 hover:text-white transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </>
      ) : (
        /* EXPANDED SIDEBAR (Lobby) */
        <>
          {/* Logo Section */}
          <div className="flex items-center gap-3 mb-10 px-1">
            <div
              className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${rankTheme.accentBg} ${rankTheme.accentGlow}`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-black" fill="currentColor">
                <path d="M5.2 6.5L7.5 3h9l2.3 3.5H5.2z" fillOpacity="0.8" />
                <path d="M5 8v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8H5z" />
                <path
                  d="M15 3V1.5A1.5 1.5 0 0 0 13.5 0H12"
                  fill="none"
                  stroke="black"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M14.5 14.5c0 1.5-1 2.5-2.5 2.5s-2.5-1-2.5-2.5 1-2.5 2.5-2.5c.3 0 .7.1 1 .2-.3.4-.3 1 0 1.4.3.4.9.4 1.3.1.1.2.2.5.2.8zM12.5 11c0-1-.8-1.5-1.5-1.5 0 1 .8 1.5 1.5 1.5z"
                  fill="#000"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white tracking-tight text-xl leading-none">
                Apple Juice
              </span>
              <span className="text-[10px] text-white/40 mt-1 font-semibold tracking-wide">
                AI Game Studio
              </span>
            </div>
          </div>

          {/* Sidebar Rail Icons (Lobby) */}
          <div className="flex flex-col gap-3 mb-10">
            <div className="flex items-center gap-1.5 px-1 mb-1">
              <LayoutDashboard className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em]">
                Workspace
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { id: "projects", icon: LayoutGrid, label: "Projects" },
                { id: "assets", icon: Package, label: "Assets" },
                { id: "nexus", icon: Cpu, label: "Core" },
                { id: "team", icon: Users, label: "Team" },
              ].map((item) => (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setActiveProjectId(null);
                    router.push(dashboardHref);
                  }}
                  className={`group relative flex items-center gap-3.5 p-2.5 rounded-2xl transition-all duration-300 ${
                    activeTab === item.id
                      ? "bg-white/[0.06] text-white"
                      : "text-white/50 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      activeTab === item.id
                        ? "bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                        : "bg-white/[0.06]"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[12px] font-bold tracking-tight transition-all ${
                      activeTab === item.id ? "text-white" : "text-white/55"
                    }`}
                  >
                    {item.label}
                  </span>
                  {activeTab === item.id && (
                    <motion.div
                      layoutId="activeGlow"
                      className="absolute inset-0 rounded-2xl bg-white/[0.02] border border-white/5 -z-10"
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-8 overflow-y-auto custom-scrollbar -mx-2 px-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 mb-4">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-3.5 h-3.5 text-white/20" />
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                    Your Games
                  </span>
                </div>
                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all ${
                    showArchived ? "bg-[#ccff00] text-black" : "bg-white/5 text-white/40 hover:text-white"
                  }`}
                >
                  {showArchived ? "Archived" : "Active"}
                </button>
              </div>
              <div className="space-y-1">
                {projects
                  .filter((p) => (showArchived ? p.status === "archived" : p.status !== "archived"))
                  .slice(0, 5)
                  .map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        void switchProject(p);
                      }}
                      className="group relative py-4 px-5 md:py-3 md:px-4 rounded-2xl transition-all cursor-pointer flex items-center gap-4 text-white/40 hover:bg-white/[0.03] hover:text-white/80"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white/5`}>
                        <Box className="w-4 h-4 text-white/40 group-hover:text-white" />
                      </div>
                      <span className="truncate flex-1 font-bold tracking-tight text-[13px]">{p.name}</span>
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const n = window.prompt("Rename game:", p.name);
                            if (n) void renameProject(p.id, n);
                          }}
                          className="p-1.5 hover:text-white transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            void archiveProject(p.id, p.status !== "archived");
                          }}
                          className="p-1.5 hover:text-white transition-colors"
                        >
                          {p.status === "archived" ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void deleteProject(p.id);
                          }}
                          className="p-1.5 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                <button
                  onClick={() => {
                    const n = window.prompt("Game name:");
                    if (n) void createNewProject(n);
                  }}
                  className="w-full flex items-center gap-4 py-4 px-6 md:py-3 md:px-4 rounded-2xl border border-dashed border-white/10 text-white/20 hover:text-white hover:border-white/20 transition-all mt-4"
                >
                  <Plus className="w-4 h-4" />{" "}
                  <span className="text-[12px] font-black uppercase">New Game</span>
                </button>
              </div>
            </div>

            {/* Workspace Tree in Expanded Sidebar */}
            {projectTree.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 px-3 mb-2">
                  <Database className="w-3.5 h-3.5 text-white/20" />
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">
                    Explorer
                  </span>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar -mx-2 px-0">
                  <WorkspaceTree
                    paths={projectTree}
                    onAddInstance={handleAddInstance}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    selectedPaths={selectedTreePaths}
                    onVault={handleVault}
                    onSelectionChange={(paths) => setSelectedTreePaths(paths)}
                    onFileClick={handleFileClick}
                  />
                </div>
                {selectedTreePaths.length > 0 && (
                  <button
                    onClick={() => {
                      const fileMentions = selectedTreePaths.map((p) => `@${p}`).join(", ");
                      const promptText = `Please analyze and fix any bugs in the following files: ${fileMentions}.`;
                      setPrompt(promptText);
                      setTimeout(() => void submitPrompt(promptText), 500);
                      setSelectedTreePaths([]);
                    }}
                    className="w-full py-3 rounded-2xl bg-[#ccff00] text-black font-black text-[11px] uppercase tracking-widest shadow-[0_0_20px_rgba(204,255,0,0.2)] flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> Fix Bugs ({selectedTreePaths.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="pt-6 border-t border-white/5 space-y-2">
            <button
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-white/40 hover:text-white hover:bg-white/5 rounded-2xl transition-all uppercase tracking-widest"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
