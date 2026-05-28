"use client";

import { FileCode2, Layers, Network } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
    | "move_instance";
  lineCount: number;
  code: string;
  originalCode?: string;
  requires?: string[];
  className?: string;
  instanceName?: string;
  oldPath?: string;
  newName?: string;
  newParentPath?: string;
};

export function SystemArchitecture({ scripts }: { scripts: ScriptMeta[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<
    { x1: number; y1: number; x2: number; y2: number }[]
  >([]);

  // Simple layout: Independent scripts/modules on left, dependents on right
  const roots: ScriptMeta[] = [];
  const dependents: ScriptMeta[] = [];

  scripts.forEach((s) => {
    if (!s.requires || s.requires.length === 0) {
      roots.push(s);
    } else {
      dependents.push(s);
    }
  });

  // If we can't determine roots cleanly, just fall back to all roots
  if (roots.length === 0 && scripts.length > 0) {
    roots.push(...scripts);
    dependents.length = 0;
  }

  useEffect(() => {
    function drawLines() {
      if (!containerRef.current) return;

      const newLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const containerRect = containerRef.current.getBoundingClientRect();

      scripts.forEach((script) => {
        if (!script.requires || script.requires.length === 0) return;

        const sourceEl = document.getElementById(
          `node-${script.name.replace(/\s+/g, "-")}`,
        );
        if (!sourceEl) return;

        (script.requires || []).forEach((req) => {
          const targetEl =
            document.getElementById(`node-${req.replace(/\s+/g, "-")}`) ||
            document.getElementById(`node-${req.replace(/\s+/g, "-")}.lua`);
          if (targetEl) {
            const sRect = sourceEl.getBoundingClientRect();
            const tRect = targetEl.getBoundingClientRect();

            // Draw from left edge of source to right edge of target
            newLines.push({
              x1: sRect.left - containerRect.left,
              y1: sRect.top - containerRect.top + sRect.height / 2,
              x2: tRect.right - containerRect.left,
              y2: tRect.top - containerRect.top + tRect.height / 2,
            });
          }
        });
      });
      setLines(newLines);
    }

    // Draw initially and on resize
    setTimeout(drawLines, 100);
    window.addEventListener("resize", drawLines);
    return () => window.removeEventListener("resize", drawLines);
  }, [scripts]);

  if (scripts.length <= 1) return null;

  return (
    <div className="mt-4 mb-2 animate-in fade-in slide-in-from-top-2 duration-500">
      <details className="group bg-[#1e2028]/40 border border-white/[0.05] rounded-xl overflow-hidden shadow-2xl">
        <summary className="cursor-pointer text-[12px] font-black text-white/40 hover:text-white hover:bg-white/5 transition-all flex items-center justify-between px-4 py-3 select-none list-none [&::-webkit-details-marker]:hidden group-open:border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-400">
              <Network className="h-4 w-4" />
            </div>
            <span className="tracking-widest uppercase text-[10px] font-black">
              System Architecture
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono opacity-40 uppercase">
              {scripts.length} Components
            </span>
            <div className="w-5 h-5 rounded flex items-center justify-center bg-white/5 group-open:rotate-180 transition-transform duration-300">
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-black/40"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 1L5 5L9 1" />
              </svg>
            </div>
          </div>
        </summary>

        <div
          ref={containerRef}
          className="relative bg-[#d1d5db] p-4 overflow-hidden flex items-center justify-center min-h-[140px] border-b border-black/5"
        >
          {/* SVG overlay for lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {lines.map((line, i) => (
              <path
                key={i}
                d={`M ${line.x2} ${line.y2} C ${line.x2 + 40} ${line.y2}, ${line.x1 - 40} ${line.y1}, ${line.x1} ${line.y1}`}
                fill="none"
                stroke="rgba(16, 185, 129, 0.2)"
                strokeWidth="1.5"
                className="animate-in fade-in duration-1000"
                style={{ strokeDasharray: "4 4" }}
              />
            ))}

            {/* Arrow heads at target */}
            {lines.map((line, i) => (
              <circle
                key={`dot-${i}`}
                cx={line.x2 + 4}
                cy={line.y2}
                r="2"
                fill="#10b981"
                className="opacity-40"
              />
            ))}
          </svg>

          <div className="relative z-10 w-full flex flex-col md:flex-row justify-around items-stretch gap-8 md:gap-16">
            {/* Roots Column */}
            <div className="flex flex-col gap-4 items-center justify-center w-full">
              <span className="text-[10px] text-white/30 uppercase tracking-widest mb-1 font-black">
                Providers / Modules
              </span>
              {roots.map((script) => (
                <div
                  key={script.name}
                  id={`node-${script.name.replace(/\s+/g, "-")}`}
                  onClick={() => {
                    const el = document.getElementById(
                      `script-${script.name.replace(/\s+/g, "-")}`,
                    );
                    if (el) {
                      el.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      el.classList.add(
                        "ring-2",
                        "ring-black",
                        "ring-offset-4",
                        "ring-offset-[#f3f4f6]",
                      );
                      setTimeout(
                        () =>
                          el.classList.remove(
                            "ring-2",
                            "ring-black",
                            "ring-offset-4",
                            "ring-offset-[#f3f4f6]",
                          ),
                        2000,
                      );
                    }
                  }}
                  className="w-full max-w-[200px] bg-[#1e2028] border border-white/10 rounded p-3 flex items-center gap-3 transition-all hover:scale-105 hover:border-white/20 cursor-pointer group shadow-xl"
                >
                  <div className="h-8 w-8 rounded bg-black flex items-center justify-center flex-shrink-0 group-hover:bg-gray-800 transition-colors shadow-lg">
                    <Layers className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white/90 truncate group-hover:text-white transition-colors uppercase tracking-tighter">
                      {script.name}
                    </p>
                    <p className="text-[10px] text-white/40 truncate font-bold italic">
                      {script.type || "Script"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Dependents Column */}
            {dependents.length > 0 && (
              <div className="flex flex-col gap-4 items-center justify-center w-full">
                  <span className="text-[10px] text-white/30 uppercase tracking-widest mb-1 font-black">
                  Consumers
                </span>
                {dependents.map((script) => (
                    <div
                      key={script.name}
                      id={`node-${script.name.replace(/\s+/g, "-")}`}
                      onClick={() => {
                        const el = document.getElementById(
                          `script-${script.name.replace(/\s+/g, "-")}`,
                        );
                        if (el) {
                          el.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                          el.classList.add(
                            "ring-2",
                            "ring-black",
                            "ring-offset-4",
                            "ring-offset-[#1a1c22]",
                          );
                          setTimeout(
                            () =>
                              el.classList.remove(
                                "ring-2",
                                "ring-black",
                                "ring-offset-4",
                                "ring-offset-[#1a1c22]",
                              ),
                            2000,
                          );
                        }
                      }}
                      className="w-full max-w-[200px] bg-[#1e2028] border border-white/10 rounded p-3 flex items-center gap-3 transition-all hover:scale-105 hover:border-white/20 cursor-pointer group shadow-xl"
                    >
                      <div className="h-8 w-8 rounded bg-black flex items-center justify-center flex-shrink-0 group-hover:bg-gray-800 transition-colors shadow-lg">
                        <FileCode2 className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white/90 truncate group-hover:text-white transition-colors uppercase tracking-tighter">
                          {script.name}
                        </p>
                        <p className="text-[10px] text-white/40 truncate font-bold italic">
                          {script.type || "Script"}
                        </p>
                      </div>
                    </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
