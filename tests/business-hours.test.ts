import { test } from "node:test";
import assert from "node:assert/strict";
import { localTime, BUSINESS_TZ } from "../lib/business-hours";
import { fenetreOuverte } from "../lib/conformite";
import { callAllowedNow } from "../lib/voice-script";

/**
 * Ces tests valent surtout par ce qu'ils auraient attrapé.
 *
 * `getHours()` rend l'heure du PROCESSUS. En local ça ressemble à l'heure de
 * Lyon et tout paraît juste ; en production, une fonction serverless tourne
 * en UTC. La fenêtre « 9h–12h » devenait donc 11h–14h heure française :
 * l'autopilote refusait le meilleur créneau du matin et appelait en plein
 * déjeuner — celui qu'on avait explicitement décidé d'éviter. Le code disait
 * la bonne règle et faisait le contraire, sans jamais se plaindre.
 */

test("heure locale — lue dans le fuseau du métier, pas celui du serveur", () => {
  // 9h00 à Paris en été = 07:00 UTC. Un serveur en UTC y verrait 7h.
  const matin = new Date("2026-08-25T09:00:00+02:00");
  assert.equal(localTime(matin, BUSINESS_TZ).hour, 9);
  assert.equal(localTime(matin, "UTC").hour, 7);
});

test("heure locale — l'heure d'été est gérée, un décalage fixe serait faux", () => {
  // Même heure murale à Paris, de part et d'autre du changement d'heure.
  const ete = new Date("2026-08-25T10:00:00+02:00");
  const hiver = new Date("2026-01-20T10:00:00+01:00");
  assert.equal(localTime(ete, BUSINESS_TZ).hour, 10);
  assert.equal(localTime(hiver, BUSINESS_TZ).hour, 10);
});

test("heure locale — le jour de la semaine suit le fuseau", () => {
  // Lundi 00h30 à Paris = dimanche 23h30 UTC. Le week-end n'est pas le même
  // des deux côtés : c'est ce qui ferait appeler un dimanche soir.
  const lundiTot = new Date("2026-08-24T00:30:00+02:00");
  assert.equal(localTime(lundiTot, BUSINESS_TZ).weekday, 1);
  assert.equal(localTime(lundiTot, BUSINESS_TZ).weekend, false);
  assert.equal(localTime(lundiTot, "UTC").weekday, 0);
});

test("fenêtre d'appel — 9h heure de Lyon est ouverte, quel que soit le fuseau du serveur", () => {
  const neufHeuresLyon = new Date("2026-08-25T09:00:00+02:00");
  const f = fenetreOuverte(neufHeuresLyon);
  assert.equal(f.open, true, "le meilleur créneau chez les artisans ne doit pas être refusé");
  assert.equal(f.label, "Matin");
});

test("fenêtre d'appel — le déjeuner français est fermé, même vu d'UTC", () => {
  const midiLyon = new Date("2026-08-25T12:30:00+02:00");
  const f = fenetreOuverte(midiLyon);
  assert.equal(f.open, false);
  assert.match(f.label, /déjeuner/);
});

test("fenêtre d'appel — 14h à Lyon est ouverte (c'était 12h UTC, donc fermé avant)", () => {
  const f = fenetreOuverte(new Date("2026-08-25T14:00:00+02:00"));
  assert.equal(f.open, true);
  assert.equal(f.label, "Après-midi");
});

test("fenêtre d'appel — un autre fuseau se demande explicitement", () => {
  // Nuwacom se cadre sur Europe/Luxembourg : le paramètre existe pour ça.
  const t = new Date("2026-08-25T09:30:00+02:00");
  assert.equal(fenetreOuverte(t, "Europe/Luxembourg").open, true);
  // Le même instant est 07h30 à Londres — trop tôt.
  assert.equal(fenetreOuverte(t, "Europe/London").open, false);
});

test("agent vocal — même correction, mêmes bornes", () => {
  assert.equal(callAllowedNow(new Date("2026-08-25T09:00:00+02:00")).allowed, true);
  assert.equal(callAllowedNow(new Date("2026-08-25T12:30:00+02:00")).allowed, false);
  assert.equal(callAllowedNow(new Date("2026-08-25T19:00:00+02:00")).allowed, false);
  // Dimanche à Lyon, quelle que soit l'heure.
  assert.equal(callAllowedNow(new Date("2026-08-23T10:00:00+02:00")).allowed, false);
});

test("week-end — samedi et dimanche sont fermés des deux côtés", () => {
  assert.equal(fenetreOuverte(new Date("2026-08-22T10:00:00+02:00")).open, false); // samedi
  assert.equal(fenetreOuverte(new Date("2026-08-23T10:00:00+02:00")).open, false); // dimanche
  assert.equal(fenetreOuverte(new Date("2026-08-24T10:00:00+02:00")).open, true); // lundi
});
