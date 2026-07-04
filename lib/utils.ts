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

export const isOverdue = (iso: string) => new Date(iso).getTime() < Date.now();

export const relativeFr = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.round(diff / 864e5);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days === -1) return "hier";
  return days > 0 ? `dans ${days} j` : `il y a ${-days} j`;
};
