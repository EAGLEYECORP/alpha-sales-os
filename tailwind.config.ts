import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0807",
          900: "#15110D",
          850: "#1A1510",
          800: "#201B15",
          700: "#2B241C",
          600: "#3A3227",
          500: "#5A544B",
        },
        paper: {
          DEFAULT: "#F3EEE4",
          dim: "#A79F92",
          faint: "#8E877B",
        },
        bronze: {
          300: "#F2E2BC",
          400: "#E8C98A",
          500: "#DDB36A",
          600: "#B98F4B",
          700: "#8A6A38",
          900: "#2E2415",
        },
        signal: {
          green: "#86C06A",
          red: "#E5564E",
          amber: "#E0AC46",
          blue: "#6AA0D8",
        },
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "'Inter Tight'", "system-ui", "sans-serif"],
        body: ["'Inter Tight'", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        bronze: "0 0 0 1px rgba(232,201,138,.28), 0 8px 32px -12px rgba(232,201,138,.30)",
        gold: "0 8px 24px -8px rgba(232,201,138,.55)",
        card: "0 1px 0 rgba(243,238,228,.04) inset, 0 12px 32px -18px rgba(0,0,0,.85)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".55" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-300px 0" },
          "100%": { backgroundPosition: "300px 0" },
        },
      },
      animation: {
        "fade-up": "fade-up .6s cubic-bezier(.16,1,.3,1) both",
        "pulse-ring": "pulse-ring 2.4s ease-in-out infinite",
        floaty: "floaty 2s ease-in-out infinite",
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
  plugins: [],
};
export default config;
