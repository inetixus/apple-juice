"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor-interactive ray burst.
 *
 * A fan of rays sprays upward from the bottom-center of its container, coloured
 * orange at the core fading to blue at the edges, with dotted tips. As the
 * pointer moves, rays near the cursor swing toward it, stretch, and brighten —
 * so the whole fan visibly leans and flows with the mouse.
 *
 * Self-contained on a <canvas>. Respects prefers-reduced-motion (static frame)
 * and pauses when the tab is hidden or the element scrolls offscreen.
 *
 * Perf: ray colours are precomputed once and the base fade is applied with a
 * single cached radial gradient via `destination-out` — no per-frame gradient
 * allocations, so it stays smooth even on a busy page.
 */

type Ray = {
  angle: number;
  baseMaxLen: number;
  width: number;
  speed: number;
  phase: number;
  edge: number;
  dot: boolean;
  react: number;
  swing: number;
  color: string;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function rayColor(edge: number, alpha: number) {
  // orange (255,150,60) core -> blue (70,100,245) edges
  const r = Math.round(lerp(255, 70, edge));
  const g = Math.round(lerp(150, 100, edge));
  const b = Math.round(lerp(60, 245, edge));
  return `rgba(${r},${g},${b},${alpha})`;
}

export function RayBurstCursor({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxOrNull = canvas.getContext("2d", { alpha: true });
    if (!ctxOrNull) return;
    // Bind to a non-null const so the nested render/resize closures keep the
    // narrowed type (avoids "ctx is possibly null" across function boundaries).
    const ctx = ctxOrNull;

    const reduced = prefersReducedMotion();
    let W = 0;
    let H = 0;
    let dpr = 1;
    let originX = 0;
    let originY = 0;
    let rays: Ray[] = [];
    let fadeGrad: CanvasGradient | null = null;

    // Pointer in CSS pixels relative to the canvas. Default aim: straight up.
    const pointer = { x: 0, y: 0, active: false };
    let aimAngle = -Math.PI / 2;
    let aimStrength = 0;

    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect();
      W = Math.max(rect?.width ?? window.innerWidth, 320);
      H = Math.max(rect?.height ?? 420, 240);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      originX = W / 2;
      originY = H * 1.02;

      // Cached base-fade mask: opaque at the origin, transparent further out.
      // Applied once per frame with `destination-out` so ray roots fade to
      // nothing without per-ray gradients.
      const fadeRadius = Math.min(W, H) * 0.34;
      fadeGrad = ctx.createRadialGradient(
        originX,
        originY,
        0,
        originX,
        originY,
        fadeRadius,
      );
      fadeGrad.addColorStop(0, "rgba(0,0,0,1)");
      fadeGrad.addColorStop(0.55, "rgba(0,0,0,0.55)");
      fadeGrad.addColorStop(1, "rgba(0,0,0,0)");
    }

    function makeRays() {
      rays = [];
      // Fewer rays than before (170 -> 120) — combined with no per-frame
      // gradient work this is dramatically cheaper while looking just as dense.
      const count = 120;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const spread = (104 * Math.PI) / 180;
        let angle = -Math.PI / 2 + (t - 0.5) * 2 * spread;
        angle += (Math.random() - 0.5) * 0.05;
        const maxLen = Math.min(W, H) * 0.55 * (0.45 + Math.random() * 0.55);
        const edge = Math.abs(t - 0.5) * 2;
        rays.push({
          angle,
          baseMaxLen: maxLen,
          width: 0.6 + Math.random() * 1.6,
          speed: 0.4 + Math.random() * 0.9,
          phase: Math.random() * Math.PI * 2,
          edge,
          dot: Math.random() > 0.45,
          react: 0,
          swing: 0,
          color: rayColor(edge, 1),
        });
      }
    }

    function onPointerMove(e: PointerEvent | MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active =
        pointer.x >= -120 &&
        pointer.y >= -200 &&
        pointer.x <= rect.width + 120 &&
        pointer.y <= rect.height + 200;
    }

    const t0 = performance.now();

    function render(now: number) {
      const time = (now - t0) / 1000;

      const dx = pointer.x - originX;
      const dy = pointer.y - originY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let targetAngle = Math.atan2(dy, dx);
      // Keep the steering inside the upper hemisphere where the rays live.
      if (targetAngle > 0) targetAngle = targetAngle > Math.PI / 2 ? -Math.PI : 0;
      // Reach full strength sooner so the fan reacts even to small movements.
      const targetStrength = pointer.active
        ? Math.min(1, dist / (Math.min(W, H) * 0.45))
        : 0;

      // Snappier follow than before (0.08/0.06 -> 0.16/0.12).
      aimAngle += angleDiff(targetAngle, aimAngle) * 0.16;
      aimStrength += (targetStrength - aimStrength) * 0.12;

      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";

      const reach = (60 * Math.PI) / 180; // wider influence cone
      for (let i = 0; i < rays.length; i++) {
        const ray = rays[i];
        const signed = angleDiff(aimAngle, ray.angle);
        const diff = Math.abs(signed);
        let alignment = Math.max(0, 1 - diff / reach);
        alignment *= alignment;
        const drive = alignment * aimStrength;
        ray.react += (drive - ray.react) * 0.16;

        // Angular swing: rays actually bend toward the cursor (this is the
        // "move them around" feel that was missing). Capped so they never cross.
        const targetSwing = signed * alignment * aimStrength * 0.55;
        ray.swing += (targetSwing - ray.swing) * 0.16;
        const drawAngle = ray.angle + ray.swing;

        const pulse = 0.78 + 0.22 * Math.sin(time * ray.speed + ray.phase);
        const len = ray.baseMaxLen * pulse * (1 + ray.react * 1.15);
        const ex = originX + Math.cos(drawAngle) * len;
        const ey = originY + Math.sin(drawAngle) * len;

        const boost = ray.react;
        ctx.globalAlpha = 0.5 + boost * 0.5;
        ctx.strokeStyle = ray.color;
        ctx.lineWidth = ray.width * (1 + boost * 0.7);
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        if (ray.dot) {
          ctx.globalAlpha = 0.7 + boost * 0.3;
          ctx.beginPath();
          ctx.fillStyle = ray.color;
          ctx.arc(ex, ey, ray.width * (1.4 + boost * 1.3) + 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Carve the soft base fade with the single cached gradient.
      ctx.globalAlpha = 1;
      if (fadeGrad) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
      }
    }

    resize();
    makeRays();

    let rafId = 0;
    let running = true;

    function loop(now: number) {
      if (!running) return;
      render(now);
      rafId = requestAnimationFrame(loop);
    }

    if (reduced) {
      render(t0 + 800);
    } else {
      rafId = requestAnimationFrame(loop);
    }

    // Track the pointer at the window level so the rays react even though the
    // canvas itself is pointer-events:none.
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onPointerMove, { passive: true });

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafId);
      } else if (!reduced && !running) {
        running = true;
        rafId = requestAnimationFrame(loop);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    let io: IntersectionObserver | null = null;
    if (canvas.parentElement && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!reduced && !running && !document.hidden) {
              running = true;
              rafId = requestAnimationFrame(loop);
            }
          } else {
            running = false;
            cancelAnimationFrame(rafId);
          }
        },
        { rootMargin: "200px" },
      );
      io.observe(canvas.parentElement);
    }

    const resizeObserver = new ResizeObserver(() => {
      resize();
      makeRays();
      if (reduced || !running) render(t0 + 800);
    });
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden
      />
    </div>
  );
}

export default RayBurstCursor;
