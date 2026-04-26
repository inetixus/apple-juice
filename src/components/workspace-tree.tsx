"use client";
import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, FileCode2, FolderClosed, FolderOpen, Box } from "lucide-react";

type TreeNode = {
  name: string;
  fullPath: string;
  children: TreeNode[];
  isFolder: boolean;
  type?: string;
};

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const p of paths) {
    // Format: "ServerScriptService.ChildFolder.ScriptName [Script]"
    // or "Workspace.Part [Part]"
    const typeMatch = p.match(/\s+\[([^\]]+)\]$/);
    const type = typeMatch?.[1] || "";
    const cleaned = p.replace(/\s+\[.*?\]$/, "");
    const parts = cleaned.split(".");

    let current = root;
    let pathSoFar = "";

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      pathSoFar += (pathSoFar ? "." : "") + segment;
      const isLast = i === parts.length - 1;

      let existing = current.find((n) => n.name === segment);
      if (!existing) {
        existing = {
          name: segment,
          fullPath: pathSoFar,
          children: [],
          isFolder: !isLast,
          type: isLast ? type : "Folder",
        };
        current.push(existing);
      }
      // If this is not the last segment, ensure it's a folder
      if (!isLast) {
        existing.isFolder = true;
        existing.type = "Folder";
      }
      current = existing.children;
    }
  }

  return root;
}

function getIcon(node: TreeNode, isOpen: boolean) {
  if (node.isFolder) {
    return isOpen ? (
      <FolderOpen className="h-3.5 w-3.5 text-[#ccff00]/60 flex-shrink-0" />
    ) : (
      <FolderClosed className="h-3.5 w-3.5 text-[#ccff00]/40 flex-shrink-0" />
    );
  }

  const t = (node.type || "").toLowerCase();
  if (t.includes("script") || t.includes("module") || t.includes("local")) {
    return <FileCode2 className="h-3.5 w-3.5 text-blue-400/60 flex-shrink-0" />;
  }
  return <Box className="h-3 w-3 text-white/30 flex-shrink-0" />;
}

function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1); // auto-expand top level

  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={`flex items-center gap-1.5 w-full text-left py-[3px] rounded-md transition-colors group
          ${hasChildren ? "hover:bg-white/[0.04] cursor-pointer" : "cursor-default"}
        `}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="h-3 w-3 text-white/30 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-white/30 flex-shrink-0" />
          )
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {getIcon(node, open)}
        <span className="text-[11px] text-white/60 truncate group-hover:text-white/90 transition-colors">
          {node.name}
        </span>
        {node.type && !node.isFolder && (
          <span className="text-[9px] text-white/20 ml-auto pr-1 flex-shrink-0">
            {node.type}
          </span>
        )}
      </button>
      {open && hasChildren && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-150">
          {node.children.map((child) => (
            <TreeItem key={child.fullPath} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkspaceTree({ paths }: { paths: string[] }) {
  const tree = useMemo(() => buildTree(paths), [paths]);

  if (tree.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <TreeItem key={node.fullPath} node={node} />
      ))}
    </div>
  );
}
