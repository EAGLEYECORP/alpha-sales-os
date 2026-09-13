import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIVULGATION_ECRITE,
  MENTION_PLATEFORME,
  divulgation,
  verifieDivulgation,
} from "../lib/signature-ia";

test("⚠⚠ LES DEUX ERREURS SONT SYMÉTRIQUES — et la seconde rend la promesse défendable", () => {
  /**
   * « Toute interaction menée par l'IA le dit, le reste est un humain » n'a de
   * valeur que si le SECOND membre est vrai. Une app qui signe tout « IA » ne
   * prouve rien : elle dit seulement qu'elle n'a pas regardé.
   */
  const auto = divulgation("email", "autonome");
  assert.equal(auto.obligatoire, true);
  assert.equal(auto.interdite, false);

  const relu = divulgation("email", "valide-par-humain");
  assert.equal(relu.obligatoire, false);
  assert.equal(relu.interdite, true, "signer « IA » un message qu'un humain a envoyé est un MENSONGE");
  assert.equal(relu.mention, null);
  assert.match(relu.motif, /FAUX/);
});

test("⚠ « pas obligatoire » et « interdite » ne sont PAS la même chose", () => {
  // Un booléen unique aurait confondu « tu peux » et « tu ne dois pas ».
  // C'est cette distinction qui empêche un opérateur bien intentionné de
  // signer « IA » partout « pour être transparent » — et de mentir.
  for (const mode of ["valide-par-humain", "ecrit-par-humain"] as const) {
    const v = divulgation("email", mode);
    assert.equal(v.obligatoire, false);
    assert.equal(v.interdite, true, `${mode} : l'aveu serait faux, pas seulement superflu`);
  }
});

test("⚠⚠ C'EST LE MODE QUI DÉCIDE, JAMAIS LE CANAL", () => {
  /**
   * Router sur le canal aurait signé « IA » toute la boîte d'envoi, y compris
   * les messages que quelqu'un a réellement écrits. Le même canal donne deux
   * verdicts opposés selon qui a appuyé sur envoyer.
   */
  for (const canal of ["email", "sms", "linkedin", "chat-site"] as const) {
    assert.equal(divulgation(canal, "autonome").obligatoire, true, `${canal} autonome`);
    assert.equal(divulgation(canal, "valide-par-humain").interdite, true, `${canal} relu`);
  }
});

test("⚠ L'APPEL AUTONOME N'AJOUTE PAS DE MENTION ÉCRITE — elle se PRONONCE", () => {
  // La divulgation vocale tombe dans la PREMIÈRE PHRASE, prononcée par le code
  // avec `allow_interruptions=False`. Un pied de message n'aurait aucun sens
  // au téléphone, et le proposer ferait croire que l'obligation est couverte.
  const v = divulgation("appel", "autonome");
  assert.equal(v.obligatoire, true, "l'obligation existe bel et bien");
  assert.equal(v.mention, null, "mais elle ne se satisfait pas d'un texte ajouté");
  assert.match(v.motif, /PRONONCÉE/);
});

test("divulgation MANQUANTE sur un envoi autonome → refus, et le motif l'explique", () => {
  const p = verifieDivulgation("Bonjour, je reviens vers vous au sujet de votre demande.", "email", "autonome");
  assert.equal(p.length, 1);
  assert.match(p[0], /manquante/i);
});

test("divulgation EN TROP sur un message relu → refus aussi, et c'est le point", () => {
  const p = verifieDivulgation(
    "Bonjour, ce message est envoyé par un assistant IA. Je reviens vers vous.",
    "email",
    "valide-par-humain",
  );
  assert.equal(p.length, 1);
  assert.match(p[0], /FAUX/);
});

test("⚠ on cherche la FORME de l'aveu, pas la phrase au mot près", () => {
  /**
   * Un opérateur a le droit de reformuler. Exiger le texte exact ferait
   * refuser des messages conformes, et on finirait par désarmer le garde —
   * la leçon déjà payée deux fois par `InterditFroid`.
   */
  for (const variante of [
    DIVULGATION_ECRITE,
    "Je suis un assistant automatique, pas une personne.",
    "Vous échangez avec une IA.",
    "Ce message provient d'un agent virtuel.",
    "Rédigé par intelligence artificielle.",
  ]) {
    assert.deepEqual(verifieDivulgation(variante, "email", "autonome"), [], `« ${variante} » doit passer`);
  }
});

test("⚠ LES MOTS ORDINAIRES NE DÉCLENCHENT RIEN — sinon le garde refuse du vrai", () => {
  // Contre-test. « intelligence », « agent commercial », « automatiser » sont
  // du vocabulaire courant chez nous : s'ils déclenchaient l'aveu, un message
  // humain parfaitement légitime serait accusé de mentir.
  for (const phrase of [
    "Notre agent commercial passera vous voir mardi.",
    "On peut automatiser vos relances.",
    "Votre équipe a une vraie intelligence du terrain.",
    "Je vous rappelle demain.",
  ]) {
    assert.deepEqual(
      verifieDivulgation(phrase, "email", "valide-par-humain"),
      [],
      `« ${phrase} » est un message humain légitime`,
    );
  }
});

test("⚠ LA MENTION DE PLATEFORME N'EST PAS UNE DIVULGATION", () => {
  /**
   * Elle nomme l'OUTIL, pas l'auteur — et c'est la seule chose qui survit au
   * white-label (marque, adresse et logo suivent le COMPTE). Les confondre
   * ferait croire qu'un pied « Généré avec… » couvre l'obligation légale.
   */
  assert.deepEqual(
    verifieDivulgation(`Bonjour. ${MENTION_PLATEFORME}`, "email", "autonome"),
    [
      // Elle ne suffit PAS : l'aveu manque toujours.
      ...verifieDivulgation("Bonjour.", "email", "autonome"),
    ],
    "la mention d'outil ne couvre pas l'obligation de divulgation",
  );
  // Et elle ne DÉCLENCHE pas non plus le refus sur un message relu.
  assert.deepEqual(verifieDivulgation(`Bonjour. ${MENTION_PLATEFORME}`, "email", "valide-par-humain"), []);
});

test("⚠ la divulgation écrite est déclarée à UN endroit", () => {
  // Le script vocal a la sienne (première phrase, prononcée par le code).
  // Deux TEXTES pour deux canaux, mais UNE règle qui décide s'ils s'appliquent.
  const src = readFileSync(join(process.cwd(), "lib/signature-ia.ts"), "utf8");
  assert.match(src, /export const DIVULGATION_ECRITE/);
  assert.match(DIVULGATION_ECRITE, /STOP/, "le moyen de refus voyage avec l'aveu");
});
