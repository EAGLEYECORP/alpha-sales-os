import { test } from "node:test";
import assert from "node:assert/strict";
import { doitEnvoyerReponse, autoReponseAttestee } from "../lib/reply-autosend";
import { construireReponseAuto } from "../lib/reponse-auto";
import { DIVULGATION_ECRITE } from "../lib/signature-ia";
import { INTENTIONS, estAutomatisable } from "../lib/reponse-auto";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'AUTO-RÉPONSE — fail-closed, et déterministe.
 *
 * Ce que le test tient :
 *  · les TROIS conditions sont cumulatives, et l'absence de N'IMPORTE LAQUELLE
 *    empêche l'envoi (surtout : DKIM non attesté ⇒ inerte) ;
 *  · la réponse n'existe QUE pour le milieu de tunnel sûr, elle porte la
 *    divulgation IA, et ne cite jamais de prix.
 * ─────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────── le garde d'envoi ───────────────────────────

test("⚠⚠ les trois conditions réunies ⇒ envoie", () => {
  const d = doitEnvoyerReponse({ automatisable: true, arme: true, atteste: true });
  assert.equal(d.envoyer, true);
});

test("⚠ intention non automatisable ⇒ n'envoie pas (remonte à l'humain)", () => {
  assert.equal(doitEnvoyerReponse({ automatisable: false, arme: true, atteste: true }).envoyer, false);
});

test("⚠ autopilote éteint ⇒ n'envoie pas", () => {
  assert.equal(doitEnvoyerReponse({ automatisable: true, arme: false, atteste: true }).envoyer, false);
});

test("⚠⚠ DKIM non attesté (REPLY_AUTOSEND absent) ⇒ INERTE, quoi qu'il arrive", () => {
  const d = doitEnvoyerReponse({ automatisable: true, arme: true, atteste: false });
  assert.equal(d.envoyer, false);
  assert.match(d.raison, /REPLY_AUTOSEND|DKIM|fail-closed/i);
});

test("chaque refus porte une raison non vide", () => {
  for (const opts of [
    { automatisable: false, arme: true, atteste: true },
    { automatisable: true, arme: false, atteste: true },
    { automatisable: true, arme: true, atteste: false },
  ]) {
    assert.ok(doitEnvoyerReponse(opts).raison.trim().length > 0);
  }
});

test("autoReponseAttestee : seul REPLY_AUTOSEND=on ouvre (insensible casse/espaces)", () => {
  const avant = process.env.REPLY_AUTOSEND;
  try {
    process.env.REPLY_AUTOSEND = "on";
    assert.equal(autoReponseAttestee(), true);
    process.env.REPLY_AUTOSEND = "  ON  ";
    assert.equal(autoReponseAttestee(), true);
    process.env.REPLY_AUTOSEND = "1";
    assert.equal(autoReponseAttestee(), false);
    process.env.REPLY_AUTOSEND = "true";
    assert.equal(autoReponseAttestee(), false);
    delete process.env.REPLY_AUTOSEND;
    assert.equal(autoReponseAttestee(), false);
  } finally {
    if (avant === undefined) delete process.env.REPLY_AUTOSEND;
    else process.env.REPLY_AUTOSEND = avant;
  }
});

// ─────────────────────────── les gabarits déterministes ───────────────────────────

test("⚠ une réponse n'existe QUE pour une intention automatisable, sinon null", () => {
  for (const i of INTENTIONS) {
    const r = construireReponseAuto(i, "Jean");
    if (estAutomatisable(i)) assert.ok(r, `${i} devrait avoir une réponse`);
    else assert.equal(r, null, `${i} ne doit PAS avoir de réponse auto`);
  }
});

test("⚠⚠ chaque réponse auto PORTE la divulgation IA (art. 50)", () => {
  for (const i of ["veut-rdv", "renseignement"] as const) {
    const r = construireReponseAuto(i);
    assert.ok(r);
    assert.ok(r.body.includes(DIVULGATION_ECRITE), `${i} sans divulgation`);
  }
});

test("⚠ aucune réponse auto ne cite de prix (€ / tarif / devis)", () => {
  for (const i of ["veut-rdv", "renseignement"] as const) {
    const r = construireReponseAuto(i);
    assert.ok(r);
    assert.doesNotMatch(r.body + " " + r.subject, /€|euros?|\btarif\b|\bdevis\b|\bprix\b/i, `${i} parle de prix`);
  }
});

test("la réponse pousse vers le RDV (objectif unique)", () => {
  for (const i of ["veut-rdv", "renseignement"] as const) {
    const r = construireReponseAuto(i);
    assert.ok(r);
    assert.match(r.body, /créneau|mardi|jeudi|15h|10h|montrer/i);
  }
});
