"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor-reactive flipping-tile background.
 *
 * Renders a responsive grid of 3D tiles. As the pointer moves across the
 * surface, nearby tiles flip on the X axis to reveal a glowing accent back
 * face, with the flip strength falling off smoothly with distance — so a soft
 * "wave" of flipped tiles trails the cursor.
 *
 * Built as a pure background layer (pointer-events: none): drop it behind any
 * section with `absolute inset-0`. Performance notes:
 *  - Pointer state lives in refs; the animation loop writes `transform` /
 *    opacity straight to each tile node, so React never re-renders per frame.
 *  - Tiles are plain divs with `backface-visibility:hidden` faces, GPU-composited.
 *  - Pauses when offscreen or the tab is hidden; respects reduced-motion.
 */

type FlipTileGridProps = {
  className?: string;
  style?: React.CSSProperties;
  /** Approximate tile edge in px. Default 76. */
  tileSize?: number;
  /** Gap between tiles in px. Default 10. */
  gap?: number;
  /** Radius of cursor influence in px. Default 220. */
  radius?: number;
  /** Front face color (rest). */
  faceColor?: string;
  /** Back face accent color (revealed on flip). */
  accentColor?: string;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FlipTileGrid({
  className,
  style,
  tileSize = 116,
  gap = 8,
  radius = 260,
  faceColor = "rgba(255,255,255,0.025)",
  accentColor = "#ccff00",
}: FlipTileGridProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = prefersReducedMotion();

    type Tile = {
      el: HTMLDivElement;
      cx: number;
      cy: number;
      flip: number; // current eased flip 0..1
      glow: HTMLDivElement;
    };

    let tiles: Tile[] = [];
    let cols = 0;
    let rows = 0;
    const pointer = { x: -9999, y: -9999, active: false };

    function build() {
      if (!host) return;
      host.innerHTML = "";
      tiles = [];
      const rect = host.getBoundingClientRect();
      const cell = tileSize + gap;
      cols = Math.max(1, Math.ceil(rect.width / cell) + 1);
      rows = Math.max(1, Math.ceil(rect.height / cell) + 1);

      const grid = document.createElement("div");
      grid.style.position = "absolute";
      grid.style.inset = "0";
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = `repeat(${cols}, ${tileSize}px)`;
      grid.style.gridAutoRows = `${tileSize}px`;
      grid.style.gap = `${gap}px`;
      grid.style.justifyContent = "center";
      grid.style.alignContent = "center";
      grid.style.perspective = "900px";

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cellEl = document.createElement("div");
          cellEl.style.position = "relative";
          cellEl.style.transformStyle = "preserve-3d";
          cellEl.style.transformOrigin = "center";
          cellEl.style.willChange = "transform";
          cellEl.style.borderRadius = "6px";

          // Front face (subtle glass).
          const front = document.createElement("div");
          front.style.position = "absolute";
          front.style.inset = "0";
          front.style.borderRadius = "6px";
          front.style.background = faceColor;
          front.style.border = "1px solid rgba(255,255,255,0.05)";
          front.style.backfaceVisibility = "hidden";
          (front.style as CSSStyleDeclaration & { webkitBackfaceVisibility?: string }).webkitBackfaceVisibility =
            "hidden";

          // Back face (accent), pre-rotated so it shows once flipped.
          const back = document.createElement("div");
          back.style.position = "absolute";
          back.style.inset = "0";
          back.style.borderRadius = "6px";
          back.style.background = `linear-gradient(135deg, ${accentColor}, rgba(139,92,246,0.9))`;
          back.style.border = `1px solid ${accentColor}`;
          back.style.transform = "rotateX(180deg)";
          back.style.backfaceVisibility = "hidden";
          (back.style as CSSStyleDeclaration & { webkitBackfaceVisibility?: string }).webkitBackfaceVisibility =
            "hidden";

          // Soft glow under the tile, fades in with flip.
          const glow = document.createElement("div");
          glow.style.position = "absolute";
          glow.style.inset = "-30%";
          glow.style.borderRadius = "8px";
          glow.style.background = `radial-gradient(circle, ${accentColor}55, transparent 70%)`;
          glow.style.opacity = "0";
          glow.style.pointerEvents = "none";
          glow.style.filter = "blur(8px)";

          cellEl.appendChild(glow);
          cellEl.appendChild(back);
          cellEl.appendChild(front);
          grid.appendChild(cellEl);

          tiles.push({ el: cellEl, cx: 0, cy: 0, flip: 0, glow });
        }
      }

      host.appendChild(grid);
      measure();
    }

    function measure() {
      const hostRect = host!.getBoundingClientRect();
      for (const t of tiles) {
        const r = t.el.getBoundingClientRect();
        t.cx = r.left - hostRect.left + r.width / 2;
        t.cy = r.top - hostRect.top + r.height / 2;
      }
    }

    function onPointerMove(e: PointerEvent | MouseEvent) {
      const rect = host!.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active =
        e.clientX >= rect.left - radius &&
        e.clientX <= rect.right + radius &&
        e.clientY >= rect.top - radius &&
        e.clientY <= rect.bottom + radius;
    }

    const r2 = radius * radius;

    function frame() {
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        let target = 0;
        if (pointer.active) {
          const dx = t.cx - pointer.x;
          const dy = t.cy - pointer.y;
          const d2 = dx * dx + dy * dy;
          // Any tile within range flips the FULL 180°. Distance only governs
          // how fast it gets there (closer = snappier), which keeps the soft
          // trailing wave while guaranteeing complete flips.
          if (d2 < r2) target = 1;
        }
        const dist = pointer.active
          ? Math.sqrt(
              (t.cx - pointer.x) * (t.cx - pointer.x) +
                (t.cy - pointer.y) * (t.cy - pointer.y),
            )
          : radius;
        const proximity = Math.max(0, 1 - dist / radius); // 0..1, near = 1
        // Ease speed scales with proximity so close tiles flip almost instantly
        // and far ones trail in — but every in-range tile reaches a full flip.
        const ease = 0.22 + proximity * 0.45;
        t.flip += (target - t.flip) * ease;
        if (t.flip < 0.001 && target === 0) {
          if (t.el.style.transform !== "") {
            t.el.style.transform = "";
            t.glow.style.opacity = "0";
          }
          continue;
        }
        const deg = t.flip * 180;
        const scale = 1 + t.flip * 0.06;
        t.el.style.transform = `rotateX(${deg}deg) scale(${scale})`;
        t.glow.style.opacity = `${t.flip * 0.8}`;
      }
      rafId = requestAnimationFrame(frame);
    }

    let rafId = 0;
    let running = false;

    function start() {
      if (running || reduced) return;
      running = true;
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }

    build();
    start();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onPointerMove, { passive: true });

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }
    document.addEventListener("visibilitychange", onVisibility);

    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !document.hidden) start();
          else stop();
        },
        { rootMargin: "100px" },
      );
      io.observe(host);
    }

    let resizeT = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeT);
      resizeT = window.setTimeout(() => {
        build();
      }, 150);
    });
    ro.observe(host);

    window.addEventListener("scroll", measure, { passive: true });

    return () => {
      stop();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("scroll", measure);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      ro.disconnect();
      window.clearTimeout(resizeT);
    };
  }, [tileSize, gap, radius, faceColor, accentColor]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

export default FlipTileGrid;
