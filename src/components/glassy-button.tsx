"use client";

/*
 * GlassyButton — native glassmorphism button.
 *
 * A self-contained reimplementation of the Framer "Glassy button" asset
 * (https://www.framer.com/asset-urls). The original ships as a Framer-runtime
 * ESM module that imports the proprietary `framer` package and CDN-hosted
 * shaders, so it can't be dropped into this Next.js build directly. This
 * version recreates the look — frosted blur, layered highlight + inner glow,
 * subtle press/hover motion — using framer-motion (already a dependency) and
 * inline styles, with no external runtime requirements.
 */

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  forwardRef,
  useCallback,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export type GlassyButtonProps = {
  children: ReactNode;
  className?: string;
  as?: "button" | "a";
  /** Accent tint of the glass + glow. Defaults to the Apple Juice lime. */
  accent?: string;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"
> &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"
  >;

const BASE_STYLE: React.CSSProperties = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  padding: "0.75rem 1.5rem",
  borderRadius: "9999px",
  fontWeight: 600,
  fontSize: "0.95rem",
  lineHeight: 1,
  color: "rgba(255,255,255,0.96)",
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.18)",
  WebkitBackdropFilter: "blur(14px) saturate(180%)",
  backdropFilter: "blur(14px) saturate(180%)",
  overflow: "hidden",
  userSelect: "none",
  textDecoration: "none",
  isolation: "isolate",
};

export const GlassyButton = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  GlassyButtonProps
>(function GlassyButton(
  { children, className = "", as = "button", accent = "rgba(204,255,0,0.55)", style, ...rest },
  ref,
) {
  const reduceMotion = useReducedMotion();
  // Pointer-tracked spotlight position (0–100%).
  const px = useMotionValue(50);
  const py = useMotionValue(50);
  const spotlight = useMotionTemplate`radial-gradient(120px circle at ${px}% ${py}%, rgba(255,255,255,0.22), transparent 65%)`;

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (reduceMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      px.set(((e.clientX - rect.left) / rect.width) * 100);
      py.set(((e.clientY - rect.top) / rect.height) * 100);
    },
    [reduceMotion, px, py],
  );

  const onPointerLeave = useCallback(() => {
    px.set(50);
    py.set(50);
  }, [px, py]);

  const mergedStyle: React.CSSProperties = {
    ...BASE_STYLE,
    background: `linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)), ${accent.replace(/[\d.]+\)$/, "0.10)")}`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.25), 0 8px 24px -8px ${accent}`,
    ...style,
  };

  // Decorative layers shared by both element types.
  const layers = (
    <>
      {/* pointer spotlight */}
      <motion.span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background: spotlight,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* top glass highlight */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 45%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
        {children}
      </span>
    </>
  );

  const interaction = {
    onPointerMove,
    onPointerLeave,
    whileHover: reduceMotion ? undefined : { scale: 1.03, y: -1 },
    whileTap: reduceMotion ? undefined : { scale: 0.97 },
    transition: { type: "spring" as const, stiffness: 400, damping: 26 },
    style: mergedStyle,
    className,
  };

  if (as === "a") {
    const {
      type: _t,
      onAnimationStart: _oas,
      onDrag: _od,
      onDragStart: _ods,
      onDragEnd: _ode,
      ...anchorRest
    } = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <motion.a ref={ref as React.Ref<HTMLAnchorElement>} {...interaction} {...anchorRest}>
        {layers}
      </motion.a>
    );
  }

  const {
    onAnimationStart: _oas,
    onDrag: _od,
    onDragStart: _ods,
    onDragEnd: _ode,
    ...buttonRest
  } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <motion.button ref={ref as React.Ref<HTMLButtonElement>} {...interaction} {...buttonRest}>
      {layers}
    </motion.button>
  );
});
