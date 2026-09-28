/**
 * Projection de récupération — « ce que tu laisses sur la table, et ce que tu
 * récupères ». Même formule que la Taxe d'Ignorance : c'est le CA mensuel perdu
 * par les contacts manqués, donc le CA récupérable. Pur → testable.
 *
 * Honnêteté : c'est une ESTIMATION basée sur les hypothèses saisies, jamais une
 * garantie (voir legal/GARANTIES.md).
 */

export interface RecoveryInput {
  /** Contacts / appels manqués par semaine. */
  missedPerWeek: number;
  /** Panier moyen d'une vente (€). */
  avgTicket: number;
  /** % des contacts manqués qui auraient converti. */
  conversionPct: number;
}

export interface RecoveryResult {
  perMonth: number;
  perYear: number;
  salesPerMonth: number;
}

const WEEKS_PER_MONTH = 4.33;

export function recovery(input: RecoveryInput): RecoveryResult {
  const missed = Math.max(0, input.missedPerWeek);
  const ticket = Math.max(0, input.avgTicket);
  const conv = Math.min(100, Math.max(0, input.conversionPct)) / 100;
  const salesPerMonth = missed * WEEKS_PER_MONTH * conv;
  const perMonth = Math.round(salesPerMonth * ticket);
  return { perMonth, perYear: perMonth * 12, salesPerMonth };
}
