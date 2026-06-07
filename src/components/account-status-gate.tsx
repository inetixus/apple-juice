"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Ban, Check, X, Loader2, PartyPopper } from "lucide-react";

type Ban = {
  reason: string;
  expiresAt: number | null;
  appealable: boolean;
  hasAppeal: boolean;
};
type AccountStatus = {
  ban: Ban | null;
  newWarnings: { reason: string; warnedAt: number }[];
  subscriptionDecision: { status: string; plan: string; note?: string } | null;
};

const PLAN_LABELS: Record<string, string> = {
  fresh_pro: "Fresh Pro",
  pure_ultra: "Pure Ultra",
};

/**
 * Polls /api/account/status once on mount and surfaces:
 *  - a full-screen BAN wall (with optional appeal form),
 *  - a big red WARNING popup (shows once — server marks acknowledged),
 *  - a subscription approved/rejected notice.
 * Renders nothing when there's nothing to show.
 */
export function AccountStatusGate({ enabled = true }: { enabled?: boolean }) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState(false);
  const [dismissedSub, setDismissedSub] = useState(false);

  // Appeal form
  const [appealText, setAppealText] = useState("");
  const [appealState, setAppealState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [appealMsg, setAppealMsg] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/account/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setStatus(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  async function sendAppeal() {
    if (appealText.trim().length < 10) {
      setAppealState("error");
      setAppealMsg("Please write a bit more.");
      return;
    }
    setAppealState("sending");
    try {
      const res = await fetch("/api/account/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: appealText.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAppealState("sent");
        setAppealMsg(data.message || "Appeal submitted.");
      } else {
        setAppealState("error");
        setAppealMsg(data.error || "Failed to submit appeal.");
      }
    } catch {
      setAppealState("error");
      setAppealMsg("Network error.");
    }
  }

  if (!status) return null;

  // ── BAN WALL (highest priority, blocks everything) ──
  if (status.ban) {
    const b = status.ban;
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-lg p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-lg bg-gradient-to-b from-[#1a0e0e] to-[#0d0708] border border-red-500/30 rounded-3xl p-8 text-center shadow-[0_0_60px_rgba(239,68,68,0.2)]"
        >
          <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
            <Ban className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Oops — you got banned</h1>
          <p className="text-white/50 text-sm mb-1">
            {b.expiresAt
              ? `Your access is suspended until ${new Date(b.expiresAt).toLocaleString()}.`
              : "Your account has been permanently banned."}
          </p>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 my-5 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-300/70 mb-1">
              Reason
            </p>
            <p className="text-sm text-white/80">{b.reason}</p>
          </div>

          {b.appealable ? (
            b.hasAppeal || appealState === "sent" ? (
              <div className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-4 text-sm text-white/60">
                <Check className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                {appealMsg || "Your appeal has been submitted and is under review."}
              </div>
            ) : (
              <div className="text-left space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-white/40">
                  Submit an appeal
                </p>
                <textarea
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="Explain why you think this ban should be lifted..."
                  rows={4}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400/50 resize-none"
                />
                {appealState === "error" && (
                  <p className="text-xs text-red-400">{appealMsg}</p>
                )}
                <button
                  onClick={sendAppeal}
                  disabled={appealState === "sending"}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {appealState === "sending" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    "Submit Appeal"
                  )}
                </button>
              </div>
            )
          ) : (
            <p className="text-xs text-white/30">This ban cannot be appealed.</p>
          )}
        </motion.div>
      </div>
    );
  }

  // ── WARNING popup ──
  const showWarning = status.newWarnings.length > 0 && !dismissedWarnings;
  // ── SUBSCRIPTION decision ──
  const showSub = status.subscriptionDecision && !dismissedSub;

  return (
    <AnimatePresence>
      {showWarning && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-gradient-to-b from-[#1a1208] to-[#0d0a07] border-2 border-red-500/50 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.25)]"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-1">
              {status.newWarnings.length > 1
                ? `You have ${status.newWarnings.length} warnings`
                : "You've received a warning"}
            </h2>
            <p className="text-white/50 text-sm mb-5">
              Please review the following from the moderation team:
            </p>
            <div className="space-y-2 text-left mb-6 max-h-52 overflow-y-auto">
              {status.newWarnings.map((w, i) => (
                <div
                  key={i}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                >
                  <p className="text-sm text-white/80">{w.reason}</p>
                  <p className="text-[10px] text-white/30 mt-1">
                    {new Date(w.warnedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setDismissedWarnings(true)}
              className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all"
            >
              I understand
            </button>
          </motion.div>
        </div>
      )}

      {!showWarning && showSub && status.subscriptionDecision && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={`relative w-full max-w-md rounded-3xl p-8 text-center border-2 ${
              status.subscriptionDecision.status === "approved"
                ? "bg-gradient-to-b from-[#0e1a0e] to-[#070d08] border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.2)]"
                : "bg-gradient-to-b from-[#1a0e0e] to-[#0d0708] border-red-500/40"
            }`}
          >
            <button
              onClick={() => setDismissedSub(true)}
              className="absolute top-4 right-4 text-white/30 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                status.subscriptionDecision.status === "approved"
                  ? "bg-emerald-500/15 border border-emerald-500/40"
                  : "bg-red-500/15 border border-red-500/40"
              }`}
            >
              {status.subscriptionDecision.status === "approved" ? (
                <PartyPopper className="w-8 h-8 text-emerald-400" />
              ) : (
                <X className="w-8 h-8 text-red-400" />
              )}
            </div>
            <h2 className="text-2xl font-black text-white mb-1">
              {status.subscriptionDecision.status === "approved"
                ? "Subscription approved! 🎉"
                : "Subscription not approved"}
            </h2>
            <p className="text-white/55 text-sm mb-5">
              {status.subscriptionDecision.status === "approved"
                ? `Your ${PLAN_LABELS[status.subscriptionDecision.plan] || status.subscriptionDecision.plan} plan is now active. Enjoy!`
                : `Your ${PLAN_LABELS[status.subscriptionDecision.plan] || status.subscriptionDecision.plan} request was rejected.`}
            </p>
            {status.subscriptionDecision.note && (
              <div className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 mb-5 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1">
                  Note from admin
                </p>
                <p className="text-sm text-white/70">{status.subscriptionDecision.note}</p>
              </div>
            )}
            <button
              onClick={() => setDismissedSub(true)}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                status.subscriptionDecision.status === "approved"
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-white/10 hover:bg-white/15 text-white"
              }`}
            >
              Got it
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
