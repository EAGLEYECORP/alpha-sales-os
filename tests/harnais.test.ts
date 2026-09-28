import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN TEST SUPPRIMÉ DOIT CESSER DE TOURNER.
 *
 * ⚠ CE DÉFAUT M'A MENTI SUR MES PROPRES CHIFFRES, ET C'EST COMME ÇA QU'IL
 * A ÉTÉ TROUVÉ.
 *
 * `npm test` compilait `tests/*.ts` vers `.test-build/` sans jamais purger ce
 * dossier, puis exécutait `.test-build/tests/*.test.js`. Un fichier de test
 * SUPPRIMÉ de la source y restait donc compilé, et continuait de s'exécuter à
 * chaque lancement.
 *
 * Constaté en direct : après avoir écrit puis effacé quatre sondes
 * temporaires, la suite annonçait 1 167 tests. Un `rm -rf .test-build` a
 * ramené le vrai chiffre à 1 163. J'avais annoncé les chiffres gonflés dans
 * deux messages de commit et dans `docs/ANGLES-MORTS.md`.
 *
 * ── POURQUOI C'EST PLUS QU'UNE ERREUR DE COMPTAGE ──
 *
 * Le cas qui coûte cher n'est pas le test en trop, c'est le test SUPPRIMÉ
 * PARCE QU'IL ÉTAIT FAUX. Il continue de passer, donc il continue d'imposer
 * une règle qu'on a justement décidé d'abandonner — et plus aucune source ne
 * dit pourquoi. On corrige le code pour satisfaire un fantôme.
 *
 * L'inverse est vrai aussi : renommer un fichier de test le fait s'exécuter
 * en double, et un test dupliqué qui échoue s'attribue au mauvais fichier.
 *
 * Le nettoyage se fait en Node plutôt qu'avec `rm -rf` : pas de dépendance
 * ajoutée, et ça marche là où `rm` n'existe pas.
 * ─────────────────────────────────────────────────────────────────────
 */

test("⚠ la suite purge son dossier de compilation avant de tourner", () => {
  const pkg = readFileSync(join(process.cwd(), "package.json"), "utf8");
  const script = JSON.parse(pkg).scripts?.test as string | undefined;
  assert.ok(script, "le script de test doit exister");

  assert.match(
    script,
    /rmSync\('\.test-build'|rm -rf \.test-build/,
    "sans purge, un test supprimé de la source continue de s'exécuter depuis .test-build"
  );
  // La purge doit précéder la compilation, sinon elle efface ce qu'on vient
  // de produire et la suite ne trouve plus rien à exécuter.
  assert.ok(
    script!.indexOf("rmSync") < script!.indexOf("tsc"),
    "la purge doit venir AVANT tsc"
  );
});

test("le dossier de compilation reste hors du dépôt", () => {
  // Sinon les fantômes voyageraient d'une machine à l'autre, et le problème
  // deviendrait celui de tout le monde.
  const ignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
  assert.match(ignore, /\.test-build/, ".test-build doit rester ignoré par git");
});
