import type { Meeting, Prospect } from "./types";
import { construireJournee, parQuadrant, type Journee, type Tache } from "./priorites";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Le récap « urgent » — pour être sur le terrain sans rien lâcher.
 *
 * On ne notifie PAS tout. On notifie le cadran « faire » : urgent ET
 * important, ce qui perd de la valeur si ce n'est pas fait aujourd'hui.
 * Le reste attend l'écran Aujourd'hui — un SMS qui sonne pour une relance
 * tiède est un SMS qu'on finit par ignorer.
 *
 * `formatUrgentSMS`  : court, une ligne par tâche, pour le téléphone.
 * `formatUrgentEmail`: le même fond, respirable, avec le pourquoi.
 *
 * La logique d'urgence vit dans `lib/priorites.ts` (une seule source de
 * vérité) : le digest ne fait que la mettre en mots.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface UrgentDigest {
  /** Nombre de tâches critiques (cadran « faire »). */
  count: number;
  /** Minutes à prévoir sur ces tâches. */
  minutes: number;
  /** Valeur pondérée en jeu (€). */
  value: number;
  sms: string;
  emailSubject: string;
  emailBody: string;
  /** Les tâches critiques brutes (pour un canal tiers). */
  taches: Tache[];
}

const eur = (n: number) => Math.round(n).toLocaleString("fr-FR") + " €";

function ligne(t: Tache): string {
  const quand = t.due ? new Date(t.due).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null;
  return `• ${t.action}${quand ? ` (${quand})` : ""}`;
}

/**
 * Construit le récap depuis l'état courant. `now` injectable pour les tests.
 * Renvoie `count: 0` quand rien n'est critique — l'appelant décide alors de
 * ne PAS envoyer (un « rien d'urgent » quotidien dresse à ignorer).
 */
export function buildUrgentDigest(prospects: Prospect[], meetings: Meeting[], now = new Date()): UrgentDigest {
  const journee: Journee = construireJournee({ prospects, meetings, now });
  const critiques = parQuadrant(journee, "faire");
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const value = critiques.reduce((s, t) => s + (t.value ?? 0), 0);
  const minutes = critiques.reduce((s, t) => s + t.minutes, 0);

  const header =
    critiques.length === 0
      ? `ALPHA — rien de critique aujourd'hui (${dateLabel}).`
      : `ALPHA — ${critiques.length} priorité${critiques.length > 1 ? "s" : ""} aujourd'hui${value > 0 ? `, ${eur(value)} en jeu` : ""} :`;

  const sms = [header, ...critiques.map(ligne)].join("\n").slice(0, 600);

  const emailSubject =
    critiques.length === 0
      ? "ALPHA — journée dégagée"
      : `ALPHA — ${critiques.length} priorité${critiques.length > 1 ? "s" : ""} du jour${value > 0 ? ` (${eur(value)} en jeu)` : ""}`;

  const emailBody = [
    header,
    "",
    ...critiques.map((t) => `${ligne(t)}\n   ${t.why}`),
    "",
    critiques.length > 0
      ? `≈ ${minutes} min sur ces priorités. Le reste (relances, appels tièdes) est dans l'onglet Aujourd'hui.`
      : "Ouvre l'onglet Aujourd'hui pour la suite — souvent ça veut dire que le CRM a besoin d'une prochaine étape datée.",
  ].join("\n");

  return { count: critiques.length, minutes, value, sms, emailSubject, emailBody, taches: critiques };
}
