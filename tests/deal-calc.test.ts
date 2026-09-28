import { test } from "node:test";
import assert from "node:assert/strict";
import { calcDeal, ecartVsReference } from "../lib/deal-calc";
import { buildPayoutLedger } from "../lib/payouts";
import { prospect } from "./fixtures";

/**
 * Le calculateur de deal.
 *
 * Il calcule l'ARGENT exactement, et ne prétend jamais calculer le TAUX :
 * celui-ci se négocie avec un humain. Ces tests verrouillent l'arithmétique et
 * la propagation — parce qu'un calculateur qui n'irrigue rien est décoratif.
 */

test("calc — l'arithmétique, posée à la main", () => {
  // 5 000 de setup à 30 % = 1 500. 400/mois × 12 = 4 800 à 10 % = 480.
  const r = calcDeal({ setupHT: 5000, monthlyHT: 400, commissionPct: 30, recurringPct: 10, horizonMois: 12 });
  assert.equal(r.lignes[0].part, 1500);
  assert.equal(r.lignes[1].brut, 4800);
  assert.equal(r.lignes[1].part, 480);
  assert.equal(r.partTotale, 1980);
  assert.equal(r.brutTotal, 9800);
  assert.equal(r.partMensuelle, 40);
});

test("calc — le taux EFFECTIF n'est ni l'un ni l'autre des deux taux", () => {
  // 1 980 / 9 800 = 20,2 %. C'est ce chiffre-là qu'on compare d'un deal à
  // l'autre — pas le « 30 % » affiché sur le setup, qui ne porte que la
  // moitié de l'affaire.
  const r = calcDeal({ setupHT: 5000, monthlyHT: 400, commissionPct: 30, recurringPct: 10, horizonMois: 12 });
  assert.equal(r.tauxEffectifPct, 20.2);
});

test("calc — ce que vaut UN point, le chiffre qui rend la négo concrète", () => {
  const r = calcDeal({ setupHT: 60000, monthlyHT: 1000, commissionPct: 15, recurringPct: 100, horizonMois: 12 });
  assert.equal(r.valeurDUnPointSetup, 600, "un point sur 60 k vaut 600 €");
  assert.equal(r.valeurDUnPointRecurrent, 120, "un point sur 12 000 € de récurrent vaut 120 €");
});

test("calc — les entrées absurdes ne cassent rien et ne divisent pas par zéro", () => {
  const r = calcDeal({ setupHT: -100, monthlyHT: NaN, commissionPct: 250, recurringPct: -5, horizonMois: 0 });
  assert.equal(r.brutTotal, 0);
  assert.equal(r.partTotale, 0);
  assert.equal(r.tauxEffectifPct, 0, "0/0 ne doit pas produire NaN");
  assert.ok(Number.isFinite(r.valeurDUnPointSetup));
});

test("calc — un taux > 100 % est borné : on ne prend pas plus que le brut", () => {
  const r = calcDeal({ setupHT: 1000, monthlyHT: 0, commissionPct: 250, recurringPct: 0, horizonMois: 12 });
  assert.equal(r.partTotale, 1000);
});

test("écart — la comparaison est en EUROS, pas en points", () => {
  /**
   * « 20 % », c'est bien ou mal ? La question n'a pas de sens seule. La seule
   * lecture utile est la différence avec ce qu'on prend d'habitude.
   */
  const entree = { setupHT: 60000, monthlyHT: 0, commissionPct: 25, recurringPct: 100, horizonMois: 12 };
  const e = ecartVsReference(entree, { commissionPct: 15, recurringPct: 100 });
  assert.equal(e.partReference, 9000);
  assert.equal(e.deltaEur, 6000, "25 % au lieu de 15 % sur 60 k = 6 000 € de plus");
  assert.match(e.verdict, /\+/);

  const moins = ecartVsReference({ ...entree, commissionPct: 10 }, { commissionPct: 15, recurringPct: 100 });
  assert.equal(moins.deltaEur, -3000);
  assert.match(moins.verdict, /ça se compte/);
});

test("écart — à la référence exacte, on le dit sans dramatiser", () => {
  const e = ecartVsReference(
    { setupHT: 60000, monthlyHT: 0, commissionPct: 15, recurringPct: 100, horizonMois: 12 },
    { commissionPct: 15, recurringPct: 100 }
  );
  assert.equal(e.deltaEur, 0);
  assert.match(e.verdict, /Exactement la référence/);
});

// ── LA PROPAGATION : sans elle, l'écran est décoratif ───────────────────

test("payouts — les termes de la fiche PRIMENT sur le barème des Réglages", () => {
  /**
   * C'est le point qui rend le calculateur utile. Avant, tout le registre
   * s'appuyait sur un taux global : on affichait une prévision au barème
   * pendant que la réalité facturée était ailleurs, et l'erreur ne se voyait
   * qu'à l'encaissement.
   */
  const auBareme = prospect({
    id: "p1",
    company: "Sans termes",
    payments: [{ id: "pay1", label: "Setup", amount: 10000, dueDate: "2026-08-01", status: "paye" }],
  });
  const negocie = prospect({
    id: "p2",
    company: "Avec termes",
    payments: [{ id: "pay2", label: "Setup", amount: 10000, dueDate: "2026-08-02", status: "paye" }],
    dealTerms: { commissionPct: 25, structure: "démos construites par nous" },
  });

  const { rows, summary } = buildPayoutLedger([auBareme, negocie], 15);

  const l1 = rows.find((r) => r.id === "pay1")!;
  assert.equal(l1.pct, 15);
  assert.equal(l1.cut, 1500);
  assert.equal(l1.source, "reference");

  const l2 = rows.find((r) => r.id === "pay2")!;
  assert.equal(l2.pct, 25, "la fiche impose son taux");
  assert.equal(l2.cut, 2500);
  assert.equal(l2.source, "deal");

  assert.equal(summary.dealCount, 1);
  // 4 000 / 20 000 = 20 %. Afficher « 15 % » ici serait faux.
  assert.equal(summary.tauxEffectifPct, 20);
  assert.equal(summary.cutTotal, 4000);
});

test("payouts — un taux négocié à 0 % est respecté, pas confondu avec « absent »", () => {
  // Le piège classique du `||` : 0 est une valeur, pas un vide. Un deal à 0 %
  // (geste commercial, deal d'entrée) doit afficher 0, pas retomber au barème.
  const p = prospect({
    id: "p3",
    company: "Geste",
    payments: [{ id: "pay3", label: "Setup", amount: 5000, dueDate: "2026-08-03", status: "paye" }],
    dealTerms: { commissionPct: 0 },
  });
  const { rows } = buildPayoutLedger([p], 30);
  assert.equal(rows[0].cut, 0);
  assert.equal(rows[0].source, "deal");
});

test("payouts — un registre vide ne produit pas de NaN", () => {
  const { summary } = buildPayoutLedger([], 30);
  assert.equal(summary.tauxEffectifPct, 0);
  assert.equal(summary.dealCount, 0);
});
