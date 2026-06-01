"use client";

import { motion, useMotionValue, type MotionValue, useVelocity, useSpring } from "framer-motion";
import {
  useCallback,
  useRef,
  useState,
  useEffect,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  animateHumanPath,
  dwellMs,
  HUMAN_SPRING_SNAP,
  sleep,
  type PathStyle,
  type Point,
} from "@/lib/human-cursor-motion";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function DemoCursor({
  x,
  y,
  pressing,
  visible,
  hovering = false,
}: {
  x: MotionValue<number>;
  y: MotionValue<number>;
  pressing: boolean;
  visible: boolean;
  hovering?: boolean;
}) {
  const vx = useVelocity(x);
  const vy = useVelocity(y);
  
  const rawRotate = useMotionValue(0);
  const rawScaleX = useMotionValue(1);
  const rawScaleY = useMotionValue(1);
  
  const rotate = useSpring(rawRotate, { stiffness: 150, damping: 15, mass: 0.5 });
  const scaleX = useSpring(rawScaleX, { stiffness: 150, damping: 15, mass: 0.5 });
  const scaleY = useSpring(rawScaleY, { stiffness: 150, damping: 15, mass: 0.5 });

  useEffect(() => {
    const updateMotion = () => {
      const currentVx = vx.get();
      const currentVy = vy.get();
      const speed = Math.sqrt(currentVx * currentVx + currentVy * currentVy);
      
      if (speed < 20) {
        rawRotate.set(0);
        rawScaleX.set(1);
        rawScaleY.set(1);
        return;
      }
      
      // Calculate a much more intense tilt based on velocity vector
      const targetRotate = (currentVx * 0.08) + (currentVy * 0.03);
      // Clamp between -90 and 90 degrees
      const clampedRotate = Math.max(-90, Math.min(90, targetRotate));
      rawRotate.set(clampedRotate);
      
      // Deform based on speed (stretch height, squeeze width)
      const stretch = Math.min(speed / 1500, 0.45); // up to 45% stretch
      rawScaleX.set(1 - stretch * 0.5);
      rawScaleY.set(1 + stretch);
    };

    const unsubX = vx.on("change", updateMotion);
    const unsubY = vy.on("change", updateMotion);
    
    return () => {
      unsubX();
      unsubY();
    };
  }, [vx, vy, rawRotate, rawScaleX, rawScaleY]);

  return (
    <motion.div
      className="absolute top-0 left-0 z-[100] pointer-events-none"
      style={{ x, y, opacity: visible ? 1 : 0 }}
      transition={{ opacity: { duration: 0.35 } }}
    >
      <motion.div
        style={{ rotate, scaleX, scaleY }}
        className="origin-top-left"
      >
        <motion.div
          animate={{ scale: pressing ? 0.9 : 1, opacity: pressing ? 0.92 : 1 }}
          transition={HUMAN_SPRING_SNAP}
          className="-translate-x-[2px] -translate-y-[2px]"
        >
          {!hovering && <div className="absolute -inset-1.5 rounded-full bg-white/[0.06] blur-sm" />}
          {hovering ? (
            <img 
              src="/cursorclick.png?v=3" 
              alt="Pointer" 
              className="w-8 h-8 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] object-cover" 
            />
          ) : (
            <svg
              width="22"
              height="26"
              viewBox="0 0 22 26"
              fill="none"
              className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]"
            >
              <path
                d="M3.5 2.5L3.5 21.5L8.2 16.8L12.1 24.5L15.2 23L11.3 15.3L17.5 14.5L3.5 2.5Z"
                fill="white"
                stroke="rgba(0,0,0,0.85)"
                strokeWidth="1.25"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export function ClickRipple({ point, id }: { point: Point; id: number }) {
  return (
    <motion.div
      key={id}
      className="absolute z-[95] pointer-events-none rounded-full"
      style={{
        left: point.x,
        top: point.y,
        background:
          "radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.12) 35%, transparent 70%)",
        boxShadow: "0 0 20px rgba(255,255,255,0.15)",
      }}
      initial={{ width: 8, height: 8, x: -4, y: -4, opacity: 0.9 }}
      animate={{ width: 52, height: 52, x: -26, y: -26, opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}

export type UseHumanDemoCursorOptions<T extends string> = {
  stageRef: RefObject<HTMLElement | null>;
  targets: MutableRefObject<Partial<Record<T, HTMLElement>>>;
  /** Scaled/transformed layer that wraps targets + cursor (hero camera). */
  contentLayerRef?: RefObject<HTMLElement | null>;
  /** When false, teleports and skips dwell (e.g. perf / reduced motion). */
  motionEnabled?: boolean;
};

export function useHumanDemoCursor<T extends string>({
  stageRef,
  targets,
  contentLayerRef,
  motionEnabled = true,
}: UseHumanDemoCursorOptions<T>) {
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const [cursorOn, setCursorOn] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [highlight, setHighlight] = useState<T | null>(null);
  const [pressed, setPressed] = useState<T | null>(null);
  const [ripples, setRipples] = useState<{ id: number; p: Point }[]>([]);
  const rippleRef = useRef(0);

  const reducedMotion = !motionEnabled || prefersReducedMotion();

  const pt = useCallback(
    (id: T): Point | null => {
      const layer = contentLayerRef?.current ?? stageRef.current;
      const el = targets.current[id];
      if (!layer || !el) return null;

      const er = el.getBoundingClientRect();
      const lr = layer.getBoundingClientRect();
      const cw = layer.clientWidth || lr.width || 1;
      const ch = layer.clientHeight || lr.height || 1;
      const scaleX = lr.width / cw;
      const scaleY = lr.height / ch;

      const screenX = er.left + er.width * 0.5 - lr.left;
      const screenY = er.top + er.height * 0.5 - lr.top;

      return {
        x: screenX / scaleX,
        y: screenY / scaleY,
      };
    },
    [contentLayerRef, stageRef, targets],
  );

  const placeCursor = useCallback(
    (xRatio: number, yRatio: number) => {
      const layer = contentLayerRef?.current ?? stageRef.current;
      if (!layer) return;
      const w = layer.clientWidth;
      const h = layer.clientHeight;
      cursorX.set(w * xRatio);
      cursorY.set(h * yRatio);
    },
    [cursorX, cursorY, contentLayerRef, stageRef],
  );

  const moveToPoint = useCallback(
    async (to: Point, style: PathStyle = "arc") => {
      setHighlight(null);
      await animateHumanPath(cursorX, cursorY, to, { reducedMotion, style });
    },
    [cursorX, cursorY, reducedMotion],
  );

  const moveToTarget = useCallback(
    async (id: T, opts?: { dwell?: boolean; style?: PathStyle }) => {
      setHighlight(null);
      const to = pt(id);
      if (!to) return;

      let animationDone = false;
      let frameId: number;

      const checkHit = () => {
        if (animationDone) return;
        const dx = cursorX.get() - to.x;
        const dy = cursorY.get() - to.y;
        if (Math.hypot(dx, dy) < 25) {
          setHighlight(id);
        } else {
          frameId = requestAnimationFrame(checkHit);
        }
      };
      frameId = requestAnimationFrame(checkHit);

      await animateHumanPath(cursorX, cursorY, to, {
        reducedMotion,
        style: opts?.style ?? "arc",
      });
      
      animationDone = true;
      cancelAnimationFrame(frameId);
      setHighlight(id);

      if (opts?.dwell !== false && !reducedMotion) {
        await sleep(dwellMs());
      }
    },
    [cursorX, cursorY, pt, reducedMotion],
  );

  const clickTarget = useCallback(
    async (id: T) => {
      const p = pt(id);
      if (!p) return;
      setHighlight(id);
      setPressing(true);
      setPressed(id);
      rippleRef.current += 1;
      const rid = rippleRef.current;
      setRipples((r) => [...r, { id: rid, p }]);
      await sleep(20);
      setPressing(false);
      await sleep(25);
      setPressed(null);
      setTimeout(() => setRipples((r) => r.filter((x) => x.id !== rid)), 380);
    },
    [pt],
  );

  /** One snap to target, brief pause, click — no multi-hop micro-corrections. */
  const moveAndClick = useCallback(
    async (id: T, opts?: { style?: PathStyle }) => {
      await moveToTarget(id, { dwell: true, style: opts?.style ?? "arc" });
      await clickTarget(id);
    },
    [clickTarget, moveToTarget],
  );

  const clearHighlight = useCallback(() => {
    setHighlight(null);
    setPressed(null);
  }, []);

  return {
    cursorX,
    cursorY,
    cursorOn,
    setCursorOn,
    pressing,
    highlight,
    pressed,
    ripples,
    setHighlight,
    setPressed,
    pt,
    placeCursor,
    moveToPoint,
    moveToTarget,
    clickTarget,
    moveAndClick,
    clearHighlight,
    reducedMotion,
  } as const;
}
