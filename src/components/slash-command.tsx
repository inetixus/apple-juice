"use client";

import {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
} from "react";

export interface SlashCommand {
  command: string;
  label: string;
  description: string;
  category?: string;
  icon?: string;
}

const BUILT_IN_COMMANDS: SlashCommand[] = [
  { command: "/help",     label: "/help",                description: "Show all available commands",                   category: "General", icon: "?" },
  { command: "/clear",    label: "/clear",               description: "Clear the current chat",                        category: "Chat",    icon: "✕" },
  { command: "/retry",    label: "/retry",               description: "Retry the last prompt",                         category: "Chat",    icon: "↻" },
  { command: "/model",    label: "/model <name>",        description: "Switch AI model (e.g. /model gpt-4o)",          category: "AI",      icon: "◇" },
  { command: "/plan",     label: "/plan",                description: "Switch to Plan mode",                           category: "Mode",    icon: "◎" },
  { command: "/build",    label: "/build",               description: "Switch to Build mode",                          category: "Mode",    icon: "⚡" },
  { command: "/settings", label: "/settings",            description: "Open settings panel",                           category: "System",  icon: "⚙" },
  { command: "/vault",    label: "/vault",               description: "Open asset vault",                              category: "Assets",  icon: "▣" },
  { command: "/search",   label: "/search <query>",      description: "Search toolbox assets",                         category: "Assets",  icon: "⌕" },
  { command: "/project",  label: "/project <name>",      description: "Switch to a project",                           category: "Project", icon: "⊞" },
  { command: "/create",   label: "/create <type> <name>",description: "Create a new instance (Script, Folder, etc.)",  category: "Studio",  icon: "+" },
  { command: "/rename",   label: "/rename <old> <new>",  description: "Rename an instance",                            category: "Studio",  icon: "✎" },
  { command: "/delete",   label: "/delete <path>",       description: "Delete an instance",                            category: "Studio",  icon: "✕" },
  { command: "/theme",    label: "/theme <name>",        description: "Change UI theme (stud, dracula, zap)",          category: "System",  icon: "◐" },
];

interface SlashCommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  extraCommands?: SlashCommand[];
}

export function SlashCommandInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Type a command or press / for commands...",
  disabled = false,
  className = "",
  extraCommands = [],
}: SlashCommandInputProps) {
  // ── Refs ──────────────────────────────────────────────────────────
  // The textarea is UNCONTROLLED. We set its value imperatively so that
  // React never touches the DOM node and never resets the cursor.
  const taRef    = useRef<HTMLTextAreaElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  // Track the last value we pushed to the DOM so we can sync when the
  // parent changes value externally (e.g. clearing after submit).
  const lastSyncedValue = useRef(value);

  // ── Menu state ────────────────────────────────────────────────────
  const [showMenu,    setShowMenu]    = useState(false);
  const [searchTerm,  setSearchTerm]  = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // ── Commands ──────────────────────────────────────────────────────
  const allCommands = useMemo(
    () => [...BUILT_IN_COMMANDS, ...extraCommands],
    [extraCommands],
  );

  const filteredCommands = useMemo(() => {
    if (!searchTerm) return allCommands;
    const lower = searchTerm.toLowerCase();
    return allCommands.filter(
      (c) =>
        c.command.toLowerCase().includes(lower) ||
        c.label.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower),
    );
  }, [allCommands, searchTerm]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, SlashCommand[]> = {};
    for (const cmd of filteredCommands) {
      const cat = cmd.category ?? "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // ── External value sync ───────────────────────────────────────────
  // When the parent clears the input (e.g. after submit), push the new
  // value into the uncontrolled textarea without touching the cursor
  // mid-type.  We only write to the DOM when the value actually differs
  // from what we already put there.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (value !== lastSyncedValue.current) {
      // Genuine external change — overwrite the DOM value.
      ta.value = value;
      lastSyncedValue.current = value;
      // If the parent cleared the field, also close the menu.
      if (value === "") {
        setShowMenu(false);
        setSearchTerm("");
      }
    }
  }, [value]);

  // ── Insert a selected command ─────────────────────────────────────
  const insertCommand = useCallback(
    (cmd: SlashCommand) => {
      const ta = taRef.current;
      if (!ta) return;

      const pos       = ta.selectionStart;
      const before    = ta.value.slice(0, pos);
      const slashIdx  = before.lastIndexOf("/");

      if (slashIdx === -1) return;

      const newText   = before.slice(0, slashIdx) + cmd.command + " " + ta.value.slice(pos);
      const newCursor = slashIdx + cmd.command.length + 1;

      // Write directly to DOM — cursor stays exactly where we put it.
      ta.value = newText;
      ta.setSelectionRange(newCursor, newCursor);
      ta.focus();

      lastSyncedValue.current = newText;
      onChange(newText);

      setShowMenu(false);
      setSearchTerm("");
    },
    [onChange],
  );

  // ── Handle typing ─────────────────────────────────────────────────
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const ta        = e.currentTarget;
      const newVal    = ta.value;
      const cursorPos = ta.selectionStart;

      // Tell the parent about the new value — but we do NOT let React
      // update `ta.value` because this textarea is uncontrolled.
      lastSyncedValue.current = newVal;
      onChange(newVal);

      // ── Slash detection ──────────────────────────────────────────
      // Look at the text from the start up to the cursor.
      const before     = newVal.slice(0, cursorPos);
      // Match a "/" that is at the very beginning or preceded by whitespace,
      // optionally followed by non-whitespace characters, anchored at end.
      const slashMatch = before.match(/(?:^|\s)(\/[^\s]*)$/);

      if (slashMatch) {
        const afterSlash = slashMatch[1].slice(1); // drop the "/"
        setSearchTerm(afterSlash);
        setShowMenu(true);
        setActiveIndex(0);
      } else {
        if (showMenu) {
          setShowMenu(false);
          setSearchTerm("");
        }
      }
    },
    [onChange, showMenu],
  );

  // ── Keyboard navigation ───────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showMenu || filteredCommands.length === 0) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
        return;
      }

      switch (e.key) {
        case "Tab":
        case "Enter":
          e.preventDefault();
          if (filteredCommands[activeIndex]) insertCommand(filteredCommands[activeIndex]);
          break;
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((p) => (p + 1) % filteredCommands.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((p) => (p - 1 + filteredCommands.length) % filteredCommands.length);
          break;
        case "Escape":
          e.preventDefault();
          setShowMenu(false);
          break;
      }
    },
    [showMenu, filteredCommands, activeIndex, insertCommand, onSubmit],
  );

  // ── Close menu on outside click ───────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        taRef.current   && !taRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="relative w-full">
      <div className="flex flex-col gap-0.5 mb-2 pointer-events-none opacity-40">
        <hr className="border-white/10 w-full" />
        <hr className="border-white/5 w-full" />
      </div>
      {/*
        IMPORTANT: No `value` prop here — this textarea is intentionally
        uncontrolled so React never resets the cursor.  We pass
        `defaultValue` once on mount and manage the DOM value ourselves.
      */}
      <textarea
        ref={taRef}
        defaultValue={value}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="flex flex-col gap-0.5 mt-2 pointer-events-none opacity-40">
        <hr className="border-white/5 w-full" />
        <hr className="border-white/10 w-full" />
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className="fixed z-[9999] w-[320px] bg-[#101115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: "min(400px, 60vh)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
              {filteredCommands.length} command{filteredCommands.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[8px] text-white/20 ml-auto">
              <kbd className="px-1 py-0.5 rounded bg-white/5 text-[9px] font-mono">Tab</kbd>
            </span>
          </div>

          <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: "min(340px, 50vh)" }}>
            {filteredCommands.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-[10px] text-white/20">
                  No matches for "<span className="text-white/40 font-bold">/{searchTerm}</span>"
                </p>
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, cmds]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 text-[8px] font-black text-white/20 uppercase tracking-[0.25em]">
                    {category}
                  </div>
                  {cmds.map((cmd) => {
                    const idx = filteredCommands.indexOf(cmd);
                    return (
                      <button
                        key={cmd.command}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertCommand(cmd)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 text-left ${
                          idx === activeIndex
                            ? "bg-[#ccff00]/10 border-l-2 border-[#ccff00]"
                            : "border-l-2 border-transparent hover:bg-white/[0.03]"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                            idx === activeIndex
                              ? "bg-[#ccff00]/20 text-[#ccff00]"
                              : "bg-white/5 text-white/30"
                          }`}
                        >
                          {cmd.icon ?? "/"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-[11px] font-bold truncate ${
                              idx === activeIndex ? "text-[#ccff00]" : "text-white/80"
                            }`}
                          >
                            {cmd.label}
                          </div>
                          <div className="text-[9px] text-white/30 truncate mt-0.5">
                            {cmd.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-white/5 flex items-center gap-3 text-[8px] text-white/20">
            <span><kbd className="px-1 py-0.5 rounded bg-white/5 text-[9px] font-mono">↑↓</kbd> nav</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white/5 text-[9px] font-mono">Esc</kbd> close</span>
            <span className="ml-auto"><kbd className="px-1 py-0.5 rounded bg-white/5 text-[9px] font-mono">Tab</kbd> fill</span>
          </div>
        </div>
      )}
    </div>
  );
}