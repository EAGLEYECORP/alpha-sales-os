-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 015 — L'INTERRUPTEUR DE L'AUTOPILOTE, EN BASE.
--
-- « Alpha se gère tout seul » se pilotait par la variable d'env
-- `CAMPAIGN_AUTOPILOT=on` — un geste d'ops, pas un bouton. Cette table porte le
-- drapeau que l'opérateur bascule depuis l'app (`/api/autopilote`), et que les
-- ticks serveur (mail/reply/campaign) lisent avant d'agir.
--
-- ⚠ UNE SEULE LIGNE (`id = 'global'`), compte maître mono-locataire. Le jour où
-- l'autopilote devient multi-locataire, la clé passe au `tenant_id` — pas avant,
-- pour ne pas inventer une dimension qu'aucun écran ne remplit encore.
--
-- ⚠ RLS ACTIVÉE, AUCUNE POLICY : la table n'est lue/écrite QUE par le service
-- role (le tick et la route `/api/autopilote`, elle-même gardée maître). Un
-- navigateur ne la touche jamais en direct — comme le reste de l'ordonnanceur.
--
-- ⚠ CE DRAPEAU N'INSTALLE PAS LE CRON. `pg_cron` (004/014) doit être posé une
-- fois ; ce drapeau décide seulement si le tick AGIT ou SIMULE. Et il ne
-- contourne aucune garde (palier, mentions, DKIM, présence agent).
--
-- Table ordinaire (pas de pg_cron/Vault) : elle EST dans le LOT-A-COLLER.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.autopilote_reglage (
  id         text primary key default 'global',
  actif      boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.autopilote_reglage enable row level security;
-- Volontairement aucune policy : accès service-role uniquement.
