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
