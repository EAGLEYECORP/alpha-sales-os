import type { Prospect, Meeting } from "./types";
import { fenetreOuverte } from "./conformite";
import { vitalSigns } from "./vital-signs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUI MÉRITE DE FAIRE VIBRER UN TÉLÉPHONE.
 *
 * Une notification hors-app n'est pas un rappel de plus : c'est une
 * interruption. Elle vaut le coup si l'action est faisable MAINTENANT et
 * qu'elle coûte quelque chose de ne pas la faire. Sinon elle apprend à
 * l'opérateur à ignorer nos notifications — et le jour où une seule compte
 * vraiment, elle passe inaperçue.
 *
 * Trois règles dures, dans cet ordre :
 *   1. JAMAIS hors fenêtre utile (nuit, week-end) — on réutilise les
 *      fenêtres de `lib/conformite.ts`, celles qui bornent déjà les appels.
 *   2. UNE seule notification par passage. Deux notifications simultanées,
 *      c'est zéro décision prise.
 *   3. Rien de purement informatif. Un chiffre qui monte n'est pas une
 *      raison de sortir un téléphone de sa poche.
 * ─────────────────────────────────────────────────────────────────────
 */

export type PushKind = "rdv-imminent" | "echeance-depassee" | "fenetre-ouverte" | "relance-due";

export interface PushMessage {
  kind: PushKind;
  title: string;
  body: string;
  /** Écran à ouvrir au clic — toujours l'endroit où l'action se fait. */
  url: string;
  /** Remplace la notification précédente du même sujet au lieu d'empiler. */
  tag: string;
  urgency: "very-low" | "low" | "normal" | "high";
  /** Durée de vie : un rappel périmé ne doit pas arriver le lendemain. */
  ttlSec: number;
}

/** Minutes entre deux instants ISO. */
const minutesUntil = (iso: string, now: Date): number => (new Date(iso).getTime() - now.getTime()) / 60_000;

/**
 * Choisit LA notification à envoyer, ou null.
 *
 * L'ordre des cas est l'ordre de gravité : un rendez-vous dans vingt minutes
 * prime sur tout le reste, parce que c'est le seul qu'on ne peut pas rattraper.
 */
export function pickPush(
  prospects: Prospect[],
  meetings: Meeting[],
  now: Date = new Date()
): PushMessage | null {
  // Règle 1 — hors fenêtre utile, on se tait. Même une bonne raison ne
  // justifie pas de réveiller quelqu'un un dimanche matin.
  if (!fenetreOuverte(now).open) return null;

  // ── 1. Rendez-vous imminent (20 à 45 min) ────────────────────────────
  // En dessous de 20 min il est déjà en route ; au-delà de 45 il oubliera.
  const rdv = meetings
    .filter((m) => !m.done)
    .map((m) => ({ m, min: minutesUntil(m.date, now) }))
    .filter(({ min }) => min >= 20 && min <= 45)
    .sort((a, b) => a.min - b.min)[0];

  if (rdv) {
    return {
      kind: "rdv-imminent",
      title: `RDV dans ${Math.round(rdv.min)} min`,
      body: `${rdv.m.title}${rdv.m.location ? ` — ${rdv.m.location}` : ""}`,
      url: "/meetings",
      tag: `rdv-${rdv.m.id}`,
      urgency: "high",
      // Un rappel de RDV qui arrive après le RDV est pire qu'inutile.
      ttlSec: 20 * 60,
    };
  }

  // ── 2. Échéance dépassée sur une fiche chaude ────────────────────────
  // Un next step daté qu'on a laissé passer est la fuite la plus banale et
  // la plus chère : la fiche était travaillée, elle refroidit toute seule.
  const enRetard = prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu" && p.nextStep?.date)
    .map((p) => ({ p, min: minutesUntil(p.nextStep!.date, now), vitals: vitalSigns(p, now) }))
    .filter(({ min }) => min < 0 && min > -48 * 60)
    .sort((a, b) => b.vitals.readiness - a.vitals.readiness)[0];

  if (enRetard && enRetard.vitals.readiness >= 50) {
    const retard = Math.round(-enRetard.min / 60);
    return {
      kind: "echeance-depassee",
      title: `${enRetard.p.company} — échéance passée`,
      body: `${enRetard.p.nextStep!.action} · prévu il y a ${retard <= 1 ? "moins d'une heure" : `${retard} h`}`,
      url: `/prospects/${enRetard.p.id}`,
      tag: `echeance-${enRetard.p.id}`,
      urgency: "normal",
      ttlSec: 4 * 3600,
    };
  }

  // ── 3. Fenêtre de rappel qui s'ouvre sur un prospect prêt ────────────
  // C'est le cas où l'OS sait quelque chose que l'opérateur ne peut pas
  // deviner : le bon moment, calculé sur SA réactivité à lui.
  const mur = prospects
    .filter((p) => p.stage !== "signe" && p.stage !== "perdu")
    .map((p) => ({ p, v: vitalSigns(p, now) }))
    .filter(({ v }) => v.readiness >= 70 && v.bestWindow?.at && minutesUntil(v.bestWindow.at, now) <= 0)
    .sort((a, b) => b.v.readiness - a.v.readiness)[0];

  if (mur) {
    return {
      kind: "fenetre-ouverte",
      title: `${mur.p.company} est mûr`,
      body: mur.v.bestWindow.why,
      url: `/prospects/${mur.p.id}`,
      tag: `fenetre-${mur.p.id}`,
      urgency: "normal",
      ttlSec: 3 * 3600,
    };
  }

  // Rien d'actionnable : on n'envoie RIEN. Une notification « tout va bien »
  // est exactement ce qui apprend à ignorer les suivantes.
  return null;
}
