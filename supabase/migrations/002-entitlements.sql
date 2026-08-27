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
