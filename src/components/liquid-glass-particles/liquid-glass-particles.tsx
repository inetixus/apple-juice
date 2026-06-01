"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import {
  LiquidGlassScene,
  type ParticleTarget,
} from "./liquid-glass-scene";

export type { ParticleTarget };

export function LiquidGlassParticles({
  targets,
  className = "",
}: {
  targets: ParticleTarget[];
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: "200px" } // Mount 200px early to prevent visible pop-in
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  const targetKey = JSON.stringify(targets);
  const stableTargets = useMemo(() => targets, [targetKey, targets]);

  if (!mounted || reduceMotion) return null;

  return (
    <div ref={containerRef} className={`absolute inset-0 ${className}`} aria-hidden>
      {isVisible && (
        <Canvas
          orthographic
          camera={{ position: [0, 0, 1], near: 0, far: 2, zoom: 1 }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
            premultipliedAlpha: false,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0, 0);
          }}
          style={{ width: "100%", height: "100%", display: "block" }}
          dpr={[1, Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1)]}
          frameloop="always"
        >
          <LiquidGlassScene targets={stableTargets} enabled />
        </Canvas>
      )}
    </div>
  );
}
