import type { Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Payouts — TA part, prélevée sur chaque vente, cumulée depuis la première.
 *
 * Une « vente » = un paiement encaissé (status « paye ») sur une fiche.
 * Sur chaque vente, EAGLEYE prend sa part (`commissionPct` des Réglages) —
 * la « cut off the top ». Ce module en fait un registre : ligne par vente,
 * cumul depuis la vente n°1, et ce qui a déjà été versé vs ce qui reste dû.
 *
 * Pur et testable : la source, c'est le CRM (les paiements des fiches). On
 * n'invente aucun revenu — ce qui n'est pas encaissé n'apparaît pas.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface PayoutRow {
  /** id du paiement (clé de règlement). */
  id: string;
  prospectId: string;
  client: string;
  /** Date de la vente (échéance du paiement). */
  date: string;
  /** Montant encaissé (brut). */
  gross: number;
  /** Ta part — commissionPct % du brut, arrondie. */
  cut: number;
  /** Reste au client après ta part. */
  net: number;
  /** Ta part a-t-elle déjà été versée ? */
  settled: boolean;
}

export interface PayoutSummary {
  commissionPct: number;
  salesCount: number;
  grossTotal: number;
  /** Total de ta part depuis la 1re vente. */
  cutTotal: number;
  /** Ta part déjà versée. */
  settledTotal: number;
  /** Ta part encore due. */
  pendingTotal: number;
  firstSaleDate?: string;
  lastSaleDate?: string;
}

const cutOf = (gross: number, pct: number) => Math.round((gross * pct) / 100);

/**
 * Le registre complet, trié de la première vente à la dernière.
 * `settled` : ids de paiements dont ta part a été versée (store).
 */
export function buildPayoutLedger(
  prospects: Prospect[],
  commissionPct: number,
  settled: Set<string> = new Set()
): { rows: PayoutRow[]; summary: PayoutSummary } {
  const rows: PayoutRow[] = [];
  for (const p of prospects) {
    for (const pay of p.payments ?? []) {
      if (pay.status !== "paye") continue;
      const gross = pay.amount;
      const cut = cutOf(gross, commissionPct);
      rows.push({
        id: pay.id,
        prospectId: p.id,
        client: p.company,
        date: pay.dueDate,
        gross,
        cut,
        net: gross - cut,
        settled: settled.has(pay.id),
      });
    }
  }
  // De la vente n°1 à la dernière — le cumul se lit dans le bon sens.
  rows.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const grossTotal = rows.reduce((s, r) => s + r.gross, 0);
  const cutTotal = rows.reduce((s, r) => s + r.cut, 0);
  const settledTotal = rows.reduce((s, r) => s + (r.settled ? r.cut : 0), 0);

  return {
    rows,
    summary: {
      commissionPct,
      salesCount: rows.length,
      grossTotal,
      cutTotal,
      settledTotal,
      pendingTotal: cutTotal - settledTotal,
      firstSaleDate: rows[0]?.date,
      lastSaleDate: rows[rows.length - 1]?.date,
    },
  };
}
