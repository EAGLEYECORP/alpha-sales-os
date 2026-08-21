import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOutcome, summaryFor, transcriptNote, PENDING_MARK, type CallOutcome } from "../lib/call-outcome";
import { appendCallAttempt } from "../lib/campaign-tick";
import { attemptsFromEvents } from "../lib/master-rappel";
import { cadenceFor } from "../lib/call-cadence";
import type { CallSession } from "../lib/call-log";
import type { Prospect } from "../lib/types";

const NOW = new Date("2026-08-18T10:00:00");

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

function session(over: Partial<CallSession> = {}): CallSession {
  return {
    id: "s1", room: "r1", direction: "sortant", startedAt: NOW.toISOString(),
    state: "terminee", turns: [], ...over,
  };
}

test("aller-retour — chaque résultat se réécrit et se relit à l'identique", () => {
  // LA propriété critique : résultat → texte → résultat. Si elle casse, la
  // cadence se trompe en silence.
  const outcomes: CallOutcome[] = ["repondu", "sans-reponse", "opposition", "invalide"];
  for (const o of outcomes) {
    const p = applyOutcome(fixture(), session({ outcome: o }), NOW).prospect;
    const attempts = attemptsFromEvents(p);
    assert.equal(attempts.length, 1, `${o} : un seul événement attendu`);
    assert.equal(attempts[0].outcome, o, `« ${summaryFor(o)} » doit se relire comme ${o}`);
  }
});

test("réconciliation — l'événement EN ATTENTE est corrigé, pas doublé", () => {
  const pending = appendCallAttempt(fixture(), NOW);
  assert.match(pending.events[0].summary, new RegExp(PENDING_MARK));

  const r = applyOutcome(pending, session({ outcome: "repondu", turns: [{ at: NOW.toISOString(), speaker: "prospect", text: "oui bonjour" }] }), NOW);
  assert.equal(r.matched, true);
  assert.equal(r.prospect.events.length, 1, "on corrige, on n'empile pas");
  assert.doesNotMatch(r.prospect.events[0].summary, new RegExp(PENDING_MARK));
  assert.match(r.prospect.events[0].summary, /répondu/i);
});

test("réconciliation — après un « répondu », la machine s'arrête et passe la main", () => {
  const pending = appendCallAttempt(fixture(), NOW);
  const r = applyOutcome(pending, session({ outcome: "repondu" }), NOW);
  const d = cadenceFor(attemptsFromEvents(r.prospect), NOW);
  assert.equal(d.state, "repondu-passer-humain");
  assert.equal(d.callNow, false, "on ne rappelle JAMAIS quelqu'un qui a décroché");
  assert.equal(d.handoffToHuman, true);
});

test("réconciliation — un appel sans événement en attente crée sa trace", () => {
  // Appel entrant ou manuel : rien n'a été posé avant. On ne perd pas la trace.
  const r = applyOutcome(fixture(), session({ direction: "entrant", outcome: "repondu" }), NOW);
  assert.equal(r.matched, false);
  assert.equal(r.prospect.events.length, 1);
});

test("réconciliation — deux appels rapprochés ne se volent pas leur résultat", () => {
  const t1 = new Date("2026-08-18T10:00:00");
  const t2 = new Date("2026-08-18T10:20:00");
  let p = appendCallAttempt(fixture(), t1);
  p = appendCallAttempt(p, t2);
  assert.equal(p.events.length, 2);

  // Le résultat de la session de 10h20 doit corriger l'événement de 10h20.
  const r = applyOutcome(p, session({ startedAt: t2.toISOString(), outcome: "repondu" }), t2);
  const corrige = r.prospect.events.find((e) => e.date === t2.toISOString())!;
  const intact = r.prospect.events.find((e) => e.date === t1.toISOString())!;
  assert.match(corrige.summary, /répondu/i);
  assert.match(intact.summary, new RegExp(PENDING_MARK), "l'autre appel reste en attente");
});

test("opposition — le tag « ne-pas-appeler » est posé, définitivement", () => {
  const r = applyOutcome(fixture(), session({ outcome: "opposition" }), NOW);
  assert.equal(r.optOut, true);
  assert.ok(r.prospect.tags.includes("ne-pas-appeler"));
  // La cadence s'arrête net.
  assert.equal(cadenceFor(attemptsFromEvents(r.prospect), NOW).state, "stop-definitif");
});

test("opposition — le tag n'est pas ajouté deux fois", () => {
  const deja = fixture({ tags: ["ne-pas-appeler", "juillet"] });
  const r = applyOutcome(deja, session({ outcome: "opposition" }), NOW);
  assert.equal(r.prospect.tags.filter((t) => t === "ne-pas-appeler").length, 1);
});

test("apprentissages — ce qu'il a dit va dans les NOTES, pas dans les champs", () => {
  const s = session({
    outcome: "repondu",
    turns: [
      { at: NOW.toISOString(), speaker: "agent", text: "Vous perdez des appels ?" },
      { at: NOW.toISOString(), speaker: "prospect", text: "C'est trop cher pour nous en ce moment." },
      { at: NOW.toISOString(), speaker: "prospect", text: "Rappelez-moi en septembre." },
    ],
  });
  const before = fixture({ notes: "note existante", monthlyValue: 115 });
  const r = applyOutcome(before, s, NOW);

  assert.ok(r.learned.length >= 2);
  assert.match(r.prospect.notes, /note existante/, "on n'écrase jamais une note saisie à la main");
  assert.match(r.prospect.notes, /trop cher/);
  // Les champs structurés ne sont PAS touchés par une heuristique lexicale.
  assert.equal(r.prospect.monthlyValue, 115);
  assert.equal(r.prospect.stage, before.stage);
});

test("transcription — devient une note du Cerveau lisible", () => {
  const n = transcriptNote(
    session({ outcome: "repondu", turns: [{ at: NOW.toISOString(), speaker: "agent", text: "Bonjour" }] }),
    "Carrosserie Test"
  );
  assert.match(n.title, /Carrosserie Test/);
  assert.match(n.body, /Alpha : Bonjour/);
  assert.ok(n.tags.includes("transcription"));
});
