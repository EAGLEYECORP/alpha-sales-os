-- ─────────────────────────────────────────────────────────────────────
-- L'ÉCHELLE : deux lectures qui grandissaient avec le nombre de comptes.
--
-- Mesuré le 21/10/2026 sur un Postgres 16 réel, migrations 002 → 017 rejouées,
-- 1 000 → 1 000 000 de comptes (`scripts/mesure-echelle.sh`, reproductible) :
--
--   · l'INSCRIPTION est plate : 38 à 61 µs par compte, quelle que soit la
--     taille de la table. Le démarreur d'essai (012) est en O(1). Rien à
--     réparer — et c'est à garder, c'est le chemin que tout nouvel arrivant
--     emprunte ;
--   · la SOMME DE L'ENVELOPPE croissait avec la table (34 ms à 100 k, 110 ms à
--     1 M — linéaire, donc ≈ 1,1 s à 10 M, EXTRAPOLÉ et non mesuré) et se
--     payait à CHAQUE requête d'un inscrit en essai (`resoudreDroits` →
--     `coutGlobalEssais`). Le compteur la ramène à 2–4 ms, constant ;
--   · `adoption_stats` : 0,36 s (100 k) → 3,7 s (1 M), linéaire. Une passe au
--     lieu de douze relectures gagne ×1,6 (0,24 s → 2,3 s) : c'est un mieux,
--     PAS une réparation d'échelle — voir la fin de ce fichier.
--
-- ⚠ CORRECTION D'UN CHIFFRE QUE J'AVAIS ÉCRIT : « 0,4 s → 7,3 s, pire que
-- linéaire ». Il venait d'une première passe où les `VACUUM` avaient échoué
-- (deux instructions dans un même `-c` s'exécutent dans un bloc, et `VACUUM`
-- refuse). Sans carte de visibilité la mesure était gonflée. Refaite proprement
-- et rejouable : `scripts/mesure-echelle.sh`.
--
-- ⚠⚠ ET LA SOMME N'ÉTAIT PAS SEULEMENT LENTE, ELLE ÉTAIT FAUSSE AU-DELÀ DE
-- ~1 000 ESSAIS. Elle se faisait côté application : `select cout_consomme_eur
-- … where statut = 'essai'`, toutes les lignes rapatriées, additionnées en
-- JavaScript. PostgREST borne les réponses (1 000 lignes par défaut chez
-- Supabase — Settings → API → Max rows, à lire dans le tableau de bord, pas
-- supposé ici). Au-delà, on additionne les 1 000 premières lignes et on
-- ignore le reste : **le plafond de 300 € qui doit fermer l'ouverture ne se
-- refermait plus, et rien ne le disait.** C'est la garde de sécurité qui
-- s'ouvre en silence sous la charge — l'inverse de l'invariant du dépôt
-- (« en cas de doute, on ferme »).
--
-- ⚠ POURQUOI UN COMPTEUR, ALORS QUE `lib/compteur-essai.ts` REFUSAIT « UNE
-- TABLE DE COMPTEURS » (« deux définitions de la même quantité »).
-- La règle était juste tant que la somme coûtait quelques lignes. À 1 M elle
-- coûte un quart de seconde par requête, à 10 M deux secondes et demie. On
-- change donc de réponse, pas de principe : **la SOMME reste LA définition**,
-- le compteur n'en est que la copie tenue à jour par un trigger, et
-- `ecart_enveloppe_essais()` rend les deux côte à côte. Si elles divergent un
-- jour, la différence se lit au lieu de se supposer.
--
-- ⚠ LE TRIGGER NE TOUCHE LE COMPTEUR QUE SI LE DELTA N'EST PAS NUL. C'est ce
-- qui garde l'inscription plate : l'insertion d'un essai à `cout = 0` ne
-- verrouille rien. Seules les DÉPENSES réelles passent par la ligne unique du
-- compteur, et elles sont déjà limitées par ce qu'elles coûtent vraiment.
--
-- ⚠ Rejouable : la création est `if not exists`, le recalage est un upsert.
-- ─────────────────────────────────────────────────────────────────────

-- ⚠ Tout dans UNE transaction : le verrou du recalage n'existe que dans un
-- bloc, et un script collé dans l'éditeur SQL ne garantit pas d'en avoir un.
begin;

-- ── 1. LE COMPTEUR DE L'ENVELOPPE ─────────────────────────────────────

-- Le verrou garde le recalage cohérent : entre la somme et la pose du trigger,
-- aucune dépense ne doit passer (elle serait comptée deux fois, ou jamais).
lock table public.entitlements in share mode;

create table if not exists public.enveloppe_essais (
  id         boolean primary key default true check (id),   -- une seule ligne, par construction
  total_eur  numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);

-- Aucune politique : RLS active et fermée. Le trigger (security definer) et le
-- service role passent ; ni `anon` ni un locataire ne lisent NOTRE budget.
alter table public.enveloppe_essais enable row level security;
revoke all on public.enveloppe_essais from public, anon, authenticated;

-- Recalage sur la SOMME (la définition). `null` compte pour 0, comme avant :
-- l'ancien code ignorait les lignes sans compteur.
insert into public.enveloppe_essais (id, total_eur, updated_at)
select true, coalesce(sum(cout_consomme_eur), 0), now()
  from public.entitlements
 where statut = 'essai'
on conflict (id) do update
   set total_eur = excluded.total_eur,
       updated_at = excluded.updated_at;

create or replace function public.maj_enveloppe_essais()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta numeric := 0;
begin
  -- Ce que la ligne contribuait AVANT (seulement si elle était en essai)…
  if tg_op in ('UPDATE', 'DELETE') and old.statut = 'essai' then
    delta := delta - coalesce(old.cout_consomme_eur, 0);
  end if;
  -- …et ce qu'elle contribue APRÈS. Un compte qui PASSE de « essai » à « actif »
  -- (il paie) sort de l'enveloppe : l'y laisser ferait fermer l'ouverture
  -- d'autant plus vite qu'on vend mieux.
  if tg_op in ('INSERT', 'UPDATE') and new.statut = 'essai' then
    delta := delta + coalesce(new.cout_consomme_eur, 0);
  end if;

  if delta <> 0 then
    update public.enveloppe_essais
       set total_eur = total_eur + delta,
           updated_at = now()
     where id;
  end if;
  return null;
end;
$$;

revoke all on function public.maj_enveloppe_essais() from public, anon, authenticated;

drop trigger if exists entitlements_enveloppe on public.entitlements;
create trigger entitlements_enveloppe
  after insert or update of statut, cout_consomme_eur or delete
  on public.entitlements
  for each row execute function public.maj_enveloppe_essais();

-- Ce que lit l'application. Une ligne absente rend `null`, et `null` FERME
-- l'essai (`etatEssai` : l'inconnu vaut refus) — on ne rend jamais 0 par défaut.
create or replace function public.cout_global_essais()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select total_eur from public.enveloppe_essais where id;
$$;

-- La somme et le compteur, côte à côte : c'est la sonde de dérive.
create or replace function public.ecart_enveloppe_essais()
returns table (compteur numeric, somme numeric, ecart numeric)
language sql
stable
security definer
set search_path = public
as $$
  select e.total_eur,
         s.somme,
         e.total_eur - s.somme
    from public.enveloppe_essais e,
         lateral (
           select coalesce(sum(cout_consomme_eur), 0) as somme
             from public.entitlements
            where statut = 'essai'
         ) s
   where e.id;
$$;

revoke all on function public.cout_global_essais() from public, anon, authenticated;
revoke all on function public.ecart_enveloppe_essais() from public, anon, authenticated;
grant execute on function public.cout_global_essais() to service_role;
grant execute on function public.ecart_enveloppe_essais() to service_role;

-- ── 2. `adoption_stats` : UNE passe, pas douze ────────────────────────
--
-- ⚠ L'ancienne version nommait une CTE `u` et la relisait douze fois. Depuis
-- PostgreSQL 12, une CTE lue plusieurs fois est MATÉRIALISÉE, puis relue à
-- chaque référence. Les compteurs deviennent des `count(*) filter (…)` d'un même
-- balayage ; le détail par jour fait son propre passage, borné aux 30 derniers
-- jours (aucun index sur `auth.users.created_at` : on ne touche pas au schéma
-- d'authentification, qui est celui de Supabase).
--
-- ⚠ CE QUE ÇA NE RÉPARE PAS, et il faut le dire : la fonction reste LINÉAIRE
-- (≈ 2,3 µs par compte, soit ≈ 23 s à 10 M — extrapolé, non mesuré). C'est
-- tolérable pour un écran de propriétaires ouvert quelques fois par jour, pas
-- au-delà de quelques millions de comptes ; à ce palier, il faudra une table
-- d'agrégats tenue au fil de l'eau (décision à prendre, palier 100 000 de
-- docs/OBJECTIF-10M.md) — pas un index sur le schéma `auth` de Supabase.
--
-- ⚠ MÊME RÉSULTAT, PROUVÉ. La sortie est comparée octet pour octet à l'ancienne
-- version sur le jeu de 1 M de comptes (adresses nulles, exclusions en
-- majuscules, comptes de la dernière heure) — `scripts/mesure-echelle.sh`,
-- DANS LA MÊME INSTRUCTION (les compteurs dépendent de `now()` : comparer un
-- résultat figé à un résultat calculé plus tard échoue pour de mauvaises raisons).
--
-- ⚠ Une adresse d'exclusion `null` ne vide plus tout : avec `<> all` sur un
-- tableau contenant `null`, la comparaison vaut `null` pour CHAQUE ligne et la
-- fonction rendait zéro compte. L'application les retire déjà (« vides
-- retirées »), mais une garde qui dépend de l'appelant n'en est pas une.
create or replace function public.adoption_stats(exclure text[] default '{}')
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  with ex as (
    select coalesce(array_agg(lower(x)), '{}'::text[]) as a
      from unnest(coalesce(exclure, '{}'::text[])) x
     where x is not null
  ),
  agg as (
    select count(*)                                                                  as total,
           count(*) filter (where u.email_confirmed_at is not null)                  as confirmes,
           count(*) filter (where u.created_at >= now() - interval '1 hour')         as inscrits_1h,
           count(*) filter (where u.created_at >= now() - interval '24 hours')       as inscrits_24h,
           count(*) filter (where u.created_at >= now() - interval '7 days')         as inscrits_7j,
           count(*) filter (where u.created_at >= now() - interval '30 days')        as inscrits_30j,
           count(*) filter (where u.last_sign_in_at >= now() - interval '24 hours')  as connectes_24h,
           count(*) filter (where u.last_sign_in_at >= now() - interval '7 days')    as connectes_7j,
           count(*) filter (where u.last_sign_in_at >= now() - interval '30 days')   as connectes_30j
      from auth.users u, ex
     where u.email is null or lower(u.email) <> all (ex.a)
  ),
  jours as (
    select coalesce(jsonb_agg(jsonb_build_object('jour', j, 'n', n) order by j), '[]'::jsonb) as v
      from (
        select (u.created_at at time zone 'Europe/Paris')::date as j, count(*) as n
          from auth.users u, ex
         where u.created_at >= now() - interval '30 days'
           and (u.email is null or lower(u.email) <> all (ex.a))
         group by 1
      ) s
  )
  select jsonb_build_object(
    'total',         agg.total,
    'confirmes',     agg.confirmes,
    'inscrits_1h',   agg.inscrits_1h,
    'inscrits_24h',  agg.inscrits_24h,
    'inscrits_7j',   agg.inscrits_7j,
    'inscrits_30j',  agg.inscrits_30j,
    'connectes_24h', agg.connectes_24h,
    'connectes_7j',  agg.connectes_7j,
    'connectes_30j', agg.connectes_30j,
    'par_jour',      jours.v
  )
  from agg, jours;
$$;

revoke all on function public.adoption_stats(text[]) from public;
revoke all on function public.adoption_stats(text[]) from anon, authenticated;
grant execute on function public.adoption_stats(text[]) to service_role;

comment on table public.enveloppe_essais is
  'Copie tenue par trigger de la somme des couts des essais (la SOMME reste la definition : voir ecart_enveloppe_essais()). Une ligne.';

commit;
