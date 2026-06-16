"use client";

/*
 * FloatingGameCards — game-genre cards that float around the hero prompt box,
 * gently drifting and tilting in 3D (the look from the competitor's hero, but
 * arranged AROUND the prompt rather than in a single scrolling row).
 *
 * Each card shows a game screenshot with an edge-light ring and a floating pill
 * label (icon + genre name). Clicking a card seeds the hero prompt and routes
 * into the product, matching the suggestion chips.
 *
 * IMAGES / LICENSING:
 *   Cards load their art from `/genres/<file>` in `public/`. If the file is
 *   missing, the card falls back to a themed gradient with an icon watermark,
 *   so the layout always looks finished. Only place images here that you have
 *   the right to use (your own demo-game screenshots, licensed art, or media
 *   you have permission for) — do NOT drop in screenshots of other people's
 *   games, which belong to their creators.
 *
 * Motion: each card has its own float/tilt loop (staggered) so the cluster
 * feels alive. Hidden on small screens (the prompt box takes the full width);
 * respects reduced-motion (cards hold still).
 */

import {
  Swords,
  Hammer,
  Skull,
  Ghost,
  Car,
  Castle,
  Crosshair,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

type Genre = {
  label: string;
  icon: LucideIcon;
  prompt: string;
  /** Image filename under public/genres/ (optional — falls back to gradient). */
  image?: string;
  /** Two-stop gradient fallback for the card face. */
  from: string;
  to: string;
};

const GENRES: Record<string, Genre> = {
  oil: { label: "Oil tycoon", icon: Hammer, prompt: "Build me an oil tycoon with drills, refineries, and rebirths.", image: "oil.webp", from: "#33321b", to: "#1c1b0a" },
  shooter: { label: "Shooter", icon: Crosshair, prompt: "Build me a tactical shooter with weapons and rounds.", image: "shooter.webp", from: "#3a1b1b", to: "#1f0a0a" },
  bedwars: { label: "Bedwars", icon: Swords, prompt: "Build me a bedwars game with teams and bed defense.", image: "bedwars.webp", from: "#1b2a3a", to: "#0a141f" },
  zombie: { label: "Zombie survival", icon: Skull, prompt: "Build me a zombie survival round system.", image: "zombie.webp", from: "#2a1b3a", to: "#160a1f" },
  pets: { label: "Pet simulator", icon: Ghost, prompt: "Build me a pet simulator with hatch eggs.", image: "pets.webp", from: "#3a2f1b", to: "#1f180a" },
  police: { label: "Police chase", icon: Car, prompt: "Build me a cops-and-robbers police chase game.", image: "police.webp", from: "#1b2a3a", to: "#0a141f" },
  mansion: { label: "Mansion tycoon", icon: Castle, prompt: "Build me a mansion tycoon with upgrades.", image: "mansion.webp", from: "#33321b", to: "#1c1b0a" },
  pvp: { label: "PvP arena", icon: Trophy, prompt: "Build me a PvP arena with a matchmaking queue.", image: "pvp.webp", from: "#2a1b2f", to: "#170a19" },
};

// Placement of each floating card relative to the centered prompt box. `side`
// keeps cards clear of the prompt; values are % of the wrapper. `depth` scales
// size + blur so some sit "further back". `dur`/`delay` desync the float loops.
type Placement = {
  genre: keyof typeof GENRES;
  top: string;
  side: "left" | "right";
  offset: string; // distance from that side edge
  rotate: number;
  depth: number; // 0.8 (back) … 1 (front)
  dur: number;
  delay: number;
};

const PLACEMENTS: Placement[] = [
  { genre: "oil", top: "2%", side: "left", offset: "1%", rotate: -8, depth: 0.92, dur: 7, delay: 0 },
  { genre: "shooter", top: "40%", side: "left", offset: "-3%", rotate: 6, depth: 1, dur: 8.5, delay: -1.4 },
  { genre: "bedwars", top: "72%", side: "left", offset: "5%", rotate: -5, depth: 0.84, dur: 9, delay: -3 },
  { genre: "zombie", top: "0%", side: "right", offset: "2%", rotate: 7, depth: 0.9, dur: 7.8, delay: -0.8 },
  { genre: "pets", top: "38%", side: "right", offset: "-3%", rotate: -6, depth: 1, dur: 8, delay: -2.2 },
  { genre: "police", top: "70%", side: "right", offset: "4%", rotate: 5, depth: 0.86, dur: 9.4, delay: -4 },
];

export function FloatingGameCards({ signedIn }: { signedIn: boolean }) {
  const go = useCallback(
    (prompt: string) => {
      try {
        window.localStorage.setItem("aj_pending_prompt", prompt);
      } catch {
        /* ignore quota */
      }
      window.location.href = signedIn ? "/dashboard" : "/login";
    },
    [signedIn],
  );

  return (
    <div
      aria-hidden={false}
      className="pointer-events-none absolute inset-0 -z-0 hidden lg:block"
    >
      {PLACEMENTS.map((p, i) => {
        const g = GENRES[p.genre];
        return (
          <FloatingCard
            key={`${p.genre}-${i}`}
            genre={g}
            placement={p}
            onClick={() => go(g.prompt)}
          />
        );
      })}

      <style jsx>{`
        @keyframes fgc-float {
          0%,
          100% {
            transform: translateY(0) rotate(var(--rot)) rotateY(0deg);
          }
          50% {
            transform: translateY(-16px) rotate(calc(var(--rot) + 1.5deg))
              rotateY(10deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.fgc-card) {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function FloatingCard({
  genre,
  placement,
  onClick,
}: {
  genre: Genre;
  placement: Placement;
  onClick: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const Icon = genre.icon;
  const w = Math.round(168 * placement.depth);
  const h = Math.round(220 * placement.depth);
  const showImage = !!genre.image && imgOk;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Build a ${genre.label} game`}
      className="fgc-card group pointer-events-auto absolute overflow-hidden rounded-3xl outline-none"
      style={{
        top: placement.top,
        [placement.side]: placement.offset,
        width: w,
        height: h,
        // CSS var consumed by the float keyframe.
        ["--rot" as string]: `${placement.rotate}deg`,
        transform: `rotate(${placement.rotate}deg)`,
        animation: `fgc-float ${placement.dur}s ease-in-out ${placement.delay}s infinite`,
        filter: placement.depth < 0.9 ? "blur(0.4px)" : "none",
        opacity: 0.92 + (placement.depth - 0.84) * 0.5,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Image or gradient fallback */}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/genres/${genre.image}`}
          alt={genre.label}
          draggable={false}
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(155deg, ${genre.from}, ${genre.to})` }}
          />
          <Icon
            className="absolute -right-3 -top-3 text-white/[0.06]"
            style={{ width: 92, height: 92 }}
            strokeWidth={1.5}
          />
        </>
      )}

      {/* Drop shadow + lift base */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{ boxShadow: "0 18px 40px -24px rgba(0,0,0,0.85)" }}
      />

      {/* Lime sheen on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(204,255,0,0.18), transparent 60%)",
        }}
      />

      {/* Edge-light ring */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          padding: "1.5px",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.4) 22%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 75%)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Floating pill label */}
      <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5">
        <div className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#0d0f14]/90 px-3 py-2 backdrop-blur-md border border-white/10 shadow-[0_6px_16px_-10px_rgba(0,0,0,0.6)]">
          <Icon className="h-4 w-4 text-[#ccff00]" />
          <span className="whitespace-nowrap text-[12px] font-semibold text-white/90 leading-none tracking-[-0.01em]">
            {genre.label}
          </span>
        </div>
      </div>
    </button>
  );
}
