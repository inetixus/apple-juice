"use client";
import { FileCode2, Copy, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import * as Diff from "diff";

type ScriptMeta = { 
  name: string; 
  parent: string; 
  type?: string;
  action?: "create" | "delete";
  lineCount: number; 
  code: string; 
  originalCode?: string;
};

export function ScriptCard({ script }: { script: ScriptMeta }) {
  const [expanded, setExpanded] = useState(false);
  const isDelete = script.action === "delete";

  async function copyCode() {
    try { await navigator.clipboard.writeText(script.code); } catch { /* ignore */ }
  }

  return (
    <div className={`mt-4 rounded-xl border ${isDelete ? 'border-red-500/20 bg-red-500/5' : 'border-white/10 bg-[#0a0c10]'} overflow-hidden`}>
      <button
        onClick={() => !isDelete && setExpanded((e) => !e)}
        className={`w-full flex items-center gap-3.5 px-5 py-4 ${!isDelete ? 'hover:bg-white/[0.03] cursor-pointer' : 'cursor-default'} transition-colors`}
      >
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border flex-shrink-0 ${isDelete ? 'bg-red-500/10 border-red-500/20' : 'bg-[#ccff00]/10 border-[#ccff00]/20'}`}>
          {isDelete ? <Trash2 className="h-5 w-5 text-red-400" /> : <FileCode2 className="h-5 w-5 text-[#ccff00]" />}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className={`text-[15px] font-semibold truncate ${isDelete ? 'text-red-400' : 'text-white'}`}>{script.name}</p>
          <p className="text-xs text-[#8a8f98] mt-0.5">
            {isDelete ? 'To be deleted' : `${script.lineCount} lines · ${script.type || 'Script'}`} · {script.parent}
          </p>
        </div>
        {!isDelete && (
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
            <pre className="max-h-72 overflow-auto font-mono text-[13px] bg-[#050505] p-5 leading-relaxed">
              <code>
                {Diff.diffLines(script.originalCode, script.code).map((part, index) => {
                  let colorClass = "text-[#d1d5db]";
                  let bgClass = "";
                  let prefix = "";
                  if (part.added) {
                    colorClass = "text-green-400";
                    bgClass = "bg-green-500/10 block w-full";
                    prefix = "+ ";
                  } else if (part.removed) {
                    colorClass = "text-red-400";
                    bgClass = "bg-red-500/10 block w-full line-through opacity-70";
                    prefix = "- ";
                  }
                  
                  // Split by newline to add prefix to each line
                  const lines = part.value.split('\n');
                  if (lines[lines.length - 1] === '') lines.pop(); // Remove trailing empty split
                  
                  return (
                    <span key={index} className={`${colorClass} ${bgClass}`}>
                      {lines.map((line, i) => (
                        <div key={i} className="pl-2 border-l-2 border-transparent" style={{ borderColor: part.added ? '#4ade80' : part.removed ? '#f87171' : 'transparent' }}>
                          <span className="opacity-50 select-none w-4 inline-block">{prefix}</span>
                          {line}
                        </div>
                      ))}
                    </span>
                  );
                })}
              </code>
            </pre>
          ) : (
            <pre className="max-h-72 overflow-auto font-mono text-[13px] bg-[#050505] p-5 text-[#d1d5db] leading-relaxed">
              <code>{script.code}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
