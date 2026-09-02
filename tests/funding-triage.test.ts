import { test } from "node:test";
import assert from "node:assert/strict";
import { vitalSigns } from "../lib/vital-signs";
import { buildArgumentaire } from "../lib/argumentaire";
import { triageImport } from "../lib/import-triage";
import { auditCompleteness } from "../lib/deep-dive";
import type { Prospect } from "../lib/types";

const NOW = new Date("2026-08-21T09:00:00.000Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1", name: "Marc Dubois", company: "Test SARL", sector: "artisan", city: "Lyon",
    phone: "0478000000", email: "m@t.fr", stage: "offre", trust: 80, likeness: 50, auditScore: 70,
    conviction: 9, monthlyValue: 115, setupValue: 990, probability: 60, ignoranceTax: 0,
    croyances: { produit: 9, soutien: 9, pourLui: 9 }, obstacles: [], objections: [], events: [],
    demoShownBeforePrice: true, nextStep: null, tags: [], attachments: [], notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [], solution: "", personalizedOffer: "", payments: [], contract: { status: "aucun" },
    delivery: "non-demarre", createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

test("déblocage — un « oui » sans date de déblocage n'est PAS une vente", () => {
  const s = vitalSigns(fixture(), NOW);
  const v = s.vitals.find((x) => x.id === "deblocage");
  assert.equal(v?.ok, false);
  assert.match(v!.why, /n'est pas une vente/i);
});

test("déblocage — une date NON confirmée ne compte pas comme acquise", () => {
  const s = vitalSigns(fixture({ funding: { availableAt: inDays(10), confirmed: false } }), NOW);
  const v = s.vitals.find((x) => x.id === "deblocage");
  assert.equal(v?.ok, false);
  assert.match(v!.why, /supposée/i);
});

test("déblocage — confirmé : le signal passe au vert avec le canal", () => {
  const s = vitalSigns(
    fixture({ funding: { availableAt: inDays(5), channel: "virement", confirmed: true } }),
    NOW
  );
  const v = s.vitals.find((x) => x.id === "deblocage");
  assert.equal(v?.ok, true);
  assert.match(v!.why, /virement/);
});

test("déblocage — on ne relance JAMAIS avant que la compta puisse payer", () => {
  const s = vitalSigns(
    fixture({ funding: { availableAt: inDays(20), channel: "virement", approver: "la DAF", confirmed: true } }),
    NOW
  );
  // La fenêtre est repoussée à la date de déblocage, pas à la cadence habituelle.
  assert.equal(new Date(s.bestWindow.at).getTime() >= NOW.getTime() + 19 * 86_400_000, true);
  assert.match(s.bestWindow.why, /raison purement mécanique/i);
  assert.match(s.bestWindow.why, /la DAF/);
});

test("déblocage — un followUpAt explicite pilote la relance", () => {
  const s = vitalSigns(
    fixture({ funding: { availableAt: inDays(30), followUpAt: inDays(25), confirmed: true } }),
    NOW
  );
  assert.equal(s.bestWindow.at, inDays(25));
});

test("argumentaire — les questions budget rappellent ce qu'il a DÉJÀ dit", () => {
  const vierge = buildArgumentaire(fixture());
  assert.ok(vierge.budgetQuestions.some((q) => /à partir de quand vous pouvez débloquer/i.test(q)));
  assert.ok(vierge.budgetQuestions.some((q) => /quel canal/i.test(q)));

  const connu = buildArgumentaire(
    fixture({ funding: { availableAt: inDays(10), channel: "virement", approver: "le gérant" } })
  );
  // On ne repose pas une question déjà répondue : on la fait CONFIRMER.
  assert.ok(connu.budgetQuestions.some((q) => /toujours d'actualité/i.test(q)));
  assert.ok(connu.budgetQuestions.some((q) => /virement/.test(q)));
  assert.ok(connu.budgetQuestions.some((q) => /le gérant/.test(q)));
});

test("audit — la complétude reflète ce qu'on sait vraiment", () => {
  const vide = fixture({ phone: "", email: "" });
  assert.equal(auditCompleteness(vide), 0);

  const riche = fixture({
    deepAudit: {
      websiteState: "aucun", socialState: "inactif", localCompetition: "3 garages",
      currentProcess: "le gérant décroche", missedCallsPerWeek: 9, avgTicket: 400, googleRating: 3.2,
    },
  });
  assert.equal(auditCompleteness(riche), 100);
});

test("triage import — un gros fichier vide n'est pas une réussite, et on le dit", () => {
  const lot = Array.from({ length: 20 }, (_, i) =>
    fixture({ id: `v${i}`, phone: "", email: "", trust: 0, auditScore: 0, setupValue: 0, monthlyValue: 0 })
  );
  const t = triageImport(lot);
  assert.equal(t.total, 20);
  assert.equal(t.unusable, 20, "aucun moyen de contact");
  assert.match(t.verdict, /AUCUNE n'est exploitable/i);
  // Le trou le plus fréquent est nommé, avec son pourcentage.
  assert.ok(t.topGaps.length > 0);
  assert.equal(t.topGaps[0].pct, 100);
});

test("triage import — le lot se répartit par compte selon l'escalier", () => {
  const voix = fixture({
    id: "cf", setupValue: 990,
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 9 },
  });
  const gros = fixture({ id: "gros", setupValue: 60000, deepAudit: { websiteState: "aucun", socialState: "", localCompetition: "", currentProcess: "" } });
  const t = triageImport([voix, gros]);
  const ids = t.accounts.map((a) => a.accountId).sort();
  // La fiche « appels manqués » revient chez nous depuis qu'Alpha Voice est
  // notre offre ; le gros chantier reste chez Nuwacom.
  assert.deepEqual(ids, ["eagleye", "nuwacom"]);
  // La valeur estimée du lot Nuwacom porte bien le gros chantier.
  assert.ok(t.accounts.find((a) => a.accountId === "nuwacom")!.estimatedHT >= 60000);
});
