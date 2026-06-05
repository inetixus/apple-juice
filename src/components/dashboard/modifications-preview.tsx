"use client";

import { useState } from "react";
import {
  FilePlus2,
  Trash2,
  Plus,
  Edit3,
  Move,
  Play,
  FileCode,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type AnyAction = {
  action?: string;
  type?: string;
  className?: string;
  name?: string;
  instanceName?: string;
  parent?: string;
  oldPath?: string;
  newName?: string;
  newParentPath?: string;
  code?: string;
  lineCount?: number;
};

function actionMeta(a: AnyAction): {
  icon: any;
  color: string;
  verb: string;
  label: string;
  sub: string;
} {
  const act = String(a.action ?? "create").toLowerCase().replace(/[\s-]+/g, "_");
  const name = a.name || a.instanceName || "Instance";
  const parent = a.parent || a.newParentPath || "";
  switch (act) {
    case "delete":
      return { icon: Trash2, color: "text-red-400", verb: "Delete", label: name, sub: parent };
    case "create_instance":
      return { icon: Plus, color: "text-blue-400", verb: "Create", label: `${a.className || a.type || "Instance"} "${a.instanceName || name}"`, sub: parent };
    case "rename_instance":
      return { icon: Edit3, color: "text-amber-400", verb: "Rename", label: `${a.oldPath?.split(".").pop() || name} → ${a.newName}`, sub: a.oldPath || "" };
    case "move_instance":
      return { icon: Move, color: "text-indigo-400", verb: "Move", label: a.oldPath?.split(".").pop() || name, sub: `→ ${a.newParentPath || ""}` };
    case "run_playtest":
      return { icon: Play, color: "text-emerald-400", verb: "Playtest", label: "Run playtest", sub: "verify in Studio" };
    default: {
      // create script
      const lines = a.lineCount || (a.code ? a.code.split("\n").length : 0);
      return {
        icon: FilePlus2,
        color: "text-[#ccff00]",
        verb: "Write",
        label: `${a.type || "Script"} "${name}"`,
        sub: `${parent}${lines ? ` · ${lines} lines` : ""}`,
      };
    }
  }
}

/**
 * Compact, expandable list of the changes the AI is requesting for a message,
 * so the user can see exactly what will be (or was) applied to Studio.
 */
export function ModificationsPreview({ scripts }: { scripts: AnyAction[] }) {
  const [open, setOpen] = useState(true);
  const real = (scripts || []).filter(
    (s) => String(s.action ?? "").toLowerCase().replace(/[\s-]+/g, "_") !== "run_playtest",
  );
  if (real.length === 0) return null;

  return (
    <div className="mt-2 w-full max-w-[460px] rounded-xl border border-white/[0.08] bg-black/30 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-white/40" />
        )}
        <FileCode className="w-3.5 h-3.5 text-[#ccff00]" />
        <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
          {real.length} change{real.length > 1 ? "s" : ""} requested
        </span>
      </button>
      {open && (
        <div className="flex flex-col divide-y divide-white/[0.04] border-t border-white/[0.06]">
          {real.map((a, i) => {
            const m = actionMeta(a);
            const Icon = m.icon;
            return (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${m.color}`} />
                <span className={`text-[10px] font-black uppercase tracking-wide ${m.color} w-12 flex-shrink-0`}>
                  {m.verb}
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[12px] text-white/85 font-medium truncate">{m.label}</span>
                  {m.sub && (
                    <span className="text-[10px] text-white/35 truncate font-mono">{m.sub}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
