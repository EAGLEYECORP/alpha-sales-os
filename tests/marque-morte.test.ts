import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const R = process.cwd();

/**
 * ─────────────────────────────────────────────────────────────────────
 * UNE MARQUE MORTE NE DOIT PLUS PARLER À LA PLACE DE LA NÔTRE.
 *
 * CLAUDE.md le dit depuis le 02/09/2026 : « Le nom "Callflow" ne doit plus
 * apparaître nulle part : c'était LEUR marque, pas la nôtre. » La règle était
 * écrite, et rien ne la vérifiait — le défaut récurrent du dépôt appliqué à
 * lui-même.
 *
 * ── CE QUI RESTAIT, TROUVÉ À LA MAIN ──
 *
 *   · `/linkedin` affichait « SCINTIA × EAGLEYE CORP » en sur-titre d'écran ;
 *   · les 13 fiches ICP portaient « Source : Sheet Callflow (liste A) » dans
 *     leur champ `notes`, donc visible sur chaque fiche prospect ;
 *   · l'info-bulle du bouton de chargement dans Réglages annonçait
 *     « (Scintia · Lyon) » ;
 *   · une entrée de timeline disait « Audit ***NOM-RETIRE*** × Scintia » ;
 *   · et CLAUDE.md documentait une famille de routage `callflow` que le code
 *     avait déjà renommée — une doc qui MENT est pire qu'une doc absente.
 *
 * ── LA LIGNE EXACTE QUE CE TEST TRACE, ET POURQUOI ELLE EST LÀ ──
 *
 * INTERDIT : la marque dans une CHAÎNE — donc dans ce qui s'affiche, s'envoie
 * ou se stocke. C'est ça, « utiliser la marque de quelqu'un d'autre ».
 *
 * AUTORISÉ : la marque dans un COMMENTAIRE. Un commentaire qui explique
 * pourquoi un repli a été retiré, pourquoi une cadence était de cinq rappels
 * ou pourquoi une garde existe, ce n'est pas se réclamer de leur marque —
 * c'est garder le POURQUOI. L'effacer ferait exactement ce que ce dépôt
 * combat partout ailleurs : laisser une décision sans sa raison, et la voir
 * réinventée à l'envers deux sessions plus tard.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Les marques mortes. `scintia` couvre aussi `scintiacallflow`. */
const MORTES = /scintia|callflow/i;

/** Sources produites par nous (le code livré), hors tests et hors docs. */
function sources(): string[] {
  const out: string[] = [];
  const marche = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) marche(p);
      else if (/\.tsx?$/.test(e)) out.push(p.slice(R.length + 1));
    }
  };
  for (const d of ["lib", "app", "components"]) if (existsSync(join(R, d))) marche(join(R, d));
  return out.sort();
}

/** Retire commentaires de bloc et de ligne — eux ont le droit de la nommer. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("⚠ aucune marque morte dans ce que le produit affiche, envoie ou stocke", () => {
  const fautes: string[] = [];
  for (const f of sources()) {
    const lignes = sansCommentaires(readFileSync(join(R, f), "utf8")).split("\n");
    for (const [i, ligne] of lignes.entries()) {
      /**
       * On vise les chaînes littérales (guillemets doubles, simples, gabarits)
       * et le texte JSX nu. Une chaîne est ce qui finit devant quelqu'un :
       * un libellé, une note de fiche, un corps d'email, un `title=`.
       */
      const chaines = [
        ...[...ligne.matchAll(/"([^"]*)"/g)].map((m) => m[1]),
        ...[...ligne.matchAll(/'([^']*)'/g)].map((m) => m[1]),
        ...[...ligne.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
        ...[...ligne.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
      ];
      for (const c of chaines) {
        if (MORTES.test(c)) fautes.push(`${f}:${i + 1} → « ${c.slice(0, 80)} »`);
      }
    }
  }
  assert.deepEqual(
    fautes,
    [],
    "l'accord est mort le 02/09/2026 ; cette marque n'est pas la nôtre :\n  " + fautes.join("\n  ")
  );
});

test("⚠ ni dans la doctrine, qui est ce que la session suivante recopiera", () => {
  /**
   * CLAUDE.md a le droit de RACONTER la mort de l'accord — c'est même le seul
   * endroit où ça doit être écrit. Ce qu'il n'a pas le droit de faire, c'est
   * de PRESCRIRE la marque : un identifiant, un nom de compte, une famille de
   * routage. C'est ce qui était arrivé — la doc listait une famille `callflow`
   * que le code avait déjà renommée `alpha-voice`, et la recopier produisait
   * une offre que `validerOffre` refuse.
   *
   * On distingue les deux par la forme : `code entre accents graves`.
   */
  const doctrine = readFileSync(join(R, "CLAUDE.md"), "utf8");
  const identifiants = [...doctrine.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((c) => MORTES.test(c));

  // Le seul acceptable : la phrase qui interdit le nom doit pouvoir le citer.
  const attendus = new Set(["Callflow"]);
  const fautes = identifiants.filter((c) => !attendus.has(c));
  assert.deepEqual(
    fautes,
    [],
    `CLAUDE.md prescrit encore des identifiants portant la marque morte : ${fautes.join(" · ")}`
  );
});

test("le compte du revendeur n'existe plus dans le portefeuille", () => {
  /**
   * Le doublon volontaire de `tests/accounts.test.ts` : ici on vérifie la
   * CONDITION côté source, là-bas côté module chargé. C'est la seule des deux
   * qui attrape une réintroduction faite dans un fichier de données annexe.
   */
  const src = readFileSync(join(R, "lib/accounts.ts"), "utf8");
  const ids = [...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 2, "le portefeuille doit contenir au moins deux comptes");
  assert.deepEqual(ids.filter((i) => MORTES.test(i)), []);
});
