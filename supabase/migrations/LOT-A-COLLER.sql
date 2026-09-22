-- ══════════════════════════════════════════════════════════════════════
-- ALPHA SALES OS — LOT À COLLER DANS L'ÉDITEUR SQL SUPABASE
--
-- ⚠ FICHIER ENGENDRÉ par scripts/bundle-migrations.mjs. Ne le modifie pas à
--   la main : un test le reconstruit et refuse toute divergence. Corrige la
--   migration, puis relance `npm run sql:lot`.
--
-- QUOI FAIRE : tout sélectionner, coller dans Supabase → SQL Editor → Run.
-- Une seule fois suffit. Le rejouer ne casse rien — chaque instruction est
-- protégée (vérifié fichier par fichier, pas supposé).
--
-- CE QUI N'EST PAS DEDANS : 004-ordonnanceur.sql, 014-autopilote-email.sql.
-- Cette migration-là exige DEUX SECRETS VAULT posés à la main avant d'être
-- jouée. Sans eux elle planifierait un cron qui échoue toutes les dix
-- minutes, en silence. Elle se pose à part, après — la fin de ce fichier dit
-- comment la vérifier une fois qu'elle sera passée.
--
-- Migrations incluses (13) :
--   · schema.sql
--   · 001-proprietaire-et-tables-serveur.sql
--   · 002-entitlements.sql
--   · 003-organisation.sql
--   · 005-presence-agent.sql
--   · 006-rendez-vous-cloisonnes.sql
--   · 007-attribution-apporteurs.sql
--   · 008-essai-plafond-cout.sql
--   · 009-trace-destinataire.sql
--   · 010-byok-identifiants.sql
--   · 011-byok-email.sql
--   · 012-ouverture-30-jours.sql
--   · 013-commandes-alpha.sql
-- ══════════════════════════════════════════════════════════════════════

-- ┌────────────────────────────────────────────────────────────────────
-- │ schema.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- ALPHA SALES OS® — Supabase schema
-- Local-first app: each table stores full row payload as JSONB (`data`)
-- keyed by the client-generated id, scoped per user with RLS.
-- Apply: Supabase Dashboard → SQL Editor → paste & run.
--
-- ⚠ CE FICHIER EST EN `create table if not exists` : sur une base DÉJÀ créée,
-- il ne modifie RIEN, en silence. Toute correction de structure doit donc
-- exister DEUX fois — ici pour les nouvelles bases, et dans
-- `supabase/migrations/` pour celles qui tournent déjà.
-- ─────────────────────────────────────────────────────────────────────

-- Prospects ------------------------------------------------------------
-- ⚠ DEUX ÉCRIVAINS, DEUX MODÈLES D'ACCÈS, UNE SEULE TABLE.
--
--  · le NAVIGATEUR d'un locataire SaaS écrit avec la clé anon + une session
--    authentifiée : `user_id` est renseigné, la RLS l'isole ;
--  · le SERVEUR écrit avec le service role, sans session — pour la synchro de
--    l'opérateur (`/api/sync/prospects`) et pour l'ingestion par clé API
--    (`/api/v1/prospects`). Ces lignes-là n'ont pas d'utilisateur : elles
--    portent `proprietaire`, comme la table `propositions`.
--
-- `user_id` était NOT NULL, ce qui rendait les écritures serveur IMPOSSIBLES :
-- les deux routes documentées ne pouvaient pas écrire dans leur propre table.
-- Il devient nullable. Une ligne sans `user_id` reste invisible aux clients
-- (les policies RLS comparent à auth.uid()), donc rien ne fuit d'un locataire
-- à l'autre — seul le service role, qui contourne la RLS, les voit.
create table if not exists public.prospects (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  proprietaire text not null default 'operateur',
  data jsonb not null,
  -- generated columns for indexing/queries without unpacking jsonb in app code
  stage text generated always as (data->>'stage') stored,
  sector text generated always as (data->>'sector') stored,
  company text generated always as (data->>'company') stored,
  updated_at timestamptz not null default now()
);

-- Le registre des codes d'apport. Voir migration 007 : l'attribution qu'il
-- porte est IMMUABLE (trigger sur `entitlements`) — une attribution qui se
-- réécrit est une attribution qui se vole.
create table if not exists public.apporteur_codes (
  code text primary key,
  apporteur_id uuid not null references auth.users (id) on delete cascade,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

create table if not exists public.campaigns (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Audit log (append-only) ----------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  actor text not null,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

-- Tables SERVEUR ---------------------------------------------------------
-- Ni RLS par utilisateur, ni session : seul le service role y accède. Elles
-- portent `proprietaire` quand il faut distinguer l'opérateur d'un client.
--
-- ⚠ Ces trois-là étaient interrogées par le code sans exister nulle part :
-- le SQL de `propositions` vivait dans une documentation, les deux autres
-- n'existaient dans aucun fichier. Résultat : l'orchestrateur ne pouvait rien
-- proposer, l'historique d'appels disparaissait à chaque redéploiement, et les
-- notifications cessaient sans prévenir.

-- Ce que l'agent DÉPOSE, et que l'humain tranche. Rien ne s'exécute d'ici.
create table if not exists public.propositions (
  id           text primary key,
  proprietaire text not null default 'operateur',
  data         jsonb not null,
  created_at   timestamptz not null default now()
);

-- ── LE BATTEMENT DE L'AGENT VOCAL ──
--
-- Une seule ligne, écrasée toutes les 30 s par `voice/agent.py`. Elle répond à
-- « y a-t-il quelqu'un au bout ? » avant que l'autopilote compose un numéro :
-- LiveKit n'expose pas la liste des workers, donc l'agent s'annonce et son
-- silence vaut absence. Sans elle, un poste éteint laisse le cron appeler dans
-- le vide — le prospect décroche, personne ne parle, et les journaux restent
-- verts. Voir lib/presence-agent.ts et supabase/migrations/005.
create table if not exists public.agent_presence (
  cle    text primary key,
  vu_le  timestamptz not null default now()
);

alter table public.agent_presence enable row level security;
-- Aucune politique : cette table ne se touche que par le service role. Un
-- battement falsifiable serait pire que pas de battement.

-- La trace des appels Alpha Voice. Colonnes calées sur `toRow()` dans
-- app/api/voice/session/route.ts.
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

-- Les abonnements aux notifications. Sans cette table ils vivent en MÉMOIRE,
-- et un redéploiement les efface sans que personne le remarque.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    text,
  p256dh     text not null,
  auth       text not null,
  failures   integer not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes ----------------------------------------------------------------
create index if not exists prospects_user_stage_idx on public.prospects (user_id, stage);
-- La synchro et l'orchestrateur lisent par propriétaire, jamais par utilisateur.
create index if not exists prospects_proprietaire_idx on public.prospects (proprietaire);
create index if not exists prospects_user_sector_idx on public.prospects (user_id, sector);
create index if not exists meetings_user_idx on public.meetings (user_id);
create index if not exists campaigns_user_idx on public.campaigns (user_id);
create index if not exists activities_user_idx on public.activities (user_id);
create index if not exists propositions_proprietaire_idx on public.propositions (proprietaire);
create index if not exists call_sessions_started_idx on public.call_sessions (started_at desc);
create index if not exists call_sessions_prospect_idx on public.call_sessions (prospect_id);

-- updated_at trigger -------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['prospects','campaigns','meetings','activities'] loop
    execute format('drop trigger if exists touch_%I on public.%I', t, t);
    execute format(
      'create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- Row Level Security --------------------------------------------------------
alter table public.prospects enable row level security;
alter table public.campaigns enable row level security;
alter table public.meetings enable row level security;
alter table public.activities enable row level security;
alter table public.audit_log enable row level security;
-- Tables serveur : RLS activée SANS aucune policy = personne n'y accède, sauf
-- le service role qui la contourne. C'est le verrou voulu.
alter table public.propositions enable row level security;
alter table public.call_sessions enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['prospects','campaigns','meetings','activities'] loop
    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    -- UPDATE : `using` filtre les lignes modifiables (les tiennes) ET `with
    -- check` interdit de réaffecter la ligne à un autre user_id. Postgres
    -- réutiliserait `using` comme check par défaut, mais on l'écrit noir sur
    -- blanc — l'isolation se prouve, elle ne se déduit pas.
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "audit select own" on public.audit_log;
drop policy if exists "audit insert own" on public.audit_log;
create policy "audit select own" on public.audit_log for select using (auth.uid() = user_id);
create policy "audit insert own" on public.audit_log for insert with check (auth.uid() = user_id);
-- no update/delete policies: audit log is append-only

-- ⚠ MULTI-LOCATAIRE — tables SERVICE ROLE (contournent la RLS)
-- Les 3 tables ci-dessous (inbound_events, tracking_messages, crm_records)
-- sont écrites/lues par le SERVICE ROLE. Elles portent désormais un `user_id`
-- (nullable) : les routes serveur (/api/send, /api/track/*, /api/crm/patch,
-- /api/webhooks/inbound) l'estampillent depuis le JWT du commercial (lib/
-- tenant.ts) et FILTRENT leurs lectures dessus. Isolation applicative, pas RLS
-- (le service role l'ignore de toute façon). En mode solo (sans compte),
-- user_id reste null → pool unique, comportement d'origine. Détails et limites
-- (attribution des webhooks entrants) dans docs/PREUVE-RLS.md.

-- Inbound webhook events -------------------------------------------------
-- Written by the /api/webhooks/inbound route using the SERVICE ROLE key
-- (server-side only). RLS is enabled with NO policies: anon/authenticated
-- clients cannot touch it; only the service role bypasses RLS.
create table if not exists public.inbound_events (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  received_at timestamptz not null default now(),
  type text not null,
  email text not null,
  name text,
  campaign_id text,
  message text not null default '',
  processed boolean not null default false
);
-- Ajoute la colonne sur une base déjà créée (idempotent).
alter table public.inbound_events add column if not exists user_id uuid references auth.users (id) on delete cascade;
create index if not exists inbound_unprocessed_idx on public.inbound_events (processed, received_at desc);
create index if not exists inbound_user_idx on public.inbound_events (user_id, processed, received_at desc);
alter table public.inbound_events enable row level security;

-- Tracking email/DM (ouvertures & clics) --------------------------------
-- Écrit par /api/send + /api/track/* avec le SERVICE ROLE key. RLS activée
-- SANS policy : seul le service role y accède. `links` = JSONB des liens
-- tracés [{ idx, url, clicks }].
create table if not exists public.tracking_messages (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  channel text not null default 'email',
  prospect_id text,
  campaign_id text,
  email text,
  subject text,
  created_at timestamptz not null default now(),
  opens integer not null default 0,
  clicks integer not null default 0,
  last_open_at timestamptz,
  last_click_at timestamptz,
  links jsonb not null default '[]'::jsonb
);
alter table public.tracking_messages add column if not exists user_id uuid references auth.users (id) on delete cascade;
-- Destinataire NORMALISÉ (email en minuscules, téléphone en E.164) — sert à
-- répondre « lui a-t-on déjà écrit ? », donc à n'exiger la mention de
-- provenance qu'au PREMIER message. Voir migrations/009-trace-destinataire.sql.
alter table public.tracking_messages add column if not exists destinataire text;
create index if not exists tracking_destinataire_idx on public.tracking_messages (user_id, channel, destinataire);
create index if not exists tracking_prospect_idx on public.tracking_messages (prospect_id, created_at desc);
create index if not exists tracking_campaign_idx on public.tracking_messages (campaign_id, created_at desc);
-- rate-limit durable (comptage par canal sur la dernière heure), scopé locataire
create index if not exists tracking_channel_created_idx on public.tracking_messages (channel, created_at desc);
create index if not exists tracking_user_channel_idx on public.tracking_messages (user_id, channel, created_at desc);
-- dédup « déjà contacté » (email minuscule + fenêtre de refroidissement)
create index if not exists tracking_email_created_idx on public.tracking_messages (email, created_at desc);
create index if not exists tracking_user_email_idx on public.tracking_messages (user_id, email, created_at desc);
alter table public.tracking_messages enable row level security;

-- CRM centralisé (infos critiques app → Supabase → Google Sheets) ------------
-- L'app dépose ici (via /api/crm/patch, service role) les infos critiques
-- saisies par l'humain. Le n8n de l'utilisateur lit les lignes non synchronisées
-- (synced_to_sheet = false), les écrit dans Google Sheets, puis repasse le flag
-- à true. `data` = ligne CRM (clés alignées sur le schéma Sheets).
create table if not exists public.crm_records (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  company text,
  data jsonb not null default '{}'::jsonb,
  synced_to_sheet boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.crm_records add column if not exists user_id uuid references auth.users (id) on delete cascade;
create index if not exists crm_records_unsynced_idx on public.crm_records (synced_to_sheet, updated_at desc);
create index if not exists crm_records_user_unsynced_idx on public.crm_records (user_id, synced_to_sheet, updated_at desc);
alter table public.crm_records enable row level security;

-- Abonnements (facturation Stripe) --------------------------------------------
-- Écrit par le webhook /api/webhooks/stripe (SERVICE ROLE) ; lu par le compte
-- lui-même. Une ligne par commercial, clé = user_id. La RLS autorise la LECTURE
-- de SA propre ligne (le navigateur affiche son statut avec anon + JWT) ; les
-- écritures passent uniquement par le service role (le webhook).
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "sub select own" on public.subscriptions;
create policy "sub select own" on public.subscriptions for select using (auth.uid() = user_id);
-- pas de policy insert/update/delete : réservé au service role (webhook Stripe)

-- Droits d'accès (provisionnés par le webhook Stripe) ------------------------
-- ⚠ Cette table était INTERROGÉE par lib/entitlements.ts (resoudreDroits, via
-- le middleware, donc à chaque requête) sans exister nulle part. Toute lecture
-- échouait et retombait sur DROIT_REFUSE : un client payant était refusé.
-- Voir supabase/migrations/002-entitlements.sql pour les bases déjà créées.
create table if not exists public.entitlements (
  tenant_id uuid primary key references auth.users (id) on delete cascade,
  bricks text[] not null default '{}',
  statut text not null default 'suspendu',
  essai_jusqu_a timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
drop policy if exists "ent select own" on public.entitlements;
create policy "ent select own" on public.entitlements for select using (auth.uid() = tenant_id);
-- pas de policy insert/update/delete : réservé au service role (webhook Stripe)

-- Realtime -------------------------------------------------------------------
-- Dashboard → Database → Replication → enable for prospects/meetings if you
-- want live team sync, then subscribe client-side with sb.channel(...).

-- Storage (attachments) --------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments own" on storage.objects;
create policy "attachments own" on storage.objects
  for all
  using (bucket_id = 'attachments' and owner = auth.uid())
  with check (bucket_id = 'attachments' and owner = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- L'ORGANISATION — responsables, membres, et l'accès support.
--
-- ⚠ Détail complet, raisonnement et politiques RLS :
-- `supabase/migrations/003-organisation.sql`. Elles sont ici pour que ce
-- fichier reste la carte COMPLÈTE des tables (un test l'exige : toute table
-- interrogée par le code doit y figurer, sinon une requête échoue en silence
-- et le code journalise une erreur que personne ne lit).
--
-- ⚠⚠ `create table if not exists` : sur une base DÉJÀ créée, ce fichier ne
-- fait RIEN et le SQL Editor annonce quand même « Success ». C'est la
-- migration 003 qu'il faut passer, pas celui-ci.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.organisation (
  tenant_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'responsable' check (role in ('maitre', 'responsable', 'membre')),
  parent_id uuid references auth.users (id) on delete set null,
  libelle text,
  cree_le timestamptz not null default now(),
  constraint parent_seulement_pour_membre check (
    (role = 'membre' and parent_id is not null)
    or (role <> 'membre' and parent_id is null)
  ),
  constraint pas_son_propre_parent check (parent_id is null or parent_id <> tenant_id)
);
create index if not exists organisation_parent_idx on public.organisation (parent_id);
alter table public.organisation enable row level security;

create table if not exists public.acces_support (
  tenant_id uuid primary key references auth.users (id) on delete cascade,
  consenti boolean not null default false,
  expire_le timestamptz,
  contrat_sous_traitance boolean not null default false,
  maj_le timestamptz not null default now()
);
alter table public.acces_support enable row level security;

create table if not exists public.journal_acces_support (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references auth.users (id) on delete cascade,
  operateur_id uuid references auth.users (id) on delete set null,
  objet text not null,
  motif text,
  le timestamptz not null default now()
);
create index if not exists journal_acces_tenant_idx on public.journal_acces_support (tenant_id, le desc);
alter table public.journal_acces_support enable row level security;

-- ── BYOK : identifiants apportés par le locataire ─────────────────────
-- Détail et motifs : supabase/migrations/010-byok-identifiants.sql
-- ⚠ RLS actif et AUCUNE policy : personne ne lit cette table depuis un JWT
-- client, pas même le propriétaire de la ligne. On écrit, on ne relit pas.
create table if not exists public.tenant_credentials (
  tenant_id       uuid        not null references auth.users (id) on delete cascade,
  capacite        text        not null check (capacite in ('ia', 'email')),
  secret_chiffre  text        not null,
  nonce           text        not null,
  cle_version     integer     not null default 1,
  empreinte       text        not null,
  cree_le         timestamptz not null default now(),
  verifie_le      timestamptz,
  dernier_echec   text,
  primary key (tenant_id, capacite)
);
alter table public.tenant_credentials enable row level security;

-- ── File de commandes « dis à Alpha quoi faire » (pont Telegram) ──────
-- Détail et motifs : supabase/migrations/013-commandes-alpha.sql
-- ⚠ RLS actif, AUCUNE policy : le service role écrit, personne ne lit depuis
-- un JWT client. Boîte de RÉCEPTION, pas moteur : la note est stockée, pas
-- exécutée.
create table if not exists public.commandes_alpha (
  id       bigint generated always as identity primary key,
  chat_id  text        not null,
  texte    text        not null,
  source   text        not null default 'telegram',
  traitee  boolean     not null default false,
  cree_le  timestamptz not null default now()
);
alter table public.commandes_alpha enable row level security;

-- ┌────────────────────────────────────────────────────────────────────
-- │ 001-proprietaire-et-tables-serveur.sql
-- └────────────────────────────────────────────────────────────────────
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

-- ┌────────────────────────────────────────────────────────────────────
-- │ 002-entitlements.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 002 — la table des DROITS, que le code interrogeait déjà.
--
-- ── LE DÉFAUT ──
--
-- `lib/entitlements.ts` → `resoudreDroits()` interroge
-- `/rest/v1/entitlements` à chaque requête passant par le middleware, dès que
-- les comptes sont activés. **Cette table n'existait dans aucun fichier SQL.**
-- L'appel échouait, la fonction retombait sur `DROIT_REFUSE`, et TOUT compte
-- non-maître était refusé.
--
-- Autrement dit, le chemin normal d'un client payant était :
--   il paie → le webhook écrit `subscriptions` → le middleware lit
--   `entitlements` → aucune ligne → accès refusé.
--
-- Le commentaire de `resoudreDroits` décrivait déjà ce cas comme « un client
-- qu'on a oublié ». Il ne s'agissait pas d'un oubli occasionnel : c'était le
-- comportement par défaut de tout nouveau client.
--
-- Ça ne se voyait pas parce que `comptesActifs()` est faux tant qu'aucun
-- système de comptes n'est configuré — donc en mode solo, le middleware saute
-- entièrement ce contrôle. Le jour où on vend en ligne, il ne le saute plus.
--
-- ── CE QUE FAIT CE FICHIER ──
--
-- Crée `public.entitlements` avec exactement les colonnes que le code lit :
-- `tenant_id`, `bricks`, `statut`, `essai_jusqu_a`. Le webhook Stripe la
-- remplit à l'encaissement (`lib/entitlements-provision.ts`).
--
-- ── COMMENT L'APPLIQUER ──
--
-- Supabase Dashboard → SQL Editor → coller ce fichier entier → Run.
-- Idempotent : le relancer ne casse rien.
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — l'environnement de
-- développement ne l'atteint pas. Relis la sortie du SQL Editor plutôt que de
-- supposer que ça a marché.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.entitlements (
  tenant_id uuid primary key references auth.users (id) on delete cascade,
  -- Les identifiants de briques ouvertes : « crm », « alpha-voice », etc.
  -- Même espace de noms que `BrickId` (lib/bricks-access.ts) et que les
  -- `capacites` des offres publiques — le code filtre sur cette liste, donc
  -- une valeur inconnue est ignorée plutôt que d'ouvrir un droit fantôme.
  bricks text[] not null default '{}',
  -- « essai » | « actif » | « suspendu ». Toute autre valeur est relue comme
  -- « suspendu » par `resoudreDroits` : dans le doute, on n'ouvre pas.
  statut text not null default 'suspendu',
  -- Fin d'essai. NULL hors période d'essai.
  essai_jusqu_a timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- Un compte lit SES droits, et rien d'autre. C'est ce qui permet à l'écran
-- d'expliquer ce qui est ouvert sans passer par le service role.
drop policy if exists "ent select own" on public.entitlements;
create policy "ent select own" on public.entitlements
  for select using (auth.uid() = tenant_id);

-- Aucune policy insert/update/delete : l'écriture est réservée au SERVICE
-- ROLE, c'est-à-dire au webhook Stripe. Un client ne s'accorde pas ses
-- propres droits — c'est la seule raison d'être de cette table.

-- Retrouver les comptes en fin d'essai sans balayer toute la table.
create index if not exists entitlements_essai_idx
  on public.entitlements (essai_jusqu_a)
  where essai_jusqu_a is not null;

-- ┌────────────────────────────────────────────────────────────────────
-- │ 003-organisation.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 003 — L'ORGANISATION : responsables, membres, et ce qu'on voit.
--
-- ── CE QUE ÇA AJOUTE, ET POURQUOI C'EST DÉLICAT ──
--
-- Jusqu'ici, chaque compte était une île : la RLS le limite à ses propres
-- lignes, et c'était TOUT le cloisonnement du produit. Cette migration ouvre
-- une porte dedans, parce qu'un responsable commercial doit voir le pipe de
-- ses vendeurs — sans ça il n'a pas un CRM, il a un carnet privé par personne.
--
-- ⚠ LA RÈGLE VIT DANS `lib/organisation.ts`, PAS ICI. Ce fichier pose la
-- structure et les politiques ; la décision « qui voit quoi » est écrite,
-- commentée et TESTÉE là-bas (`tests/organisation.test.ts`). Deux endroits qui
-- répondent à la même question finissent par diverger, et ici diverger veut
-- dire : un client lit le fichier de prospection d'un autre.
--
-- ── LA DÉCISION CENTRALE, ET ELLE SE VOIT DANS LES POLITIQUES ──
--
-- Un RESPONSABLE voit le CONTENU de ses membres (leurs fiches).
-- NOUS (le maître) ne voyons PAS le contenu — seulement l'exploitation :
-- combien de fiches, quel statut, quelle dernière activité.
--
-- Ce n'est pas de la prudence décorative. Lire le CRM d'un client, c'est lire
-- les nom, téléphone et email de gens qui ne nous connaissent pas : ça fait de
-- nous un SOUS-TRAITANT au sens de l'art. 28 RGPD, ce qui exige un contrat
-- écrit, une finalité déclarée et une durée. Rien de tout ça n'existe. Et
-- l'exploitation suffit : le support et le succès client ont besoin de savoir
-- si le compte tourne, pas du numéro d'un prospect.
--
-- ── COMMENT L'APPLIQUER ──
--
-- Supabase Dashboard → SQL Editor → coller ce fichier entier → Run.
-- Idempotent : le relancer ne casse rien.
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — l'environnement de
-- développement ne l'atteint pas (le proxy bloque les clés live). Relis la
-- sortie du SQL Editor, et vérifie l'isolation À DEUX COMPTES avant de
-- facturer quoi que ce soit : `supabase/verify-isolation.mjs`.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.organisation (
  -- Le compte lui-même.
  tenant_id uuid primary key references auth.users (id) on delete cascade,

  -- « maitre » | « responsable » | « membre ». Même espace de noms que
  -- `RoleCompte` (lib/organisation.ts).
  --
  -- ⚠ Le rôle « maitre » n'est PAS ce qui nous rend maîtres. `estMaitre()`
  -- lit l'email du JETON contre `OWNER_EMAILS`, côté serveur, et
  -- court-circuite la base. Si quelqu'un écrivait 'maitre' dans cette
  -- colonne, il n'obtiendrait rien : la ligne est descriptive, pas
  -- décisionnelle. C'est délibéré — une élévation de privilège ne doit
  -- jamais passer par une table que le produit écrit.
  role text not null default 'responsable' check (role in ('maitre', 'responsable', 'membre')),

  -- Le responsable auquel ce compte est rattaché. NULL pour un maître et pour
  -- un responsable.
  parent_id uuid references auth.users (id) on delete set null,

  -- Nom d'affichage du membre, pour que son responsable le reconnaisse dans
  -- une liste. Pas d'email ici : il vit dans `auth.users`, et le recopier
  -- créerait une seconde vérité à tenir à jour.
  libelle text,

  cree_le timestamptz not null default now(),

  -- ⚠ UN SEUL NIVEAU DE RATTACHEMENT. Un membre ne peut pas avoir de membres.
  -- Autoriser une chaîne (A pilote B qui pilote C) rendrait « qui voit quoi »
  -- récursif, donc invérifiable d'un coup d'œil. Une hiérarchie profonde
  -- s'ajoutera si un client la demande — jamais « au cas où », sur le mur qui
  -- protège tout.
  constraint parent_seulement_pour_membre check (
    (role = 'membre' and parent_id is not null)
    or (role <> 'membre' and parent_id is null)
  ),

  -- Et personne ne se rattache à soi-même : ce serait une boucle qui rendrait
  -- toute traversée infinie.
  constraint pas_son_propre_parent check (parent_id is null or parent_id <> tenant_id)
);

create index if not exists organisation_parent_idx on public.organisation (parent_id);

alter table public.organisation enable row level security;

-- ── Lecture : sa propre ligne, et celles de ses membres ──
--
-- ⚠ ON NE MET PAS DE POLITIQUE « le maître lit tout » ICI, et c'est
-- volontaire. Le maître passe par le SERVICE ROLE côté serveur (qui contourne
-- la RLS de toute façon) et son accès est filtré EN SORTIE par
-- `filtrerExploitation` — une liste blanche de champs. Écrire une politique
-- « maître » en SQL ferait dépendre notre accès d'une valeur en base plutôt
-- que de `OWNER_EMAILS`, c'est-à-dire déplacerait la décision d'élévation de
-- privilège dans une table.
drop policy if exists "organisation_lecture" on public.organisation;
create policy "organisation_lecture" on public.organisation
  for select using (
    tenant_id = auth.uid()
    or parent_id = auth.uid()
  );

-- ── Écriture : un responsable gère SES membres, et personne d'autre ──
--
-- ⚠ `with check` ET `using` — les deux, et pas seulement le premier. `using`
-- décide quelles lignes on peut TOUCHER ; `with check` décide de ce que la
-- ligne a le droit de DEVENIR. Sans `with check`, un responsable pourrait
-- prendre un de ses membres et le rattacher à quelqu'un d'autre — ou se
-- promouvoir. C'est l'oubli classique sur une politique d'update.
drop policy if exists "organisation_creation_membre" on public.organisation;
create policy "organisation_creation_membre" on public.organisation
  for insert with check (
    role = 'membre' and parent_id = auth.uid()
  );

drop policy if exists "organisation_maj_membre" on public.organisation;
create policy "organisation_maj_membre" on public.organisation
  for update
  using (parent_id = auth.uid())
  with check (role = 'membre' and parent_id = auth.uid());

drop policy if exists "organisation_suppression_membre" on public.organisation;
create policy "organisation_suppression_membre" on public.organisation
  for delete using (parent_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- L'ACCÈS SUPPORT AU CONTENU — la porte qu'on conçoit AVANT d'en avoir besoin.
--
-- Elle n'est pas ouverte. Elle est écrite maintenant parce que le besoin
-- arrivera un mardi soir, avec un client au téléphone et une envie de faire
-- vite : le pire moment pour concevoir une exception.
--
-- Les quatre conditions sont cumulatives, et la quatrième NE SE CODE PAS :
--   1. le client a consenti, DEPUIS SON COMPTE ;
--   2. le consentement porte une date de fin ;
--   3. l'accès est journalisé ;
--   4. un contrat de sous-traitance (art. 28 RGPD) est signé avec ce client.
--
-- `lib/organisation.ts` → `accesContenuAutorise` les vérifie toutes, et rend
-- `false` tant qu'une seule manque.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.acces_support (
  tenant_id uuid primary key references auth.users (id) on delete cascade,
  -- Le client a ouvert l'accès lui-même. Jamais posé par nous.
  consenti boolean not null default false,
  -- Un accès sans terme n'est pas un dépannage, c'est un abonnement à ses
  -- données. NULL = pas d'accès, quelle que soit la valeur de `consenti`.
  expire_le timestamptz,
  -- Le contrat existe-t-il ? Coché à la main, par nous, après signature.
  -- ⚠ Cette colonne ne PROUVE rien : elle sert à ce qu'on ne puisse pas
  -- l'oublier en croyant que le code s'en occupe.
  contrat_sous_traitance boolean not null default false,
  maj_le timestamptz not null default now()
);

alter table public.acces_support enable row level security;

-- Le client lit et écrit SON consentement. Lui seul.
drop policy if exists "acces_support_par_le_client" on public.acces_support;
create policy "acces_support_par_le_client" on public.acces_support
  for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- ── Le journal des accès support — sans lui, le consentement ne vaut rien ──
--
-- ⚠ Un consentement dont l'usage n'est pas tracé est une signature sur un
-- chèque en blanc : le client a dit oui, et personne — lui compris — ne peut
-- savoir ce qui a été regardé, quand, ni par qui. Le journal est ce qui rend
-- le consentement vérifiable.
create table if not exists public.journal_acces_support (
  id uuid primary key default gen_random_uuid(),
  -- Le compte REGARDÉ.
  tenant_id uuid not null references auth.users (id) on delete cascade,
  -- Qui a regardé (notre compte).
  operateur_id uuid references auth.users (id) on delete set null,
  -- Ce qui a été consulté, en clair et court : « fiches », « campagnes »…
  objet text not null,
  -- Pourquoi. Un accès sans motif écrit se justifie après coup.
  motif text,
  le timestamptz not null default now()
);

create index if not exists journal_acces_tenant_idx on public.journal_acces_support (tenant_id, le desc);

alter table public.journal_acces_support enable row level security;

-- ⚠ LE CLIENT LIT LE JOURNAL DE SON PROPRE COMPTE, ET NE PEUT PAS L'ÉCRIRE.
-- C'est l'inverse de l'intuition : c'est le regardé qui doit pouvoir lire, et
-- personne (nous compris, via cette politique) qui doit pouvoir modifier. Les
-- écritures passent par le service role côté serveur. Un journal que le
-- surveillé ne peut pas lire ne le protège pas ; un journal que le surveillant
-- peut réécrire ne prouve rien.
drop policy if exists "journal_lecture_par_le_client" on public.journal_acces_support;
create policy "journal_lecture_par_le_client" on public.journal_acces_support
  for select using (tenant_id = auth.uid());

-- ┌────────────────────────────────────────────────────────────────────
-- │ 005-presence-agent.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 005 — LE BATTEMENT DE L'AGENT VOCAL.
--
-- ── LE DÉFAUT ──
--
-- `voice/agent.py` tourne en LOCAL (décision du 09/09/2026 : un VPS ne se
-- monte que pour les clients). Or `/api/voice/call` crée un dispatch LiveKit
-- et rend `dispatched: true` **que l'agent tourne ou non**.
--
-- Le premier soir où le poste est éteint avec l'autopilote armé, le cron
-- compose toutes les dix minutes : la ligne SIP sonne, le prospect décroche,
-- et personne ne parle. La fiche est brûlée, le numéro perd sa réputation,
-- les minutes Telnyx sont facturées — et les journaux restent VERTS.
--
-- ── POURQUOI UNE TABLE, ET PAS UNE QUESTION À LIVEKIT ──
--
-- L'API Twirp de LiveKit expose les dispatches d'une room, pas la liste des
-- workers enregistrés : il n'existe pas d'endpoint stable pour demander « un
-- agent alpha-voice est-il connecté ? ». On inverse donc la question — l'agent
-- s'annonce toutes les 30 secondes, et son silence vaut absence.
--
-- ⚠ UNE SEULE LIGNE, ÉCRASÉE À CHAQUE BATTEMENT. Pas un journal : personne ne
-- relira jamais deux millions de lignes « je suis là », et une table qui
-- grossit sans être lue est un coût sans lecteur.
--
-- ── COMMENT L'APPLIQUER ──
--
-- Supabase Dashboard → SQL Editor → coller ce fichier entier → Run.
-- Idempotent : le relancer ne casse rien.
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — l'environnement de
-- développement ne l'atteint pas. Relis la sortie du SQL Editor plutôt que de
-- supposer que ça a marché.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.agent_presence (
  -- Un identifiant d'organe, pas un compteur : « agent-vocal » aujourd'hui,
  -- un autre worker demain. La clé porte le sens, la ligne porte l'instant.
  cle    text primary key,
  vu_le  timestamptz not null default now()
);

alter table public.agent_presence enable row level security;

-- ⚠ AUCUNE POLITIQUE DE LECTURE NI D'ÉCRITURE POUR LES CLIENTS, et c'est
-- volontaire. Cette table ne se touche que par le service role, depuis le
-- serveur, avec le secret du cron. Un battement falsifiable serait pire que
-- pas de battement : n'importe qui pourrait faire croire qu'un agent écoute,
-- et l'autopilote se remettrait à composer dans le vide en toute confiance.
--
-- RLS activée sans politique = personne ne passe par la clé anonyme. C'est
-- l'état recherché, pas un oubli.

-- ── CONTRÔLE — à lancer après ──
-- select * from public.agent_presence;
--   (vide tant que l'agent n'a pas tourné : c'est normal, et l'autopilote
--    refusera de composer jusque-là — voir lib/presence-agent.ts)

-- ┌────────────────────────────────────────────────────────────────────
-- │ 006-rendez-vous-cloisonnes.sql
-- └────────────────────────────────────────────────────────────────────
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

-- ┌────────────────────────────────────────────────────────────────────
-- │ 007-attribution-apporteurs.sql
-- └────────────────────────────────────────────────────────────────────
-- ═══════════════════════════════════════════════════════════════════════
-- 007 — L'ATTRIBUTION DES APPORTEURS : à QUI revient ce client.
--
-- `lib/apporteur.ts` savait calculer COMBIEN revient à un apporteur (30 % du
-- setup, 10 % du mensuel pendant 12 mois) et s'il est en état d'être payé
-- (SIRET + contrat). Il ne savait pas À QUI : rien ne reliait un client à
-- celui qui l'a amené. Le modèle de commission tournait à vide — un calcul
-- juste sur un lien inexistant.
--
-- ── LES DEUX CHOSES QUE CE SCHÉMA IMPOSE ──
--
-- 1. L'ATTRIBUTION EST IMMUABLE. `entitlements.apporteur_code` ne peut être
--    écrit qu'une fois : un trigger refuse toute modification d'une valeur
--    déjà posée. Ce n'est pas de la rigidité, c'est ce qui rend le registre
--    crédible — une attribution modifiable est une attribution VOLABLE : il
--    suffirait d'envoyer son lien à un client déjà signé pour capter la
--    commission de quelqu'un d'autre, et personne ne le verrait.
--
--    ⚠ La règle est posée EN BASE et pas seulement dans le code applicatif.
--    Une règle qui ne vit que dans une route se contourne par la route
--    suivante, ou par une main dans le SQL Editor. Ici, les deux endroits la
--    posent, et c'est délibéré : l'immuabilité est le seul invariant dont la
--    violation ne se voit jamais après coup.
--
-- 2. L'ATTRIBUTION N'EST PAS UNE AUTORISATION. Aucune policy ne s'appuie sur
--    `apporteur_code`, et aucune brique ne s'ouvre par lui. Il enregistre une
--    revendication ; le versement reste gouverné par `statutApporteur`
--    (SIRET bien formé + contrat signé). Confondre les deux ferait d'une
--    chaîne de huit caractères devinable un moyen de se faire payer.
--
-- ── COMMENT L'APPLIQUER ──
--
-- Supabase Dashboard → SQL Editor → coller ce fichier entier → Run.
-- Idempotent : le relancer ne casse rien et ne duplique rien.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── 1. LE REGISTRE DES CODES ───────────────────────────────────────────
--
-- Un code par apporteur, retirable sans être effacé : `actif = false` cesse
-- d'attribuer les NOUVEAUX comptes et laisse intactes les attributions déjà
-- faites. Effacer la ligne rendrait illisibles les commissions en cours.
create table if not exists public.apporteur_codes (
  code text primary key,
  apporteur_id uuid not null references auth.users (id) on delete cascade,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

-- Un apporteur peut avoir plusieurs codes (une campagne, un salon), mais on
-- retrouve les siens sans balayer la table.
create index if not exists apporteur_codes_apporteur_idx on public.apporteur_codes (apporteur_id);

alter table public.apporteur_codes enable row level security;

-- ⚠ AUCUNE POLICY D'ÉCRITURE. Un utilisateur ne crée pas son propre code
-- d'apport : ce serait s'inscrire soi-même au programme de commissionnement.
-- Le service role écrit, le maître arbitre. Même doctrine que `entitlements`.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'apporteur_codes' and policyname = 'apporteur_lit_ses_codes'
  ) then
    create policy apporteur_lit_ses_codes on public.apporteur_codes
      for select using (auth.uid() = apporteur_id);
  end if;
end $$;

-- ── 2. L'ATTRIBUTION, SUR LE COMPTE DU CLIENT ──────────────────────────
do $$
begin
  if to_regclass('public.entitlements') is null then
    raise notice 'Table public.entitlements absente — applique d''abord la migration 002.';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entitlements' and column_name = 'apporteur_code'
  ) then
    alter table public.entitlements add column apporteur_code text;
    raise notice 'entitlements.apporteur_code : colonne ajoutée.';
  end if;

  -- La date d'attribution : elle sert à savoir quelles commissions sont dans
  -- leur fenêtre de 12 mois (MOIS_COMMISSIONNES, lib/apporteur.ts). Sans
  -- elle, on saurait à qui verser mais pas jusqu'à quand.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entitlements' and column_name = 'apporteur_depuis'
  ) then
    alter table public.entitlements add column apporteur_depuis timestamptz;
    raise notice 'entitlements.apporteur_depuis : colonne ajoutée.';
  end if;
end $$;

create index if not exists entitlements_apporteur_idx on public.entitlements (apporteur_code);

-- ── 3. L'IMMUABILITÉ, POSÉE EN BASE ────────────────────────────────────
--
-- ⚠ Le trigger laisse passer NULL → valeur (la première attribution) et
-- refuse valeur → autre valeur ainsi que valeur → NULL. Autoriser le retour à
-- NULL rouvrirait exactement la porte qu'on ferme : effacer puis réattribuer.
create or replace function public.attribution_apporteur_immuable()
returns trigger
language plpgsql
as $$
begin
  if old.apporteur_code is not null and old.apporteur_code is distinct from new.apporteur_code then
    raise exception
      'Attribution apporteur immuable : % est déjà attribué à %. Une attribution qui se réécrit est une attribution qui se vole.',
      old.tenant_id, old.apporteur_code
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists entitlements_attribution_immuable on public.entitlements;
create trigger entitlements_attribution_immuable
  before update on public.entitlements
  for each row execute function public.attribution_apporteur_immuable();

commit;

-- ── VÉRIFICATION APRÈS APPLICATION ──
--
-- Un « Success » ne dit rien : les blocs sont conditionnels. Ce qui fait foi :
--
--   select
--     (select count(*) from information_schema.columns
--       where table_schema='public' and table_name='entitlements'
--         and column_name='apporteur_code')                  as a_code,
--     (select count(*) from information_schema.tables
--       where table_schema='public' and table_name='apporteur_codes') as a_registre,
--     (select count(*) from pg_trigger
--       where tgname='entitlements_attribution_immuable')    as a_trigger;
--
-- Attendu : 1, 1, 1.
--
-- Et le test qui prouve que le verrou mord vraiment — il DOIT échouer :
--
--   update public.entitlements set apporteur_code = 'AUTRE000'
--    where apporteur_code is not null;
--
-- Attendu : ERROR « Attribution apporteur immuable ». S'il passe, le trigger
-- n'est pas actif et l'immuabilité n'existe que dans le code applicatif.

-- ┌────────────────────────────────────────────────────────────────────
-- │ 008-essai-plafond-cout.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- L'ESSAI 30 JOURS A DEUX LIMITES, ET LA BASE N'EN CONNAISSAIT QU'UNE.
--
-- `entitlements` portait déjà `statut = 'essai'` et `essai_jusqu_a` : la
-- dimension TEMPS était complète. Il manquait la dimension COÛT, qui est le
-- seul vrai risque.
--
-- ⚠⚠ POURQUOI LA DURÉE SEULE NE SUFFIT PAS. Les briques ouvertes pendant
-- l'essai DÉPENSENT chez nous — SMTP, minutes LiveKit/Telnyx, jetons IA — et
-- il n'existe aucun chemin d'identifiants par locataire. Un essai borné par le
-- seul calendrier, c'est notre carte bancaire confiée à un inconnu pendant
-- trente jours, et ça ne se voit que sur la facture, un mois plus tard. Un
-- compte motivé consomme en deux jours ce qu'on comptait donner en trente.
--
-- Le plafond et sa dérivation vivent dans `lib/essai.ts` (ancré sur le coût
-- MESURÉ du palier d'entrée). Le SQL ne le recopie PAS : deux définitions du
-- même seuil finiraient par diverger, et c'est celle qu'on ne relit pas — le
-- SQL — qui ferait foi parce qu'elle s'exécute en premier. Même règle que la
-- fenêtre d'appel, qu'un test interdit déjà au SQL de redéfinir.
--
-- ⚠ DÉFAUT `null` ET NON `0`, et ce n'est pas un détail. `0` affirmerait « ce
-- compte n'a rien consommé » ; `null` dit « on ne sait pas ». `etatEssai()`
-- FERME l'essai sur `null` — l'inconnu vaut refus quand l'erreur coûte plus
-- cher que l'abstention. Mettre `0` par défaut ouvrirait l'essai en grand sur
-- une colonne jamais alimentée.
-- ─────────────────────────────────────────────────────────────────────

alter table public.entitlements
  add column if not exists cout_consomme_eur numeric(10, 2) default null;

comment on column public.entitlements.cout_consomme_eur is
  'Coût REEL consomme pendant l''essai, en euros (nos couts, pas le prix client). '
  'NULL = inconnu, et l''inconnu ferme l''essai (voir lib/essai.ts). '
  'Le plafond n''est PAS ici : une seule definition, cote TypeScript.';

-- ┌────────────────────────────────────────────────────────────────────
-- │ 009-trace-destinataire.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- 009 — LE DESTINATAIRE NORMALISÉ, pour les DEUX canaux
--
-- Pourquoi : `verifieMentions` (lib/conformite.ts) n'exige la mention de
-- provenance qu'au PREMIER message à une personne. Répondre à « lui a-t-on
-- déjà écrit ? » suppose de reconnaître la même personne d'un envoi à
-- l'autre — or `tracking_messages` ne portait qu'une colonne `email`, et la
-- branche SMS n'écrivait rien du tout. Sur le SMS, la question n'avait donc
-- aucune réponse, et l'inconnu valant « premier », CHAQUE SMS exigeait la
-- mention. Un SMS se paie au segment.
--
-- ⚠⚠ POURQUOI UNE COLONNE ET PAS LA RÉUTILISATION DE `email`
-- Stocker un numéro de téléphone dans une colonne nommée `email` marche —
-- `channel` lève l'ambiguïté — et ment à tous ceux qui liront la table
-- ensuite. On a déjà payé une constante à deux sens dans ce dépôt ; une
-- colonne à deux sens coûterait pareil.
--
-- ⚠ `destinataire` porte une valeur NORMALISÉE, jamais la saisie brute :
-- email en minuscules, téléphone en E.164 (`toE164`, lib/voice-script.ts).
-- Sans ça « 04 51 22 21 82 » et « +33451222182 » seraient deux personnes, la
-- reconnaissance échouerait toujours, et la fonctionnalité aurait l'air
-- branchée sans jamais reconnaître personne.
--
-- ⚠ Rejouable : `add column if not exists`, et le backfill est idempotent.
-- ─────────────────────────────────────────────────────────────────────

alter table public.tracking_messages
  add column if not exists destinataire text;

-- Le backfill reprend l'historique email existant. Sans lui, toute adresse
-- déjà contactée avant cette migration repasserait pour un premier contact
-- et recevrait la mention une fois de trop — inoffensif, mais évitable.
--
-- ⚠ Il ne peut PAS reconstituer l'historique SMS : il n'y en a jamais eu.
-- Les numéros déjà démarchés resteront donc « premiers » une dernière fois.
-- C'est le bon sens du repli — on informe une fois de trop, jamais une fois
-- de moins.
update public.tracking_messages
   set destinataire = lower(trim(email))
 where destinataire is null
   and email is not null
   and trim(email) <> '';

-- La question posée est « existe-t-il UNE ligne pour ce destinataire ? »,
-- scopée au locataire. C'est exactement cet index.
create index if not exists tracking_destinataire_idx
  on public.tracking_messages (user_id, channel, destinataire);

-- ┌────────────────────────────────────────────────────────────────────
-- │ 010-byok-identifiants.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- 010 — BYOK : les identifiants apportés par le locataire
--
-- Pourquoi : un compte gratuit ne pouvait appeler que 4 familles d'API sur
-- 20, et la raison n'était pas commerciale — `/api/ai` brûlait NOTRE clé.
-- Ouvrir l'IA au gratuit revenait à donner notre carte bancaire à des
-- inconnus. Cette table est ce qui permet à un locataire de la payer
-- lui-même, chez son fournisseur.
--
-- ⚠⚠ AUCUNE POLICY RLS, ET C'EST LE POINT. RLS est activé, et il n'existe
-- délibérément AUCUNE policy : personne ne lit cette table depuis un JWT
-- client, pas même le propriétaire de la ligne. Il n'a aucun besoin de
-- relire sa clé — il l'a déjà — et une faille XSS dans SON navigateur
-- l'exfiltrerait. On écrit par une route serveur, on ne relit jamais.
-- L'écran des Réglages affiche `empreinte`, qui n'est pas un secret.
--
-- ⚠ Une ligne par CAPACITÉ, pas par variable : un SMTP a besoin de cinq
-- valeurs cohérentes entre elles, et une ligne par variable autoriserait un
-- SMTP à moitié configuré — l'état où l'on croit avoir branché et où rien
-- ne part. (La capacité `email` viendra avec son lot ; voir la contrainte.)
--
-- ⚠ Rejouable : `create table if not exists`, aucun DDL non protégé.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.tenant_credentials (
  tenant_id       uuid        not null references auth.users (id) on delete cascade,
  -- ⚠ UNE SEULE VALEUR AUJOURD'HUI. Les quatre autres capacités du chiffrage
  -- (email, sms, transcription, telephonie) viendront avec leur lot, et
  -- ajouteront leur valeur ICI et dans `Capacite` (lib/credentials.ts) dans
  -- le MÊME diff. Un test croise les deux listes : les déclarer d'avance
  -- créerait des valeurs que le code ne sait pas servir, et qu'un lecteur
  -- croirait branchées.
  capacite        text        not null check (capacite in ('ia')),
  secret_chiffre  text        not null,
  nonce           text        not null,
  cle_version     integer     not null default 1,
  -- Les quatre derniers caractères, en clair. Ce n'est pas un secret : c'est
  -- ce qui permet d'afficher « clé … a4f2 » sans jamais redescendre la clé
  -- elle-même dans un navigateur.
  empreinte       text        not null,
  cree_le         timestamptz not null default now(),
  -- ⚠ NULL ⇒ la capacité reste FERMÉE. Une clé jamais testée n'ouvre rien :
  -- sinon on colle une clé fausse, la brique s'ouvre, et le premier vrai
  -- usage échoue devant un prospect — le pire moment pour découvrir une
  -- faute de frappe.
  verifie_le      timestamptz,
  dernier_echec   text,
  primary key (tenant_id, capacite)
);

alter table public.tenant_credentials enable row level security;

-- Pas de `create policy` : voir l'encadré en tête. RLS actif + zéro policy
-- = refus par défaut pour tout JWT client. Seul le service role passe.

-- ┌────────────────────────────────────────────────────────────────────
-- │ 011-byok-email.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- 011 — BYOK : la capacité `email`
--
-- Le lot L2. Un locataire peut apporter son SMTP : ses emails partent de SON
-- domaine, sous SA réputation, et il ne touche jamais la nôtre.
--
-- ⚠ La contrainte grandit EN MÊME TEMPS que le type `Capacite`
-- (lib/credentials.ts), dans le même diff — un test croise les deux listes.
-- Une valeur ajoutée d'un seul côté donne soit une capacité que la base
-- refuse d'écrire, soit une valeur en base que le code ne sait pas servir.
--
-- ⚠ Rejouable : on retire la contrainte avant de la reposer, et les deux
-- ordres sont gardés.
-- ─────────────────────────────────────────────────────────────────────

alter table public.tenant_credentials
  drop constraint if exists tenant_credentials_capacite_check;

alter table public.tenant_credentials
  add constraint tenant_credentials_capacite_check
  check (capacite in ('ia', 'email'));

-- ┌────────────────────────────────────────────────────────────────────
-- │ 012-ouverture-30-jours.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- L'OUVERTURE 30 JOURS — le démarreur et le compteur qui n'existaient pas.
--
-- ⚠⚠ CE QUE LA MIGRATION 008 A LAISSÉ OUVERT, ET QUI ANNULAIT TOUT.
--
-- 008 a créé `cout_consomme_eur` avec un défaut `null`, et `etatEssai()`
-- FERME l'essai sur `null` — l'inconnu vaut refus. Le raisonnement était bon.
-- Ce qui manquait, ce sont les deux bouts :
--
--  · **personne n'écrivait jamais cette colonne.** Zéro appelant dans tout le
--    dépôt, vérifié. Donc aucune ligne ne passait jamais de `null` à un
--    nombre ;
--  · **personne n'ouvrait jamais d'essai.** `droitsPourOffre` rend
--    `statut: "actif", essai_jusqu_a: null` sur toutes les offres, et
--    `finDEssai()` n'était importée par aucun fichier de production.
--
-- Résultat mesuré : un essai posé à la main retombait au socle gratuit **le
-- jour même**, parce que son compteur valait `null`. L'essai trente jours ne
-- s'était jamais ouvert une seule fois. Une garde fail-closed posée sur un
-- compteur inexistant ne protège rien — elle interdit tout, en silence.
--
-- ⚠ AUCUNE LISTE DE BRIQUES N'EST ÉCRITE ICI, et c'est volontaire.
-- Le démarreur pose `bricks = '{}'` : ce que l'essai OUVRE se dérive côté
-- TypeScript (`BRIQUES_ESSAI`, soit tout le catalogue moins `HORS_ESSAI`).
-- Recopier la liste en SQL créerait une seconde définition du périmètre de
-- l'essai, et c'est celle qu'on ne relit pas — le SQL — qui gagnerait, parce
-- qu'elle s'exécute en premier. Même règle que le plafond, que 008 refuse
-- déjà de recopier, et que la fenêtre d'appel, qu'un test interdit au SQL de
-- redéfinir.
-- Conséquence concrète et voulue : une ligne d'essai écrite à la main avec
-- `bricks = '{alpha-voice}'` n'ouvre PAS la téléphonie. Le périmètre est tenu
-- par le code, pas par ce qui se trouve dans la colonne.
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — le proxy sortant ne l'atteint
-- pas depuis l'environnement de développement. Relis la sortie du SQL Editor
-- plutôt que de supposer que ça a marché.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. LE COMPTEUR : un incrément ATOMIQUE ────────────────────────────
--
-- ⚠⚠ POURQUOI UNE FONCTION ET PAS UN `update` DEPUIS LE CODE.
-- Lire la valeur, ajouter, réécrire : deux appels simultanés du même compte
-- lisent tous deux 12,00 et écrivent tous deux 12,50. Une des deux dépenses
-- disparaît. Sur une boucle d'appels — exactement le cas que le plafond
-- existe pour borner — la fuite est proportionnelle au débit. L'addition doit
-- se faire DANS la base, en une instruction.
--
-- ⚠ `coalesce(…, 0)` sur la valeur courante : une ligne d'essai posée sans
-- compteur vaut `null`, et `null + 0,50` vaut `null` en SQL. Sans ce
-- coalesce, débiter un compte au compteur inconnu le laisserait inconnu —
-- donc fermé pour toujours, sans que rien ne le dise.
create or replace function public.debiter_essai(p_tenant uuid, p_montant numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  update public.entitlements
     set cout_consomme_eur = coalesce(cout_consomme_eur, 0) + p_montant,
         updated_at = now()
   where tenant_id = p_tenant
  returning cout_consomme_eur;
$$;

-- Le service role seul. Un client qui pourrait appeler cette fonction
-- pourrait aussi débiter le compteur d'un autre — ou le sien à zéro.
revoke all on function public.debiter_essai(uuid, numeric) from public, anon, authenticated;

-- ── 2. LE DÉMARREUR : tout nouveau compte entre en essai ──────────────
--
-- ⚠ `cout_consomme_eur = 0` EXPLICITEMENT, jamais le défaut de la colonne.
-- C'est LE piège de cette migration : le défaut est `null`, `null` ferme
-- l'essai, donc un démarreur qui se contente d'écrire `statut = 'essai'`
-- crée un essai mort-né. Le `0` dit « ce compte n'a rien consommé » là où
-- `null` dit « on ne sait pas », et ces deux phrases mènent à des décisions
-- opposées.
--
-- ⚠ `on conflict do nothing` : un compte qui a DÉJÀ une ligne — un client qui
-- paie, un essai déjà consommé, un compte suspendu — n'est jamais remis en
-- essai. Sans cette clause, une réexécution de la migration rouvrirait
-- trente jours pleins à tout le monde, y compris à ceux qui ont épuisé leur
-- plafond. Un essai se donne une fois.
create or replace function public.ouvrir_essai_nouveau_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.entitlements (tenant_id, bricks, statut, essai_jusqu_a, cout_consomme_eur)
  values (new.id, '{}', 'essai', now() + interval '30 days', 0)
  on conflict (tenant_id) do nothing;
  return new;
end;
$$;

-- ⚠ La DURÉE est écrite ici en clair (30 jours) alors que `DUREE_ESSAI_JOURS`
-- l'est aussi côté TypeScript. C'est la seule recopie que cette migration
-- s'autorise, et elle n'est pas gratuite : `tests/essai.test.ts` croise les
-- deux et tombe si elles divergent. La raison de ne pas l'éviter : un trigger
-- ne peut pas importer une constante, et la seule alternative — laisser le
-- code poser la date à l'inscription — ferait dépendre l'ouverture d'un
-- appel applicatif qui peut ne pas avoir lieu. Le trigger, lui, ne se saute
-- pas.

drop trigger if exists ouvrir_essai_a_l_inscription on auth.users;
create trigger ouvrir_essai_a_l_inscription
  after insert on auth.users
  for each row execute function public.ouvrir_essai_nouveau_compte();

-- ── 3. LES COMPTES DÉJÀ INSCRITS ──────────────────────────────────────
--
-- Le trigger ne vaut que pour l'avenir. Ceux qui se sont inscrits avant
-- l'ouverture n'auraient jamais d'essai — et ce sont précisément les premiers
-- arrivés. Ils reçoivent trente jours à compter de MAINTENANT, pas de leur
-- inscription : un essai rétroactif déjà expiré est une insulte polie.
--
-- ⚠ Seuls les comptes SANS ligne du tout. On ne touche à aucun statut
-- existant : un client qui paie ne doit pas être rétrogradé en essai par une
-- migration, et un compte suspendu ne se rouvre pas par un script.
insert into public.entitlements (tenant_id, bricks, statut, essai_jusqu_a, cout_consomme_eur)
select u.id, '{}', 'essai', now() + interval '30 days', 0
  from auth.users u
 where not exists (select 1 from public.entitlements e where e.tenant_id = u.id)
on conflict (tenant_id) do nothing;

-- Sommer l'enveloppe sans balayer toute la table : la somme se lit à chaque
-- résolution de droits d'un compte en essai, donc très souvent.
create index if not exists entitlements_essai_statut_idx
  on public.entitlements (statut)
  where statut = 'essai';

comment on function public.debiter_essai(uuid, numeric) is
  'Incremente atomiquement le cout consomme d''un essai. Service role seul. '
  'Voir lib/compteur-essai.ts : un debit qui echoue doit REFUSER la depense.';

-- ┌────────────────────────────────────────────────────────────────────
-- │ 013-commandes-alpha.sql
-- └────────────────────────────────────────────────────────────────────
-- ─────────────────────────────────────────────────────────────────────
-- 013 — LA FILE DE COMMANDES « dis à Alpha quoi faire » (pont Telegram).
--
-- `/api/telegram` range ici les `/note <texte>` du propriétaire. C'est une
-- boîte de RÉCEPTION, pas un moteur : Alpha (l'app) n'exécute pas encore ces
-- consignes tout seul. Elles se relisent depuis un écran ou une session Claude
-- qui les traite. Garder ça honnête : la note est STOCKÉE, pas EXÉCUTÉE.
--
-- ⚠ Table interne au propriétaire : le service role écrit, personne d'autre ne
-- lit. RLS activée et AUCUNE policy → tout accès anon/authenticated est refusé
-- par défaut. Même posture que les autres tables serveur.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.commandes_alpha (
  id          bigint generated always as identity primary key,
  chat_id     text not null,
  texte       text not null,
  source      text not null default 'telegram',
  traitee     boolean not null default false,
  cree_le     timestamptz not null default now()
);

alter table public.commandes_alpha enable row level security;

-- Lecture rapide des consignes non traitées, les plus récentes d'abord.
create index if not exists commandes_alpha_a_traiter
  on public.commandes_alpha (cree_le desc)
  where traitee = false;


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
-- interrogeait `cron.job` et `vault.decrypted_secrets`. Ces deux objets
-- n'existent QU'APRÈS la 004 — et Postgres analyse la requête entière avant
-- de l'exécuter, donc un simple `case when` ne protège de rien. Sur une base
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
