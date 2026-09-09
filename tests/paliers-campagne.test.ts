import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PALIERS_CAMPAGNE,
  SEUIL_OPPOSITION,
  evaluerProgression,
  plafondPalierCampagne,
  vecuAppels,
  type IdPalierCampagne,
} from "../lib/paliers-campagne";
import { budgetPaliers } from "../lib/paliers-campagne-cout";
import { buildCampaignRun } from "../lib/campaign-runner";
import { prospectDefaults } from "../lib/seed";
import { RESULTATS_MANUELS } from "../lib/call-outcome";
import type { Prospect, TimelineEvent } from "../lib/types";

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Le texte réellement écrit par l'app pour un résultat d'appel.
 *
 * ⚠ Jamais inventé ici. `RESULTATS_MANUELS` est la SEULE source du texte écrit
 * à la main (`lib/call-outcome.ts`) : un résumé recopié dans un test se
 * décorrélerait de ce que l'app produit, et le test continuerait de passer
 * pendant que la lecture réelle casse.
 */
const resume = (lecture: string): string => {
  const e = Object.values(RESULTATS_MANUELS).find((x) => x.lecture === lecture);
  assert.ok(e, `aucun résultat manuel ne se lit « ${lecture} »`);
  return e.summary;
};

const appel = (jour: number, outcome: string): TimelineEvent =>
  ({
    id: `e${jour}-${outcome}`,
    kind: "appel",
    date: new Date(2026, 7, jour, 10).toISOString(),
    summary: resume(outcome),
  }) as TimelineEvent;

/**
 * ⚠ Une fiche assez RICHE pour passer le filtre ICP du runner. Une fiche
 * squelettique est écartée en « hors-icp » avant d'atteindre le plafond : le
 * test de bornage passerait alors au vert pour la mauvaise raison — file
 * vide, mais parce que rien n'était appelable. Même matière que la fixture de
 * `tests/campaign-runner.test.ts`.
 */
const fiche = (id: string, events: TimelineEvent[] = []): Prospect =>
  ({
    ...prospectDefaults,
    id,
    name: "Marc",
    company: `Test ${id}`,
    sector: "artisan",
    city: "Lyon",
    phone: "0465710000",
    email: "m@t.fr",
    stage: "contact",
    trust: 50,
    likeness: 50,
    auditScore: 60,
    conviction: 5,
    monthlyValue: 115,
    setupValue: 990,
    deepAudit: {
      websiteState: "aucun",
      socialState: "inactif",
      localCompetition: "3 garages",
      currentProcess: "le gérant décroche entre deux réparations",
      missedCallsPerWeek: 8,
      avgTicket: 400,
    },
    events,
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
  }) as Prospect;

/** n fiches jamais appelées, prêtes à entrer dans la file. */
const froides = (n: number): Prospect[] =>
  Array.from({ length: n }, (_, i) => fiche(`froid-${i}`));

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PALIER BORNE, IL NE DÉCORE PAS.
 *
 * ⚠ C'est LE test de ce module. Une checklist qui se coche sans rien empêcher
 * ne protège de rien : le jour où le rep est pressé, il coche et il lance.
 * Ce qui protège, c'est que la file d'appels refuse.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ le plafond de palier FERME réellement la file d'appels", () => {
  // Fenêtre forcée : on teste le palier, pas l'horaire.
  const opts = { forceWindow: true, dailyCap: 500, plafondPalier: 10 };

  // 200 fiches froides, aucun appel passé : la file s'arrête à 10.
  const run = buildCampaignRun(froides(200), opts);
  assert.equal(run.queue.length, 10, "le palier de 10 doit borner la file à 10, pas le plafond quotidien");
  assert.equal(run.plafondPalier, 10);
  assert.equal(run.composesTotal, 0);

  const bloques = run.skipped.filter((s) => s.reason === "palier-atteint");
  assert.ok(bloques.length > 0, "les fiches écartées doivent porter la raison PALIER, pas « plafond quotidien »");
  assert.match(bloques[0].detail, /brûle des fiches/, "la raison doit dire ce qu'on perd, pas juste qu'on refuse");
});

test("le palier se compte sur TOUT l'historique, pas sur la journée", () => {
  /**
   * ⚠ C'est la différence avec `dailyCap`, et elle est la raison d'être des
   * deux noms. « 10 appels pour vérifier que la chaîne marche » ne veut rien
   * dire si c'est 10 PAR JOUR : au bout d'une semaine on en a passé 70 sans
   * avoir rien mesuré.
   */
  const dejaAppeles = Array.from({ length: 8 }, (_, i) =>
    // Des appels d'un autre jour : `alreadyToday` ne les voit pas.
    fiche(`vieux-${i}`, [appel(20, "sans-reponse")])
  );
  const run = buildCampaignRun([...dejaAppeles, ...froides(50)], {
    forceWindow: true,
    dailyCap: 500,
    plafondPalier: 10,
    now: new Date(2026, 7, 28, 10),
  });

  assert.equal(run.alreadyToday, 0, "aucun appel AUJOURD'HUI — le plafond quotidien est intact");
  assert.equal(run.composesTotal, 8, "mais 8 appels ont déjà été composés au total");
  assert.equal(run.queue.length, 2, "il ne reste donc que 2 appels avant le palier");
});

test("sans plafond de palier, rien ne change pour l'existant", () => {
  const run = buildCampaignRun(froides(50), { forceWindow: true, dailyCap: 30 });
  assert.equal(run.plafondPalier, null);
  assert.equal(run.queue.length, 30, "le plafond quotidien reprend seul");
  assert.equal(run.skipped.filter((s) => s.reason === "palier-atteint").length, 0);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PLAFOND N'A QU'UNE SEULE RÉPONSE.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ un palier non validé ne se saute pas, et l'ordre est celui des paliers", () => {
  assert.equal(plafondPalierCampagne([]), 10);
  assert.equal(plafondPalierCampagne(["p10"]), 100);
  assert.equal(plafondPalierCampagne(["p10", "p100"]), 1000);
  assert.equal(plafondPalierCampagne(["p10", "p100", "p1000"]), null, "tout validé = plus de bornage");

  // Valider p1000 sans p10 ne débloque RIEN : on retombe sur le premier
  // palier non validé. Sinon, cocher le dernier ouvrirait tout.
  assert.equal(plafondPalierCampagne(["p1000"] as IdPalierCampagne[]), 10);
  assert.equal(plafondPalierCampagne(["p100"] as IdPalierCampagne[]), 10);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * ZÉRO DONNÉE → ZÉRO CHIFFRE. La règle du dépôt, appliquée ici.
 * ─────────────────────────────────────────────────────────────────────
 */
test("sans aucun appel, aucun taux n'est affiché — et surtout pas « 0 % »", () => {
  const p = evaluerProgression(froides(500));

  assert.equal(p.vecu.composes, 0);
  assert.equal(p.tauxDecroche.valeur, null, "un 0 % se lirait comme un résultat catastrophique");
  assert.equal(p.tauxDecroche.source, "aucune");
  assert.equal(p.tauxInteret.valeur, null);
  assert.equal(p.tauxOpposition.valeur, null);

  // Et aucun point n'est vert par défaut.
  assert.ok(p.paliers[0].points.every((c) => !c.satisfait));
  assert.equal(p.courant.palier.id, "p10");
  assert.equal(p.plafond, 10);
});

test("un point déclaratif ne s'offre pas tant qu'il n'y a rien à déclarer", () => {
  /**
   * ⚠ LE POINT LE PLUS IMPORTANT DE CE FICHIER. « J'ai entendu la phrase
   * d'ouverture » est la vérification d'une OBLIGATION LÉGALE (art. 50 EU AI
   * Act). Le laisser cocher avant qu'un seul appel n'ait été décroché
   * fabriquerait la preuve — et c'est précisément ce qu'on ferait, sans y
   * penser, en préparant l'écran la veille.
   */
  const art50 = (ps: Prospect[]) =>
    evaluerProgression(ps).paliers[0].points.find((c) => c.id === "p10-art50")!;

  const rien = art50(froides(3));
  assert.ok(rien.bloquePar.length > 0, "aucun décroché : le point doit être verrouillé");
  assert.match(rien.bloquePar, /décroché/i);

  // Un appel décroché lève le verrou — et rien d'autre.
  const apres = art50([fiche("a", [appel(27, "repondu")])]);
  assert.equal(apres.bloquePar, "", "un décroché rend le point cochable");
  assert.equal(apres.satisfait, false, "cochable ≠ coché : il reste à le faire");

  // Et une coche sur un point verrouillé ne le rend PAS satisfait à l'écran.
  const force = evaluerProgression(froides(3), { coches: ["p10-art50"] }).paliers[0].points.find(
    (c) => c.id === "p10-art50"
  )!;
  assert.ok(force.bloquePar.length > 0, "le verrou tient même si l'identifiant traîne dans les réglages");
});

test("le palier 10 attrape le cas où la boucle ne remonte pas", () => {
  /**
   * Dix appels composés dont AUCUN n'a écrit de résultat : soit personne n'a
   * décroché, soit l'agent n'écrit rien dans la fiche. C'est exactement ce que
   * ce palier existe pour trancher — et c'est le bug qui rendrait tout le
   * reste invisible.
   */
  const muets = Array.from({ length: 10 }, (_, i) => fiche(`muet-${i}`, [appel(27, "sans-reponse")]));
  const p = evaluerProgression(muets);

  const composes = p.paliers[0].points.find((c) => c.id === "p10-composes")!;
  const retour = p.paliers[0].points.find((c) => c.id === "p10-retour")!;
  assert.equal(composes.satisfait, true, "10 appels ont bien été composés");
  assert.equal(retour.satisfait, false, "mais aucun résultat n'est revenu");
  assert.equal(p.paliers[0].etat, "en-cours", "le palier ne peut donc pas être validé");
  assert.match(p.paliers[0].prochainGeste, /résultat/i);
});

test("le palier 100 refuse un taux fragile — un échantillon n'est pas une mesure", () => {
  // 12 appels, 4 décrochés : un taux existe, mais il ne tient pas debout.
  const petits = Array.from({ length: 12 }, (_, i) =>
    fiche(`p-${i}`, [appel(27, i < 4 ? "repondu" : "sans-reponse")])
  );
  const p = evaluerProgression(petits, { valides: ["p10"] });
  const point = p.paliers[1].points.find((c) => c.id === "p100-decroche")!;

  assert.equal(p.tauxDecroche.source, "mesure", "il y a bien une mesure");
  assert.equal(p.tauxDecroche.fragile, true, "mais elle est fragile");
  assert.equal(point.satisfait, false, "un taux fragile ne franchit pas le palier");
});

test("le palier 100 exige qu'un « oui » ait été observé au moins une fois", () => {
  // 40 décrochés, zéro intérêt : le passage de main n'a jamais eu lieu.
  const decroches = Array.from({ length: 40 }, (_, i) => fiche(`d-${i}`, [appel(27, "repondu")]));
  const sansOui = evaluerProgression(decroches, { valides: ["p10"] });
  const point = sansOui.paliers[1].points.find((c) => c.id === "p100-interet")!;
  assert.equal(point.satisfait, false);
  assert.match(point.constat, /aucun intérêt qualifié/i);

  // Un seul suffit à prouver que la chaîne remonte jusqu'à l'humain.
  const avecOui = evaluerProgression([...decroches, fiche("oui", [appel(27, "interesse")])], {
    valides: ["p10"],
  });
  assert.equal(avecOui.paliers[1].points.find((c) => c.id === "p100-interet")!.satisfait, true);
  assert.equal(avecOui.vecu.interesses, 1);
});

test("⚠ un intérêt qualifié compte AUSSI comme un décroché", () => {
  /**
   * `aDecroche` porte cette règle (`lib/call-cadence.ts`) et la calibration
   * l'avait déjà perdue une fois. Si le comptage la reperdait ici, le taux de
   * décroché baisserait à chaque rendez-vous obtenu — la campagne aurait l'air
   * de se dégrader en réussissant.
   */
  const v = vecuAppels([fiche("oui", [appel(27, "interesse")])]);
  assert.equal(v.composes, 1);
  assert.equal(v.decroches, 1, "un intérêt qualifié est un décroché");
  assert.equal(v.interesses, 1);
  assert.equal(v.avecResultat, 1);
});

test("le palier 1 000 refuse de dimensionner sur une hypothèse", () => {
  const decroches = Array.from({ length: 40 }, (_, i) => fiche(`d-${i}`, [appel(27, "sans-reponse")]));
  const p = evaluerProgression(decroches, { valides: ["p10", "p100"], closers: 50 });
  const point = p.paliers[2].points.find((c) => c.id === "p1000-closers")!;

  assert.equal(point.satisfait, false, "50 closers ne suffisent pas si le taux d'intérêt n'est pas mesuré");
  assert.match(point.constat, /non mesuré/i);
});

test("le palier 1 000 arrête une campagne qui brûle sa liste", () => {
  // 30 appels, 5 oppositions = 16,7 % : au-dessus du seuil.
  const fiches = Array.from({ length: 30 }, (_, i) =>
    fiche(`o-${i}`, [appel(27, i < 5 ? "opposition" : "sans-reponse")])
  );
  const p = evaluerProgression(fiches, { valides: ["p10", "p100"] });
  const point = p.paliers[2].points.find((c) => c.id === "p1000-opposition")!;

  assert.ok((p.tauxOpposition.valeur ?? 0) > SEUIL_OPPOSITION);
  assert.equal(point.satisfait, false, "au-delà du seuil, ce n'est plus le marché qui répond");
});

test("un point de contrôle ajouté sans être évalué est FAUX, jamais vrai", () => {
  /**
   * ⚠ Le défaut par défaut. Un point inconnu qui s'afficherait vert
   * laisserait franchir un palier sans rien vérifier — et personne ne le
   * verrait, puisque tout serait au vert.
   */
  const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/paliers-campagne.ts"), "utf8"));
  const i = src.indexOf("default:");
  assert.ok(i > 0, "le switch d'évaluation doit avoir un cas par défaut");
  assert.match(src.slice(i, i + 220), /satisfait:\s*false/, "le défaut doit refuser, jamais accorder");

  // Et chaque point déclaré a bien son évaluation : sinon il serait muet.
  for (const palier of PALIERS_CAMPAGNE) {
    for (const pt of palier.points) {
      assert.ok(src.includes(`"${pt.id}"`), `le point ${pt.id} est déclaré mais jamais évalué`);
    }
  }
});

test("aucun palier ne se valide tout seul, même tout vert", () => {
  const bons = Array.from({ length: 10 }, (_, i) => fiche(`b-${i}`, [appel(27, "repondu")]));
  const p = evaluerProgression(bons, { coches: ["p10-art50", "p10-cdr", "p10-fish"] });

  assert.equal(p.paliers[0].etat, "pret", "tout est vérifié…");
  assert.notEqual(p.paliers[0].etat, "valide", "…mais la validation reste un geste humain");
  assert.equal(p.plafond, 10, "et le plafond ne bouge pas tant que ce geste n'est pas fait");
  assert.match(p.paliers[0].prochainGeste, /Valide le palier/);

  // Le palier suivant reste verrouillé tant que le précédent n'est pas validé.
  assert.equal(p.paliers[1].etat, "verrouille");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CÂBLAGE — une garde juste, câblée nulle part, ne protège de rien.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ l'écran de contrôle ET le cron appliquent le plafond, pas seulement l'écran", () => {
  const ecran = sansCommentaires(readFileSync(join(process.cwd(), "app/(app)/controle/page.tsx"), "utf8"));
  assert.match(ecran, /plafondPalierCampagne\(/, "l'écran doit dériver son plafond du même module");
  assert.match(ecran, /buildCampaignRun\(prospects, \{[^}]*plafondPalier/, "et le passer à la file");

  const cron = sansCommentaires(readFileSync(join(process.cwd(), "app/api/campaign/tick/route.ts"), "utf8"));
  assert.match(cron, /CAMPAIGN_PALIER/, "l'autopilote serveur doit être borné lui aussi");
  assert.match(cron, /buildCampaignRun\(prospects, \{[^}]*plafondPalier/);

  /**
   * ⚠ La valeur par défaut est le plafond le PLUS BAS. Une variable absente,
   * mal orthographiée ou vide ne doit jamais valoir « pas de plafond » : ce
   * serait 1 000 appels réels sur une faute de frappe.
   *
   * ⚠⚠ Le contrôle est BORNÉ à la déclaration de `plafondPalier`. Une
   * première version cherchait le motif dans tout le fichier : la mutation
   * « repli à null » a survécu, parce que la même expression apparaît aussi
   * dans le GET de statut. Un test qui cherche une chaîne quelque part dans un
   * fichier ne teste rien — c'est la deuxième fois cette session.
   */
  const iDecl = cron.indexOf("const plafondPalier =");
  assert.ok(iDecl > 0, "le cron doit déclarer son plafond de palier");
  const decl = cron.slice(iDecl, cron.indexOf(";", iDecl));
  assert.match(decl, /PALIERS_CAMPAGNE\[0\]\.appels/, "le repli doit être le premier palier, pas null");
  assert.ok(!/\?\?\s*null/.test(decl), "aucun repli ne doit valoir « pas de plafond »");
});

test("⚠ les taux s'écrivent en FRANÇAIS, et le formatage n'existe qu'une fois", () => {
  /**
   * Constaté à l'écran : la salle de contrôle affichait « Décroché : 66.7 % ».
   * Séparateur anglais, dans une application dont toute l'interface est en
   * français, sur un chiffre que l'opérateur montre à ses prospects.
   */
  const decroches = Array.from({ length: 3 }, (_, i) =>
    fiche(`t-${i}`, [appel(27, i < 2 ? "repondu" : "sans-reponse")])
  );
  const p = evaluerProgression(decroches);
  assert.match(p.tauxDecroche.phrase, /66,7 %/, "virgule décimale, pas point");
  assert.ok(!/\d\.\d/.test(p.tauxDecroche.phrase), "aucun séparateur anglais ne doit subsister");

  /**
   * ⚠ Et le formatage ne doit exister qu'à UN endroit. Il était défini deux
   * fois — `lib/calibration.ts` et `lib/paliers-campagne.ts` — pour le même
   * nombre. Deux écritures divergent toujours d'une décimale ou d'une espace,
   * et l'écran finit par donner deux valeurs pour la même mesure.
   */
  const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/paliers-campagne.ts"), "utf8"));
  assert.ok(!/const pct\s*=/.test(src), "le module des paliers doit IMPORTER le formatage, pas le redéfinir");
  assert.match(src, /import \{[^}]*\bpct\b[^}]*\} from "\.\/calibration"/);
});

test("⚠ la capacité d'appels est AFFICHÉE, pas seulement calculée", () => {
  /**
   * `lib/capacite-appels.ts` répond à « combien d'appels je peux passer
   * aujourd'hui » — c'est le chiffre qui décide du dimensionnement, et il
   * n'était affiché NULLE PART. Un module juste que personne ne lit ne pilote
   * rien : c'est le défaut récurrent de ce dépôt, commis dans notre propre
   * code et attrapé par l'audit des exports orphelins.
   */
  const src = sansCommentaires(readFileSync(join(process.cwd(), "components/controle/paliers-panel.tsx"), "utf8"));
  assert.match(src, /capaciteAppels\(/, "l'écran doit dériver la capacité, pas la deviner");
  assert.match(src, /capacite\.appelsParJour/, "et l'afficher");
  assert.match(src, /capacite\.pourquoi/, "avec la raison — un chiffre nu ne dit pas quoi corriger");

  /**
   * ⚠ Il doit la dériver des taux MESURÉS. Passer une hypothèse en dur
   * afficherait un volume que rien ne soutient — et c'est exactement ce que
   * les paliers existent pour empêcher.
   */
  assert.match(src, /progression\.tauxDecroche\.valeur/);
  assert.match(src, /progression\.tauxInteret\.valeur/);
  assert.ok(
    !/tauxDecrochePct:\s*30/.test(src),
    "aucun taux d'hypothèse ne doit être écrit en dur dans l'écran"
  );
});

test("le budget d'un palier est une fourchette, et ne sort que du serveur", () => {
  const budgets = budgetPaliers();
  assert.equal(budgets.length, PALIERS_CAMPAGNE.length);

  for (const b of budgets) {
    assert.ok(b.cout.haut > b.cout.bas, `${b.id} : la borne haute doit dépasser la basse tant que Telnyx est supposé`);
    assert.equal(b.cout.fourchetteOuverte, true);
    assert.match(b.cout.phrase, /CDR/, "la phrase doit dire ce qui refermerait la fourchette");
  }

  // Le coût croît avec le volume — un palier plus grand ne peut pas coûter moins.
  for (let i = 1; i < budgets.length; i++) {
    assert.ok(budgets[i].cout.bas > budgets[i - 1].cout.bas);
  }

  /**
   * ⚠ `lib/voice-costs.ts` porte nos marges ligne à ligne, et `_next/static/**`
   * est téléchargeable par n'importe qui. Le calcul vit donc dans un module
   * que seule une route serveur importe — `tests/vitrine-fuite.test.ts` a
   * attrapé la fuite le jour où le panneau a voulu afficher un budget.
   */
  const panneau = readFileSync(join(process.cwd(), "components/controle/paliers-panel.tsx"), "utf8");
  assert.ok(!/voice-costs|paliers-campagne-cout/.test(panneau), "aucun coût ne doit partir dans le bundle client");
});
