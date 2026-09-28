import type { Prospect } from "./types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Payouts — TA part, prélevée sur chaque vente, cumulée depuis la première.
 *
 * Une « vente » = un paiement encaissé (status « paye ») sur une fiche.
 * Sur chaque vente, on prend sa part — la « cut off the top ». Ce module en
 * fait un registre : ligne par vente, cumul depuis la vente n°1, et ce qui a
 * déjà été versé vs ce qui reste dû.
 *
 * ⚠ LE TAUX N'EST PAS UNIQUE. Il l'était : tout le registre s'appuyait sur le
 * `commissionPct` des Réglages, c'est-à-dire un barème global. Or chaque
 * affaire se structure différemment — le taux suit le levier qu'on garde dans
 * ce deal-là. Une fiche qui porte des `dealTerms` négociés impose donc SON
 * taux, et le barème ne sert plus que de repli.
 *
 * Sans ça, les payouts affichaient une prévision au barème pendant que la
 * réalité facturée était ailleurs — l'erreur ne se voyait qu'à l'encaissement.
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
  /** Ta part sur cette vente, arrondie. */
  cut: number;
  /** Le taux réellement appliqué à CETTE ligne. */
  pct: number;
  /** Vient-il des termes négociés de la fiche, ou du barème des Réglages ? */
  source: "deal" | "reference";
  /** Reste au client après ta part. */
  net: number;
  /** Ta part a-t-elle déjà été versée ? */
  settled: boolean;
}

export interface PayoutSummary {
  /** Le barème des Réglages — le repli, plus la vérité de toutes les lignes. */
  commissionPct: number;
  /** Nombre de ventes chiffrées avec un taux négocié propre à leur fiche. */
  dealCount: number;
  /**
   * Taux EFFECTIF du registre : la part totale rapportée au brut total.
   * C'est le seul chiffre honnête quand les lignes n'ont pas toutes le même
   * taux — afficher le barème donnerait une moyenne fausse.
   */
  tauxEffectifPct: number;
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
      // Les termes de la FICHE priment sur le barème. On ne distingue pas
      // encore setup et récurrent au niveau du paiement : le taux one-shot
      // s'applique, parce que c'est celui qui a été convenu pour l'affaire.
      const negocie = p.dealTerms?.commissionPct;
      const utiliseDeal = typeof negocie === "number" && Number.isFinite(negocie) && negocie >= 0;
      const pct = utiliseDeal ? Math.min(100, negocie) : commissionPct;
      const cut = cutOf(gross, pct);
      rows.push({
        id: pay.id,
        prospectId: p.id,
        client: p.company,
        date: pay.dueDate,
        gross,
        cut,
        pct,
        source: utiliseDeal ? "deal" : "reference",
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
      dealCount: rows.filter((r) => r.source === "deal").length,
      tauxEffectifPct: grossTotal > 0 ? Math.round((cutTotal / grossTotal) * 1000) / 10 : 0,
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
