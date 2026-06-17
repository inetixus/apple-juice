"use client";

import { useCallback, useEffect, useState } from "react";
import {
  detectRuntime,
  pairRuntime,
  runtimeDownloadUrl,
  detectOS,
  isRuntimeAvailable,
  RUNTIME_RELEASES_PAGE,
  RUNTIME_VIRUSTOTAL_URL,
  RUNTIME_TOKEN_KEY,
  RUNTIME_BASE_KEY,
  RUNTIME_EVER_KEY,
  type RuntimeOS,
  type RuntimeHealth,
} from "@/lib/runtime-client";

type Phase = "detecting" | "not-found" | "found" | "pairing" | "paired" | "error";

const OS_LABEL: Record<RuntimeOS, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

export function ConnectRuntime() {
  const [phase, setPhase] = useState<Phase>("detecting");
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [os, setOs] = useState<RuntimeOS>("windows");

  useEffect(() => {
    setOs(detectOS());
  }, []);

  const probe = useCallback(async () => {
    setPhase("detecting");
    setError("");
    const h = await detectRuntime();
    if (h) {
      setHealth(h);
      setPhase("found");
    } else {
      setPhase("not-found");
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  const submitCode = async () => {
    if (!health) return;
    setPhase("pairing");
    setError("");
    const r = await pairRuntime(health.baseUrl, code.trim());
    if (r.ok && r.token) {
      try {
        localStorage.setItem(RUNTIME_TOKEN_KEY, r.token);
        localStorage.setItem(RUNTIME_BASE_KEY, health.baseUrl);
        localStorage.setItem(RUNTIME_EVER_KEY, "1");
      } catch {
        /* storage may be blocked; pairing still valid for this tab */
      }
      setPhase("paired");
    } else {
      setError(r.error ?? "Pairing failed. Check the code and try again.");
      setPhase("found");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8">
        <div className="text-4xl mb-3 text-center">🍎</div>
        <h1 className="text-xl font-black text-center mb-1">Connect Apple Juice Runtime</h1>
        <p className="text-sm text-white/50 text-center mb-6">
          The Runtime runs the AI locally against Roblox Studio&apos;s official tools —
          fastest, full toolset. Optional: the app works without it.
        </p>

        {phase === "detecting" && (
          <p className="text-center text-sm text-[#ccff00]">Looking for the Runtime…</p>
        )}

        {phase === "not-found" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-white/70">
              No local Runtime detected. Install and start it, then retry.
            </p>
            {isRuntimeAvailable(os) ? (
              <a
                href={runtimeDownloadUrl(os)}
                className="inline-block w-full h-12 leading-[3rem] rounded-full bg-[#ccff00] text-black font-black uppercase text-[12px] tracking-wider hover:bg-[#d4ff33] transition"
              >
                Download the Runtime ({OS_LABEL[os]})
              </a>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-amber-300/90">
                  The {OS_LABEL[os]} build isn&apos;t out yet — only Windows is available
                  right now.
                </p>
                <a
                  href={runtimeDownloadUrl("windows")}
                  className="inline-block w-full h-12 leading-[3rem] rounded-full bg-[#ccff00] text-black font-black uppercase text-[12px] tracking-wider hover:bg-[#d4ff33] transition"
                >
                  Download for Windows
                </a>
              </div>
            )}
            <p className="text-xs text-white/40">
              Tiny 400&nbsp;KB native app — no installer, no dependencies. Verify it&apos;s
              clean on{" "}
              <a
                href={RUNTIME_VIRUSTOTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#ccff00] underline underline-offset-2 hover:text-[#d4ff33]"
              >
                VirusTotal
              </a>
              {" · "}
              <a
                href={RUNTIME_RELEASES_PAGE}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 underline underline-offset-2 hover:text-white"
              >
                all downloads
              </a>
              .
            </p>
            <button
              onClick={probe}
              className="w-full h-11 rounded-full border border-white/15 text-sm hover:bg-white/5 transition"
            >
              Retry detection
            </button>
            <p className="text-xs text-white/40">
              You can keep using the cloud version meanwhile — no install required.
            </p>
          </div>
        )}

        {(phase === "found" || phase === "pairing") && (
          <div className="space-y-4">
            <div className="text-xs text-white/50 text-center">
              Runtime found{health?.mcpInstalled ? "" : " — note: Roblox Studio MCP not detected"}.
              Enter the 6-digit pair code shown in the Runtime window.
            </div>
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full h-14 rounded-xl bg-black/40 border border-white/15 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-[#ccff00]"
            />
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            <button
              onClick={submitCode}
              disabled={code.length !== 6 || phase === "pairing"}
              className="w-full h-12 rounded-full bg-[#ccff00] text-black font-black uppercase text-[12px] tracking-wider disabled:opacity-50 hover:bg-[#d4ff33] transition"
            >
              {phase === "pairing" ? "Pairing…" : "Pair"}
            </button>
          </div>
        )}

        {phase === "paired" && (
          <div className="text-center space-y-2">
            <p className="text-[#ccff00] font-bold">✓ Connected</p>
            <p className="text-sm text-white/70">
              This browser is now linked to your local Runtime. Prompts will run
              locally at native speed with the full official toolset.
            </p>
            <a
              href="/dashboard"
              className="inline-block mt-3 w-full h-12 leading-[3rem] rounded-full bg-[#ccff00] text-black font-black uppercase text-[12px] tracking-wider hover:bg-[#d4ff33] transition"
            >
              Go to Dashboard
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
