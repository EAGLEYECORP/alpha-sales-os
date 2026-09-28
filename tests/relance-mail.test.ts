import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prospect } from "../lib/types";
import { prospectDefaults } from "../lib/seed";
import {
  relanceDue,
  construireRelanceMail,
  CONTACTS_MAX_30J,
  RELANCE_GAPS_H,
} from "../lib/relance-mail";
import { RAPPELS_MAX } from "../lib/call-cadence";
import { DIVULGATION_ECRITE } from "../lib/signature-ia";
import type { RaisonNeuve } from "../lib/raison-neuve";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AUTO-RELANCE — le cerveau : rappeler sans harceler.
 *  · s'arrête dès qu'il répond ;
 *  · pas de raison neuve ⇒ pas de relance (jamais « je me permets ») ;
 *  · plafond 4/30 j (décret 2022-1313), dérivé de RAPPELS_MAX ;
 *  · espacé (RELANCE_GAPS_H) ;
 *  · le mail est bâti sur la raison neuve, porte la divulgation, sans prix.
 * ─────────────────────────────────────────────────────────────────────
 */

const T0 = Date.parse("2026-09-01T09:00:00Z");
const base = {
  nbContacts30j: 1,
  dernierEnvoiISO: new Date(T0).toISOString(),
  aRepondu: false,
  raisonDisponible: true,
  maintenant: T0 + RELANCE_GAPS_H[0] * 3_600_000 + 1000, // juste au-delà du 1er palier
};

test("le plafond DÉRIVE de RAPPELS_MAX (1 cold + rappels) — une seule définition", () => {
  assert.equal(CONTACTS_MAX_30J, RAPPELS_MAX + 1);
});

test("⚠ dès qu'il a répondu, la cadence s'arrête", () => {
  const d = relanceDue({ ...base, aRepondu: true });
  assert.equal(d.du, false);
  assert.match(d.motif, /répond/i);
});

test("⚠⚠ pas de raison neuve ⇒ pas de relance (jamais « je me permets »)", () => {
  const d = relanceDue({ ...base, raisonDisponible: false });
  assert.equal(d.du, false);
  assert.match(d.motif, /raison neuve|relance pas pour relancer/i);
});

test("⚠ plafond 4/30 j atteint ⇒ on n'ajoute pas (décret 2022-1313)", () => {
  const d = relanceDue({ ...base, nbContacts30j: CONTACTS_MAX_30J });
  assert.equal(d.du, false);
  assert.match(d.motif, /plafond|2022-1313/i);
});

test("jamais contacté ⇒ ce n'est pas une relance (c'est mail-tick)", () => {
  const d = relanceDue({ ...base, nbContacts30j: 0 });
  assert.equal(d.du, false);
  assert.match(d.motif, /jamais contacté|mail-tick/i);
});

test("⚠ trop tôt depuis le dernier envoi ⇒ pas encore", () => {
  const d = relanceDue({ ...base, maintenant: T0 + 3_600_000 }); // 1 h après
  assert.equal(d.du, false);
  assert.match(d.motif, /trop tôt/i);
});

test("toutes conditions réunies ⇒ relance due, numéro = nb de contacts", () => {
  const d = relanceDue(base);
  assert.equal(d.du, true);
  assert.equal(d.numero, 1);
});

test("le 2e palier exige un espacement plus long depuis le dernier envoi", () => {
  // 2 contacts déjà : il faut RELANCE_GAPS_H[1] heures, pas [0].
  const juste = { ...base, nbContacts30j: 2, maintenant: T0 + RELANCE_GAPS_H[1] * 3_600_000 + 1000 };
  const tropTot = { ...base, nbContacts30j: 2, maintenant: T0 + RELANCE_GAPS_H[0] * 3_600_000 + 1000 };
  assert.equal(relanceDue(juste).du, true);
  assert.equal(relanceDue(tropTot).du, false);
});

// ─────────────────────────── le gabarit ───────────────────────────

function prospect(): Prospect {
  const now = new Date().toISOString();
  return { ...prospectDefaults, id: "r1", company: "Fixture Promotion", name: "Claire Martin", createdAt: now, updatedAt: now } as Prospect;
}

const raisonPrix: RaisonNeuve = {
  source: "prix-honore",
  fait: "Grille remplacée le 12/09 ; prix honoré jusqu'au 17/10/2026.",
  phrase: "Nos tarifs ont changé depuis notre dernier échange. Celui que je vous ai annoncé reste valable jusqu'au 17/10/2026 — si le sujet est toujours d'actualité, on en reparle avant ; sinon, aucun souci.",
  provenance: "lib/grille-perimee.ts",
};

test("⚠⚠ le mail de relance PORTE la divulgation IA (art. 50)", () => {
  const m = construireRelanceMail(prospect(), raisonPrix);
  assert.ok(m.body.includes(DIVULGATION_ECRITE));
});

test("le mail est bâti sur la phrase de la raison neuve (pas un pitch neuf)", () => {
  const m = construireRelanceMail(prospect(), raisonPrix);
  assert.ok(m.body.includes(raisonPrix.phrase));
});

test("⚠ aucun MONTANT dans le mail de relance (le prix se redit de vive voix)", () => {
  const m = construireRelanceMail(prospect(), raisonPrix);
  // une DATE (17/10/2026) est permise ; un montant en € ne l'est pas.
  assert.doesNotMatch(m.body, /\d+\s?€|\beuros?\b/i);
});
