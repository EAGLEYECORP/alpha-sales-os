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
