import test from "node:test";
import assert from "node:assert/strict";
import { prospect, daysAgo } from "./fixtures";
import type { TimelineEvent } from "../lib/types";
import {
  emailRamp,
  firstEmailDate,
  mailboxesNeeded,
  RAMP_CEILING,
  RAMP_START,
  RAMP_STEP,
} from "../lib/email-ramp";
import { buildDailyPlan } from "../lib/daily-plan";

/**
 * Le plafond d'envoi est le seul chiffre de l'app qui, s'il est trop
 * haut, détruit un actif qu'on ne récupère pas : la réputation du
 * domaine. Il doit être conservateur par construction, et jamais
 * dépendre d'une déclaration de l'opérateur.
 */

const email = (daysBack: number, id = `e${daysBack}`): TimelineEvent => ({
  id,
  date: daysAgo(daysBack),
  kind: "email",
  summary: "envoi",
});

test("ramp — sans historique d'envoi, on démarre au palier bas", () => {
  const r = emailRamp([prospect()]);
  assert.equal(r.today, RAMP_START);
  assert.equal(r.fresh, true);
  assert.equal(r.ceiling, false);
});

test("ramp — le palier suit les semaines réellement écoulées", () => {
  const at = (days: number) => emailRamp([prospect({ events: [email(days)] })]).today;
  assert.equal(at(0), RAMP_START); // premier jour
  assert.equal(at(6), RAMP_START); // toujours la semaine 1
  assert.equal(at(7), RAMP_START + RAMP_STEP); // semaine 2
  assert.equal(at(21), RAMP_START + 3 * RAMP_STEP); // semaine 4
});

test("ramp — le plafond de croisière ne se dépasse jamais", () => {
  // Une boîte vieille de deux ans reste plafonnée : l'ancienneté ne
  // multiplie pas ce qu'une seule boîte peut porter.
  const r = emailRamp([prospect({ events: [email(730)] })]);
  assert.equal(r.today, RAMP_CEILING);
  assert.equal(r.ceiling, true);
  assert.equal(r.next, RAMP_CEILING);
  assert.equal(r.daysToNext, 0);
  assert.match(r.why, /plusieurs boîtes/);
});

test("ramp — c'est le PREMIER envoi qui compte, pas le dernier", () => {
  // Le piège : lire l'envoi le plus récent ferait retomber au palier bas
  // quelqu'un qui envoie depuis des mois.
  const p = prospect({ events: [email(0, "a"), email(60, "b"), email(30, "c")] });
  assert.equal(firstEmailDate([p])!.slice(0, 10), daysAgo(60).slice(0, 10));
  assert.equal(emailRamp([p]).today, RAMP_CEILING);
});

test("ramp — les autres canaux ne comptent pas comme montée en charge", () => {
  const p = prospect({
    events: [
      { id: "a", date: daysAgo(90), kind: "appel", summary: "x" },
      { id: "b", date: daysAgo(90), kind: "linkedin", summary: "x" },
    ],
  });
  assert.equal(emailRamp([p]).fresh, true, "seuls les emails chauffent une boîte d'envoi");
});

test("ramp — le plan du jour applique le palier, pas le plafond théorique", () => {
  const fresh = buildDailyPlan([prospect({ email: "a@b.fr" })]);
  const chan = fresh.channels.find((c) => c.id === "email")!;
  assert.equal(chan.capacity, RAMP_START, "une boîte sans historique ne doit pas se voir proposer 40 envois");
  assert.match(chan.why, /Aucun envoi consigné/);
});

test("volume — atteindre un objectif haut demande plusieurs boîtes, et on le dit", () => {
  assert.equal(mailboxesNeeded(40), 1);
  assert.equal(mailboxesNeeded(120), 3);
  assert.equal(mailboxesNeeded(150), 4);
});
