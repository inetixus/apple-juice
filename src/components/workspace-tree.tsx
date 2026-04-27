"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

type TreeNode = {
  name: string;
  fullPath: string;
  children: TreeNode[];
  isFolder: boolean;
  type?: string;
  depth: number;
};

const ICON_MAP: Record<string, string> = {
  Workspace:"Workspace",Players:"Players",Lighting:"Lighting",MaterialService:"MaterialService",
  ReplicatedFirst:"ReplicatedFirst",ReplicatedStorage:"ReplicatedStorage",
  ServerScriptService:"ServerScriptService",ServerStorage:"ServerStorage",
  StarterGui:"StarterGui",StarterPack:"StarterPack",StarterPlayer:"StarterPlayer",
  StarterPlayerScripts:"StarterPlayerScripts",StarterCharacterScripts:"StarterCharacterScripts",
  Teams:"Teams",SoundService:"SoundService",TextChatService:"TextChatService",
  NetworkClient:"NetworkClient",Script:"Script",LocalScript:"LocalScript",
  ModuleScript:"ModuleScript",Part:"Part",MeshPart:"MeshPart",SpawnLocation:"SpawnLocation",
  Model:"Model",Folder:"Folder",Camera:"Camera",Terrain:"Terrain",
  Atmosphere:"Atmosphere",Sky:"Sky",Bloom:"BloomEffect",BloomEffect:"BloomEffect",
  DepthOfFieldEffect:"DepthOfFieldEffect",SunRaysEffect:"SunRaysEffect",
  ColorCorrectionEffect:"ColorCorrectionEffect",BlurEffect:"BlurEffect",
  ScreenGui:"ScreenGui",Frame:"Frame",TextLabel:"TextLabel",TextButton:"TextButton",
  TextBox:"TextBox",ImageLabel:"ImageLabel",ImageButton:"ImageButton",
  BillboardGui:"BillboardGui",SurfaceGui:"SurfaceGui",ScrollingFrame:"ScrollingFrame",
  ViewportFrame:"ViewportFrame",CanvasGroup:"CanvasGroup",
  UIListLayout:"UIListLayout",UIGridLayout:"UIGridLayout",UIPadding:"UIPadding",
  UICorner:"UICorner",UIStroke:"UIStroke",UIGradient:"UIGradient",UIScale:"UIScale",
  UIAspectRatioConstraint:"UIAspectRatioConstraint",UISizeConstraint:"UISizeConstraint",
  UITableLayout:"UITableLayout",UIPageLayout:"UIPageLayout",UIFlexItem:"UIFlexItem",
  BoolValue:"BoolValue",BrickColorValue:"BrickColorValue",CFrameValue:"CFrameValue",
  Sound:"Sound",SoundGroup:"SoundGroup",ParticleEmitter:"ParticleEmitter",
  Fire:"Fire",Smoke:"Smoke",Sparkles:"Sparkles",Beam:"Beam",Trail:"Trail",
  Highlight:"Highlight",Attachment:"Attachment",WeldConstraint:"WeldConstraint",
  Motor6D:"Motor6D",HingeConstraint:"HingeConstraint",
  BallSocketConstraint:"BallSocketConstraint",RopeConstraint:"RopeConstraint",
  SpringConstraint:"SpringConstraint",RodConstraint:"RodConstraint",
  Humanoid:"Humanoid",HumanoidDescription:"HumanoidDescription",
  RemoteEvent:"RemoteEvent",RemoteFunction:"RemoteFunction",
  BindableEvent:"BindableEvent",BindableFunction:"BindableFunction",
  UnreliableRemoteEvent:"UnreliableRemoteEvent",ClickDetector:"ClickDetector",
  ProximityPrompt:"ProximityPrompt",Decal:"Decal",Texture:"Texture",Tool:"Tool",
  ForceField:"ForceField",Explosion:"Explosion",PointLight:"PointLight",
  SpotLight:"SpotLight",SurfaceLight:"SurfaceLight",Bone:"Bone",Animation:"Animation",
  Animator:"Animator",AnimationController:"AnimationController",
  Configuration:"Configuration",UnionOperation:"UnionOperation",
  IntersectOperation:"IntersectOperation",NegateOperation:"NegateOperation",
  SpecialMesh:"SpecialMesh",BlockMesh:"BlockMesh",TextChannel:"TextChannel",
  BubbleChatConfiguration:"BubbleChatConfiguration",
  ChatWindowConfiguration:"ChatWindowConfiguration",
  ChatInputBarConfiguration:"ChatInputBarConfiguration",
  Player:"Player",Backpack:"Backpack",WedgePart:"WedgePart",
  CornerWedgePart:"CornerWedgePart",TrussPart:"TrussPart",Seat:"Seat",
  VehicleSeat:"VehicleSeat",ClientReplicator:"ClientReplicator",Clouds:"Clouds",
  PackageLink:"PackageLink",Accessory:"Accessory",Shirt:"Shirt",Pants:"Pants",
  ShirtGraphic:"ShirtGraphic",BodyColors:"BodyColors",CharacterMesh:"CharacterMesh",
  SurfaceAppearance:"SurfaceAppearance",DragDetector:"DragDetector",
  Actor:"Actor",Weld:"Weld",
};

function getIconPath(className: string): string {
  const mapped = ICON_MAP[className];
  if (mapped) return `/roblox-icons/${mapped}@2x.png`;
  return `/roblox-icons/${className}@2x.png`;
}

const INSERTABLE_CATEGORIES = [
  { label:"Scripts", items:[
    {className:"Script",label:"Script"},{className:"LocalScript",label:"LocalScript"},
    {className:"ModuleScript",label:"ModuleScript"},
  ]},
  { label:"Parts", items:[
    {className:"Part",label:"Part"},{className:"MeshPart",label:"MeshPart"},
    {className:"SpawnLocation",label:"SpawnLocation"},{className:"Seat",label:"Seat"},
    {className:"VehicleSeat",label:"VehicleSeat"},{className:"TrussPart",label:"TrussPart"},
    {className:"WedgePart",label:"WedgePart"},{className:"CornerWedgePart",label:"CornerWedgePart"},
    {className:"UnionOperation",label:"Union"},{className:"NegateOperation",label:"Negate"},
  ]},
  { label:"Containers", items:[
    {className:"Model",label:"Model"},{className:"Folder",label:"Folder"},
    {className:"Configuration",label:"Configuration"},{className:"Actor",label:"Actor"},
  ]},
  { label:"Values", items:[
    {className:"StringValue",label:"StringValue"},{className:"NumberValue",label:"NumberValue"},
    {className:"IntValue",label:"IntValue"},{className:"BoolValue",label:"BoolValue"},
    {className:"CFrameValue",label:"CFrameValue"},{className:"Vector3Value",label:"Vector3Value"},
    {className:"Color3Value",label:"Color3Value"},{className:"BrickColorValue",label:"BrickColorValue"},
    {className:"ObjectValue",label:"ObjectValue"},{className:"RayValue",label:"RayValue"},
  ]},
  { label:"Interactions", items:[
    {className:"ProximityPrompt",label:"ProximityPrompt"},{className:"ClickDetector",label:"ClickDetector"},
    {className:"TouchTransmitter",label:"TouchTransmitter"},{className:"DragDetector",label:"DragDetector"},
  ]},
  { label:"GUI", items:[
    {className:"ScreenGui",label:"ScreenGui"},{className:"Frame",label:"Frame"},
    {className:"TextLabel",label:"TextLabel"},{className:"TextButton",label:"TextButton"},
    {className:"TextBox",label:"TextBox"},{className:"ImageLabel",label:"ImageLabel"},
    {className:"ImageButton",label:"ImageButton"},{className:"ScrollingFrame",label:"ScrollingFrame"},
    {className:"ViewportFrame",label:"ViewportFrame"},{className:"CanvasGroup",label:"CanvasGroup"},
    {className:"BillboardGui",label:"BillboardGui"},{className:"SurfaceGui",label:"SurfaceGui"},
    {className:"VideoFrame",label:"VideoFrame"},
  ]},
  { label:"UI Layout", items:[
    {className:"UIListLayout",label:"UIListLayout"},{className:"UIGridLayout",label:"UIGridLayout"},
    {className:"UIPadding",label:"UIPadding"},{className:"UICorner",label:"UICorner"},
    {className:"UIStroke",label:"UIStroke"},{className:"UIGradient",label:"UIGradient"},
    {className:"UIScale",label:"UIScale"},{className:"UIAspectRatioConstraint",label:"UIAspectRatioConstraint"},
    {className:"UISizeConstraint",label:"UISizeConstraint"},{className:"UITextSizeConstraint",label:"UITextSizeConstraint"},
    {className:"UITableLayout",label:"UITableLayout"},{className:"UIPageLayout",label:"UIPageLayout"},
    {className:"UIFlexItem",label:"UIFlexItem"},
  ]},
  { label:"Effects", items:[
    {className:"ParticleEmitter",label:"ParticleEmitter"},{className:"Fire",label:"Fire"},
    {className:"Smoke",label:"Smoke"},{className:"Sparkles",label:"Sparkles"},
    {className:"Beam",label:"Beam"},{className:"Trail",label:"Trail"},
    {className:"Highlight",label:"Highlight"},{className:"PointLight",label:"PointLight"},
    {className:"SpotLight",label:"SpotLight"},{className:"SurfaceLight",label:"SurfaceLight"},
    {className:"Explosion",label:"Explosion"},{className:"ForceField",label:"ForceField"},
  ]},
  { label:"Environmental", items:[
    {className:"Atmosphere",label:"Atmosphere"},{className:"Sky",label:"Sky"},
    {className:"Clouds",label:"Clouds"},{className:"BloomEffect",label:"Bloom"},
    {className:"BlurEffect",label:"Blur"},{className:"ColorCorrectionEffect",label:"ColorCorrection"},
    {className:"SunRaysEffect",label:"SunRays"},{className:"DepthOfFieldEffect",label:"DepthOfField"},
  ]},
  { label:"Physics Constraints", items:[
    {className:"Attachment",label:"Attachment"},{className:"Bone",label:"Bone"},
    {className:"WeldConstraint",label:"WeldConstraint"},{className:"Weld",label:"Weld"},
    {className:"Motor6D",label:"Motor6D"},{className:"HingeConstraint",label:"HingeConstraint"},
    {className:"BallSocketConstraint",label:"BallSocketConstraint"},{className:"RopeConstraint",label:"RopeConstraint"},
    {className:"SpringConstraint",label:"SpringConstraint"},{className:"RodConstraint",label:"RodConstraint"},
    {className:"CylindricalConstraint",label:"CylindricalConstraint"},{className:"PrismaticConstraint",label:"PrismaticConstraint"},
    {className:"UniversalConstraint",label:"UniversalConstraint"},{className:"SlidingBallConstraint",label:"SlidingBall"},
  ]},
  { label:"Physics Forces", items:[
    {className:"VectorForce",label:"VectorForce"},{className:"LinearVelocity",label:"LinearVelocity"},
    {className:"AngularVelocity",label:"AngularVelocity"},{className:"Torque",label:"Torque"},
    {className:"AlignPosition",label:"AlignPosition"},{className:"AlignOrientation",label:"AlignOrientation"},
  ]},
  { label:"Sound", items:[
    {className:"Sound",label:"Sound"},{className:"SoundGroup",label:"SoundGroup"},
    {className:"AudioPlayer",label:"AudioPlayer"},{className:"AudioEmitter",label:"AudioEmitter"},
    {className:"AudioListener",label:"AudioListener"},{className:"AudioAnalyzer",label:"AudioAnalyzer"},
  ]},
  { label:"Network", items:[
    {className:"RemoteEvent",label:"RemoteEvent"},{className:"RemoteFunction",label:"RemoteFunction"},
    {className:"BindableEvent",label:"BindableEvent"},{className:"BindableFunction",label:"BindableFunction"},
    {className:"UnreliableRemoteEvent",label:"UnreliableRemoteEvent"},
  ]},
  { label:"Animation", items:[
    {className:"Animation",label:"Animation"},{className:"Animator",label:"Animator"},
    {className:"AnimationController",label:"AnimationController"},
  ]},
  { label:"Avatar", items:[
    {className:"Humanoid",label:"Humanoid"},{className:"HumanoidDescription",label:"HumanoidDescription"},
    {className:"Accessory",label:"Accessory"},{className:"Shirt",label:"Shirt"},
    {className:"Pants",label:"Pants"},{className:"ShirtGraphic",label:"ShirtGraphic"},
    {className:"BodyColors",label:"BodyColors"},
  ]},
];

// ─── Insert Object Menu ────────────────────────────────────────────────────────

function InsertObjectMenu({
  parentPath, onInsert, onClose,
}: {
  parentPath: string;
  onInsert: (parentPath: string, className: string, name: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return INSERTABLE_CATEGORIES;
    const q = search.toLowerCase();
    return INSERTABLE_CATEGORIES.map(cat => ({
      ...cat, items: cat.items.filter(item => 
        item.label.toLowerCase().includes(q) || item.className.toLowerCase().includes(q)
      ),
    })).filter(cat => cat.items.length > 0);
  }, [search]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div
        ref={menuRef}
        className="w-[320px] rounded-lg border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150"
        style={{
          background: "#2d2d30",
          borderColor: "#454545",
          fontFamily: "'Source Sans Pro', 'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: "1px solid #454545", background: "#333333" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="#9d9d9d" strokeWidth="1.5"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#9d9d9d" strokeWidth="1.5"/>
          </svg>
          <input
            ref={inputRef} type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search objects..."
            style={{
              flex:1, background:"transparent", border:"none", outline:"none",
              fontSize:"13px", color:"#eeeeee", fontFamily:"inherit",
            }}
          />
          <button onClick={onClose} style={{padding:"2px",background:"none",border:"none",cursor:"pointer"}} className="hover:opacity-80">
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="#9d9d9d" strokeWidth="1.5">
              <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
            </svg>
          </button>
        </div>
        
        <div style={{ maxHeight:"400px", overflowY:"auto", padding:"4px 0" }} className="custom-scrollbar bg-[#252526]">
          {filteredCategories.length === 0 && (
            <div style={{padding:"20px", textAlign:"center", fontSize:"12px", color:"#808080"}}>
              No objects found matching "{search}"
            </div>
          )}
          {filteredCategories.map(cat => (
            <div key={cat.label} className="mb-2 last:mb-0">
              <div style={{padding:"6px 12px", fontSize:"10px", fontWeight:700, color:"#808080", textTransform:"uppercase", letterSpacing:"0.06em", background: "#2d2d30"}}>
                {cat.label}
              </div>
              {cat.items.map(item => (
                <button
                  key={item.className}
                  onClick={() => { onInsert(parentPath, item.className, item.label); onClose(); }}
                  style={{
                    width:"100%", display:"flex", alignItems:"center", gap:"8px",
                    padding:"4px 12px", textAlign:"left", background:"none", border:"none",
                    cursor:"pointer", fontSize:"13px", color:"#cccccc",
                    fontFamily:"inherit",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "#094771";
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "none";
                    e.currentTarget.style.color = "#cccccc";
                  }}
                >
                  <div style={{ width: "16px", height: "16px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={getIconPath(item.className)} alt="" width={16} height={16}
                      style={{imageRendering:"auto"}}
                      onError={e => {(e.target as HTMLImageElement).src = "/roblox-icons/Part@2x.png";}}
                    />
                  </div>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        
        <div style={{padding:"8px 12px", borderTop:"1px solid #454545", fontSize:"11px", color:"#808080", background: "#2d2d30"}}>
          Inserting into: <span style={{color:"#aaaaaa"}}>{parentPath}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tree Builder ────────────────────────────────────────────────────────────

const CONTAINERS = new Set([
  "Workspace","Players","Lighting","MaterialService","ReplicatedFirst",
  "ReplicatedStorage","ServerScriptService","ServerStorage","StarterGui",
  "StarterPack","StarterPlayer","StarterPlayerScripts","StarterCharacterScripts",
  "Teams","SoundService","TextChatService","NetworkClient",
  "Model","Folder","Configuration","Actor",
  "ScreenGui","Frame","ScrollingFrame","CanvasGroup","BillboardGui","SurfaceGui",
  "Tool","Backpack","Accessory","Humanoid","Animator","AnimationController","Camera",
]);

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const p of paths) {
    const typeMatch = p.match(/\s+\[([^\]]+)\]$/);
    const type = typeMatch?.[1] || "";
    const cleaned = p.replace(/\s+\[.*?\]$/, "");
    
    // Support both dot and slash separators, and filter out empty parts
    const parts = cleaned.split(/[.\/]/).filter(part => part.length > 0);
    
    let current = root;
    let pathSoFar = "";
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      pathSoFar += (pathSoFar ? "." : "") + segment;
      const isLast = i === parts.length - 1;
      let existing = current.find(n => n.name === segment);
      if (!existing) {
        // Clean type name for container check (remove trailing slashes)
        const cleanType = type.replace(/\/+$/, "");
        existing = {
          name: segment, 
          fullPath: pathSoFar, 
          children: [], 
          depth: i,
          isFolder: !isLast || (isLast && cleanType !== "" && CONTAINERS.has(cleanType)),
          type: isLast ? cleanType : "Folder",
        };
        current.push(existing);
      } else if (isLast && type) {
        const cleanType = type.replace(/\/+$/, "");
        existing.type = cleanType;
        if (CONTAINERS.has(cleanType)) existing.isFolder = true;
      }
      if (!isLast) existing.isFolder = true;
      current = existing.children;
    }
  }
  return root;
}

// ─── Tree Row ────────────────────────────────────────────────────────────────

const INDENT = 16; // Roblox indent is roughly 16px
const ROW_H = 22;  // Roblox row height is ~22px

function TreeItem({
  node, onInsert, isLast, parentIsLasts, selectedPath, setSelectedPath, onRename, onDelete, renamingPath, setRenamingPath,
}: {
  node: TreeNode;
  onInsert: (parentPath: string, className: string, name: string) => void;
  isLast: boolean;
  parentIsLasts: boolean[];
  selectedPath: string | null;
  setSelectedPath: (path: string | null) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string, name: string) => void;
  renamingPath: string | null;
  setRenamingPath: (path: string | null) => void;
}) {
  const [open, setOpen] = useState(node.depth < 1);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const [hovered, setHovered] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renamePathRef = useRef<string>("");
  const isSubmittingRef = useRef<boolean>(false);

  const isRenaming = renamingPath === node.fullPath;
  const isSelected = selectedPath === node.fullPath;
  const hasChildren = node.children.length > 0;
  const isExpandable = hasChildren;
  const handleCloseMenu = useCallback(() => setShowInsertMenu(false), []);

  // Focus the rename input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      isSubmittingRef.current = false;
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (showContextMenu) {
      const handler = (e: MouseEvent) => {
        if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
          setShowContextMenu(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [showContextMenu]);

  const startRename = useCallback(() => {
    setNewName(node.name);
    renamePathRef.current = node.fullPath;
    setRenamingPath(node.fullPath);
  }, [node.name, node.fullPath, setRenamingPath]);

  const handleRenameSubmit = useCallback(() => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    const trimmed = newName.trim();
    const originalPath = renamePathRef.current || node.fullPath;
    if (trimmed && trimmed !== node.name && onRename) {
      onRename(originalPath, trimmed);
    }
    setRenamingPath(null);
  }, [newName, node.name, node.fullPath, onRename, setRenamingPath]);

  const cancelRename = useCallback(() => {
    setRenamingPath(null);
  }, [setRenamingPath]);

  // Indent guide lines
  const guideLines: React.ReactNode[] = [];
  for (let d = 0; d < node.depth; d++) {
    if (!parentIsLasts[d]) {
      guideLines.push(
        <div
          key={`guide-${d}`}
          style={{
            position: "absolute",
            left: `${d * INDENT + 6}px`,
            top: 0,
            bottom: 0,
            width: "1px",
            background: "#333333",
          }}
        />
      );
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: `${ROW_H}px`,
          paddingLeft: `${node.depth * INDENT}px`,
          position: "relative",
          cursor: "default",
          background: isSelected ? "#094771" : hovered ? "#2a2d2e" : "transparent",
          fontFamily: "'Segoe UI', 'Source Sans Pro', system-ui, sans-serif",
          outline: isSelected ? "1px double #2c5d87" : "none",
          outlineOffset: "-1px",
        }}
        onClick={(e) => {
          setSelectedPath(node.fullPath);
          // Only expand on double click if not renaming
          if (e.detail === 2 && isExpandable && !isRenaming) setOpen(!open);
        }}
        onDoubleClick={() => {
          if (!isRenaming) {
            startRename();
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={e => {
          e.preventDefault();
          setSelectedPath(node.fullPath);
          setShowContextMenu(true);
        }}
      >
        {/* Indent guide lines */}
        {guideLines}

        {/* Expand/Collapse arrow */}
        <div 
          style={{ width: "14px", height: ROW_H, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            if (isExpandable) setOpen(!open);
          }}
        >
          {isExpandable && (
            <svg
              width="6" height="6" viewBox="0 0 8 8"
              style={{
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.05s ease",
              }}
            >
              <path d="M1 1 L7 4 L1 7 Z" fill={hovered || isSelected ? "#ffffff" : "#9d9d9d"} />
            </svg>
          )}
        </div>

        {/* Icon */}
        <div style={{ width:"16px", height:"16px", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", marginRight:"4px" }}>
          <img
            src={getIconPath(node.type || "Part")}
            alt="" width={16} height={16}
            style={{ imageRendering: "auto" }}
            draggable={false}
            onError={e => {
              const img = e.target as HTMLImageElement;
              if (!img.dataset.fallback) { img.dataset.fallback = "1"; img.src = "/roblox-icons/Part@2x.png"; }
            }}
          />
        </div>

        {/* Name / Rename Input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); handleRenameSubmit(); }
              if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
            }}
            style={{
              fontSize: "13px",
              color: "#ffffff",
              background: "#1e1e1e",
              border: "1px solid #007acc",
              outline: "none",
              height: "18px",
              padding: "0 2px",
              fontFamily: "inherit",
              width: "calc(100% - 60px)",
              maxWidth: "200px",
              minWidth: "80px",
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span style={{
            fontSize: "13px",
            color: isSelected ? "#ffffff" : "#cccccc",
            whiteSpace: "nowrap",
            userSelect: "none",
            lineHeight: `${ROW_H}px`,
          }}>
            {node.name}
          </span>
        )}

        {/* Roblox Plus Button (Circle with plus) */}
        {(hovered || isSelected) && !isRenaming && (
          <button
            onClick={e => { e.stopPropagation(); setShowInsertMenu(!showInsertMenu); }}
            style={{
              marginLeft: "auto", marginRight: "6px",
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
            title="Insert Object"
          >
            <svg width="14" height="14" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="7" fill="none" stroke={isSelected ? "#ffffff" : "#a0a0a0"} strokeWidth="1.5" />
              <line x1="8" y1="5" x2="8" y2="11" stroke={isSelected ? "#ffffff" : "#a0a0a0"} strokeWidth="1.5" />
              <line x1="5" y1="8" x2="11" y2="8" stroke={isSelected ? "#ffffff" : "#a0a0a0"} strokeWidth="1.5" />
            </svg>
          </button>
        )}

        {/* Context Menu Popup */}
        {showContextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed z-[300] w-40 py-1 rounded shadow-xl border"
            style={{
              background: "#2d2d30",
              borderColor: "#454545",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="w-full px-3 py-1.5 text-left text-[12px] text-[#cccccc] hover:bg-[#094771] hover:text-white"
              onClick={() => { setShowContextMenu(false); startRename(); }}
            >
              Rename
            </button>
            <button
              className="w-full px-3 py-1.5 text-left text-[12px] text-[#cccccc] hover:bg-[#094771] hover:text-white"
              onClick={() => { setShowContextMenu(false); setShowInsertMenu(true); }}
            >
              Insert Object
            </button>
            <div className="h-[1px] bg-[#454545] my-1" />
            <button
              className="w-full px-3 py-1.5 text-left text-[12px] text-[#ff4444] hover:bg-[#cc0000] hover:text-white"
              onClick={() => { 
                if (confirm(`Are you sure you want to delete ${node.name}?`)) {
                  onDelete?.(node.fullPath, node.name);
                }
                setShowContextMenu(false);
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Insert Object Menu Popup */}
      {showInsertMenu && (
        <InsertObjectMenu parentPath={node.fullPath} onInsert={onInsert} onClose={handleCloseMenu} />
      )}

      {/* Children */}
      {open && node.children.map((child, i) => (
        <TreeItem
          key={child.fullPath}
          node={child}
          onInsert={onInsert}
          isLast={i === node.children.length - 1}
          parentIsLasts={[...parentIsLasts, isLast]}
          selectedPath={selectedPath}
          setSelectedPath={setSelectedPath}
          onRename={onRename}
          onDelete={onDelete}
          renamingPath={renamingPath}
          setRenamingPath={setRenamingPath}
        />
      ))}
    </div>
  );
}

// ─── Exported Component ──────────────────────────────────────────────────────

export function WorkspaceTree({
  paths, onAddInstance, onRename, onDelete,
}: {
  paths: string[];
  onAddInstance?: (parentPath: string, className: string, name: string) => void;
  onRename?: (path: string, newName: string) => void;
  onDelete?: (path: string, name: string) => void;
}) {
  const tree = useMemo(() => buildTree(paths), [paths]);
  const [filterText, setFilterText] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const handleInsert = useCallback(
    (parentPath: string, className: string, name: string) => {
      if (onAddInstance) onAddInstance(parentPath, className, name);
    },
    [onAddInstance]
  );

  // Filter tree nodes recursively
  const filterTree = useCallback((nodes: TreeNode[], q: string): TreeNode[] => {
    if (!q) return nodes;
    const lower = q.toLowerCase();
    return nodes.reduce<TreeNode[]>((acc, node) => {
      const childMatches = filterTree(node.children, q);
      if (node.name.toLowerCase().includes(lower) || childMatches.length > 0) {
        acc.push({ ...node, children: childMatches.length > 0 ? childMatches : node.children });
      }
      return acc;
    }, []);
  }, []);

  const displayTree = useMemo(() => filterTree(tree, filterText), [tree, filterText, filterTree]);

  if (tree.length === 0) return null;

  return (
    <div
      style={{
        background: "#252526",
        border: "1px solid #3c3c3c",
        borderRadius: "0px",
        overflow: "hidden",
        fontFamily: "'Source Sans Pro', 'Segoe UI', system-ui, sans-serif",
        fontSize: "13px",
      }}
    >
      {/* Header - mimics exact Roblox Studio Explorer header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          height: "24px",
          background: "#2d2d30",
          borderBottom: "1px solid #3c3c3c",
        }}
      >
        <span style={{
          fontSize: "12px", color: "#a0a0a0", fontWeight: 400,
          userSelect: "none", letterSpacing: "0.02em",
        }}>
          Explorer
        </span>
        {/* Filter toggle */}
        <button
          onClick={() => setFilterText(prev => prev === "" ? " " : "")}
          style={{
            background:"none", border:"none", cursor:"pointer", padding:"2px",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}
          title="Filter"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="#808080" strokeWidth="1.3"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#808080" strokeWidth="1.3"/>
          </svg>
        </button>
      </div>

      {/* Filter bar */}
      {filterText !== "" && (
        <div style={{
          display: "flex", alignItems: "center", gap: "4px",
          padding: "2px 6px", background: "#1e1e1e",
          borderBottom: "1px solid #3c3c3c",
        }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
            <circle cx="7" cy="7" r="5" stroke="#606060" strokeWidth="1.3"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#606060" strokeWidth="1.3"/>
          </svg>
          <input
            type="text"
            value={filterText.trim()}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter workspace..."
            autoFocus
            style={{
              flex:1, background:"transparent", border:"none", outline:"none",
              fontSize:"12px", color:"#cccccc", padding:"2px 0",
              fontFamily: "'Source Sans Pro', 'Segoe UI', system-ui, sans-serif",
            }}
          />
          <button
            onClick={() => setFilterText("")}
            style={{background:"none",border:"none",cursor:"pointer",padding:"2px"}}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="#808080" strokeWidth="1.5">
              <line x1="2" y1="2" x2="8" y2="8"/><line x1="8" y1="2" x2="2" y2="8"/>
            </svg>
          </button>
        </div>
      )}

      {/* Tree content */}
      <div style={{ padding: "1px 0" }}>
        {displayTree.map((node, i) => (
          <TreeItem
            key={node.fullPath}
            node={node}
            onInsert={handleInsert}
            isLast={i === displayTree.length - 1}
            parentIsLasts={[]}
            selectedPath={selectedPath}
            setSelectedPath={setSelectedPath}
            onRename={onRename}
            onDelete={onDelete}
            renamingPath={renamingPath}
            setRenamingPath={setRenamingPath}
          />
        ))}
      </div>
    </div>
  );
}
