import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { elaguer, MAX_LECONS_TERRAIN, leconDObjection } from "../lib/apprentissage";
import type { KnowledgeNote } from "../lib/knowledge";
import { prospect } from "./fixtures";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES LIMITES DE VOLUME — mesurées, pas supposées.
 *
 * Tout le CRM vit dans UN blob localStorage (~5 Mo de quota). Mesuré : 2,9 Ko
 * par fiche réaliste, 0,5 Ko par leçon de terrain. Le mur dur est donc autour
 * de 1 200–1 500 fiches, et la lenteur arrive bien avant — vers 500, quand
 * chaque frappe réécrit tout l'état.
 *
 * Ces tests ne mesurent pas la performance (un test de perf sur une machine
 * de CI ment). Ils verrouillent les GARDE-FOUS qui repoussent le mur, parce
 * qu'ils sont invisibles à la relecture : un plafond retiré ne casse rien
 * aujourd'hui, il casse dans six mois chez l'utilisateur.
 * ─────────────────────────────────────────────────────────────────────
 */

const note = (id: string, source: KnowledgeNote["source"], updatedAt: string): KnowledgeNote => ({
  id,
  title: id,
  body: "corps",
  tags: [],
  createdAt: updatedAt,
  updatedAt,
  source,
});

test("élagage — la mémoire de terrain est plafonnée", () => {
  // Sans plafond : chaque objection et chaque perte écrit une note, rien n'en
  // retire jamais. Elle mange le quota ET fait laguer Alpha Live, qui appelle
  // search() à chaque bribe entendue PENDANT un appel réel.
  const notes = Array.from({ length: MAX_LECONS_TERRAIN + 50 }, (_, i) =>
    note(`t${i}`, "terrain", `2026-01-${String((i % 28) + 1).padStart(2, "0")}`)
  );
  const gardees = elaguer(notes);
  assert.equal(gardees.length, MAX_LECONS_TERRAIN);
});

test("élagage — il ne touche JAMAIS ce que l'humain a écrit", () => {
  // Une mémoire automatique qui supprime le travail de quelqu'un est pire que
  // pas de mémoire du tout.
  const humaines = [
    note("m1", "manuel", "2020-01-01"),
    note("p1", "playbook", "2020-01-01"),
    note("i1", "intel", "2020-01-01"),
  ];
  const terrain = Array.from({ length: MAX_LECONS_TERRAIN + 100 }, (_, i) => note(`t${i}`, "terrain", "2026-06-01"));
  const gardees = elaguer([...humaines, ...terrain]);

  for (const h of humaines) {
    assert.ok(gardees.some((n) => n.id === h.id), `${h.id} (${h.source}) ne doit jamais être élaguée`);
  }
  assert.equal(gardees.filter((n) => n.source === "terrain").length, MAX_LECONS_TERRAIN);
});

test("élagage — ce sont les plus ANCIENNES qui partent", () => {
  const vieilles = Array.from({ length: 10 }, (_, i) => note(`vieux${i}`, "terrain", "2024-01-01"));
  const recentes = Array.from({ length: MAX_LECONS_TERRAIN, }, (_, i) => note(`neuf${i}`, "terrain", "2026-08-01"));
  const gardees = elaguer([...vieilles, ...recentes]);
  assert.equal(gardees.length, MAX_LECONS_TERRAIN);
  assert.equal(gardees.filter((n) => n.id.startsWith("vieux")).length, 0, "les vieilles leçons partent en premier");
});

test("élagage — sous le plafond, rien ne bouge et l'ordre est préservé", () => {
  // Un élagage qui réordonne casserait l'affichage du Cerveau sans raison.
  const notes = [note("a", "terrain", "2026-01-01"), note("b", "manuel", "2026-01-02"), note("c", "terrain", "2026-01-03")];
  assert.deepEqual(elaguer(notes), notes);
});

test("journaux — tous les chemins d'écriture passent par le plafond", () => {
  /**
   * `addActivity` plafonnait à 300 ; quatre autres chemins (changement
   * d'étape, ajout de prescripteur, mise en relation, import) empilaient sans
   * borne. Le plafond dépendait donc de PAR OÙ l'entrée arrivait — et les
   * journaux partagent le quota avec le CRM lui-même.
   *
   * On vérifie qu'aucun `...s.activities` nu ne subsiste : c'est la signature
   * exacte de l'empilement sans plafond.
   */
  const src = readFileSync(join(process.cwd(), "lib/store.ts"), "utf8");
  assert.doesNotMatch(src, /\.\.\.s\.activities,/, "un chemin empile les activités sans plafond");
  assert.match(src, /const pousserActivite/, "le plafond doit vivre à UN seul endroit");
  // Le journal d'audit et le journal du standard aussi.
  assert.doesNotMatch(src, /\.\.\.s\.auditLog\](?!\.slice)/, "l'audit doit rester plafonné");
  assert.match(src, /MAX_JOURS_STANDARD/);
});

test("persistance — l'écriture est différée MAIS vidée avant la fermeture", () => {
  /**
   * Le débounce est ce qui fait sauter la saccade à 500 fiches. Il introduit
   * un risque exact : si l'onglet se ferme pendant le délai, la saisie est
   * perdue — le bug qu'on prétend éviter.
   *
   * `beforeunload` ne se déclenche pas sur iOS. Les deux seuls signaux fiables
   * sont `pagehide` et `visibilitychange`. Ce test existe parce qu'un
   * développeur pressé retirerait l'un des deux en croyant simplifier.
   */
  const src = readFileSync(join(process.cwd(), "lib/store.ts"), "utf8");
  assert.match(src, /export function flushStorage/);
  assert.match(src, /addEventListener\("pagehide", flushStorage\)/, "sans pagehide, iOS perd la dernière saisie");
  assert.match(src, /visibilitychange/, "sans visibilitychange, le passage en arrière-plan perd la saisie");
  // Une lecture doit voir ce qui attend, sinon un rechargement renvoie l'avant.
  assert.match(src, /enAttente\?\.cle === k/);
});

test("autopilote — la troncature à 2 000 prospects ne peut plus être muette", () => {
  // Un autopilote qui ignore une partie du pipe sans le dire est pire qu'un
  // autopilote arrêté : on croit qu'il tourne.
  // La troncature vit désormais dans la lecture partagée : elle était écrite
  // dans le tick, et les trois autres lecteurs ne l'avaient pas.
  const src = readFileSync(join(process.cwd(), "lib/lecture-serveur.ts"), "utf8");
  assert.match(src, /LIMITE_LECTURE \+ 1/, "on lit une de plus pour SAVOIR qu'on tronque");
  assert.match(src, /avertissement/);
  assert.match(src, /tronque,/);
  // Et le tick la remonte au lieu de l'avaler.
  const tick = readFileSync(join(process.cwd(), "app/api/campaign/tick/route.ts"), "utf8");
  assert.match(tick, /lecture\.avertissement/);
});

test("volume — une leçon de terrain reste légère", () => {
  // 0,5 Ko mesuré. Si une leçon se met à porter la fiche entière, le plafond
  // de 400 ne protège plus rien.
  const l = leconDObjection({
    prospect: prospect({ company: "Carrosserie Aldrene", notes: "x".repeat(2000) }),
    objection: "C'est trop cher",
    reponse: "Je lui ai fait chiffrer sa perte.",
    aDebloque: true,
  })!;
  const octets = JSON.stringify(l).length;
  assert.ok(octets < 2000, `une leçon pèse ${octets} octets — elle embarque trop de la fiche`);
});
