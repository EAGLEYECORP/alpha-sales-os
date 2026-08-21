import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLadder, ladderPitch, HIGH_DEMAND_PER_WEEK } from "../lib/ladder";
import { commissionFor } from "../lib/accounts";
import type { Prospect } from "../lib/types";

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    name: "Marc",
    company: "Test SARL",
    sector: "artisan",
    city: "Lyon",
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

test("escalier — marche 1 : un trou de visibilité revient à EAGLEYE", () => {
  const l = buildLadder(fixture({ deepAudit: { websiteState: "aucun", socialState: "", localCompetition: "", currentProcess: "" } }));
  assert.equal(l.entry?.id, "visibilite");
  assert.equal(l.entry?.accountId, "eagleye");
  assert.ok(l.entry?.evidence.some((e) => /aucun site/.test(e)));
});

test("escalier — marche 2 : un volume de demandes élevé déclenche Callflow (ScintIA)", () => {
  const l = buildLadder(
    fixture({
      deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: HIGH_DEMAND_PER_WEEK },
    })
  );
  const cf = l.rungs.find((r) => r.id === "callflow");
  assert.equal(cf?.accountId, "scintia");
  assert.equal(cf?.commissionPct, 30);
  assert.equal(cf?.recurringPct, 10);
});

test("escalier — sous le seuil, Callflow ne se déclenche pas", () => {
  const l = buildLadder(
    fixture({ deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: HIGH_DEMAND_PER_WEEK - 1 } })
  );
  assert.equal(l.rungs.some((r) => r.id === "callflow"), false);
});

test("escalier — marche 3 : l'automatisation après Callflow porte l'argument « moins de setup »", () => {
  const p = fixture({
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: 9 },
  });
  const l = buildLadder(p, { automationWanted: true });
  const auto = l.rungs.find((r) => r.id === "automatisation");
  assert.equal(auto?.accountId, "eagleye", "l'automatisation est portée par EAGLEYE");
  assert.match(auto!.pitch, /point d'entrée/i);
  assert.match(auto!.pitch, /MOINS de setup/i);

  // Sans Callflow en amont, l'argument change (on ne promet pas une remise
  // qu'on ne peut pas justifier).
  const seul = buildLadder(fixture(), { automationWanted: true });
  const autoSeul = seul.rungs.find((r) => r.id === "automatisation");
  assert.doesNotMatch(autoSeul!.pitch, /MOINS de setup/i);
});

test("escalier — marche 4 : au-delà de 40 k, ça part chez Nuwacom (15 % + 100 % maintenance)", () => {
  const l = buildLadder(fixture({ setupValue: 60000 }));
  const gros = l.rungs.find((r) => r.id === "gros-chantier");
  assert.equal(gros?.accountId, "nuwacom");
  assert.equal(gros?.commissionPct, 15);
  assert.equal(gros?.recurringPct, 100, "la maintenance mensuelle revient à 100 % chez nous");
});

test("escalier — Nuwacom : 15 % sur le devis, 100 % sur la maintenance mensuelle", () => {
  const devis = commissionFor("nuwacom", { amountHT: 60000 });
  assert.equal(devis.pct, 15);
  assert.equal(devis.amount, 9000);
  const maintenance = commissionFor("nuwacom", { amountHT: 1200, recurring: true });
  assert.equal(maintenance.pct, 100);
  assert.equal(maintenance.amount, 1200);
});

test("escalier — un prospect complet empile PLUSIEURS marches, dans l'ordre", () => {
  const p = fixture({
    setupValue: 50000,
    deepAudit: {
      websiteState: "aucun",
      socialState: "inactif",
      localCompetition: "",
      currentProcess: "le gérant décroche entre deux chantiers",
      missedCallsPerWeek: 12,
      googleReviews: 4,
    },
  });
  const l = buildLadder(p, { automationWanted: true });
  assert.deepEqual(
    l.rungs.map((r) => r.id),
    ["visibilite", "callflow", "automatisation", "gros-chantier"],
    "l'ordre de l'escalier est imposé"
  );
  // Les 3 comptes sont concernés par ce seul prospect.
  assert.deepEqual(l.accountIds.sort(), ["eagleye", "nuwacom", "scintia"]);
  assert.equal(l.entry?.id, "visibilite");
  assert.match(ladderPitch(l), /Callflow/);
});

test("escalier — fiche vide : aucune marche, il faut d'abord qualifier", () => {
  const l = buildLadder(fixture());
  assert.equal(l.rungs.length, 0);
  assert.equal(l.entry, null);
  assert.match(l.summary, /qualifier/i);
});
