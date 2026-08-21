/**
 * ─────────────────────────────────────────────────────────────────────
 * Cadence de rappel — la règle EXIGÉE par ScintIA pour Callflow.
 *
 * « Après le premier appel sans réponse : 5 rappels sur 2 jours. Dès qu'il
 *   répond, Alpha Voice ARRÊTE d'appeler, met à jour le pipeline, et passe
 *   la main à l'humain (closer). »
 *
 * Deux points non négociables, et c'est le cœur du module :
 *  1. Le compteur s'arrête à la RÉPONSE, pas au nombre d'essais. Un agent qui
 *     continue d'appeler quelqu'un qui a décroché détruit la relation — et
 *     nous ferait perdre le compte ScintIA.
 *  2. Une opposition (« ne me rappelez plus ») coupe TOUT, définitivement,
 *     immédiatement. Elle prime sur la cadence, sur le quota, sur tout.
 *
 * Module pur : il calcule QUAND rappeler et QUAND s'arrêter. Il ne passe
 * aucun appel — c'est l'orchestrateur qui exécute.
 * ─────────────────────────────────────────────────────────────────────
 */

/** 5 rappels après le 1er appel, étalés sur 2 jours (heures depuis le 1er appel). */
export const CALLFLOW_RECALL_OFFSETS_H = [3, 8, 24, 32, 48];
export const CALLFLOW_MAX_RECALLS = CALLFLOW_RECALL_OFFSETS_H.length;

export type CallOutcome =
  /** Personne n'a décroché (sonnerie, répondeur). */
  | "sans-reponse"
  /** Il a décroché et parlé — la cadence s'arrête ici. */
  | "repondu"
  /** Il a demandé à ne plus être appelé — arrêt définitif. */
  | "opposition"
  /** Numéro invalide / injoignable — inutile d'insister. */
  | "invalide";

export interface CallAttempt {
  /** ISO. */
  at: string;
  outcome: CallOutcome;
}

export type CadenceState =
  | "a-appeler"
  | "en-cadence"
  | "attente"
  | "epuisee"
  | "repondu-passer-humain"
  | "stop-definitif";

export interface CadenceDecision {
  state: CadenceState;
  /** Faut-il appeler MAINTENANT ? */
  callNow: boolean;
  /** Prochain rappel prévu (ISO), si la cadence continue. */
  nextCallAt: string | null;
  /** Rappels déjà consommés (hors 1er appel). */
  recallsUsed: number;
  recallsLeft: number;
  /** L'humain doit-il reprendre la main ? */
  handoffToHuman: boolean;
  /** Explication lisible — s'affiche dans la salle de contrôle. */
  reason: string;
}

const H = 3600_000;

/**
 * L'état de la cadence pour UN prospect, d'après ses tentatives.
 * `now` injectable pour les tests (et pour rejouer un historique).
 */
export function cadenceFor(attempts: CallAttempt[], now: Date = new Date()): CadenceDecision {
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));

  // ── Arrêts définitifs : ils priment sur tout le reste ──
  const opposed = sorted.find((a) => a.outcome === "opposition");
  if (opposed) {
    return {
      state: "stop-definitif",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: false,
      reason: "Opposition exprimée — plus aucun appel, définitivement.",
    };
  }
  const invalid = sorted.find((a) => a.outcome === "invalide");
  if (invalid) {
    return {
      state: "stop-definitif",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: false,
      reason: "Numéro invalide ou injoignable — on arrête d'appeler.",
    };
  }

  // ── Il a répondu : Alpha Voice s'arrête et passe la main ──
  const answered = sorted.find((a) => a.outcome === "repondu");
  if (answered) {
    return {
      state: "repondu-passer-humain",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: true,
      reason: "Il a répondu — Alpha Voice arrête, pipeline mis à jour, la main passe au closer.",
    };
  }

  // ── Aucun appel encore passé ──
  const first = sorted[0];
  if (!first) {
    return {
      state: "a-appeler",
      callNow: true,
      nextCallAt: now.toISOString(),
      recallsUsed: 0,
      recallsLeft: CALLFLOW_MAX_RECALLS,
      handoffToHuman: false,
      reason: "Premier appel à passer.",
    };
  }

  // ── En cadence : 5 rappels calés sur le PREMIER appel ──
  const t0 = new Date(first.at).getTime();
  const recallsUsed = sorted.length - 1;
  const recallsLeft = CALLFLOW_MAX_RECALLS - recallsUsed;

  if (recallsLeft <= 0) {
    return {
      state: "epuisee",
      callNow: false,
      nextCallAt: null,
      recallsUsed,
      recallsLeft: 0,
      handoffToHuman: true,
      reason: `${CALLFLOW_MAX_RECALLS} rappels sur 2 jours sans réponse — on arrête d'appeler et on repasse à l'humain (autre canal).`,
    };
  }

  const nextAt = new Date(t0 + CALLFLOW_RECALL_OFFSETS_H[recallsUsed] * H);
  const due = nextAt.getTime() <= now.getTime();
  return {
    state: due ? "en-cadence" : "attente",
    callNow: due,
    nextCallAt: nextAt.toISOString(),
    recallsUsed,
    recallsLeft,
    handoffToHuman: false,
    reason: due
      ? `Rappel ${recallsUsed + 1}/${CALLFLOW_MAX_RECALLS} dû.`
      : `Rappel ${recallsUsed + 1}/${CALLFLOW_MAX_RECALLS} prévu à ${nextAt.toLocaleString("fr-FR")}.`,
  };
}

/** Le planning complet des rappels à partir d'un premier appel (prévisualisation). */
export function plannedRecalls(firstCallAt: string): string[] {
  const t0 = new Date(firstCallAt).getTime();
  return CALLFLOW_RECALL_OFFSETS_H.map((h) => new Date(t0 + h * H).toISOString());
}
