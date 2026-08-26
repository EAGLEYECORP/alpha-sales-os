import { test } from "node:test";
import assert from "node:assert/strict";
import { importerFiches } from "../lib/sourcing-terrain-import";
import { ENTETE_TERRAIN, HYPOTHESE_DECROCHE, planifierAppels } from "../lib/sourcing-terrain";
import { RESULTATS_MANUELS } from "../lib/call-outcome";
import { attemptsFromEvents } from "../lib/master-rappel";
import { cadenceFor, cibleDepuisProspect } from "../lib/call-cadence";
import { calibrer, tauxPourPlan, ECHANTILLON_MIN } from "../lib/calibration";
import { leconDeDebrief } from "../lib/apprentissage";
import { leconsPourAppels } from "../lib/lecons-terrain";
import { verticalById } from "../lib/playbook";
import type { KnowledgeNote } from "../lib/knowledge";
import type { Prospect, TimelineEvent } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA BOUCLE, EN ENTIER — le test qui refuse qu'un maillon reparte dans le vide.
 *
 * Les tests unitaires prouvent que chaque module marche. Celui-ci prouve que
 * la CHAÎNE tient, ce qui est une autre affaire : trois des cinq défauts
 * corrigés cette session étaient des modules corrects, mal raccordés.
 *
 *   fiche terrain
 *     → import + qualification
 *       → appel + résultat consigné
 *         → relu correctement par la cadence  (maillon 1)
 *         → recompté par la calibration       (maillon 2)
 *           → le plan de la campagne suivante utilise le taux MESURÉ
 *         → débrief versé au Cerveau          (maillon 3)
 *           → ressorti sur la file d'appels du même métier
 *
 * Le tour est bouclé quand la sortie corrige l'entrée. C'est ça, et rien
 * d'autre, que ce fichier vérifie.
 * ─────────────────────────────────────────────────────────────────────
 */

const T0 = Date.parse("2026-09-01T09:00:00.000Z");
const HORODATE = { createdAt: "2026-09-01T09:00:00.000Z", updatedAt: "2026-09-01T09:00:00.000Z" };
const appel = (jour: number, summary: string): TimelineEvent => ({
  id: `a-${jour}-${summary.slice(0, 8)}`,
  date: new Date(T0 + jour * 86_400_000).toISOString(),
  kind: "appel",
  summary,
});

/** Un lot terrain comme l'opérateur le colle vraiment : point-virgules. */
function lotTerrain(n: number): string {
  const lignes = [ENTETE_TERRAIN];
  for (let i = 0; i < n; i++) {
    const tel = `04 78 ${String(10 + Math.floor(i / 100)).padStart(2, "0")} ${String(i % 100).padStart(2, "0")} ${String((i * 7) % 100).padStart(2, "0")}`;
    // Une fiche sur trois porte la plainte : le lot est MÉLANGÉ, sinon la
    // calibration ne pourra jamais comparer quoi que ce soit.
    const avis = i % 3 === 0 ? `"impossible de les joindre, j'ai appelé trois fois"` : `"très bon travail"`;
    lignes.push(
      `Carrosserie ${i};carrosserie;Lyon 3e;${tel};;${120 + i};4,6;09:00–12:00, 14:00–18:00;${avis};45.20A;${String(300000000 + i)}`
    );
  }
  return lignes.join("\n");
}

test("bout en bout — la sortie du terrain revient corriger l'entrée", () => {
  // ── 1. Le lot entre et se qualifie ──
  const lot = importerFiches(lotTerrain(60));
  assert.ok(lot.retenus.length >= 40, `le lot doit majoritairement passer, obtenu ${lot.retenus.length}`);

  // ── 2. Le plan de la PREMIÈRE campagne ne peut être qu'une hypothèse ──
  const vierge = calibrer([]);
  const tauxAvant = tauxPourPlan(vierge, HYPOTHESE_DECROCHE);
  assert.equal(tauxAvant.source, "aucune");
  assert.equal(tauxAvant.taux, HYPOTHESE_DECROCHE);
  assert.match(tauxAvant.phrase, /jamais mesurée/);

  const planAvant = planifierAppels(lot.retenus.length, 4, tauxAvant.taux);
  assert.equal(planAvant.cibles, lot.retenus.length);

  // ── 3. La campagne tourne : on consigne des résultats RÉELS ──
  // Un décroché sur trois environ, et les fiches avec plainte décrochent
  // mieux — c'est l'hypothèse du score, et c'est elle qu'on va mesurer.
  const appeles: Prospect[] = lot.retenus.map(({ prospect: p }, i) => {
    const plainte = p.tags.includes("injoignable");
    const decroche = plainte ? i % 2 === 0 : i % 5 === 0;
    return {
      ...p,
      events: [appel(1, decroche ? RESULTATS_MANUELS.rappeler.summary : RESULTATS_MANUELS.messagerie.summary)],
    };
  });

  // ── MAILLON 1 : la cadence relit correctement ce qui a été cliqué ──
  const joint = appeles.find((p) => p.events[0].summary === RESULTATS_MANUELS.rappeler.summary)!;
  const dJoint = cadenceFor(attemptsFromEvents(joint), new Date(T0 + 5 * 86_400_000), cibleDepuisProspect(joint));
  assert.equal(dJoint.state, "repondu-passer-humain", "un décroché doit sortir de la file du robot");
  assert.equal(dJoint.callNow, false);

  const muet = appeles.find((p) => p.events[0].summary === RESULTATS_MANUELS.messagerie.summary)!;
  const dMuet = cadenceFor(attemptsFromEvents(muet), new Date(T0 + 5 * 86_400_000), cibleDepuisProspect(muet));
  assert.notEqual(dMuet.state, "repondu-passer-humain", "une messagerie n'est pas un décroché");
  // Le SIREN a voyagé de la colonne du tableur jusqu'au plafond de cadence.
  assert.ok(cibleDepuisProspect(muet).siren, "le SIREN doit survivre à l'import");

  // ── MAILLON 2 : la calibration recompte, et le plan suivant en hérite ──
  const cal = calibrer(appeles);
  assert.equal(cal.appeles, appeles.length);
  assert.ok(cal.composes >= ECHANTILLON_MIN, "le lot doit dépasser le seuil, sinon rien ne bascule");
  assert.equal(cal.decrocheParTentative.source, "mesure");
  assert.equal(cal.decrocheParTentative.fragile, false);

  const tauxApres = tauxPourPlan(cal, HYPOTHESE_DECROCHE);
  assert.equal(tauxApres.source, "mesure", "LA BASCULE : l'hypothèse cède la place au chiffre réel");
  assert.notEqual(tauxApres.taux, HYPOTHESE_DECROCHE);
  assert.match(tauxApres.phrase, /MESURÉ/);

  const planApres = planifierAppels(lot.retenus.length, 4, tauxApres.taux);
  assert.notEqual(
    planApres.joints,
    planAvant.joints,
    "le plan de la campagne suivante doit CHANGER — sinon la boucle n'a rien transmis"
  );

  // Et le signal du score a été mis à l'épreuve, pas seulement affiché.
  const plainte = cal.ecarts.find((e) => e.critere.id === "plainte-injoignable")!;
  assert.notEqual(plainte.verdict, "insuffisant", "un lot mélangé doit permettre de juger le signal");
  assert.ok(plainte.avec.n > 0 && plainte.sans.n > 0, "les deux bras doivent être remplis");
});

test("bout en bout — ce qu'on apprend d'un appel ressort sur le métier suivant", () => {
  // ── MAILLON 3 : débrief → Cerveau → file d'appels de la même verticale ──
  const lot = importerFiches(lotTerrain(3));
  const p = lot.retenus[0].prospect;

  const lecon = leconDeDebrief({
    prospect: p,
    resume: "Il perd les appels pendant la pause déjeuner.",
    cequiAMarche: "Lui faire compter les appels manqués entre midi et deux.",
    cequiACoute: "Parler du prix trop tôt.",
  });
  assert.ok(lecon, "un débrief avec des faits doit produire une leçon");

  const notes = [{ ...lecon!, ...HORODATE }] as KnowledgeNote[];
  const servies = leconsPourAppels(notes, verticalById("garage-carrosserie"), [p]);
  assert.equal(servies.length, 1, "la leçon doit ressortir sur la file d'appels de sa verticale");
  assert.match(servies[0].extrait, /pause déjeuner|midi et deux/);

  // Le tour complet : ce qui est sorti d'un appel est disponible AVANT le
  // suivant, sur le même métier, sans que personne n'aille le chercher.
  const autreVerticale = leconsPourAppels(notes, verticalById("restauration"), []);
  assert.equal(autreVerticale.length, 0, "et pas sur un métier qui n'a rien à voir");
});
