import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(process.cwd(), "lib/store.ts"), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CODE = sansCommentaires(SRC);

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES RÉGLAGES SE RENORMALISENT À CHAQUE RÉHYDRATATION.
 *
 * ⚠ CONSTATÉ À L'ÉCRAN, PAS DÉDUIT. En capturant le Dashboard pour un montage
 * vidéo, deux des quatre chiffres du bandeau affichaient
 * « COMMISSION UNDEFINED% » et « NaN € ». La cause : `merge` remplaçait
 * `settings` EN BLOC (`...s`), sans repli sur `defaultSettings`.
 *
 * `migrate` faisait déjà ce repli — mais il ne tourne qu'au CHANGEMENT DE
 * VERSION. Un store écrit sous la version courante à laquelle il manque un
 * champ ajouté depuis (sauvegarde réimportée, JSON édité, réglages posés par
 * un script) ne le revoit donc jamais.
 *
 * C'est exactement la règle n°1 du dépôt — `prospectDefaults` est le socle de
 * TOUS les imports — appliquée aux réglages. Le même bug, au même endroit,
 * pour la même raison, sur l'autre moitié de l'état.
 * ─────────────────────────────────────────────────────────────────────
 */
test("⚠ `merge` renormalise les RÉGLAGES, pas seulement les fiches", () => {
  const i = CODE.indexOf("merge: (persisted");
  assert.ok(i > 0, "le store doit avoir un `merge`");
  const bloc = CODE.slice(i, CODE.indexOf("migrate:", i));

  assert.match(
    bloc,
    /settings:\s*\{\s*\.\.\.defaultSettings/,
    "sans repli sur defaultSettings, un réglage absent devient `undefined` et l'écran affiche NaN"
  );

  /**
   * ⚠ `security` est IMBRIQUÉ. Un spread de surface le remplacerait en bloc :
   * `pinHash` deviendrait indéfini, c'est-à-dire une serrure sans verrou, sur
   * une app qui envoie de vrais emails et compose de vrais numéros.
   */
  assert.match(
    bloc,
    /security:\s*\{\s*\.\.\.defaultSettings\.security/,
    "l'objet imbriqué doit être refusionné à part, sinon la serrure disparaît en silence"
  );
});

test("`migrate` et `merge` posent le MÊME socle de réglages", () => {
  /**
   * Deux replis différents pour le même objet, c'est deux comportements selon
   * qu'on a changé de version ou non — donc un bug qui n'apparaît que chez
   * ceux qui ont sauté une mise à jour. Le dépôt a déjà payé ce motif sur les
   * fiches.
   */
  const iMerge = CODE.indexOf("merge: (persisted");
  const iMigrate = CODE.indexOf("migrate:", iMerge);
  const blocMerge = CODE.slice(iMerge, iMigrate);
  const blocMigrate = CODE.slice(iMigrate);

  const motif = /settings:\s*\{\s*\.\.\.defaultSettings,\s*\.\.\.s\.settings,\s*security:\s*\{\s*\.\.\.defaultSettings\.security,\s*\.\.\.s\.settings\?\.security\s*\}/;
  assert.match(blocMerge, motif, "merge doit poser le socle complet");
  assert.match(blocMigrate, motif, "migrate aussi — et de la même façon");
});

test("le socle des réglages porte bien les champs qui s'affichent en chiffres", () => {
  /**
   * Les deux qui ont cassé à l'écran. Si l'un disparaît de `defaultSettings`,
   * le repli ne le rattrape plus et le NaN revient — ce test le dit avant
   * l'utilisateur.
   */
  const i = CODE.indexOf("const defaultSettings");
  assert.ok(i > 0);
  const bloc = CODE.slice(i, i + 2000);
  assert.match(bloc, /commissionPct:\s*\d/, "commissionPct alimente « COMMISSION x% » et le calcul du MRR");
  assert.match(bloc, /security:\s*\{/, "le bloc sécurité doit exister dans le socle");
});
