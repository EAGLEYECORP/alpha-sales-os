import { test } from "node:test";
import assert from "node:assert/strict";
import { recovery } from "../lib/recovery";

test("recovery — CA récupérable mensuel = manqués × 4,33 × conv × panier", () => {
  const r = recovery({ missedPerWeek: 10, avgTicket: 60, conversionPct: 30 });
  assert.equal(r.perMonth, Math.round(10 * 4.33 * 0.3 * 60)); // ≈ 779
  assert.equal(r.perYear, r.perMonth * 12);
});

test("recovery — bornes : négatifs ramenés à 0, conv plafonnée à 100 %", () => {
  assert.equal(recovery({ missedPerWeek: -5, avgTicket: 60, conversionPct: 30 }).perMonth, 0);
  const capped = recovery({ missedPerWeek: 10, avgTicket: 100, conversionPct: 999 });
  const full = recovery({ missedPerWeek: 10, avgTicket: 100, conversionPct: 100 });
  assert.equal(capped.perMonth, full.perMonth, "conv > 100 plafonnée");
});

test("recovery — zéro entrée → zéro (jamais de chiffre inventé)", () => {
  assert.deepEqual(recovery({ missedPerWeek: 0, avgTicket: 0, conversionPct: 0 }), {
    perMonth: 0,
    perYear: 0,
    salesPerMonth: 0,
  });
});
