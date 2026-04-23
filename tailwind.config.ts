import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Rich indigo-navy palette inspired by premium dark UIs
        navy: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#1e1b4b',
          900: '#151336',
          950: '#0c0a20',
        },
        // Accent — warm red-orange for Apple Juice brand
        juice: {
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      backgroundImage: {
        'hero-gradient':
          'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(99,102,241,0.18) 0%, transparent 70%), ' +
          'radial-gradient(ellipse 50% 50% at 80% 20%, rgba(139,92,246,0.10) 0%, transparent 60%), ' +
          'radial-gradient(ellipse 40% 30% at 20% 80%, rgba(99,102,241,0.06) 0%, transparent 50%)',
      },
      animation: {
        'fade-up':    'fadeUp 0.7s ease-out both',
        'fade-up-lg': 'fadeUp 0.9s 0.15s ease-out both',
        'float':      'float 6s ease-in-out infinite',
        'glow':       'glow 4s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        glow: {
          '0%':   { opacity: '0.4' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;