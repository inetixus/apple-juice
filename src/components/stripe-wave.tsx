"use client";

import waveDesktop1 from "../lib/wave/wave-fallback-desktop.webp";
import waveDesktop2 from "../lib/wave/wave-fallback-desktop (1).webp";
import waveTablet1 from "../lib/wave/wave-fallback-tablet.webp";
import waveMobile1 from "../lib/wave/wave-fallback-mobile.webp";

/**
 * Static Stripe-style wave backdrop (pre-rendered WebP only — no canvas rAF).
 */
export function StripeWave() {
  return (
    <div
      className="absolute top-0 right-0 w-full h-[100vh] pointer-events-none z-0 select-none"
      style={{
        maskImage:
          "linear-gradient(to bottom, black 0%, black 82%, rgba(0,0,0,0.65) 92%, rgba(0,0,0,0.25) 97%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 0%, black 82%, rgba(0,0,0,0.65) 92%, rgba(0,0,0,0.25) 97%, transparent 100%)",
      }}
    >
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-22 mix-blend-screen overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 60%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.15) 96%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 60%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.15) 96%, rgba(0,0,0,0) 100%)",
        }}
      >
        <img
          src={waveDesktop1.src}
          alt=""
          className="hidden md:block absolute top-0 right-0 w-full h-full object-cover opacity-60 scale-105 pointer-events-none"
          loading="lazy"
          decoding="async"
        />
        <img
          src={waveDesktop2.src}
          alt=""
          className="hidden md:block absolute top-12 right-0 w-full h-full object-cover opacity-50 scale-110 pointer-events-none"
          loading="lazy"
          decoding="async"
        />

        <img
          src={waveTablet1.src}
          alt=""
          className="hidden sm:block md:hidden absolute top-0 right-0 w-full h-full object-cover opacity-60 scale-105 pointer-events-none"
          loading="lazy"
          decoding="async"
        />

        <img
          src={waveMobile1.src}
          alt=""
          className="sm:hidden absolute top-0 right-0 w-full h-full object-cover opacity-70 scale-105 pointer-events-none"
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

export default StripeWave;
