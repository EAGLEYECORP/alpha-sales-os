import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLE_STORE, decider, type DecisionSession } from "../lib/session-locale";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « QUE D'AUTRES PUISSENT L'UTILISER, ET QUE CE NE SOIT PAS MA SESSION. »
 *
 * Le pipe vit dans le `localStorage`, sous une clé unique et non nominative.
 * `signOut()` ferme la session Supabase et ne touche pas au stockage : sur une
 * machine partagée, le suivant héritait des fiches du précédent — noms,
 * téléphones, montants. La RLS n'y peut rien, elle protège la BASE ; c'est le
 * navigateur qui gardait l'état.
 *
 * Une purge est IRRÉVERSIBLE et l'app est local-first : tant que `pipeServeur`
 * est éteint, le localStorage est la seule copie qui existe. Se tromper de sens
 * n'expose pas des données — ça les détruit. D'où une règle pure, et ces tests.
 * ─────────────────────────────────────────────────────────────────────
 */

const cas: { quoi: string; proprietaire: string | null; utilisateur: string | null; attendu: DecisionSession }[] = [
  {
    quoi: "personne n'est connecté → on ne touche à rien",
    proprietaire: "user-a",
    utilisateur: null,
    attendu: "rien",
  },
  {
    quoi: "stockage vierge, premier compte → il l'adopte",
    proprietaire: null,
    utilisateur: "user-a",
    attendu: "adopter",
  },
  {
    quoi: "le même revient → rien à faire",
    proprietaire: "user-a",
    utilisateur: "user-a",
    attendu: "rien",
  },
  {
    quoi: "⚠ UN AUTRE COMPTE SE CONNECTE → purge",
    proprietaire: "user-a",
    utilisateur: "user-b",
    attendu: "purger",
  },
];

for (const c of cas) {
  test(`appartenance — ${c.quoi}`, () => {
    assert.equal(decider(c.proprietaire, c.utilisateur), c.attendu);
  });
}

test("⚠ la déconnexion NE PURGE PAS — l'app est local-first", () => {
  /**
   * C'est le point où il est le plus tentant de « bien faire » et le plus
   * coûteux de se tromper. Purger à la déconnexion paraît prudent ; ça
   * détruirait le travail de quelqu'un qui se déconnecte pour se reconnecter,
   * et le localStorage est la SEULE copie tant que `pipeServeur` est éteint.
   *
   * Ce n'est pas non plus nécessaire : une fois déconnecté, l'écran de
   * connexion est fermé. La purge tombe au moment utile — quand un AUTRE
   * ouvre une session.
   */
  assert.equal(decider("user-a", null), "rien", "se déconnecter ne doit rien détruire");
  assert.equal(decider("user-a", "user-b"), "purger", "…mais le suivant ne doit rien hériter");
});

test("un doute ne purge jamais : propriétaire illisible = adoption, pas destruction", () => {
  // `lireProprietaire` rend `null` quand le stockage est bloqué (navigation
  // privée, réglage navigateur). Ce `null` doit conduire à adopter, jamais à
  // effacer — on ne détruit pas sur une information qu'on n'a pas.
  assert.equal(decider(null, "user-a"), "adopter");
});

test("⚠ la règle est BRANCHÉE : un module que rien n'importe ne protège personne", () => {
  /**
   * Le défaut le plus fréquent de ce dépôt. `AuthSync` est le seul composant
   * qui voit chaque changement de session — c'est donc là que la vérification
   * doit vivre, et nulle part ailleurs.
   */
  const src = readFileSync(join(process.cwd(), "components/security/auth-sync.tsx"), "utf8");
  assert.match(src, /from "@\/lib\/session-locale"/, "AuthSync doit importer la règle");
  assert.match(
    src,
    /verifierAppartenance\(session\?\.user\?\.id \?\? null\)/,
    "la vérification doit être appelée sur CHAQUE changement d'état, pas seulement au montage"
  );
  assert.match(
    src,
    /verifierAppartenance\(data\.session\?\.user\?\.id \?\? null\)/,
    "…et sur l'état initial : un onglet rouvert ne déclenche aucun changement d'état"
  );
  assert.match(
    src,
    /effet\.purge[\s\S]{0,80}location\.reload\(\)/,
    "après une purge, la page DOIT être rechargée : l'état zustand vit en mémoire et survivrait au vidage"
  );
});

test("la clé purgée est bien celle du store, pas une clé voisine", () => {
  /**
   * Une purge qui vise la mauvaise clé ne protège rien ET donne l'impression
   * d'avoir protégé. On lit la clé réellement déclarée par zustand.
   */
  const store = readFileSync(join(process.cwd(), "lib/store.ts"), "utf8");
  const m = store.match(/name:\s*"([^"]+)"[\s\S]{0,120}version:/);
  assert.ok(m, "clé de persistance introuvable dans lib/store.ts");
  assert.equal(CLE_STORE, m![1], "la clé purgée a divergé de celle que zustand écrit réellement");
});
