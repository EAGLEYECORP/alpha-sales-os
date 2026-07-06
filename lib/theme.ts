"use client";

/**
 * Thème clair / sombre. Sombre = défaut marque (encre & or). Le choix est
 * stocké dans le navigateur et appliqué AVANT le premier paint (script inline
 * dans le <head>) pour éviter tout flash.
 */
export type Theme = "light" | "dark";

const KEY = "alpha_theme";

/** Script injecté dans le <head> — applique la classe avant hydratation. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');var d=(t==='light')?'light':'dark';var c=document.documentElement.classList;c.remove('light','dark');c.add(d);}catch(e){document.documentElement.classList.add('dark');}})();`;

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const t = window.localStorage.getItem(KEY);
  return t === "light" || t === "dark" ? t : "dark";
}

export function applyTheme(t: Theme): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.remove("light", "dark");
  el.classList.add(t);
  try {
    window.localStorage.setItem(KEY, t);
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new CustomEvent("alpha:theme", { detail: t }));
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
