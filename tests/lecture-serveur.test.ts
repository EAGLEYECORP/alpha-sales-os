import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LIMITE_LECTURE, RDV_SANS_CLOISON } from "../lib/lecture-serveur";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CLOISONNER LA LECTURE SERVEUR — la règle qui n'était appliquée qu'une fois.
 *
 * Le service role de Supabase CONTOURNE la RLS : c'est ce qui lui permet
 * d'écrire sans session utilisateur, et c'est aussi ce qui fait que toute
 * lecture serveur voit la table ENTIÈRE si personne ne la filtre.
 *
 * Le raisonnement était déjà écrit dans `/api/v1/etat`. Le filtre y avait été
 * posé, et nulle part ailleurs. Ces tests le rendent structurel.
 * ─────────────────────────────────────────────────────────────────────
 */

const racine = process.cwd();
const lire = (f: string) => readFileSync(join(racine, f), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Toutes les routes API du dépôt. */
function routes(dir = "app/api", acc: string[] = []): string[] {
  for (const e of readdirSync(join(racine, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) routes(p, acc);
    else if (e.name === "route.ts") acc.push(p);
  }
  return acc;
}

/**
 * ⚠ LES SEULES ROUTES AUTORISÉES À TOUCHER CES TABLES DIRECTEMENT, chacune
 * avec sa raison. Une liste sans raison se remplit par commodité.
 */
const EXCEPTIONS: Record<string, string> = {
  "app/api/sync/prospects/route.ts":
    "C'est LA synchro : elle définit la convention de propriétaire au lieu de la consommer, et elle écrit autant qu'elle lit.",
  "app/api/sync/meetings/route.ts":
    "Même raison que la synchro des fiches, plus une qui lui est propre : elle lit `id, version` pour rendre les EMPREINTES, pas les rendez-vous. Passer par `lireMeetingsBornes` rendrait des `Meeting[]` complets plafonnés à LIMITE_LECTURE — c'est-à-dire télécharger tout l'agenda pour savoir quoi envoyer, ce que les empreintes existent précisément pour éviter. Elle porte quand même le filtre de propriétaire, et un test le vérifie.",
  "app/api/v1/prospects/route.ts":
    "Ingestion par clé API : elle lit par identifiants fournis (`.in`), pas la table, et doit voir le propriétaire des lignes existantes pour REFUSER une collision entre locataires.",
  "app/api/voice/session/route.ts":
    "Lecture d'UNE fiche par son identifiant (`maybeSingle`) pour armer un appel — pas un balayage.",
};

test("⚠ AUCUNE ROUTE NE BALAYE `prospects` OU `meetings` PAR ELLE-MÊME", () => {
  /**
   * ⚠ LE TEST QUI FERME VRAIMENT LE TROU.
   *
   * L'ancien contrôle regardait le TEXTE d'une seule route. Il passait au vert
   * pendant que trois autres lisaient la table entière — dont
   * `/api/campaign/tick`, qui compose de vrais numéros. Le jour où un second
   * locataire existe, notre cron appelle SES prospects, avec notre ligne, sur
   * notre facture, et en engageant sa relation client. La requête est valide :
   * elle rend simplement plus de lignes qu'elle ne devrait, et rien n'échoue.
   *
   * Mutation vérifiée : remettre `db.from("prospects").select("data")` dans
   * n'importe quelle route non exceptée fait tomber ce test.
   */
  const fautes: string[] = [];

  for (const f of routes()) {
    if (EXCEPTIONS[f]) continue;
    const src = sansCommentaires(lire(f));
    for (const table of ["prospects", "meetings"]) {
      // Une LECTURE : `.from("table")` suivi d'un `.select(`. Les écritures
      // (upsert/update/delete) ne sont pas le sujet ici.
      const re = new RegExp(`from\\(\\s*["']${table}["']\\s*\\)[\\s\\S]{0,80}?\\.select\\(`);
      if (re.test(src)) fautes.push(`${f} → ${table}`);
    }
  }

  assert.deepEqual(
    fautes,
    [],
    `lecture(s) directe(s) : ${fautes.join(" · ")} — passe par lib/lecture-serveur.ts (filtre + borne)`
  );
});

test("chaque exception porte sa RAISON, et le fichier existe", () => {
  // Une exception sans motif écrit devient une habitude, puis la règle.
  for (const [f, pourquoi] of Object.entries(EXCEPTIONS)) {
    assert.ok(lire(f).length > 0, `${f} est excepté mais n'existe pas`);
    assert.ok(pourquoi.length > 60, `${f} : exception sans raison suffisante`);
  }
});

test("⚠ UNE COLLISION D'IDENTIFIANT ENTRE LOCATAIRES SE REFUSE, elle ne fusionne pas", () => {
  /**
   * ⚠ FAILLE RÉELLE, TROUVÉE À LA RELECTURE, ET EXPLOITABLE.
   *
   * `/api/v1/prospects` lisait la fiche existante en `select("id, data")` —
   * sans savoir à qui elle appartenait — puis faisait un `upsert` sur `id`,
   * qui est la clé primaire GLOBALE de la table.
   *
   * Donc : tout porteur d'une clé API valide qui connaît ou devine un
   * identifiant récupérait la fiche d'un AUTRE locataire (stade, timeline,
   * notes, montant du deal) fusionnée dans la sienne, puis réécrite sous SON
   * propriétaire. La victime perdait la ligne. Aucune erreur, aucun journal.
   *
   * Refuser coûte un import à refaire ; fusionner coûte le pipe de quelqu'un
   * d'autre.
   *
   * Mutation vérifiée : retirer le filtre `ligne.proprietaire !== …` fait
   * tomber ce test.
   */
  const src = sansCommentaires(lire("app/api/v1/prospects/route.ts"));

  assert.match(src, /select\("id, proprietaire, data"\)/, "il faut LIRE le propriétaire pour pouvoir le comparer");
  assert.match(
    src,
    /ligne\.proprietaire !== v\.appelant\.proprietaire/,
    "une ligne d'un autre propriétaire doit être écartée avant la fusion"
  );
  // Et le refus se DIT : un import silencieusement amputé se découvre des
  // semaines plus tard, quand les fiches manquantes se remarquent.
  assert.match(src, /refuseesAutreProprietaire/, "le nombre de fiches refusées doit remonter dans la réponse");
});

test("⚠ le trou qui RESTE est nommé, pas tu", () => {
  /**
   * `meetings` n'a pas de colonne propriétaire : elle porte `user_id` et
   * s'appuie sur la RLS, que le service role contourne. Aucun filtre écrit ne
   * peut y remédier — il faudrait une migration ET un changement du chemin
   * d'écriture, ce qui ne se fait pas depuis un environnement qui n'atteint
   * aucune base réelle.
   *
   * On borne, on ne prétend pas cloisonner, et on l'écrit. Un trou nommé se
   * referme un jour ; un trou tacite se découvre en production.
   */
  assert.ok(RDV_SANS_CLOISON.length > 120, "le trou doit être décrit, pas mentionné");
  assert.match(RDV_SANS_CLOISON, /migration/, "…et la sortie doit être nommée");

  const sql = lire("supabase/schema.sql");
  const table = sql.slice(sql.indexOf("create table if not exists public.meetings"));
  assert.ok(
    !table.slice(0, table.indexOf(");")).includes("proprietaire"),
    "si `meetings` a gagné une colonne propriétaire, ce trou est refermé : mets à jour lib/lecture-serveur.ts"
  );
});

test("la limite de lecture n'existe qu'à un seul endroit", () => {
  /**
   * Elle valait 2 000 dans le tick et 2 000 dans le moniteur, écrits
   * séparément. Deux constantes pour la même borne finissent par diverger —
   * et l'écran se met alors à contredire la machine qu'il surveille.
   */
  assert.equal(LIMITE_LECTURE, 2000);

  /**
   * ⚠ Le contrôle porte sur la RE-DÉCLARATION de la borne du pipe, pas sur
   * tout `.limit()` : une première version refusait n'importe quel plafond à
   * trois chiffres et signalait un `.limit(500)` parfaitement légitime sur une
   * AUTRE table. Un test qui crie sur du code correct finit désactivé.
   */
  for (const f of ["app/api/campaign/tick/route.ts", "app/api/moniteur/route.ts", "app/api/v1/etat/route.ts"]) {
    const src = sansCommentaires(lire(f));
    assert.ok(!/LIMITE_LECTURE\s*=/.test(src), `${f} redéclare la borne au lieu de l'importer`);
    assert.ok(!/\.limit\(\s*200[01]\s*\)/.test(src), `${f} repose la borne du pipe à la main`);
  }
});
