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
