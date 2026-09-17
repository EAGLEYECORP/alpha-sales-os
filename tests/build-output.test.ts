import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { modeSortie } from "../lib/build-output";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MODE DE SORTIE DÉCIDE SI LE BUILD DÉMARRE — sur Docker ET sur Netlify.
 *
 * `output: "standalone"` était en dur. Le Dockerfile en dépend (il copie
 * `.next/standalone`), mais le runtime Netlify gère la sortie lui-même et
 * `standalone` est le suspect n°1 d'un premier build Netlify qui casse — non
 * vérifiable depuis la sandbox. Ce test fige la règle qui tranche.
 * ─────────────────────────────────────────────────────────────────────
 */

test("⚠ DOCKER / self-host : sans signal Netlify, on rend `standalone`", () => {
  // Le Dockerfile copie `.next/standalone` et lance `node server.js`. Sans
  // cette sortie, l'image ne démarre pas. Le défaut de sûreté va donc ICI.
  assert.equal(modeSortie({}), "standalone");
  assert.equal(modeSortie({ NODE_ENV: "production" }), "standalone");
  // Vercel tolère `standalone` : on ne le distingue pas, il reste standalone.
  assert.equal(modeSortie({ VERCEL: "1" }), "standalone");
});

test("⚠⚠ NETLIFY : sortie par défaut, jamais `standalone`", () => {
  // Le runtime `@netlify/plugin-nextjs` attend la sortie par défaut. On lui
  // donne exactement ça, au lieu de parier qu'il tolère `standalone`.
  assert.equal(modeSortie({ NETLIFY: "true" }), undefined);
});

test("⚠ le signal est EXACTEMENT `\"true\"` — pas n'importe quelle valeur", () => {
  // Netlify pose la chaîne `"true"`. Une variable `NETLIFY` posée à autre chose
  // (un humain qui met `1`, un CI voisin) ne doit pas casser le self-host
  // Docker en silence : le défaut de sûreté reste `standalone`.
  assert.equal(modeSortie({ NETLIFY: "1" }), "standalone");
  assert.equal(modeSortie({ NETLIFY: "false" }), "standalone");
  assert.equal(modeSortie({ NETLIFY: "" }), "standalone");
});

test("⚠⚠ next.config CONSOMME la décision — sinon le module est mort", () => {
  /**
   * Le défaut de signature du dépôt. Un `lib/build-output.ts` parfait que la
   * config n'appelle pas laisserait `output: "standalone"` en dur, et le build
   * Netlily casserait quand même. On cherche l'APPEL, pas l'import.
   */
  const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
  assert.match(config, /output:\s*modeSortie\(\)/, "next.config doit poser `output: modeSortie()`");
  assert.ok(
    !/output:\s*"standalone"/.test(config),
    "…et ne plus jamais coder `standalone` en dur, sinon la décision ne décide rien",
  );
});
