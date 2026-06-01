"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import { getLandingPerfConfig } from "@/lib/landing-perf";

export const SPINE_ANCHORS = [
  "intro",
  "workspace",
  "projects",
  "editor",
] as const;

export type SpineAnchorId = (typeof SPINE_ANCHORS)[number];

const INTERACT_RADIUS = 88;

type SpineContextValue = {
  registerAnchor: (id: SpineAnchorId, el: HTMLElement | null) => void;
};

const SpineContext = createContext<SpineContextValue | null>(null);

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function StaticSpineLine() {
  return (
    <div
      className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 z-[1] pointer-events-none"
      aria-hidden
      style={{
        background:
          "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.1) 12%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.1) 88%, transparent 100%)",
      }}
    />
  );
}

type Interaction = {
  id: SpineAnchorId;
  anchorY: number;
  strength: number;
  offset: number;
};

function computeInteractions(
  anchorYs: Partial<Record<SpineAnchorId, number>>,
  lookY: number,
): Interaction[] {
  return SPINE_ANCHORS.map((id) => {
    const anchorY = anchorYs[id];
    if (anchorY == null) return { id, anchorY: 0, strength: 0, offset: 0 };
    const dist = Math.abs(lookY - anchorY);
    const strength = clamp(1 - dist / INTERACT_RADIUS, 0, 1);
    const offset = (lookY - anchorY) * strength * 0.45;
    return { id, anchorY, strength, offset };
  });
}

function SpineOverlay({
  anchorYs,
  lookYRef,
}: {
  anchorYs: Partial<Record<SpineAnchorId, number>>;
  lookYRef: React.RefObject<number>;
}) {
  const reduceMotion = useReducedMotion();
  const overlayRef = useRef<HTMLDivElement>(null);
  const userDotRef = useRef<HTMLDivElement>(null);
  const featureDotRefs = useRef<Partial<Record<SpineAnchorId, HTMLDivElement>>>({});
  const bridgeRefs = useRef<Partial<Record<SpineAnchorId, HTMLDivElement>>>({});
  const smoothYRef = useRef<number | null>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const trailPointsRef = useRef<{ y: number; t: number }[]>([]);

  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const targetY = lookYRef.current;
      
      // Interpolate the dot's Y position to achieve incredibly smooth, buttery physics
      if (smoothYRef.current === null) {
        smoothYRef.current = targetY;
      } else {
        const diff = targetY - smoothYRef.current;
        if (Math.abs(diff) < 0.1) {
          smoothYRef.current = targetY;
        } else {
          // 0.08 LERP factor feels extremely organic, flowing and premium
          smoothYRef.current += diff * 0.08;
        }
      }

      const currentY = smoothYRef.current;
      const interactions = computeInteractions(anchorYs, currentY);
      const maxStrength = Math.max(0, ...interactions.map((i) => i.strength));

      if (!reduceMotion) {
        const now = performance.now();
        const trail = trailPointsRef.current;
        trail.push({ y: currentY, t: now });
        while (trail.length > 0 && now - trail[0].t > 900) trail.shift();
        if (trail.length > 36) trail.splice(0, trail.length - 36);

        const canvas = trailCanvasRef.current;
        const host = overlayRef.current;
        if (canvas && host) {
          const w = host.clientWidth;
          const h = host.clientHeight;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, w, h);
            const cx = w / 2;
            for (let i = 1; i < trail.length; i++) {
              const age = (now - trail[i].t) / 900;
              const alpha = Math.max(0, 0.35 * (1 - age));
              ctx.strokeStyle = `rgba(204, 255, 0, ${alpha})`;
              ctx.lineWidth = 2 + (1 - age) * 2;
              ctx.beginPath();
              ctx.moveTo(cx, trail[i - 1].y);
              ctx.lineTo(cx, trail[i].y);
              ctx.stroke();
            }
          }
        }
      }

      if (userDotRef.current) {
        const scale = reduceMotion ? 1 : 1 + maxStrength * 0.25;
        userDotRef.current.style.top = `${currentY}px`;
        userDotRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }

      for (const { id, anchorY, strength, offset } of interactions) {
        const dot = featureDotRefs.current[id];
        if (dot) {
          const y = anchorY + (reduceMotion ? 0 : offset);
          const scale = reduceMotion ? 1 : 1 + strength * 0.5;
          const size = strength > 0.35 ? 18 : 14;
          dot.style.top = `${y}px`;
          dot.style.transform = `translate(-50%, -50%) scale(${scale})`;
          dot.style.width = `${size}px`;
          dot.style.height = `${size}px`;
          if (strength > 0.42) {
            dot.classList.add("spine-node-active");
          } else {
            dot.classList.remove("spine-node-active");
          }
        }

        const bridge = bridgeRefs.current[id];
        if (bridge) {
          if (strength < 0.05) {
            bridge.style.opacity = "0";
          } else {
            const top = Math.min(currentY, anchorY + offset);
            const height = Math.abs(currentY - (anchorY + offset));
            bridge.style.top = `${top}px`;
            bridge.style.height = `${Math.max(height, 3)}px`;
            bridge.style.opacity = String(0.2 + strength * 0.8);
            bridge.style.transform = `translateX(-50%) scaleX(${1 + strength * 0.5})`;
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [anchorYs, lookYRef, reduceMotion]);

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-[2] pointer-events-none overflow-visible"
      aria-hidden
    >
      <StaticSpineLine />

      <canvas
        ref={trailCanvasRef}
        className="absolute inset-0 z-[2] pointer-events-none spine-energy-trail"
        aria-hidden
      />

      {SPINE_ANCHORS.map((id) => (
        <div
          key={`bridge-${id}`}
          ref={(el) => {
            if (el) bridgeRefs.current[id] = el;
            else delete bridgeRefs.current[id];
          }}
          className="absolute left-1/2 z-[3] w-[3px] rounded-full pointer-events-none liquid-glass-bridge"
          style={{ opacity: 0 }}
        />
      ))}

      {SPINE_ANCHORS.map((id) => (
        <div
          key={`dot-${id}`}
          ref={(el) => {
            if (el) featureDotRefs.current[id] = el;
            else delete featureDotRefs.current[id];
          }}
          className="absolute left-1/2 z-[4] pointer-events-none liquid-glass-dot liquid-glass-dot--feature rounded-full"
          style={{ width: 14, height: 14, top: anchorYs[id] ?? 0 }}
        />
      ))}

      <div
        ref={userDotRef}
        className="absolute left-1/2 z-[4] pointer-events-none liquid-glass-dot liquid-glass-dot--user rounded-full"
        style={{ width: 16, height: 16, top: lookYRef.current }}
      />
    </div>
  );
}

export function SpineSection({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const anchorElements = useRef<Partial<Record<SpineAnchorId, HTMLElement>>>({});
  const [anchorYs, setAnchorYs] = useState<Partial<Record<SpineAnchorId, number>>>(
    {},
  );
  const lookYRef = useRef(24);
  const scrollYRef = useRef(24);
  const pointerYRef = useRef<number | null>(null);

  const measureRef = useRef<() => void>(() => {});

  const sectionRectRef = useRef<{ top: number; height: number }>({ top: 0, height: 0 });
  const absoluteTopRef = useRef<number>(0);
  const sectionHeightRef = useRef<number>(0);
  const tickingScroll = useRef(false);
  const tickingPointer = useRef(false);

  const registerAnchor = useCallback(
    (anchorId: SpineAnchorId, el: HTMLElement | null) => {
      if (el) anchorElements.current[anchorId] = el;
      else delete anchorElements.current[anchorId];
      requestAnimationFrame(() => measureRef.current());
    },
    [],
  );

  const measureAnchors = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;

    const sectionRect = section.getBoundingClientRect();
    absoluteTopRef.current = sectionRect.top + window.scrollY;
    sectionHeightRef.current = sectionRect.height;
    sectionRectRef.current = {
      top: sectionRect.top,
      height: sectionRect.height,
    };

    const next: Partial<Record<SpineAnchorId, number>> = {};
    for (const anchorId of SPINE_ANCHORS) {
      const el = anchorElements.current[anchorId];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[anchorId] = r.top + r.height / 2 - sectionRect.top;
    }

    setAnchorYs(next);
  }, []);

  const measureScroll = useCallback(() => {
    const absoluteTop = absoluteTopRef.current;
    const sectionHeight = sectionHeightRef.current;
    if (sectionHeight === 0) return;

    const currentSectionTop = absoluteTop - window.scrollY;
    sectionRectRef.current = {
      top: currentSectionTop,
      height: sectionHeight,
    };

    const viewportCenter = window.innerHeight * 0.5;
    const yInSection = viewportCenter - currentSectionTop;
    scrollYRef.current = clamp(yInSection, 24, Math.max(24, sectionHeight - 24));
    lookYRef.current = pointerYRef.current ?? scrollYRef.current;
  }, []);

  const measureAll = useCallback(() => {
    measureAnchors();
    measureScroll();
  }, [measureAnchors, measureScroll]);

  measureRef.current = measureAll;

  useEffect(() => {
    getLandingPerfConfig();
    measureAll();
    const section = sectionRef.current;
    if (!section) return;

    const ro = new ResizeObserver(() => {
      measureAll();
    });
    ro.observe(section);
    for (const el of Object.values(anchorElements.current)) {
      if (el) ro.observe(el);
    }

    const handleScroll = () => {
      if (!tickingScroll.current) {
        tickingScroll.current = true;
        window.requestAnimationFrame(() => {
          measureScroll();
          tickingScroll.current = false;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", measureAll, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", measureAll);
    };
  }, [measureAll, measureScroll]);

  return (
    <SpineContext.Provider value={{ registerAnchor }}>
      <section
        ref={sectionRef}
        id={id}
        className={`relative ${className}`}
        onPointerMove={(e) => {
          const rect = sectionRectRef.current;
          if (rect.height === 0) return;
          const clientY = e.clientY;

          if (!tickingPointer.current) {
            tickingPointer.current = true;
            window.requestAnimationFrame(() => {
              pointerYRef.current = clamp(clientY - rect.top, 0, rect.height);
              lookYRef.current = pointerYRef.current;
              tickingPointer.current = false;
            });
          }
        }}
        onPointerLeave={() => {
          pointerYRef.current = null;
          lookYRef.current = scrollYRef.current;
        }}
      >
        <SpineOverlay anchorYs={anchorYs} lookYRef={lookYRef} />
        {children}
      </section>
    </SpineContext.Provider>
  );
}

export function SpineAnchor({
  id,
  children,
  className = "",
}: {
  id: SpineAnchorId;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(SpineContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ctx) return;
    ctx.registerAnchor(id, el);
    return () => ctx.registerAnchor(id, null);
  }, [ctx, id]);

  return (
    <div ref={ref} className={`relative z-10 ${className}`}>
      {children}
    </div>
  );
}
