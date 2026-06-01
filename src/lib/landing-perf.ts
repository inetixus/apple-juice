/**
 * Shared landing-page performance budget (uniform light mode on all viewports).
 */

export type LandingPerfConfig = {
  medusae: { countX: number; countY: number };
  medusaeDpr: [number, number];
  enableLiquidGlass: boolean;
  enableStripeCanvas: boolean;
  enableScrollLineMotion: boolean;
  heroAutoplay: boolean;
  /** Terminal / hero demo animations (CLI showcase) */
  cliDemoAutoplay: boolean;
};

const LIGHT_DEFAULTS: LandingPerfConfig = {
  medusae: { countX: 28, countY: 16 },
  medusaeDpr: [1, 1.25],
  enableLiquidGlass: false,
  enableStripeCanvas: false,
  enableScrollLineMotion: false,
  heroAutoplay: true,
  cliDemoAutoplay: true,
};

const REDUCED_MOTION: LandingPerfConfig = {
  medusae: { countX: 20, countY: 12 },
  medusaeDpr: [1, 1],
  enableLiquidGlass: false,
  enableStripeCanvas: false,
  enableScrollLineMotion: false,
  heroAutoplay: false,
  cliDemoAutoplay: false,
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Client-side resolved config (call inside useEffect or client components). */
export function getLandingPerfConfig(): LandingPerfConfig {
  if (prefersReducedMotion()) return REDUCED_MOTION;
  return LIGHT_DEFAULTS;
}

/** SSR / initial render fallback (light defaults). */
export const LANDING_PERF = LIGHT_DEFAULTS;
