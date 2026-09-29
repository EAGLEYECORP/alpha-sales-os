-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 016 — PLANIFIER LES DEUX BOUCLES QUI MANQUAIENT : réponse + relance.
--
-- Décidé le 29/09/2026. La 014 planifiait `mail-tick` (l'envoi à froid). Depuis,
-- deux boucles ont été BRANCHÉES mais rien ne les DÉCLENCHAIT — le défaut
-- récurrent du dépôt, à l'étage de l'ordonnanceur : un mécanisme juste, testé,
-- que personne n'appelle.
--
--  · `/api/campaign/reply-tick` (B1) : trie les réponses entrantes ET, une fois
--    armé + attesté (REPLY_AUTOSEND=on), répond seul aux intentions sûres
--    (veut-rdv, renseignement) dans les mêmes gardes que l'envoi.
--  · `/api/campaign/relance-tick` (B2) : envoie les rappels espacés (72/96/168 h)
--    après un 1er contact sans réponse, plafonnés à 4 contacts / 30 j.
--
-- ── PRÉREQUIS : 004, PUIS 014 ──
--
-- Ce fichier RÉUTILISE `public.appeler_tick(chemin)` (défini par 004, qui pose
-- aussi le Vault `alpha_base_url` + `alpha_cron_secret`). On ne le redéfinit
-- pas : deux définitions de « comment on appelle un tick » finiraient par
-- diverger. Applique 004 d'abord ; sinon la planification échoue en le disant.
--
-- ── CE QUE POSER CE FICHIER NE FAIT PAS ──
--
-- Il ne fait partir AUCUN message tout seul. Les mêmes verrous que 014 restent
-- intacts et cumulatifs :
--   · `CRON_SECRET` (sinon 401 — `appeler_tick` le porte) ;
--   · le service role (sinon la route ne lit rien) ;
--   · l'autopilote ARMÉ (`CAMPAIGN_AUTOPILOT=on` ou le bouton /controle) ;
--   · pour reply-tick, EN PLUS : `REPLY_AUTOSEND=on` — ton attestation DKIM,
--     que le serveur ne peut pas vérifier seul. Sans elle, reply-tick TRIE et
--     planifie mais n'envoie pas (il ne réveille qu'un simulateur).
-- Tant que ces conditions ne sont pas réunies, ces crons ne réveillent qu'un
-- tri et un simulateur — exactement comme 014 avant `CAMPAIGN_AUTOPILOT`.
--
-- ── COMMENT L'APPLIQUER ──
--
-- 1. Assure-toi que 004 (et idéalement 014) sont appliquées, Vault rempli.
-- 2. Supabase Dashboard → SQL Editor → colle ce fichier entier → Run.
-- 3. Vérifie avec la requête de contrôle, tout en bas.
--
-- Idempotent : on déplanifie avant de planifier. Le re-jouer ne crée pas de
-- doublon de job.
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — l'environnement de dev n'a ni
-- `pg_cron` ni `pg_net`. Relis la sortie du SQL Editor plutôt que de supposer.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- LES PLANS.
--
-- ⚠ pg_cron lit l'expression en UTC.
--
-- reply-tick : les réponses veulent une prise en charge RAPIDE (un « oui,
-- parlons-nous » qui attend un jour refroidit). Toutes les 30 min en journée
-- ouvrée. La promptitude ne force rien : la route se gate elle-même (fenêtre,
-- palier, mentions, armement, attestation) et n'envoie au plus que ce que ses
-- propres bornes autorisent.
--
-- relance-tick : les rappels sont espacés de 72/96/168 h dans le code ; le cron
-- n'a donc qu'à PASSER assez souvent pour attraper ceux qui deviennent dus.
-- Deux fois par jour ouvré suffit ; chaque passage envoie au plus
-- MAX_RELANCES_PAR_TICK (2), et le plafond légal 4/30 j borne le total.
-- L'élargir ne peut pas dépasser ces bornes — elles sont dans le code.
-- ─────────────────────────────────────────────────────────────────────

select cron.unschedule('alpha-reply-tick') where exists (select 1 from cron.job where jobname = 'alpha-reply-tick');
select cron.schedule('alpha-reply-tick', '*/30 8-18 * * 1-5', $$select public.appeler_tick('/api/campaign/reply-tick')$$);

select cron.unschedule('alpha-relance-tick') where exists (select 1 from cron.job where jobname = 'alpha-relance-tick');
select cron.schedule('alpha-relance-tick', '0 10,15 * * 1-5', $$select public.appeler_tick('/api/campaign/relance-tick')$$);

-- ─────────────────────────────────────────────────────────────────────
-- CONTRÔLE — à lancer APRÈS, et à relire vraiment.
--
-- ⚠ Un job PLANIFIÉ n'est pas un job qui a AGI. La 2ᵉ requête montre ce que la
-- route a répondu. `return_message` contient le JSON du tick : un `dryRun: true`
-- (ou `envoiLive: false`) signifie qu'il manque encore l'armement ou
-- l'attestation — la route simule, rien ne part.
-- ─────────────────────────────────────────────────────────────────────

-- select jobid, jobname, schedule, active from cron.job where jobname in ('alpha-reply-tick','alpha-relance-tick');
-- select j.jobname, d.status, d.return_message, d.start_time
--   from cron.job_run_details d join cron.job j using (jobid)
--  where j.jobname in ('alpha-reply-tick','alpha-relance-tick') order by d.start_time desc limit 20;

-- Pour tout arrêter, sans rien désinstaller :
-- select cron.unschedule('alpha-reply-tick');
-- select cron.unschedule('alpha-relance-tick');
