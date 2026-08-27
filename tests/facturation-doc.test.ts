import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OFFRES } from "../lib/offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE MODE D'EMPLOI DOIT DIRE LA VÉRITÉ — sinon il fabrique la panne.
 *
 * `docs/FACTURATION.md` est cité par le code lui-même : le message d'erreur
 * du checkout y renvoie. C'est donc le premier endroit où quelqu'un ira quand
 * le paiement refusera, et un document périmé le fera travailler dans le vide.
 *
 * ⚠ CE QU'IL DISAIT ENCORE CE MATIN, alors que le tunnel avait changé :
 *  · deux offres payables (Solo, Pro) — il y en a QUATRE ;
 *  · le parcours passe par `/compte` — il passe par `/souscrire`, et `/compte`
 *    est derrière le mot de passe pour un inconnu ;
 *  · « applique schema.sql » — or il est en `create table if not exists` et ne
 *    fait RIEN sur une base existante. Sans la migration 002, la table
 *    `entitlements` n'existe pas et le client paie pour se faire refuser.
 *
 * Un document se périme en silence. Ces tests le rattachent au code.
 * ─────────────────────────────────────────────────────────────────────
 */

const doc = readFileSync(join(process.cwd(), "docs/FACTURATION.md"), "utf8");

test("le doc nomme TOUTES les offres payables — et le code fait foi", () => {
  /**
   * On lit la grille, on ne recopie pas la liste : recopier revaliderait la
   * copie. Une cinquième offre ajoutée demain fera échouer ce test tant que
   * le mode d'emploi ne l'aura pas apprise.
   */
  const payables = OFFRES.filter((o) => o.cadence !== "devis" && o.priceEnv);
  assert.ok(payables.length >= 4, "la grille doit contenir les offres payables");
  for (const o of payables) {
    assert.ok(doc.includes(o.priceEnv!), `${o.priceEnv} (offre « ${o.nom} ») absent du mode d'emploi`);
  }
});

test("le doc dit que l'essai est un paiement UNIQUE", () => {
  /**
   * Créer le prix Stripe en récurrent prélèverait 290 € tous les mois à
   * quelqu'un qui croyait payer une mise en route. Le code déduit le mode de
   * la cadence — mais si le prix est mal créé chez Stripe, c'est Stripe qui
   * gagne, et le mode d'emploi est le seul garde-fou.
   */
  const essai = OFFRES.find((o) => o.id === "essai")!;
  assert.equal(essai.cadence, "unique", "si l'essai devenait mensuel, ce test doit être réécrit");
  assert.match(doc, /paiement \*\*UNIQUE\*\*|paiement UNIQUE/i);
  assert.match(doc, /tous les mois à quelqu'un qui croyait payer une mise en route/i);
});

test("le doc envoie sur /souscrire, pas sur une route derrière le mot de passe", () => {
  assert.match(doc, /`\/souscrire`/, "la page publique d'achat doit être nommée");
  // Le parcours de test ne doit plus commencer par « /compte → S'abonner ».
  assert.doesNotMatch(doc, /`\/compte` → \*\*S'abonner\*\*/, "ce parcours envoyait l'acheteur sur /gate");
});

test("⚠ le doc EXIGE la migration des droits, sans laquelle le client paie pour rien", () => {
  /**
   * Le piège est double : `schema.sql` est en `create table if not exists`,
   * donc il ne fait rien sur une base existante — ET le SQL Editor annonce
   * quand même « Success ». Il faut le dire, pas seulement lister le fichier.
   */
  assert.match(doc, /002-entitlements\.sql/);
  assert.match(doc, /create table if not exists/, "le piège de schema.sql doit être expliqué");
  assert.match(doc, /Success/, "…y compris le « Success » trompeur");
  assert.match(doc, /accès refusé|refuser/i, "et la conséquence : le client paie et se fait refuser");
});

test("le parcours de test vérifie les DEUX tables, pas seulement l'abonnement", () => {
  /**
   * Vérifier `subscriptions` seule laisse passer exactement le défaut qui a
   * coûté le plus cher : l'argent enregistré, les droits fermés. Les deux
   * tables se contredisaient en silence.
   */
  assert.match(doc, /`subscriptions`/);
  assert.match(doc, /`entitlements`/);
  assert.match(doc, /Si la seconde est vide/i, "il faut dire quoi conclure si elle est vide");
});

test("le parcours de test couvre la RÉSILIATION", () => {
  // Sans cette étape, on ne sait pas si résilier coûte quoi que ce soit au
  // client — et pendant une semaine, ça ne coûtait rien.
  assert.match(doc, /annule/i);
  assert.match(doc, /suspendu/, "la révocation des droits doit être vérifiée, pas supposée");
});

test("le doc ne promet jamais qu'une redirection prouve un paiement", () => {
  // Même règle que dans le code : seul le webhook confirme. Un mode d'emploi
  // qui dit « le statut passe Actif au retour » apprend le contraire.
  assert.match(doc, /ne dit JAMAIS « paiement confirmé »|une redirection n'est pas\s*\n?\s*une preuve/i);
});

test("le doc reste honnête sur ce qui n'a pas été testé pour de vrai", () => {
  /**
   * La section « Honnêteté » existait déjà et elle est la meilleure partie du
   * document. Elle doit survivre aux réécritures — y compris aux miennes.
   */
  assert.match(doc, /## ⚠ Honnêteté/);
  assert.match(doc, /[Nn]on testé contre un vrai compte Stripe/);
  assert.match(doc, /pas été jouée contre un vrai projet Supabase/i);
});
