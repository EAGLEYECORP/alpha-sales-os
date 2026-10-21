import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ALPHA_ICI, pageAlphaPour } from "../lib/alpha-ici";
import { PLAFOND_SOLLICITATIONS_B2C } from "../lib/call-cadence";
import { citationFausse, sansCommentaires } from "./citations-alpha";

const R = process.cwd();

/**
 * ─────────────────────────────────────────────────
 * « CE QU'ALPHA FAIT ICI » — le registre qui décrit les écrans.
 *
 * Ce qu'on protège :
 *  · une description qui ne désigne plus rien (fichier supprimé, fonction
 *    renommée) — elle continuerait de s'afficher, et de mentir ;
 *  · une route qui n'existe pas ;
 *  · un écran décrit SANS avoir été lu : l'absence du registre doit rester
 *    silencieuse, jamais un texte générique ;
 *  · un nom de route qui en capte une autre (`/appels` ne doit pas couvrir
 *    `/appelsXYZ`).
 * ─────────────────────────────────────────────────
 */

test("⚠⚠ chaque règle du registre NOMME un fichier et un symbole réels", () => {
  const fautes: string[] = [];
  for (const p of ALPHA_ICI) {
    for (const e of p.etapes) {
      const f = citationFausse(e.fichier, e.symbole);
      if (f) fautes.push(`${p.route} → ${f}`);
    }
  }
  assert.deepEqual(fautes, [], "une description qui ne désigne plus rien est une description qui ment :\n  " + fautes.join("\n  "));
});

test("chaque route du registre est un VRAI écran de l'app", () => {
  const manquantes = ALPHA_ICI.filter((p) => !existsSync(join(R, "app/(app)", p.route, "page.tsx"))).map((p) => p.route);
  assert.deepEqual(manquantes, []);
});

test("chaque entrée dit ce qu'ALPHA fait ET ce qu'il refuse de faire ; aucune route en double", () => {
  const vues = new Set<string>();
  for (const p of ALPHA_ICI) {
    assert.ok(p.etapes.length > 0, `${p.route} : aucune étape`);
    assert.ok(p.nePasFaire.length > 15, `${p.route} : « ne fait pas » est vide`);
    assert.ok(p.titre.length > 3, `${p.route} : pas de titre`);
    assert.ok(!vues.has(p.route), `${p.route} est déclarée deux fois`);
    vues.add(p.route);
  }
});

test("le plafond légal d'/appels s'écrit depuis sa constante", () => {
  const phrase = ALPHA_ICI.find((p) => p.route === "/appels")!.etapes.find((e) => e.symbole === "PLAFOND_SOLLICITATIONS_B2C");
  assert.ok(phrase?.quoi.includes(String(PLAFOND_SOLLICITATIONS_B2C)));
  assert.ok(!/plus de \d+ en 30/.test(sansCommentaires(readFileSync(join(R, "lib/alpha-ici.ts"), "utf8"))), "plafond recopié en dur");
});

test("pageAlphaPour : la route exacte, ses sous-chemins, et RIEN d'autre", () => {
  assert.equal(pageAlphaPour("/appels")?.route, "/appels");
  assert.equal(pageAlphaPour("/appels/liste")?.route, "/appels");
  assert.equal(pageAlphaPour("/appelsXYZ"), null, "un préfixe de lettres n'est pas un sous-chemin");
  assert.equal(pageAlphaPour("/"), null);
  assert.equal(pageAlphaPour("/travail"), null, "l'écran du circuit ne se décrit pas lui-même");
  assert.equal(pageAlphaPour("/ecran-jamais-lu"), null, "un écran qu'on n'a pas lu n'affiche RIEN");
});

test("pageAlphaPour prend la route la plus LONGUE quand deux préfixent le chemin", () => {
  // Cas synthétique : on vérifie la règle de départage sans dépendre du registre réel.
  const registre = [{ route: "/a" }, { route: "/a/b" }];
  const choisir = (chemin: string) =>
    registre.filter((p) => chemin === p.route || chemin.startsWith(`${p.route}/`)).sort((x, y) => y.route.length - x.route.length)[0]?.route;
  assert.equal(choisir("/a/b/c"), "/a/b");
  // …et la vraie fonction applique cette même règle : le code la porte.
  const code = sansCommentaires(readFileSync(join(R, "lib/alpha-ici.ts"), "utf8"));
  assert.match(code, /route\.length > meilleure\.route\.length/);
});

test("⚠ la coquille MONTE le panneau, et le panneau lit le registre (pas un texte écrit en dur)", () => {
  const composant = sansCommentaires(readFileSync(join(R, "components/shell/alpha-ici.tsx"), "utf8"));
  assert.match(composant, /pageAlphaPour\(pathname\)/);
  assert.match(composant, /if \(!page\) return null/, "un écran absent du registre doit n'afficher RIEN");
  const coquille = sansCommentaires(readFileSync(join(R, "components/shell/app-shell.tsx"), "utf8"));
  assert.match(coquille, /<AlphaIci \/>/);
});
