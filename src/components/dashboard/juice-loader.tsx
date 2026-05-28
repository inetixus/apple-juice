"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// High-quality juice-themed status text cycling phrases
const LOADING_PHRASES = [
  "Squeezing Luau optimizations...",
  "Blending prompt variables...",
  "Juicing the workspace trees...",
  "Chilling environmental variables...",
  "Extracting Roblox model metadata...",
  "Fermenting AI thinking chains...",
  "Filtering active instance hooks...",
  "Pouring purified script logic...",
  "Straining API connections...",
  "Adding a dash of sweet syntax..."
];

interface JuiceLoaderProps {
  size?: "sm" | "md" | "lg";
  customText?: string;
}

export function JuiceLoader({ size = "md", customText }: JuiceLoaderProps) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  // Rotate loading text phrases
  useEffect(() => {
    if (customText) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [customText]);

  const displayedText = customText || LOADING_PHRASES[phraseIndex];

  // Sizing definitions
  const dimensions = {
    sm: {
      container: "h-20 w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]",
      glassWidth: 32,
      glassHeight: 38,
      textStyle: "text-[10px] font-bold text-[#ccff00]/80 tracking-wide uppercase truncate",
      bubbleCount: 4,
    },
    md: {
      container: "flex flex-col items-center justify-center p-6 text-center",
      glassWidth: 80,
      glassHeight: 100,
<<<<<<< HEAD
      textStyle: "text-xs font-semibold text-slate-400 mt-6 max-w-[200px] h-4",
      bubbleCount: 12,
    },
    lg: {
      container: "flex flex-col items-center justify-center p-12 text-center",
      glassWidth: 140,
      glassHeight: 180,
      textStyle: "text-sm font-bold uppercase tracking-[0.2em] glossy-text-gradient mt-10 max-w-[400px] h-6",
      bubbleCount: 20,
=======
      textStyle: "text-xs font-semibold text-slate-400 mt-4 max-w-[200px] h-4",
      bubbleCount: 8,
    },
    lg: {
      container: "flex flex-col items-center justify-center p-12 text-center",
      glassWidth: 120,
      glassHeight: 150,
      textStyle: "text-sm font-bold uppercase tracking-[0.15em] text-[#ccff00] mt-8 max-w-[320px] h-6 shadow-glow",
      bubbleCount: 15,
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
    },
  }[size];

  // Inline CSS to guarantee wave and bubble animation consistency
  const animationStyles = `
    @keyframes juice-wave-front {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @keyframes juice-wave-back {
      0% { transform: translateX(-50%); }
      100% { transform: translateX(0); }
    }
    @keyframes juice-bubble-rise {
      0% {
<<<<<<< HEAD
        transform: translateY(110%) scale(0.3);
=======
        transform: translateY(100%) scale(0.3);
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
        opacity: 0;
      }
      20% {
        opacity: 0.8;
      }
      80% {
        opacity: 0.8;
      }
      100% {
<<<<<<< HEAD
        transform: translateY(-20%) scale(1.2);
=======
        transform: translateY(-10%) scale(1.1);
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
        opacity: 0;
      }
    }
    @keyframes juice-drip-fall {
      0% {
<<<<<<< HEAD
        transform: translateY(-30px);
=======
        transform: translateY(-25px);
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      60% {
<<<<<<< HEAD
        transform: translateY(135px);
=======
        transform: translateY(85px);
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
        opacity: 1;
        scale: 1;
      }
      65% {
<<<<<<< HEAD
        transform: translateY(145px) scaleX(1.8) scaleY(0.3);
        opacity: 0.4;
      }
      75% {
        transform: translateY(150px) scale(0);
        opacity: 0;
      }
      100% {
        transform: translateY(150px) scale(0);
=======
        transform: translateY(92px) scaleX(1.6) scaleY(0.4);
        opacity: 0.3;
      }
      75% {
        transform: translateY(95px) scale(0);
        opacity: 0;
      }
      100% {
        transform: translateY(95px) scale(0);
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
        opacity: 0;
      }
    }
    @keyframes juice-splash-ring {
      0% {
        transform: scale(0);
        opacity: 0;
      }
      10% {
<<<<<<< HEAD
        opacity: 0.7;
      }
      80% {
        transform: scale(2);
        opacity: 0;
      }
      100% {
        transform: scale(2.2);
        opacity: 0;
      }
    }
    @keyframes juice-liquid-pulse {
      0%, 100% { filter: brightness(1) saturate(1); }
      50% { filter: brightness(1.15) saturate(1.2) drop-shadow(0 0 10px rgba(204, 255, 0, 0.4)); }
    }
    @keyframes juice-condensation {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.6; }
    }
    .animate-wave-front {
      animation: juice-wave-front 2.5s linear infinite;
    }
    .animate-wave-back {
      animation: juice-wave-back 1.8s linear infinite;
    }
    .animate-drip-fall {
      animation: juice-drip-fall 2.5s cubic-bezier(0.4, 0, 1, 1) infinite;
    }
    .animate-splash-ring {
      animation: juice-splash-ring 2.5s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
    }
    .animate-liquid-pulse {
      animation: juice-liquid-pulse 3s ease-in-out infinite;
=======
        opacity: 0.6;
      }
      80% {
        transform: scale(1.5);
        opacity: 0;
      }
      100% {
        transform: scale(1.8);
        opacity: 0;
      }
    }
    .animate-wave-front {
      animation: juice-wave-front 3s linear infinite;
    }
    .animate-wave-back {
      animation: juice-wave-back 2s linear infinite;
    }
    .animate-drip-fall {
      animation: juice-drip-fall 2.8s cubic-bezier(0.4, 0, 1, 1) infinite;
    }
    .animate-splash-ring {
      animation: juice-splash-ring 2.8s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
    }
  `;

  return (
    <div className={dimensions.container}>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />

      <div className="relative flex items-center justify-center">
<<<<<<< HEAD
        {/* Deep Neon Glow */}
        {size !== "sm" && (
          <div 
            className="absolute inset-[-40px] rounded-full bg-[#ccff00]/15 blur-[60px] animate-pulse pointer-events-none" 
            style={{ opacity: 0.6 }}
          />
        )}

        {/* Fruit slice dripping juice */}
        {size !== "sm" && (
          <div className="absolute top-[-35px] left-[-10px] z-30 flex flex-col items-center pointer-events-none rotate-[-15deg]">
            <svg
              viewBox="0 0 100 100"
              className={size === "lg" ? "h-14 w-14" : "h-10 w-10"}
            >
              <defs>
                <radialGradient id="sliceGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#e4fc18" />
                  <stop offset="70%" stopColor="#cbf103" />
                  <stop offset="100%" stopColor="#a4de02" />
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="48" fill="#5c8a00" />
              <circle cx="50" cy="50" r="45" fill="url(#sliceGrad)" />
              <path d="M50 5 L50 95 M5 50 L95 50 M18 18 L82 82 M18 82 L82 18" stroke="#a4de02" strokeWidth="2" opacity="0.6" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="1" opacity="0.2" />
              <circle cx="50" cy="50" r="8" fill="#e4fc18" />
            </svg>

            {/* Droplet */}
            <div
              className="absolute left-[50%] ml-[-4px] top-[24px] w-2 h-3.5 rounded-full bg-[#ccff00] animate-drip-fall shadow-[0_0_8px_rgba(204,255,0,0.6)]"
=======
        {/* Neon blur glow behind glass */}
        {size !== "sm" && (
          <div className="absolute inset-0 rounded-full bg-[#ccff00]/10 blur-[40px] animate-pulse pointer-events-none" />
        )}

        {/* Fruit slice dripping juice from above (MD & LG sizes only) */}
        {size !== "sm" && (
          <div className="absolute top-[-25px] left-[5%] z-20 flex flex-col items-center pointer-events-none">
            {/* Orange/Lime Slice */}
            <svg
              viewBox="0 0 100 100"
              className={size === "lg" ? "h-10 w-10" : "h-7 w-7"}
            >
              {/* Outer skin */}
              <circle cx="50" cy="50" r="45" fill="#a4de02" />
              {/* Inner rind */}
              <circle cx="50" cy="50" r="41" fill="#cbf103" />
              {/* Segment dividers */}
              <circle cx="50" cy="50" r="37" fill="#84ba00" />
              <path d="M50 13 L50 87 M13 50 L87 50 M24 24 L76 76 M24 76 L76 24" stroke="#cbf103" strokeWidth="3" />
              {/* Center seed hub */}
              <circle cx="50" cy="50" r="8" fill="#e4fc18" />
            </svg>

            {/* Dripping Droplet */}
            <div
              className="absolute left-[50%] ml-[-3px] top-[18px] w-1.5 h-2.5 rounded-full bg-[#ccff00] animate-drip-fall"
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
              style={{ transformOrigin: "top center" }}
            />
          </div>
        )}

<<<<<<< HEAD
        {/* The Glass */}
        <div
          className="relative overflow-hidden bg-white/[0.04] backdrop-blur-md border border-white/20 shadow-[inset_0_4px_16px_rgba(255,255,255,0.1),0_24px_48px_rgba(0,0,0,0.5)] flex items-end justify-center"
          style={{
            width: `${dimensions.glassWidth}px`,
            height: `${dimensions.glassHeight}px`,
            borderRadius: `0 0 ${dimensions.glassWidth * 0.3}px ${dimensions.glassWidth * 0.3}px`,
          }}
        >
          {/* Condensation effects */}
          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ animation: 'juice-condensation 5s ease-in-out infinite' }}>
            {Array.from({ length: 15 }).map((_, i) => (
              <div 
                key={i} 
                className="absolute bg-white/40 rounded-full blur-[0.5px]"
                style={{
                  width: Math.random() * 3 + 1 + 'px',
                  height: Math.random() * 3 + 1 + 'px',
                  top: Math.random() * 100 + '%',
                  left: Math.random() * 100 + '%',
                }}
              />
            ))}
          </div>

          {/* Glass Rim highlight */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/40 to-transparent z-10" />
          
          {/* Vertical Glass Reflection */}
          <div className="absolute left-[15%] top-0 bottom-0 w-[10%] bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-5deg] z-10" />

          {/* Liquid Container */}
          <div className="relative w-full h-[72%] overflow-hidden animate-liquid-pulse">
            {/* Splash ring */}
            {size !== "sm" && (
              <div
                className="absolute top-0 left-[50%] ml-[-18px] w-9 h-2.5 border border-[#ccff00]/60 rounded-full animate-splash-ring pointer-events-none"
=======
        {/* Glass Silhouette */}
        <div
          className="relative overflow-hidden rounded-b-[24px] rounded-t-lg bg-white/[0.03] border border-white/10 shadow-[inset_0_4px_12px_rgba(255,255,255,0.05),0_12px_32px_rgba(0,0,0,0.4)] flex items-end justify-center"
          style={{
            width: `${dimensions.glassWidth}px`,
            height: `${dimensions.glassHeight}px`,
            borderRadius: `0 0 ${dimensions.glassWidth * 0.25}px ${dimensions.glassWidth * 0.25}px`,
          }}
        >
          {/* Glass Rim highlight */}
          <div className="absolute top-0 inset-x-0 h-1 bg-white/20 blur-[0.5px]" />

          {/* Liquid Container */}
          <div className="relative w-full h-[65%] overflow-hidden">
            {/* Splash ring (Synchronized with dripping droplet) */}
            {size !== "sm" && (
              <div
                className="absolute top-0 left-[50%] ml-[-12px] w-6 h-1.5 border border-[#ccff00]/40 rounded-full animate-splash-ring pointer-events-none"
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
                style={{ transformOrigin: "center center" }}
              />
            )}

            {/* Back wave layer */}
<<<<<<< HEAD
            <div className="absolute inset-0 w-[200%] h-full top-[-6px] left-0 overflow-hidden pointer-events-none opacity-60">
              <svg
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                className="w-full h-8 fill-[#84ba00] animate-wave-back"
=======
            <div className="absolute inset-0 w-[200%] h-full top-[-4px] left-0 overflow-hidden pointer-events-none">
              <svg
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                className="w-full h-6 fill-[#9fc300]/40 animate-wave-back"
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
              >
                <path d="M0 10 Q 25 20, 50 10 T 100 10 L 100 20 L 0 20 Z" />
              </svg>
            </div>

            {/* Front wave layer */}
<<<<<<< HEAD
            <div className="absolute inset-0 w-[200%] h-full top-[-4px] left-0 overflow-hidden pointer-events-none">
              <svg
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                className="w-full h-8 fill-[#ccff00] animate-wave-front"
=======
            <div className="absolute inset-0 w-[200%] h-full top-[-2px] left-0 overflow-hidden pointer-events-none">
              <svg
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                className="w-full h-6 fill-[#ccff00]/80 animate-wave-front"
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
              >
                <path d="M0 10 Q 25 0, 50 10 T 100 10 L 100 20 L 0 20 Z" />
              </svg>
            </div>

            {/* Liquid solid body */}
<<<<<<< HEAD
            <div className="absolute inset-x-0 bottom-0 top-[20px] bg-gradient-to-t from-[#6a8a00] via-[#84ba00] to-[#ccff00]" />

            {/* Internal Glow */}
            <div className="absolute bottom-4 inset-x-4 h-1/2 bg-[#ccff00]/20 blur-[20px] rounded-full" />

            {/* Fizzy Bubbles */}
            {Array.from({ length: dimensions.bubbleCount }).map((_, i) => {
              const sizePx = Math.random() * 4 + 2;
              const leftPercent = Math.random() * 85 + 7.5;
              const delay = Math.random() * 3;
              const duration = Math.random() * 2 + 1.5;
              return (
                <div
                  key={i}
                  className="absolute bottom-0 rounded-full bg-white/50 pointer-events-none shadow-[0_0_6px_rgba(255,255,255,0.7)]"
=======
            <div className="absolute inset-x-0 bottom-0 top-[14px] bg-gradient-to-t from-[#82a300] to-[#ccff00]/85" />

            {/* Glowing Liquid surface bar */}
            <div className="absolute top-[8px] inset-x-0 h-1 bg-[#e4fc18] opacity-80 blur-[1px]" />

            {/* Fizzy Bubbles rising inside the juice */}
            {Array.from({ length: dimensions.bubbleCount }).map((_, i) => {
              const sizePx = Math.random() * 3.5 + 1.5;
              const leftPercent = Math.random() * 80 + 10;
              const delay = Math.random() * 2;
              const duration = Math.random() * 1.5 + 1.5;
              return (
                <div
                  key={i}
                  className="absolute bottom-0 rounded-full bg-white/40 pointer-events-none shadow-[0_0_4px_rgba(255,255,255,0.6)]"
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
                  style={{
                    width: `${sizePx}px`,
                    height: `${sizePx}px`,
                    left: `${leftPercent}%`,
                    animation: `juice-bubble-rise ${duration}s ease-in-out infinite`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })}
          </div>
        </div>

<<<<<<< HEAD
        {/* Premium Spiraled Straw */}
        {size !== "sm" && (
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              width: `${dimensions.glassWidth * 0.1}px`,
              height: `${dimensions.glassHeight * 1.2}px`,
              top: `-${dimensions.glassHeight * 0.4}px`,
              left: "70%",
              transform: "rotate(18deg)",
              background: "linear-gradient(90deg, #fef2f2 0%, #ef4444 30%, #ef4444 70%, #fef2f2 100%)",
              borderRadius: "10px",
              boxShadow: "2px 4px 12px rgba(0,0,0,0.3), inset -1px 0 2px rgba(255,255,255,0.5)",
              overflow: 'hidden'
            }}
          >
            {/* Spiral Stripes */}
            <div className="absolute inset-0 opacity-30" style={{
              background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, white 10px, white 20px)'
            }} />
            {/* Straw Highlight */}
            <div className="absolute left-[20%] top-0 bottom-0 w-[20%] bg-white/40 blur-[1px]" />
          </div>
        )}
      </div>

      {/* Loading text with gradient */}
=======
        {/* Dynamic decorative straw (MD & LG sizes only) */}
        {size !== "sm" && (
          <div
            className="absolute z-10 bg-gradient-to-r from-red-500 via-white to-red-500 shadow-lg pointer-events-none"
            style={{
              width: `${dimensions.glassWidth * 0.08}px`,
              height: `${dimensions.glassHeight * 1.1}px`,
              top: `-${dimensions.glassHeight * 0.35}px`,
              left: "65%",
              transform: "rotate(20deg)",
              borderRadius: "4px",
              boxShadow: "inset 0 0 4px rgba(0,0,0,0.15)",
              border: "1px solid rgba(0,0,0,0.05)",
            }}
          />
        )}
      </div>

      {/* Playful cycled loading message text with beautiful entry transitions */}
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
      {size !== "sm" ? (
        <div className={dimensions.textStyle}>
          <AnimatePresence mode="wait">
            <motion.p
              key={displayedText}
<<<<<<< HEAD
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.4, ease: "circOut" }}
              className="truncate drop-shadow-sm"
=======
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="truncate"
>>>>>>> 95c87761ee492ce4549d0998a08e126486cde738
            >
              {displayedText}
            </motion.p>
          </AnimatePresence>
        </div>
      ) : (
        <span className={dimensions.textStyle}>{displayedText}</span>
      )}
    </div>
  );
}
