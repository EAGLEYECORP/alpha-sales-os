import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  boiteRechauffee,
  PALIER_BOITE_RECHAUFFEE,
  RAMP_START,
  rampDepuisPremierEnvoi,
  rampServeur,
} from "../lib/email-ramp";

/**
 * La boîte déjà chaude (décision du 20/11/2026) : 100/jour pour une adresse
 * DÉCLARÉE, 5/jour pour toute autre — y compris une boîte neuve branchée sur
 * notre serveur. La déclaration vise l'ADRESSE qui envoie, jamais le compte.
 */

test("une boîte déclarée chaude a 100/jour dès le premier envoi", () => {
  const r = rampServeur(null, "Alpha Sales OS <contact@eagleyecorp.fr>");
  assert.equal(r.today, PALIER_BOITE_RECHAUFFEE);
  assert.equal(PALIER_BOITE_RECHAUFFEE, 100);
});

test("une boîte NEUVE garde 5/jour la première semaine", () => {
  assert.equal(rampServeur(null, "nouvelle@exemple.test").today, RAMP_START);
  assert.equal(rampServeur(new Date().toISOString(), "nouvelle@exemple.test").today, RAMP_START);
  assert.equal(RAMP_START, 5);
});

test("une adresse absente ou illisible n'est JAMAIS chaude (fail-closed)", () => {
  for (const f of [undefined, null, "", "   ", "pas-une-adresse"]) {
    assert.equal(boiteRechauffee(f, ""), false, String(f));
    assert.equal(rampServeur(null, f).today, RAMP_START);
  }
});

test("la déclaration se lit aussi dans l'environnement, adresse nue et sans casse", () => {
  assert.equal(boiteRechauffee("Moi <Vente@Exemple.test>", " autre@x.test , vente@exemple.test"), true);
  assert.equal(boiteRechauffee("vente@exemple.test", "autre@x.test"), false);
  // un domaine voisin ne profite pas de la déclaration
  assert.equal(boiteRechauffee("contact@eagleyecorp.fr.exemple.test", ""), false);
});

test("sans l'option, le barème neuf est inchangé", () => {
  assert.equal(rampDepuisPremierEnvoi(null).today, RAMP_START);
  assert.equal(rampDepuisPremierEnvoi(null, new Date(), { rechauffee: true }).today, PALIER_BOITE_RECHAUFFEE);
});

test("⚠ tout point d'envoi du serveur lit le palier par l'ADRESSE (rampServeur), jamais le barème nu", () => {
  for (const f of [
    "app/api/send/route.ts",
    "app/api/campaign/mail-tick/route.ts",
    "app/api/campaign/relance-tick/route.ts",
    "app/api/campaign/reply-tick/route.ts",
    "app/api/v1/campagne/route.ts",
    "app/api/v1/diagnostic/route.ts",
  ]) {
    const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.match(code, /rampServeur\(/, f);
    assert.doesNotMatch(code, /rampDepuisPremierEnvoi\(/, f);
  }
  const send = readFileSync("app/api/send/route.ts", "utf8");
  assert.match(send, /rampServeur\(premierEnvoi, smtp\.from\)/, "/api/send : l'adresse est celle du SMTP RÉSOLU");
});
