import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MUR DE STOCKAGE SE MONTRE AVANT DE COLLER — SUR TOUTES LES SURFACES.
 *
 * C'est la règle d'écran n° 4 du projet, et elle a une raison mesurée :
 * une écriture localStorage qui échoue NE RESSEMBLE PAS À UNE PANNE. L'app
 * continue d'afficher les fiches ; elles disparaissent en fermant l'onglet.
 * Une fiche terrain pèse ~1,3 Ko, donc mille numéros consomment la moitié des
 * 5 Mo du navigateur.
 *
 * ⚠ CE QUI A MOTIVÉ CE FICHIER. `projeterImport` existait, était testé
 * (`tests/sourcing-terrain.test.ts`), et n'était branché que sur UNE des
 * quatre surfaces d'import en masse : le sourcing terrain. Le collage de
 * profils LinkedIn — des centaines de fiches en un clic — et les deux chemins
 * d'import CSV des réglages n'avertissaient de rien.
 *
 * `StorageAlert` (monté dans l'AppShell) finit par le dire, mais APRÈS la
 * perte. Or toute la règle tient dans le mot AVANT : c'est le seul moment où
 * ça se répare.
 *
 * C'est le même motif que le reste du dépôt — une garde juste, branchée à un
 * seul endroit. D'où un test qui part des APPELANTS et pas d'une liste : il
 * trouve tout ce qui écrit des fiches en masse, et exige que ce fichier-là
 * ait consulté la projection.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();
const IGNORE = new Set(["node_modules", ".next", ".test-build"]);

function sources(dirs: string[]): string[] {
  const out: string[] = [];
  const visite = (d: string) => {
    for (const e of readdirSync(d)) {
      if (IGNORE.has(e)) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) visite(p);
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
  };
  for (const d of dirs) visite(join(RACINE, d));
  return out;
}

/** Un test de FORME juge le code, jamais la prose qui l'explique. */
const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("⚠ toute surface qui colle des fiches en masse consulte le mur de stockage", () => {
  const fautes: string[] = [];
  let surfaces = 0;

  for (const f of sources(["app", "components"])) {
    const code = sansCommentaires(readFileSync(f, "utf8"));
    // `importProspects(...)` est la SEULE porte d'écriture en masse du store.
    // Sa déstructuration depuis le hook ne compte pas : c'est l'appel qui écrit.
    if (!/importProspects\s*\(/.test(code)) continue;
    surfaces++;
    if (!/projeterImport\s*\(/.test(code)) fautes.push(relative(RACINE, f));
  }

  assert.ok(surfaces >= 3, `on n'a trouvé que ${surfaces} surface(s) d'import — le balayage est cassé`);
  assert.deepEqual(
    fautes,
    [],
    "ces écrans collent des centaines de fiches sans jamais montrer le mur de stockage — " +
      "l'écriture échouera en silence et les fiches disparaîtront à la fermeture de l'onglet :\n  " +
      fautes.join("\n  ")
  );
});

test("l'avertissement vient AVANT l'écriture, pas après", () => {
  /**
   * Détail qui décide de tout : une projection calculée après
   * `importProspects` serait exacte et inutile. On vérifie donc l'ORDRE dans
   * chaque fichier — la consultation du mur doit précéder le premier appel
   * qui écrit.
   */
  const fautes: string[] = [];
  for (const f of sources(["app", "components"])) {
    const code = sansCommentaires(readFileSync(f, "utf8"));
    const iEcrit = code.search(/importProspects\s*\(/);
    if (iEcrit < 0) continue;
    const iMur = code.search(/projeterImport\s*\(/);
    if (iMur < 0 || iMur > iEcrit) fautes.push(relative(RACINE, f));
  }
  assert.deepEqual(fautes, [], "le mur y est calculé APRÈS l'écriture :\n  " + fautes.join("\n  "));
});
