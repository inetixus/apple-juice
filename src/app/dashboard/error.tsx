"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary for the dashboard.
 *
 * Next.js renders this whenever a component below it throws during render.
 * Without it, an uncaught render error unmounts the whole app and the user
 * sees the platform "This page couldn't load" screen. This keeps the user in
 * the app and offers a one-click recovery instead.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for debugging without crashing the tab.
    console.error("[AppleJuice] Dashboard render error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0c] text-white p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20 flex items-center justify-center mb-5">
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#ccff00]" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
      </div>
      <h1 className="text-lg font-bold tracking-tight">Something hiccuped</h1>
      <p className="text-sm text-white/50 mt-2 max-w-sm">
        The chat ran into an unexpected error, but your session is still active.
        Try again — your projects and messages are safe.
      </p>
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl bg-[#ccff00] text-black font-bold text-sm hover:scale-105 active:scale-95 transition-all"
        >
          Try again
        </button>
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.location.href = "/dashboard";
          }}
          className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 font-bold text-sm hover:bg-white/10 transition-all"
        >
          Reload dashboard
        </button>
      </div>
    </div>
  );
}
