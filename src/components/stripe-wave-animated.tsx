"use client";

import { useEffect, useRef } from "react";

/**
 * Animated Stripe-style "twirl" wave.
 *
 * Renders flowing, overlapping ribbon bands on a canvas — the moving cousin of
 * the static <StripeWave/> WebP fallback. Each band is a stack of sine waves
 * whose phase drifts over time, producing the silky twisted-ribbon motion
 * Stripe uses behind its hero.
 *
 * Respects prefers-reduced-motion (renders a single static frame) and pauses
 * when the tab is hidden or the element scrolls offscreen.
 */

type Band = {
  /** Vertical anchor as a fraction of canvas height (0..1). */
  baseY: number;
  amplitude: number;
  wavelength: number;
  speed: number;
  phase: number;
  thickness: number;
  colorStops: [string, string, string];
  opacity: number;
};

const BANDS: Band[] = [
  {
    baseY: 0.34,
    amplitude: 0.1,
    wavelength: 1.25,
    speed: 0.018,
    phase: 0,
    thickness: 0.28,
    colorStops: ["#3b82f6", "#8b5cf6", "#ccff00"],
    opacity: 0.5,
  },
  {
    baseY: 0.46,
    amplitude: 0.13,
    wavelength: 0.95,
    speed: -0.012,
    phase: 2.1,
    thickness: 0.22,
    colorStops: ["#8b5cf6", "#3b82f6", "#22d3ee"],
    opacity: 0.42,
  },
  {
    baseY: 0.58,
    amplitude: 0.09,
    wavelength: 1.55,
    speed: 0.022,
    phase: 4.3,
    thickness: 0.32,
    colorStops: ["#ccff00", "#22d3ee", "#8b5cf6"],
    opacity: 0.36,
  },
  {
    baseY: 0.3,
    amplitude: 0.16,
    wavelength: 0.7,
    speed: -0.009,
    phase: 1.2,
    thickness: 0.18,
    colorStops: ["#22d3ee", "#3b82f6", "#ccff00"],
    opacity: 0.24,
  },
];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function StripeWaveAnimated() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxOrNull = canvas.getContext("2d", { alpha: true });
    if (!ctxOrNull) return;
    // Bind to a non-null const so the nested draw/resize closures keep the
    // narrowed type (avoids "ctx is possibly null" across function boundaries).
    const ctx = ctxOrNull;

    const reduced = prefersReducedMotion();
    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect();
      width = rect?.width ?? window.innerWidth;
      height = rect?.height ?? window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawBand(band: Band, t: number) {
      const yBase = band.baseY * height;
      const amp = band.amplitude * height;
      const thickness = band.thickness * height;
      const k = (Math.PI * 2) / (band.wavelength * width);
      const drift = t * band.speed;

      // Build the centerline points across the width.
      const step = Math.max(8, Math.floor(width / 90));
      const top: Array<[number, number]> = [];
      const bottom: Array<[number, number]> = [];

      for (let x = -step; x <= width + step; x += step) {
        const wave =
          Math.sin(x * k + drift + band.phase) * amp +
          Math.sin(x * k * 0.5 - drift * 1.3 + band.phase * 1.7) * amp * 0.4;
        const y = yBase + wave;
        // Thickness tapers slightly with a secondary wave for the ribbon look.
        const tNorm =
          thickness *
          (0.7 + 0.3 * Math.sin(x * k * 0.7 + drift * 0.8 + band.phase));
        top.push([x, y - tNorm / 2]);
        bottom.push([x, y + tNorm / 2]);
      }

      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, band.colorStops[0]);
      grad.addColorStop(0.5, band.colorStops[1]);
      grad.addColorStop(1, band.colorStops[2]);

      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
      for (let i = bottom.length - 1; i >= 0; i--)
        ctx.lineTo(bottom[i][0], bottom[i][1]);
      ctx.closePath();

      ctx.globalAlpha = band.opacity;
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = grad;
      ctx.filter = "blur(22px)";
      ctx.fill();
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    function render(t: number) {
      ctx.clearRect(0, 0, width, height);
      for (const band of BANDS) drawBand(band, t);
    }

    resize();

    let rafId = 0;
    let running = true;
    let t = 0;

    function loop() {
      if (!running) return;
      t += 1;
      render(t);
      rafId = requestAnimationFrame(loop);
    }

    if (reduced) {
      // Single representative static frame.
      render(120);
    } else {
      loop();
    }

    // Pause when tab hidden to save battery.
    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafId);
      } else if (!reduced && !running) {
        running = true;
        loop();
      }
    }

    // Pause when the wave scrolls fully offscreen.
    let io: IntersectionObserver | null = null;
    if (canvas.parentElement && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!reduced && !running && !document.hidden) {
              running = true;
              loop();
            }
          } else {
            running = false;
            cancelAnimationFrame(rafId);
          }
        },
        { rootMargin: "0px" },
      );
      io.observe(canvas.parentElement);
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduced || !running) render(t || 120);
    });
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className="absolute top-0 right-0 w-full h-[100vh] pointer-events-none z-0 select-none overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to bottom, black 0%, black 78%, rgba(0,0,0,0.6) 90%, rgba(0,0,0,0.2) 97%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 0%, black 78%, rgba(0,0,0,0.6) 90%, rgba(0,0,0,0.2) 97%, transparent 100%)",
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
    </div>
  );
}

export default StripeWaveAnimated;
