import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export const dateFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export const dateTimeFr = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
export const daysAhead = (n: number) => new Date(Date.now() + n * 864e5).toISOString();

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN RENDEZ-VOUS À UNE HEURE OÙ L'APP ELLE-MÊME INTERDIT D'APPELER.
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
 *
 * `daysAhead` conserve l'HEURE COURANTE. Les cinq rendez-vous de
 * démonstration en héritaient : une démo ouverte à 23 h affichait
 * « Closing — Le Bouchon des Canuts (23:23) » sur `/aujourdhui`… à côté du
 * bandeau « Hors fenêtre d'appel — avant 9h ou après 18h, on ne joint pas un
 * dirigeant de TPE ». Le produit se contredisait dans le même écran.
 *
 * Ça ne casse aucune donnée réelle — c'est du jeu de démonstration. Mais le
 * premier bouton de l'app est « Explorer la démo », et c'est cet écran-là
 * qu'un prospect regarde. Une incohérence visible à la première seconde coûte
 * plus cher qu'un bug qu'on ne rencontre jamais.
 *
 * `heure` est en heure LOCALE : c'est celle que l'écran affiche, et donc la
 * seule qui doive tomber dans la fenêtre professionnelle.
 * ─────────────────────────────────────────────────────────────────────
 */
export const daysAheadAt = (n: number, heure: number, minute = 0) => {
  const d = new Date(Date.now() + n * 864e5);
  d.setHours(heure, minute, 0, 0);
  return d.toISOString();
};

export const isOverdue = (iso: string) => new Date(iso).getTime() < Date.now();

/** SHA-256 hex digest (Web Crypto) — used for the app-lock PIN. */
export async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const relativeFr = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 864e5);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days === -1) return "hier";
  return days > 0 ? `dans ${days} j` : `il y a ${-days} j`;
};
