"use client";

/**
 * Static spine line (scroll-linked motion disabled for landing performance).
 */
export function ScrollLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 z-[1] pointer-events-none ${className}`}
      aria-hidden
      style={{
        background:
          "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.1) 12%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.1) 88%, transparent 100%)",
      }}
    />
  );
}
