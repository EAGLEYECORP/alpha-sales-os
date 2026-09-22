#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────
 * ASSEMBLE LE LOT SQL À COLLER DANS L'ÉDITEUR SUPABASE.
 *
 * ══ POURQUOI CE SCRIPT EXISTE ══
 *
 * Douze migrations, et personne ne sait lesquelles sont déjà passées sur la
 * base de production. La seule façon de lever ce doute sans accès à la base,
 * c'est de tout rejouer — ce qui n'est tenable que si tout est REJOUABLE.
 *
 * ⚠ Mesuré le 17/09/2026, fichier par fichier, pas supposé : les douze le
 * sont. `create table if not exists`, `add column` dans un `do $$ … if not
 * exists`, `alter table … enable row level security` (no-op si déjà actif),
 * `drop policy if exists` avant chaque `create policy`, `drop trigger if
 * exists` avant chaque `create trigger`. Une seule policy est gardée par un
 * `pg_policies` dans un bloc `do` — elle l'est quand même.
 *
 * ══ ⚠⚠ 004 EST EXCLU, ET C'EST LE POINT IMPORTANT ══
 *
 * `004-ordonnanceur.sql` porte une section « À REMPLIR » : deux secrets Vault
 * (`alpha_base_url`, `alpha_cron_secret`) que seul un humain peut poser. Sans
 * eux, `appeler_tick` lève une exception — DÉLIBÉRÉMENT, plutôt que d'appeler
 * la route sans en-tête d'authentification. Le mettre dans un lot « colle et
 * oublie » planifierait donc un cron qui échoue toutes les dix minutes, en
 * silence, sur une base de production.
 *
 * Il se pose SÉPARÉMENT, APRÈS les secrets. C'est une dépendance humaine, pas
 * un oubli.
 *
 * ══ POURQUOI UN GÉNÉRATEUR, ET PAS UN FICHIER ÉCRIT À LA MAIN ══
 *
 * Recopier douze fichiers dans un treizième crée deux vérités : la migration
 * corrigée un jour et le lot qui garde l'ancienne version. C'est la faute que
 * ce dépôt a payée le plus souvent. `tests/migrations-lot.test.ts` rejoue ce
 * générateur et refuse un lot qui ne correspond plus — la divergence fait
 * tomber le build au lieu d'arriver sur la base.
 *
 * Usage : npm run sql:lot
 * ─────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const RACINE = join(dirname(new URL(import.meta.url).pathname), "..");
const DOSSIER = join(RACINE, "supabase/migrations");
const SUPABASE = join(RACINE, "supabase");

/** Le lot ne contient que ce qui se rejoue SANS aucun geste humain préalable. */
// 004 ET 014 exigent pg_cron/pg_net/Vault (extensions Supabase) et un geste
// humain (secrets Vault, CAMPAIGN_AUTOPILOT). Elles ne se collent pas sur une
// base fraîche — elles se posent APRÈS, à la main.
export const EXCLUES = new Set(["004-ordonnanceur.sql", "014-autopilote-email.sql"]);

export const SORTIE = join(DOSSIER, "LOT-A-COLLER.sql");

/**
 * La vérification finale. Elle n'est pas décorative : sans elle, celui qui
 * colle voit « Success. No rows returned » et n'apprend RIEN — ni que la
 * migration a pris, ni qu'elle avait déjà pris, ni ce qui manque encore.
 *
 * ⚠ Elle interroge le CATALOGUE, jamais les données : aucune ligne de client
 * ne remonte dans une sortie qui finira collée dans une conversation.
 */
const VERIFICATION = `
-- ══════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — ce bloc rend UN TABLEAU. Lis la colonne "etat".
--
-- ⚠ Il lit le catalogue Postgres, jamais tes données : aucune ligne de
-- client ne peut remonter ici.
-- ══════════════════════════════════════════════════════════════════════
with attendu(rang, objet, present) as (
  values
    (1, 'table entitlements',
        to_regclass('public.entitlements') is not null),
    (2, 'colonne entitlements.cout_consomme_eur (essai facturable)',
        exists (select 1 from information_schema.columns
                where table_schema='public' and table_name='entitlements'
                  and column_name='cout_consomme_eur')),
    (3, 'fonction debiter_essai (débit atomique)',
        exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                where n.nspname='public' and p.proname='debiter_essai')),
    (4, 'trigger ouvrir_essai_a_l_inscription (30 jours à l''inscription)',
        exists (select 1 from pg_trigger
                where tgname='ouvrir_essai_a_l_inscription' and not tgisinternal)),
    (5, 'table agent_presence (refus d''appeler dans le vide)',
        to_regclass('public.agent_presence') is not null),
    (6, 'table tenant_credentials (BYOK)',
        to_regclass('public.tenant_credentials') is not null),
    (7, 'RLS active sur entitlements',
        coalesce((select relrowsecurity from pg_class
                  where oid = to_regclass('public.entitlements')), false))
)
select rang as "#",
       objet as "ce qui doit exister",
       case when present then 'OK' else 'MANQUE' end as "etat"
from attendu
order by rang;

-- ══════════════════════════════════════════════════════════════════════
-- L'ORDONNANCEUR (migration 004) NE SE VÉRIFIE PAS ICI, ET C'EST VOULU.
--
-- ⚠ Écrit après m'être fait piéger en l'écrivant : la requête d'origine
-- interrogeait \`cron.job\` et \`vault.decrypted_secrets\`. Ces deux objets
-- n'existent QU'APRÈS la 004 — et Postgres analyse la requête entière avant
-- de l'exécuter, donc un simple \`case when\` ne protège de rien. Sur une base
-- neuve, le lot aurait affiché une ERREUR ROUGE juste après avoir réussi.
-- C'est le pire résultat possible : ça ressemble trait pour trait à un échec.
--
-- Et avant d'avoir joué la 004, la réponse est connue d'avance — « non » : on
-- n'a pas besoin d'une requête pour l'apprendre.
--
-- APRÈS avoir posé les deux secrets Vault et joué 004-ordonnanceur.sql,
-- décommente les trois lignes ci-dessous et joue-les seules :
--
--   select name from vault.decrypted_secrets
--    where name in ('alpha_base_url','alpha_cron_secret');   -- doit rendre 2 lignes
--   select jobname, schedule, active from cron.job where jobname like 'alpha-%';
-- ══════════════════════════════════════════════════════════════════════
`;

/**
 * ⚠⚠ `schema.sql` VIENT EN PREMIER, ET C'EST UNE MESURE, PAS UNE PRÉCAUTION.
 *
 * La première version de ce lot ne contenait que les migrations. Joué sur une
 * base neuve, il s'arrête net :
 *
 *     NOTICE:  Table public.prospects absente — applique d'abord schema.sql
 *     ERROR:   relation "public.prospects" does not exist
 *
 * `001` ne CRÉE pas les tables métier, il les MODIFIE. Trouvé en exécutant le
 * lot sur un vrai Postgres, pas en le relisant — la doctrine dit de ne jamais
 * prétendre avoir testé ce qui ne l'a pas été, et c'est exactement le genre de
 * panne qu'une relecture ne voit pas.
 */
const SOCLE = "schema.sql";

export function assembler() {
  const fichiers = [
    SOCLE,
    ...readdirSync(DOSSIER)
      .filter((f) => /^\d{3}-.*\.sql$/.test(f) && !EXCLUES.has(f))
      .sort(),
  ];

  const entete = `-- ══════════════════════════════════════════════════════════════════════
-- ALPHA SALES OS — LOT À COLLER DANS L'ÉDITEUR SQL SUPABASE
--
-- ⚠ FICHIER ENGENDRÉ par scripts/bundle-migrations.mjs. Ne le modifie pas à
--   la main : un test le reconstruit et refuse toute divergence. Corrige la
--   migration, puis relance \`npm run sql:lot\`.
--
-- QUOI FAIRE : tout sélectionner, coller dans Supabase → SQL Editor → Run.
-- Une seule fois suffit. Le rejouer ne casse rien — chaque instruction est
-- protégée (vérifié fichier par fichier, pas supposé).
--
-- CE QUI N'EST PAS DEDANS : ${[...EXCLUES].join(", ")}.
-- Cette migration-là exige DEUX SECRETS VAULT posés à la main avant d'être
-- jouée. Sans eux elle planifierait un cron qui échoue toutes les dix
-- minutes, en silence. Elle se pose à part, après — la fin de ce fichier dit
-- comment la vérifier une fois qu'elle sera passée.
--
-- Migrations incluses (${fichiers.length}) :
${fichiers.map((f) => `--   · ${f}`).join("\n")}
-- ══════════════════════════════════════════════════════════════════════

`;

  const corps = fichiers
    .map((f) => {
      const sql = readFileSync(join(f === SOCLE ? SUPABASE : DOSSIER, f), "utf8").trimEnd();
      return `-- ┌────────────────────────────────────────────────────────────────────\n-- │ ${f}\n-- └────────────────────────────────────────────────────────────────────\n${sql}\n`;
    })
    .join("\n");

  return `${entete}${corps}\n${VERIFICATION}`;
}

/**
 * Deux modes, et le second existe POUR LE TEST.
 *
 * ⚠ Le harnais compile les tests en CommonJS ; il ne peut pas importer ce
 * module ESM. Plutôt que de recopier l'assemblage dans le test — la faute
 * exacte que ce fichier existe pour empêcher — le test lance le VRAI script
 * avec `--stdout` et compare. Il éprouve donc le chemin réellement utilisé,
 * pas une imitation.
 */
if (process.argv[1] && process.argv[1].endsWith("bundle-migrations.mjs")) {
  if (process.argv.includes("--stdout")) {
    process.stdout.write(assembler());
  } else {
    writeFileSync(SORTIE, assembler());
    console.log(`Lot écrit : ${SORTIE}`);
  }
}
