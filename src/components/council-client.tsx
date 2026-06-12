"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Loader2, Scale, Sparkles, Check, X, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";

type CandidateState = {
  model: string;
  status: "pending" | "running" | "done" | "failed";
};

type Score = {
  model: string;
  score: number;
  correctness: number;
  efficiency: number;
  robustness: number;
  notes: string;
};

type CouncilResult = {
  winner: string;
  winningCode: string;
  verdict: string;
  scores: Score[];
  error?: string;
};

const DEFAULT_MODELS = ["Claude Sonnet 4.6", "GLM-5", "MiniMax M2.5"];
const MAX_MODELS = ["Claude Opus 4.8", "Claude Opus 4.7", "Claude Sonnet 4.6", "GLM-5"];

export function CouncilClient({ sessionKey }: { sessionKey?: string }) {
  const [prompt, setPrompt] = useState("");
  const [resolvedKey, setResolvedKey] = useState(sessionKey ?? "");
  const [maxMode, setMaxMode] = useState(false);

  // Pick up the active Studio session key the dashboard mirrored to
  // localStorage, so "Apply to Studio" targets the same paired session.
  useEffect(() => {
    if (sessionKey) return;
    try {
      const k = window.localStorage.getItem("aj_session_key");
      if (k) setResolvedKey(k);
    } catch {
      /* ignore */
    }
  }, [sessionKey]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "generating" | "judging" | "done">("idle");
  const [candidates, setCandidates] = useState<CandidateState[]>([]);
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<"idle" | "applying" | "done" | "error">("idle");
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeModels = maxMode ? MAX_MODELS : DEFAULT_MODELS;

  async function run() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setResult(null);
    setErrorMsg(null);
    setApplyState("idle");
    setApplyMsg(null);
    setPhase("generating");
    setCandidates(activeModels.map((m) => ({ model: m, status: "pending" })));

    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, sessionKey: resolvedKey, max: maxMode, stream: true }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const blocks = buf.split("\n\n");
        buf = blocks.pop() || "";
        for (const block of blocks) {
          const evt = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
          const dataM = block.match(/^data:\s*(.+)$/m);
          if (!dataM) continue;
          let payload: any;
          try {
            payload = JSON.parse(dataM[1]);
          } catch {
            continue;
          }
          if (evt === "progress") handleProgress(payload);
          else if (evt === "result") {
            setResult(payload);
            setPhase("done");
          } else if (evt === "error") {
            setErrorMsg(payload.error || "Council failed.");
            setPhase("idle");
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setErrorMsg(e?.message || "Council failed.");
      setPhase("idle");
    } finally {
      setRunning(false);
    }
  }

  function handleProgress(p: any) {
    if (p.kind === "candidate_start") {
      setCandidates((prev) =>
        prev.map((c) => (c.model === p.model ? { ...c, status: "running" } : c)),
      );
    } else if (p.kind === "candidate_done") {
      setCandidates((prev) =>
        prev.map((c) =>
          c.model === p.model
            ? { ...c, status: p.ok ? "done" : "failed" }
            : c,
        ),
      );
    } else if (p.kind === "judging") {
      setPhase("judging");
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
    setPhase("idle");
  }

  async function applyToStudio() {
    if (!result?.winningCode || !resolvedKey || applyState === "applying") return;
    setApplyState("applying");
    setApplyMsg(null);
    try {
      const res = await fetch("/api/council/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: resolvedKey, code: result.winningCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setApplyState("done");
        setApplyMsg(data.message || "Applied to Studio.");
      } else {
        setApplyState("error");
        setApplyMsg(data.error || "Failed to apply.");
      }
    } catch (e: any) {
      setApplyState("error");
      setApplyMsg(e?.message || "Failed to apply.");
    }
  }

  const sortedScores = result
    ? [...result.scores].sort((a, b) => b.score - a.score)
    : [];

  return (
    <div className="relative min-h-[100dvh] w-full bg-gradient-to-b from-[#050508] via-[#08080d] to-[#101015] text-white/90 font-sans overflow-x-hidden antialiased">
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(circle at 50% -10%, rgba(204,255,0,0.07), transparent 60%), radial-gradient(circle at 80% 60%, rgba(139,92,246,0.06), transparent 55%)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-2xl bg-[#ccff00]/15 border border-[#ccff00]/30 flex items-center justify-center">
            <Scale className="h-5 w-5 text-[#ccff00]" />
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full glossy-pill-dark border border-white/5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
            <Sparkles className="h-3 w-3 text-[#ccff00]" />
            Code Council
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.05]">
          The AI that judges the other AIs.
        </h1>
        <p className="mt-3 text-sm text-white/55 font-medium leading-relaxed max-w-xl">
          Several models solve your request in parallel. A judge model compares
          every solution on correctness, efficiency, and robustness — then the
          best code wins.
        </p>

        {/* Prompt */}
        <div className="mt-7 glossy-panel-dark rounded-[1.5rem] p-4 sm:p-5">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the script you want, e.g. “a server-authoritative double-jump with a configurable max jumps”…"
            rows={3}
            disabled={running}
            className="w-full bg-transparent resize-none outline-none text-sm text-white placeholder:text-white/30 font-medium leading-relaxed"
          />
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Council mode — pick like a model */}
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 mr-0.5">
                Council:
              </span>
              <button
                onClick={() => setMaxMode(false)}
                disabled={running}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5",
                  !maxMode
                    ? "bg-[#ccff00]/15 border-[#ccff00]/50 text-[#ccff00] shadow-[0_0_14px_rgba(204,255,0,0.25)]"
                    : "bg-white/5 border-white/10 text-white/45 hover:border-white/25",
                )}
              >
                {!maxMode && <Check className="h-3 w-3" strokeWidth={3} />}
                Standard
              </button>
              <button
                onClick={() => setMaxMode(true)}
                disabled={running}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5",
                  maxMode
                    ? "bg-[#8b5cf6]/20 border-[#8b5cf6]/50 text-[#c4b5fd] shadow-[0_0_16px_rgba(139,92,246,0.3)]"
                    : "bg-white/5 border-white/10 text-white/45 hover:border-white/25",
                )}
              >
                <Zap className="h-3 w-3" />
                MAX
              </button>
            </div>
            {running ? (
              <button
                onClick={stop}
                className="h-10 px-5 rounded-full border border-white/15 text-white/70 hover:bg-white/5 text-[11px] font-bold uppercase tracking-wider transition-all"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={run}
                disabled={!prompt.trim()}
                className="h-10 px-6 rounded-full bg-[#ccff00] text-black font-black uppercase tracking-wider text-[11px] flex items-center gap-2 hover:bg-[#d4ff33] shadow-[0_0_20px_rgba(204,255,0,0.3)] active:scale-95 hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100"
              >
                {maxMode ? "Convene MAX council" : "Convene council"}
              </button>
            )}
          </div>

          {/* The models competing in the selected mode */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 mr-0.5">
              Competing:
            </span>
            {activeModels.map((m) => (
              <span
                key={m}
                className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/50"
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Credit-usage warning */}
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] sm:text-xs text-amber-200/80 font-medium leading-snug">
            Heads up — the council runs{" "}
            <span className="font-black text-amber-200">
              {activeModels.length + 1} model calls
            </span>{" "}
            per request ({activeModels.length} candidates + 1 judge), so it uses{" "}
            <span className="font-black text-amber-200">
              {maxMode ? "a lot more" : "several times more"}
            </span>{" "}
            credits than a normal generation.{" "}
            {maxMode && "MAX mode uses top-tier models — the most expensive option."}
          </p>
        </div>

        {/* Live candidate progress */}
        {phase !== "idle" && (
          <div className="mt-6 space-y-2">
            {candidates.map((c) => (
              <div
                key={c.model}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <StatusDot status={c.status} />
                <span className="text-sm font-bold text-white/80">{c.model}</span>
                <span className="ml-auto text-[11px] font-medium text-white/40 uppercase tracking-wider">
                  {c.status === "running"
                    ? "Writing…"
                    : c.status === "done"
                      ? "Submitted"
                      : c.status === "failed"
                        ? "No answer"
                        : "Queued"}
                </span>
              </div>
            ))}
            {phase === "judging" && (
              <div className="flex items-center gap-3 rounded-xl border border-[#ccff00]/25 bg-[#ccff00]/[0.06] px-4 py-3">
                <Loader2 className="h-4 w-4 text-[#ccff00] animate-spin" />
                <span className="text-sm font-bold text-[#ccff00]">
                  Judge is comparing the solutions…
                </span>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && !result.error && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-8"
            >
              {/* Winner banner */}
              <div className="rounded-2xl border border-[#ccff00]/40 bg-[#ccff00]/[0.06] p-5 shadow-[0_0_30px_rgba(204,255,0,0.1)]">
                <div className="flex items-center gap-2.5">
                  <Trophy className="h-5 w-5 text-[#ccff00]" />
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                    Winner
                  </span>
                  <span className="ml-auto text-lg font-black text-[#ccff00]">
                    {result.winner}
                  </span>
                </div>
                <p className="mt-3 text-[13px] text-white/65 font-medium leading-relaxed">
                  {result.verdict}
                </p>
              </div>

              {/* Scoreboard */}
              <div className="mt-5 space-y-3">
                {sortedScores.map((s, i) => (
                  <div
                    key={s.model}
                    className={cn(
                      "rounded-2xl border p-4",
                      i === 0
                        ? "border-[#ccff00]/30 bg-[#ccff00]/[0.04]"
                        : "border-white/10 bg-white/[0.03]",
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-black text-white">
                        {i === 0 && "🏆 "}
                        {s.model}
                      </span>
                      <span
                        className={cn(
                          "text-lg font-black",
                          i === 0 ? "text-[#ccff00]" : "text-white/70",
                        )}
                      >
                        {s.score}
                        <span className="text-[10px] text-white/30 font-bold">
                          /100
                        </span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Metric label="Correctness" value={s.correctness} />
                      <Metric label="Efficiency" value={s.efficiency} />
                      <Metric label="Robustness" value={s.robustness} />
                    </div>
                    {s.notes && (
                      <p className="mt-3 text-[11px] text-white/45 font-medium leading-snug">
                        {s.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Winning code */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                    Winning code
                  </span>
                  <div className="flex items-center gap-3">
                    {resolvedKey && (
                      <button
                        onClick={applyToStudio}
                        disabled={applyState === "applying" || applyState === "done"}
                        className={cn(
                          "h-8 px-4 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-60",
                          applyState === "done"
                            ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                            : "bg-[#ccff00] text-black hover:bg-[#d4ff33] shadow-[0_0_16px_rgba(204,255,0,0.3)]",
                        )}
                      >
                        {applyState === "applying" ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Applying…
                          </>
                        ) : applyState === "done" ? (
                          <>
                            <Check className="h-3 w-3" /> In Studio
                          </>
                        ) : (
                          <>
                            <Zap className="h-3 w-3" /> Apply to Studio
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => navigator.clipboard?.writeText(result.winningCode)}
                      className="text-[11px] font-bold uppercase tracking-wider text-[#ccff00] hover:text-[#d4ff33]"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                {applyMsg && (
                  <p
                    className={cn(
                      "mb-2 text-[11px] font-medium",
                      applyState === "error" ? "text-red-300" : "text-emerald-300",
                    )}
                  >
                    {applyMsg}
                  </p>
                )}
                <pre className="rounded-2xl border border-white/10 bg-black/40 p-4 overflow-x-auto text-[12px] leading-relaxed text-white/80 font-mono">
                  <code>{result.winningCode}</code>
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: CandidateState["status"] }) {
  if (status === "running")
    return <Loader2 className="h-4 w-4 text-[#ccff00] animate-spin shrink-0" />;
  if (status === "done")
    return (
      <span className="h-4 w-4 rounded-full bg-[#ccff00] text-black flex items-center justify-center shrink-0">
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  if (status === "failed")
    return (
      <span className="h-4 w-4 rounded-full bg-red-500/80 text-white flex items-center justify-center shrink-0">
        <X className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  return <span className="h-4 w-4 rounded-full border-2 border-white/20 shrink-0" />;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">
          {label}
        </span>
        <span className="text-[10px] font-black text-white/60">{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#ccff00]/70"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
