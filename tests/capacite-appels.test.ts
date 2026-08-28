import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { capaciteAppels, closersRequis, fichesNecessaires } from "../lib/capacite-appels";
import { CALL_DAILY_SAFE } from "../lib/daily-plan";
import { PLAFOND_SOLLICITATIONS_B2C, CALLFLOW_MAX_RECALLS } from "../lib/call-cadence";
import { RAMP_CEILING } from "../lib/email-ramp";
import { LINKEDIN_DAILY_SAFE } from "../lib/linkedin";

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PLAFOND MACHINE N'EST PLUS LE PLAFOND HUMAIN.
 *
 * ⚠ `CALL_DAILY_SAFE = 30` porte sa raison dans son commentaire : « au-delà,
 * la qualité de conversation décroche ». C'est la FATIGUE d'un closer.
 * `campaign-runner` — qui pilote Alpha Voice — le prenait en défaut, et rien
 * dans l'app ne passait jamais autre chose. L'autopilote tournait donc au
 * rythme d'un humain.
 * ─────────────────────────────────────────────────────────────────────
 */
test("la capacité machine se dérive du closing, pas de la fatigue d'un agent", () => {
  // Un closer seul, 30 % de décroché : 30 conversations absorbables → 100 appels.
  const c = capaciteAppels({ closers: 1, tauxDecrochePct: 30 });
  assert.equal(c.conversationsAttendues, CALL_DAILY_SAFE);
  assert.equal(c.appelsParJour, 100, "30 conversations / 0,30 = 100 appels");
  assert.equal(c.bornePar, "humains");
  assert.ok(c.appelsParJour > CALL_DAILY_SAFE, "la machine doit pouvoir dépasser le plafond d'un humain");
});

/**
 * LA QUESTION POSÉE : « il nous faut 500 touches par jour ».
 *
 * Ce test encode la réponse arithmétique, pour qu'elle ne se reperde pas dans
 * une conversation : 500 appels à 30 % de décroché produisent 150
 * conversations, et il faut cinq closers pour les prendre.
 */
test("500 appels/jour exigent cinq closers — c'est ça, la contrainte", () => {
  assert.equal(closersRequis(500, 30), 5, "500 × 30 % = 150 conversations, / 30 par closer = 5");

  // Et avec cinq closers, la capacité autorise bien 500.
  const c = capaciteAppels({ closers: 5, tauxDecrochePct: 30 });
  assert.ok(c.appelsParJour >= 500, `attendu ≥ 500, obtenu ${c.appelsParJour}`);
  assert.equal(c.conversationsAttendues, 150);

  // Avec UN closer, 500 appels noieraient la journée : la capacité le refuse.
  const seul = capaciteAppels({ closers: 1, tauxDecrochePct: 30 });
  assert.ok(seul.appelsParJour < 500);
  assert.match(seul.pourquoi, /personne ne prend/, "et la raison doit être dite");
});

test("la téléphonie borne quand elle est plus basse que l'équipe", () => {
  const c = capaciteAppels({ closers: 5, tauxDecrochePct: 30, plafondTelephonie: 200 });
  assert.equal(c.appelsParJour, 200);
  assert.equal(c.bornePar, "telephonie");
  assert.match(c.pourquoi, /élargir, pas l'équipe/, "on doit savoir QUOI corriger");
});

/**
 * ⚠ Zéro donnée → zéro chiffre. Un taux de décroché non mesuré ne doit pas
 * produire une division par zéro déguisée en autorisation de volume.
 */
test("sans taux de décroché mesuré, on ne monte pas le volume", () => {
  const c = capaciteAppels({ closers: 3, tauxDecrochePct: 0 });
  assert.equal(c.appelsParJour, 3 * CALL_DAILY_SAFE, "on retombe sur le plafond humain");
  assert.match(c.pourquoi, /non mesuré/);
  assert.ok(Number.isFinite(c.appelsParJour), "jamais d'infini");
});

test("aucun closer = aucun appel, et la raison est commerciale", () => {
  const c = capaciteAppels({ closers: 0, tauxDecrochePct: 30 });
  assert.equal(c.appelsParJour, 0);
  assert.match(c.pourquoi, /contact brûlé/, "un décroché sans personne pour le prendre est pire qu'aucun appel");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA CONTRAINTE QU'ON OUBLIE : LA TAILLE DE LA LISTE.
 *
 * Un volume quotidien ne se tient pas avec une petite liste. La fréquence PAR
 * PROSPECT est plafonnée — 4 sollicitations sur 30 jours glissants sans SIREN
 * (décret n° 2022-1313), la cadence ScintIA complète avec.
 * ─────────────────────────────────────────────────────────────────────
 */
test("500 touches/jour exigent des milliers de fiches distinctes", () => {
  // 20 jours ouvrés, plafond légal de 4 touches par prospect sur la période.
  const sansSiren = fichesNecessaires(500, 20, PLAFOND_SOLLICITATIONS_B2C);
  assert.equal(sansSiren, 2500, "10 000 touches / 4 par prospect = 2 500 fiches");

  // Avec SIREN, la cadence ScintIA complète autorise plus de touches par
  // prospect — donc moins de fiches pour le même volume.
  const avecSiren = fichesNecessaires(500, 20, CALLFLOW_MAX_RECALLS + 1);
  assert.ok(avecSiren < sansSiren, "croiser le registre réduit le besoin en fiches");
  assert.equal(avecSiren, Math.ceil(10_000 / (CALLFLOW_MAX_RECALLS + 1)));

  // Et le contraste avec ce que l'app demande aujourd'hui au démarrage.
  assert.ok(sansSiren > 300, "le minimum de /demarrage (300) ne soutient pas 500/jour");
});

/**
 * ⚠ LE CHIFFRE QUI SURPREND, ET QUI DOIT RESTER ÉCRIT.
 *
 * Additionner les plafonds des canaux MANUELS donne le plafond d'un humain,
 * pas d'une machine. C'est ce total-là qui explique pourquoi 500/jour n'est
 * pas un réglage : il faut la voix.
 */
test("les canaux manuels plafonnent très en dessous de 500", () => {
  const manuel = RAMP_CEILING + LINKEDIN_DAILY_SAFE + CALL_DAILY_SAFE;
  assert.equal(manuel, 95, "40 emails + 25 LinkedIn + 30 appels = 95 touches/jour");
  assert.ok(manuel < 500, "aucun réglage ne fait passer les canaux manuels à 500");
});

test("le plafond d'email reste celui d'UNE boîte — la rotation n'existe pas", () => {
  /**
   * `lib/email-ramp.ts` le dit explicitement : « Pour aller plus haut, il faut
   * plusieurs boîtes et une rotation, qui n'existent pas dans ALPHA. »
   * Tant que c'est vrai, promettre 500 emails/jour serait un mensonge — ce
   * test garde la phrase qui l'empêche.
   */
  const src = readFileSync(join(process.cwd(), "lib/email-ramp.ts"), "utf8");
  assert.match(src, /rotation/i, "la limite doit rester écrite là où on la subirait");
  assert.equal(RAMP_CEILING, 40, "le plafond d'une boîte n'a pas bougé sans qu'on le décide");
});

test("campaign-runner ne prend plus le plafond humain pour une vérité machine", () => {
  const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/campaign-runner.ts"), "utf8"));
  // Le défaut RESTE le plafond humain — c'est volontaire : une machine qui
  // accélère sans qu'on l'ait décidé est pire qu'une machine lente. Ce qui
  // compte, c'est que le plafond soit un PARAMÈTRE, pas une fatalité.
  assert.match(src, /opts\.dailyCap \?\? CALL_DAILY_SAFE/, "le plafond doit rester surchargeable");

  const doc = readFileSync(join(process.cwd(), "lib/campaign-runner.ts"), "utf8");
  assert.match(doc, /capacite-appels/, "et le module qui le dérive doit être nommé");
});
