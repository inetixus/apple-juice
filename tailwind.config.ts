// @ts-ignore
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        inter: ["var(--font-inter)"],
        space: ["var(--font-space)"],
      },
      animation: {
        shine: "shine 4s linear infinite",
        wave: "wave 3s linear infinite",
        "wave-fast": "wave 2s linear infinite",
        "blob-drift": "blobDrift 25s ease-in-out infinite",
        "blob-drift-reverse": "blobDriftReverse 30s ease-in-out infinite",
        "fade-up": "fadeUp 0.8s ease-out forwards",
        "fade-up-delay": "fadeUp 0.8s ease-out 0.15s forwards",
        "fade-up-delay-2": "fadeUp 0.8s ease-out 0.3s forwards",
        "slide-toggle": "slideToggle 0.3s ease-in-out",
      },
      keyframes: {
        shine: {
          "0%": { "background-position": "200% center" },
          "100%": { "background-position": "-200% center" },
        },
        wave: {
          "0%": { "background-position": "200% 0" },
          "100%": { "background-position": "0% 0" },
        },
        blobDrift: {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)", opacity: "0.4" },
          "25%": { transform: "translate(5%, -8%) scale(1.05)", opacity: "0.35" },
          "50%": { transform: "translate(-3%, 5%) scale(0.95)", opacity: "0.45" },
          "75%": { transform: "translate(7%, 3%) scale(1.02)", opacity: "0.38" },
        },
        blobDriftReverse: {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)", opacity: "0.4" },
          "25%": { transform: "translate(-6%, 5%) scale(0.97)", opacity: "0.45" },
          "50%": { transform: "translate(4%, -6%) scale(1.06)", opacity: "0.35" },
          "75%": { transform: "translate(-3%, -4%) scale(0.98)", opacity: "0.42" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideToggle: {
          "0%": { transform: "translateX(-2px)", opacity: "0.8" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;