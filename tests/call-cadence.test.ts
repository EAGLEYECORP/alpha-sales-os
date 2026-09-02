import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cadenceFor, cibleDepuisProspect, plannedRecalls, plafondRappels, RAPPELS_MAX, RAPPELS_OFFSETS_H,
  PLAFOND_SOLLICITATIONS_B2C,
  type CallAttempt,
} from "../lib/call-cadence";
import { fenetreOuverte } from "../lib/conformite";
import { masterRappel } from "../lib/master-rappel";
import { prospect } from "./fixtures";

const T0 = "2026-08-03T09:00:00.000Z";
const at = (h: number) => new Date(new Date(T0).getTime() + h * 3600_000);

test("cadence — aucun appel encore : on appelle maintenant", () => {
  const d = cadenceFor([], at(0));
  assert.equal(d.state, "a-appeler");
  assert.equal(d.callNow, true);
  assert.equal(d.recallsLeft, RAPPELS_MAX);
});

test("cadence — les rappels sont étalés sur ~2 jours OUVRÉS après le 1er appel", () => {
  /**
   * ⚠ Ce test exigeait exactement 48 h. Il mesurait l'arithmétique des offsets,
   * pas la cadence : les rappels sont maintenant calés sur des fenêtres
   * d'appel ouvertes, donc un rappel prévu à 48 h glisse s'il tombe au
   * déjeuner, la nuit ou le week-end. Le figer à 48 h reviendrait à interdire
   * la correction qui empêche d'appeler à minuit.
   *
   * L'intention reste : cinq rappels, jamais AVANT ce que les offsets
   * prévoyaient, et bornés à quelques jours ouvrés — pas une traîne infinie.
   */
  const planned = plannedRecalls(T0);
  assert.equal(planned.length, RAPPELS_MAX, "autant de rappels que d'intentions déclarées");
  // On lit le DERNIER offset déclaré, jamais un nombre recopié : la cadence a
  // déjà changé une fois (5 rappels → 3), et un 48 en dur aurait survécu au
  // changement en testant une heure qui n'existe plus.
  const dernierOffset = RAPPELS_OFFSETS_H[RAPPELS_OFFSETS_H.length - 1];
  const spanH = (new Date(planned[planned.length - 1]).getTime() - new Date(T0).getTime()) / 3600_000;
  assert.ok(
    spanH >= dernierOffset,
    `le dernier rappel ne doit jamais tomber AVANT son offset (${spanH} h < ${dernierOffset} h)`
  );
  assert.ok(spanH <= 24 * 5, `ni partir en traîne : ${spanH} h`);
});

test("cadence — sans réponse, elle attend l'heure puis redevient due", () => {
  const attempts: CallAttempt[] = [{ at: T0, outcome: "sans-reponse" }];
  // Juste après le 1er appel : le rappel n'est pas encore dû.
  const early = cadenceFor(attempts, at(1));
  assert.equal(early.state, "attente");
  assert.equal(early.callNow, false);
  // 3 h plus tard : dû.
  const due = cadenceFor(attempts, at(3));
  assert.equal(due.state, "en-cadence");
  assert.equal(due.callNow, true);
  assert.equal(due.recallsUsed, 0);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * NOUVELLE DOCTRINE (28/08/2026) — Alpha Voice mène l'appel à froid ENTIER.
 *
 * L'ancienne règle passait la main dès qu'on décrochait : Alpha Voice ne
 * faisait que composer. Un « pas intéressé pour l'instant » consommait alors
 * autant de temps humain qu'un rendez-vous obtenu — et c'est ce qui rendait le
 * volume impossible (500 appels à 30 % de décroché = 150 conversations).
 *
 * Ce qui n'a PAS changé, et qui reste non négociable : on ne rappelle jamais
 * quelqu'un qui a décroché.
 * ─────────────────────────────────────────────────────────────────────
 */
test("cadence — il a décroché sans dire oui : on s'arrête, mais AUCUN humain n'est mobilisé", () => {
  const attempts: CallAttempt[] = [
    { at: T0, outcome: "sans-reponse" },
    { at: at(3).toISOString(), outcome: "repondu" },
  ];
  const d = cadenceFor(attempts, at(4));
  assert.equal(d.state, "repondu-passer-humain");
  assert.equal(d.callNow, false, "ne JAMAIS rappeler quelqu'un qui a décroché");
  assert.equal(d.nextCallAt, null);
  assert.equal(d.handoffToHuman, false, "un décroché sans suite ne vaut pas le temps d'un closer");
  assert.match(d.reason, /aucun humain/i);
});

test("cadence — INTÉRÊT QUALIFIÉ : c'est le seul cas qui réveille un closer", () => {
  const attempts: CallAttempt[] = [
    { at: T0, outcome: "sans-reponse" },
    { at: at(3).toISOString(), outcome: "interesse" },
  ];
  const d = cadenceFor(attempts, at(4));
  assert.equal(d.state, "repondu-passer-humain");
  assert.equal(d.callNow, false);
  assert.equal(d.handoffToHuman, true);
  assert.match(d.reason, /closer|humain/i);
});

test("cadence — l'intérêt prime sur le simple décroché, quel que soit l'ordre", () => {
  /**
   * Une fiche peut porter les deux : il a parlé un jour, il a dit oui un
   * autre. Si « repondu » était testé en premier, le oui disparaîtrait et
   * personne ne serait prévenu.
   */
  const d = cadenceFor(
    [
      { at: T0, outcome: "repondu" },
      { at: at(3).toISOString(), outcome: "interesse" },
    ],
    at(4)
  );
  assert.equal(d.handoffToHuman, true);
});

test("cadence — l'opposition coupe tout, définitivement et immédiatement", () => {
  const attempts: CallAttempt[] = [
    { at: T0, outcome: "sans-reponse" },
    { at: at(3).toISOString(), outcome: "opposition" },
  ];
  const d = cadenceFor(attempts, at(50));
  assert.equal(d.state, "stop-definitif");
  assert.equal(d.callNow, false);
  assert.equal(d.handoffToHuman, false, "une opposition ne se refile pas à un humain");
});

test("cadence — tous les rappels consommés : épuisée, on repasse à l'humain sur un autre canal", () => {
  // On construit depuis RAPPELS_MAX : figer la liste d'heures ferait passer ce
  // test au vert avec un rappel de moins le jour où la cadence change.
  const attempts: CallAttempt[] = [
    { at: T0, outcome: "sans-reponse" },
    ...Array.from({ length: RAPPELS_MAX }, (_, i) => ({
      at: at(3 + i * 12).toISOString(),
      outcome: "sans-reponse" as const,
    })),
  ];
  const d = cadenceFor(attempts, at(96));
  assert.equal(d.state, "epuisee");
  assert.equal(d.callNow, false);
  assert.equal(d.recallsUsed, RAPPELS_MAX);
  assert.equal(d.recallsLeft, 0);
  assert.equal(d.handoffToHuman, true);
});

test("cadence — un numéro invalide n'est pas rappelé 5 fois", () => {
  const d = cadenceFor([{ at: T0, outcome: "invalide" }], at(10));
  assert.equal(d.state, "stop-definitif");
  assert.equal(d.callNow, false);
});

// ── LE PLAFOND LÉGAL, ET LE CONFLIT QU'IL ARBITRE ──────────────────────

test("cadence — sans SIREN, le plafond légal B2C s'impose", () => {
  /**
   * ⚠ LE CONFLIT QUE CE CODE ARBITRE.
   *
   * La cadence imposée par le revendeur disparu faisait SIX contacts en deux
   * jours (le premier appel plus cinq rappels). Le décret n° 2022-1313
   * plafonne le démarchage à QUATRE sollicitations par consommateur sur
   * 30 jours glissants.
   *
   * ⚠ Depuis le 02/09/2026 la cadence est de 3 rappels — donc QUATRE contacts,
   * exactement au plafond. Ce plafond ne mord donc plus, et c'est l'état
   * voulu : il reste armé parce que remonter le tableau à 5 le réarme aussitôt.
   * Le filet ne s'enlève pas avec le chiffre.
   *
   * Il vise le B2C — mais une liste terrain est MÊLÉE, et un artisan en nom
   * propre sur son mobile est exactement la zone grise. C'est nous qui portons
   * le risque.
   *
   * Avant : l'app AVERTISSAIT à l'import (`planifierAppels`) et EXÉCUTAIT six
   * contacts ici. Un avertissement qui ne pilote rien s'apprend à être ignoré.
   */
  const p = plafondRappels({ telephone: "0612345678" });
  assert.equal(p.plafonne, true);
  assert.equal(p.max, PLAFOND_SOLLICITATIONS_B2C - 1, "le PREMIER appel compte dans les sollicitations");
  assert.match(p.pourquoi, /2022-1313/);
  assert.match(p.pourquoi, /croise la fiche avec le registre/, "il faut dire comment lever le plafond");
});

test("cadence — un SIREN lève le plafond : la cadence complète s'applique", () => {
  /**
   * Le code ne tranche PAS l'accord commercial. Sur une cible clairement
   * professionnelle — inscrite au registre des entreprises — la cadence
   * complète s'applique. Il empêche seulement la cadence longue de
   * partir en silence sur une cible à risque.
   */
  const p = plafondRappels({ siren: "123456789", telephone: "0612345678" });
  assert.equal(p.plafonne, false);
  assert.equal(p.max, RAPPELS_MAX);
  assert.match(p.pourquoi, /inscrite au registre/);
});

test("cadence — le plafond MORD réellement sur la décision, pas juste sur le texte", () => {
  // Un plafond qui ne change pas l'état de la cadence ne plafonne rien.
  const tentatives = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      at: new Date(Date.now() - (n - i) * 3 * 3_600_000).toISOString(),
      outcome: "sans-reponse" as const,
    }));

  const sansSiren = cadenceFor(tentatives(PLAFOND_SOLLICITATIONS_B2C), new Date(), { telephone: "0612345678" });
  assert.equal(sansSiren.state, "epuisee", "plafond de sollicitations atteint : on arrête");
  assert.equal(sansSiren.callNow, false);
  assert.equal(sansSiren.handoffToHuman, true, "on repasse à l'humain, on n'abandonne pas la fiche");

  /**
   * ⚠ ET LE FILET DOIT SURVIVRE AU CHIFFRE DU JOUR.
   *
   * La cadence est descendue à 3 rappels le 02/09/2026, soit pile le plafond
   * légal : les deux chemins donnent donc la même longueur aujourd'hui, et un
   * test qui comparerait leurs ÉTATS ne prouverait plus rien.
   *
   * On teste donc la fonction qui plafonne, pas son effet du jour : sans
   * SIREN, jamais plus que le décret n'autorise — quelle que soit la cadence
   * qu'on remettra demain.
   */
  const sans = plafondRappels({ telephone: "0612345678" });
  assert.equal(sans.plafonne, true);
  assert.ok(
    sans.max <= PLAFOND_SOLLICITATIONS_B2C - 1,
    "le premier appel compte : 4 sollicitations = 3 rappels au maximum"
  );

  const avec = plafondRappels({ siren: "123456789", telephone: "0612345678" });
  assert.equal(avec.plafonne, false, "un SIREN lève le plafond légal");
  assert.equal(avec.max, RAPPELS_MAX, "et rend la cadence entière, quelle qu'elle soit");
});

test("cadence — le SIREN doit VOYAGER de l'import jusqu'au runner", () => {
  /**
   * Le maillon fragile : `plafondRappels` ne peut rien faire si le runner
   * l'appelle sans cible. Il appelait `cadenceFor(attempts, now)` tout court —
   * donc le plafond ne s'appliquait jamais, et la cadence longue partait sur
   * tout le monde.
   */
  const runner = readFileSync(join(process.cwd(), "lib/campaign-runner.ts"), "utf8");
  assert.match(
    runner,
    /cadenceFor\([\s\S]{0,120}cibleDepuisProspect/,
    "le runner doit passer la cible (donc le SIREN) à la cadence"
  );

  const importTerrain = readFileSync(join(process.cwd(), "lib/sourcing-terrain-import.ts"), "utf8");
  assert.match(importTerrain, /SIREN\s*:/, "l'import terrain doit écrire le SIREN là où le runner le relit");

  // Le mécanisme, pas le mot : la relecture du SIREN doit vraiment marcher
  // sur le texte que l'import écrit.
  const cible = cibleDepuisProspect({ phone: "0612345678", notes: "Fiche terrain\nSIREN : 123456789\nAPE 45.20A" });
  assert.equal(cible.siren, "123456789");
  assert.equal(plafondRappels(cible).plafonne, false, "un SIREN lu doit lever le plafond");
});

test("cadence — le plan affiché à l'humain annonce le MÊME plafond que l'autopilote", () => {
  /**
   * `masterRappel` appelait `cadenceFor(attempts, now)` sans cible et écrivait
   * « rappel n/5 » en dur. Sur une fiche sans SIREN, l'humain lisait donc un
   * plan à 5 rappels pendant que le runner s'arrêtait à 4 — et c'est l'humain
   * qui compose.
   */
  const p = prospect({
    phone: "0612345678",
    notes: "aucun SIREN connu",
    events: [
      { id: "e1", date: at(0).toISOString(), kind: "appel", summary: "Sans réponse" },
      { id: "e2", date: at(3).toISOString(), kind: "appel", summary: "Sans réponse" },
    ],
  });

  const attendu = plafondRappels(cibleDepuisProspect(p));
  assert.equal(attendu.max, PLAFOND_SOLLICITATIONS_B2C - 1, "sans SIREN, 3 rappels au maximum");

  const plan = masterRappel(p, { now: at(30) });
  const ligne = [...plan.alpha, ...plan.human].map((a) => a.do).join(" | ");
  assert.ok(
    !/\/5\b/.test(ligne),
    `le plan ne doit plus annoncer un plafond de 5 sur une fiche sans SIREN : ${ligne}`
  );
  assert.match(ligne, new RegExp(`/${attendu.max}\\b`), `le plan doit annoncer /${attendu.max}`);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ « TOUJOURS AU BON MOMENT » — LA CADENCE NE REGARDAIT PAS L'HEURE.
 *
 * `fenetreOuverte` sait depuis toujours quelles heures valent quelque chose
 * (9h-12h, 14h-18h, jamais le week-end). `plannedRecalls` calculait des
 * offsets en heures sèches depuis le premier appel. Les deux modules ne se
 * parlaient pas — le défaut récurrent du dépôt, sur ce qui compose de vrais
 * numéros.
 *
 * MESURÉ AVANT CORRECTION : premier appel lundi 9h30 → rappel n°1 à 12h30,
 * l'heure que notre propre module appelle « taux de décroché au plancher ».
 * Premier appel JEUDI 16h → 4 sur 5 hors fenêtre, dont un à MINUIT. Premier
 * appel VENDREDI 10h → **5 sur 5 brûlés**, trois le week-end.
 *
 * Sur une cible sans SIREN, le plafond légal est de 4 sollicitations : en
 * gaspiller une au déjeuner, c'est perdre un quart de tout ce à quoi on a
 * droit sur ce prospect.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ cadence — AUCUN rappel ne tombe hors fenêtre, quel que soit le jour de départ", () => {
  /**
   * On balaie une semaine entière, heure par heure. Tester un seul jour de
   * départ laisserait passer le cas vendredi — celui qui était totalement
   * cassé, et le seul qu'un test « lundi 9h » n'aurait jamais montré.
   */
  const debut = new Date("2026-09-07T06:00:00Z"); // lundi
  for (let h = 0; h < 24 * 7; h++) {
    const premier = new Date(debut.getTime() + h * 3_600_000);
    for (const iso of plannedRecalls(premier.toISOString())) {
      const f = fenetreOuverte(new Date(iso));
      assert.equal(
        f.open,
        true,
        `départ ${premier.toISOString()} → rappel ${iso} tombe « ${f.label} »`
      );
    }
  }
});

test("⚠ cadence — deux rappels ne s'entassent jamais dans la même heure", () => {
  /**
   * ⚠ CE TEST EXISTE PARCE QUE LA PREMIÈRE CORRECTION A CRÉÉ CE BUG-LÀ.
   *
   * En glissant chaque rappel « à la prochaine fenêtre ouverte », un départ le
   * VENDREDI 17h renvoyait les cinq rappels au lundi matin : 9h00, 9h15, 9h30,
   * 9h45, 10h00. Zéro tentative hors fenêtre au compteur — et cinq appels à la
   * même personne en une heure. Corriger « au bon moment » avait cassé « de la
   * bonne manière ».
   */
  const debut = new Date("2026-09-07T06:00:00Z");
  for (let h = 0; h < 24 * 7; h++) {
    const premier = new Date(debut.getTime() + h * 3_600_000);
    const dates = plannedRecalls(premier.toISOString()).map((d) => new Date(d).getTime());
    for (let i = 1; i < dates.length; i++) {
      const ecartH = (dates[i] - dates[i - 1]) / 3_600_000;
      assert.ok(
        ecartH >= 3,
        `départ ${premier.toISOString()} → seulement ${ecartH.toFixed(2)} h entre le rappel ${i} et le ${i + 1}`
      );
    }
  }
});

test("⚠ cadence — l'écran et l'agent lisent la MÊME liste d'heures", () => {
  /**
   * `plannedRecalls` (prévisualisation) et `cadenceFor` (ce qui compose)
   * calculaient l'offset chacun de leur côté. Deux sources pour la même
   * question : l'écran annonce une heure, l'agent en compose une autre — et
   * personne ne s'en aperçoit tant que les deux calculs coïncident par hasard.
   */
  const premier = "2026-09-11T15:00:00Z"; // vendredi 17h : le pire cas
  const prevu = plannedRecalls(premier);
  const etat = cadenceFor([{ at: premier, outcome: "sans-reponse" }], new Date(premier));
  assert.equal(etat.nextCallAt, prevu[0], "le prochain appel doit être le premier du planning affiché");
});
