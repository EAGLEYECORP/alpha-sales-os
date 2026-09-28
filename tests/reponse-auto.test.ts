import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INTENTIONS,
  PROMPT_CLASSER_REPONSE,
  estAutomatisable,
  interpreterClassement,
  routerReponse,
  type IntentionReponse,
} from "@/lib/reponse-auto";

test("routage — chaque intention connue a une disposition et un motif non vide", () => {
  for (const i of INTENTIONS) {
    const r = routerReponse(i);
    assert.ok(["auto", "escalade", "clore"].includes(r.disposition), `disposition invalide pour ${i}`);
    assert.ok(r.motif.trim().length > 0, `motif vide pour ${i}`);
  }
});

test("⚠⚠ INVARIANT — SEULES veut-rdv et renseignement s'automatisent", () => {
  // Le cœur du module : c'est ce test qui interdit qu'un futur ajustement
  // fasse partir un email tout seul sur de l'argent ou un doute.
  const attendu: Record<IntentionReponse, "auto" | "escalade" | "clore"> = {
    "veut-rdv": "auto",
    renseignement: "auto",
    prix: "escalade",
    "veut-signer": "escalade",
    objection: "escalade",
    refus: "clore",
    "hors-sujet": "escalade",
  };
  for (const i of INTENTIONS) {
    assert.equal(routerReponse(i).disposition, attendu[i], `mauvaise disposition pour ${i}`);
  }
  // Formulé aussi comme un ensemble : rien d'autre que ces deux-là n'est auto.
  const auto = INTENTIONS.filter(estAutomatisable);
  assert.deepEqual([...auto].sort(), ["renseignement", "veut-rdv"]);
});

test("l'argent et la signature ne s'auto-envoient JAMAIS", () => {
  assert.equal(estAutomatisable("prix"), false);
  assert.equal(estAutomatisable("veut-signer"), false);
  assert.equal(estAutomatisable("objection"), false);
});

test("un refus CLÔT, il ne déclenche ni envoi ni escalade", () => {
  assert.equal(routerReponse("refus").disposition, "clore");
});

test("interprétation — sortie valide reconnue, tout le reste retombe sur hors-sujet (escalade)", () => {
  assert.equal(interpreterClassement({ intention: "veut-rdv" }), "veut-rdv");
  assert.equal(interpreterClassement({ intention: "prix", raison: "x" }), "prix");
  // ⚠ Le repli n'est JAMAIS auto : un modèle qui déraille ne fait pas partir d'email.
  for (const mauvais of [null, undefined, 42, "texte", {}, { intention: "autre" }, { intention: 5 }, { raison: "y" }]) {
    const i = interpreterClassement(mauvais);
    assert.equal(i, "hors-sujet");
    assert.equal(estAutomatisable(i), false);
  }
});

test("le prompt fait CLASSER (pas rédiger) et impose le doute → hors-sujet", () => {
  assert.match(PROMPT_CLASSER_REPONSE, /CLASSES, tu ne r[ée]diges rien/i);
  assert.match(PROMPT_CLASSER_REPONSE, /dans le DOUTE, choisis hors-sujet/i);
  assert.match(PROMPT_CLASSER_REPONSE, /"intention"/);
  // Chaque intention est décrite dans le prompt, sinon le modèle ne peut pas la choisir.
  for (const i of INTENTIONS) {
    assert.ok(PROMPT_CLASSER_REPONSE.includes(i), `intention absente du prompt : ${i}`);
  }
});
