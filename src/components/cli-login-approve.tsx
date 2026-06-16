"use client";

import { useEffect, useState } from "react";

/**
 * Client half of /cli-login. The user is already authenticated (server checked).
 * This POSTs the device code to /api/cli/login/approve, which binds the CLI's
 * session to this Roblox account. Shows success/failure so the user knows they
 * can return to the terminal.
 */
export function CliLoginApprove({
  deviceCode,
  username,
}: {
  deviceCode: string;
  username: string;
}) {
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Linking your CLI…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cli/login/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode }),
        });
        if (cancelled) return;
        if (res.ok) {
          setState("done");
          setMessage("Your CLI is now linked. You can return to the terminal.");
        } else {
          const body = await res.json().catch(() => ({}));
          setState("error");
          setMessage(body.error ?? "Could not link the CLI. The code may have expired.");
        }
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Network error while linking the CLI.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceCode]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="text-4xl mb-4">🍎</div>
        <h1 className="text-xl font-black mb-1">Apple Juice CLI</h1>
        <p className="text-sm text-white/50 mb-6">Signed in as {username}</p>

        {state === "working" && (
          <p className="text-sm text-[#ccff00]">{message}</p>
        )}
        {state === "done" && (
          <div className="space-y-2">
            <p className="text-sm text-[#ccff00] font-bold">✓ Linked</p>
            <p className="text-sm text-white/70">{message}</p>
          </div>
        )}
        {state === "error" && (
          <p className="text-sm text-red-400">{message}</p>
        )}
      </div>
    </main>
  );
}
