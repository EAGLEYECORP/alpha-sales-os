-- ─────────────────────────────────────────────────────────────────────
-- LE PILOTE SERVEUR — « ALPHA vend ALPHA » onglet fermé, sans n8n (30/10/2026).
--
-- Décision de Zakaria : « je ne veux pas brancher n8n, il faut que tout soit
-- dans le cloud ». Le pilote de l'inscrit vit dans son navigateur (la frontière
-- du 21/10 tient pour LUI). Celui du MAÎTRE tourne désormais aussi sur le
-- serveur : `pg_cron` appelle `/api/campaign/pilote-tick`, qui joue les MÊMES
-- étapes (`lib/pilote-executeur.ts`) sur le pipe opérateur (`prospects`,
-- `proprietaire = 'operateur'`).
--
-- Cette table porte ce que le navigateur gardait dans son magasin : l'interrupteur,
-- l'état du pilote (journal, réponses déjà traitées, pages du registre…) et ce
-- que le maître a saisi à l'écran (ses réglages, son nom). UNE seule ligne.
--
-- ⚠ AUCUN SECRET ICI : la clé Dropcontact et l'adresse secrète de l'agenda
-- vivent dans l'environnement du serveur (`DROPCONTACT_API_KEY`,
-- `AGENDA_ICS_URL`), jamais en base — une base se sauvegarde, s'exporte, se lit
-- par le SQL Editor.
--
-- ⚠ `verrou_jusqua` : un passage à la fois. Deux ticks qui se chevauchent (un
-- appel lent, un cron rejoué) enverraient deux fois le même premier message.
-- Le verrou se prend par un UPDATE conditionnel (atomique) et expire seul : un
-- passage tué par la plateforme ne bloque pas le pilote pour toujours.
--
-- Rejouable : `if not exists`, `on conflict do nothing`.
-- ─────────────────────────────────────────────────────────────────────

begin;

create table if not exists public.pilote_serveur (
  id             text primary key default 'maitre' check (id = 'maitre'),
  actif          boolean not null default false,
  -- Ce que le maître a saisi dans /autopilote (cible, plafonds, IMAP…), SANS `actif`.
  reglages       jsonb not null default '{}'::jsonb,
  -- Nom du signataire et lien de réservation, tapés par lui (jamais une configuration).
  expediteur     jsonb not null default '{}'::jsonb,
  -- `EtatAutopilote` (journal, reponsesVues, enrichissements, pagesRegistre…).
  etat           jsonb not null default '{}'::jsonb,
  verrou_jusqua  timestamptz,
  dernier_passage timestamptz,
  modifie_le     timestamptz not null default now()
);

insert into public.pilote_serveur (id) values ('maitre') on conflict (id) do nothing;

-- Le service role seul : le navigateur n'y touche jamais, il passe par
-- `/api/autopilote/serveur` (maître seul, verdict du serveur).
alter table public.pilote_serveur enable row level security;
revoke all on table public.pilote_serveur from public;
revoke all on table public.pilote_serveur from anon, authenticated;
grant select, insert, update on table public.pilote_serveur to service_role;

commit;

-- La planification vit dans `020-pilote-tick.sql` : elle exige pg_cron et le
-- Vault de 004, donc elle reste hors du lot à coller (même raison que 014/016).
