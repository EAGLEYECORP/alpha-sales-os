-- ═══════════════════════════════════════════════════════════════════════
-- 006 — LES RENDEZ-VOUS : une cloison, et un chemin d'écriture.
--
-- ── CE QUE CETTE MIGRATION RÉPARE ──
--
-- 1. `meetings` était LUE côté serveur par deux routes — `/api/calendar` (le
--    flux iCal auquel l'opérateur abonne son agenda) et `/api/push/tick` (la
--    notification du matin) — et ÉCRITE PAR PERSONNE. Les rendez-vous vivaient
--    uniquement dans le store du navigateur, et le moteur de synchro ne
--    poussait que des fiches prospects.
--
--    Conséquence exacte : l'agenda partagé servait un calendrier VIDE et la
--    notification du matin n'annonçait AUCUN rendez-vous. Les deux routes
--    rendaient 200. Un agenda vide ressemble à une journée libre — c'est le
--    mode de panne qui ne se voit pas.
--
-- 2. `meetings.user_id` est `NOT NULL`. Or la synchro écrit avec le SERVICE
--    ROLE, sans session Supabase : elle ne pouvait pas insérer une seule
--    ligne. Même défaut que `prospects` avant la migration 001, et même
--    correctif — sinon la synchro serait morte à la naissance.
--
-- 3. `RDV_SANS_CLOISON` (lib/lecture-serveur.ts) disait, écrit noir sur
--    blanc, que la lecture des rendez-vous était « bornée, pas cloisonnée » :
--    le service role voyait ceux de tous les utilisateurs. Le trou était
--    NOMMÉ et pas refermé, et docs/ROADMAP-TRILLION.md le portait comme tel.
--
--    ⚠ L'ordre compte. Poser le chemin d'écriture SANS la colonne aurait
--    rempli une table non cloisonnée — c'est-à-dire rendu le trou utile au
--    lieu de le refermer. La colonne vient d'abord, dans la même migration.
--
-- ── COMMENT L'APPLIQUER ──
--
-- Supabase Dashboard → SQL Editor → coller ce fichier entier → Run.
-- Idempotent : le relancer ne casse rien et ne duplique rien.
-- ═══════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if to_regclass('public.meetings') is null then
    raise notice 'Table public.meetings absente — applique d''abord schema.sql, puis relance cette migration.';
    return;
  end if;

  -- `user_id` devient nullable. Une ligne sans utilisateur reste INVISIBLE aux
  -- clients : les policies comparent `auth.uid() = user_id`, et une
  -- comparaison avec NULL ne vaut jamais TRUE. Seul le service role, qui
  -- contourne la RLS, voit ces lignes. Rien ne fuit d'un locataire à l'autre.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meetings'
      and column_name = 'user_id' and is_nullable = 'NO'
  ) then
    alter table public.meetings alter column user_id drop not null;
    raise notice 'meetings.user_id : NOT NULL retiré.';
  end if;

  -- La cloison. Même convention que `prospects` et `propositions`.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meetings' and column_name = 'proprietaire'
  ) then
    alter table public.meetings add column proprietaire text not null default 'operateur';
    raise notice 'meetings.proprietaire : colonne ajoutée.';
  end if;

  -- `version` porte l'empreinte du contenu (lib/sync-meetings.ts).
  --
  -- ⚠ POURQUOI UNE COLONNE ET PAS `updatedAt` COMME LES FICHES : le type
  -- `Meeting` n'a pas de date de modification, et lui en ajouter une
  -- demanderait de migrer l'état déjà persisté dans les navigateurs pour un
  -- gain nul. L'empreinte du contenu répond mieux à la vraie question — « ce
  -- rendez-vous a-t-il changé ? » — qu'une date qu'on peut oublier de toucher.
  --
  -- Elle est stockée en colonne et pas recalculée à la lecture : le serveur
  -- doit pouvoir rendre ses empreintes SANS déplier chaque `data` jsonb, sinon
  -- la requête de comparaison coûte autant que de tout télécharger — ce que
  -- les empreintes existent précisément pour éviter.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meetings' and column_name = 'version'
  ) then
    alter table public.meetings add column version text not null default '';
    raise notice 'meetings.version : colonne ajoutée.';
  end if;
end $$;

-- La lecture serveur filtre PAR PROPRIÉTAIRE : sans cet index, chaque tick de
-- notification et chaque requête du flux iCal balaient la table entière.
create index if not exists meetings_proprietaire_idx on public.meetings (proprietaire);

commit;

-- ── VÉRIFICATION APRÈS APPLICATION ──
--
-- Un `Success` du SQL Editor ne dit RIEN : les blocs sont conditionnels et un
-- fichier qui n'a rien fait réussit aussi. Ce qui fait foi :
--
--   select
--     (select count(*) from information_schema.columns
--       where table_schema='public' and table_name='meetings'
--         and column_name='proprietaire')                        as a_proprietaire,
--     (select count(*) from information_schema.columns
--       where table_schema='public' and table_name='meetings'
--         and column_name='version')                             as a_version,
--     (select is_nullable from information_schema.columns
--       where table_schema='public' and table_name='meetings'
--         and column_name='user_id')                             as user_id_nullable;
--
-- Attendu : 1, 1, YES.
--
-- Puis, une fois la synchro activée dans Réglages, le test qui fait vraiment
-- foi — celui qui prouve que le tuyau coule :
--
--   select count(*) from public.meetings where proprietaire = 'operateur';
--
-- Zéro après une synchro réussie veut dire que rien n'a été poussé, pas que
-- tu n'as pas de rendez-vous.
