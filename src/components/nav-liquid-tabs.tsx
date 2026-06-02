"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   Nav liquid-glass tabs — a sliding frosted glass indicator that
   glides between nav items as the user scrolls. Features:
   • IntersectionObserver scroll-spy to detect active section
   • Animated liquid-glass backdrop pill with shimmer + blob
   • Smooth, spring-animated position and width transitions
   ───────────────────────────────────────────────────────────── */

type NavItem = {
  label: string;
  href: string;
  sectionId: string;
  accent?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Web IDE", href: "#explore", sectionId: "explore" },
  { label: "CLI", href: "#cli", sectionId: "cli", accent: "#ffb347" },
  { label: "Pricing", href: "#pricing", sectionId: "pricing" },
  { label: "FAQ", href: "#faq", sectionId: "faq" },
];

type Rect = { left: number; width: number };

export function NavLiquidTabs({ scrolled }: { scrolled: boolean }) {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const [active, setActive] = useState<number>(-1);
  const [hovered, setHovered] = useState<number>(-1);
  const [pill, setPill] = useState<Rect | null>(null);

  // scroll-spy via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const visibleSet = new Set<string>();

    const update = () => {
      // pick the topmost visible section as "active"
      for (let i = 0; i < NAV_ITEMS.length; i++) {
        if (visibleSet.has(NAV_ITEMS[i].sectionId)) {
          setActive(i);
          return;
        }
      }
      setActive(-1);
    };

    for (const item of NAV_ITEMS) {
      const el = document.getElementById(item.sectionId);
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) visibleSet.add(item.sectionId);
          else visibleSet.delete(item.sectionId);
          update();
        },
        { rootMargin: "-30% 0px -50% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // Measure tab positions relative to container.
  const measure = useCallback(
    (idx: number): Rect | null => {
      const container = containerRef.current;
      const tab = itemRefs.current[idx];
      if (!container || !tab) return null;
      const cRect = container.getBoundingClientRect();
      const tRect = tab.getBoundingClientRect();
      return { left: tRect.left - cRect.left, width: tRect.width };
    },
    [],
  );

  // Update pill position when active or hovered changes.
  const targetIdx = hovered >= 0 ? hovered : active;
  useLayoutEffect(() => {
    if (targetIdx < 0) {
      setPill(null);
      return;
    }
    const rect = measure(targetIdx);
    if (rect) setPill(rect);
  }, [targetIdx, measure, scrolled]);

  return (
    <div ref={containerRef} className="hidden md:flex items-center relative">
      {/* ─── Sliding liquid-glass pill ─── */}
      {pill && (
        <motion.div
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none rounded-full overflow-hidden"
          animate={{
            left: pill.left - 12,
            width: pill.width + 24,
            opacity: 1,
          }}
          initial={false}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 500, damping: 35, mass: 0.6 }
          }
          style={{ height: 30 }}
        >
          {/* frosted glass body */}
          <div className="absolute inset-0 rounded-full bg-white/[0.06] backdrop-blur-lg border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_16px_rgba(0,0,0,0.2)]" />

          {/* shimmer sweep */}
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
            }}
            animate={{ x: ["-120%", "220%"] }}
            transition={{
              duration: 3.2,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 2.5,
            }}
          />

          {/* ambient internal blob */}
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: "55%",
              height: "60%",
              top: "15%",
              left: "20%",
              background: "radial-gradient(circle, rgba(204,255,0,0.12), transparent 70%)",
            }}
            animate={{
              x: ["-8%", "12%", "-8%"],
              y: ["-5%", "8%", "-5%"],
              scale: [1, 1.1, 1],
            }}
            transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
          />
        </motion.div>
      )}

      {/* ─── Nav links ─── */}
      <div className="flex items-center gap-8">
        {NAV_ITEMS.map((item, i) => {
          const isActive = i === active;
          const isHovered = i === hovered;
          const accent = item.accent;
          const color = isActive || isHovered
            ? accent ?? "#ffffff"
            : accent
              ? `${accent}88`
              : "rgba(255,255,255,0.4)";

          return (
            <motion.a
              key={item.sectionId}
              ref={(el) => { itemRefs.current[i] = el; }}
              href={item.href}
              onPointerEnter={() => setHovered(i)}
              onPointerLeave={() => setHovered(-1)}
              animate={{ color }}
              transition={{ duration: 0.2 }}
              className="relative text-[11px] font-bold uppercase tracking-wider py-1.5 z-10"
            >
              {item.label}
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}
