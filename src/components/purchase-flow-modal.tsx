"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldCheck, Upload, Check, Loader2, ExternalLink, AlertCircle } from "lucide-react";

const SHOP_URL = "https://www.roblox.com/games/9665609451/Apple-Juice-Shop";

type Plan = "fresh_pro" | "pure_ultra";

const PLAN_INFO: Record<Plan, { label: string; price: string }> = {
  fresh_pro: { label: "Fresh Pro", price: "600 R$ / month" },
  pure_ultra: { label: "Pure Ultra", price: "1,500 R$ / month" },
};

type Step = "age" | "adult" | "minor";

/**
 * Resize + compress an image File to a JPEG data URL under ~maxBytes so proof
 * screenshots stay small enough for KV storage and the request body cap.
 */
function compressImage(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unsupported"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImageDrop({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setBusy(true);
      try {
        const compressed = await compressImage(file);
        onChange(compressed);
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 block mb-1.5">
        {label}
      </label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full aspect-video rounded-xl border-2 border-dashed border-white/15 hover:border-[#ccff00]/50 bg-black/30 flex items-center justify-center overflow-hidden transition-all relative group"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="w-full h-full object-contain" />
        ) : busy ? (
          <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white/40 group-hover:text-white/60">
            <Upload className="w-6 h-6" />
            <span className="text-xs font-medium">Click to upload screenshot</span>
          </div>
        )}
        {value && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}

export function PurchaseFlowModal({
  plan,
  isLoggedIn,
  onClose,
}: {
  plan: Plan | null;
  isLoggedIn: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("age");
  const [username, setUsername] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const [purchaseProof, setPurchaseProof] = useState("");
  const [ownershipProof, setOwnershipProof] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!plan) return null;
  const info = PLAN_INFO[plan];

  async function submitRequest() {
    if (!username.trim()) {
      setResult({ ok: false, msg: "Enter your Roblox username." });
      return;
    }
    if (!purchaseProof || !ownershipProof) {
      setResult({ ok: false, msg: "Both screenshots are required." });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/subscription-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          robloxUsername: username.trim(),
          cancelled,
          purchaseProof,
          ownershipProof,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ ok: true, msg: data.message || "Submitted for review!" });
      } else {
        setResult({ ok: false, msg: data.error || "Submission failed." });
      }
    } catch {
      setResult({ ok: false, msg: "Network error. Try again." });
    } finally {
      setSubmitting(false);
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

          {/* Header */}
          <div className="mb-6">
            <div className="text-[#ccff00] text-xs font-bold uppercase tracking-wider font-mono">
              {info.label}
            </div>
            <h2 className="text-2xl font-black text-white mt-1">{info.price}</h2>
          </div>

          {/* STEP: age gate */}
          {step === "age" && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
                <ShieldCheck className="w-5 h-5 text-[#ccff00] mt-0.5 shrink-0" />
                <p className="text-sm text-white/70 leading-relaxed">
                  Roblox's shop experience is rated 16+. To make sure you get the
                  right purchase flow, please confirm your age.
                </p>
              </div>
              <p className="text-sm font-bold text-white">Are you 16 or older?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setStep("adult")}
                  className="py-3 rounded-xl bg-[#ccff00] text-black font-bold text-sm hover:bg-[#d4ff33] transition-all"
                >
                  Yes, I'm 16+
                </button>
                <button
                  onClick={() => setStep("minor")}
                  className="py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all"
                >
                  No, I'm under 16
                </button>
              </div>
            </div>
          )}

          {/* STEP: 16+ → redirect to shop */}
          {step === "adult" && (
            <div className="space-y-5">
              <p className="text-sm text-white/70 leading-relaxed">
                Great! You can purchase directly in the Apple Juice Shop on Roblox.
                After your purchase completes, install the{" "}
                <a href="/extension" className="text-[#ccff00] hover:underline">
                  browser extension
                </a>{" "}
                to auto-unlock your plan — or it'll activate in-game automatically.
              </p>
              <button
                onClick={() => {
                  window.open(SHOP_URL, "_blank");
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-[#ccff00] text-black font-bold text-sm hover:bg-[#d4ff33] transition-all flex items-center justify-center gap-2"
              >
                Open Apple Juice Shop
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={() => setStep("age")}
                className="w-full text-xs text-white/40 hover:text-white/70"
              >
                ← Back
              </button>
            </div>
          )}

          {/* STEP: under 16 → manual verification */}
          {step === "minor" && !result?.ok && (
            <div className="space-y-5">
              {!isLoggedIn && (
                <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>You need to sign in with Roblox first so we can link the plan to your account.</span>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 space-y-2">
                <p className="text-sm font-bold text-white">How to subscribe (under 16)</p>
                <ol className="text-xs text-white/60 leading-relaxed space-y-1.5 list-decimal pl-4">
                  <li>
                    Open the{" "}
                    <a
                      href="https://www.roblox.com/upgrades/redeem"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#ccff00] hover:underline"
                    >
                      subscription page
                    </a>{" "}
                    for {info.label} on Roblox and complete the purchase.
                  </li>
                  <li>Screenshot the purchase confirmation.</li>
                  <li>Screenshot your active subscription (showing you own it).</li>
                  <li>Fill in the form below and submit for review.</li>
                </ol>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-white/40 block mb-1.5">
                  Your Roblox Username
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. CoolBuilder123"
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#ccff00]/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ImageDrop
                  label="Purchase confirmation"
                  value={purchaseProof}
                  onChange={setPurchaseProof}
                />
                <ImageDrop
                  label="Active subscription"
                  value={ownershipProof}
                  onChange={setOwnershipProof}
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelled}
                  onChange={(e) => setCancelled(e.target.checked)}
                  className="w-4 h-4 accent-[#ccff00]"
                />
                <span className="text-xs text-white/60">
                  I've already cancelled the recurring subscription (recommended to
                  avoid auto-renew).
                </span>
              </label>

              {result && !result.ok && (
                <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{result.msg}</span>
                </div>
              )}

              <button
                onClick={submitRequest}
                disabled={submitting || !isLoggedIn}
                className="w-full py-3 rounded-xl bg-[#ccff00] text-black font-bold text-sm hover:bg-[#d4ff33] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit for Review"
                )}
              </button>
              <button
                onClick={() => setStep("age")}
                className="w-full text-xs text-white/40 hover:text-white/70"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Success */}
          {result?.ok && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-white font-bold">{result.msg}</p>
              <p className="text-sm text-white/50">
                You'll get {info.label} as soon as an admin reviews your proof.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10"
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
