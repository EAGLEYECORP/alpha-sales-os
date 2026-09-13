import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACTIONS,
  SEGMENTS,
  SEGMENT_PRINCIPAL,
  etatTraction,
  prochaineAction,
  type FaitsTraction,
} from "../lib/plan-traction";
import { FUEL_TARGET, RHYTHM_DAYS, RHYTHM_MIN_TOUCHES } from "../lib/onboarding-path";
import { JUILLET_REEL } from "../lib/pipeline-juillet";

const JUILLET = { succes: JUILLET_REEL.rdvObtenus, n: JUILLET_REEL.prospectsTravailles };

const faits = (p: Partial<FaitsTraction> = {}): FaitsTraction => ({
  fiches: 0,
  joursAuRythme: 0,
  audits: 0,
  appelsPasses: 0,
  appelsConsignes: 0,
  rdvObtenus: 0,
  ...p,
});

test("⚠⚠ AUCUN EURO PROJETÉ — c'est le TYPE qui l'interdit, pas la politesse", () => {
  /**
   * `gagnes: 0`. Le taux RDV → signature n'a JAMAIS été observé. Un plan qui
   * affiche « 23 RDV donc X € » invente le seul maillon manquant et le
   * présente au même rang que les mesures.
   */
  const e = etatTraction(faits({ fiches: 300, joursAuRythme: 5, audits: 20 }), JUILLET);
  assert.equal(e.eurosProjetes, null, "même toutes cibles atteintes, aucun euro");
  assert.match(e.motifSansEuros, /jamais été mesuré/, "l'angle mort se DIT, il ne se remplit pas");

  const src = readFileSync(join(process.cwd(), "lib/plan-traction.ts"), "utf8");
  assert.match(src, /eurosProjetes:\s*null;/, "le type doit rendre l'euro impossible, pas improbable");
});

test("⚠⚠ LES CIBLES SONT IMPORTÉES, JAMAIS REDÉFINIES", () => {
  /**
   * Une seconde cible de 300 fiches écrite ici ferait dire « objectif
   * atteint » à un écran pendant que `/demarrage` afficherait « il en manque
   * cent ». Le défaut le plus banal et le plus coûteux du dépôt.
   */
  const fiches = ACTIONS.find((a) => a.id === "fiches")!;
  const rythme = ACTIONS.find((a) => a.id === "rythme")!;
  assert.equal(fiches.cible, FUEL_TARGET);
  assert.equal(rythme.cible, RHYTHM_DAYS);
  assert.match(rythme.label, new RegExp(String(RHYTHM_MIN_TOUCHES)), "le libellé dérive aussi de la constante");

  const src = readFileSync(join(process.cwd(), "lib/plan-traction.ts"), "utf8");
  assert.match(src, /from "\.\/onboarding-path"/, "les constantes viennent du module qui les porte déjà");
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.ok(
    !/cible:\s*300\b/.test(sansCommentaires) && !/cible:\s*5\b/.test(sansCommentaires),
    "aucune cible recopiée en littéral à côté de la constante importée",
  );
});

test("⚠ UNE SEULE action est marquée MESURÉE, et c'est l'audit", () => {
  /**
   * Juillet le dit sans ambiguïté : 26 appels en plomberie sans une pièce
   * écrite → 0 opportunité ; là où un audit est parti, le taux monte. Marquer
   * les autres « mesurées » ferait croire qu'on sait, alors qu'on suit une
   * intuition raisonnable.
   */
  const mesurees = ACTIONS.filter((a) => a.effet === "mesure");
  assert.equal(mesurees.length, 1, "une seule action a un effet constaté");
  assert.equal(mesurees[0].id, "audits");
  // Et chaque action NOMME d'où vient sa cible — une cible muette se conteste mal.
  for (const a of ACTIONS) assert.ok(a.source.length > 30, `${a.id} : la cible doit dire d'où elle vient`);
});

test("⚠ LE RDV PROJETÉ VOYAGE AVEC SON INTERVALLE — jamais un nombre seul", () => {
  const e = etatTraction(faits(), JUILLET);
  assert.equal(e.rdvAttendus.source, "mesure");
  assert.ok(e.rdvFourchette, "la fourchette doit exister");
  // Tout repose sur 6 RDV : la fourchette est large, et elle doit le rester.
  assert.ok(e.rdvFourchette!.bas < e.rdvFourchette!.haut);
  assert.ok(e.rdvFourchette!.haut > e.rdvFourchette!.bas * 2, "sur 6 observations, l'intervalle ne peut pas être serré");
  assert.match(e.rdvAttendus.phrase, /6\/78/, "le dénominateur voyage avec le taux");
});

test("⚠ LA FOURCHETTE SUIT LA CIBLE DE FICHES, pas un nombre gravé", () => {
  // Si `FUEL_TARGET` change, la projection doit changer avec lui.
  const e = etatTraction(faits(), JUILLET);
  const attenduBas = Math.round(FUEL_TARGET * e.rdvAttendus.bas!);
  assert.equal(e.rdvFourchette!.bas, attenduBas);
});

test("zéro donnée → zéro projection, jamais un zéro qui ressemble à un résultat", () => {
  const e = etatTraction(faits(), { succes: 0, n: 0 });
  assert.equal(e.rdvAttendus.source, "aucune");
  assert.equal(e.rdvAttendus.valeur, null);
  assert.equal(e.rdvFourchette, null, "sans taux, aucune fourchette — pas une fourchette de 0 à 0");
});

test("les lignes disent le reste, et dépasser n'est jamais une dette", () => {
  const e = etatTraction(faits({ fiches: 350, joursAuRythme: 2, audits: 0 }), JUILLET);
  const fiches = e.lignes.find((l) => l.action.id === "fiches")!;
  assert.equal(fiches.atteinte, true);
  assert.equal(fiches.reste, 0, "350 sur 300 ne doit pas rendre un reste négatif");
  const rythme = e.lignes.find((l) => l.action.id === "rythme")!;
  assert.equal(rythme.reste, RHYTHM_DAYS - 2);
});

test("⚠ le taux de consignation est un POURCENTAGE, et zéro appel ne vaut pas 100 %", () => {
  // Piège classique : 0/0 rendu comme « tout est consigné ».
  const vide = etatTraction(faits({ appelsPasses: 0, appelsConsignes: 0 }), JUILLET);
  assert.equal(vide.lignes.find((l) => l.action.id === "resultats-consignes")!.fait, 0);
  const plein = etatTraction(faits({ appelsPasses: 40, appelsConsignes: 30 }), JUILLET);
  assert.equal(plein.lignes.find((l) => l.action.id === "resultats-consignes")!.fait, 75);
});

test("⚠ UNE SEULE prochaine action — un tableau de quatre retards se referme", () => {
  const e = etatTraction(faits({ fiches: 300 }), JUILLET);
  const p = prochaineAction(e);
  assert.ok(p);
  assert.equal(p!.action.id, "rythme", "fiches atteintes → on sert la suivante, pas les trois");
  // Tout atteint → plus rien à servir, et pas une ligne de remplissage.
  const fini = etatTraction(
    faits({ fiches: 300, joursAuRythme: 5, audits: 20, appelsPasses: 10, appelsConsignes: 10 }),
    JUILLET,
  );
  assert.equal(prochaineAction(fini), null);
});

test("⚠⚠ AUCUN NOM D'ENTREPRISE DANS LES SEGMENTS — des critères, jamais des marques", () => {
  /**
   * Le dépôt est public. `tests/noms-reels.ts` garde les noms à la même
   * échelle que les numéros, mais il n'extrait que depuis nos fiches privées :
   * une liste de cibles nommées venue de l'extérieur passerait dessous. Ici on
   * refuse la FORME — une majuscule en milieu de phrase qui n'est pas un début
   * de phrase ni un acronyme connu.
   *
   * Et sur le fond : une liste de quinze marques ne se reproduit pas, les
   * critères qui l'ont produite si.
   */
  const src = readFileSync(join(process.cwd(), "lib/plan-traction.ts"), "utf8");
  const textes = SEGMENTS.flatMap((s) => [s.label, s.critere, s.pourquoiImmediat]);
  assert.ok(textes.length >= 6, "les segments doivent porter du texte à inspecter");
  for (const t of textes) {
    // Un nom propre au milieu d'une phrase : mot capitalisé non précédé d'un
    // point. On tolère les sigles tout-majuscules (B2B, ICP, CPF, RDV).
    const suspects = [...t.matchAll(/(?<![.!?]\s)(?<!^)\b([A-ZÀ-Þ][a-zà-ÿ]{2,})\b/g)].map((m) => m[1]);
    assert.deepEqual(suspects, [], `« ${t} » : aucun nom propre ne doit apparaître dans un critère`);
  }
  assert.ok(!/eagleye/i.test(src), "pas même le nôtre");
});

test("⚠ UN SEUL segment principal, et les cycles portent leur niveau de preuve", () => {
  assert.equal(SEGMENT_PRINCIPAL, SEGMENTS[0], "l'avatar en tête est explicite, pas déduit de l'ordre par hasard");
  for (const s of SEGMENTS) {
    assert.equal(
      s.preuveCycle,
      "secondaire",
      `${s.id} : tant qu'on n'a pas mesuré NOTRE cycle, la source reste secondaire (blogs d'agences qui vendent de la prospection)`,
    );
    assert.ok(s.cycleJours.bas < s.cycleJours.haut, `${s.id} : un cycle est une fourchette, jamais un nombre`);
    assert.ok(s.commerciaux.haut <= 50, `${s.id} : au-delà de 50, c'est achats + InfoSec + 9 mois`);
    assert.ok(s.pourquoiImmediat.length > 60, `${s.id} : « effet immédiat » doit être argumenté, pas affirmé`);
  }
});
