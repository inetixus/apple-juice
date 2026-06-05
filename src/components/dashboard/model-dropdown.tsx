"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles, Check } from "lucide-react";
import { kiroModelLogo } from "@/lib/kiro-models";

/**
 * Themed model selector with brand logos. Replaces the native <select>, whose
 * dropdown list cannot be styled (renders as an unthemed white OS menu).
 *
 * `align` controls which edge the popup anchors to; `direction` whether it
 * opens upward (for bottom-of-screen placement like the chat input) or down.
 */
export function ModelDropdown({
  models,
  selected,
  disabled,
  onSelect,
  align = "right",
  direction = "up",
  className = "",
}: {
  models: string[];
  selected: string;
  disabled?: boolean;
  onSelect: (m: string) => void;
  align?: "left" | "right";
  direction?: "up" | "down";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLogo = kiroModelLogo(selected);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg pl-2 pr-2 py-1.5 transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.08] hover:border-white/20"
        }`}
      >
        {selectedLogo ? (
          <img src={selectedLogo} alt="" className="w-3.5 h-3.5 object-contain rounded-sm" />
        ) : (
          <Sparkles className="w-3.5 h-3.5 text-[#ccff00]" />
        )}
        <span className="text-[11px] font-semibold text-white/80 tracking-tight max-w-[140px] truncate">
          {selected}
        </span>
        <ChevronDown className={`w-3 h-3 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: direction === "up" ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: direction === "up" ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.13, ease: "easeOut" }}
            className={`absolute z-[300] w-60 bg-[#16181d] border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden p-1.5 ${
              align === "right" ? "right-0" : "left-0"
            } ${direction === "up" ? "bottom-full mb-2" : "top-full mt-2"}`}
          >
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5">
              {models.map((m) => {
                const logo = kiroModelLogo(m);
                const isSel = m === selected;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onSelect(m);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] text-left transition-colors ${
                      isSel
                        ? "bg-[#ccff00]/10 text-[#ccff00]"
                        : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {logo ? (
                      <img src={logo} alt="" className="w-4 h-4 object-contain rounded-sm flex-shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 opacity-40 flex-shrink-0" />
                    )}
                    <span className="flex-1 font-medium truncate">{m}</span>
                    {isSel && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
