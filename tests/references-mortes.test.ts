import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE CONSIGNE QUI DÉSIGNE DU CODE MORT EST PIRE QUE PAS DE CONSIGNE.
 *
 * Ce dépôt tient par ses commentaires : ils portent le POURQUOI, et c'est eux
 * qu'on relit six mois plus tard au lieu de refaire l'enquête. Le prix de ce
 * choix, c'est qu'un commentaire faux se croit sur parole.
 *
 * Deux cas rencontrés, tous les deux coûteux :
 *
 *   · `lib/pricing-briques.ts` promettait un `coutVoixMensuel()` qui n'a
 *     jamais existé. Alpha Voice est donc restée chiffrée sans qu'un seul
 *     appel soit compté, et la ligne qui l'expliquait rassurait le lecteur.
 *   · `app/vitrine/page.tsx` disait « Voir `publicBricks()` dans
 *     lib/bricks.ts ». La fonction avait été SUPPRIMÉE, justement parce
 *     qu'elle faisait fuiter le catalogue. La consigne envoyait donc chercher
 *     une garde retirée pour cause de faille.
 *
 * ── CE QUE CE TEST JUGE, ET CE QU'IL LAISSE PASSER ──
 *
 * Il ne traque PAS toute mention d'une fonction : le dépôt est plein de
 * post-mortems au passé (« il a existé ici un `publicBricks()` »), et ces
 * lignes-là sont la mémoire du projet — les interdire reviendrait à effacer
 * les raisons.
 *
 * Il traque la forme DIRECTIVE au présent : « voir `X()` », « cf. `X()` ».
 * Celle-là est un ordre donné au prochain lecteur, et un ordre qui pointe
 * dans le vide se paie.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();
const DOSSIERS = ["lib", "app", "components"];
const IGNORE = new Set(["node_modules", ".next", ".test-build"]);

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (IGNORE.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...fichiers(p));
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const SOURCES = DOSSIERS.flatMap((d) => fichiers(join(RACINE, d)));

/**
 * Tout ce que le dépôt DÉFINIT. On ratisse large volontairement : un faux
 * négatif (un symbole qu'on croit défini alors qu'il ne l'est pas) ne casse
 * rien, un faux positif fait échouer un build pour une virgule.
 */
const DEFINIS = new Set<string>();
for (const f of [...SOURCES, ...fichiers(join(RACINE, "tests"))]) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/(?:function|const|let|var|class|interface|type)\s+([A-Za-z_$][\w$]*)/g)) {
    DEFINIS.add(m[1]);
  }
  // Méthodes et propriétés-fonctions : `nom(` ou `nom: (` en début de membre.
  for (const m of src.matchAll(/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*(?:\(|[:=]\s*(?:async\s*)?\()/gm)) {
    DEFINIS.add(m[1]);
  }
}

/**
 * Ce qui n'appartient pas au dépôt et n'a donc pas à y être défini :
 * built-ins du langage, API navigateur, hooks React, fonctions de test.
 * La liste est courte à dessein — chaque ajout doit être un VRAI extérieur,
 * pas un moyen de faire taire le test.
 */
const EXTERIEURS = new Set([
  "require", "fetch", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "parseInt", "parseFloat", "isNaN", "encodeURIComponent", "decodeURIComponent",
  "structuredClone", "queueMicrotask", "atob", "btoa", "alert", "confirm", "prompt",
  "useState", "useEffect", "useMemo", "useCallback", "useRef", "useReducer",
  "describe", "it", "test", "expect", "assert",
]);

/** La forme qui fait mal : un ordre au présent qui nomme une fonction. */
const DIRECTIVE = /(?:\bvoir\b|\bVoir\b|\bcf\.|\bsee\b|\bSee\b)[^`\n]{0,80}`([A-Za-z_$][\w$]*)\(\)`/g;

/** Les lignes de commentaire d'un fichier, sans le code autour. */
function commentaires(src: string): string {
  const lignes: string[] = [];
  let dansBloc = false;
  for (const ligne of src.split("\n")) {
    const t = ligne.trim();
    if (dansBloc) {
      lignes.push(ligne);
      if (t.includes("*/")) dansBloc = false;
      continue;
    }
    if (t.startsWith("/*")) {
      lignes.push(ligne);
      if (!t.includes("*/")) dansBloc = true;
      continue;
    }
    if (t.startsWith("//")) lignes.push(ligne);
  }
  return lignes.join("\n");
}

test("⚠ aucune consigne ne renvoie à une fonction qui n'existe pas", () => {
  const morts: string[] = [];

  for (const f of SOURCES) {
    const src = readFileSync(f, "utf8");
    const zone = commentaires(src);
    for (const m of zone.matchAll(DIRECTIVE)) {
      const nom = m[1];
      if (EXTERIEURS.has(nom) || DEFINIS.has(nom)) continue;
      morts.push(`${relative(RACINE, f)} → \`${nom}()\``);
    }
  }

  assert.deepEqual(
    morts,
    [],
    "des commentaires envoient le lecteur vers du code qui n'existe pas :\n  " + morts.join("\n  ")
  );
});

test("le détecteur mord vraiment — sinon il ne prouve rien", () => {
  /**
   * Un test de forme qui ne s'est jamais vu échouer est une décoration. On
   * rejoue ici les DEUX défauts réels sur une source fabriquée, plus les deux
   * formulations qu'il ne faut PAS interdire.
   */
  const attrape = (texte: string) => {
    const zone = commentaires(texte);
    return [...zone.matchAll(DIRECTIVE)].map((m) => m[1]).filter((n) => !EXTERIEURS.has(n) && !DEFINIS.has(n));
  };

  // Les deux vrais défauts, tels qu'ils étaient écrits.
  assert.deepEqual(attrape("// Voir `publicBriquesDisparues()` dans lib/bricks.ts"), ["publicBriquesDisparues"]);
  assert.deepEqual(attrape("/* cf. `coutVoixMensuelJamaisEcrit()` pour le détail */"), ["coutVoixMensuelJamaisEcrit"]);

  // Ce qu'il doit LAISSER passer : le post-mortem au passé, qui est la
  // mémoire du dépôt et ne donne aucun ordre.
  assert.deepEqual(attrape("// Il a existé ici un `publicBriquesDisparues()` qui fuitait le catalogue."), []);
  // Et une consigne qui pointe vers du code bien vivant.
  assert.deepEqual(attrape("// Voir `commentaires()` juste au-dessus."), []);
});
