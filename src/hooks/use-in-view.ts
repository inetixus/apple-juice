"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

type UseInViewOptions = {
  threshold?: number;
  rootMargin?: string;
};

/** Parse `150px 0px` style rootMargin into vertical bleed (px). */
function verticalBleedPx(rootMargin: string): number {
  const parts = rootMargin.trim().split(/\s+/);
  const top = parts[0] ?? "0px";
  const n = parseFloat(top);
  return Number.isFinite(n) ? n : 0;
}

/** Whether any part of the element is near the viewport (matches generous rootMargin). */
export function isNearViewport(
  el: Element,
  rootMargin = "150px 0px",
): boolean {
  const bleed = verticalBleedPx(rootMargin);
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight;
  return rect.bottom >= -bleed && rect.top <= vh + bleed;
}

/**
 * Tracks whether a ref'd element is in (or near) the viewport.
 * Syncs once on layout so above-the-fold demos start without waiting for IO.
 */
export function useInView(
  ref: RefObject<HTMLElement | null>,
  options: UseInViewOptions = {},
): boolean {
  const { threshold = 0.05, rootMargin = "150px 0px" } = options;
  const [isInView, setIsInView] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    setIsInView(isNearViewport(el, rootMargin));

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin]);

  return isInView;
}
