import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lireLien } from "../lib/lien-confirmation";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE RETOUR D'EMAIL — le seul endroit du tunnel où l'échec était MUET.
 *
 * Supabase ne rend pas d'erreur quand un lien de confirmation échoue : il
 * redirige vers l'application avec la raison dans le fragment. Personne ne le
 * lisait. L'inscrit arrivait sur une app d'apparence normale, non connecté, et
 * sans un mot d'explication — au moment exact de la conversion.
 * ─────────────────────────────────────────────────────────────────────
 */

test("une visite ordinaire n'affiche rien", () => {
  assert.deepEqual(lireLien("", ""), { type: "aucun" });
  assert.deepEqual(lireLien("?page=2", "#section"), { type: "aucun" });
});

test("le retour de confirmation est reconnu, avec ou sans le préfixe", () => {
  assert.deepEqual(lireLien("?bienvenue=1", ""), { type: "bienvenue" });
  assert.deepEqual(lireLien("bienvenue=1", ""), { type: "bienvenue" });
  assert.deepEqual(lireLien("", "#bienvenue=1"), { type: "bienvenue" });
});

test("⚠ L'ERREUR L'EMPORTE SUR LA BIENVENUE — et c'est le cas RÉEL", () => {
  /**
   * ⚠ CE TEST GARDE UN ORDRE, PAS UNE FONCTIONNALITÉ.
   *
   * Un lien qui échoue redirige vers l'URL de retour — laquelle porte DÉJÀ
   * `?bienvenue=1`, puisque c'est nous qui l'avons construite. Les deux
   * marqueurs arrivent donc ENSEMBLE, systématiquement, à chaque échec. Lire
   * la bienvenue en premier ferait fêter l'arrivée de quelqu'un à qui on
   * vient de refuser l'entrée, et lui retirerait le bouton qui répare.
   *
   * Mutation vérifiée : intervertir les deux blocs dans `lireLien` fait
   * tomber cette assertion et elle seule.
   */
  const r = lireLien("?bienvenue=1", "#error=access_denied&error_code=otp_expired");
  assert.equal(r.type, "erreur");
  assert.equal(r.type === "erreur" && r.code, "otp_expired");
});

test("les deux moitiés de l'URL sont lues — pas seulement le fragment", () => {
  /**
   * Supabase met l'erreur dans le fragment sur le flux implicite, dans la
   * query sur d'autres parcours (PKCE, invitation). N'en lire qu'une marche
   * neuf fois sur dix, et c'est la dixième qui rappelle.
   */
  const parFragment = lireLien("", "#error_code=otp_expired");
  const parQuery = lireLien("?error_code=otp_expired", "");
  assert.equal(parFragment.type, "erreur");
  assert.equal(parQuery.type, "erreur");
  assert.deepEqual(parFragment, parQuery, "la moitié d'où vient l'erreur ne doit rien changer au message");
});

test("chaque message d'erreur dit QUOI FAIRE, jamais seulement ce qui s'est passé", () => {
  /**
   * Un message qui décrit l'erreur sans donner l'action suivante laisse la
   * personne exactement où elle était : dans une impasse, mais informée.
   * On exige donc qu'il parle du lien à redemander.
   */
  for (const code of ["otp_expired", "access_denied", "email_not_confirmed", "server_error", "code_totalement_inconnu"]) {
    const r = lireLien("", `#error_code=${code}`);
    assert.equal(r.type, "erreur");
    if (r.type !== "erreur") continue;
    assert.ok(r.message.length > 40, `${code} : message trop court pour dire quoi faire`);
    assert.match(
      r.message,
      /nouveau lien|nouvel envoi|un nouveau|réessaie/i,
      `${code} : le message ne propose aucune action`
    );
  }
});

test("un code inconnu ne tombe pas dans le vide", () => {
  // Supabase ajoute des codes sans prévenir. Un `undefined` affiché à
  // l'écran serait pire que le silence qu'on corrige.
  const r = lireLien("", "#error_code=quelque_chose_de_neuf");
  assert.equal(r.type, "erreur");
  assert.equal(r.type === "erreur" && r.code, "quelque_chose_de_neuf");
  assert.ok(r.type === "erreur" && r.message.trim().length > 0);
});

// ─────────── LE CÂBLAGE — sinon c'est un module mort de plus ───────────

test("⚠ le bandeau est monté dans la COQUILLE, pas dans un écran", () => {
  /**
   * Le défaut récurrent du dépôt : un mécanisme juste, branché nulle part.
   * Celui-ci doit être dans `app-shell` — le lien de confirmation peut
   * atterrir sur N'IMPORTE QUELLE page (Supabase retombe sur la Site URL
   * quand la redirection n'est pas en liste blanche). Monté sur un seul
   * écran, il serait muet précisément dans le cas qu'il existe pour couvrir.
   */
  const shell = readFileSync(join(process.cwd(), "components/shell/app-shell.tsx"), "utf8");
  assert.match(shell, /<RetourLien \/>/, "le bandeau de retour d'email doit être monté dans la coquille");
  assert.match(shell, /<SessionCompte /, "la sortie de session doit être dans la coquille, pas dans un écran");
});

test("⚠ une seule construction de l'URL de retour", () => {
  /**
   * `signUp` et `resetPassword` la construisaient chacun de leur côté. Deux
   * expressions du même choix divergent, et il faut alors DEUX entrées dans
   * la liste blanche Supabase — dont l'oubli ne se découvre qu'au premier
   * inscrit. On interdit toute reconstruction locale de `window.location.origin`
   * dans ce fichier, hors de la fonction qui en a la charge.
   */
  // Les commentaires CITENT le défaut corrigé : les compter reviendrait à
  // interdire d'expliquer pourquoi la règle existe.
  const src = readFileSync(join(process.cwd(), "lib/auth.ts"), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const occurrences = [...src.matchAll(/window\.location\.origin/g)].length;
  assert.equal(occurrences, 1, "l'origine ne se lit qu'à un seul endroit : `urlRetourAuth`");
  assert.match(src, /export function urlRetourAuth/);
  // Et les deux appelants passent bien par elle.
  assert.match(src, /emailRedirectTo: urlRetourAuth\("\?bienvenue=1"\)/);
  assert.match(src, /redirectTo: urlRetourAuth\("compte"\)/);
});

test("⚠ le renvoi de lien existe — sans lui, un mail perdu est un compte perdu", () => {
  /**
   * Le SMTP par défaut de Supabase ne délivre qu'aux membres du projet, à
   * deux messages par heure (`docs/INSCRIPTION.md` §2.3). Sans bouton de
   * renvoi, un inscrit dont le mail n'arrive pas a un compte créé, non
   * confirmé, et aucune action possible — il ne peut même pas recommencer,
   * l'adresse est déjà prise.
   */
  const src = readFileSync(join(process.cwd(), "lib/auth.ts"), "utf8");
  assert.match(src, /export async function resendConfirmation/);
  assert.match(src, /type: "signup"/, "le renvoi doit viser la confirmation d'inscription");

  const bandeau = readFileSync(join(process.cwd(), "components/security/retour-lien.tsx"), "utf8");
  assert.match(bandeau, /resendConfirmation\(/, "le bandeau d'erreur doit OFFRIR le renvoi, pas seulement l'expliquer");
});

test("⚠ le fragment est retiré de l'URL après lecture", () => {
  /**
   * Sur un lien RÉUSSI, le fragment contient le jeton d'accès. Le laisser
   * dans la barre d'adresse le met dans l'historique, dans les captures
   * d'écran, et dans le presse-papier de qui partage la page.
   */
  const bandeau = readFileSync(join(process.cwd(), "components/security/retour-lien.tsx"), "utf8");
  assert.match(bandeau, /history\.replaceState/, "l'URL doit être nettoyée après lecture");
});
