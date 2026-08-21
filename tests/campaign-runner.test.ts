import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCampaignRun, callsMadeToday, skipBreakdown } from "../lib/campaign-runner";
import { DO_NOT_CALL_TAG } from "../lib/voice-script";
import type { Prospect, TimelineEvent } from "../lib/types";

// Mardi 9h30 — fenêtre professionnelle ouverte.
const NOW = new Date("2026-08-18T09:30:00");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

function ev(over: Partial<TimelineEvent>): TimelineEvent {
  return { id: `e${Math.random()}`, date: hoursAgo(1), kind: "appel", summary: "", ...over } as TimelineEvent;
}

function fixture(over: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1", name: "Marc", company: "Test SARL", sector: "artisan", city: "Lyon",
    phone: "0478000000", email: "m@t.fr", stage: "contact", trust: 50, likeness: 50, auditScore: 60,
    conviction: 5, monthlyValue: 115, setupValue: 990, probability: 20, ignoranceTax: 0,
    croyances: { produit: 5, soutien: 5, pourLui: 5 }, obstacles: [], objections: [], events: [],
    demoShownBeforePrice: false, nextStep: null, tags: [], attachments: [], notes: "",
    deepAudit: {
      websiteState: "aucun", socialState: "inactif", localCompetition: "3 garages",
      currentProcess: "le gérant décroche entre deux réparations", missedCallsPerWeek: 8, avgTicket: 400,
    },
    problems: [], solution: "", personalizedOffer: "", payments: [], contract: { status: "aucun" },
    delivery: "non-demarre", createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z",
    ...over,
  } as Prospect;
}

test("campagne — une fiche exploitable entre dans la file avec SON script", () => {
  const run = buildCampaignRun([fixture()], { now: NOW });
  assert.equal(run.queue.length, 1);
  const t = run.queue[0];
  assert.equal(t.phone, "+33478000000");
  assert.equal(t.rank, 1);
  // Le brief est personnalisé : il porte les signaux de CETTE fiche.
  assert.match(t.brief, /Test SARL/);
  assert.match(t.brief, /8 appels manqués/);
  assert.match(t.brief, /Questions qui font constater/);
  assert.ok(t.objective.length > 0);
});

test("campagne — le droit d'opposition écarte la fiche, définitivement", () => {
  const run = buildCampaignRun([fixture({ tags: [DO_NOT_CALL_TAG] })], { now: NOW });
  assert.equal(run.queue.length, 0);
  assert.equal(run.skipped[0].reason, "opposition");
});

test("campagne — un numéro inexploitable ne part pas dans le vide", () => {
  const run = buildCampaignRun([fixture({ phone: "" }), fixture({ id: "p2", phone: "abc" })], { now: NOW });
  assert.equal(run.queue.length, 0);
  assert.equal(run.skipped.length, 2);
  assert.ok(run.skipped.every((s) => s.reason === "numero-invalide"));
});

test("campagne — celui qui a répondu n'est JAMAIS rappelé par la machine", () => {
  const run = buildCampaignRun(
    [fixture({ events: [ev({ date: hoursAgo(2), summary: "Il a répondu, intéressé" })] })],
    { now: NOW }
  );
  assert.equal(run.queue.length, 0);
  assert.equal(run.skipped[0].reason, "a-repondu");
  assert.match(run.skipped[0].detail, /closer/i);
});

test("campagne — un rappel pas encore dû attend son heure", () => {
  const run = buildCampaignRun(
    [fixture({ events: [ev({ date: hoursAgo(1), summary: "sans réponse" })] })],
    { now: NOW }
  );
  assert.equal(run.queue.length, 0);
  assert.equal(run.skipped[0].reason, "cadence-attente");
});

test("campagne — un rappel dû repart, avec son index", () => {
  const run = buildCampaignRun(
    [fixture({ events: [ev({ date: hoursAgo(4), summary: "sans réponse" })] })],
    { now: NOW }
  );
  assert.equal(run.queue.length, 1);
  assert.equal(run.queue[0].recallIndex, 0, "premier rappel après le 1er appel");
});

test("campagne — un prospect saturé est protégé, pas rappelé", () => {
  const sature = fixture({
    events: [4, 30, 54, 78].map((h) => ev({ date: hoursAgo(h), kind: "email", summary: `relance ${h}` })),
  });
  const run = buildCampaignRun([sature], { now: NOW });
  assert.equal(run.queue.length, 0);
  assert.equal(run.skipped[0].reason, "sature");
});

test("campagne — une fiche trop pauvre est écartée plutôt qu'appelée à vide", () => {
  const pauvre = fixture({
    id: "vide", trust: 0, auditScore: 0, setupValue: 0, monthlyValue: 0, email: "",
    deepAudit: { websiteState: "", socialState: "", localCompetition: "", currentProcess: "" },
  });
  const run = buildCampaignRun([pauvre], { now: NOW });
  assert.equal(run.queue.length, 0);
  assert.equal(run.skipped[0].reason, "hors-icp");
});

test("campagne — le plus près de signer passe en premier", () => {
  const froid = fixture({ id: "froid", trust: 10, conviction: 2 });
  const chaud = fixture({
    id: "chaud", trust: 90, conviction: 9, stage: "offre", demoShownBeforePrice: true,
    croyances: { produit: 9, soutien: 9, pourLui: 9 },
    funding: { availableAt: hoursAgo(24), channel: "virement", confirmed: true },
  });
  const run = buildCampaignRun([froid, chaud], { now: NOW });
  assert.equal(run.queue[0].prospectId, "chaud");
  assert.ok(run.queue[0].priority > run.queue[1].priority);
});

test("campagne — le plafond quotidien protège la qualité de conversation", () => {
  const lot = Array.from({ length: 8 }, (_, i) => fixture({ id: `p${i}` }));
  const run = buildCampaignRun(lot, { now: NOW, dailyCap: 3 });
  assert.equal(run.queue.length, 3);
  assert.equal(run.skipped.filter((s) => s.reason === "plafond-atteint").length, 5);
  assert.equal(run.dailyCap, 3);
});

test("campagne — les appels déjà passés aujourd'hui consomment le budget", () => {
  const dejaAppele = fixture({ id: "hier", events: [ev({ date: NOW.toISOString(), summary: "sans réponse" })] });
  assert.equal(callsMadeToday([dejaAppele], NOW), 1);
  const lot = [dejaAppele, fixture({ id: "a" }), fixture({ id: "b" })];
  const run = buildCampaignRun(lot, { now: NOW, dailyCap: 2 });
  assert.equal(run.alreadyToday, 1);
  assert.equal(run.queue.length, 1, "il ne reste qu'un appel de budget");
});

test("campagne — hors fenêtre horaire, la file existe mais est signalée fermée", () => {
  const dimanche = new Date("2026-08-16T11:00:00");
  const run = buildCampaignRun([fixture()], { now: dimanche });
  assert.equal(run.windowOpen, false);
  assert.match(run.summary, /fenêtre est fermée/i);
  // Forçage explicite possible (démo calée un week-end).
  const forced = buildCampaignRun([fixture()], { now: dimanche, forceWindow: true });
  assert.equal(forced.windowOpen, true);
});

test("campagne — la répartition des écarts explique ce qui bloque le volume", () => {
  const lot = [
    fixture({ id: "a", tags: [DO_NOT_CALL_TAG] }),
    fixture({ id: "b", tags: [DO_NOT_CALL_TAG] }),
    fixture({ id: "c", phone: "" }),
  ];
  const run = buildCampaignRun(lot, { now: NOW });
  const b = skipBreakdown(run);
  assert.equal(b[0].reason, "opposition");
  assert.equal(b[0].count, 2);
});
