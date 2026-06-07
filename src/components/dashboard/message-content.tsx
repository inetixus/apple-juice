"use client";

import { useState } from "react";
import { FileCode, ChevronDown, ChevronRight, Copy, Check, ListTree } from "lucide-react";
import { CodeEditor } from "@/components/code-editor";

type Segment =
  | { kind: "text"; text: string }
  | { kind: "code"; lang: string; code: string; title?: string };

/**
 * Split assistant text into prose + fenced code-block segments. Lets us render
 * code (and the AI's "plans") as organized artifact cards instead of a wall of
 * text — important when the Studio plugin is offline and the AI replies in text.
 */
function parseSegments(content: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([^\n]*)\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(content)) !== null) {
    if (m.index > last) {
      const text = content.slice(last, m.index).trim();
      if (text) segments.push({ kind: "text", text });
    }
    const lang = (m[1] || "").trim() || "luau";
    segments.push({ kind: "code", lang, code: m[2].replace(/\n$/, "") });
    last = fence.lastIndex;
  }
  if (last < content.length) {
    const text = content.slice(last).trim();
    if (text) segments.push({ kind: "text", text });
  }
  if (segments.length === 0) segments.push({ kind: "text", text: content });
  return segments;
}

function CodeArtifact({ lang, code }: { lang: string; code: string }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const lineCount = code.split("\n").length;
  const isLua = /lua|luau/i.test(lang);

  return (
    <div className="my-2 rounded-xl border border-white/10 bg-[#0a0a0c] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/[0.06]">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 flex-1 text-left">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
          <FileCode className="w-3.5 h-3.5 text-[#ccff00]" />
          <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
            {isLua ? "Luau" : lang} · {lineCount} line{lineCount > 1 ? "s" : ""}
          </span>
        </button>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {open && (
        <div className="border-t border-black/5 bg-[#0a0a0c]">
          <CodeEditor
            code={code}
            language={isLua ? "luau" : lang || "text"}
            height={Math.min(420, Math.max(100, lineCount * 20)) + "px"}
          />
        </div>
      )}
    </div>
  );
}

/** Detect a "plan"-style text block (numbered/architecture lists) for a heading. */
function looksLikePlan(text: string): boolean {
  return /(^|\n)\s*(##|architecture|plan|here'?s? (the|what)|\d+\.\s)/i.test(text) && text.length > 220;
}

function TextArtifact({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="my-2 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-2 bg-white/[0.03] border-b border-white/[0.06] text-left"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-white/40" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
        <ListTree className="w-3.5 h-3.5 text-[#ccff00]" />
        <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">Plan</span>
      </button>
      {open && (
        <div className="px-4 py-3 text-[13px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
          {text}
        </div>
      )}
    </div>
  );
}

/**
 * Renders an assistant message body: prose inline, code as collapsible code
 * artifacts, and long plan-like prose as a "Plan" artifact card.
 */
export function MessageContent({ content }: { content: string }) {
  if (!content) return null;
  const segments = parseSegments(content);
  return (
    <div className="flex flex-col">
      {segments.map((seg, i) => {
        if (seg.kind === "code") return <CodeArtifact key={i} lang={seg.lang} code={seg.code} />;
        if (looksLikePlan(seg.text)) return <TextArtifact key={i} text={seg.text} />;
        return (
          <span key={i} className="whitespace-pre-wrap break-words">
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}
