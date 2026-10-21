import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  coutGlobalEssais,
  DUREE_CACHE_ENVELOPPE_MS,
  PLAFOND_LIGNES_POSTGREST,
  type CacheEnveloppe,
  type ClientEnveloppe,
} from "../lib/compteur-essai";
import { ENVELOPPE_OUVERTURE_EUR, etatEssai } from "../lib/essai";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ÉCHELLE (21/10/2026) — ce que « prêt pour beaucoup de comptes » veut dire
 * dans CE dépôt, et pas plus.
 *
 * Mesuré sur un vrai Postgres 16 (`scripts/mesure-echelle.sh`, 1 M de comptes) :
 *   · l'inscription est PLATE (38–61 µs/compte) — rien à réparer ;
 *   · la somme de l'enveloppe croissait avec la table (34 ms à 100 k, 110 ms à
 *     1 M), et se payait à CHAQUE requête d'un inscrit en essai : le compteur la
 *     ramène à 2–4 ms, constant ;
 *   · `adoption_stats` : linéaire (0,36 s → 3,7 s de 100 k à 1 M) ; une passe au
 *     lieu de douze relectures gagne ×1,6, sans changer la forme de la courbe.
 *
 * ⚠⚠ ET LA SOMME ÉTAIT FAUSSE, PAS SEULEMENT LENTE : elle rapatriait les lignes
 * et les additionnait en JavaScript, or PostgREST borne ses réponses (1 000 par
 * défaut). Au-delà, on additionnait les 1 000 premières — le plafond de 300 €
 * ne se refermait plus, en silence. Ces tests tiennent les trois défauts.
 *
 * ⚠ LIMITE, ÉCRITE PLUTÔT QUE TUE : ils prouvent le CODE et lisent le SQL. Que le
 * SQL calcule juste se prouve sur un vrai Postgres, par le script — ce test ne
 * lance pas de base (un test qui dépend d'un binaire absent passerait à vide).
 * ─────────────────────────────────────────────────────────────────────
 */

interface Faux {
  client: ClientEnveloppe;
  appels: { rpc: string[]; from: string[] };
}

/** Un client qui COMPTE ce qu'on lui demande — c'est ça qu'on veut prouver. */
function faux(opts: {
  rpc?: { data?: unknown; error?: { code?: string; message?: string } | null };
  lignes?: unknown[];
  erreurLignes?: boolean;
}): Faux {
  const appels = { rpc: [] as string[], from: [] as string[] };
  const client: ClientEnveloppe = {
    rpc: (nom) => {
      appels.rpc.push(nom);
      return Promise.resolve({ data: opts.rpc?.data ?? null, error: opts.rpc?.error ?? null });
    },
    from: (table) => {
      appels.from.push(table);
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: opts.erreurLignes ? null : (opts.lignes ?? []),
              error: opts.erreurLignes ? { message: "boom" } : null,
            }),
        }),
      };
    },
  };
  return { client, appels };
}

const ABSENTE = { code: "PGRST202", message: "Could not find the function public.cout_global_essais" };

/** Un cache neuf par appel : aucun cas ne dépend de l'ordre d'exécution. */
const vide = (): CacheEnveloppe => ({ entree: null });

// ── 1. LE CHEMIN RAPIDE ─────────────────────────────────────────────────

test("⚠⚠ le compteur se lit par UNE fonction, sans jamais toucher la table", async () => {
  const f = faux({ rpc: { data: "12.50" } }); // PostgREST rend un numeric en CHAÎNE
  assert.equal(await coutGlobalEssais({ client: f.client, cache: vide() }), 12.5);
  assert.deepEqual(f.appels.rpc, ["cout_global_essais"]);
  assert.deepEqual(f.appels.from, [], "une lecture de table ici, c'est le O(n) que la migration 018 retire");
});

test("⚠ une chaîne n'est pas un nombre : « 10 » + « 20 » ne vaut pas « 1020 »", async () => {
  assert.equal(await coutGlobalEssais({ client: faux({ rpc: { data: "299.99" } }).client, cache: vide() }), 299.99);
  // …et elle franchit bien le plafond : la comparaison de chaînes aurait laissé la porte ouverte.
  const v = await coutGlobalEssais({ client: faux({ rpc: { data: String(ENVELOPPE_OUVERTURE_EUR) } }).client, cache: vide() });
  assert.equal(etatEssai({ jusquA: new Date(Date.now() + 864e5).toISOString(), coutConsommeEur: 1, coutGlobalEur: v }).actif, false);
});

// ── 2. LE CACHE : une économie, jamais un mensonge ──────────────────────

test("le cache évite une lecture par navigation — et expire", async () => {
  const f = faux({ rpc: { data: 5 } });
  let t = 1_000;
  const deps = { client: f.client, maintenant: () => t, cache: vide() };
  assert.equal(await coutGlobalEssais(deps), 5);
  t += DUREE_CACHE_ENVELOPPE_MS - 1;
  assert.equal(await coutGlobalEssais(deps), 5);
  assert.equal(f.appels.rpc.length, 1, "dans la fenêtre : une seule lecture");
  t += 2;
  await coutGlobalEssais(deps);
  assert.equal(f.appels.rpc.length, 2, "la fenêtre passée, on relit");
});

test("⚠⚠ UN INCONNU NE SE MET JAMAIS EN CACHE — il ferait fermer les essais plus longtemps que la panne", async () => {
  let t = 0;
  const panne = faux({ rpc: { error: { code: "08006", message: "connection failure" } } });
  const cache = vide(); // LE MÊME pour les deux lectures — sinon le test ne peut pas voir un null resservi
  assert.equal(await coutGlobalEssais({ client: panne.client, maintenant: () => t, cache }), null);
  // La base revient 1 s plus tard : la lecture suivante doit RÉUSSIR, pas resservir le null.
  t += 1_000;
  const sain = faux({ rpc: { data: 3 } });
  assert.equal(await coutGlobalEssais({ client: sain.client, maintenant: () => t, cache }), 3);
});

// ── 3. LE REPLI NE MENT PLUS ────────────────────────────────────────────

test("sans la migration, le repli additionne — chaînes comprises", async () => {
  const f = faux({ rpc: { error: ABSENTE }, lignes: [{ cout_consomme_eur: "10.00" }, { cout_consomme_eur: "0.50" }, { cout_consomme_eur: null }] });
  assert.equal(await coutGlobalEssais({ client: f.client, cache: vide() }), 10.5, "un compteur null est ignoré, comme avant");
  assert.deepEqual(f.appels.from, ["entitlements"]);
});

test("⚠⚠ LE REPLI REFUSE DE CONCLURE AU PLAFOND DE LIGNES — un total tronqué a l'air exact", async () => {
  /**
   * Le défaut d'origine. `PLAFOND_LIGNES_POSTGREST` lignes à 1 € : si PostgREST a
   * coupé, le vrai total est plus grand et on l'ignore. Rendre 1 000 ici
   * ferait croire qu'il reste du budget. On rend `null` — et `null` FERME l'essai.
   */
  const lignes = Array.from({ length: PLAFOND_LIGNES_POSTGREST }, () => ({ cout_consomme_eur: "1.00" }));
  const f = faux({ rpc: { error: ABSENTE }, lignes });
  assert.equal(await coutGlobalEssais({ client: f.client, cache: vide() }), null);
  // Juste en dessous, on peut conclure.
  const f2 = faux({ rpc: { error: ABSENTE }, lignes: lignes.slice(1) });
  assert.equal(await coutGlobalEssais({ client: f2.client, cache: vide() }), PLAFOND_LIGNES_POSTGREST - 1);
});

test("⚠ une PANNE ne déclenche pas la requête lourde : pas de repli sur une base qui répond mal", async () => {
  const f = faux({ rpc: { error: { code: "57014", message: "canceling statement due to statement timeout" } }, lignes: [{ cout_consomme_eur: "1" }] });
  assert.equal(await coutGlobalEssais({ client: f.client, cache: vide() }), null);
  assert.deepEqual(f.appels.from, [], "rapatrier toute la table quand la base peine, c'est l'achever");
});

test("⚠ ligne du compteur absente → inconnu → l'essai FERME (jamais 0 par défaut)", async () => {
  assert.equal(await coutGlobalEssais({ client: faux({ rpc: { data: null } }).client, cache: vide() }), null);
  assert.equal(await coutGlobalEssais({ client: faux({ rpc: { data: "n'importe quoi" } }).client, cache: vide() }), null);
  assert.equal(await coutGlobalEssais({ client: null, cache: vide() }), null, "pas de client : inconnu");
});

// ── 4. LE SQL : ce qu'il faut pouvoir relire sans lancer de base ────────

const sql = readFileSync(join(process.cwd(), "supabase/migrations/018-echelle.sql"), "utf8");
const sansCommentairesSql = sql.replace(/--.*$/gm, "");

test("⚠⚠ le trigger ne touche le compteur QUE si le delta n'est pas nul — c'est ce qui garde l'inscription plate", () => {
  assert.match(sansCommentairesSql, /if delta <> 0 then[\s\S]*?update public\.enveloppe_essais/);
  // L'insertion d'un essai à coût 0 (chaque inscription) ne doit donc verrouiller aucune ligne partagée.
  assert.match(sansCommentairesSql, /new\.statut = 'essai'/);
  assert.match(sansCommentairesSql, /old\.statut = 'essai'/, "un compte qui PAIE sort de l'enveloppe : on retire sa part");
});

test("le compteur est fermé : RLS active, aucune politique, service role seul", () => {
  assert.match(sansCommentairesSql, /alter table public\.enveloppe_essais enable row level security/);
  assert.doesNotMatch(sansCommentairesSql, /create policy[^;]*enveloppe_essais/i, "aucune politique : un locataire ne lit pas NOTRE budget");
  for (const fn of ["cout_global_essais()", "ecart_enveloppe_essais()", "maj_enveloppe_essais()"]) {
    assert.ok(
      sansCommentairesSql.includes(`revoke all on function public.${fn} from public, anon, authenticated`),
      `${fn} doit être refusée à anon et aux locataires`,
    );
  }
  assert.match(sansCommentairesSql, /grant execute on function public\.cout_global_essais\(\) to service_role/);
});

test("⚠ la migration est rejouable ET transactionnelle (le verrou du recalage n'existe que dans un bloc)", () => {
  assert.match(sansCommentairesSql, /^\s*begin;/m);
  assert.match(sansCommentairesSql, /commit;\s*$/);
  assert.match(sansCommentairesSql, /lock table public\.entitlements in share mode/);
  assert.match(sansCommentairesSql, /create table if not exists public\.enveloppe_essais/);
  assert.match(sansCommentairesSql, /on conflict \(id\) do update/);
});

test("⚠⚠ adoption_stats : UNE CTE lue UNE fois — plus douze relectures d'une table matérialisée", () => {
  const corps = /create or replace function public\.adoption_stats[\s\S]*?\$\$;\s*\n\s*revoke/.exec(sansCommentairesSql)?.[0] ?? "";
  assert.ok(corps.length > 500, "le corps d'adoption_stats est introuvable dans la migration 018");
  // L'ancienne forme : `with u as (...)` puis `from u` répété. Interdite.
  assert.doesNotMatch(corps, /with u as/i);
  assert.doesNotMatch(corps, /\bfrom u\b/i, "relire une CTE matérialisée douze fois : une passe gagne ×1,6 (3,7 s → 2,3 s à 1 M) — la forme linéaire, elle, reste");
  const filtres = (corps.match(/count\(\*\) filter \(where/g) ?? []).length;
  assert.ok(filtres >= 8, `les compteurs doivent être des count(*) filter d'UN balayage (vu : ${filtres})`);
  // auth.users n'est lue que deux fois : le balayage des compteurs, et celui des 30 derniers jours.
  assert.equal((corps.match(/from auth\.users/g) ?? []).length, 2);
});

test("adoption_stats reste fermée à anon et aux locataires (elle lit des adresses de tiers)", () => {
  assert.match(sansCommentairesSql, /revoke all on function public\.adoption_stats\(text\[\]\) from anon, authenticated/);
  assert.match(sansCommentairesSql, /grant execute on function public\.adoption_stats\(text\[\]\) to service_role/);
});

// ── 5. LE BRANCHEMENT ───────────────────────────────────────────────────

test("⚠ la dérive du compteur est LUE quelque part (sinon c'est un export mort), et pour le maître seul", () => {
  const sante = readFileSync(join(process.cwd(), "app/api/health/route.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(sante, /enveloppeEcart:\s*droits\.maitre\s*\?\s*await ecartEnveloppeEssais\(\)\s*:\s*null/);
});

test("la lecture du compteur est branchée là où l'essai se juge, et nulle part ailleurs sous un autre nom", () => {
  const droits = readFileSync(join(process.cwd(), "lib/entitlements.ts"), "utf8");
  assert.match(droits, /coutGlobalEur:\s*await coutGlobalEssais\(\)/);
});
