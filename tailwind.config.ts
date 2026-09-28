import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic surfaces/foreground — flipped per theme via CSS vars in
        // globals.css (:root = dark, html.light = light). `ink` = surfaces,
        // `paper` = foreground; both invert between themes.
        ink: {
          950: "rgb(var(--ink-950) / <alpha-value>)",
          900: "rgb(var(--ink-900) / <alpha-value>)",
          850: "rgb(var(--ink-850) / <alpha-value>)",
          800: "rgb(var(--ink-800) / <alpha-value>)",
          700: "rgb(var(--ink-700) / <alpha-value>)",
          600: "rgb(var(--ink-600) / <alpha-value>)",
          500: "rgb(var(--ink-500) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--paper) / <alpha-value>)",
          dim: "rgb(var(--paper-dim) / <alpha-value>)",
          faint: "rgb(var(--paper-faint) / <alpha-value>)",
        },
        // Bronze accent: shades used as TEXT (300/400/500) darken on light for
        // contrast; 900 is a tint background that lightens. 600/700 are fixed.
        bronze: {
          300: "rgb(var(--bronze-300) / <alpha-value>)",
          400: "rgb(var(--bronze-400) / <alpha-value>)",
          500: "rgb(var(--bronze-500) / <alpha-value>)",
          600: "#B98F4B",
          700: "#8A6A38",
          900: "rgb(var(--bronze-900) / <alpha-value>)",
        },
        // Fixed solid-gold fill + the dark ink that always sits on it.
        gold: "#E8C98A",
        goldink: "#1B1408",
        // Signaux : tokens qui s'assombrissent en clair (lisibles sur crème),
        // gardent l'éclat en sombre. Le rouge EST le vermillon de marque.
        signal: {
          green: "rgb(var(--signal-green) / <alpha-value>)",
          red: "rgb(var(--signal-red) / <alpha-value>)",
          amber: "rgb(var(--signal-amber) / <alpha-value>)",
          blue: "rgb(var(--signal-blue) / <alpha-value>)",
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
        // Intro de marque (écran de connexion) : l'aigle surgit…
        "brand-in": {
          from: { opacity: "0", transform: "scale(.6)", filter: "blur(6px)" },
          to: { opacity: "1", transform: "scale(1)", filter: "blur(0)" },
        },
        // …et un filet d'or se déploie sous le wordmark.
        "gold-sweep": {
          from: { width: "0", opacity: "0" },
          to: { width: "120px", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up .6s cubic-bezier(.16,1,.3,1) both",
        "pulse-ring": "pulse-ring 2.4s ease-in-out infinite",
        floaty: "floaty 2s ease-in-out infinite",
        shimmer: "shimmer 1.4s infinite",
        "brand-in": "brand-in .9s cubic-bezier(.16,1,.3,1) both",
        "gold-sweep": "gold-sweep .7s .5s cubic-bezier(.16,1,.3,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
