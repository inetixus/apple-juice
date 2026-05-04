"use client";
import { FileCode2, Copy, ChevronDown, ChevronUp, Trash2, Box, Folder, Layout, MousePointer2, Image, Type, Database, Palette, Ghost, Zap, Cpu, Play, Plus, Move, Edit3 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import * as Diff from "diff";
import { Highlight, themes, type PrismTheme } from "prism-react-renderer";

const luauTheme: PrismTheme = {
  ...themes.vsDark,
  plain: {
    color: "#D4D4D4",
    backgroundColor: "transparent",
  },
  styles: [
    ...themes.vsDark.styles,
    {
      types: ["keyword"],
      style: {
        color: "#F86D7C",
      },
    },
    {
      types: ["operator", "punctuation"],
      style: {
        color: "#FFFFFF",
      },
    },
    {
      types: ["string", "char"],
      style: {
        color: "#ADF195",
      },
    },
    {
      types: ["function"],
      style: {
        color: "#66C3FA",
      },
    },
    {
      types: ["comment"],
      style: {
        color: "#666666",
        fontStyle: "italic",
      },
    },
    {
      types: ["number", "boolean"],
      style: {
        color: "#FFC600",
      },
    },
    {
      types: ["builtin", "constant"],
      style: {
        color: "#84D6F7",
      },
    },
  ],
};

type ScriptMeta = {
  name: string;
  parent: string;
  type?: string;
  action?: "create" | "delete" | "insert_asset" | "stop_playtest" | "run_playtest" | "create_instance" | "rename_instance" | "move_instance";
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

export function ScriptCard({ script }: { script: ScriptMeta }) {
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
  const isSpecialAction = isDelete || isAsset || isPlaytest || isCreateInst || isRename || isMove;

  async function copyCode() {
    try { await navigator.clipboard.writeText(script.code); } catch { /* ignore */ }
  }

  const IconComponent = typeIconMap[script.type || "Script"] || Ghost;

  return (
    <motion.div 
      id={`script-${(script.name || "Unknown").replace(/\s+/g, '-')}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`mt-3 rounded-2xl border ${
        isDelete ? 'border-red-500/20 bg-red-500/5' : 
        isAsset ? 'border-purple-500/20 bg-purple-500/5' : 
        isPlaytest ? 'border-green-500/10 bg-green-500/5' :
        isCreateInst ? 'border-blue-500/10 bg-blue-500/5' :
        isRename ? 'border-amber-500/10 bg-amber-500/5' :
        isMove ? 'border-indigo-500/10 bg-indigo-500/5' :
        'border-white/10 bg-[#0a0c10] shadow-xl'
      } overflow-hidden transition-colors`}
    >
      <button
        onClick={() => !isSpecialAction && setExpanded((e) => !e)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 ${(!isSpecialAction) ? 'hover:bg-white/[0.03] cursor-pointer' : 'cursor-default'} transition-colors`}
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded-md border flex-shrink-0 ${
          isDelete ? 'bg-red-500/10 border-red-500/20' : 
          isAsset ? 'bg-purple-500/10 border-purple-500/20' : 
          isPlaytest ? 'bg-green-500/10 border-green-500/20' :
          isCreateInst ? 'bg-blue-500/10 border-blue-500/20' :
          'bg-[#ccff00]/10 border-[#ccff00]/20'
        }`}>
          {isDelete ? <Trash2 className="h-4 w-4 text-red-400" /> : 
           isAsset ? <Box className="h-4 w-4 text-purple-400" /> : 
           isPlaytest ? <Play className="h-4 w-4 text-green-400" /> :
           isCreateInst ? <Plus className="h-4 w-4 text-blue-400" /> :
           isRename ? <Edit3 className="h-4 w-4 text-amber-400" /> :
           isMove ? <Move className="h-4 w-4 text-indigo-400" /> :
           <IconComponent className="h-4 w-4 text-[#ccff00]" />}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className={`text-[13px] font-semibold truncate ${
            isDelete ? 'text-red-400' : 
            isAsset ? 'text-purple-400' : 
            isPlaytest ? 'text-green-400' :
            isCreateInst ? 'text-blue-400' :
            isRename ? 'text-amber-400' :
            isMove ? 'text-indigo-400' :
            'text-white'
          }`}>
            {isPlaytest ? "Run Playtest" : 
             isRename ? `Rename ${script.oldPath?.split('.').pop() || "Object"} → ${script.newName}` :
             isMove ? `Move ${script.oldPath?.split('.').pop() || "Object"} → ${script.newParentPath}` :
             isCreateInst ? `Create ${script.className}` :
             (script.name || "Unknown Script")}
          </p>
          <p className="text-[10px] text-[#8a8f98] mt-0.5">
            {isDelete ? 'To be deleted' : 
             isAsset ? `Roblox Asset` : 
             isPlaytest ? 'Remote Studio Command' :
             isCreateInst ? `Instance Name: ${script.instanceName}` :
             isRename ? `From: ${script.oldPath}` :
             isMove ? `To: ${script.newParentPath}` :
             ((script.lineCount || 0) > 0 ? `${script.lineCount} lines · ` : '') + (script.type || 'Script') + ` · ${script.parent || "Workspace"}`}
          </p>
        </div>
        {!isSpecialAction && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={(e) => { e.stopPropagation(); copyCode(); }}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
            {expanded ? <ChevronUp className="h-4 w-4 text-[#8a8f98]" /> : <ChevronDown className="h-4 w-4 text-[#8a8f98]" />}
          </div>
        )}
      </button>
      {expanded && !isDelete && (
        <div className="border-t border-white/5">
          {script.originalCode ? (
            <div className="max-h-[500px] overflow-auto font-mono text-[13px] bg-[#050505] p-0 leading-relaxed">
              <div className="flex flex-col">
                {Diff.diffLines(script.originalCode || "", script.code || "").map((part, index) => {
                  const colorClass = part.added ? "text-green-400" : part.removed ? "text-red-400" : "text-white/70";
                  const bgClass = part.added ? "bg-green-500/10" : part.removed ? "bg-red-500/10" : "";
                  const prefix = part.added ? "+ " : part.removed ? "- " : "  ";

                  return (
                    <div key={index} className={`${bgClass} w-full`}>
                      <Highlight
                        theme={luauTheme}
                        code={part.value.replace(/\n$/, "")}
                        language="lua"
                      >
                        {({ tokens, getLineProps, getTokenProps }) => (
                          <>
                            {tokens.map((line, i) => (
                              <div key={i} {...getLineProps({ line })} className={`flex px-5 ${bgClass}`}>
                                <span className={`w-6 flex-shrink-0 select-none opacity-30 text-[10px] mt-1 ${colorClass}`}>
                                  {prefix}
                                </span>
                                <div className="flex-1">
                                  {line.map((token, key) => (
                                    <span key={key} {...getTokenProps({ token })} />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </Highlight>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto font-mono text-[12px] bg-[#050505] p-3 leading-relaxed">
              <Highlight
                theme={luauTheme}
                code={(script.code || "").trim()}
                language="lua"
              >
                {({ tokens, getLineProps, getTokenProps }) => (
                  <pre>
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })}>
                        <span className="inline-block w-6 select-none opacity-20 text-right pr-2 text-[9px]">{i + 1}</span>
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
