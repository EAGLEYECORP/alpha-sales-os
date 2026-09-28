import { test } from "node:test";
import assert from "node:assert/strict";
import { prochainsCreneaux, labelCreneau } from "../lib/creneaux-rdv";
import { fenetreOuverte } from "../lib/conformite";
import { construireReponseAuto } from "../lib/reponse-auto";

const creneauOuvert = (d: Date): boolean => fenetreOuverte(d).open;

/**
 * ─────────────────────────────────────────────────────────────────────
 * PROPOSER DE VRAIS CRÉNEAUX (B3) :
 *  · dans les fenêtres ouvertes, avec préavis, un par jour ;
 *  · jamais collé à un RDV déjà calé ;
 *  · injectés dans la réponse veut-rdv (sinon repli générique).
 * `maintenant` est injecté — le test ne dépend pas de l'horloge.
 * ─────────────────────────────────────────────────────────────────────
 */

// Un lundi tôt (UTC) — il y a forcément des fenêtres ouvertes dans la semaine.
const LUNDI = new Date("2026-09-07T05:00:00Z");

test("rend le nombre demandé de créneaux, tous dans une fenêtre OUVERTE", () => {
  const cr = prochainsCreneaux(LUNDI, { n: 3 });
  assert.equal(cr.length, 3);
  for (const d of cr) assert.equal(creneauOuvert(d), true, `${d.toISOString()} devrait être ouvert`);
});

test("⚠ respecte le préavis (aucun créneau avant maintenant + 24 h par défaut)", () => {
  const cr = prochainsCreneaux(LUNDI, { n: 3 });
  const plancher = LUNDI.getTime() + 24 * 3_600_000;
  for (const d of cr) assert.ok(d.getTime() >= plancher, `${d.toISOString()} est avant le préavis`);
});

test("un créneau par jour : deux créneaux consécutifs sont espacés d'au moins 20 h", () => {
  const cr = prochainsCreneaux(LUNDI, { n: 3 });
  for (let i = 1; i < cr.length; i++) {
    assert.ok(cr[i].getTime() - cr[i - 1].getTime() >= 20 * 3_600_000);
  }
});

test("⚠⚠ n'empile pas sur un RDV déjà calé (jamais doubler un RDV)", () => {
  const base = prochainsCreneaux(LUNDI, { n: 3 });
  // On occupe le 1er créneau proposé : il doit disparaître des propositions.
  const occupe = base[0];
  const avecRdv = prochainsCreneaux(LUNDI, { n: 3, occupes: [occupe] });
  for (const d of avecRdv) {
    assert.ok(Math.abs(d.getTime() - occupe.getTime()) >= 3 * 3_600_000, "un créneau colle au RDV calé");
  }
});

test("labelCreneau rend une chaîne lisible avec un jour de la semaine", () => {
  const [c] = prochainsCreneaux(LUNDI, { n: 1 });
  const label = labelCreneau(c);
  assert.ok(label.trim().length > 0);
  assert.match(label, /lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/i);
});

// ─────────────────────────── injection dans la réponse ───────────────────────────

test("la réponse veut-rdv PROPOSE les vrais créneaux quand ils sont fournis", () => {
  const creneaux = ["mardi 8 septembre 10:00", "jeudi 10 septembre 14:00"];
  const r = construireReponseAuto("veut-rdv", "Jean", creneaux);
  assert.ok(r);
  for (const c of creneaux) assert.ok(r.body.includes(c), `le créneau « ${c} » devrait apparaître`);
});

test("⚠ sans créneaux fournis, repli générique utilisable (pas de trou)", () => {
  const r = construireReponseAuto("veut-rdv", "Jean");
  assert.ok(r);
  assert.match(r.body, /mardi 15h|jeudi 10h/i);
});

test("un seul créneau ⇒ formulation « est-ce que … vous irait ? »", () => {
  const r = construireReponseAuto("veut-rdv", "Jean", ["vendredi 11 septembre 11:00"]);
  assert.ok(r);
  assert.match(r.body, /est-ce que vendredi 11 septembre 11:00 vous irait/i);
});
