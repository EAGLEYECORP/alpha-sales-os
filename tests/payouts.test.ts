import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPayoutLedger } from "../lib/payouts";
import { prospectDefaults } from "../lib/seed";
import type { Payment, Prospect } from "../lib/types";

function fiche(id: string, company: string, payments: Payment[]): Prospect {
  return { ...prospectDefaults, id, company, city: "Lyon", payments, createdAt: "", updatedAt: "" } as Prospect;
}
const pay = (id: string, amount: number, dueDate: string, status: Payment["status"]): Payment => ({
  id,
  label: "acompte",
  amount,
  dueDate,
  status,
});

test("payouts — seuls les paiements ENCAISSÉS comptent, ta part = commissionPct du brut", () => {
  const prospects = [
    fiche("a", "Client A", [pay("p1", 1000, "2026-07-01", "paye"), pay("p2", 500, "2026-07-10", "en-attente")]),
    fiche("b", "Client B", [pay("p3", 2000, "2026-06-15", "paye")]),
  ];
  const { rows, summary } = buildPayoutLedger(prospects, 30);
  assert.equal(rows.length, 2, "le paiement en attente est exclu");
  assert.equal(summary.salesCount, 2);
  assert.equal(summary.grossTotal, 3000);
  assert.equal(summary.cutTotal, 900, "30% de 3000");
  // Trié de la 1re vente à la dernière.
  assert.deepEqual(rows.map((r) => r.client), ["Client B", "Client A"]);
  assert.equal(summary.firstSaleDate, "2026-06-15");
});

test("payouts — versé vs en attente suit les ids réglés", () => {
  const prospects = [fiche("a", "Client A", [pay("p1", 1000, "2026-07-01", "paye"), pay("p2", 1000, "2026-07-02", "paye")])];
  const { summary } = buildPayoutLedger(prospects, 25, new Set(["p1"]));
  assert.equal(summary.cutTotal, 500, "25% de 2000");
  assert.equal(summary.settledTotal, 250, "p1 versé");
  assert.equal(summary.pendingTotal, 250, "p2 encore dû");
});

test("payouts — aucune vente : tout à zéro, pas de date", () => {
  const { rows, summary } = buildPayoutLedger([fiche("a", "A", [])], 30);
  assert.equal(rows.length, 0);
  assert.equal(summary.cutTotal, 0);
  assert.equal(summary.firstSaleDate, undefined);
});
