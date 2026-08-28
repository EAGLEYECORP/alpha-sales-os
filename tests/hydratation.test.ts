import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chargementComplet,
  etatInitial,
  pages,
  peutSynchroniser,
  phraseListeVide,
  verdictChargement,
  type EtatHydratation,
} from "../lib/hydratation";
import { LOT_MAX, planifierSync } from "../lib/sync-prospects";
import { prospectDefaults } from "../lib/seed";
import type { Prospect } from "../lib/types";

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const fiche = (id: string): Prospect =>
  ({ ...prospectDefaults, id, company: id, updatedAt: "2026-08-28T09:00:00.000Z" }) as Prospect;

const TOUS: EtatHydratation[] = ["locale", "jamais", "en-cours", "chargee", "echec"];

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'INVARIANT : ON NE POUSSE JAMAIS DEPUIS UN ÉTAT QU'ON N'A PAS CHARGÉ.
 *
 * Ce fichier ne teste pas « la fonction rend le bon booléen ». Il teste la
 * conséquence : le jour où `peutSynchroniser` s'assouplit, une poussée partie
 * d'un chargement raté propose la suppression de tout le pipe côté serveur.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ SEULS `locale` et `chargee` autorisent la poussée — la liste est EXHAUSTIVE", () => {
  const autorises = TOUS.filter(peutSynchroniser);
  assert.deepEqual(
    autorises.sort(),
    ["chargee", "locale"],
    "un nouvel état qui autorise la synchro doit être une décision explicite, pas un effet de bord"
  );

  // Les trois qui refusent, nommés un par un : un `switch` mal complété se
  // verrait ici et pas dans un test qui ne compte que les vrais.
  assert.equal(peutSynchroniser("jamais"), false, "rien chargé = rien à comparer");
  assert.equal(peutSynchroniser("en-cours"), false, "un chargement partiel n'est pas le pipe");
  assert.equal(peutSynchroniser("echec"), false, "après un échec, la liste affichée n'est PAS le pipe");
});

/**
 * LA CONSÉQUENCE, CHIFFRÉE. C'est ce test-là qui explique pourquoi le
 * booléen ci-dessus est strict.
 */
test("pousser depuis un chargement raté supprimerait tout le pipe serveur", () => {
  const serveur = Array.from({ length: 400 }, (_, i) => ({ id: `p${i}`, maj: "2026-08-28T09:00:00.000Z" }));
  const plan = planifierSync([], serveur);

  assert.equal(plan.aSupprimer.length, 400, "un navigateur vide propose bien de tout supprimer");
  assert.equal(plan.effacementMassif, true, "le second filet (SEUIL_EFFACEMENT) attrape le cas");

  // Et le premier filet empêche même d'y arriver : après un échec de
  // chargement, on ne construit pas de plan du tout.
  assert.equal(peutSynchroniser("echec"), false);
});

/**
 * ⚠ « Chargement » et « vide » sont deux phrases, parce que ce sont deux
 * gestes : la première fait attendre, la seconde fait importer. Les confondre
 * fait réimporter un fichier par-dessus un pipe qui existe déjà.
 */
test("une liste vide ne dit jamais la même chose selon la raison", () => {
  assert.equal(phraseListeVide("locale"), null, "en mode local, une liste vide est vraiment vide");
  assert.equal(phraseListeVide("chargee"), null, "chargé et vide = vraiment vide");

  const enCours = phraseListeVide("en-cours");
  const jamais = phraseListeVide("jamais");
  const echec = phraseListeVide("echec");
  for (const p of [enCours, jamais, echec]) assert.ok(p && p.length > 20);

  // Trois phrases DISTINCTES : trois situations, trois gestes.
  assert.equal(new Set([enCours, jamais, echec]).size, 3);

  // Celle de l'échec doit interdire les deux gestes qui détruisent.
  assert.match(echec!, /ne réimporte rien/i);
  assert.match(echec!, /ne supprime rien/i);
});

test("les pages couvrent le total exactement, sans page vide ni chevauchement", () => {
  assert.deepEqual(pages(0), [], "zéro fiche = aucune requête");
  assert.deepEqual(pages(5, 200), [{ depuis: 0, taille: 200 }]);

  const p = pages(2_500, 200);
  assert.equal(p.length, 13, "2 500 fiches / 200 = 13 requêtes");
  assert.equal(p[0].depuis, 0);
  assert.equal(p[12].depuis, 2_400, "la dernière page part de 2 400 et sera courte");

  // Aucun trou, aucun doublon.
  for (let i = 1; i < p.length; i++) assert.equal(p[i].depuis, p[i - 1].depuis + p[i - 1].taille);

  // Une taille absurde ne fait pas boucler à l'infini.
  assert.deepEqual(pages(3, 0), [{ depuis: 0, taille: 1 }, { depuis: 1, taille: 1 }, { depuis: 2, taille: 1 }]);
  assert.equal(pages(-10).length, 0);
});

test("la taille de lot est la MÊME dans les deux sens", () => {
  /**
   * Deux tailles différentes pour la même table, c'est deux comportements à
   * déboguer au lieu d'un — et le jour où l'un des deux dépasse la limite de
   * la plateforme, l'autre continue de marcher et masque la cause.
   */
  assert.equal(pages(1_000)[0].taille, LOT_MAX);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA PIRE ERREUR POSSIBLE : RENDRE `chargee` SUR UN CHARGEMENT PARTIEL.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ un chargement partiel ne rend JAMAIS `chargee`", () => {
  const v = verdictChargement(2_499, 2_500);
  assert.equal(v.etat, "echec");
  assert.equal(peutSynchroniser(v.etat), false, "et donc la poussée reste fermée");
  assert.match(v.pourquoi, /2499 fiche\(s\) reçues sur 2500/);
  assert.match(v.pourquoi, /supprimerait les manquantes/, "la raison doit nommer le danger, pas juste l'écart");

  assert.equal(verdictChargement(2_500, 2_500).etat, "chargee");
  assert.equal(verdictChargement(0, 0).etat, "chargee", "un pipe serveur vide est un chargement valide");

  // Une erreur réseau prime sur le comptage : le total annoncé ne veut rien
  // dire si la requête qui le portait a échoué.
  const e = verdictChargement(2_500, 2_500, "HTTP 500");
  assert.equal(e.etat, "echec");
  assert.match(e.pourquoi, /HTTP 500/);
});

test("recevoir PLUS que le total annoncé reste complet", () => {
  // Une fiche insérée entre deux pages : on a tout, et plus encore. Traiter ça
  // comme un échec bloquerait la synchro sur un événement bénin.
  assert.equal(chargementComplet(2_501, 2_500), true);
  assert.equal(chargementComplet(0, -1), false, "un total négatif est une réponse cassée");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉTAT NE SE PERSISTE PAS — et c'est le point le plus fragile du dispositif.
 *
 * Si `chargee` finissait dans le localStorage, le démarrage suivant partirait
 * d'une liste vide AVEC l'autorisation de pousser. Le pipe serveur serait
 * effacé par le simple fait de rouvrir l'onglet.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ l'état de départ se DÉRIVE du réglage, il ne se relit pas du disque", () => {
  assert.equal(etatInitial(false), "locale", "sans pipe serveur, le navigateur fait foi (mode historique)");
  assert.equal(etatInitial(true), "jamais", "avec pipe serveur, rien n'est chargé tant qu'on n'a pas chargé");
  assert.equal(peutSynchroniser(etatInitial(true)), false);
  assert.equal(peutSynchroniser(etatInitial(false)), true, "les installations existantes ne changent pas de comportement");
});

test("le store repasse l'état par `etatInitial` avant d'écrire sur le disque", () => {
  const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/store.ts"), "utf8"));
  const i = src.indexOf("partialize:");
  assert.ok(i > 0, "sans partialize, tout l'état part sur le disque, `chargee` compris");

  /**
   * ⚠ Le contrôle est BORNÉ au bloc `partialize`. Une première version lisait
   * le fichier entier : la mutation « persiste l'état courant » a survécu,
   * parce que `patchSettings` contient lui aussi un `etatInitial(` et suffisait
   * à faire passer le motif. Un test qui cherche une chaîne quelque part dans
   * un fichier de 1 100 lignes ne teste rien.
   */
  const bloc = src.slice(i, i + 400);
  assert.match(
    bloc,
    /hydratationPipe:\s*etatInitial\(/,
    "l'état écrit doit être l'état de DÉPART, jamais l'état courant"
  );
  assert.ok(
    !/hydratationPipe:\s*s\.hydratationPipe/.test(bloc),
    "persister l'état courant rouvrirait la poussée au démarrage suivant, sur une liste vide"
  );
  // Et les fiches ne se persistent plus en mode serveur — c'est tout l'objet.
  assert.match(bloc, /pipeServeur\s*\?\s*\{[^}]*prospects:\s*\[\]/, "en mode pipe serveur, les fiches ne vont pas dans le localStorage");
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA ROUTE — elle doit rendre les fiches ENTIÈRES, paginées, avec le total.
 *
 * Test de source : `tsconfig.test.json` ne compile pas les routes Next (ça
 * tirerait tout le runtime dans node:test). C'est le motif maison, déjà utilisé
 * par `voice-route-garde` et `vitrine-fuite`.
 * ─────────────────────────────────────────────────────────────────────
 */
test("la route rend un TOTAL, sans quoi rien ne peut savoir si le chargement est complet", () => {
  const code = sansCommentaires(readFileSync(join(process.cwd(), "app/api/sync/prospects/route.ts"), "utf8"));

  assert.match(code, /count:\s*"exact"/, "le total doit venir du serveur, pas d'un comptage de pages");
  assert.match(code, /\.range\(/, "sans `range`, Supabase plafonne silencieusement à 1 000 lignes");
  assert.match(code, /total:/, "la réponse doit porter le total");

  /**
   * ⚠ L'ORDRE STABLE. Sans `order`, PostgREST ne garantit rien entre deux
   * requêtes : deux pages peuvent renvoyer la même fiche et en omettre une
   * autre. Le comptage serait juste, le pipe faux — et la synchro suivante
   * proposerait de supprimer les fiches perdues.
   */
  assert.match(code, /\.order\("id"/, "la pagination exige un ordre stable");

  // La taille de page reste bornée : un `?taille=100000` ne doit pas devenir
  // une requête qui fait tomber la fonction serverless.
  assert.match(code, /Math\.min\(LOT_MAX/, "la taille demandée par le client doit être plafonnée");
});

test("le mode empreintes reste intact — c'est lui qui rend la synchro fréquente supportable", () => {
  const code = sansCommentaires(readFileSync(join(process.cwd(), "app/api/sync/prospects/route.ts"), "utf8"));
  assert.match(code, /empreintes/, "la comparaison légère ne doit pas disparaître au profit du chargement lourd");
  // Le chargement complet est OPT-IN par paramètre : l'appel historique, sans
  // paramètre, doit continuer de rendre les empreintes.
  assert.match(code, /searchParams\.get\("fiches"\)/);
});

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CÂBLAGE — une garde juste, câblée nulle part, ne protège de rien.
 * C'est le défaut récurrent de ce dépôt ; ce test le refuse d'avance.
 * ─────────────────────────────────────────────────────────────────────
 */
test("le composant de synchro DEMANDE la permission avant de pousser", () => {
  const code = sansCommentaires(readFileSync(join(process.cwd(), "components/sync-prospects.tsx"), "utf8"));
  assert.match(code, /peutSynchroniser\(/, "la seule réponse à « a-t-on le droit de pousser » doit être appelée ici");

  // Et elle doit être évaluée AVANT la construction du plan : planifier puis
  // vérifier laisserait le plan s'exécuter au prochain minuteur.
  const iPermission = code.indexOf("peutSynchroniser(");
  const iEnvoi = code.indexOf('method: "POST"');
  assert.ok(iPermission > 0 && iEnvoi > 0);
  assert.ok(iPermission < iEnvoi, "la permission se vérifie avant l'envoi, pas après");
});

test("l'hydratation ne réveille pas la synchro sortante en réécrivant les fiches", () => {
  /**
   * ⚠ Si le chargement passait par `upsertProspect`, chaque fiche repartirait
   * avec un `updatedAt` neuf : le navigateur renverrait au serveur les 2 500
   * fiches qu'il vient d'en recevoir, à chaque démarrage. Le store a donc une
   * entrée dédiée qui ne touche NI `updatedAt`, NI le journal d'activité.
   */
  const src = sansCommentaires(readFileSync(join(process.cwd(), "lib/store.ts"), "utf8"));
  const i = src.indexOf("hydraterProspects:");
  assert.ok(i > 0, "le store doit exposer une entrée dédiée à l'hydratation");
  const corps = src.slice(i, i + 900);
  assert.ok(!/updatedAt:\s*new Date/.test(corps), "l'hydratation ne redate aucune fiche");
  assert.ok(!/auditLog/.test(corps), "recevoir son propre pipe n'est pas un événement à journaliser");
});

test("une fiche créée pendant le chargement n'est pas écrasée par le serveur", () => {
  // Vérifié sur la logique de fusion elle-même : le module de synchro sait
  // déjà comparer, ce test garde le CAS, pas l'implémentation.
  const locale = fiche("créée-pendant-le-chargement");
  const serveur = [{ id: "p1", maj: "2026-08-28T09:00:00.000Z" }];
  const plan = planifierSync([locale, fiche("p1")], serveur);
  assert.deepEqual(plan.aSupprimer, [], "rien à supprimer");
  assert.equal(plan.aEcrire.length, 1, "seule la nouvelle part au serveur");
  assert.equal(plan.aEcrire[0].id, "créée-pendant-le-chargement");
});
