-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 017 — L'ADOPTION D'ALPHA SALES OS, COMPTÉE PAR LA BASE.
--
-- `/adoption` (écran des PROPRIÉTAIRES d'ALPHA SALES OS, maître seul) a besoin
-- de cinq nombres que l'API d'administration de Supabase ne rend pas à
-- l'échelle : combien de comptes existent HORS les nôtres, combien sont
-- confirmés, combien sont nés dans l'heure / la journée / la semaine / le
-- mois, combien se sont connectés, et la courbe des trente derniers jours.
-- Les calculer en lisant la liste des comptes page par page est faisable à
-- cent inscrits et impossible à dix millions. Un seul agrégat SQL, lui,
-- coûte la même chose.
--
-- ⚠⚠ CE QUI SORT : DES ENTIERS ET DES DATES. Jamais une adresse, jamais un
-- identifiant. La fonction lit `auth.users` (qui porte des adresses de tiers)
-- mais ne retourne que des comptes.
--
-- ⚠ `exclure` : les adresses des PROPRIÉTAIRES (`OWNER_EMAILS`), passées par le
-- serveur à chaque appel. Le palier « 10 » du plan dit « 10 comptes qui ne
-- sont pas les nôtres » : sans cette exclusion, on se compterait soi-même.
-- Elle ne stocke rien — la liste voyage dans l'appel et meurt avec lui.
--
-- ⚠ `last_sign_in_at` est la date de la DERNIÈRE CONNEXION (saisie du mot de
-- passe), pas de la dernière visite : une session reste ouverte des semaines.
-- « Connectés » SOUS-COMPTE donc l'usage réel. L'écran le dit.
--
-- ⚠ SECURITY DEFINER + service_role seulement. Un navigateur ne l'appelle
-- jamais : sans le `revoke` ci-dessous, n'importe quel visiteur muni de la clé
-- publique pourrait compter nos comptes. Le garde est en base ET dans la
-- route (`/api/adoption`, maître seul).
--
-- Rejouable : `create or replace`, `revoke` et `grant` sont idempotents.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.adoption_stats(exclure text[] default '{}')
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, auth
as $$
  with u as (
    select created_at, email_confirmed_at, last_sign_in_at
    from auth.users
    where email is null
       or lower(email) <> all (select lower(x) from unnest(coalesce(exclure, '{}'::text[])) x)
  )
  select jsonb_build_object(
    'total',         (select count(*) from u),
    'confirmes',     (select count(*) from u where email_confirmed_at is not null),
    'inscrits_1h',   (select count(*) from u where created_at >= now() - interval '1 hour'),
    'inscrits_24h',  (select count(*) from u where created_at >= now() - interval '24 hours'),
    'inscrits_7j',   (select count(*) from u where created_at >= now() - interval '7 days'),
    'inscrits_30j',  (select count(*) from u where created_at >= now() - interval '30 days'),
    'connectes_24h', (select count(*) from u where last_sign_in_at >= now() - interval '24 hours'),
    'connectes_7j',  (select count(*) from u where last_sign_in_at >= now() - interval '7 days'),
    'connectes_30j', (select count(*) from u where last_sign_in_at >= now() - interval '30 days'),
    'par_jour',      (
      select coalesce(jsonb_agg(jsonb_build_object('jour', j, 'n', n) order by j), '[]'::jsonb)
      from (
        select (created_at at time zone 'Europe/Paris')::date as j, count(*) as n
        from u
        where created_at >= now() - interval '30 days'
        group by 1
      ) s
    )
  );
$$;

revoke all on function public.adoption_stats(text[]) from public;
revoke all on function public.adoption_stats(text[]) from anon, authenticated;
grant execute on function public.adoption_stats(text[]) to service_role;
