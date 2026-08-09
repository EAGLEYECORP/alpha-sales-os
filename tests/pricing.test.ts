import { test } from "node:test";
import assert from "node:assert/strict";
import { calc, tierFor, defaultPricing, type PricingConfig, type CalcInput } from "../lib/pricing";

const INPUT: CalcInput = { prospects: 500, replyRate: 8, closeRate: 25, avgSale: 6000 };

test("pricing — calc utilise le modèle par défaut (EAGLEYE)", () => {
  const r = calc(INPUT);
  // 500 × 8% = 40 RDV ; 40 × 25% = 10 ventes ; 10 × 6000 = 60 000 € CA.
  assert.equal(Math.round(r.meetings), 40);
  assert.equal(r.sales, 10);
  assert.equal(r.revenue, 60000);
  // Part par défaut = 30 % ; setup 2 500 €.
  assert.equal(r.perfCut, 18000);
  assert.equal(r.perfYear1, 2500 + 18000 * 12);
  // 500 prospects → palier Growth (≤ 1000).
  assert.equal(r.tier.id, "growth");
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
  assert.equal(tierFor(250, defaultPricing.tiers).id, "starter");
  assert.equal(tierFor(251, defaultPricing.tiers).id, "growth");
  assert.equal(tierFor(5000, defaultPricing.tiers).id, "scale");
  // Au-delà du dernier palier fini → Enterprise (dernier).
  assert.equal(tierFor(99999, defaultPricing.tiers).id, "enterprise");
});

test("pricing — Enterprise (monthly null) passe la comparaison en « devis »", () => {
  const r = calc({ ...INPUT, prospects: 8000 }, defaultPricing);
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
