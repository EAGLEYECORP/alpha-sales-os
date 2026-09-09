import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  LOT_MAX, PLANCHER_EFFACEMENT, PROPRIETAIRE_OPERATEUR, SEUIL_EFFACEMENT,
  allegerPourSync, etatSync, lots, planifierSync, type EmpreinteServeur,
} from "../lib/sync-prospects";
import { prospect } from "./fixtures";
import type { Prospect } from "../lib/types";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SYNCHRO — rendre le pipe visible sans jamais le perdre.
 *
 * Le CRM vit dans le navigateur, l'orchestrateur lit Supabase, et personne ne
 * remplissait la table : tout ce qui est bâti autour tournait à vide.
 *
 * Ce qui est protégé ici tient en une phrase : **une synchro peut échouer, elle
 * ne doit jamais effacer.** Le reste — quoi envoyer, quoi ignorer — n'est que
 * de l'économie de bande passante.
 * ─────────────────────────────────────────────────────────────────────
 */

const p = (id: string, maj: string): Prospect => prospect({ id, updatedAt: maj });
const emp = (id: string, maj: string): EmpreinteServeur => ({ id, maj });

// ── LE DIFF ────────────────────────────────────────────────────────────

test("sync — on n'envoie QUE ce qui a changé", () => {
  /**
   * Une fiche pèse ~3 Ko. Pousser 1 000 fiches à chaque synchro ferait 3 Mo
   * pour trois caractères modifiés — et rendrait la synchro fréquente
   * impossible, donc le pipe serveur périmé en permanence.
   */
  const plan = planifierSync(
    [p("a", "2026-01-02"), p("b", "2026-01-01"), p("c", "2026-01-01")],
    [emp("a", "2026-01-01"), emp("b", "2026-01-01")]
  );
  assert.deepEqual(plan.aEcrire.map((x) => x.id), ["a", "c"], "a a changé, c est nouvelle");
  assert.equal(plan.inchangees, 1);
  assert.deepEqual(plan.aSupprimer, []);
});

test("sync — une fiche supprimée localement disparaît du serveur", () => {
  /**
   * Sans ça, l'orchestrateur propose de relancer quelqu'un qui n'existe plus.
   * Sur un canal qui écrit à de vraies personnes, c'est la pire sorte de bug :
   * silencieux, et visible seulement par le destinataire.
   */
  const plan = planifierSync([p("a", "2026-01-01")], [emp("a", "2026-01-01"), emp("fantome", "2025-12-01")]);
  assert.deepEqual(plan.aSupprimer, ["fantome"]);
});

test("sync — le plan est DÉTERMINISTE", () => {
  // Une synchro qui change d'avis entre deux appels n'est pas une synchro.
  const locaux = [p("a", "2026-01-02"), p("b", "2026-01-01")];
  const serveur = [emp("a", "2026-01-01"), emp("z", "2025-01-01")];
  const a = planifierSync(locaux, serveur);
  const b = planifierSync(locaux, serveur);
  assert.deepEqual(a.aEcrire.map((x) => x.id), b.aEcrire.map((x) => x.id));
  assert.deepEqual(a.aSupprimer, b.aSupprimer);
});

test("sync — un serveur vide reçoit tout, sans rien supprimer", () => {
  const plan = planifierSync([p("a", "2026-01-01"), p("b", "2026-01-01")], []);
  assert.equal(plan.aEcrire.length, 2);
  assert.deepEqual(plan.aSupprimer, []);
  assert.equal(plan.effacementMassif, false, "un premier envoi n'est pas un effacement");
});

// ── LE GARDE-FOU, LE CŒUR DU MODULE ────────────────────────────────────

test("sync — un navigateur vidé N'EFFACE PAS le serveur", () => {
  /**
   * localStorage se vide tout seul : navigation privée, nettoyage du cache,
   * changement d'appareil, quota dépassé. Une réconciliation exacte
   * supprimerait alors tout le pipe côté serveur, sans rien demander.
   *
   * Perdre une synchro coûte une minute. Perdre le pipe coûte six mois.
   */
  const serveur = Array.from({ length: 50 }, (_, i) => emp(`s${i}`, "2026-01-01"));
  const plan = planifierSync([], serveur);
  assert.equal(plan.effacementMassif, true);
  assert.match(plan.resume, /Rien n'a été envoyé/);
  assert.match(plan.resume, /navigateur qui a perdu ses données/);
});

test("sync — un nettoyage normal PASSE, lui", () => {
  // Le garde-fou doit rester rare : s'il se déclenche sur un ménage ordinaire,
  // on prend l'habitude de confirmer sans lire, et il ne protège plus de rien.
  const serveur = Array.from({ length: 50 }, (_, i) => emp(`s${i}`, "2026-01-01"));
  const locaux = serveur.slice(0, 45).map((e) => p(e.id, e.maj)); // 5 supprimées sur 50
  const plan = planifierSync(locaux, serveur);
  assert.equal(plan.effacementMassif, false);
  assert.equal(plan.aSupprimer.length, 5);
});

test("sync — le seuil s'exprime en PROPORTION, avec un plancher", () => {
  /**
   * Sur un pipe de 3 fiches, en supprimer 2 est banal — un seuil en pourcentage
   * seul bloquerait sans arrêt au démarrage. Le plancher évite ce faux positif
   * là où il n'y a rien à protéger.
   */
  const petit = Array.from({ length: PLANCHER_EFFACEMENT - 1 }, (_, i) => emp(`s${i}`, "2026-01-01"));
  assert.equal(planifierSync([], petit).effacementMassif, false, "sous le plancher, aucun blocage");

  const grand = Array.from({ length: 100 }, (_, i) => emp(`s${i}`, "2026-01-01"));
  const justeSous = grand.slice(0, 100 - Math.floor(SEUIL_EFFACEMENT * 100)).map((e) => p(e.id, e.maj));
  assert.equal(planifierSync(justeSous, grand).effacementMassif, false, "juste sous le seuil, ça passe");
  assert.equal(planifierSync([], grand).effacementMassif, true);
});

test("sync — la route REVÉRIFIE le volume, elle ne fait pas confiance au client", () => {
  /**
   * Le garde-fou vit dans le navigateur, donc il est contournable : une requête
   * malformée, un onglet resté ouvert sur une vieille version, un script.
   * Une route qui accepte une liste de suppressions arbitraire est une route
   * qui vide la table.
   */
  const src = readFileSync(join(process.cwd(), "app/api/sync/prospects/route.ts"), "utf8");
  assert.match(src, /supprimer\.length > LOT_MAX/, "la route doit plafonner les suppressions");
  assert.match(src, /\.eq\("proprietaire", PROPRIETAIRE_OPERATEUR\)[\s\S]{0,80}\.in\("id", supprimer\)/,
    "la suppression doit être restreinte au périmètre de l'opérateur");
});

test("sync — une synchro de l'opérateur ne peut pas supprimer les fiches d'un client", () => {
  /**
   * Les fiches entrées par la clé API d'un client portent SON propriétaire.
   * Sans ce filtre, la première synchro de l'opérateur les effacerait toutes —
   * et le client ne comprendrait jamais pourquoi son intégration « ne marche
   * plus ».
   */
  const src = readFileSync(join(process.cwd(), "app/api/v1/prospects/route.ts"), "utf8");
  assert.match(src, /proprietaire: v\.appelant\.proprietaire/, "l'ingestion doit étiqueter le propriétaire");
  assert.equal(PROPRIETAIRE_OPERATEUR, "operateur");
});

// ── LES LOTS ───────────────────────────────────────────────────────────

test("sync — les envois sont découpés : un échec reste partiel", () => {
  // 1 000 fiches d'un coup se font refuser par les limites de plateforme, et
  // l'échec serait total au lieu d'être partiel.
  const items = Array.from({ length: LOT_MAX * 2 + 3 }, (_, i) => i);
  const decoupe = lots(items);
  assert.equal(decoupe.length, 3);
  assert.equal(decoupe[0].length, LOT_MAX);
  assert.equal(decoupe[2].length, 3);
  assert.deepEqual(decoupe.flat(), items, "aucun élément perdu ni dupliqué");
  assert.deepEqual(lots([]), []);
});

test("sync — les pièces jointes en base64 ne partent PAS", () => {
  /**
   * Un audit en data URL pèse des mégaoctets, ne sert à rien à l'orchestrateur,
   * et ferait exploser la taille des lots. On coupe le contenu, jamais la
   * référence : la fiche continue de dire ce qu'elle contient.
   */
  const avec = prospect({
    attachments: [
      { id: "a1", name: "audit.pdf", kind: "audit", size: 4_000_000, addedAt: "2026-01-01", url: "data:application/pdf;base64,AAAA" },
      { id: "a2", name: "devis.pdf", kind: "proposition", size: 12_000, addedAt: "2026-01-01", url: "prospects/a2.pdf" },
    ],
  });
  const allege = allegerPourSync(avec);
  assert.equal(allege.attachments[0].url, undefined, "la data URL est coupée");
  assert.equal(allege.attachments[0].name, "audit.pdf", "le nom reste : la fiche ne ment pas sur son contenu");
  assert.equal(allege.attachments[1].url, "prospects/a2.pdf", "un chemin de stockage est léger, on le garde");
  // Sans pièce jointe, la fiche est rendue TELLE QUELLE — même référence, pas
  // une copie : allégerait pour rien, et copier 1 000 fiches à chaque synchro
  // se paie sur un téléphone.
  const sans = prospect();
  assert.equal(allegerPourSync(sans), sans);
});

// ── L'ÉTAT AFFICHÉ ─────────────────────────────────────────────────────

test("sync — « jamais synchronisé » et « en erreur » sont deux états distincts", () => {
  /**
   * Les confondre fait chercher une panne là où il n'y a qu'un interrupteur
   * éteint — et inversement, fait croire que tout va bien alors que rien n'est
   * jamais parti.
   */
  assert.equal(etatSync({ active: false, aEcrire: 0, aSupprimer: 0 }).etat, "desactivee");
  assert.equal(etatSync({ active: true, aEcrire: 0, aSupprimer: 0 }).etat, "jamais");
  assert.equal(etatSync({ active: true, derniereErreur: "boum", aEcrire: 0, aSupprimer: 0 }).etat, "erreur");
  assert.equal(etatSync({ active: true, derniereSync: "2026-01-01T10:00:00Z", aEcrire: 2, aSupprimer: 0 }).etat, "en-retard");
  assert.equal(etatSync({ active: true, derniereSync: "2026-01-01T10:00:00Z", aEcrire: 0, aSupprimer: 0 }).etat, "a-jour");
});

test("sync — désactivée, l'écran dit ce qu'on PERD, pas juste « off »", () => {
  // Un interrupteur sans conséquence énoncée se laisse éteint par défaut, et
  // l'orchestrateur reste aveugle sans que personne ne sache pourquoi.
  const m = etatSync({ active: false, aEcrire: 0, aSupprimer: 0 }).message;
  assert.match(m, /orchestrateur ne voit rien/);
  assert.match(m, /autre appareil/);
});

// ── LE CHEMIN DE BOUT EN BOUT ──────────────────────────────────────────

test("sync — le filtre de propriétaire vit dans la lecture PARTAGÉE", () => {
  /**
   * ⚠ CE TEST NE REGARDAIT QU'UNE ROUTE, ET C'ÉTAIT SON DÉFAUT.
   *
   * Le raisonnement était juste — « la requête balayait la table entière ; au
   * deuxième locataire, l'agent de l'un lit le pipe de l'autre » — et le
   * filtre avait bien été posé sur `/api/v1/etat`. Un balayage a montré que
   * TROIS autres routes lisaient `prospects` sans lui, dont `/api/campaign/tick`,
   * qui COMPOSE DES NUMÉROS. Une règle appliquée à un endroit sur quatre.
   *
   * Le filtre vit maintenant dans `lib/lecture-serveur.ts`, et le test qui
   * compte est celui d'à côté : aucune route ne lit la table directement.
   */
  const src = readFileSync(join(process.cwd(), "lib/lecture-serveur.ts"), "utf8");
  assert.match(src, /\.eq\("proprietaire", PROPRIETAIRE_OPERATEUR\)/);
  assert.match(src, /LIMITE_LECTURE \+ 1/, "on lit une de plus pour SAVOIR qu'on tronque");
});

test("sync — le schéma accepte une écriture SANS utilisateur authentifié", () => {
  /**
   * `user_id uuid NOT NULL` rendait les écritures serveur impossibles : les
   * deux routes documentées — l'ingestion par clé API et la synchro — ne
   * pouvaient pas écrire dans leur propre table. Personne ne s'en était aperçu
   * parce que personne n'avait encore branché Supabase.
   */
  const sql = readFileSync(join(process.cwd(), "supabase/schema.sql"), "utf8");
  const table = sql.slice(sql.indexOf("create table if not exists public.prospects"), sql.indexOf(");", sql.indexOf("create table if not exists public.prospects")));
  assert.doesNotMatch(table, /user_id uuid not null/, "user_id doit être nullable pour les lignes serveur");
  assert.match(table, /proprietaire text not null default 'operateur'/);
  assert.match(sql, /prospects_proprietaire_idx/, "la lecture par propriétaire a besoin de son index");
});

test("sync — la route est INTERNE : aucune clé API, la session suffit", () => {
  /**
   * Mélanger la synchro de l'opérateur et l'ingestion des clients dans une
   * seule route aurait donné à un intégrateur tiers le pouvoir d'effacer le
   * pipe. Deux portes, deux pouvoirs.
   */
  const src = readFileSync(join(process.cwd(), "app/api/sync/prospects/route.ts"), "utf8");
  assert.doesNotMatch(src, /ALPHA_API_KEYS|autoriserApi/, "la synchro ne doit pas s'ouvrir aux clés API");

  const mw = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
  assert.match(mw, /"\/api\/sync"/, "sans ça, la route serait publique");
  const acces = readFileSync(join(process.cwd(), "lib/api-access.ts"), "utf8");
  assert.match(acces, /"\/api\/sync": "\/pipeline"/, "la route doit être traduite vers un chemin métier");
});

// ── LE SCHÉMA CONTRE LE CODE ───────────────────────────────────────────

test("schéma — toute table interrogée par le code EXISTE dans schema.sql", () => {
  /**
   * Trois tables étaient interrogées sans exister nulle part : `propositions`
   * (son SQL vivait dans une documentation), `call_sessions` et
   * `push_subscriptions` (dans aucun fichier). Conséquences silencieuses :
   * l'orchestrateur ne pouvait rien proposer, l'historique d'appels
   * disparaissait à chaque redéploiement, et les notifications cessaient sans
   * prévenir.
   *
   * Rien ne plantait — Supabase rend une erreur que le code journalise et
   * ignore. C'est exactement le genre de panne qu'un test doit attraper, parce
   * que personne ne la voit à l'usage.
   */
  const racine = process.cwd();
  const sql = readFileSync(join(racine, "supabase/schema.sql"), "utf8");

  const fichiers: string[] = [];
  const visiter = (rel: string) => {
    for (const e of readdirSync(join(racine, rel), { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const chemin = join(rel, e.name);
      if (e.isDirectory()) visiter(chemin);
      else if (/\.(ts|tsx)$/.test(e.name)) fichiers.push(chemin);
    }
  };
  for (const d of ["lib", "app"]) visiter(d);

  /**
   * ⚠ DEUX FAÇONS D'INTERROGER UNE TABLE, ET LE TEST N'EN VOYAIT QU'UNE.
   *
   * Le balayage ne cherchait que `.from("x")`, la forme du client Supabase.
   * Mais `lib/entitlements.ts` interroge en REST brut
   * (`fetch(`${url}/rest/v1/entitlements?...`)`) — invisible ici. Résultat :
   * `entitlements` était lue par le middleware À CHAQUE REQUÊTE et n'existait
   * dans aucun fichier SQL, sans qu'aucun test ne s'en aperçoive.
   *
   * C'est le trou qui a laissé passer le défaut, pas l'absence de test.
   */
  const tables = new Set<string>();
  for (const f of fichiers) {
    const src = readFileSync(join(racine, f), "utf8");
    for (const m of src.matchAll(/\.from\("([a-z_]+)"\)/g)) tables.add(m[1]);
    for (const m of src.matchAll(/\/rest\/v1\/([a-z_]+)/g)) tables.add(m[1]);
  }

  assert.ok(tables.size >= 8, `seulement ${tables.size} tables détectées — le balayage est cassé`);
  for (const t of tables) {
    assert.match(
      sql,
      new RegExp(`create table if not exists public\\.${t}\\b`),
      `la table « ${t} » est interrogée par le code mais absente de supabase/schema.sql`
    );
  }
});

test("schéma — une correction de structure existe AUSSI en migration", () => {
  /**
   * `schema.sql` est en `create table if not exists` : sur une base déjà
   * créée, il ne fait RIEN, et le SQL Editor annonce quand même « Success ».
   * Une correction qui n'existe que là ne s'appliquera jamais aux bases qui
   * tournent — c'est ainsi que `user_id NOT NULL` a survécu à sa propre
   * correction.
   */
  const mig = readFileSync(join(process.cwd(), "supabase/migrations/001-proprietaire-et-tables-serveur.sql"), "utf8");
  assert.match(mig, /alter table public\.prospects alter column user_id drop not null/);
  assert.match(mig, /add column proprietaire text not null default 'operateur'/);
  for (const t of ["propositions", "call_sessions", "push_subscriptions"]) {
    assert.match(mig, new RegExp(`create table if not exists public\\.${t}`), `migration : ${t} manquante`);
  }

  /**
   * `entitlements` a le même problème en pire : elle est lue par le
   * MIDDLEWARE, donc sur chaque requête, et son absence renvoyait
   * `DROIT_REFUSE` — un client payant refusé par l'application.
   */
  const ent = readFileSync(join(process.cwd(), "supabase/migrations/002-entitlements.sql"), "utf8");
  assert.match(ent, /create table if not exists public\.entitlements/);
  for (const col of ["tenant_id", "bricks", "statut", "essai_jusqu_a"]) {
    assert.match(ent, new RegExp(`\\b${col}\\b`), `migration 002 : colonne ${col} manquante`);
  }
  assert.match(ent, /enable row level security/, "une table de droits sans RLS est une table de droits publique");
  // Aucune policy d'écriture : un client ne s'accorde pas ses propres droits.
  assert.doesNotMatch(ent, /for (insert|update|delete)/, "l'écriture doit rester au service role");
  // Idempotence : relancer la migration ne doit rien casser.
  assert.match(mig, /information_schema\.columns/, "les ALTER doivent être conditionnels");
  assert.ok(mig.includes("begin;") && mig.includes("commit;"), "la migration doit être transactionnelle");
});
