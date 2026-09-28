import { test } from "node:test";
import assert from "node:assert/strict";
import { appendCallAttempt, calledRecently, planTick, MAX_CALLS_PER_TICK } from "../lib/campaign-tick";
import { attemptsFromEvents } from "../lib/master-rappel";
import { cadenceFor } from "../lib/call-cadence";
import type { Prospect } from "../lib/types";

const NOW = new Date("2026-08-18T10:00:00");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1", name: "Marc", company: "Test SARL", sector: "artisan", city: "Lyon",
    phone: "0465710000", email: "m@t.fr", stage: "contact", trust: 50, likeness: 50, auditScore: 60,
    conviction: 5, monthlyValue: 0, setupValue: 0, probability: 20, ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 }, obstacles: [], objections: [], events: [],
    demoShownBeforePrice: false, nextStep: null, tags: [], attachments: [], notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [], solution: "", personalizedOffer: "", payments: [], contract: { status: "aucun" },
    delivery: "non-demarre", createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

test("tick — la tentative s'écrit en tête de timeline", () => {
  const p = appendCallAttempt(fixture(), NOW);
  assert.equal(p.events.length, 1);
  assert.equal(p.events[0].kind, "appel");
  assert.equal(p.events[0].date, NOW.toISOString());
});

test("tick — l'appel auto n'est JAMAIS lu comme « il a répondu »", () => {
  // C'est vital : conclure à tort qu'il a répondu arrêterait la cadence et
  // laisserait le dossier dormir pour toujours.
  const p = appendCallAttempt(fixture(), NOW);
  const attempts = attemptsFromEvents(p);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].outcome, "sans-reponse");
  // Et la cadence continue normalement.
  assert.notEqual(cadenceFor(attempts, NOW).state, "repondu-passer-humain");
});

test("tick — la tentative écrite fait AVANCER la cadence (anti-boucle)", () => {
  const vierge = fixture();
  // Avant : l'appel est dû immédiatement.
  assert.equal(cadenceFor(attemptsFromEvents(vierge), NOW).callNow, true);

  // Après écriture : le prochain rappel n'est plus dû tout de suite.
  const apres = appendCallAttempt(vierge, NOW);
  const d = cadenceFor(attemptsFromEvents(apres), NOW);
  assert.equal(d.callNow, false, "sans ça, le tick suivant rappellerait la même personne");
  assert.equal(d.state, "attente");
});

test("tick — un prospect touché dans l'heure est écarté", () => {
  const frais = fixture({ id: "frais", events: [{ id: "e", date: hoursAgo(0.2).toISOString(), kind: "appel", summary: "x" }] });
  const vieux = fixture({ id: "vieux", events: [{ id: "e", date: hoursAgo(5).toISOString(), kind: "appel", summary: "x" }] });
  assert.equal(calledRecently(frais, NOW), true);
  assert.equal(calledRecently(vieux, NOW), false);
});

test("tick — le plafond DUR ne se contourne pas, même en le demandant", () => {
  const lot = Array.from({ length: 20 }, (_, i) => fixture({ id: `p${i}` }));
  const plan = planTick(lot.map((p) => p.id), lot, { max: 999, now: NOW });
  assert.equal(plan.take.length, MAX_CALLS_PER_TICK);
  assert.equal(plan.cap, MAX_CALLS_PER_TICK);
});

test("tick — la double défense : la file propose, le tick vérifie encore", () => {
  const dejaAppele = fixture({
    id: "recent",
    events: [{ id: "e", date: hoursAgo(0.1).toISOString(), kind: "appel", summary: "x" }],
  });
  const propre = fixture({ id: "propre" });
  // Même si la file le proposait à tort, le tick le refuse.
  const plan = planTick(["recent", "propre"], [dejaAppele, propre], { now: NOW });
  assert.deepEqual(plan.take, ["propre"]);
  assert.deepEqual(plan.tooSoon, ["recent"]);
});

test("tick — un id inconnu ne fait pas planter le plan", () => {
  const plan = planTick(["fantome", "p1"], [fixture()], { now: NOW });
  assert.deepEqual(plan.take, ["p1"]);
});

test("tick — max à 0 ne déclenche rien", () => {
  const lot = [fixture()];
  assert.equal(planTick(["p1"], lot, { max: 0, now: NOW }).take.length, 0);
});
