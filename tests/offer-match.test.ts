import { test } from "node:test";
import assert from "node:assert/strict";
import { matchOffer } from "../lib/offer-match";

test("offer-match — appels manqués + métier téléphone → Callflow", () => {
  const m = matchOffer({ sector: "garage / carrosserie", missedCallsPerWeek: 8 });
  assert.equal(m.primary, "callflow");
  assert.ok(m.scores.callflow >= 5);
  assert.ok(m.reasons.callflow.length >= 2);
});

test("offer-match — site absent + peu d'avis → Visibilité/Growth", () => {
  const m = matchOffer({ sector: "restaurant", websiteState: "aucun", googleRating: 3.2, googleReviews: 4, socialState: "aucun" });
  assert.equal(m.primary, "visibilite-growth");
  assert.ok(m.scores["visibilite-growth"] >= 4);
});

test("offer-match — agence B2B avec deals → Alpha Sales OS", () => {
  const m = matchOffer({ sector: "agence conseil B2B", monthlyValue: 4000, websiteState: "https://ok.fr", googleReviews: 40, socialState: "actif" });
  assert.equal(m.primary, "alpha-sales-os");
  assert.ok(m.reasons["alpha-sales-os"].length >= 1);
});

test("offer-match — maître d'œuvre (permis Lyon) est routable", () => {
  // MOE avec appels manqués → Callflow ; sans, avec site faible → visibilité.
  const phone = matchOffer({ sector: "maître d'œuvre / construction", missedCallsPerWeek: 6 });
  assert.equal(phone.primary, "callflow");
  const invisible = matchOffer({ sector: "maître d'œuvre", websiteState: "obsolète (2014)", googleReviews: 2 });
  assert.equal(invisible.primary, "visibilite-growth");
});

test("offer-match — aucun signal → défaut Alpha Sales OS, jamais vide", () => {
  const m = matchOffer({});
  assert.equal(m.primary, "alpha-sales-os");
  assert.ok(m.label.length > 0);
  assert.ok(m.pitch.length > 0);
});

test("offer-match — expose toujours les 3 scores et une accroche", () => {
  const m = matchOffer({ sector: "auto-école", missedCallsPerWeek: 3 });
  assert.ok("alpha-sales-os" in m.scores && "callflow" in m.scores && "visibilite-growth" in m.scores);
  assert.ok(m.pitch.includes("«"));
});
