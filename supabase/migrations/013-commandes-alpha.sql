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
