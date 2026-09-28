import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE LOT SQL NE PEUT PAS DÉRIVER DE SES MIGRATIONS — 17/09/2026.
 *
 * ══ LE PROBLÈME OPÉRATIONNEL ══
 *
 * Douze migrations dans le dépôt, et aucun moyen de savoir lesquelles sont
 * passées sur la base de production : la session n'a pas accès à Supabase (le
 * proxy sortant répond **403 au CONNECT**, mesuré, ports 5432/6543/443
 * compris — aucun identifiant ne changerait ça). Celui qui a l'accès doit
 * donc coller du SQL, et il le fait souvent depuis un téléphone.
 *
 * `LOT-A-COLLER.sql` est ce qu'il colle. C'est une CONCATÉNATION, donc une
 * recopie — et une recopie diverge. C'est la faute la plus fréquente de ce
 * dépôt, et ici elle arriverait sur une base de production : la migration
 * corrigée un jour, et le lot qui porte encore l'ancienne version.
 *
 * ⚠ Ce test rejoue le VRAI script (`--stdout`) et compare au fichier commité.
 * Il n'imite pas l'assemblage : le harnais compile en CommonJS et ne peut pas
 * importer ce module ESM, donc on lance le binaire plutôt que de recopier son
 * contenu dans le test — ce qui recréerait exactement le défaut visé.
 * ─────────────────────────────────────────────────────────────────────
 */

const RACINE = process.cwd();
const LOT = join(RACINE, "supabase/migrations/LOT-A-COLLER.sql");
const SCRIPT = join(RACINE, "scripts/bundle-migrations.mjs");

const lot = () => readFileSync(LOT, "utf8");

test("⚠⚠ LE LOT EST EXACTEMENT CE QUE LE GÉNÉRATEUR PRODUIT", () => {
  const attendu = execFileSync("node", [SCRIPT, "--stdout"], { encoding: "utf8", cwd: RACINE });
  assert.equal(
    lot(),
    attendu,
    "LOT-A-COLLER.sql a dérivé de ses migrations — relance `npm run sql:lot` au lieu de l'éditer à la main",
  );
});

test("⚠⚠ `schema.sql` VIENT EN PREMIER — et ce n'est pas cosmétique", () => {
  /**
   * Trouvé en EXÉCUTANT le lot sur un Postgres réel, pas en le relisant. La
   * première version ne contenait que les migrations numérotées, et s'arrêtait
   * net sur une base neuve :
   *
   *     NOTICE:  Table public.prospects absente — applique d'abord schema.sql
   *     ERROR:   relation "public.prospects" does not exist
   *
   * `001` ne CRÉE pas les tables métier, il les MODIFIE. Un lot dont le premier
   * fichier n'est pas le socle est un lot qui échoue chez le seul utilisateur
   * qui en a besoin : celui dont la base est vide.
   */
  const texte = lot();
  const iSocle = texte.indexOf("│ schema.sql");
  const i001 = texte.indexOf("│ 001-");
  assert.ok(iSocle > 0, "le socle doit être dans le lot");
  assert.ok(iSocle < i001, "…et AVANT la première migration, qui ne fait qu'altérer ses tables");
});

test("⚠⚠ 004 RESTE DEHORS TANT QU'IL EXIGE UN GESTE HUMAIN", () => {
  /**
   * `004-ordonnanceur.sql` lit deux secrets dans le Vault et **lève une
   * exception** s'ils manquent — délibérément, plutôt que d'appeler la route
   * sans en-tête d'authentification. Le glisser dans un lot « colle et
   * oublie » planifierait un cron qui échoue toutes les dix minutes, en
   * silence, sur une base de production.
   *
   * ⚠ Le test ne fige pas « 004 est exclu » : il exige que l'exclusion ait
   * toujours SA RAISON. Le jour où la migration n'a plus besoin du Vault,
   * cette assertion tombe — et c'est le signal qu'elle peut rentrer.
   */
  const src = readFileSync(join(RACINE, "supabase/migrations/004-ordonnanceur.sql"), "utf8");
  assert.match(src, /vault\.decrypted_secrets/, "004 lit encore le Vault : il reste hors du lot");
  assert.match(src, /raise exception/i, "…et il échoue franchement quand le secret manque");

  assert.ok(!lot().includes("│ 004-"), "le lot ne doit pas contenir 004");
  assert.match(lot(), /004-ordonnanceur\.sql/, "…mais il doit DIRE qu'il ne le contient pas, et pourquoi");
});

test("⚠⚠ 014 RESTE DEHORS POUR LA MÊME RAISON QUE 004", () => {
  /**
   * `014-autopilote-email.sql` PLANIFIE `mail-tick` via `pg_cron` et réutilise
   * `appeler_tick` (donc le Vault de 004). Sur une base fraîche, `cron.schedule`
   * n'existe pas : la coller dans le lot ferait échouer tout le lot. Comme pour
   * 004, l'exclusion doit garder SA RAISON — le jour où elle ne dépend plus de
   * pg_cron, cette assertion tombe et elle peut rentrer.
   */
  const src = readFileSync(join(RACINE, "supabase/migrations/014-autopilote-email.sql"), "utf8");
  assert.match(src, /cron\.schedule/, "014 planifie encore via pg_cron : il reste hors du lot");
  assert.ok(!lot().includes("│ 014-"), "le lot ne doit pas contenir 014");
  assert.match(lot(), /014-autopilote-email\.sql/, "…mais il doit DIRE qu'il ne le contient pas");
});

test("⚠⚠ LA VÉRIFICATION NE RÉFÉRENCE NI `cron.job` NI LE VAULT", () => {
  /**
   * Le piège dans lequel je suis tombé en écrivant ce bloc. Ces deux objets
   * n'existent qu'APRÈS 004 — et Postgres analyse la requête entière avant de
   * l'exécuter, donc un `case when` ne protège de rien : la requête échoue à
   * l'analyse. Sur une base neuve, le lot aurait affiché une ERREUR ROUGE
   * juste après avoir réussi.
   *
   * C'est le pire résultat possible pour un outil de vérification : il
   * ressemble trait pour trait à l'échec qu'il est censé écarter. Même famille
   * que le moniteur qui affiche du calme quand la base est morte.
   *
   * ⚠ On cherche hors commentaires : le fichier EXPLIQUE le piège en toutes
   * lettres, et un garde qui lit la prose se ferait satisfaire par elle — le
   * défaut déjà payé par le garde de `deploiementSansSerrure`.
   */
  const sansCommentaires = lot()
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");
  const verif = sansCommentaires.slice(sansCommentaires.indexOf("with attendu("));
  assert.ok(verif.length > 0, "le bloc de vérification doit exister");
  assert.ok(!/cron\.job/.test(verif), "cron.job n'existe pas avant 004 : la requête échouerait à l'analyse");
  assert.ok(!/vault\./.test(verif), "idem pour le Vault");
});

test("⚠ AUCUNE MIGRATION N'EST OUBLIÉE EN SILENCE", () => {
  /**
   * Le mode de panne d'un générateur qui filtre : une migration `013` nommée
   * autrement (préfixe non numérique, extension différente) sortirait du lot
   * sans que personne ne le voie. Le lot serait valide, complet en apparence,
   * et il manquerait la dernière — celle qu'on venait d'écrire.
   */
  const surDisque = readdirSync(join(RACINE, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && f !== "LOT-A-COLLER.sql")
    .sort();
  const dansLeLot = surDisque.filter((f) => lot().includes(`│ ${f}`));
  const manquantes = surDisque.filter((f) => !dansLeLot.includes(f));

  assert.deepEqual(
    manquantes,
    ["004-ordonnanceur.sql", "014-autopilote-email.sql"],
    "seuls 004 et 014 peuvent manquer (pg_cron/Vault), pour la raison écrite dans les tests précédents",
  );
});

test("⚠ LE LOT NE PORTE AUCUN SECRET", () => {
  /**
   * Il est fait pour être collé dans un éditeur en ligne, et donc pour
   * traverser un presse-papier, une conversation, parfois une capture d'écran.
   * `004` porte justement la section « À REMPLIR » en COMMENTAIRE, sans
   * valeur — c'est la raison de plus pour qu'il reste dehors.
   */
  const texte = lot();
  assert.ok(!/eyJhbGciOi/.test(texte), "pas de JWT");
  assert.ok(!/\bsk_live_|\bsbp_|\bnvapi-/.test(texte), "pas de clé de service");
  assert.ok(!/create_secret\s*\(\s*'[^']{8,}'/.test(texte), "aucun secret Vault en clair");
});
