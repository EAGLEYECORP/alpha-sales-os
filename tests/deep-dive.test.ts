import { test } from "node:test";
import assert from "node:assert/strict";
import { deepDive, deepDiveBatch, briefForScript } from "../lib/deep-dive";
import { buildVoiceScript, auditScript } from "../lib/voice-script";
import type { Prospect } from "../lib/types";

/** Fiche minimale — on ne remplit que ce que chaque test veut éprouver. */
function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    name: "Gérant",
    company: "Carrosserie Test",
    sector: "artisan",
    city: "Lyon 6e",
    stage: "contact",
    trust: 40,
    likeness: 50,
    auditScore: 0,
    conviction: 5,
    monthlyValue: 0,
    setupValue: 0,
    probability: 20,
    ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 },
    obstacles: [],
    objections: [],
    events: [],
    demoShownBeforePrice: false,
    nextStep: null,
    tags: [],
    attachments: [],
    notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [],
    solution: "",
    personalizedOffer: "",
    payments: [],
    contract: { status: "aucun" },
    delivery: "non-demarre",
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

test("deep-dive — une fiche riche sort chaude, avec des signaux dicibles", () => {
  const d = deepDive(
    fixture({
      name: "Marc Dubois",
      phone: "0478000000",
      email: "marc@test.fr",
      trust: 70,
      deepAudit: {
        websiteState: "obsolète (2014)",
        socialState: "inactif",
        localCompetition: "3 garages à 500 m",
        currentProcess: "le gérant décroche entre deux réparations",
        missedCallsPerWeek: 9,
        googleRating: 3.4,
        googleReviews: 12,
      },
    })
  );
  assert.ok(d.score >= 70, `score attendu chaud, obtenu ${d.score}`);
  assert.equal(d.fit, "chaud");
  assert.ok(d.signals.some((s) => /9 appels manqués/.test(s)));
  assert.ok(d.angle.includes("Carrosserie Test"));
  assert.ok(d.objective.length > 0);
});

test("deep-dive — une fiche vide sort froide et liste ce qui manque", () => {
  const d = deepDive(fixture());
  assert.ok(d.score < 45, `score attendu bas, obtenu ${d.score}`);
  assert.ok(d.gaps.length >= 4, "une fiche vide doit exposer ses trous");
  // « Gérant » n'est pas un nom : on doit réclamer le décideur.
  assert.ok(d.gaps.some((g) => /NOM du décideur/i.test(g)));
  assert.ok(d.gaps.some((g) => /contact direct/i.test(g)));
});

test("deep-dive — le routage suit la règle : Callflow → ScintIA", () => {
  // Métier téléphone + appels manqués → callflow → ScintIA encaisse.
  const d = deepDive(
    fixture({ sector: "artisan", deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 8 } })
  );
  assert.equal(d.offer, "callflow");
  assert.equal(d.accountId, "scintia");
});

test("deep-dive — un gros chantier (> 40 k) part chez Nuwacom", () => {
  const d = deepDive(
    fixture({
      setupValue: 50000,
      deepAudit: { websiteState: "aucun", socialState: "aucun", localCompetition: "", currentProcess: "" },
    })
  );
  assert.equal(d.accountId, "nuwacom");
  assert.match(d.routingReason, /trop lourd/i);
});

test("deep-dive — depuis ScintIA, l'offre reste Callflow (compte mono-offre)", () => {
  const d = deepDive(fixture({ deepAudit: { websiteState: "aucun", socialState: "aucun", localCompetition: "", currentProcess: "" } }), "scintia");
  assert.equal(d.offer, "callflow");
});

test("deep-dive — le lot est trié du plus chaud au plus froid", () => {
  const froid = fixture({ id: "froid" });
  const chaud = fixture({
    id: "chaud",
    phone: "0478000000",
    email: "a@b.fr",
    trust: 80,
    deepAudit: { websiteState: "aucun", socialState: "aucun", localCompetition: "x", currentProcess: "y", missedCallsPerWeek: 10, googleRating: 3 },
  });
  const out = deepDiveBatch([froid, chaud]);
  assert.equal(out[0].prospectId, "chaud");
  assert.ok(out[0].score > out[1].score);
});

test("deep-dive — le brief entre dans le script SANS casser la divulgation art. 50", () => {
  const p = fixture({ name: "Marc Dubois", deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 7 } });
  const brief = briefForScript(deepDive(p), p);
  assert.match(brief, /Marc Dubois/);
  assert.match(brief, /Objectif de CET appel/);

  const script = buildVoiceScript({
    onBehalfOf: "ScintIA",
    agentName: "Alpha",
    mode: "prospection-b2b",
    company: p.company,
    prospectBrief: brief,
  });
  assert.match(script, /deep-dive/i, "le brief doit figurer dans le script");
  assert.match(script, /Marc Dubois/);
  // La conformité reste intacte : c'est la règle qu'on ne contourne jamais.
  assert.equal(auditScript(script).ok, true);
});
