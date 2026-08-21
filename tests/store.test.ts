import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useAlpha } from "../lib/store";
import { auditCompleteness } from "../lib/deep-dive";
import type { Prospect } from "../lib/types";

/**
 * Le store est le cœur des données de l'app : tout ce qui s'y perd est perdu
 * partout. Ces tests couvrent ce qui peut RÉELLEMENT casser en silence —
 * les fusions à l'import, les portes de signature, le cloisonnement des notes.
 */

const snapshot = useAlpha.getState();

beforeEach(() => {
  // Chaque test repart d'un état propre : sans ça, l'ordre d'exécution
  // devient un paramètre caché et les échecs sont irreproductibles.
  useAlpha.setState({
    ...snapshot,
    prospects: [],
    notes: [],
    settledPayouts: [],
    activities: [],
    auditLog: [],
  });
});

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1", name: "Marc", company: "Test SARL", sector: "artisan", city: "Lyon",
    phone: "0478000000", email: "m@t.fr", stage: "contact", trust: 50, likeness: 50, auditScore: 0,
    conviction: 5, monthlyValue: 0, setupValue: 0, probability: 20, ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 }, obstacles: [], objections: [], events: [],
    demoShownBeforePrice: false, nextStep: null, tags: [], attachments: [], notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [], solution: "", personalizedOffer: "", payments: [], contract: { status: "aucun" },
    delivery: "non-demarre", createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

test("store — l'import dédoublonne par email, sans créer de doublon", () => {
  const { importProspects } = useAlpha.getState();
  const a = importProspects([fixture({ id: "a", company: "Carrosserie Test", email: "gerant@test.fr" })]);
  assert.deepEqual([a.added, a.updated], [1, 0]);

  // Même email, société écrite différemment → c'est le MÊME prospect.
  const b = importProspects([fixture({ id: "b", company: "CARROSSERIE TEST SARL", email: "GERANT@test.fr" })]);
  assert.deepEqual([b.added, b.updated], [0, 1]);
  assert.equal(useAlpha.getState().prospects.length, 1);
});

test("store — l'import dédoublonne aussi par société quand l'email manque", () => {
  const { importProspects } = useAlpha.getState();
  importProspects([fixture({ id: "a", company: "Garage Vitton", email: undefined })]);
  const b = importProspects([fixture({ id: "b", company: "  garage vitton  ", email: undefined })]);
  assert.equal(b.updated, 1);
  assert.equal(useAlpha.getState().prospects.length, 1);
});

test("store — l'import ne DÉTRUIT pas le travail déjà fait sur la fiche", () => {
  const { importProspects, patchProspect } = useAlpha.getState();
  importProspects([fixture({ id: "a", company: "Test SARL", email: "m@t.fr" })]);
  const id = useAlpha.getState().prospects[0].id;

  // Travail terrain : on avance la fiche et on note une valeur.
  patchProspect(id, { stage: "demo", trust: 90, monthlyValue: 115, notes: "vu sur place le 12" });

  // Un ré-import (fichier source pauvre) ne doit rien écraser de tout ça.
  importProspects([fixture({ id: "b", company: "Test SARL", email: "m@t.fr", trust: 10, monthlyValue: 0, notes: "" })]);
  const p = useAlpha.getState().prospects[0];
  assert.equal(p.stage, "demo", "le stade du pipeline ne se réinitialise jamais à l'import");
  assert.equal(p.trust, 90);
  assert.equal(p.monthlyValue, 115);
  assert.match(p.notes, /vu sur place/);
});

test("store — l'import fusionne la timeline sans dupliquer les événements", () => {
  const { importProspects } = useAlpha.getState();
  const ev = { id: "e1", date: "2026-07-09T09:00:00.000Z", kind: "appel" as const, summary: "Premier contact" };
  importProspects([fixture({ id: "a", email: "m@t.fr", events: [ev] })]);
  importProspects([fixture({ id: "b", email: "m@t.fr", events: [ev, { ...ev, id: "e2", summary: "Relance" }] })]);

  const p = useAlpha.getState().prospects[0];
  const summaries = p.events.map((e) => e.summary);
  assert.equal(summaries.filter((s) => s === "Premier contact").length, 1, "l'événement identique ne doit pas doubler");
  assert.ok(summaries.includes("Relance"), "le nouvel événement est bien ajouté");
});

test("store — le score d'audit à l'import reflète ce qu'on sait vraiment", () => {
  const { importProspects } = useAlpha.getState();
  const riche = fixture({
    id: "r", email: "r@t.fr", company: "Riche",
    deepAudit: {
      websiteState: "aucun", socialState: "inactif", localCompetition: "3 garages",
      currentProcess: "le gérant décroche", missedCallsPerWeek: 9, avgTicket: 400, googleRating: 3.2,
    },
  });
  importProspects([riche]);
  const p = useAlpha.getState().prospects.find((x) => x.company === "Riche")!;
  assert.equal(p.auditScore, auditCompleteness(riche));
  assert.ok(p.auditScore > 50, "une fiche riche doit sortir exploitable");
});

test("store — un audit fait à la main n'est JAMAIS revu à la baisse", () => {
  const { importProspects, patchProspect } = useAlpha.getState();
  importProspects([fixture({ id: "a", email: "m@t.fr" })]);
  const id = useAlpha.getState().prospects[0].id;
  patchProspect(id, { auditScore: 95 });

  // Ré-import d'une fiche vide : le score acquis reste.
  importProspects([fixture({ id: "b", email: "m@t.fr" })]);
  assert.equal(useAlpha.getState().prospects[0].auditScore, 95);
});

test("store — on ne peut pas signer sans remplir les conditions", () => {
  const { upsertProspect, moveStage } = useAlpha.getState();
  upsertProspect(fixture({ id: "s1", stage: "offre", conviction: 4, demoShownBeforePrice: false }));

  const refus = moveStage("s1", "signe");
  assert.equal(refus.ok, false, "une signature sans conviction doit être refusée");
  assert.ok(refus.blockers.length > 0, "et le refus doit dire POURQUOI");
  assert.equal(useAlpha.getState().prospects.find((p) => p.id === "s1")!.stage, "offre");
});

test("store — la signature passe quand tout est au vert", () => {
  const { upsertProspect, moveStage } = useAlpha.getState();
  upsertProspect(
    fixture({
      id: "s2", stage: "offre", conviction: 10, trust: 95, demoShownBeforePrice: true,
      croyances: { produit: 10, soutien: 10, pourLui: 10 }, objections: [],
    })
  );
  const ok = moveStage("s2", "signe");
  assert.equal(ok.ok, true, ok.blockers.join(" · "));
  assert.equal(useAlpha.getState().prospects.find((p) => p.id === "s2")!.stage, "signe");
});

test("store — basculer de compte change l'identité, PAS les données", () => {
  const { upsertProspect, switchAccount } = useAlpha.getState();
  upsertProspect(fixture({ id: "keep", company: "Ne doit pas bouger" }));

  switchAccount("scintia");
  let s = useAlpha.getState();
  assert.equal(s.settings.accountId, "scintia");
  assert.equal(s.settings.agencyName, "ScintIA");
  assert.equal(s.settings.commissionPct, 30);
  assert.equal(s.prospects.length, 1, "les prospects ne bougent pas en changeant de compte");

  switchAccount("nuwacom");
  s = useAlpha.getState();
  assert.equal(s.settings.agencyName, "Nuwacom");
  assert.equal(s.settings.commissionPct, 15);
  assert.equal(s.prospects[0].company, "Ne doit pas bouger");

  switchAccount("eagleye");
});

test("store — une note créée depuis un compte lui reste attachée", () => {
  const { switchAccount, upsertNote } = useAlpha.getState();
  switchAccount("scintia");
  const id = useAlpha.getState().upsertNote({ title: "Note ScintIA", body: "contenu" });
  assert.equal(useAlpha.getState().notes.find((n) => n.id === id)!.accountId, "scintia");

  // Rééditée depuis un AUTRE compte, elle ne change pas de propriétaire.
  useAlpha.getState().switchAccount("eagleye");
  useAlpha.getState().upsertNote({ id, title: "Note ScintIA", body: "contenu modifié" });
  const n = useAlpha.getState().notes.find((x) => x.id === id)!;
  assert.equal(n.accountId, "scintia", "l'édition ne doit pas voler la note à son compte");
  assert.match(n.body, /modifié/);
});

test("store — supprimer une note ne touche qu'elle", () => {
  const { upsertNote, deleteNote } = useAlpha.getState();
  const a = useAlpha.getState().upsertNote({ title: "A", body: "a" });
  const b = useAlpha.getState().upsertNote({ title: "B", body: "b" });
  useAlpha.getState().deleteNote(a);
  const ids = useAlpha.getState().notes.map((n) => n.id);
  assert.equal(ids.includes(a), false);
  assert.ok(ids.includes(b));
});

test("store — le payout versé se bascule et ne concerne que ce paiement", () => {
  const { togglePayoutSettled } = useAlpha.getState();
  togglePayoutSettled("pay-1");
  assert.deepEqual(useAlpha.getState().settledPayouts, ["pay-1"]);
  togglePayoutSettled("pay-2");
  assert.equal(useAlpha.getState().settledPayouts.length, 2);
  togglePayoutSettled("pay-1");
  assert.deepEqual(useAlpha.getState().settledPayouts, ["pay-2"]);
});

test("store — l'export/import JSON conserve les données", () => {
  const { upsertProspect, exportData, clearAllData, importData } = useAlpha.getState();
  upsertProspect(fixture({ id: "x", company: "À restaurer", monthlyValue: 315 }));
  const json = useAlpha.getState().exportData();

  useAlpha.getState().clearAllData();
  assert.equal(useAlpha.getState().prospects.length, 0);

  const r = useAlpha.getState().importData(json);
  assert.equal(r.ok, true, r.error);
  const p = useAlpha.getState().prospects.find((x) => x.company === "À restaurer");
  assert.ok(p, "le prospect doit être restauré");
  assert.equal(p!.monthlyValue, 315);
});

test("store — un JSON invalide est refusé proprement, sans vider les données", () => {
  const { upsertProspect } = useAlpha.getState();
  upsertProspect(fixture({ id: "safe", company: "Ne pas perdre" }));

  const r = useAlpha.getState().importData("{ ceci n'est pas du json");
  assert.equal(r.ok, false);
  assert.ok(r.error, "l'échec doit être expliqué");
  assert.equal(useAlpha.getState().prospects.length, 1, "un import raté ne doit RIEN détruire");
});
