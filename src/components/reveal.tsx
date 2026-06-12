"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Stripe-style scroll reveal.
 *
 * Content starts slightly offset + faded and eases into place the first time it
 * scrolls into view. Uses a soft, high-end cubic bezier (matches Stripe's
 * marketing easing) and only fires once so the page feels calm on scroll-back.
 */

const STRIPE_EASE = [0.16, 1, 0.3, 1] as const;

type Direction = "up" | "down" | "left" | "right" | "none";

function offsetFor(direction: Direction, distance: number) {
  switch (direction) {
    case "up":
      return { y: distance };
    case "down":
      return { y: -distance };
    case "left":
      return { x: distance };
    case "right":
      return { x: -distance };
    case "none":
      return {};
  }
}

export type RevealProps = {
  children: ReactNode;
  /** Direction the element travels in from. Default "up". */
  direction?: Direction;
  /** Travel distance in px. Default 24. */
  distance?: number;
  /** Delay before the animation starts (seconds). Default 0. */
  delay?: number;
  /** Animation duration (seconds). Default 0.7. */
  duration?: number;
  className?: string;
  /** Render as a specific element via framer's motion factory. Default "div". */
  as?: keyof typeof motion;
};

export function Reveal({
  children,
  direction = "up",
  distance = 24,
  delay = 0,
  duration = 0.7,
  className,
  as = "div",
}: RevealProps) {
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, ...offsetFor(direction, distance) }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration, delay, ease: STRIPE_EASE }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Wraps a group whose direct children should cascade in one after another.
 * Pair with <RevealItem> for each child.
 */
export function RevealStagger({
  children,
  className,
  stagger = 0.1,
  delayChildren = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
}) {
  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
  distance = 24,
  duration = 0.7,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
}) {
  const item: Variants = {
    hidden: { opacity: 0, y: distance },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration, ease: STRIPE_EASE },
    },
  };
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}

export default Reveal;
