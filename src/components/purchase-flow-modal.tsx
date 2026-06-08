"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2, ExternalLink, AlertCircle } from "lucide-react";

type Plan = "fresh_pro" | "pure_ultra";

const PLAN_INFO: Record<Plan, { label: string; price: string; subUrl: string }> = {
  fresh_pro: {
    label: "Fresh Pro",
    price: "600 R$ / month",
    // Roblox subscription purchase page. Replace with your real subscription URLs.
    subUrl: "https://www.roblox.com/games/9665609451/Apple-Juice#subscriptions",
  },
  pure_ultra: {
    label: "Pure Ultra",
    price: "1,500 R$ / month",
    subUrl: "https://www.roblox.com/games/9665609451/Apple-Juice#subscriptions",
  },
};

/**
 * Subscription purchase + verify flow. The user buys on Roblox (the payment
 * processor), then we confirm it via the official Open Cloud subscription API —
 * no screenshots, no extension, no manual review.
 */
export function PurchaseFlowModal({
  plan,
  isLoggedIn,
  onClose,
}: {
  plan: Plan | null;
  isLoggedIn: boolean;
  onClose: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!plan) return null;
  const info = PLAN_INFO[plan];

  async function verify() {
    setVerifying(true);
    setResult(null);
    try {
      const res = await fetch("/api/verify-subscription", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.active) {
        setResult({ ok: true, msg: data.message || "Subscription verified!" });
      } else if (res.ok) {
        setResult({
          ok: false,
          msg: data.message || "No active subscription found yet. If you just subscribed, wait a few seconds and try again.",
        });
      } else {
        setResult({ ok: false, msg: data.error || "Verification failed." });
      }
    } catch {
      setResult({ ok: false, msg: "Network error. Try again." });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[400] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-lg bg-[#0d0e12] border border-white/10 rounded-3xl p-8 shadow-2xl my-8"
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-6">
            <div className="text-[#ccff00] text-xs font-bold uppercase tracking-wider font-mono">
              {info.label}
            </div>
            <h2 className="text-2xl font-black text-white mt-1">{info.price}</h2>
          </div>

          {!result?.ok ? (
            <div className="space-y-5">
              {!isLoggedIn && (
                <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Sign in with Roblox first so we can link the subscription to your account.</span>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-2">
                <p className="text-sm font-bold text-white">How it works</p>
                <ol className="text-xs text-white/60 leading-relaxed space-y-1.5 list-decimal pl-4">
                  <li>Subscribe to {info.label} on Roblox (Roblox handles payment securely).</li>
                  <li>Come back here and click <span className="text-[#ccff00] font-semibold">Verify</span>.</li>
                  <li>We confirm it instantly with Roblox and activate your plan — no codes, no screenshots.</li>
                </ol>
              </div>

              <a
                href={info.subUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                Subscribe on Roblox
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                onClick={verify}
                disabled={verifying || !isLoggedIn}
                className="w-full py-3 rounded-xl bg-[#ccff00] text-black font-bold text-sm hover:bg-[#d4ff33] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  "I subscribed — Verify"
                )}
              </button>

              {result && !result.ok && (
                <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{result.msg}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-white font-bold">{result.msg}</p>
              <p className="text-sm text-white/50">Your {info.label} plan is now active. Enjoy! 🧃</p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#ccff00] text-black font-bold text-sm hover:bg-[#d4ff33]"
              >
                Done
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
