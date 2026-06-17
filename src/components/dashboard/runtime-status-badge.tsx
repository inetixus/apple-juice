"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cpu, Download, Zap } from "lucide-react";
import { detectRuntime, RUNTIME_TOKEN_KEY, RUNTIME_EVER_KEY } from "@/lib/runtime-client";

/**
 * Dashboard runtime status badge.
 *
 * Always-visible indicator of the local Apple Juice Runtime (the optional .exe
 * that runs the AI locally against Roblox Studio's official tools at native
 * speed). It also serves as the discoverability surface: a user who has never
 * installed it is invited to do so; everything links to /connect.
 *
 * States:
 *   connected  — runtime detected AND this browser is paired (token stored)
 *   found      — runtime detected but not yet paired here
 *   offline    — paired before, but not currently running
 *   install    — never connected: invite to install
 *
 * NOTE: probing http://127.0.0.1 from an https page is subject to mixed-content
 * / Private Network Access rules and may fail closed in production until the
 * TLS-on-loopback path ships. When detection can't reach the runtime, we fall
 * back to "offline" (if seen before) or "install" — never a false "connected".
 */

type State = "checking" | "connected" | "found" | "offline" | "install";

export function RuntimeStatusBadge() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let alive = true;

    const read = (key: string): string | null => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    };

    const check = async () => {
      const hasToken = !!read(RUNTIME_TOKEN_KEY);
      const everConnected = !!read(RUNTIME_EVER_KEY);
      const health = await detectRuntime();
      if (!alive) return;

      if (health) {
        setState(hasToken ? "connected" : "found");
      } else if (everConnected || hasToken) {
        setState("offline");
      } else {
        setState("install");
      }
    };

    void check();
    const id = setInterval(check, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10">
        <Cpu className="w-3 h-3 text-white/30 animate-pulse" />
        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
          Runtime…
        </span>
      </div>
    );
  }

  const config = {
    connected: {
      cls: "bg-[#ccff00]/10 border-[#ccff00]/25 text-[#ccff00]",
      dot: "bg-[#ccff00] shadow-[0_0_8px_#ccff00] animate-pulse",
      icon: <Zap className="w-3 h-3" />,
      label: "Runtime Connected",
      title: "Local Runtime connected — AI runs at native speed.",
    },
    found: {
      cls: "bg-amber-400/10 border-amber-400/25 text-amber-300",
      dot: "bg-amber-400",
      icon: <Cpu className="w-3 h-3" />,
      label: "Runtime — Pair Now",
      title: "Runtime is running on this machine but not paired. Click to pair.",
    },
    offline: {
      cls: "bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70",
      dot: "bg-white/30",
      icon: <Cpu className="w-3 h-3" />,
      label: "Runtime Offline",
      title: "Runtime isn't running. Start the app, then it reconnects.",
    },
    install: {
      cls: "bg-blue-500/10 border-blue-400/25 text-blue-300 hover:bg-blue-500/20",
      dot: "bg-blue-400",
      icon: <Download className="w-3 h-3" />,
      label: "Get the Runtime",
      title: "Install the optional local Runtime for native-speed, full-tool AI.",
    },
  }[state];

  return (
    <Link
      href="/connect"
      title={config.title}
      className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-colors ${config.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.icon}
      <span className="text-[9px] font-black uppercase tracking-widest">{config.label}</span>
    </Link>
  );
}

export default RuntimeStatusBadge;
