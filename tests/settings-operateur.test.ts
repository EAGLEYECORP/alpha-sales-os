import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ⚠⚠ /settings IMPRIMÉ PAR UN VISITEUR SANS COMPTE (29/10/2026) : le panneau
 * de validation partenaire Nuwacom, nos trois offres, la charte interne, le
 * dictionnaire de NOTRE Sheets/n8n, notre taux de commission — et « Alpha
 * Sales OS » proposé comme SON offre. Rien de tout ça n'est à lui.
 *
 * Deux défauts, deux gardes :
 *  1. ces composants vivaient HORS du panneau opérateur ;
 *  2. le panneau lui-même suivait le verdict OPTIMISTE (« maître » tant que
 *     la réponse n'est pas là, et pour de bon si elle échoue).
 */

const RACINE = process.cwd().endsWith(".test-build") ? join(process.cwd(), "..") : process.cwd();
const lire = (f: string) => readFileSync(join(RACINE, f), "utf8");
const sansCommentaires = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Le composant est-il rendu À L'INTÉRIEUR d'un `<PanneauOperateur>` ? */
function dansLePanneau(src: string, composant: string): boolean {
  const i = src.indexOf(`<${composant}`);
  if (i < 0) return false;
  const avant = src.slice(0, i);
  const ouvert = avant.lastIndexOf("<PanneauOperateur");
  const ferme = avant.lastIndexOf("</PanneauOperateur>");
  return ouvert > ferme;
}

test("⚠⚠ ce qui n'est qu'à NOUS vit dans le panneau opérateur de /settings", () => {
  const src = sansCommentaires(lire("app/(app)/settings/page.tsx"));
  for (const c of ["ValidationPartenairePanel", "OffresEditor", "CharteMarque", "CrmDictionary", "AccountSwitcher", "PricingEditor"]) {
    assert.ok(dansLePanneau(src, c), `${c} est rendu hors du panneau opérateur — un inscrit le voit`);
  }
  // Le taux du portefeuille : sous la condition opérateur.
  assert.match(src, /\{operateur && \(\s*<div>\s*<label className="label">Commission sur CA/);
});

test("⚠⚠ le panneau opérateur suit le verdict PROUVÉ, jamais l'optimiste", () => {
  const src = sansCommentaires(lire("components/settings/panneau-operateur.tsx"));
  assert.match(src, /useMaitreProuve\(\)/);
  assert.doesNotMatch(src, /useDroits\(/, "l'optimiste dit « maître » pendant le chargement et sur une panne");
});

test("un inscrit ne se voit pas proposer NOTRE offre comme exemple de la sienne", () => {
  const src = sansCommentaires(lire("app/(app)/settings/page.tsx"));
  assert.doesNotMatch(src, /placeholder="Alpha Sales OS/);
  assert.doesNotMatch(src, /Zéro lead perdu/);
  assert.doesNotMatch(src, /Chez EAGLEYE/);
});
