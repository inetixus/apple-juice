/*
 * Coolicon — native port of the Framer "coolicons" vector asset
 * (https://www.framer.com/asset-urls).
 *
 * The original ships as a Framer-runtime component (imports `useSVGTemplate`,
 * `withCSS`, `cx` from the proprietary `framer` package and renders via a
 * CSS `mask`), so it can't be bundled into this Next.js app. The underlying
 * artwork is a single stroked double-wave glyph; this component inlines that
 * exact SVG path and exposes the same controls the Framer version did:
 * `color`, `strokeWidth`, and `opacity`.
 */

import { forwardRef, type SVGProps } from "react";

export type CooliconProps = {
  /** Stroke color of the glyph. */
  color?: string;
  /** Stroke width. Framer default was 2. */
  strokeWidth?: number;
  /** Glyph opacity 0–1. */
  opacity?: number;
  /** Rendered size in px (square-ish; preserves the 24×23 aspect). */
  size?: number;
} & Omit<SVGProps<SVGSVGElement>, "opacity" | "color" | "strokeWidth">;

export const Coolicon = forwardRef<SVGSVGElement, CooliconProps>(
  function Coolicon(
    { color = "currentColor", strokeWidth = 2, opacity = 1, size = 24, ...rest },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        width={size}
        height={(size * 23) / 24}
        viewBox="0 0 24 23"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="presentation"
        display="block"
        {...rest}
      >
        <g opacity={opacity}>
          <path
            d="M 5.891 0.22 C 4.987 -0.073 4.013 -0.073 3.109 0.22 C 2.206 0.514 1.418 1.086 0.859 1.855 C 0.301 2.624 0 3.55 0 4.5 C 0 5.45 0.301 6.376 0.859 7.145 C 1.418 7.914 2.206 8.486 3.109 8.78 C 4.013 9.073 4.987 9.073 5.891 8.78 C 6.794 8.486 7.582 7.914 8.141 7.145 C 8.699 6.376 9 5.45 9 4.5 C 9 3.55 9.301 2.624 9.859 1.855 C 10.418 1.086 11.206 0.514 12.109 0.22 C 13.013 -0.073 13.987 -0.073 14.891 0.22 C 15.794 0.514 16.582 1.086 17.141 1.855 C 17.699 2.624 18 3.55 18 4.5 C 18 5.45 17.699 6.376 17.141 7.145 C 16.582 7.914 15.794 8.486 14.891 8.78 C 13.987 9.073 13.013 9.073 12.109 8.78"
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(3 7)"
          />
        </g>
      </svg>
    );
  },
);
