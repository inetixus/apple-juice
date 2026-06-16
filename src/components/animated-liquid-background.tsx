"use client";

/*
 * AnimatedLiquidBackground — native animated gradient backdrop.
 *
 * Reimplements the Framer "AnimatedLiquidBackground_Prod" asset
 * (https://www.framer.com/asset-urls). The original is a Framer-runtime ESM
 * module backed by a WebGL warp shader loaded from Framer's CDN (imports from
 * the proprietary `framer` package + `https://framer.com/m/...`), which can't
 * be bundled into this Next.js app. This version recreates the same family of
 * presets (Lava, Plasma, Prism, Pulse, Vortex, Mist) as a self-contained
 * Canvas 2D animation: layered radial blobs drift and swirl, blurred into a
 * smooth liquid field. No external runtime, respects reduced-motion, and
 * pauses when offscreen.
 */

import { useEffect, useRef } from "react";
import { useInView } from "@/hooks/use-in-view";
import { prefersReducedMotion } from "@/lib/landing-perf";

export type LiquidPreset =
  | "Lava"
  | "Plasma"
  | "Prism"
  | "Pulse"
  | "Vortex"
  | "Mist";

type PresetDef = {
  colors: [string, string, string];
  /** Animation speed multiplier. */
  speed: number;
  /** Swirl intensity (orbit radius of each blob). */
  swirl: number;
};

const PRESETS: Record<LiquidPreset, PresetDef> = {
  Lava: { colors: ["#FF9F21", "#FF0303", "#000000"], speed: 0.6, swirl: 0.18 },
  Plasma: { colors: ["#B566FF", "#1a0033", "#000000"], speed: 0.6, swirl: 0.61 },
  Prism: { colors: ["#050505", "#66B3FF", "#FFFFFF"], speed: 0.6, swirl: 0.5 },
  Pulse: { colors: ["#66FF85", "#02160a", "#000000"], speed: 0.4, swirl: 0.75 },
  Vortex: { colors: ["#000000", "#FFFFFF", "#000000"], speed: 0.4, swirl: 1.0 },
  Mist: { colors: ["#050505", "#FF66B8", "#050505"], speed: 0.78, swirl: 0.65 },
};

type Blob = {
  baseX: number;
  baseY: number;
  orbit: number;
  phase: number;
  freq: number;
  radius: number;
  color: string;
};

export type AnimatedLiquidBackgroundProps = {
  preset?: LiquidPreset;
  /** Border radius in px. */
  radius?: number;
  /** Overlay grain opacity 0–1. */
  grain?: number;
  className?: string;
  style?: React.CSSProperties;
};

function buildBlobs(preset: PresetDef): Blob[] {
  const blobs: Blob[] = [];
  // Three color stops, a few blobs each, spread across the field.
  const anchors = [
    [0.25, 0.3],
    [0.75, 0.35],
    [0.5, 0.7],
    [0.2, 0.8],
    [0.85, 0.75],
    [0.5, 0.2],
  ];
  for (let i = 0; i < anchors.length; i++) {
    const [ax, ay] = anchors[i];
    blobs.push({
      baseX: ax,
      baseY: ay,
      orbit: preset.swirl * (0.12 + (i % 3) * 0.05),
      phase: (i / anchors.length) * Math.PI * 2,
      freq: 0.4 + (i % 3) * 0.18,
      radius: 0.45 + (i % 2) * 0.18,
      color: preset.colors[i % 3],
    });
  }
  return blobs;
}

export function AnimatedLiquidBackground({
  preset = "Lava",
  radius = 0,
  grain = 0.12,
  className = "",
  style,
}: AnimatedLiquidBackgroundProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inView = useInView(wrapRef, { threshold: 0.05, rootMargin: "100px 0px" });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const def = PRESETS[preset] ?? PRESETS.Lava;
    const blobs = buildBlobs(def);
    const reduce = prefersReducedMotion();

    let raf = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      const time = (t / 1000) * def.speed;
      // Base fill (darkest stop) so gaps read as deep background.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = def.colors[2] || "#000000";
      ctx.fillRect(0, 0, width, height);

      // Soft blur + additive-ish blending for the liquid melt.
      ctx.filter = `blur(${Math.round(Math.min(width, height) * 0.08)}px)`;
      ctx.globalCompositeOperation = "lighter";

      const minDim = Math.min(width, height);
      for (const b of blobs) {
        const cx =
          (b.baseX + Math.cos(time * b.freq + b.phase) * b.orbit) * width;
        const cy =
          (b.baseY + Math.sin(time * b.freq * 1.15 + b.phase) * b.orbit) *
          height;
        const r = b.radius * minDim;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, b.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";

      if (!reduce && inView) {
        raf = requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduce || !inView) {
      // Single static frame.
      draw(0);
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [preset, inView]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      {grain > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              'url("https://framerusercontent.com/images/g0QcWrxr87K0ufOxIUFBakwYA8.png")',
            backgroundSize: 200,
            backgroundRepeat: "repeat",
            opacity: grain,
            pointerEvents: "none",
            mixBlendMode: "overlay",
          }}
        />
      )}
    </div>
  );
}
