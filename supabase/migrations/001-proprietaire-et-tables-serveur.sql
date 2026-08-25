-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 001 — rendre les écritures SERVEUR possibles.
--
-- ── POURQUOI CE FICHIER EXISTE ──
--
-- `schema.sql` est écrit en `create table if not exists`. Sur une base déjà
-- créée, il ne fait donc RIEN : les corrections apportées au schéma ne
-- s'appliquent jamais. C'est le piège classique du fichier de schéma unique,
-- et il est silencieux — le script s'exécute « avec succès » sans rien changer.
--
-- ── CE QUE ÇA RÉPARE ──
--
-- 1. `prospects.user_id` était `NOT NULL`. Or les deux routes serveur écrivent
--    avec le service role, SANS session Supabase : elles ne pouvaient pas
--    écrire dans leur propre table. La synchro et l'ingestion par clé API
--    étaient mortes à la naissance.
-- 2. Trois tables que le code interroge n'existaient nulle part :
--    `propositions` (l'orchestrateur), `call_sessions` (Alpha Voice) et
--    `push_subscriptions` (les notifications). Leur SQL vivait dans une
--    documentation ou dans aucun fichier.
--
-- ── COMMENT L'APPLIQUER ──
--
-- Supabase Dashboard → SQL Editor → coller ce fichier entier → Run.
-- Idempotent : le relancer ne casse rien et ne duplique rien.
-- Sans danger sur une base vierge : chaque bloc vérifie avant d'agir.
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — l'environnement de
-- développement ne l'atteint pas. Relis la sortie du SQL Editor plutôt que de
-- supposer que ça a marché, et fais une sauvegarde avant si la base contient
-- déjà des fiches.
-- ─────────────────────────────────────────────────────────────────────

begin;

-- ── 1. PROSPECTS : ouvrir la table aux écritures serveur ───────────────

-- La table peut ne pas exister encore (base vierge) : tout est conditionnel.
do $$
begin
  if to_regclass('public.prospects') is null then
    raise notice 'Table public.prospects absente — applique d''abord schema.sql, puis relance cette migration.';
    return;
  end if;

  -- `user_id` devient nullable. Une ligne sans utilisateur reste INVISIBLE aux
  -- clients : les policies comparent `auth.uid() = user_id`, et une comparaison
  -- avec NULL ne vaut jamais TRUE. Seul le service role, qui contourne la RLS,
  -- voit ces lignes. Rien ne fuit d'un locataire à l'autre.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'prospects'
      and column_name = 'user_id' and is_nullable = 'NO'
  ) then
    alter table public.prospects alter column user_id drop not null;
    raise notice 'prospects.user_id : NOT NULL retiré.';
  end if;

  -- `proprietaire` distingue les lignes serveur. Même convention que
  -- `propositions` : « operateur » pour la synchro, le nom du propriétaire de
  -- la clé API pour une ingestion client. C'est lui qui empêche une synchro de
  -- l'opérateur d'effacer les fiches entrées par un client.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'prospects' and column_name = 'proprietaire'
  ) then
    alter table public.prospects add column proprietaire text not null default 'operateur';
    raise notice 'prospects.proprietaire : colonne ajoutée.';
  end if;
end $$;

-- L'orchestrateur et la synchro lisent PAR PROPRIÉTAIRE, jamais par
-- utilisateur : sans cet index, chaque lecture balaie la table.
create index if not exists prospects_proprietaire_idx on public.prospects (proprietaire);

-- ── 2. PROPOSITIONS — ce que l'agent dépose, ce que tu tranches ─────────
--
-- Sans cette table, l'orchestrateur ne peut rien proposer : le SQL vivait
-- uniquement dans docs/ORCHESTRATEUR.md, donc personne ne l'exécutait en
-- appliquant schema.sql.
create table if not exists public.propositions (
  id           text primary key,
  proprietaire text not null default 'operateur',
  data         jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists propositions_proprietaire_idx on public.propositions (proprietaire);

-- Aucune policy : seul le service role y accède. Une proposition ne se lit ni
-- ne s'écrit depuis un navigateur client — c'est le serveur qui arbitre.
alter table public.propositions enable row level security;

-- ── 3. CALL_SESSIONS — la trace des appels Alpha Voice ─────────────────
--
-- Colonnes calées sur `toRow()` dans app/api/voice/session/route.ts. Sans la
-- table, les sessions vivent en mémoire et disparaissent au redéploiement :
-- la salle de contrôle affiche alors un historique vide sans dire pourquoi.
create table if not exists public.call_sessions (
  id                  text primary key,
  room                text not null,
  prospect_id         text,
  account_id          text,
  direction           text not null,
  peer                text,
  started_at          timestamptz not null,
  ended_at            timestamptz,
  state               text not null,
  turns               jsonb not null default '[]'::jsonb,
  outcome             text,
  recording_announced boolean not null default false,
  recording_url       text,
  error               text
);
-- La liste se lit du plus récent au plus ancien, filtrée par fiche.
create index if not exists call_sessions_started_idx on public.call_sessions (started_at desc);
create index if not exists call_sessions_prospect_idx on public.call_sessions (prospect_id);

alter table public.call_sessions enable row level security;

-- ── 4. PUSH_SUBSCRIPTIONS — les notifications qui survivent au déploiement ──
--
-- Sans la table, les abonnements sont gardés EN MÉMOIRE : un redéploiement les
-- efface et les notifications cessent sans prévenir. La route le dit déjà à
-- l'écran ; cette table est la réponse.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    text,
  p256dh     text not null,
  auth       text not null,
  -- Compteur d'échecs : un abonnement mort se retire au lieu d'être retenté
  -- indéfiniment.
  failures   integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

commit;

-- ── VÉRIFICATION — à exécuter APRÈS, et à LIRE ─────────────────────────
--
-- Le SQL Editor annonce « Success » même quand un bloc conditionnel n'a rien
-- fait. Cette requête dit ce qui existe RÉELLEMENT.
--
--   select
--     (select count(*) from information_schema.columns
--       where table_schema='public' and table_name='prospects'
--         and column_name='proprietaire')                       as prospects_proprietaire,
--     (select is_nullable from information_schema.columns
--       where table_schema='public' and table_name='prospects'
--         and column_name='user_id')                            as user_id_nullable,
--     to_regclass('public.propositions')                        as propositions,
--     to_regclass('public.call_sessions')                       as call_sessions,
--     to_regclass('public.push_subscriptions')                  as push_subscriptions;
--
-- Attendu : 1 · YES · public.propositions · public.call_sessions ·
--           public.push_subscriptions.
-- Un `null` dans une colonne = la table n'a pas été créée, et la
-- fonctionnalité correspondante restera silencieusement inerte.
