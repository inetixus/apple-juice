import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      animation: {
        shine: "shine 4s linear infinite",
      },
      keyframes: {
        shine: {
          "0%": { "background-position": "200% center" },
          "100%": { "background-position": "-200% center" },
        },
      },
    },
  },
  plugins: [],
};

export default config;