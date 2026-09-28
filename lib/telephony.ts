/**
 * ─────────────────────────────────────────────────────────────────────
 * Base de prix « téléphonie & volume » — ce qui JUSTIFIE le mensuel.
 *
 * L'outreach B2B au téléphone a un coût réel : minutes VoIP + (si agent IA)
 * transcription/synthèse/LLM par minute. On modélise un volume (ex : 1 000
 * prospects en 10 jours, 5 relances = 5 000 tentatives), on en tire le coût
 * direct, et on montre la marge à un prix donné. Le prix n'est pas sorti d'un
 * chapeau : il tient sur le volume — et il remplace un commercial au téléphone
 * (~3 500 €/mois chargé).
 * ─────────────────────────────────────────────────────────────────────
 */

export interface TelephonyInput {
  /** Prospects uniques travaillés sur la période. */
  prospects: number;
  /** Fenêtre de campagne (jours). */
  days: number;
  /** Tentatives (relances comprises) par prospect. */
  recalls: number;
  /** Minutes moyennes par tentative (répondu + non répondu, mélangé). */
  minutesPerAttempt: number;
  /** Coût VoIP par minute (€) — sortant FR mixte mobile/fixe. */
  telcoPerMin: number;
  /** Coût IA par minute (€) : STT + TTS + LLM. 0 si opérateur humain. */
  aiPerMin: number;
}

export interface TelephonyResult {
  attempts: number;
  attemptsPerDay: number;
  totalMinutes: number;
  telcoCost: number;
  aiCost: number;
  /** Coût direct total de la campagne (téléphonie + IA). */
  totalCost: number;
  costPerProspect: number;
  /** Prix plancher suggéré = coût direct × marque (défense de marge). */
  suggestedFloor: (markup: number) => number;
}

/** Volume de référence : 1 000 prospects, 10 jours, 5 relances = 5 000 tentatives. */
export const defaultTelephony: TelephonyInput = {
  prospects: 1000,
  days: 10,
  recalls: 5,
  minutesPerAttempt: 1.1,
  telcoPerMin: 0.02,
  aiPerMin: 0.12,
};

export function calcTelephony(input: TelephonyInput): TelephonyResult {
  const prospects = Math.max(0, input.prospects);
  const days = Math.max(1, input.days);
  const attempts = prospects * Math.max(0, input.recalls);
  const totalMinutes = attempts * Math.max(0, input.minutesPerAttempt);
  const telcoCost = totalMinutes * Math.max(0, input.telcoPerMin);
  const aiCost = totalMinutes * Math.max(0, input.aiPerMin);
  const totalCost = telcoCost + aiCost;

  return {
    attempts,
    attemptsPerDay: attempts / days,
    totalMinutes,
    telcoCost,
    aiCost,
    totalCost,
    costPerProspect: prospects > 0 ? totalCost / prospects : 0,
    suggestedFloor: (markup: number) => totalCost * Math.max(1, markup),
  };
}
