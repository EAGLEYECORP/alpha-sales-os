import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cadenceFor, plannedRecalls, plafondRappels, CALLFLOW_MAX_RECALLS, PLAFOND_SOLLICITATIONS_B2C,
  type CallAttempt,
} from "../lib/call-cadence";

const T0 = "2026-08-03T09:00:00.000Z";
const at = (h: number) => new Date(new Date(T0).getTime() + h * 3600_000);

test("cadence — aucun appel encore : on appelle maintenant", () => {
  const d = cadenceFor([], at(0));
  assert.equal(d.state, "a-appeler");
  assert.equal(d.callNow, true);
  assert.equal(d.recallsLeft, CALLFLOW_MAX_RECALLS);
});

test("cadence — 5 rappels étalés sur 2 jours après le 1er appel", () => {
  const planned = plannedRecalls(T0);
  assert.equal(planned.length, 5);
  const spanH = (new Date(planned[4]).getTime() - new Date(T0).getTime()) / 3600_000;
  assert.equal(spanH, 48, "le dernier rappel tombe à 48 h — 2 jours pile");
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

test("cadence — dès qu'il RÉPOND, Alpha Voice arrête et passe la main au closer", () => {
  const attempts: CallAttempt[] = [
    { at: T0, outcome: "sans-reponse" },
    { at: at(3).toISOString(), outcome: "repondu" },
  ];
  const d = cadenceFor(attempts, at(4));
  assert.equal(d.state, "repondu-passer-humain");
  assert.equal(d.callNow, false, "ne JAMAIS rappeler quelqu'un qui a décroché");
  assert.equal(d.handoffToHuman, true);
  assert.equal(d.nextCallAt, null);
  assert.match(d.reason, /closer|humain/i);
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

test("cadence — 5 rappels consommés : épuisée, on repasse à l'humain sur un autre canal", () => {
  const attempts: CallAttempt[] = [
    { at: T0, outcome: "sans-reponse" },
    ...[3, 8, 24, 32, 48].map((h) => ({ at: at(h).toISOString(), outcome: "sans-reponse" as const })),
  ];
  const d = cadenceFor(attempts, at(72));
  assert.equal(d.state, "epuisee");
  assert.equal(d.callNow, false);
  assert.equal(d.recallsUsed, CALLFLOW_MAX_RECALLS);
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
   * La cadence exigée par ScintIA fait SIX contacts en deux jours (le premier
   * appel plus cinq rappels). Le décret n° 2022-1313 plafonne le démarchage à
   * QUATRE sollicitations par consommateur sur 30 jours glissants.
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

test("cadence — un SIREN lève le plafond : la cadence ScintIA s'applique entière", () => {
  /**
   * Le code ne tranche PAS l'accord commercial. Sur une cible clairement
   * professionnelle — inscrite au registre des entreprises — la cadence
   * Callflow complète s'applique. Il empêche seulement la cadence longue de
   * partir en silence sur une cible à risque.
   */
  const p = plafondRappels({ siren: "123456789", telephone: "0612345678" });
  assert.equal(p.plafonne, false);
  assert.equal(p.max, CALLFLOW_MAX_RECALLS);
  assert.match(p.pourquoi, /inscrite au registre/);
});

test("cadence — le plafond MORD réellement sur la décision, pas juste sur le texte", () => {
  // Un plafond qui ne change pas l'état de la cadence ne plafonne rien.
  const tentatives = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      at: new Date(Date.now() - (n - i) * 3 * 3_600_000).toISOString(),
      outcome: "sans-reponse" as const,
    }));

  const sansSiren = cadenceFor(tentatives(4), new Date(), { telephone: "0612345678" });
  assert.equal(sansSiren.state, "epuisee", "4 sollicitations atteintes : on arrête");
  assert.equal(sansSiren.callNow, false);
  assert.equal(sansSiren.handoffToHuman, true, "on repasse à l'humain, on n'abandonne pas la fiche");

  const avecSiren = cadenceFor(tentatives(4), new Date(), { siren: "123456789" });
  assert.notEqual(avecSiren.state, "epuisee", "une entreprise inscrite garde ses rappels");
});

test("cadence — le SIREN doit VOYAGER de l'import jusqu'au runner", () => {
  /**
   * Le maillon fragile : `plafondRappels` ne peut rien faire si le runner
   * l'appelle sans cible. Il appelait `cadenceFor(attempts, now)` tout court —
   * donc le plafond ne s'appliquait jamais, et la cadence longue partait sur
   * tout le monde.
   */
  const runner = readFileSync(join(process.cwd(), "lib/campaign-runner.ts"), "utf8");
  assert.match(runner, /cadenceFor\([\s\S]{0,120}siren/, "le runner doit passer le SIREN à la cadence");

  const importTerrain = readFileSync(join(process.cwd(), "lib/sourcing-terrain-import.ts"), "utf8");
  assert.match(importTerrain, /SIREN\s*:/, "l'import terrain doit écrire le SIREN là où le runner le relit");
});
