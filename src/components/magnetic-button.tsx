"use client";

import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import {
  forwardRef,
  useCallback,
  type ButtonHTMLAttributes,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";

const MAGNET_RADIUS = 110;
const MAGNET_STRENGTH = 0.32;

type MagneticButtonProps = {
  children: ReactNode;
  className?: string;
  as?: "button" | "a";
} & ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement>;

export const MagneticButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, MagneticButtonProps>(
  function MagneticButton({ children, className = "", as = "button", ...rest }, ref) {
    const reduceMotion = useReducedMotion();
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springX = useSpring(x, { stiffness: 280, damping: 22, mass: 0.4 });
    const springY = useSpring(y, { stiffness: 280, damping: 22, mass: 0.4 });

    const onPointerMove = useCallback(
      (e: React.PointerEvent<HTMLElement>) => {
        if (reduceMotion) return;
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < MAGNET_RADIUS) {
          const pull = (1 - dist / MAGNET_RADIUS) * MAGNET_STRENGTH;
          x.set(dx * pull);
          y.set(dy * pull);
        } else {
          x.set(0);
          y.set(0);
        }
      },
      [reduceMotion, x, y],
    );

    const onPointerLeave = useCallback(() => {
      x.set(0);
      y.set(0);
    }, [x, y]);

    const motionProps = {
      style: { x: springX, y: springY },
      onPointerMove,
      onPointerLeave,
      className,
    };

    if (as === "a") {
      const { type: _t, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <motion.a ref={ref as React.Ref<HTMLAnchorElement>} {...motionProps} {...anchorRest}>
          {children}
        </motion.a>
      );
    }

    return (
      <motion.button ref={ref as React.Ref<HTMLButtonElement>} {...motionProps} {...rest}>
        {children}
      </motion.button>
    );
  },
);
