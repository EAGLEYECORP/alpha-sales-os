import { test } from "node:test";
import assert from "node:assert/strict";
import { calcTelephony, defaultTelephony } from "../lib/telephony";

test("telephony — volume de référence : 1000 prospects, 10 jours, 5 relances", () => {
  const r = calcTelephony(defaultTelephony);
  assert.equal(r.attempts, 5000); // 1000 × 5
  assert.equal(r.attemptsPerDay, 500); // 5000 / 10
  assert.ok(Math.abs(r.totalMinutes - 5000 * 1.1) < 1e-9); // 5500 min
});

test("telephony — coûts : téléphonie + IA, et coût/prospect", () => {
  const r = calcTelephony(defaultTelephony);
  // 5500 min × 0.02 = 110 € VoIP ; × 0.12 = 660 € IA ; total 770 €.
  assert.ok(Math.abs(r.telcoCost - 110) < 1e-9);
  assert.ok(Math.abs(r.aiCost - 660) < 1e-9);
  assert.ok(Math.abs(r.totalCost - 770) < 1e-9);
  assert.ok(Math.abs(r.costPerProspect - 0.77) < 1e-9);
});

test("telephony — le mensuel à 1000 € tient largement la marge", () => {
  const r = calcTelephony(defaultTelephony);
  // Coût direct 770 € pour 5000 tentatives → 1000 €/mois garde de la marge,
  // et remplace un commercial (~3500 €/mois chargé).
  assert.ok(r.totalCost < 1000);
  assert.ok(r.suggestedFloor(1.5) < 1200); // plancher = coût × 1.5
});

test("telephony — sans IA (opérateur humain), seul le VoIP compte", () => {
  const r = calcTelephony({ ...defaultTelephony, aiPerMin: 0 });
  assert.equal(r.aiCost, 0);
  assert.equal(r.totalCost, r.telcoCost);
});

test("telephony — zéro jour ne divise jamais par zéro", () => {
  const r = calcTelephony({ ...defaultTelephony, days: 0 });
  assert.ok(Number.isFinite(r.attemptsPerDay));
});
