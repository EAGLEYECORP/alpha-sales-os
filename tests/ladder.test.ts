import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLadder, ladderPitch, HIGH_DEMAND_PER_WEEK } from "../lib/ladder";
import { commissionFor } from "../lib/accounts-commercial";
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

test("escalier — marche 2 : un volume de demandes élevé déclenche Alpha Voice (EAGLEYE)", () => {
  const l = buildLadder(
    fixture({
      deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: HIGH_DEMAND_PER_WEEK },
    })
  );
  const cf = l.rungs.find((r) => r.id === "alpha-voice");
  /**
   * ⚠ CETTE MARCHE A CHANGÉ DE MAIN. Elle revenait à un revendeur, à 30 % du
   * setup et 10 % du mensuel. L'accord est mort ; l'offre est revenue chez
   * nous sous le nom d'Alpha Voice. La marche existe toujours — le besoin
   * qu'elle détecte n'a pas bougé — mais elle rapporte maintenant 100 %.
   */
  assert.equal(cf?.accountId, "eagleye");

  /**
   * ⚠ CES DEUX ASSERTIONS LISAIENT `cf.commissionPct` ET `cf.recurringPct`.
   *
   * Ces champs ont été retirés de l'escalier : ce module descend dans le
   * navigateur, et les chunks de `_next/static/**` sont servis sans cookie.
   * `commissionPct:30` et `recurringPct:10` étaient donc téléchargeables à
   * côté du nom du partenaire — par lui comme par n'importe qui.
   *
   * Aucun écran ne les lisait : SEULS ces tests les touchaient. Ils
   * garantissaient la doctrine sur une COPIE des chiffres, pendant que
   * l'original vivait dans `accounts-commercial`. On interroge donc
   * l'original, par le compte que la marche désigne — ce qui vérifie en plus
   * que l'escalier et l'économie ne se sont pas désynchronisés.
   */
  const eco = commissionFor(cf!.accountId, { amountHT: 990, offeringKey: "alpha-voice" });
  assert.equal(eco.pct, 100, "Alpha Voice est à nous : rien à reverser sur le setup");
  const recurrent = commissionFor(cf!.accountId, { amountHT: 200, recurring: true, offeringKey: "alpha-voice" });
  assert.equal(recurrent.pct, 100, "ni sur le mensuel");
});

test("escalier — sous le seuil, Callflow ne se déclenche pas", () => {
  const l = buildLadder(
    fixture({ deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "", missedCallsPerWeek: HIGH_DEMAND_PER_WEEK - 1 } })
  );
  assert.equal(l.rungs.some((r) => r.id === "alpha-voice"), false);
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
  // Même raison qu'à la marche 2 : l'économie se lit à sa source, jamais sur
  // la marche — celle-ci part dans le navigateur.
  const eco = commissionFor(gros!.accountId, { amountHT: 60000 });
  assert.equal(eco.pct, 15, "le gros devis justifie les 15 %");
  const maintenance = commissionFor(gros!.accountId, { amountHT: 1200, recurring: true });
  assert.equal(maintenance.pct, 100, "la maintenance mensuelle revient à 100 % chez nous");
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
    ["visibilite", "alpha-voice", "automatisation", "gros-chantier"],
    "l'ordre de l'escalier est imposé"
  );
  // Les DEUX comptes du portefeuille sont concernés par ce seul prospect —
  // ils étaient trois avant le départ du revendeur, et trois marches sur
  // quatre reviennent maintenant à EAGLEYE.
  assert.deepEqual(l.accountIds.sort(), ["eagleye", "nuwacom"]);
  assert.equal(l.entry?.id, "visibilite");
  assert.match(ladderPitch(l), /Alpha Voice/);
});

test("escalier — fiche vide : aucune marche, il faut d'abord qualifier", () => {
  const l = buildLadder(fixture());
  assert.equal(l.rungs.length, 0);
  assert.equal(l.entry, null);
  assert.match(l.summary, /qualifier/i);
});
