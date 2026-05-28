"use client";

import { useRef, useEffect } from "react";
import waveDesktop1 from "../lib/wave/wave-fallback-desktop.webp";
import waveDesktop2 from "../lib/wave/wave-fallback-desktop (1).webp";
import waveTablet1 from "../lib/wave/wave-fallback-tablet.webp";
import waveTablet2 from "../lib/wave/wave-fallback-tablet (1).webp";
import waveMobile1 from "../lib/wave/wave-fallback-mobile.webp";
import waveMobile2 from "../lib/wave/wave-fallback-mobile (1).webp";

export function StripeWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let width = (canvas.width = Math.floor(window.innerWidth / 4));
    let height = (canvas.height = Math.floor((canvas.parentElement?.clientHeight || window.innerHeight * 3) / 4));

    // Pause animation when off-screen to free GPU for Spline sections
    const observer = new IntersectionObserver(
      ([entry]) => { isVisible = entry.isIntersecting; },
      { rootMargin: "200px" }
    );
    observer.observe(canvas);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = Math.floor(window.innerWidth / 4);
      height = canvas.height = Math.floor((canvas.parentElement?.clientHeight || window.innerHeight * 3) / 4);
    };
    window.addEventListener("resize", handleResize);

    // Ribbons shifted further down and spaced wider to prevent screen-blend white washout
    const ribbons = [
      {
        yBase: height * 0.16,
        amplitude: 75,
        speed: 0.0014,
        frequency: 0.0006,
        colorStart: "rgba(255, 0, 128, 0.32)", // Vibrant Stripe Pink
        colorEnd: "rgba(255, 126, 0, 0)",
        thickness: 160,
        phase: 0,
        diagonalFactor: 0.45,
      },
      {
        yBase: height * 0.20,
        amplitude: 105,
        speed: 0.0011,
        frequency: 0.0004,
        colorStart: "rgba(139, 92, 246, 0.30)", // Deep Purple
        colorEnd: "rgba(59, 130, 246, 0)",
        thickness: 200,
        phase: Math.PI * 0.25,
        diagonalFactor: 0.48,
      },
      {
        yBase: height * 0.24,
        amplitude: 90,
        speed: 0.0018,
        frequency: 0.0008,
        colorStart: "rgba(204, 255, 0, 0.28)", // Apple Juice Acid Lime
        colorEnd: "rgba(0, 240, 255, 0)",
        thickness: 150,
        phase: Math.PI * 0.5,
        diagonalFactor: 0.42,
      },
      {
        yBase: height * 0.28,
        amplitude: 70,
        speed: 0.0008,
        frequency: 0.0003,
        colorStart: "rgba(0, 240, 255, 0.30)", // Electric Cyan
        colorEnd: "rgba(139, 92, 246, 0)",
        thickness: 180,
        phase: Math.PI * 0.75,
        diagonalFactor: 0.5,
      },
      {
        yBase: height * 0.32,
        amplitude: 80,
        speed: 0.0013,
        frequency: 0.0005,
        colorStart: "rgba(236, 72, 153, 0.30)", // Rose
        colorEnd: "rgba(251, 191, 36, 0)",
        thickness: 160,
        phase: Math.PI * 1.0,
        diagonalFactor: 0.46,
      },
      {
        yBase: height * 0.36,
        amplitude: 95,
        speed: 0.001,
        frequency: 0.0007,
        colorStart: "rgba(139, 92, 246, 0.28)", // Secondary Purple/Blue
        colorEnd: "rgba(0, 240, 255, 0)",
        thickness: 190,
        phase: Math.PI * 1.25,
        diagonalFactor: 0.44,
      },
      {
        yBase: height * 0.40,
        amplitude: 75,
        speed: 0.0015,
        frequency: 0.0009,
        colorStart: "rgba(204, 255, 0, 0.25)", // Secondary Lime/Teal
        colorEnd: "rgba(255, 0, 128, 0)",
        thickness: 140,
        phase: Math.PI * 1.5,
        diagonalFactor: 0.47,
      }
    ];

    let t = 0;

    const animate = () => {
      if (!ctx || !canvas) return;

      // Skip rendering when off-screen to free GPU for other elements
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Clean overlapping screen composite mode
      ctx.globalCompositeOperation = "screen";

      t += 1.0;

      ribbons.forEach((ribbon) => {
        ctx.beginPath();

        // Elegant linear gradient
        const grad = ctx.createLinearGradient(0, 0, width, height * 0.85);
        grad.addColorStop(0, ribbon.colorStart);
        grad.addColorStop(0.85, ribbon.colorEnd);

        ctx.strokeStyle = grad;
        ctx.lineWidth = ribbon.thickness;
        ctx.lineCap = "round";

        const points = 10;
        const startX = -200;
        const endX = width + 200;
        const drawWidth = endX - startX;

        for (let i = 0; i <= points; i++) {
          const x = startX + (drawWidth / points) * i;
          
          // Slant downwards from top-right to bottom-left
          const diagonalSlope = x * ribbon.diagonalFactor;
          
          const angle1 = t * ribbon.speed + i * (ribbon.frequency * 150) + ribbon.phase;
          const angle2 = t * (ribbon.speed * 0.8) - i * (ribbon.frequency * 100) + ribbon.phase * 1.4;
          const waveHeight = Math.sin(angle1) * ribbon.amplitude + Math.cos(angle2) * (ribbon.amplitude * 0.35);
          
          const y = ribbon.yBase + waveHeight + diagonalSlope;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevX = startX + (drawWidth / points) * (i - 1);
            const prevDiagonalSlope = prevX * ribbon.diagonalFactor;
            const prevAngle1 = t * ribbon.speed + (i - 1) * (ribbon.frequency * 150) + ribbon.phase;
            const prevAngle2 = t * (ribbon.speed * 0.8) - (i - 1) * (ribbon.frequency * 100) + ribbon.phase * 1.5;
            const prevWaveHeight = Math.sin(prevAngle1) * ribbon.amplitude + Math.cos(prevAngle2) * (ribbon.amplitude * 0.35);
            const prevY = ribbon.yBase + prevWaveHeight + prevDiagonalSlope;
            
            const xc = (prevX + x) / 2;
            const yc = (prevY + y) / 2;
            ctx.quadraticCurveTo(prevX, prevY, xc, yc);
          }
        }

        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute top-0 right-0 w-full h-[300vh] pointer-events-none overflow-hidden z-0 select-none">
      {/* Dynamic breathing float & color morph CSS keyframes */}
      <style>{`
        @keyframes waveFloat {
          0% { transform: translateY(0px) scale(1.05) rotate(0deg); filter: hue-rotate(0deg) saturate(1.4); }
          50% { transform: translateY(18px) scale(1.08) rotate(0.4deg); filter: hue-rotate(8deg) saturate(1.5); }
          100% { transform: translateY(0px) scale(1.05) rotate(0deg); filter: hue-rotate(0deg) saturate(1.4); }
        }
      `}</style>

      {/* Stripe Pre-rendered High-Fidelity Wave Backdrop (With slow hardware-accelerated float animation) */}
      <div 
        className="absolute top-0 left-0 w-full h-[120vh] pointer-events-none opacity-22 mix-blend-screen overflow-hidden"
        style={{
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 80%)",
          animation: "waveFloat 22s ease-in-out infinite"
        }}
      >
        {/* Desktop fallbacks */}
        <img
          src={waveDesktop1.src}
          alt=""
          className="hidden md:block absolute top-0 right-0 w-full h-full object-cover opacity-60 scale-105 pointer-events-none"
        />
        <img
          src={waveDesktop2.src}
          alt=""
          className="hidden md:block absolute top-12 right-0 w-full h-full object-cover opacity-50 scale-110 pointer-events-none"
        />

        {/* Tablet fallbacks */}
        <img
          src={waveTablet1.src}
          alt=""
          className="hidden sm:block md:hidden absolute top-0 right-0 w-full h-full object-cover opacity-60 scale-105 pointer-events-none"
        />
        <img
          src={waveTablet2.src}
          alt=""
          className="hidden sm:block md:hidden absolute top-10 right-0 w-full h-full object-cover opacity-50 scale-110 pointer-events-none"
        />

        {/* Mobile fallbacks */}
        <img
          src={waveMobile1.src}
          alt=""
          className="sm:hidden absolute top-0 right-0 w-full h-full object-cover opacity-70 scale-105 pointer-events-none"
        />
        <img
          src={waveMobile2.src}
          alt=""
          className="sm:hidden absolute top-8 right-0 w-full h-full object-cover opacity-60 scale-110 pointer-events-none"
        />
      </div>

      {/* Dynamic, performant real-time morphing canvas ribbons layered on top */}
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-[0.95] select-none"
        style={{
          filter: "blur(48px) saturate(1.4)",
          transform: "scale(1.08)",
        }}
      />
    </div>
  );
}

export default StripeWave;
