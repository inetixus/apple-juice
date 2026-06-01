import { animate, type MotionValue } from "framer-motion";

export type Point = { x: number; y: number };

/** Smooth travel — arc with a natural settle. */
export const HUMAN_SPRING = {
  type: "spring" as const,
  stiffness: 450,
  damping: 35,
  mass: 0.5,
};

/** Snappy point-and-click. */
export const HUMAN_SPRING_SNAP = {
  type: "spring" as const,
  stiffness: 600,
  damping: 40,
  mass: 0.4,
};

const ARC_STRENGTH = 0.14;

export function arcMid(from: Point, to: Point): Point {
  return {
    x: (from.x + to.x) / 2 + (to.y - from.y) * ARC_STRENGTH,
    y: (from.y + to.y) / 2 - (to.x - from.x) * ARC_STRENGTH,
  };
}

export function dwellMs(): number {
  return 20 + Math.random() * 20;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type PathStyle = "direct" | "arc";

export type AnimateHumanPathOptions = {
  reducedMotion?: boolean;
  style?: PathStyle;
};

async function springTo(
  x: MotionValue<number>,
  y: MotionValue<number>,
  point: Point,
  reducedMotion: boolean,
  snap = false,
) {
  if (reducedMotion) {
    x.set(point.x);
    y.set(point.y);
    return;
  }
  const spring = snap ? HUMAN_SPRING_SNAP : HUMAN_SPRING;
  await Promise.all([
    animate(x, point.x, spring),
    animate(y, point.y, spring),
  ]);
}

/**
 * Move cursor with spring physics.
 * `direct` = one motion to target (clicks). `arc` = subtle curved path (longer travel).
 */
export async function animateHumanPath(
  x: MotionValue<number>,
  y: MotionValue<number>,
  to: Point,
  options: AnimateHumanPathOptions = {},
) {
  const { reducedMotion = false, style = "direct" } = options;

  if (reducedMotion) {
    x.set(to.x);
    y.set(to.y);
    return;
  }

  if (style === "direct") {
    await springTo(x, y, to, false, true);
    return;
  }

  // For a fluid arc without stopping, we animate X and Y with slightly 
  // mismatched spring physics. This creates a natural curved trajectory 
  // all the way to the destination without any intermediate stops.
  const springX = { ...HUMAN_SPRING, stiffness: HUMAN_SPRING.stiffness * 0.75, damping: HUMAN_SPRING.damping * 1.1 };
  const springY = { ...HUMAN_SPRING, stiffness: HUMAN_SPRING.stiffness * 1.15, damping: HUMAN_SPRING.damping * 0.9 };
  
  await Promise.all([
    animate(x, to.x, springX),
    animate(y, to.y, springY),
  ]);
}
