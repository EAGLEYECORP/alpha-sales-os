import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ligneRdv, planifierSyncRdv, rdvDepuisLigne, versionRdv } from "../lib/sync-meetings";
import { PLANCHER_EFFACEMENT, PROPRIETAIRE_OPERATEUR, type EmpreinteServeur } from "../lib/sync-prospects";
import type { Meeting } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SYNCHRO DES RENDEZ-VOUS — le maillon qui n'existait pas, et dont
 * l'absence répondait 200.
 *
 * `meetings` était LUE par `/api/calendar` (le flux iCal auquel l'opérateur
 * abonne son agenda) et par `/api/push/tick` (la notification du matin), et
 * ÉCRITE PAR PERSONNE. Le moteur de synchro ne poussait que des `Prospect[]`.
 *
 * Aucun test ne pouvait le voir : chaque module était juste, et la chaîne ne
 * se refermait pas. L'agenda partagé servait un calendrier vide, la notif du
 * matin n'annonçait aucun rendez-vous, et les deux routes rendaient 200. Un
 * agenda vide se lit comme une journée libre.
 * ─────────────────────────────────────────────────────────────────────
 */

const rdv = (over: Partial<Meeting> = {}): Meeting => ({
  id: "m1",
  prospectId: "p1",
  title: "Cadrage",
  date: "2026-09-15T09:00:00.000Z",
  durationMin: 45,
  kind: "demo",
  channel: "physique",
  location: "Lyon 6e",
  reminded: false,
  done: false,
  ...over,
});

test("versionRdv — change quand le rendez-vous change, et SEULEMENT alors", () => {
  const m = rdv();
  assert.equal(versionRdv(m), versionRdv(rdv()), "même contenu ⇒ même version, sinon on repousse tout à chaque synchro");

  // Chacun de ces champs doit bouger l'empreinte : ce sont ceux qui décident de
  // ce que l'agenda affiche et de ce que la notification annonce.
  for (const [champ, valeur] of [
    ["date", "2026-09-16T09:00:00.000Z"],
    ["title", "Closing"],
    ["durationMin", 90],
    ["location", "Villeurbanne"],
    ["done", true],
    ["outcome", "reporté"],
  ] as const) {
    assert.notEqual(
      versionRdv({ ...m, [champ]: valeur } as Meeting),
      versionRdv(m),
      `« ${champ} » doit changer la version, sinon la modification ne part jamais au serveur`
    );
  }
});

test("⚠ versionRdv n'est PAS un JSON.stringify de l'objet", () => {
  /**
   * Deux raisons, et la seconde est celle qui compte :
   *  · l'ordre des clés d'un objet n'est pas garanti stable entre deux
   *    versions du code — une empreinte qui bouge sans que rien ne bouge
   *    renvoie TOUT l'agenda à chaque synchro ;
   *  · un champ ajouté demain entrerait dans l'empreinte sans que personne ne
   *    l'ait décidé. Énumérés, l'ajouter est un geste visible dans un diff.
   */
  const src = readFileSync(join(process.cwd(), "lib/sync-meetings.ts"), "utf8");
  assert.doesNotMatch(
    src.replace(/\/\*[\s\S]*?\*\//g, ""),
    /JSON\.stringify/,
    "les champs de l'empreinte s'énumèrent, ils ne se sérialisent pas en bloc"
  );
});

test("aller-retour — un rendez-vous écrit ressort intact", () => {
  const m = rdv({ id: "m-ar", outcome: "RDV tenu" });
  const ligne = ligneRdv(m);

  assert.equal(ligne.id, m.id, "l'identifiant en colonne : c'est la clé de l'upsert");
  assert.equal(ligne.proprietaire, PROPRIETAIRE_OPERATEUR, "sans propriétaire, la lecture cloisonnée ne voit rien");
  assert.equal(ligne.version, versionRdv(m), "la version est STOCKÉE : le serveur doit rendre ses empreintes sans déplier le jsonb");
  assert.deepEqual(rdvDepuisLigne(ligne), m, "l'aller-retour doit être l'identité");
});

test("aller-retour — une ligne abîmée est IGNORÉE, elle ne vide pas l'agenda", () => {
  /**
   * ⚠ Le choix a un sens opérationnel : un calendrier amputé d'un rendez-vous
   * se remarque, un calendrier vide se lit comme une journée libre. Jeter ici
   * ferait perdre tous les rendez-vous sains du même lot.
   */
  assert.equal(rdvDepuisLigne(null), null);
  assert.equal(rdvDepuisLigne({}), null, "pas de colonne data");
  assert.equal(rdvDepuisLigne({ data: { id: "m1" } }), null, "sans date, le flux iCal ne sait pas où le poser");
  assert.equal(rdvDepuisLigne({ data: { id: " ", date: "2026-01-01" } }), null);
});

test("planifierSyncRdv — n'envoie que ce qui a changé", () => {
  const a = rdv({ id: "a" });
  const b = rdv({ id: "b", title: "Visite" });
  const serveur: EmpreinteServeur[] = [
    { id: "a", maj: versionRdv(a) },
    { id: "b", maj: "empreinte-perimee" },
    { id: "c", maj: "supprime-en-local" },
  ];

  const p = planifierSyncRdv([a, b], serveur);
  assert.deepEqual(p.aEcrire.map((m) => m.id), ["b"], "seul le modifié part");
  assert.deepEqual(p.aSupprimer, ["c"], "ce qui n'est plus local se supprime côté serveur");
  assert.equal(p.inchangees, 1);
});

test("⚠ planifierSyncRdv garde le MÊME garde-fou d'effacement massif que les fiches", () => {
  /**
   * Un navigateur qui a perdu son store ne doit pas vider l'agenda du serveur.
   * Le garde-fou n'est pas recopié : les deux passent par `planifier`, et
   * c'est tout l'intérêt — deux seuils à tenir d'accord auraient divergé au
   * premier ajustement.
   */
  const serveur: EmpreinteServeur[] = Array.from({ length: PLANCHER_EFFACEMENT + 5 }, (_, i) => ({
    id: `m${i}`,
    maj: "x",
  }));
  const p = planifierSyncRdv([], serveur);
  assert.equal(p.effacementMassif, true, "tout supprimer depuis un store vide doit s'arrêter pour demander");
  assert.match(p.resume, /rendez-vous/, "le résumé doit nommer ce qu'il s'apprête à supprimer");

  // Et il ne se déclenche PAS sur un petit agenda : sinon on demande
  // confirmation à chaque nettoyage normal et l'opérateur clique sans lire.
  const petit = planifierSyncRdv([], [{ id: "m1", maj: "x" }]);
  assert.equal(petit.effacementMassif, false);
});

test("⚠ la route de synchro des RDV filtre par propriétaire — lecture ET suppression", () => {
  /**
   * Elle est EXEMPTÉE du garde « aucune lecture directe » (`lecture-serveur.test.ts`)
   * parce qu'elle lit `id, version` pour rendre des empreintes, pas des
   * rendez-vous. L'exemption dit « elle porte quand même le filtre de
   * propriétaire, et un test le vérifie » — c'est celui-ci. Une justification
   * d'exemption qui s'appuie sur un test inexistant est exactement le genre de
   * phrase que ce dépôt refuse.
   */
  const src = readFileSync(join(process.cwd(), "app/api/sync/meetings/route.ts"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    ""
  );
  const filtres = src.match(/\.eq\(\s*["']proprietaire["']/g) ?? [];
  assert.ok(
    filtres.length >= 2,
    `le filtre de propriétaire doit border la lecture ET la suppression (${filtres.length} trouvé(s))`
  );
  assert.match(src, /from\(\s*["']meetings["']\s*\)[\s\S]{0,120}?\.delete\(\)/, "la suppression doit viser `meetings`");
});

test("⚠ la migration 006 pose la cloison AVANT que le chemin d'écriture ne serve", () => {
  /**
   * L'ordre est la moitié du correctif. Remplir `meetings` sans la colonne
   * `proprietaire` aurait rendu le trou UTILE au lieu de le refermer : une
   * table pleine que le service role lit sans distinction de locataire.
   */
  const mig = readFileSync(join(process.cwd(), "supabase/migrations/006-rendez-vous-cloisonnes.sql"), "utf8");
  assert.match(mig, /alter table public\.meetings add column proprietaire/, "la colonne de cloisonnement");
  assert.match(mig, /alter table public\.meetings add column version/, "la colonne d'empreinte");
  assert.match(mig, /alter column user_id drop not null/, "sans ça le service role ne peut rien insérer");
  assert.match(mig, /create index if not exists meetings_proprietaire_idx/, "sinon chaque tick balaie la table");
  assert.match(mig, /information_schema\.columns/, "les ALTER doivent être conditionnels (idempotence)");
  assert.ok(mig.includes("begin;") && mig.includes("commit;"), "la migration doit être transactionnelle");
});

test("⚠ le moteur de synchro pousse les RDV — sinon l'agenda reste vide en silence", () => {
  /**
   * LE TEST QUI COMPTE, et le seul qui aurait vu le défaut d'origine. Les
   * modules ci-dessus peuvent tous être justes pendant que personne ne les
   * appelle : c'est exactement l'état dans lequel le dépôt était.
   */
  const src = readFileSync(join(process.cwd(), "components/sync-moteur.tsx"), "utf8");

  /**
   * ⚠⚠ CE TEST A ÉTÉ ÉCRIT FAUX D'ABORD, ET LA MUTATION L'A DIT.
   *
   * Sa première version assertait `match(src, /\/api\/sync\/meetings/)`. J'ai
   * ensuite coupé la poussée réelle — plan vidé, URL de POST changée — et il
   * est resté VERT : la chaîne survivait dans `lireEmpreintesRdv`, qui ne fait
   * que LIRE les empreintes. J'assertais la présence d'un mot, pas l'existence
   * du chemin d'écriture.
   *
   * C'est le piège nommé quatre fois dans `CLAUDE.md` — asserter la PRÉSENCE
   * d'un mécanisme au lieu de la CONDITION qui le produit — et l'écrire dans
   * un commentaire ne suffit visiblement pas à l'éviter.
   *
   * Ce qu'on vérifie maintenant : un POST vers la route des rendez-vous, avec
   * un corps. C'est ça, pousser.
   */
  /**
   * ⚠ ET LES DEUX MOITIÉS S'ÉPINGLENT SÉPARÉMENT. Ma deuxième rédaction
   * cherchait « un POST vers la route des rendez-vous » : en coupant la
   * poussée des ÉCRITURES, le test restait vert parce que celle des
   * SUPPRESSIONS postait encore vers la même URL. Un seul motif couvrait deux
   * chemins dont un seul suffisait à le satisfaire.
   *
   * Écrire et supprimer sont deux capacités distinctes : un agenda qui écrit
   * sans supprimer garde des rendez-vous annulés, un agenda qui supprime sans
   * écrire reste vide. Elles se vérifient une par une.
   */
  const postRdv = (corps: string) =>
    new RegExp(`fetch\\(\\s*["']/api/sync/meetings["'][\\s\\S]{0,320}?JSON\\.stringify\\(\\{\\s*${corps}`);

  assert.match(src, postRdv("ecrire"), "le moteur doit POSTER les rendez-vous à ÉCRIRE — sinon l'agenda reste vide");
  assert.match(src, postRdv("supprimer"), "et ceux à SUPPRIMER — sinon un RDV annulé reste dans l'agenda partagé");
  assert.match(src, /planifierSyncRdv\(\s*meetings\s*,/, "le plan doit porter sur les rendez-vous du store");
  assert.match(src, /s\.meetings/, "il doit lire les rendez-vous du store");

  /**
   * ⚠ Et le minuteur doit DÉPENDRE des rendez-vous. Sans `meetings` dans les
   * dépendances de l'effet, modifier un rendez-vous sans toucher une fiche ne
   * relancerait aucune poussée : la modification resterait dans le navigateur
   * pendant que la carte affiche « à jour ».
   */
  const effet = src.slice(src.indexOf("minuteur.current = setTimeout"));
  const deps = effet.slice(effet.indexOf("}, ["), effet.indexOf("]);") + 3);
  assert.match(deps, /meetings/, "le minuteur doit se relancer quand un rendez-vous change");
});

test("⚠ lireMeetingsBornes CLOISONNE, il ne fait pas que BORNER", () => {
  /**
   * ⚠⚠ CE TEST N'EXISTAIT PAS, ET LA MUTATION L'A RÉVÉLÉ. J'ai retiré le
   * `.eq("proprietaire", …)` de `lireMeetingsBornes` et la suite entière est
   * restée VERTE. Le filtre venait pourtant d'être posé pour refermer
   * `RDV_SANS_CLOISON` : un correctif que rien ne tient se fait défaire par la
   * session suivante, qui croit simplifier une requête.
   *
   * Les deux propriétés sont DISTINCTES et doivent être assertées séparément :
   * borner protège la mémoire du processus, cloisonner protège le locataire
   * d'à côté. Le trou a vécu des semaines précisément parce que la borne
   * présente donnait l'impression que la lecture était tenue.
   */
  const src = readFileSync(join(process.cwd(), "lib/lecture-serveur.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const bloc = src.slice(src.indexOf('from("meetings")'));
  const requete = bloc.slice(0, bloc.indexOf(";"));

  assert.match(requete, /\.eq\(\s*["']proprietaire["']\s*,\s*PROPRIETAIRE_OPERATEUR\s*\)/, "la CLOISON");
  assert.match(requete, /\.limit\(/, "la BORNE");
});

test("⚠ RDV_SANS_CLOISON ne doit plus décrire un trou ouvert", () => {
  /**
   * La constante est servie à l'écran (relevé de pannes d'Alpha CEO) et dans
   * la réponse des routes concernées. Tant qu'elle annonçait « les rendez-vous
   * n'ont pas de colonne propriétaire », elle DÉCRIVAIT le trou ; maintenant
   * qu'il est refermé, la laisser en l'état ferait chercher une panne qui
   * n'existe plus — et, pire, ferait croire qu'on peut se permettre de relire
   * `meetings` sans filtre.
   *
   * Une prose qui dérive du code ne casse rien : elle ment, à l'endroit précis
   * où quelqu'un vient chercher l'état du système.
   */
  const { RDV_SANS_CLOISON } = require("../lib/lecture-serveur") as typeof import("../lib/lecture-serveur");
  assert.doesNotMatch(
    RDV_SANS_CLOISON,
    /n'ont pas de colonne propriétaire|pas cloisonn/i,
    "le trou est refermé (migration 006) — ce message doit décrire l'état actuel, pas l'ancien"
  );
  assert.match(RDV_SANS_CLOISON, /006/, "il doit nommer la migration qui l'a refermé");
});
