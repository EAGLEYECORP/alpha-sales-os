import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Le shell est un composant client : on ne l'importe pas dans node:test. On
// lit sa source, ce qui suffit pour verrouiller la STRUCTURE de navigation —
// c'est elle qui régresse quand on ajoute une page à la va-vite.
const shell = readFileSync(join(process.cwd(), "components/shell/app-shell.tsx"), "utf8");

function hrefs(bloc: string): string[] {
  return [...bloc.matchAll(/href:\s*"(\/[a-z-]*)"/g)].map((m) => m[1]);
}

const quotidien = shell.slice(shell.indexOf("const NAV_QUOTIDIEN"), shell.indexOf("interface NavGroup"));
const groupes = shell.slice(shell.indexOf("const NAV_GROUPES"), shell.indexOf("/** Toutes les entrées"));

test("navigation — le quotidien tient en 4 entrées maximum", () => {
  // Au-delà, « ce qui compte tous les jours » ne veut plus rien dire et on
  // retombe sur une liste plate.
  const q = hrefs(quotidien);
  assert.ok(q.length > 0 && q.length <= 4, `${q.length} entrées de quotidien`);
  assert.ok(q.includes("/aujourdhui"));
  assert.ok(q.includes("/pipeline"));
});

test("navigation — aucun groupe ne dépasse 6 entrées", () => {
  // Un groupe de 12 est une liste plate déguisée en hiérarchie.
  const blocs = [...groupes.matchAll(/items:\s*\[([\s\S]*?)\n\s*\],/g)].map((m) => m[1]);
  assert.ok(blocs.length >= 5, "il faut de vrais groupes, pas deux fourre-tout");
  for (const b of blocs) {
    const n = hrefs(b).length;
    assert.ok(n >= 3 && n <= 6, `groupe de ${n} entrées — hors de la fourchette lisible`);
  }
});

test("navigation — chaque page de l'app est atteignable, et une seule fois", () => {
  const tous = [...hrefs(quotidien), ...hrefs(groupes)];
  assert.equal(new Set(tous).size, tous.length, "une page listée deux fois = deux chemins pour la même chose");

  // Toutes les pages réelles doivent être joignables : une page construite et
  // jamais liée est du travail perdu, et c'est arrivé ailleurs dans ce repo.
  // Les pages de l'app vivent dans le groupe de routes `(app)` — les
  // parenthèses n'apparaissent pas dans les URLs. Les pages PUBLIQUES
  // (/vitrine, /gate) vivent en dehors, pour ne pas charger la coquille de
  // l'app ni son code client. Voir app/(app)/layout.tsx.
  const appDir = join(process.cwd(), "app", "(app)");
  const routes = readdirSync(appDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("api") && !d.name.startsWith("[") && !d.name.startsWith("_"))
    .filter((d) => existsSync(join(appDir, d.name, "page.tsx")))
    .map((d) => `/${d.name}`);

  // Exceptions volontaires, chacune justifiée :
  const horsMenu = new Set([
    "/vitrine", // page de vente publique, hors app
    "/gate", // écran d'accès, atteint par redirection
    "/login", // connexion Supabase, atteinte par la porte d'authentification
    "/overlay", // fenêtre transparente Electron
    "/prospects", // atteint depuis le pipeline, pas depuis le menu
    /**
     * Atteinte en CLIQUANT une entrée grisée : c'est elle qui répond
     * « pourquoi je ne peux pas entrer ici ». La lister au menu créerait une
     * entrée « Ce que tu n'as pas » chez quelqu'un qui a tout — un rappel
     * permanent de ce qu'il ne lui manque pas.
     */
    "/offre-brique",
  ]);

  const orphelines = routes.filter((r) => !tous.includes(r) && !horsMenu.has(r));
  assert.deepEqual(orphelines, [], `pages construites mais non liées : ${orphelines.join(", ")}`);
});
