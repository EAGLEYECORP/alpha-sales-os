import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPush } from "../lib/push-digest";
import { prospect, meeting } from "./fixtures";
import type { Meeting, Prospect } from "../lib/types";

/** Un mardi 14 h — en pleine fenêtre utile. */
const MARDI_14H = new Date("2026-08-25T14:00:00+02:00");
/** Un dimanche 10 h — hors fenêtre, quelle que soit l'urgence. */
const DIMANCHE = new Date("2026-08-23T10:00:00+02:00");
/** Un mardi 3 h du matin. */
const NUIT = new Date("2026-08-25T03:00:00+02:00");

const dans = (min: number, from = MARDI_14H) => new Date(from.getTime() + min * 60_000).toISOString();

const rdv = (over: Partial<Meeting> = {}): Meeting =>
  meeting({ title: "Audit sur place", location: "Lyon 6e", done: false, ...over });

test("silence — hors fenêtre utile, RIEN ne part, même un RDV imminent", () => {
  const m = [rdv({ date: dans(30, DIMANCHE) })];
  // Une notification le dimanche matin ne se rattrape pas : on n'apprend pas
  // à quelqu'un à couper ses notifications professionnelles.
  assert.equal(pickPush([], m, DIMANCHE), null);

  const nuit = [rdv({ date: dans(30, NUIT) })];
  assert.equal(pickPush([], nuit, NUIT), null);
});

test("RDV imminent — entre 20 et 45 minutes, et pas en dehors", () => {
  const trop_tot = pickPush([], [rdv({ date: dans(90) })], MARDI_14H);
  assert.equal(trop_tot, null, "à 90 min il oubliera d'ici là — ce n'est pas le moment");

  const trop_tard = pickPush([], [rdv({ date: dans(8) })], MARDI_14H);
  assert.equal(trop_tard, null, "à 8 min il est déjà en route : le prévenir ne sert plus qu'à le stresser");

  const bon = pickPush([], [rdv({ date: dans(30) })], MARDI_14H);
  assert.equal(bon?.kind, "rdv-imminent");
  assert.match(bon!.title, /RDV dans 30 min/);
  assert.match(bon!.body, /Audit sur place/);
  assert.equal(bon!.urgency, "high");
  // Un rappel de RDV qui survit au RDV est pire qu'inutile.
  assert.ok(bon!.ttlSec <= 30 * 60);
});

test("RDV — un rendez-vous déjà fait ne notifie plus", () => {
  assert.equal(pickPush([], [rdv({ date: dans(30), done: true })], MARDI_14H), null);
});

test("priorité — le RDV passe avant tout le reste", () => {
  const chaud: Prospect = prospect({
    company: "Toitures du Rhône",
    stage: "offre",
    trust: 90,
    conviction: 9,
    nextStep: { date: dans(-180), action: "Rappeler le gérant" },
  });
  const m = pickPush([chaud], [rdv({ date: dans(25) })], MARDI_14H);
  // C'est le seul des deux qu'on ne peut pas rattraper une heure plus tard.
  assert.equal(m?.kind, "rdv-imminent");
});

test("échéance dépassée — seulement sur une fiche encore vivante", () => {
  const p = prospect({
    company: "Toitures du Rhône",
    stage: "offre",
    trust: 88,
    conviction: 9,
    demoShownBeforePrice: true,
    nextStep: { date: dans(-240), action: "Rappeler le gérant" },
  });
  const m = pickPush([p], [], MARDI_14H);
  assert.equal(m?.kind, "echeance-depassee");
  assert.match(m!.title, /Toitures du Rhône/);
  assert.match(m!.body, /Rappeler le gérant/);
  assert.equal(m!.url, `/prospects/${p.id}`);

  // Signé ou perdu : plus rien à relancer.
  assert.equal(pickPush([{ ...p, stage: "signe" }], [], MARDI_14H), null);
  assert.equal(pickPush([{ ...p, stage: "perdu" }], [], MARDI_14H), null);
});

test("échéance dépassée — on oublie au-delà de 48 h", () => {
  // Passé deux jours, ce n'est plus une notification, c'est du ménage de
  // pipeline : ça se fait dans l'app, pas en vibration.
  const vieux = prospect({
    stage: "offre",
    trust: 88,
    conviction: 9,
    nextStep: { date: dans(-72 * 60), action: "Rappeler" },
  });
  assert.equal(pickPush([vieux], [], MARDI_14H), null);
});

test("une seule notification par passage — jamais deux décisions à la fois", () => {
  const a = prospect({ company: "A", stage: "offre", trust: 90, conviction: 9, nextStep: { date: dans(-120), action: "Rappeler A" } });
  const b = prospect({ company: "B", stage: "offre", trust: 92, conviction: 10, nextStep: { date: dans(-300), action: "Rappeler B" } });
  const m = pickPush([a, b], [], MARDI_14H);
  assert.ok(m, "il y a bien quelque chose à dire");
  // Deux notifications simultanées, c'est zéro décision prise.
  assert.equal(typeof m!.title, "string");
});

test("rien d'actionnable — on n'envoie RIEN plutôt qu'un « tout va bien »", () => {
  const froid = prospect({ stage: "prospect", trust: 10, conviction: 2, nextStep: null });
  assert.equal(pickPush([froid], [], MARDI_14H), null);
  assert.equal(pickPush([], [], MARDI_14H), null);
});

test("chaque message porte un tag stable — pour remplacer, pas empiler", () => {
  const p = prospect({ stage: "offre", trust: 88, conviction: 9, nextStep: { date: dans(-240), action: "Rappeler" } });
  const a = pickPush([p], [], MARDI_14H);
  const b = pickPush([p], [], new Date(MARDI_14H.getTime() + 30 * 60_000));
  // Un téléphone avec douze rappels identiques finit en silencieux, et on
  // perd tout.
  assert.equal(a!.tag, b!.tag);
});
