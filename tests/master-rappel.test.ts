import { test } from "node:test";
import assert from "node:assert/strict";
import { vitalSigns, triageByReadiness } from "../lib/vital-signs";
import { masterRappel } from "../lib/master-rappel";
import type { Prospect, TimelineEvent } from "../lib/types";

const NOW = new Date("2026-08-21T09:00:00.000Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function ev(over: Partial<TimelineEvent>): TimelineEvent {
  return { id: `e${Math.random()}`, date: ago(1), kind: "appel", summary: "", ...over } as TimelineEvent;
}

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    name: "Marc Dubois",
    company: "Test SARL",
    sector: "artisan",
    city: "Lyon",
    phone: "0478000000",
    email: "marc@test.fr",
    stage: "contact",
    trust: 50,
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
    createdAt: ago(60),
    updatedAt: ago(1),
    ...over,
  } as Prospect;
}

/** Une fiche prête à signer : tous les signaux vitaux au vert. */
const readyProspect = (over: Partial<Prospect> = {}) =>
  fixture({
    stage: "offre",
    trust: 85,
    conviction: 9,
    auditScore: 80,
    setupValue: 990,
    monthlyValue: 115,
    demoShownBeforePrice: true,
    croyances: { produit: 9, soutien: 9, pourLui: 9 },
    // Un prospect réellement prêt a une date de déblocage CONFIRMÉE :
    // sans elle, un « oui » n'est qu'une intention.
    funding: { availableAt: ago(-1), channel: "virement", approver: "le gérant", confirmed: true },
    nextStep: { date: ago(-2), action: "RDV closing" },
    events: [ev({ date: ago(2), kind: "visite", summary: "Démo faite, devis construit ensemble" })],
    ...over,
  });

test("signaux vitaux — une fiche complète est prête à signer", () => {
  const s = vitalSigns(readyProspect(), NOW);
  assert.ok(s.readiness >= 70, `readiness attendu >= 70, obtenu ${s.readiness}`);
  assert.equal(s.blockers.length, 0);
  assert.match(s.summary, /Prêt à signer/);
});

test("signaux vitaux — chaque blocage est nommé avec sa raison", () => {
  const s = vitalSigns(fixture(), NOW);
  assert.ok(s.readiness < 70);
  assert.ok(s.blockers.length >= 3);
  assert.ok(s.blockers.some((b) => /Démo montrée AVANT le prix/.test(b)));
  assert.ok(s.blockers.some((b) => /Prochaine étape DATÉE/.test(b)));
});

test("signaux vitaux — 4 relances sèches = saturation, et un vrai silence imposé", () => {
  const p = fixture({
    events: [
      ev({ date: ago(1), kind: "email", summary: "relance 4" }),
      ev({ date: ago(3), kind: "email", summary: "relance 3" }),
      ev({ date: ago(5), kind: "appel", summary: "relance 2" }),
      ev({ date: ago(7), kind: "appel", summary: "relance 1" }),
    ],
  });
  const s = vitalSigns(p, NOW);
  assert.equal(s.unansweredTouches, 4);
  assert.equal(s.fatigueLevel, "sature");
  // La fenêtre est repoussée dans le futur, avec une raison neuve exigée.
  assert.ok(new Date(s.bestWindow.at).getTime() > NOW.getTime());
  assert.match(s.bestWindow.why, /raison NEUVE/i);
});

test("signaux vitaux — un signe de vie DE LUI casse la saturation", () => {
  const p = fixture({
    events: [
      ev({ date: ago(2), kind: "appel", summary: "Il a rappelé — intéressé" }),
      ev({ date: ago(5), kind: "email", summary: "relance 2" }),
      ev({ date: ago(7), kind: "email", summary: "relance 1" }),
    ],
  });
  const s = vitalSigns(p, NOW);
  assert.equal(s.unansweredTouches, 0, "le compteur repart à zéro dès qu'il répond");
  assert.equal(s.daysSinceInbound, 2);
  assert.notEqual(s.fatigueLevel, "sature");
});

test("master rappel — un prospect prêt déclenche le rituel de closing du compte", () => {
  const eagleye = masterRappel(readyProspect(), { now: NOW, accountId: "eagleye" });
  assert.equal(eagleye.closing?.accountId, "eagleye");
  assert.match(eagleye.closing!.action, /DEVIS/i);
  assert.equal(eagleye.closing?.fromEmail, "contact@eagleyecorp.fr");
  assert.match(eagleye.headline, /PRÊT À SIGNER/);

  const scintia = masterRappel(readyProspect(), { now: NOW, accountId: "scintia" });
  assert.match(scintia.closing!.action, /PROPOSITION COMMERCIALE/i);
  assert.equal(scintia.closing?.fromEmail, "z.tazi@scintia.ai");
  assert.equal(scintia.closing?.panelUrl, "https://sales.scintiacallflow.ai/");

  const nuwacom = masterRappel(readyProspect(), { now: NOW, accountId: "nuwacom" });
  assert.match(nuwacom.closing!.action, /CADRAGE/i);
  assert.match(nuwacom.closing!.contactName!, /Christophe/);
  assert.equal(nuwacom.closing?.timezone, "Europe/Luxembourg");
});

test("master rappel — pas prêt = pas de closing proposé", () => {
  const plan = masterRappel(fixture(), { now: NOW });
  assert.equal(plan.closing, null, "on ne propose pas un devis à un prospect non qualifié");
});

test("master rappel — les actions sont réparties entre l'humain et Alpha", () => {
  const plan = masterRappel(fixture({ stage: "audit" }), { now: NOW });
  assert.ok(plan.human.length > 0);
  assert.ok(plan.alpha.length > 0);
  assert.ok(plan.human.every((a) => a.owner === "humain"));
  assert.ok(plan.alpha.every((a) => a.owner === "alpha"));
  // L'étape audit exige de récolter ce qu'il faut pour la suite.
  assert.ok(plan.human[0].mustCapture?.length, "chaque action porte ce qu'il faut récolter");
});

test("master rappel — la checklist dit si ça tourne et si Alpha reçoit la donnée", () => {
  const muet = masterRappel(fixture({ email: "", phone: "", events: [] }), { now: NOW });
  const joignable = muet.checks.find((c) => c.id === "joignable");
  assert.equal(joignable?.state, "absent");
  const retour = muet.checks.find((c) => c.id === "retour-donnee");
  assert.equal(retour?.state, "absent");
  assert.match(retour!.detail, /rien à analyser/i);

  const vivant = masterRappel(fixture({ events: [ev({ date: ago(2), summary: "appel" })] }), { now: NOW });
  assert.equal(vivant.checks.find((c) => c.id === "retour-donnee")?.state, "actif");
});

test("master rappel — quand il a répondu, Alpha Voice s'arrête et l'humain reprend", () => {
  const plan = masterRappel(fixture(), {
    now: NOW,
    attempts: [
      { at: ago(2), outcome: "sans-reponse" },
      { at: ago(1), outcome: "repondu" },
    ],
  });
  const reprise = plan.human.find((a) => a.id === "reprise-humaine");
  assert.ok(reprise, "l'humain doit reprendre la main");
  assert.match(reprise!.do, /REPRENDRE LA MAIN/);
  // Et aucune action Alpha ne rappelle ce prospect.
  assert.equal(plan.alpha.some((a) => a.channel === "appel" && a.id === "cadence-appel"), false);
});

test("comms — la fréquence suit le comportement, pas le calendrier", () => {
  // Prêt à signer → tous les jours, en visio, ton direct.
  const chaud = masterRappel(readyProspect(), { now: NOW }).comms;
  assert.equal(chaud.everyDays, 1);
  assert.equal(chaud.channel, "visio");
  assert.match(chaud.say, /on démarre quand/i);

  // Saturé → espacement long + interdiction de relancer.
  const sature = masterRappel(
    fixture({
      events: [1, 3, 5, 7].map((d) => ev({ date: ago(d), kind: "email", summary: `relance ${d}` })),
    }),
    { now: NOW }
  ).comms;
  assert.ok(sature.everyDays >= 7, `espacement attendu long, obtenu ${sature.everyDays}`);
  assert.ok(sature.avoid.some((a) => /saturé/i.test(a)));
  assert.match(sature.say, /raison NEUVE/i);
  // 4 touches ignorées → on change de canal.
  assert.equal(sature.channel, "terrain");
});

test("comms — on n'annonce jamais un prix avant la démo", () => {
  const c = masterRappel(fixture({ stage: "demo", demoShownBeforePrice: false }), { now: NOW }).comms;
  assert.ok(c.avoid.some((a) => /prix avant/i.test(a)));
});

test("triage — les saturés sortent de la file du jour, les prêts passent devant", () => {
  const chaud = readyProspect({ id: "chaud" });
  const sature = fixture({
    id: "sature",
    events: [1, 2, 3, 4].map((d) => ev({ date: ago(d), kind: "email", summary: `relance ${d}` })),
  });
  const tiede = fixture({ id: "tiede", trust: 60, auditScore: 60 });
  const file = triageByReadiness([sature, tiede, chaud], NOW);
  assert.equal(file[0].prospect.id, "chaud");
  assert.equal(file.some((x) => x.prospect.id === "sature"), false, "un saturé ne doit pas être rappelé aujourd'hui");
});
