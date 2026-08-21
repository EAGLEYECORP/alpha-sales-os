import { test } from "node:test";
import assert from "node:assert/strict";
import { cadenceFor, plannedRecalls, CALLFLOW_MAX_RECALLS, type CallAttempt } from "../lib/call-cadence";

const T0 = "2026-08-03T09:00:00.000Z";
const at = (h: number) => new Date(new Date(T0).getTime() + h * 3600_000);

test("cadence — aucun appel encore : on appelle maintenant", () => {
  const d = cadenceFor([], at(0));
  assert.equal(d.state, "a-appeler");
  assert.equal(d.callNow, true);
  assert.equal(d.recallsLeft, CALLFLOW_MAX_RECALLS);
});

test("cadence — 5 rappels étalés sur 2 jours après le 1er appel", () => {
  const planned = plannedRecalls(T0);
  assert.equal(planned.length, 5);
  const spanH = (new Date(planned[4]).getTime() - new Date(T0).getTime()) / 3600_000;
  assert.equal(spanH, 48, "le dernier rappel tombe à 48 h — 2 jours pile");
});

test("cadence — sans réponse, elle attend l'heure puis redevient due", () => {
  const attempts: CallAttempt[] = [{ at: T0, outcome: "sans-reponse" }];
  // Juste après le 1er appel : le rappel n'est pas encore dû.
  const early = cadenceFor(attempts, at(1));
  assert.equal(early.state, "attente");
  assert.equal(early.callNow, false);
  // 3 h plus tard : dû.
  const due = cadenceFor(attempts, at(3));
  assert.equal(due.state, "en-cadence");
  assert.equal(due.callNow, true);
  assert.equal(due.recallsUsed, 0);
});

test("cadence — dès qu'il RÉPOND, Alpha Voice arrête et passe la main au closer", () => {
  const attempts: CallAttempt[] = [
    { at: T0, outcome: "sans-reponse" },
    { at: at(3).toISOString(), outcome: "repondu" },
  ];
  const d = cadenceFor(attempts, at(4));
  assert.equal(d.state, "repondu-passer-humain");
  assert.equal(d.callNow, false, "ne JAMAIS rappeler quelqu'un qui a décroché");
  assert.equal(d.handoffToHuman, true);
  assert.equal(d.nextCallAt, null);
  assert.match(d.reason, /closer|humain/i);
});

test("cadence — l'opposition coupe tout, définitivement et immédiatement", () => {
  const attempts: CallAttempt[] = [
    { at: T0, outcome: "sans-reponse" },
    { at: at(3).toISOString(), outcome: "opposition" },
  ];
  const d = cadenceFor(attempts, at(50));
  assert.equal(d.state, "stop-definitif");
  assert.equal(d.callNow, false);
  assert.equal(d.handoffToHuman, false, "une opposition ne se refile pas à un humain");
});

test("cadence — 5 rappels consommés : épuisée, on repasse à l'humain sur un autre canal", () => {
  const attempts: CallAttempt[] = [
    { at: T0, outcome: "sans-reponse" },
    ...[3, 8, 24, 32, 48].map((h) => ({ at: at(h).toISOString(), outcome: "sans-reponse" as const })),
  ];
  const d = cadenceFor(attempts, at(72));
  assert.equal(d.state, "epuisee");
  assert.equal(d.callNow, false);
  assert.equal(d.recallsUsed, CALLFLOW_MAX_RECALLS);
  assert.equal(d.recallsLeft, 0);
  assert.equal(d.handoffToHuman, true);
});

test("cadence — un numéro invalide n'est pas rappelé 5 fois", () => {
  const d = cadenceFor([{ at: T0, outcome: "invalide" }], at(10));
  assert.equal(d.state, "stop-definitif");
  assert.equal(d.callNow, false);
});
