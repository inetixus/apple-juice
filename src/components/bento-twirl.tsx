"use client";

import waveDesktop from "../lib/wave/wave-fallback-desktop.webp";

/**
 * An animated "piece" of the Stripe wave shown inside a bento card.
 *
 * Renders the real pre-rendered Stripe wave WebP, scaled up and positioned so
 * each card reveals a different fragment of the same wave. Two layers ride on
 * top of each other (drifting in opposite directions) so the ribbons feel like
 * living, flowing light rather than a frozen crop. The colour washes (set per
 * card via `hueRotate`) tint each rank differently, and everything blends with
 * `screen` so only the bright ribbons show through.
 */
export function BentoTwirl({
  /** Background-position for the wave crop, e.g. "20% 30%". */
  position = "50% 50%",
  /** Extra scale so each card shows a tighter or looser slice. */
  scale = 2.2,
  /** Optional hue rotation (deg) to vary the colours per card. */
  hueRotate = 0,
  /** Animate the ribbons (slow flowing pan + hue drift). */
  animated = true,
  /** Full loop duration in seconds. Lower = faster flow. */
  duration = 26,
  className = "",
}: {
  position?: string;
  scale?: number;
  hueRotate?: number;
  animated?: boolean;
  duration?: number;
  className?: string;
}) {
  const size = `${scale * 100}%`;

  return (
    <div
      className={`absolute inset-0 h-full w-full overflow-hidden ${className}`}
      aria-hidden
      style={{ mixBlendMode: "screen" }}
    >
      {/* keyframes (scoped, injected once per render — cheap & dedup-safe by name) */}
      <style>{`
        @keyframes bentoTwirlDriftA {
          0%   { background-position: var(--bt-pos); filter: hue-rotate(var(--bt-hue)) saturate(1.1); }
          50%  { background-position: var(--bt-pos-b); filter: hue-rotate(calc(var(--bt-hue) + 28deg)) saturate(1.25); }
          100% { background-position: var(--bt-pos); filter: hue-rotate(var(--bt-hue)) saturate(1.1); }
        }
        @keyframes bentoTwirlDriftB {
          0%   { background-position: var(--bt-pos-b); filter: hue-rotate(calc(var(--bt-hue) + 40deg)) saturate(1.15); }
          50%  { background-position: var(--bt-pos); filter: hue-rotate(calc(var(--bt-hue) - 24deg)) saturate(1.3); }
          100% { background-position: var(--bt-pos-b); filter: hue-rotate(calc(var(--bt-hue) + 40deg)) saturate(1.15); }
        }
        @keyframes bentoTwirlBreathe {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50%      { transform: scale(1.08) rotate(2deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bento-twirl-layer { animation: none !important; }
        }
      `}</style>

      {/* Layer A — primary flowing ribbon */}
      <div
        className="bento-twirl-layer absolute inset-0 h-full w-full"
        style={
          {
            backgroundImage: `url(${waveDesktop.src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: size,
            backgroundPosition: position,
            "--bt-pos": position,
            "--bt-pos-b": shiftPosition(position),
            "--bt-hue": `${hueRotate}deg`,
            filter: `hue-rotate(${hueRotate}deg) saturate(1.1)`,
            animation: animated
              ? `bentoTwirlDriftA ${duration}s ease-in-out infinite, bentoTwirlBreathe ${duration * 1.6}s ease-in-out infinite`
              : undefined,
            willChange: animated ? "background-position, filter, transform" : undefined,
          } as React.CSSProperties
        }
      />

      {/* Layer B — counter-drifting accent ribbon for extra "twirl" depth */}
      <div
        className="bento-twirl-layer absolute inset-0 h-full w-full"
        style={
          {
            backgroundImage: `url(${waveDesktop.src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${scale * 118}%`,
            backgroundPosition: shiftPosition(position),
            "--bt-pos": position,
            "--bt-pos-b": shiftPosition(position),
            "--bt-hue": `${hueRotate + 130}deg`,
            mixBlendMode: "screen",
            opacity: 0.55,
            filter: `hue-rotate(${hueRotate + 130}deg) saturate(1.1)`,
            animation: animated
              ? `bentoTwirlDriftB ${duration * 1.35}s ease-in-out infinite`
              : undefined,
            willChange: animated ? "background-position, filter" : undefined,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

/** Nudge a "x% y%" background position so layers/keyframes drift apart. */
function shiftPosition(position: string): string {
  const parts = position.trim().split(/\s+/);
  const bump = (token: string, delta: number) => {
    const m = token.match(/^(-?\d+(?:\.\d+)?)(%|px)?$/);
    if (!m) return token;
    const value = parseFloat(m[1]) + delta;
    return `${value}${m[2] ?? "%"}`;
  };
  if (parts.length === 2) {
    return `${bump(parts[0], 14)} ${bump(parts[1], -10)}`;
  }
  return position;
}

export default BentoTwirl;
