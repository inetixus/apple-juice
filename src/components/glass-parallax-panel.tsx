"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useRef, type ReactNode } from "react";

export function GlassParallaxPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
      const py = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
      el.style.setProperty("--glass-tilt-x", `${px}deg`);
      el.style.setProperty("--glass-tilt-y", `${py}deg`);
    },
    [reduceMotion],
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--glass-tilt-x", "0deg");
    el.style.setProperty("--glass-tilt-y", "0deg");
  }, []);

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`glass-parallax-panel ${className}`}
      style={
        {
          "--glass-tilt-x": "0deg",
          "--glass-tilt-y": "0deg",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
