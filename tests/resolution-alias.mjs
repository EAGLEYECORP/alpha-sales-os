import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * RÉSOUDRE `@/` DANS LE HARNAIS DE TEST — pour pouvoir EXÉCUTER une route.
 *
 * `npm test` compile avec `tsc` puis lance `node --test`. `tsc` ne réécrit pas
 * les alias de `paths` : un fichier compilé garde `require("@/lib/bricks")`,
 * que Node ne sait pas résoudre. Conséquence mesurée le 17/09/2026 : **aucun
 * des ~45 `app/api/**\/route.ts` n'était exécutable depuis un test**, et tous
 * étaient donc gardés par des assertions sur le TEXTE SOURCE.
 *
 * ⚠⚠ C'est précisément la famille de garde que ce dépôt a vu échouer le plus
 * souvent — « l'assertion était satisfaite par la PROSE », « asserter la
 * PRÉSENCE du refus au lieu de la CONDITION qui y mène ». Un import inutilisé,
 * un `if (false)`, un commentaire bien écrit : tout ça passe un `grep`.
 *
 * Ce crochet ne fait qu'UNE chose : remplacer le préfixe `@/` par la racine du
 * dépôt. Aucune dépendance (`node:module`), aucune transformation de code,
 * aucun effet sur les modules qui n'utilisent pas l'alias.
 * ─────────────────────────────────────────────────────────────────────
 */
const RACINE = resolve(import.meta.dirname, "..", ".test-build");

registerHooks({
  resolve(specifier, context, next) {
    if (!specifier.startsWith("@/")) return next(specifier, context);
    const base = resolve(RACINE, specifier.slice(2));
    // `tsc` émet du CommonJS sans extension dans les `require` : on la remet.
    // Un dossier avec `index.js` reste possible — d'où les deux essais, et le
    // repli sur le chemin nu plutôt qu'une erreur fabriquée ici.
    for (const candidat of [`${base}.js`, resolve(base, "index.js")]) {
      if (existsSync(candidat)) return next(candidat, context);
    }
    return next(base, context);
  },
});
