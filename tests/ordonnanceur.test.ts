import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ORDONNANCEUR — le SQL qui réveille les deux ticks.
 *
 * `supabase/migrations/004-ordonnanceur.sql` ne tourne pas dans `npm test` :
 * c'est du SQL appliqué à la main sur un projet Supabase qu'on n'atteint pas
 * d'ici. Ce fichier ne peut donc pas prouver qu'il FONCTIONNE.
 *
 * Il prouve autre chose, et c'est ce qui casse en pratique : que ce que le SQL
 * appelle **existe encore**, avec le **bon verbe**, et qu'il ne s'est pas mis
 * à redéfinir des règles qui vivent ailleurs.
 *
 * Un ordonnanceur qui pointe vers une route renommée ne plante pas : il
 * collectionne des 404 dans une table que personne n'ouvre.
 * ─────────────────────────────────────────────────────────────────────
 */

const SQL = readFileSync(join(process.cwd(), "supabase/migrations/004-ordonnanceur.sql"), "utf8");

/** Les lignes actives, commentaires SQL retirés. */
const actif = SQL.split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

/** Les chemins réellement planifiés. */
const chemins = [...actif.matchAll(/appeler_tick\('(\/api\/[\w/-]+)'\)/g)].map((m) => m[1]);

test("⚠ CHAQUE ROUTE PLANIFIÉE EXISTE ET ACCEPTE UN POST", () => {
  /**
   * ⚠ LA RAISON D'ÊTRE DE CE FICHIER, et elle vient d'une erreur réelle.
   *
   * La première proposition était un `vercel.json`. Vercel Cron émet des
   * **GET** ; ces deux routes séparent volontairement les verbes — `GET` rend
   * le statut en lecture seule, `POST` exécute. Le cron aurait donc lu le
   * statut toutes les heures, rendu 200, et n'aurait jamais passé un appel.
   * Vert, silencieux, inutile.
   *
   * Ce test tient les deux moitiés : la route existe, et le verbe est celui
   * que le SQL emploie.
   *
   * Mutation vérifiée : renommer un chemin dans le SQL fait tomber ce test.
   */
  assert.ok(chemins.length >= 2, "l'ordonnanceur doit planifier au moins les deux ticks");

  for (const chemin of chemins) {
    const route = join(process.cwd(), "app", chemin, "route.ts");
    assert.ok(existsSync(route), `${chemin} est planifié mais la route n'existe pas`);

    const src = readFileSync(route, "utf8");
    assert.match(
      src,
      /export async function POST\(/,
      `${chemin} n'exporte pas de POST — l'ordonnanceur appellerait dans le vide`
    );
  }
});

test("⚠ AUCUN SECRET EN DUR — le fichier est versionné", () => {
  /**
   * Un secret collé ici part dans git, et un secret poussé reste dans
   * l'historique après suppression : il est brûlé, il faut le faire tourner.
   * D'où le passage par le Vault.
   *
   * On cherche la FORME d'un secret écrit à la main, pas une liste de secrets
   * connus — une liste de ce qu'il faut cacher serait une copie de ce qu'on
   * cache.
   */
  // Un `Bearer ` suivi d'autre chose qu'une concaténation de variable.
  assert.ok(
    !/'Bearer [^']*[A-Za-z0-9]{8,}/.test(actif),
    "un jeton semble écrit en dur dans l'en-tête Authorization"
  );
  // `create_secret` doit rester commenté : c'est une instruction pour l'humain,
  // pas quelque chose qu'on exécute avec une vraie valeur depuis le dépôt.
  assert.ok(
    !/^\s*select vault\.create_secret\(/m.test(actif),
    "vault.create_secret ne doit pas être actif dans le fichier versionné : la valeur finirait commitée"
  );
  // Et le secret doit bien venir du Vault, sinon la garde ci-dessus ne
  // protège rien : elle passerait aussi sur un fichier qui n'appelle personne.
  assert.match(actif, /vault\.decrypted_secrets/, "le secret doit être lu depuis le Vault");
});

test("⚠ L'ORDONNANCEUR NE REDÉFINIT PAS LA FENÊTRE D'APPEL", () => {
  /**
   * ⚠ LE PIÈGE QUE CE TEST EXISTE POUR EMPÊCHER.
   *
   * Il serait tentant d'encoder ici « n'appelle pas avant 9h, pas entre 12h et
   * 14h ». Ce serait une **deuxième définition** de « peut-on appeler
   * maintenant ? », à côté de `lib/call-cadence.ts` — et le jour où les deux
   * divergent, c'est celle du cron qui gagne, parce qu'elle s'exécute en
   * premier et que personne ne lit du SQL.
   *
   * Le cron DEMANDE, la route DÉCIDE. L'horaire du plan n'est qu'une économie
   * d'invocations : l'élargir ne peut pas produire un appel à minuit, parce
   * que `run.windowOpen` refuse.
   */
  for (const interdit of ["fenetreOuverte", "fenetre_ouverte", "prochaineFenetre", "12:00", "plafondRappels"]) {
    assert.ok(
      !actif.includes(interdit),
      `« ${interdit} » dans l'ordonnanceur : la fenêtre d'appel vit dans lib/call-cadence.ts, et nulle part ailleurs`
    );
  }

  // Et la route, elle, doit toujours la poser. Sans cette moitié, le test
  // ci-dessus se contenterait d'un système où PERSONNE ne tient la fenêtre.
  const tick = readFileSync(join(process.cwd(), "app/api/campaign/tick/route.ts"), "utf8");
  assert.match(tick, /run\.windowOpen/, "la route doit refuser hors fenêtre — c'est elle qui décide");
});

test("⚠ le plan est IDEMPOTENT — le relancer ne double pas les appels", () => {
  /**
   * `cron.schedule` sur un nom déjà pris ne lève pas d'erreur partout : sur
   * certaines versions il crée un second job. Deux jobs identiques, c'est le
   * double d'appels téléphoniques réels, et ça ne se voit qu'à la facture.
   * On déplanifie avant de planifier.
   */
  const noms = [...actif.matchAll(/cron\.schedule\('([\w-]+)'/g)].map((m) => m[1]);
  assert.ok(noms.length >= 2);
  for (const nom of noms) {
    assert.ok(
      new RegExp(`cron\\.unschedule\\('${nom}'\\)`).test(actif),
      `« ${nom} » est planifié sans être déplanifié d'abord — un second passage doublerait le job`
    );
  }
});

test("la checklist de lancement envoie vers cette migration", () => {
  /**
   * Le pendant côté doc. Une migration que le document de lancement ne cite
   * pas ne sera pas appliquée — et son absence ne produit aucune erreur :
   * les deux routes restent simplement muettes, comme aujourd'hui.
   */
  const doc = readFileSync(join(process.cwd(), "docs/CHECKLIST-LANCEMENT.md"), "utf8");
  assert.match(doc, /supabase\/migrations\/004-ordonnanceur\.sql/, "la checklist doit nommer l'ordonnanceur");
});
