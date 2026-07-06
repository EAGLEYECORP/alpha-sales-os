"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";

/**
 * Bascule clair / sombre. `variant="rail"` = pleine largeur (sidebar dépliée),
 * `variant="icon"` = bouton carré (sidebar repliée / header mobile).
 */
export function ThemeToggle({ variant = "icon", className }: { variant?: "rail" | "icon"; className?: string }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(getTheme());
    const onTheme = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    window.addEventListener("alpha:theme", onTheme);
    return () => window.removeEventListener("alpha:theme", onTheme);
  }, []);

  const isDark = theme === "dark";
  const label = isDark ? "Passer en clair" : "Passer en sombre";
  const Icon = isDark ? Sun : Moon;

  if (variant === "rail") {
    return (
      <button
        onClick={() => setThemeState(toggleTheme())}
        aria-label={label}
        title={label}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-paper-faint transition-colors hover:bg-ink-800 hover:text-paper",
          className
        )}
      >
        <Icon size={16} /> {isDark ? "Thème clair" : "Thème sombre"}
      </button>
    );
  }

  return (
    <button
      onClick={() => setThemeState(toggleTheme())}
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center rounded-full border border-ink-600 text-paper-faint transition-colors hover:text-paper hover:border-bronze-700",
        className
      )}
    >
      <Icon size={16} />
    </button>
  );
}
