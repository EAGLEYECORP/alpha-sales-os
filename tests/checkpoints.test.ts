import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKPOINTS, checkpointsFor, pipelineCoverage } from "../lib/checkpoints";
import type { Prospect } from "../lib/types";

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1", name: "Marc Dubois", company: "Test SARL", sector: "artisan", city: "Lyon",
    phone: "0478000000", email: "m@t.fr", stage: "prospect", trust: 50, likeness: 50, auditScore: 0,
    conviction: 5, monthlyValue: 0, setupValue: 0, probability: 20, ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 }, obstacles: [], objections: [], events: [],
    demoShownBeforePrice: false, nextStep: null, tags: [], attachments: [], notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [], solution: "", personalizedOffer: "", payments: [], contract: { status: "aucun" },
    delivery: "non-demarre", createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

test("checkpoints — chaque définition porte une CONSÉQUENCE, pas une consigne", () => {
  for (const c of CHECKPOINTS) {
    assert.ok(c.why.length > 30, `${c.id} : le « pourquoi » doit dire ce qu'on perd`);
    assert.ok(c.label.length > 5);
  }
  // Toutes les étapes du pipeline sont couvertes.
  for (const stage of ["prospect", "contact", "audit", "demo", "offre", "signe"]) {
    assert.ok(CHECKPOINTS.some((c) => c.stage === stage), `aucun checkpoint pour ${stage}`);
  }
});

test("checkpoints — « non vérifiable » n'est JAMAIS confondu avec « non fait »", () => {
  const r = checkpointsFor(fixture({ stage: "contact" }));
  const declaratif = r.items.find((i) => i.def.id === "accord-audit")!;
  assert.equal(declaratif.state, "a-declarer");
  assert.equal(declaratif.measured, false, "Alpha ne peut pas savoir : c'est une déclaration");

  const mesure = r.items.find((i) => i.def.id === "volume")!;
  assert.equal(mesure.measured, true);
  assert.equal(mesure.state, "manquant", "la donnée manque vraiment, ça se mesure");
});

test("checkpoints — un déclaratif coché passe à « fait »", () => {
  const sans = checkpointsFor(fixture({ stage: "contact" }));
  const avec = checkpointsFor(fixture({ stage: "contact" }), ["accord-audit"]);
  assert.equal(sans.items.find((i) => i.def.id === "accord-audit")!.state, "a-declarer");
  assert.equal(avec.items.find((i) => i.def.id === "accord-audit")!.state, "fait");
});

test("checkpoints — « Gérant » n'est pas un décideur nommé", () => {
  assert.equal(checkpointsFor(fixture({ name: "Gérant" })).canAdvance, false);
  assert.equal(checkpointsFor(fixture({ name: "Marc Dubois" })).canAdvance, true);
});

test("checkpoints — sans contact, la fiche est bloquée dès l'entrée", () => {
  const r = checkpointsFor(fixture({ phone: "", email: "" }));
  assert.equal(r.canAdvance, false);
  assert.ok(r.blockers.some((b) => b.def.id === "joignable"));
  assert.match(r.summary, /bloquant/);
});

test("checkpoints — au stade OFFRE, le déblocage non confirmé bloque", () => {
  const p = fixture({
    stage: "offre", setupValue: 990,
    funding: { availableAt: "2026-09-01T09:00:00.000Z", confirmed: false },
  });
  const r = checkpointsFor(p);
  assert.equal(r.canAdvance, false);
  assert.ok(r.blockers.some((b) => b.def.id === "deblocage"));

  // Confirmé + le reste au vert, mais il reste des déclaratifs non bloquants.
  const ok = checkpointsFor({
    ...p,
    funding: { availableAt: "2026-09-01T09:00:00.000Z", confirmed: true },
  } as Prospect);
  assert.equal(ok.canAdvance, true, "les déclaratifs non bloquants n'empêchent pas d'avancer");
});

test("checkpoints — une objection bloquante interdit d'avancer", () => {
  const p = fixture({
    stage: "offre", setupValue: 990,
    funding: { availableAt: "2026-09-01T09:00:00.000Z", confirmed: true },
    objections: [{ id: "o", label: "budget gelé", type: "argent", croyance: 3, status: "bloquante" }],
  });
  assert.equal(checkpointsFor(p).canAdvance, false);
});

test("checkpoints — au stade DÉMO, le prix avant la démo bloque", () => {
  const sans = checkpointsFor(fixture({ stage: "demo", demoShownBeforePrice: false }));
  assert.ok(sans.blockers.some((b) => b.def.id === "demo-avant-prix"));
  const avec = checkpointsFor(fixture({ stage: "demo", demoShownBeforePrice: true }));
  assert.equal(avec.blockers.some((b) => b.def.id === "demo-avant-prix"), false);
});

test("checkpoints — la progression reflète les validés", () => {
  const vide = checkpointsFor(fixture({ name: "Gérant", phone: "", email: "" }));
  assert.equal(vide.progress, 0);
  const plein = checkpointsFor(fixture({ name: "Marc Dubois", phone: "0478000000" }));
  assert.equal(plein.progress, 100);
});

test("couverture — le TOP bloqueur nomme la correction la plus rentable", () => {
  // 5 fiches sans décideur nommé, 1 sans contact.
  const lot = [
    ...Array.from({ length: 5 }, (_, i) => fixture({ id: `a${i}`, name: "Gérant" })),
    fixture({ id: "b", name: "Marc Dubois", phone: "", email: "" }),
  ];
  const c = pipelineCoverage(lot);
  assert.equal(c.total, 6);
  assert.equal(c.ready, 0);
  assert.equal(c.blocked, 6);
  assert.match(c.topBlocker!.label, /décideur/i);
  assert.equal(c.topBlocker!.count, 5, "corriger ce point débloque 5 fiches d'un coup");
});

test("couverture — les fiches perdues sont exclues du calcul", () => {
  const lot = [fixture({ id: "ok" }), fixture({ id: "perdu", stage: "perdu", name: "Gérant" })];
  const c = pipelineCoverage(lot);
  assert.equal(c.total, 1, "un dossier perdu ne doit pas plomber la couverture");
  assert.equal(c.ready, 1);
  assert.equal(c.coverage, 100);
});

test("couverture — un pipe vide ne plante pas et ne ment pas", () => {
  const c = pipelineCoverage([]);
  assert.equal(c.total, 0);
  assert.equal(c.coverage, 100);
  assert.equal(c.topBlocker, undefined);
});
