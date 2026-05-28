"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Plus, Package, Box, MessageSquare } from "lucide-react";
import { useDashboard } from "./dashboard-context";

import { SavedAsset } from "./types";

export function AssetsTab() {
  const {
    activeTab,
    assetQuery,
    setAssetQuery,
    setShowAssetSearch,
    isAddingAsset,
    setIsAddingAsset,
    newAsset,
    setNewAsset,
    savedAssets,
    // We will use setSavedAssets from context
    setSavedAssets,
    defaultRobloxWorkspace,
    showToast,
    assetCategory,
    setAssetCategory,
    setIsEditingAsset,
    setWorkspaceEditorData,
    setEditingAssetName,
    setEditingAssetCategory,
    handleAttachAsset,
  } = useDashboard() as any; // Cast as any to avoid type complaints during our transition

  if (activeTab !== "assets") return null;

  return (
    <div className="flex-1 w-full h-full flex flex-col p-8 md:p-12 overflow-hidden">
      <div className="flex items-end justify-between mb-12">
        <div className="text-left">
          <div className="flex items-center gap-3 text-[#ccff00] text-[10px] font-black uppercase tracking-[0.4em] mb-4">
            <div className="w-8 h-[1px] bg-[#ccff00]/40" />
            Global Inventory
          </div>
          <h2 className="text-5xl font-black text-white uppercase tracking-tighter italic leading-none">
            Asset <span className="text-white/20">Vault</span>
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#ccff00] transition-colors" />
            <input
              type="text"
              placeholder="Search global assets..."
              className="bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-xs font-bold text-white focus:outline-none focus:border-[#ccff00]/50 transition-all w-64"
              value={assetQuery}
              onChange={(e) => setAssetQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowAssetSearch(true)}
            className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-black text-xs uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all"
          >
            Browse Shop
          </button>
          <button
            onClick={() => setIsAddingAsset(!isAddingAsset)}
            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_10px_20px_rgba(204,255,0,0.2)] active:scale-95 flex items-center gap-2 ${
              isAddingAsset ? "bg-white/10 text-white" : "bg-[#ccff00] text-black hover:bg-[#d4ff33]"
            }`}
          >
            {isAddingAsset ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isAddingAsset ? "Cancel" : "Add to Vault"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAddingAsset && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: 32 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#ccff00]/5 border border-[#ccff00]/20 rounded-[2rem] p-8 flex flex-col md:flex-row items-end gap-6 shadow-xl">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-[#ccff00] uppercase tracking-widest ml-1">
                  Asset Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advanced Combat System"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-sm font-bold text-white focus:outline-none focus:border-[#ccff00]/50 transition-all"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black text-[#ccff00] uppercase tracking-widest ml-1">
                  Category
                </label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 text-sm font-bold text-white focus:outline-none focus:border-[#ccff00]/50 transition-all appearance-none cursor-pointer"
                  value={newAsset.category}
                  onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                >
                  {["Scripts", "UI Components", "Map Assets", "Core Systems"].map((cat) => (
                    <option key={cat} value={cat} className="bg-[#14161a]">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  if (newAsset.name) {
                    const colors = [
                      "#3b82f6",
                      "#ef4444",
                      "#10b981",
                      "#f59e0b",
                      "#8b5cf6",
                      "#ec4899",
                      "#06b6d4",
                    ];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];

                    setSavedAssets([
                      {
                        id: Date.now(),
                        name: newAsset.name,
                        color: randomColor,
                        category: newAsset.category,
                        workspace: JSON.parse(JSON.stringify(defaultRobloxWorkspace)),
                      },
                      ...savedAssets,
                    ]);
                    setNewAsset({ name: "", category: "Scripts" });
                    setIsAddingAsset(false);
                    showToast("Added to Vault. Click 'Preview & Edit' to design.", "success");
                  }
                }}
                className="px-10 py-4 rounded-xl bg-[#ccff00] text-black font-black text-xs uppercase tracking-widest hover:bg-[#d4ff33] transition-all shadow-lg active:scale-95"
              >
                Initialize Asset
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-6 overflow-x-auto no-scrollbar">
        {["All", "Scripts", "UI Components", "Map Assets", "Core Systems"].map((cat) => (
          <button
            key={cat}
            onClick={() => setAssetCategory(cat)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              assetCategory === cat ? "bg-white/10 text-white shadow-xl" : "text-white/20 hover:text-white/40"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
        {savedAssets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 italic">
              Vault is Empty
            </h3>
            <p className="text-sm font-bold text-white/40 italic">
              Design and persist complex systems here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
            <AnimatePresence>
              {savedAssets
                .filter((a: SavedAsset) => assetCategory === "All" || a.category === assetCategory)
                .map((asset: SavedAsset) => (
                  <motion.div
                    layout
                    drag
                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                    dragElastic={0.1}
                    onDragEnd={(_, info) => {
                      if (info.point.y > window.innerHeight - 200) {
                        handleAttachAsset(asset);
                        showToast("Attached to chat", "success");
                      }
                    }}
                    whileDrag={{ scale: 1.05, zIndex: 50 }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={asset.id}
                    className="group relative bg-[#1e2028] border border-white/5 rounded-[2.5rem] overflow-hidden hover:border-white/20 transition-all duration-500 shadow-2xl cursor-grab active:cursor-grabbing"
                  >
                    <div className="h-32 relative overflow-hidden">
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          background: `linear-gradient(135deg, ${asset.color}, transparent)`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
                          style={{ backgroundColor: asset.color }}
                        >
                          <Box className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="p-8">
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 rounded-lg bg-white/5 text-[8px] font-black text-white/40 uppercase tracking-widest border border-white/5">
                          {asset.category}
                        </span>
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: asset.color }}
                        />
                      </div>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight mb-8 truncate">
                        {asset.name}
                      </h4>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setIsEditingAsset(asset.id);
                            setWorkspaceEditorData(JSON.parse(JSON.stringify(asset.workspace)));
                            setEditingAssetName(asset.name);
                            setEditingAssetCategory(asset.category);
                          }}
                          className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/5 text-[9px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all"
                        >
                          Preview & Edit
                        </button>
                        <button
                          onClick={() => void handleAttachAsset(asset)}
                          className="p-4 rounded-2xl bg-white/5 border border-white/5 text-white/40 hover:text-[#ccff00] hover:border-[#ccff00]/20 transition-all"
                          title="Attach to Chat"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
export default AssetsTab;
