import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyStandard, streak, reminderText, type StandardDay } from "../lib/standard";
import type { Prospect, Meeting } from "../lib/types";

// Mardi 18 août 2026.
const NOW = new Date("2026-08-18T10:00:00");
const iso = (d: string) => new Date(d).toISOString();

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1", name: "Marc", company: "Test SARL", sector: "artisan", city: "Lyon",
    phone: "0478000000", email: "m@t.fr", stage: "contact", trust: 50, likeness: 50, auditScore: 60,
    conviction: 5, monthlyValue: 0, setupValue: 0, probability: 20, ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 }, obstacles: [], objections: [], events: [],
    demoShownBeforePrice: false, nextStep: null, tags: [], attachments: [], notes: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
    problems: [], solution: "", personalizedOffer: "", payments: [], contract: { status: "aucun" },
    delivery: "non-demarre", createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

/** Prospect réellement prêt à signer. */
const readyProspect = (id: string) =>
  fixture({
    id, company: `Chaud ${id}`, stage: "offre", trust: 90, conviction: 9, auditScore: 80,
    setupValue: 990, monthlyValue: 115, demoShownBeforePrice: true,
    croyances: { produit: 9, soutien: 9, pourLui: 9 },
    nextStep: { date: iso("2026-08-20T09:00:00"), action: "closing" },
    funding: { availableAt: iso("2026-08-10T09:00:00"), channel: "virement", confirmed: true },
    events: [{ id: "e", date: iso("2026-08-17T09:00:00"), kind: "visite", summary: "démo faite" }],
  });

function meeting(over: Partial<Meeting> = {}): Meeting {
  return {
    id: "m1", prospectId: "p1", title: "Closing Test SARL", date: iso("2026-08-18T14:00:00"),
    durationMin: 45, kind: "closing", channel: "visio", location: "Lyon", reminded: false, done: false,
    ...over,
  } as Meeting;
}

test("barre — un rendez-vous du jour passe en tête et n'est pas reportable", () => {
  const s = dailyStandard([fixture()], [meeting()], 0, [], NOW);
  assert.equal(s.items[0].kind, "echeance");
  assert.match(s.items[0].label, /Rendez-vous/);
  assert.equal(s.held, false, "une échéance non traitée annule la journée");
  assert.match(s.verdict, /ne se reporte pas/);
});

test("barre — les échéances priment : 100 % du reste ne suffit pas", () => {
  const s0 = dailyStandard([fixture()], [meeting()], 0, [], NOW);
  // On coche TOUT sauf le rendez-vous.
  const tout = s0.items.filter((i) => i.id !== s0.items[0].id).map((i) => i.id);
  const s = dailyStandard([fixture()], [meeting()], 0, tout, NOW);
  assert.equal(s.held, false, "la barre ne peut pas être tenue avec une échéance en l'air");
});

test("barre — tenue quand les échéances sont traitées et 70 % du reste aussi", () => {
  const s0 = dailyStandard([fixture()], [], 0, [], NOW);
  const tous = s0.items.map((i) => i.id);
  const s = dailyStandard([fixture()], [], 0, tous, NOW);
  assert.equal(s.held, true);
  assert.match(s.verdict, /Barre tenue/);
});

test("barre — un prospect prêt à signer apparaît, un prospect froid non", () => {
  const s = dailyStandard([readyProspect("chaud"), fixture({ id: "froid" })], [], 0, [], NOW);
  const closings = s.items.filter((i) => i.kind === "closing");
  assert.equal(closings.length, 1);
  assert.match(closings[0].label, /prêt à signer/);
  assert.match(closings[0].why, /On ne fait pas attendre un acheteur/);
});

test("barre — les fonds débloqués aujourd'hui déclenchent une échéance", () => {
  const p = fixture({ id: "f", company: "Fonds SARL", funding: { availableAt: iso("2026-08-18T08:00:00"), channel: "virement", confirmed: true } });
  const s = dailyStandard([p], [], 0, [], NOW);
  assert.ok(s.items.some((i) => i.id === "fonds-f"));
  assert.ok(s.items.find((i) => i.id === "fonds-f")!.why.includes("virement"));
});

test("barre — les actions du palier suivent le CA encaissé", () => {
  const debut = dailyStandard([fixture()], [], 0, [], NOW);
  const avance = dailyStandard([fixture()], [], 2_000_000, [], NOW);
  assert.equal(debut.palier.id, "p0");
  assert.equal(avance.palier.id, "p2");
  // Les actions quotidiennes changent avec le palier.
  assert.notDeepEqual(
    debut.items.filter((i) => i.kind === "palier").map((i) => i.label),
    avance.items.filter((i) => i.kind === "palier").map((i) => i.label)
  );
});

test("série — les week-ends ne cassent pas la série", () => {
  // Lundi 17 tenu, vendredi 14 tenu → série de 2 malgré le week-end du 15-16.
  const h: StandardDay[] = [
    { date: "2026-08-17", checked: [], held: true },
    { date: "2026-08-14", checked: [], held: true },
  ];
  assert.equal(streak(h, NOW), 2);
});

test("série — la journée en cours ne casse pas la série tant qu'elle n'est pas finie", () => {
  const h: StandardDay[] = [{ date: "2026-08-17", checked: [], held: true }];
  // Aujourd'hui (18) pas encore tenu : la série d'hier tient toujours.
  assert.equal(streak(h, NOW), 1);
});

test("série — un jour ouvré manqué casse net", () => {
  // 17 manqué, 14 tenu → la série est à 0.
  const h: StandardDay[] = [{ date: "2026-08-14", checked: [], held: true }];
  assert.equal(streak(h, NOW), 0);
});

test("série — un historique vide donne 0, jamais une erreur", () => {
  assert.equal(streak([], NOW), 0);
});

test("rappel — il nomme l'échéance en priorité, et jamais de culpabilisation", () => {
  const s = dailyStandard([readyProspect("c")], [meeting()], 0, [], NOW);
  const r = reminderText(s)!;
  assert.match(r.title, /Échéance/);
  assert.match(r.body, /Rendez-vous/);
  assert.doesNotMatch(`${r.title} ${r.body}`, /retard|échec|raté|encore/i);
});

test("rappel — rien à rappeler quand tout est fait", () => {
  const s0 = dailyStandard([fixture()], [], 0, [], NOW);
  const s = dailyStandard([fixture()], [], 0, s0.items.map((i) => i.id), NOW);
  assert.equal(reminderText(s), null);
});
