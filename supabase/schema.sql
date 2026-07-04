-- ─────────────────────────────────────────────────────────────────────
-- ALPHA SALES OS® — Supabase schema
-- Local-first app: each table stores full row payload as JSONB (`data`)
-- keyed by the client-generated id, scoped per user with RLS.
-- Apply: Supabase Dashboard → SQL Editor → paste & run.
-- ─────────────────────────────────────────────────────────────────────

-- Prospects ------------------------------------------------------------
create table if not exists public.prospects (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  -- generated columns for indexing/queries without unpacking jsonb in app code
  stage text generated always as (data->>'stage') stored,
  sector text generated always as (data->>'sector') stored,
  company text generated always as (data->>'company') stored,
  updated_at timestamptz not null default now()
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

-- Indexes ----------------------------------------------------------------
create index if not exists prospects_user_stage_idx on public.prospects (user_id, stage);
create index if not exists prospects_user_sector_idx on public.prospects (user_id, sector);
create index if not exists meetings_user_idx on public.meetings (user_id);
create index if not exists campaigns_user_idx on public.campaigns (user_id);
create index if not exists activities_user_idx on public.activities (user_id);

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
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id)', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "audit select own" on public.audit_log;
drop policy if exists "audit insert own" on public.audit_log;
create policy "audit select own" on public.audit_log for select using (auth.uid() = user_id);
create policy "audit insert own" on public.audit_log for insert with check (auth.uid() = user_id);
-- no update/delete policies: audit log is append-only

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
