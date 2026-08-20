import { test } from "node:test";
import assert from "node:assert/strict";
import { calc, tierFor, calcSaas, defaultSaasInput, defaultPricing, type PricingConfig, type CalcInput } from "../lib/pricing";

const INPUT: CalcInput = { prospects: 500, replyRate: 8, closeRate: 25, avgSale: 6000 };

test("pricing — calc utilise le modèle par défaut (EAGLEYE)", () => {
  const r = calc(INPUT);
  // 500 × 8% = 40 RDV ; 40 × 25% = 10 ventes ; 10 × 6000 = 60 000 € CA.
  assert.equal(Math.round(r.meetings), 40);
  assert.equal(r.sales, 10);
  assert.equal(r.revenue, 60000);
  // Part par défaut = 30 % ; setup 10 000 €.
  assert.equal(r.perfCut, 18000);
  assert.equal(r.perfYear1, 10000 + 18000 * 12);
  // 500 prospects → palier Starter (≤ 1000).
  assert.equal(r.tier.id, "starter");
});

test("pricing — calc respecte les tarifs custom d'un revendeur", () => {
  const reseller: PricingConfig = {
    setupFee: 900,
    revSharePct: 20,
    tiers: [
      { id: "solo", name: "Solo", maxProspects: 300, monthly: 300, blurb: "", features: [] },
      { id: "pro", name: "Pro", maxProspects: Infinity, monthly: 800, blurb: "", features: [] },
    ],
  };
  const r = calc(INPUT, reseller);
  // Revenu identique (mêmes taux), mais économie pilotée par les tarifs custom.
  assert.equal(r.revenue, 60000);
  assert.equal(r.perfCut, 60000 * 0.2); // 20 %
  assert.equal(r.perfYear1, 900 + 60000 * 0.2 * 12);
  // 500 prospects > 300 → palier « Pro ».
  assert.equal(r.tier.id, "pro");
  assert.equal(r.subMonthly, 800);
  assert.equal(r.subYear1, 900 + 800 * 12);
});

test("pricing — tierFor sélectionne le premier palier couvrant le volume", () => {
  assert.equal(tierFor(100, defaultPricing.tiers).id, "starter");
  assert.equal(tierFor(1000, defaultPricing.tiers).id, "starter");
  assert.equal(tierFor(1500, defaultPricing.tiers).id, "growth");
  assert.equal(tierFor(5000, defaultPricing.tiers).id, "growth");
  assert.equal(tierFor(6000, defaultPricing.tiers).id, "scale");
  // Au-delà du dernier palier fini → Enterprise (dernier).
  assert.equal(tierFor(99999, defaultPricing.tiers).id, "enterprise");
});

test("pricing — Enterprise (monthly null) passe la comparaison en « devis »", () => {
  const r = calc({ ...INPUT, prospects: 25000 }, defaultPricing);
  assert.equal(r.tier.id, "enterprise");
  assert.equal(r.subMonthly, null);
  assert.equal(r.subYear1, null);
  assert.equal(r.cheaperForClient, "devis");
});

test("pricing — le défaut partagé n'est jamais muté par calc", () => {
  const before = JSON.stringify(defaultPricing);
  calc(INPUT);
  calc({ ...INPUT, prospects: 9000 }, defaultPricing);
  assert.equal(JSON.stringify(defaultPricing), before);
});

// ── SaaS economics (vendre Alpha Sales OS) ──────────────────────────────
test("saas — cas de base : MRR, ARR, cash mois 1", () => {
  const s = calcSaas(defaultSaasInput);
  assert.equal(s.mrr, 10000); // 10 × 1000
  assert.equal(s.arr, 120000);
  assert.equal(s.setupCash, 100000); // 10 × 10000 — la preuve de concept
  assert.equal(s.month1Cash, 110000); // 100000 + 10000
});

test("saas — CAC dominé par le temps, LTV et ratio cohérents", () => {
  const s = calcSaas(defaultSaasInput);
  // CAC = 25 (hors-temps) + 5h × 50€ = 275
  assert.equal(s.cacPerClient, 275);
  // temps = 250 sur 275
  assert.ok(Math.abs(s.timeShareOfCac - 250 / 275) < 1e-9);
  // LTV = 10000 setup + 1000 × 12 = 22000
  assert.equal(s.ltvPerClient, 22000);
  assert.ok(Math.abs(s.ltvCac - 22000 / 275) < 1e-9);
});

test("saas — seuils : break-even infra et remboursement du temps", () => {
  const s = calcSaas(defaultSaasInput);
  // infra 120 / prix 1000
  assert.ok(Math.abs(s.breakEvenClientsInfra - 120 / 1000) < 1e-9);
  // temps total = 10 × 5h × 50€ = 2500 ; payback = 2500 / 10000 mois
  assert.equal(s.timeInvestTotal, 2500);
  assert.ok(Math.abs(s.timePaybackMonths - 2500 / 10000) < 1e-9);
});

test("saas — le prix déplace tout (sensibilité)", () => {
  const hi = calcSaas({ ...defaultSaasInput, pricePerMonth: 2000 });
  assert.equal(hi.mrr, 20000);
  assert.ok(hi.ltvCac > calcSaas(defaultSaasInput).ltvCac);
});

test("saas — zéro client ne divise jamais par zéro", () => {
  const s = calcSaas({ ...defaultSaasInput, clients: 0 });
  assert.equal(s.mrr, 0);
  assert.equal(s.timePaybackMonths, 0); // pas de NaN/Infinity
});
