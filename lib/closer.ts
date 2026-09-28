import type { Meeting, Prospect } from "./types";
import { stageById, weightedValue } from "./hormozi";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ALPHA CLOSER OS — le compagnon de tournée terrain.
 *
 * Ici vivent les calculs purs : la « chaleur » d'un prospect (qui closer
 * en premier), la tournée du jour (RDV réels joints aux fiches), les
 * liens de navigation (Google Maps deeplinks — fiables sur mobile, zéro
 * clé API), et le brief tactique déterministe (l'IA raffine, la doctrine
 * ne dépend jamais d'elle).
 * ─────────────────────────────────────────────────────────────────────
 */

/** Chaleur 0–100 : probabilité (le futur) > confiance (le lien) > affinité. */
export function heat(p: Prospect): number {
  const h = 0.45 * p.probability + 0.35 * p.trust + 0.2 * p.likeness;
  return Math.max(0, Math.min(100, Math.round(h)));
}

export type HeatTone = "green" | "amber" | "red";
export const heatTone = (h: number): HeatTone => (h >= 80 ? "green" : h >= 65 ? "amber" : "red");

/** Couleurs signal (tokens tailwind.config) — pour les SVG inline (rings, badges). */
export const HEAT_HEX: Record<HeatTone, string> = {
  green: "#86C06A",
  amber: "#E0AC46",
  red: "#E5564E",
};

export interface TourStop {
  meeting: Meeting;
  prospect: Prospect;
  order: number;
  heat: number;
  /** Adresse à naviguer : lieu du RDV, sinon « entreprise, ville ». */
  place: string;
}

const sameLocalDay = (iso: string, ref: Date) => {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
};

/** La tournée du jour : RDV d'aujourd'hui non faits, dans l'ordre horaire. */
export function buildTour(meetings: Meeting[], prospects: Prospect[], now = new Date()): TourStop[] {
  return meetings
    .filter((m) => !m.done && sameLocalDay(m.date, now))
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((m) => {
      const p = prospects.find((x) => x.id === m.prospectId);
      if (!p) return [];
      return [{ meeting: m, prospect: p, order: 0, heat: heat(p), place: m.location?.trim() || `${p.company}, ${p.city}` }];
    })
    .map((s, i) => ({ ...s, order: i + 1 }));
}

/** Pas de RDV posé ? Tournée suggérée : les fiches les plus chaudes à aller voir. */
export function suggestedStops(prospects: Prospect[], limit = 4): { prospect: Prospect; heat: number; place: string }[] {
  return prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu")
    .map((p) => ({ prospect: p, heat: heat(p), place: `${p.company}, ${p.city}` }))
    .sort((a, b) => b.heat - a.heat || weightedValue(b.prospect) - weightedValue(a.prospect))
    .slice(0, limit);
}

/** Deeplink Google Maps vers UN lieu (fiable iOS/Android, zéro clé API). */
export const mapsUrl = (place: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

/** Deeplink itinéraire multi-étapes (position actuelle → étapes dans l'ordre). */
export function mapsRouteUrl(places: string[]): string {
  const parts = places.map((p) => encodeURIComponent(p)).join("/");
  return `https://www.google.com/maps/dir/${parts}`;
}

/** Potentiel € de la tournée (valeur pondérée par la probabilité). */
export const tourPotential = (stops: { prospect: Prospect }[]) =>
  stops.reduce((sum, s) => sum + weightedValue(s.prospect), 0);

/** Résumé compact de la tournée — contexte pour le brief IA. */
export function tourSummary(stops: TourStop[]): string {
  return stops
    .map((s) => {
      const p = s.prospect;
      const time = new Date(s.meeting.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      return [
        `${s.order}. ${time} — ${p.company} (${p.sector}, ${p.city}) · RDV ${s.meeting.kind}`,
        `   heat ${s.heat}/100 · étape ${stageById(p.stage).label} · valeur pondérée ${Math.round(weightedValue(p))} € · taxe ${p.ignoranceTax} €/mois`,
        `   croyances ${p.croyances.produit}/${p.croyances.soutien}/${p.croyances.pourLui} · démo avant prix : ${p.demoShownBeforePrice ? "oui" : "NON"} · objections ouvertes : ${p.objections.filter((o) => o.status !== "traitee").map((o) => o.label).join(", ") || "aucune"}`,
      ].join("\n");
    })
    .join("\n");
}

/**
 * Brief tactique déterministe — affiché instantanément, hors-ligne compris.
 * L'IA (« Affiner ») peut l'enrichir, jamais le remplacer structurellement.
 */
export function fallbackBriefing(stops: TourStop[]): string {
  if (stops.length === 0) return "• Aucun RDV posé aujourd'hui. Priorité : décrocher des créneaux (relances + tournée improvisée sur les fiches chaudes).";
  const prio = [...stops].sort((a, b) => weightedValue(b.prospect) * b.heat - weightedValue(a.prospect) * a.heat)[0];
  const taxed = [...stops].sort((a, b) => b.prospect.ignoranceTax - a.prospect.ignoranceTax)[0];
  const traps = stops.flatMap((s) => {
    const p = s.prospect;
    const t: string[] = [];
    if (!p.demoShownBeforePrice && (p.stage === "offre" || p.stage === "redzone"))
      t.push(`${p.company} : le prix a été évoqué SANS démo mobile — rejoue la démo avant de reparler chiffres`);
    if (p.objections.some((o) => o.status === "bloquante"))
      t.push(`${p.company} : objection bloquante ouverte — isole la croyance cassée avant de pousser`);
    return t;
  });
  return [
    `• Ordre : suis l'horaire (${stops.length} étape${stops.length > 1 ? "s" : ""}) — chaque RDV se termine par un next step DATÉ, quoi qu'il arrive.`,
    `• Priorité : ${prio.prospect.company} (heat ${prio.heat}, ${Math.round(weightedValue(prio.prospect))} € pondérés) — c'est LE closing du jour, garde de l'énergie pour lui.`,
    `• Angle : la Taxe d'Ignorance — ${taxed.prospect.company} perd ≈ ${taxed.prospect.ignoranceTax.toLocaleString("fr-FR")} €/mois à ne rien faire. Émotion d'abord (démo mobile), logique ensuite.`,
    `• Vigilance : ${traps[0] ?? "aucun piège doctrine détecté — reste sur le script, démo avant prix, toujours."}`,
  ].join("\n");
}
