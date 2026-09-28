import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estTentativeAuto, etatMoniteur, type EntreeMoniteur } from "../lib/moniteur";
import { appendCallAttempt } from "../lib/campaign-tick";
import { RESULTATS_MANUELS } from "../lib/call-outcome";
import { prospectDefaults } from "../lib/seed";
import type { Prospect, TimelineEvent } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MONITEUR — il regarde le SERVEUR, et il ne doit jamais rassurer à tort.
 *
 * Un écran de supervision a un mode de panne qui lui est propre : afficher du
 * calme. Zéro appel parce que rien ne tourne, zéro appel parce qu'on ne voit
 * rien, et zéro appel parce que tout va bien s'affichent pareil — et les trois
 * demandent des gestes opposés.
 * ─────────────────────────────────────────────────────────────────────
 */

const MAINTENANT = new Date("2026-09-09T15:00:00.000Z");

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Le texte réellement écrit par l'app pour un résultat d'appel.
 *
 * ⚠ Jamais inventé ici : `RESULTATS_MANUELS` est la SEULE source du texte
 * écrit à la main. Un résumé recopié dans un test se décorrélerait de ce que
 * l'app produit, et le test continuerait de passer pendant que la lecture
 * réelle casse.
 *
 * ⚠⚠ On indexe par CLÉ, pas par `lecture` : deux résultats différents
 * (« à rappeler » et « pas intéressé ») partagent la lecture `repondu`, et
 * c'est justement leur DIFFÉRENCE qu'on teste ici.
 */
const resume = (cle: keyof typeof RESULTATS_MANUELS): string => RESULTATS_MANUELS[cle].summary;

const fiche = (id: string, events: TimelineEvent[] = []): Prospect =>
  ({ ...prospectDefaults, id, company: `Test ${id}`, events, createdAt: "", updatedAt: "" }) as Prospect;

/** Un événement écrit par le ROBOT — via la vraie fonction, jamais à la main. */
const auto = (quand: Date, summary?: string): TimelineEvent => {
  const ev = appendCallAttempt(fiche("x"), quand).events![0];
  return summary ? { ...ev, summary } : ev;
};

/** Un appel consigné par l'HUMAIN. */
const manuel = (id: string, cle: keyof typeof RESULTATS_MANUELS, quand = MAINTENANT): TimelineEvent =>
  ({ id, kind: "appel", date: quand.toISOString(), summary: resume(cle) }) as TimelineEvent;

const BASE: EntreeMoniteur = {
  prospects: [],
  autopilote: "arme",
  fenetre: null,
  fileAttente: null,
  plafondPalier: null,
  composesTotal: null,
  maintenant: MAINTENANT,
};

// ═══════════ NE JAMAIS RASSURER À TORT ═══════════

test("⚠ « JE NE VOIS RIEN » N'EST PAS « IL N'Y A RIEN »", () => {
  /**
   * ⚠ LE MODE DE PANNE PROPRE AUX ÉCRANS DE SUPERVISION.
   *
   * Supabase absent, lecture en échec : le serveur est AVEUGLE. Rendre `0`
   * afficherait quatre compteurs calmes et un écran vert sur une machine qui
   * ne voit rien — et on n'y reviendrait pas de la journée.
   *
   * Mutation vérifiée : remplacer `prospects: null` par `[]` dans la route
   * fait tomber ce test.
   */
  const aveugle = etatMoniteur({ ...BASE, prospects: null });
  assert.equal(aveugle.source, "aucune");
  assert.equal(aveugle.tentativesDuJour, null, "un 0 se lirait comme un résultat");
  assert.equal(aveugle.sansResultat, null);
  assert.equal(aveugle.ontRepondu, null);
  assert.ok(aveugle.angleMort && aveugle.angleMort.length > 60, "l'angle mort doit se DIRE");
});

test("une table VIDE se distingue d'une table qu'on ne lit pas", () => {
  // Les deux méritent une phrase, mais pas la même : ici on voit, et il n'y a
  // rien. Le geste qui suit (synchroniser) n'est pas celui d'une panne.
  const vide = etatMoniteur({ ...BASE, prospects: [] });
  assert.equal(vide.source, "serveur");
  assert.equal(vide.tentativesDuJour, 0, "on VOIT, donc on peut compter");
  assert.ok(vide.angleMort?.includes("vide"), "…mais on ne laisse pas lire ça comme « tout va bien »");
});

// ═══════════ LE ROBOT N'EST PAS L'HUMAIN ═══════════

test("⚠ SEULES LES TENTATIVES DU ROBOT COMPTENT COMME TRAVAIL DE LA MACHINE", () => {
  /**
   * ⚠ Sans cette distinction, l'écran annoncerait « la machine a passé
   * 3 appels » un jour où l'opérateur en a passé 3 à la main et le cron aucun.
   * On croirait l'autopilote en marche alors qu'il n'a jamais démarré —
   * exactement la panne silencieuse que cet écran existe pour rendre visible.
   *
   * Mutation vérifiée : compter tous les `kind === "appel"` fait tomber ce test.
   */
  const etat = etatMoniteur({
    ...BASE,
    prospects: [
      fiche("a", [auto(MAINTENANT)]),
      fiche("b", [manuel("m1", "messagerie"), manuel("m2", "rappeler")]),
    ],
  });
  assert.equal(etat.tentativesDuJour, 1, "un seul appel automatique — les deux autres sont humains");
});

test("⚠ LE MONITEUR ET LE ROBOT DOIVENT S'ACCORDER SUR CE QU'EST UNE TENTATIVE", () => {
  /**
   * ⚠ LA GARDE LA PLUS IMPORTANTE DU FICHIER, et elle protège d'une panne
   * totalement muette.
   *
   * `estTentativeAuto` reconnaît les événements écrits par `appendCallAttempt`
   * à leur préfixe d'identifiant. Ce sont DEUX fichiers différents : le jour où
   * quelqu'un change le format d'identifiant dans `campaign-tick`, le moniteur
   * tombe à zéro et n'affiche plus AUCUN appel — sans erreur, sans exception,
   * sans rien. L'écran dirait « la machine ne fait rien » pendant qu'elle
   * appelle.
   *
   * On ne compare donc pas à une chaîne écrite ici : on fabrique l'événement
   * avec la vraie fonction du robot.
   *
   * Mutation vérifiée : changer le préfixe dans `campaign-tick.ts` fait tomber
   * ce test.
   */
  const ev = appendCallAttempt(fiche("z")).events![0];
  assert.ok(estTentativeAuto(ev), "le moniteur ne reconnaît plus ce que le robot écrit");
});

test("un appel composé dont le résultat n'est pas revenu n'est ni un succès ni un échec", () => {
  // La marque « en attente du résultat » est posée par le robot au moment de
  // composer. Compter ces lignes comme des décrochés ou des refus serait
  // inventer un résultat qui n'existe pas encore.
  const etat = etatMoniteur({ ...BASE, prospects: [fiche("a", [auto(MAINTENANT)])] });
  assert.equal(etat.sansResultat, 1);
  assert.equal(etat.ontRepondu, 0);
  assert.deepEqual(etat.demandentUneMain, []);
});

// ═══════════ QUI RÉVEILLE UN HUMAIN ═══════════

test("⚠ SEUL UN INTÉRÊT QUALIFIÉ MOBILISE QUELQU'UN", () => {
  /**
   * La doctrine, mot pour mot : « Un "non" ou un "rappelez-moi" se traite et
   * se consigne SANS mobiliser personne. » Avant, les quatre résultats « il a
   * décroché » réveillaient un closer — un refus coûtait autant qu'un RDV, et
   * c'est ce qui rendait le volume impossible.
   *
   * Mutation vérifiée : remonter tous les décrochés dans `demandentUneMain`
   * fait tomber ce test.
   */
  const etat = etatMoniteur({
    ...BASE,
    prospects: [
      fiche("oui", [auto(MAINTENANT), manuel("r1", "rdv")]),
      fiche("non", [auto(MAINTENANT), manuel("r2", "non")]),
      fiche("plus-tard", [auto(MAINTENANT), manuel("r3", "rappeler")]),
    ],
  });

  const mains = etat.demandentUneMain.map((f) => f.id);
  assert.deepEqual(mains, ["oui"], "un refus et un « rappelez-moi » ne réveillent personne");
  assert.ok(etat.ontRepondu !== null && etat.ontRepondu >= 1, "…mais ils comptent bien comme des réponses");
});

test("aucune coordonnée ne sort du moniteur", () => {
  /**
   * Un écran de supervision n'a pas besoin de savoir comment joindre
   * quelqu'un pour dire qu'il faut le joindre. La fiche s'ouvre derrière le
   * contrôle d'accès habituel, et c'est là qu'on appelle.
   */
  const p = fiche("oui", [manuel("r1", "rdv")]);
  const avecCoordonnees = { ...p, phone: "0639985678", email: "x@example.com" } as Prospect;
  const etat = etatMoniteur({ ...BASE, prospects: [avecCoordonnees] });

  const rendu = JSON.stringify(etat.demandentUneMain);
  assert.ok(!rendu.includes("0639985678"), "aucun téléphone");
  assert.ok(!rendu.includes("@"), "aucune adresse");
});

// ═══════════ LE CÂBLAGE ═══════════

test("⚠ L'ÉCRAN LIT LE SERVEUR, ET SURTOUT PAS LE STORE LOCAL", () => {
  /**
   * ⚠ C'EST TOUTE LA RAISON D'ÊTRE DE CET ÉCRAN.
   *
   * L'app est local-first : le store vit dans le `localStorage` de CE
   * navigateur. L'autopilote, lui, tourne sur le serveur. Un moniteur branché
   * sur `useAlpha` afficherait donc zéro appel pendant que le cron en passe
   * quarante — et il aurait l'air parfaitement fonctionnel.
   *
   * C'est le réflexe naturel dans ce dépôt (tous les autres écrans font ça),
   * donc c'est exactement ce qu'un test doit interdire.
   */
  /**
   * ⚠ Commentaires retirés d'abord. Le commentaire d'en-tête de l'écran
   * EXPLIQUE pourquoi il n'utilise pas `useAlpha` — et faisait donc tomber ce
   * test en citant le nom qu'il interdit. Effacer l'explication pour faire
   * passer le test aurait été le pire des deux : on garde la raison écrite, et
   * on ne contrôle que le code exécuté.
   */
  const src = sansCommentaires(readFileSync(join(process.cwd(), "app/(app)/moniteur/page.tsx"), "utf8"));
  assert.ok(!/useAlpha/.test(src), "le moniteur ne doit JAMAIS lire le store local");
  assert.match(src, /fetch\("\/api\/moniteur"\)/, "il doit interroger le serveur");
});

test("l'autopilote se déduit du SERVEUR, jamais d'un réglage de navigateur", () => {
  /**
   * Un réglage du navigateur ne dit rien de ce que le cron fait : c'est la
   * même erreur que l'écran de connexion qui ne se fermait que sur un réglage
   * local. Ici, l'état vient des variables d'environnement du serveur.
   *
   * Et on vérifie la présence du secret, jamais sa valeur — un moniteur n'a
   * pas besoin de connaître un secret pour dire s'il est posé.
   */
  const route = readFileSync(join(process.cwd(), "app/api/moniteur/route.ts"), "utf8");
  assert.match(route, /process\.env\.CAMPAIGN_AUTOPILOT/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  // Le secret ne doit jamais être renvoyé au client.
  assert.ok(
    !/CRON_SECRET[^\n]*(?:json|return NextResponse)/i.test(route),
    "le secret ne doit jamais quitter le serveur"
  );
});

test("⚠ LA ROUTE NE TRAHIT PAS LE MODULE : aveugle ⇒ null, jamais une liste vide", () => {
  /**
   * ⚠ CE TEST EST NÉ D'UNE MUTATION QUI A SURVÉCU.
   *
   * Le module distingue parfaitement « je ne vois rien » de « il n'y a rien ».
   * Mais remplacer `prospects: null` par `prospects: []` dans UN des deux
   * chemins aveugles de la route ne faisait tomber aucun test : le module
   * était couvert, son appelant ne l'était pas. L'écran serait alors passé
   * au calme sur une base injoignable — exactement ce que tout ce fichier
   * cherche à empêcher.
   *
   * La route n'est pas exécutable ici (il lui faut Supabase et le runtime
   * Next) : on tient donc la STRUCTURE — une seule construction de la réponse
   * aveugle, et aucune liste vide écrite à la main.
   */
  const route = sansCommentaires(readFileSync(join(process.cwd(), "app/api/moniteur/route.ts"), "utf8"));

  assert.match(route, /prospects:\s*null/, "la réponse aveugle doit passer null");
  assert.ok(
    !/prospects:\s*\[\]/.test(route),
    "une liste vide dans la route ferait lire « rien à faire » sur un serveur qui ne voit rien"
  );

  // Et une SEULE construction : deux chemins aveugles qui se recopient, c'est
  // l'occasion pour l'un des deux de dériver — c'est déjà arrivé ici.
  const constructions = [...route.matchAll(/prospects:\s*null/g)].length;
  assert.equal(constructions, 1, "la réponse aveugle ne doit s'écrire qu'à un seul endroit");
  assert.ok(
    [...route.matchAll(/aveugle\(/g)].length >= 3,
    "…et être appelée par chacun des chemins aveugles"
  );
});

test("les trois états de l'autopilote portent chacun leur phrase", () => {
  // « Éteint » et « en simulation » ne veulent pas dire la même chose, et
  // aucun des deux ne veut dire « en panne ». Sans la phrase, on lit un point
  // de couleur et on suppose.
  for (const a of ["arme", "simulation", "non-configure"] as const) {
    const e = etatMoniteur({ ...BASE, autopilote: a });
    assert.ok(e.phraseAutopilote.length > 30, `« ${a} » doit s'expliquer`);
  }
  assert.match(etatMoniteur({ ...BASE, autopilote: "simulation" }).phraseAutopilote, /CAMPAIGN_AUTOPILOT/);
});
