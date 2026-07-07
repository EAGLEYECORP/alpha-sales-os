import type { Objection, Obstacle, Prospect } from "./types";
import { uid } from "./utils";

/**
 * Parsers partagés (import CSV + mapper n8n) pour les colonnes « riches » du
 * CRM Google Sheets : History (journal), Deadline (next step daté),
 * Obstacles / Objections (séparés par | ou ;).
 */

/** Journal « [2026-07-07 14:30] texte » → événements de timeline (15 derniers). */
export function parseHistory(raw: string): Prospect["events"] {
  if (!raw?.trim()) return [];
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-15)
    .map((line) => {
      const m = line.match(/^\[(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?\]\s*(.*)$/);
      const date = m ? new Date(`${m[1]}T${m[2] ?? "12:00"}:00`).toISOString() : new Date().toISOString();
      return { id: uid(), date, kind: "note" as const, summary: m ? m[3] : line };
    });
}

/** « 2026-07-10 — rappeler avant 9h » → next step daté (null si pas de date). */
export function parseDeadline(deadline: string, action = ""): Prospect["nextStep"] {
  if (!deadline?.trim()) return null;
  const m = deadline.match(/(\d{4}-\d{2}-\d{2})/);
  const label = action || deadline.replace(/\d{4}-\d{2}-\d{2}\s*[—–-]?\s*/, "").trim();
  if (m) return { date: new Date(`${m[1]}T09:00:00`).toISOString(), action: label || "Next step (CRM)" };
  return null;
}

/** « pas le temps | mon associé décide » → obstacles (couche circonstances par défaut). */
export function parseObstacles(raw: string): Obstacle[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[|;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((label) => ({ id: uid(), label, blameLayer: "circonstances" as const, resolved: false }));
}

/** « c'est cher | je dois réfléchir » → objections ouvertes (croyance 3 par défaut). */
export function parseObjections(raw: string): Objection[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[|;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((label) => ({ id: uid(), label, type: "confiance" as const, croyance: 3 as const, status: "ouverte" as const }));
}

/** « livré / en cours / maintenance » → statut de livraison normalisé. */
export function parseDelivery(raw: string): Prospect["delivery"] | undefined {
  const s = (raw ?? "").toLowerCase();
  if (!s.trim()) return undefined;
  if (s.includes("livr")) return "livre";
  if (s.includes("cours")) return "en-cours";
  if (s.includes("mainten")) return "maintenance";
  return "non-demarre";
}
