import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  QUOTA_BYTES,
  SEUIL_ALERTE_PCT,
  projeterImport,
  type StorageHealth,
} from "../lib/storage-health";

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

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE FICHE NE PÈSE PAS SON POIDS D'IMPORT. ELLE PÈSE SA VIE.
 *
 * ⚠ MESURÉ SUR 2 500 FICHES D'IMPORT PLACES, ET C'EST LE CAS QUI COMPTE :
 *
 *     à l'import (0 touche) ........ 4 803 Ko ...  94 %  → « ok »
 *     après 1 appel ................ 5 436 Ko ... 106 %  ⛔
 *     cadence complète (4 appels) .. 7 348 Ko ... 144 %  ⛔
 *
 * L'opérateur collait 2 500 fiches, recevait un feu vert à 94 %, et
 * l'application cessait d'enregistrer AU PREMIER APPEL — en silence, l'écran
 * continuant d'afficher les fiches jusqu'à la fermeture de l'onglet.
 *
 * Le mur était juste et regardait au mauvais endroit : il projetait l'IMPORT,
 * pas la VIE de la fiche.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ la projection compte la timeline, pas seulement les fiches collées", () => {
  const vide: StorageHealth = {
    usedBytes: 0,
    quotaBytes: QUOTA_BYTES,
    usedPct: 0,
    level: "ok",
    message: "",
  };

  // 1,9 Ko par fiche : le poids mesuré d'une fiche d'import Places.
  const OCTETS_FICHE = 984; // ×2 en UTF-16 = ~1,9 Ko

  const ancien = projeterImport(vide, { length: 2500 }, OCTETS_FICHE, false);
  const nouveau = projeterImport(vide, { length: 2500 }, OCTETS_FICHE);

  assert.ok(
    ancien.pctApres < 100,
    `l'ancien calcul passait sous les 100 % (${ancien.pctApres} %) — c'est le feu vert qui trompait`
  );
  assert.ok(
    nouveau.pctApres > 100,
    `la vie de la fiche doit faire dépasser le quota (obtenu ${nouveau.pctApres} %)`
  );
  assert.ok(nouveau.alerte, "et l'alerte doit se lever AVANT de coller");
  assert.match(nouveau.phrase, /historique/i, "la phrase doit dire d'où vient le poids supplémentaire");
  assert.match(nouveau.phrase, /Supabase/, "et ce qu'il faut activer");
});

test("la projection reste honnête sur un petit lot", () => {
  /**
   * Un mur qui hurle sur 300 fiches est un mur qu'on apprend à ignorer — et
   * 300 est précisément le minimum que /demarrage demande.
   */
  const vide: StorageHealth = {
    usedBytes: 0,
    quotaBytes: QUOTA_BYTES,
    usedPct: 0,
    level: "ok",
    message: "",
  };
  const p = projeterImport(vide, { length: 300 }, 984);
  assert.ok(p.pctApres < SEUIL_ALERTE_PCT, `300 fiches ne doivent pas alerter (obtenu ${p.pctApres} %)`);
  assert.equal(p.alerte, false);
});

test("le seuil de bascule est dit en fiches, pas en pourcentage abstrait", () => {
  /**
   * Le nombre à partir duquel le navigateur ne suffit plus est une DÉCISION
   * opérationnelle : au-dessus, il faut Supabase. On le calcule ici pour
   * qu'il soit vérifiable, plutôt que cité de mémoire dans une conversation.
   */
  const vide: StorageHealth = {
    usedBytes: 0,
    quotaBytes: QUOTA_BYTES,
    usedPct: 0,
    level: "ok",
    message: "",
  };
  let bascule = 0;
  for (let n = 100; n <= 5000; n += 50) {
    if (projeterImport(vide, { length: n }, 984).pctApres >= 100) {
      bascule = n;
      break;
    }
  }
  assert.ok(bascule > 0, "il doit exister un nombre de fiches au-delà duquel le navigateur ne suffit plus");
  assert.ok(
    bascule >= 1200 && bascule <= 2000,
    `bascule attendue entre 1 200 et 2 000 fiches, mesurée à ${bascule} — si ce chiffre bouge, c'est que le ` +
      `poids d'une fiche ou de sa timeline a changé, et la doctrine de démarrage avec`
  );
});
