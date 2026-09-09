import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeIncoming, normalizeBatch, KNOWN_FIELDS } from "../lib/api-ingest";

const NOW = new Date("2026-08-18T10:00:00.000Z");

test("ingestion — une fiche sans société est REFUSÉE, avec les alias acceptés", () => {
  const r = normalizeIncoming({ nom: "Marc", email: "m@t.fr" }, NOW);
  assert.equal(r.ok, false);
  assert.match(r.error!, /company/);
  assert.match(r.error!, /societe|entreprise/);
});

test("ingestion — les alias français sont compris", () => {
  const r = normalizeIncoming(
    { societe: "Carrosserie Test", gérant: "Marc Dubois", téléphone: "04 65 71 00 00", ville: "Lyon", courriel: "m@t.fr" },
    NOW
  );
  assert.equal(r.ok, true);
  const p = r.prospect!;
  assert.equal(p.company, "Carrosserie Test");
  assert.equal(p.name, "Marc Dubois");
  assert.equal(p.city, "Lyon");
  assert.equal(p.email, "m@t.fr");
  assert.equal(p.phone, "+33465710000", "le numéro est normalisé en E.164");
});

test("ingestion — les champs non reconnus sont SIGNALÉS, pas avalés en silence", () => {
  const r = normalizeIncoming({ company: "Test", nawak: "x", autre_truc: 42 }, NOW);
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => /Champs ignorés/.test(w)));
  assert.ok(r.warnings.some((w) => /nawak/.test(w)));
});

test("ingestion — un numéro inexploitable est conservé mais signalé", () => {
  const r = normalizeIncoming({ company: "Test", phone: "pas un numéro" }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.prospect!.phone, "pas un numéro", "on garde la donnée brute pour correction manuelle");
  assert.ok(r.warnings.some((w) => /inexploitable/.test(w)));
});

test("ingestion — le STADE n'est jamais pris de l'extérieur", () => {
  // Un système tiers n'a pas à décider qu'un prospect est signé.
  const r = normalizeIncoming({ company: "Test", stage: "signe", probability: 100 }, NOW);
  assert.equal(r.prospect!.stage, "prospect");
});

test("ingestion — un secteur inconnu retombe sur « autre », et le dit", () => {
  const r = normalizeIncoming({ company: "Test", secteur: "boulangerie" }, NOW);
  assert.equal(r.prospect!.sector, "autre");
  assert.ok(r.warnings.some((w) => /boulangerie/.test(w)));

  // Un secteur connu passe sans avertissement.
  const ok = normalizeIncoming({ company: "T2", secteur: "artisan" }, NOW);
  assert.equal(ok.prospect!.sector, "artisan");
  assert.equal(ok.warnings.some((w) => /inconnu/.test(w)), false);
});

test("ingestion — l'id est stable : deux envois = une mise à jour, pas un doublon", () => {
  const a = normalizeIncoming({ company: "Carrosserie Test", email: "M@Test.FR" }, NOW).prospect!;
  const b = normalizeIncoming({ societe: "Carrosserie Test", mail: "m@test.fr" }, NOW).prospect!;
  assert.equal(a.id, b.id);
});

test("ingestion — sans contact, la fiche entre mais l'avertissement est clair", () => {
  const r = normalizeIncoming({ company: "Muette" }, NOW);
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => /aucune action automatique/.test(w)));
});

test("ingestion — le score d'audit est calculé dès l'entrée", () => {
  const pauvre = normalizeIncoming({ company: "Pauvre" }, NOW).prospect!;
  const riche = normalizeIncoming(
    { company: "Riche", phone: "0465710000", missedCallsPerWeek: 9, avgTicket: 400, site: "aucun" },
    NOW
  ).prospect!;
  assert.ok(riche.auditScore > pauvre.auditScore);
});

test("lot — une ligne fautive n'empêche pas les autres d'entrer", () => {
  const r = normalizeBatch([{ company: "Bonne" }, { nom: "sans société" }, { societe: "Autre bonne" }], NOW);
  assert.equal(r.accepted.length, 2);
  assert.equal(r.rejected.length, 1);
  assert.equal(r.rejected[0].index, 1, "l'index de la ligne fautive est rendu");
  assert.match(r.summary, /2 fiche\(s\) acceptée\(s\), 1 refusée/);
});

test("lot — les doublons internes sont fusionnés et signalés", () => {
  const r = normalizeBatch(
    [
      { company: "Test", email: "m@t.fr", ville: "Lyon" },
      { company: "Test", email: "m@t.fr", ville: "Villeurbanne" },
    ],
    NOW
  );
  assert.equal(r.accepted.length, 1);
  assert.equal(r.accepted[0].city, "Villeurbanne", "le dernier envoi gagne");
  assert.match(r.summary, /doublon/);
});

test("lot — une entrée qui n'est pas un objet est refusée proprement", () => {
  const r = normalizeBatch(["texte", 42, null, { company: "OK" }], NOW);
  assert.equal(r.accepted.length, 1);
  assert.equal(r.rejected.length, 3);
  assert.ok(r.rejected.every((x) => /objet JSON/.test(x.error)));
});

test("ingestion — la liste des champs connus est exposée pour l'intégrateur", () => {
  assert.ok(KNOWN_FIELDS.includes("company"));
  assert.ok(KNOWN_FIELDS.includes("telephone"));
  assert.ok(KNOWN_FIELDS.length > 20);
});
