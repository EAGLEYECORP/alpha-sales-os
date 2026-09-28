import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA DOC DE LANCEMENT OMETTAIT LA VARIABLE AVEC LAQUELLE ON SE CONNECTE.
 *
 * ══ CE QUI A ÉTÉ MESURÉ LE 17/09/2026 ══
 *
 * `docs/A-FAIRE-ZAKARIA.md` prescrivait « les QUATRE variables Vercel, dans cet
 * ordre », en terminant par `REQUIRE_AUTH=1`. Croisée avec ce que le code lit
 * réellement, la liste en omettait deux — dont **`NEXT_PUBLIC_SUPABASE_ANON_KEY`,
 * qui est ce avec quoi on OUVRE une session**.
 *
 * Suivre la doc à la lettre donnait donc : le serveur exige un compte
 * (`REQUIRE_AUTH=1`), et le navigateur n'a pas de quoi en ouvrir un
 * (`getSupabaseConfig()` rend `null`). **Le propriétaire se murait dehors de sa
 * propre production, en suivant sa propre procédure.**
 *
 * ⚠ Le plus parlant : `components/security/auth-gate.tsx` porte **un écran
 * dédié à cette impasse exacte** (« Connexion impossible », qui NOMME les deux
 * variables). Quelqu'un l'avait anticipée dans l'interface — et ne l'avait
 * jamais ajoutée à la liste de lancement. Le défaut de signature du dépôt, sur
 * la porte d'entrée.
 *
 * ══ POURQUOI CE TEST LIT LE CODE, ET PAS UNE LISTE ══
 *
 * Une deuxième liste écrite à la main divergerait de la première — c'est
 * exactement ce qui vient d'arriver. Les noms se DÉRIVENT des `process.env` du
 * chemin d'authentification ; la doc doit les contenir tous.
 * ─────────────────────────────────────────────────────────────────────
 */

const R = process.cwd();
const lire = (p: string) => readFileSync(join(R, p), "utf8");
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/**
 * Les fichiers SANS LESQUELS ON N'ENTRE PAS. Ce n'est pas « tout le dépôt » :
 * une variable de brique optionnelle n'a rien à faire dans une procédure de
 * lancement, et l'y mettre transformerait la liste en mur que personne ne lit.
 */
const CHEMIN_DE_CONNEXION = [
  "lib/supabase.ts", // ouvre la session côté navigateur
  "lib/auth.ts", // le verrou serveur
  "lib/entitlements.ts", // les droits, donc ce qu'on voit une fois entré
  "middleware.ts", // ce qui refuse avant même la page
];

/**
 * Ce qu'on ne demande PAS à la doc de lancement, avec le motif de chacune.
 * Sans motif, cette liste deviendrait l'endroit où l'on range une variable
 * plutôt que de l'écrire — la décharge que `exports-morts` décrit déjà.
 */
const HORS_PROCEDURE: Record<string, string> = {
  NODE_ENV: "posée par la plateforme, jamais par un humain",
  SITE_PASSWORD:
    "optionnelle et documentée à part : elle mure l'admin, elle n'ouvre aucune session",
  VERCEL_URL: "posée seule par la plateforme — c'est le repli de `lib/url-publique.ts`",
  VERCEL_ENV: "posée seule par la plateforme, elle distingue aperçu et production",
};

function variablesDuCheminDeConnexion(): string[] {
  const vues = new Set<string>();
  for (const f of CHEMIN_DE_CONNEXION) {
    for (const m of sansCommentaires(lire(f)).matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      vues.add(m[1]);
    }
  }
  return [...vues].filter((v) => !(v in HORS_PROCEDURE)).sort();
}

test("⚠⚠ LA PROCÉDURE NOMME TOUTES LES VARIABLES SANS LESQUELLES ON N'ENTRE PAS", () => {
  const doc = lire("docs/A-FAIRE-ZAKARIA.md");
  const manquantes = variablesDuCheminDeConnexion().filter((v) => !doc.includes(v));

  assert.deepEqual(
    manquantes,
    [],
    "Le code EXIGE ces variables pour se connecter, et la procédure de lancement les tait.\n" +
      "Suivre la doc mènerait à « le serveur exige un compte, le navigateur ne peut pas en ouvrir ».\n  " +
      manquantes.join("\n  "),
  );
});

test("⚠⚠ LA CLÉ ANONYME EST CE AVEC QUOI ON SE CONNECTE — et la doc le dit", () => {
  /**
   * Le cas précis qui a été manqué. Le nommer ne suffit pas : une variable
   * listée sans sa RAISON se fait sauter par quelqu'un qui abrège. La doc doit
   * porter le fait, pas seulement l'identifiant.
   */
  const supabase = sansCommentaires(lire("lib/supabase.ts"));
  assert.match(
    supabase,
    /url && key \? \{ url, key \} : null/,
    "sans la clé, la config est nulle — c'est ça qui empêche d'ouvrir une session",
  );

  const doc = lire("docs/A-FAIRE-ZAKARIA.md");
  assert.ok(doc.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"), "elle doit être dans la liste");
  assert.match(
    doc,
    /SE CONNECTE|se connecter|ouvrir une session|ouvrir un compte/i,
    "…et la doc doit DIRE à quoi elle sert, sinon on l'abrège",
  );
});

test("⚠⚠ LES `NEXT_PUBLIC_*` SONT ANNONCÉES COMME EXIGÉES AU BUILD", () => {
  /**
   * Piège propre à Next : une `NEXT_PUBLIC_*` est INLINÉE dans le bundle au
   * build. Posée après coup sur la plateforme, elle ne change rien tant qu'on
   * n'a pas redéployé — et l'écran d'impasse reste affiché alors que la
   * variable « est bien là » dans le tableau de bord. C'est le genre de
   * détail qui fait perdre une soirée en croyant à une panne.
   */
  const doc = lire("docs/A-FAIRE-ZAKARIA.md");
  assert.match(doc, /au moment du BUILD|redéploie/i, "la doc doit exiger le redéploiement");
});

test("⚠ CHAQUE EXCLUSION PORTE SON MOTIF", () => {
  /**
   * Même règle que partout ailleurs ici : une liste d'exceptions sans motifs
   * devient l'endroit où l'on range une variable plutôt que de l'écrire.
   */
  for (const [cle, motif] of Object.entries(HORS_PROCEDURE)) {
    assert.ok(motif.trim().length >= 25, `${cle} : motif trop court pour justifier une omission`);
  }
});

test("⚠ L'ORDRE IMPOSÉ SURVIT — `REQUIRE_AUTH` EN DERNIER", () => {
  /**
   * L'ordre n'est pas du confort : `REQUIRE_AUTH=1` posé avant le reste ferme
   * l'app sans que rien ne puisse l'ouvrir. Et la dépendance inverse (SMTP
   * avant les comptes) rend `/api/send` joignable par n'importe qui.
   */
  const doc = lire("docs/A-FAIRE-ZAKARIA.md");
  const bloc = doc.slice(doc.indexOf("NEXT_PUBLIC_SUPABASE_URL"), doc.indexOf("```", doc.indexOf("NEXT_PUBLIC_SUPABASE_URL")));
  const lignes = bloc.split("\n").filter((l) => /^\s*\d\./.test(l));
  assert.ok(lignes.length >= 5, "la procédure doit rester numérotée");
  assert.match(lignes[lignes.length - 1], /REQUIRE_AUTH/, "REQUIRE_AUTH est la DERNIÈRE ligne, toujours");
  assert.match(bloc, /EN DERNIER/i, "…et c'est écrit, pas seulement sous-entendu");
});
