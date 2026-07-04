import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0908",
          900: "#12100e",
          850: "#171412",
          800: "#1c1917",
          700: "#292420",
          600: "#3a332d",
          500: "#57504a",
        },
        paper: {
          DEFAULT: "#e8e2d9",
          dim: "#b8b0a4",
          faint: "#7d766c",
        },
        bronze: {
          300: "#d9bc8c",
          400: "#c8a76b",
          500: "#b08d57",
          600: "#8f6f42",
          700: "#6e5432",
          900: "#2e2416",
        },
        signal: {
          green: "#8aa87a",
          red: "#b0645c",
          amber: "#c8a76b",
        },
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        bronze: "0 0 0 1px rgba(176,141,87,.25), 0 8px 32px -12px rgba(176,141,87,.25)",
        card: "0 1px 0 rgba(232,226,217,.04) inset, 0 8px 24px -16px rgba(0,0,0,.8)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".55" },
        },
      },
      animation: {
        "fade-up": "fade-up .35s ease both",
        "pulse-ring": "pulse-ring 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
