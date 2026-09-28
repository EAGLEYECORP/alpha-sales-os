-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 014 — L'AUTOPILOTE D'ENVOI À FROID, PLANIFIÉ.
--
-- Décidé le 22/09/2026. Le propriétaire a choisi l'autopilote PLEIN : l'app
-- envoie les campagnes email à froid toute seule (chaque mail portant la
-- divulgation IA de l'article 50). La route `/api/campaign/mail-tick` fait le
-- travail ; ce fichier la fait APPELER par `pg_cron`, sans aucun ordinateur
-- allumé.
--
-- ── PRÉREQUIS : LA MIGRATION 004 ──
--
-- Ce fichier RÉUTILISE `public.appeler_tick(chemin)`, défini par la migration
-- 004. On ne le redéfinit pas ici : deux définitions de « comment on appelle un
-- tick » finiraient par diverger. Applique 004 d'abord (elle pose aussi le
-- Vault `alpha_base_url` + `alpha_cron_secret`). Si 004 n'est pas là, la
-- planification ci-dessous échoue en le disant — c'est le bon signal.
--
-- ── POURQUOI SEULEMENT MAIL-TICK, PAS REPLY-TICK ──
--
-- `/api/campaign/reply-tick` TRIE les réponses (le modèle CLASSE, le code
-- DISPOSE) mais n'ENVOIE encore rien (`envoiBranche: false`). Le planifier
-- ferait tourner un tri dont la sortie part à la poubelle du cron. On le
-- planifiera le jour où son auto-envoi est branché — pas avant.
--
-- ── LES QUATRE VERROUS RESTENT INTACTS ──
--
-- Poser ce fichier ne fait partir AUCUN mail tout seul. Il faut, en plus et
-- délibérément : `CRON_SECRET` (sinon 401), le service role (sinon 412), des
-- fiches synchronisées côté serveur avec un EMAIL (sinon 0 éligible), et
-- `CAMPAIGN_AUTOPILOT=on` (sinon `mail-tick` SIMULE et n'envoie rien). Tant que
-- le dernier n'est pas posé, cette migration ne réveille qu'un simulateur.
--
-- ── COMMENT L'APPLIQUER ──
--
-- 1. Assure-toi que 004 est appliquée et que le Vault est rempli.
-- 2. Supabase Dashboard → SQL Editor → colle ce fichier entier → Run.
-- 3. Vérifie avec la requête de contrôle, tout en bas.
--
-- Idempotent : on déplanifie avant de planifier.
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — l'environnement de dev n'a ni
-- `pg_cron` ni `pg_net` (ce sont des extensions Supabase). Relis la sortie du
-- SQL Editor plutôt que de supposer que ça a marché.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- LE PLAN.
--
-- ⚠ pg_cron lit l'expression en UTC. `9-17` ici, c'est ~11h-19h l'été à Paris.
-- Volontairement en journée ouvrée : un mail à froid qui arrive à 3h du matin
-- se lit comme du spam. Toutes les 2 heures → au plus ~5 passages/jour ; chaque
-- passage envoie au plus `MAX_MAILS_PAR_TICK` (2), et le TOTAL du jour reste
-- borné par le palier (`lib/email-ramp.ts` : 5/jour la 1re semaine, +5/semaine).
-- Le débit se règle donc dans le code, pas dans cette expression : l'élargir
-- ne peut pas dépasser le palier.
-- ─────────────────────────────────────────────────────────────────────

select cron.unschedule('alpha-mail-tick') where exists (select 1 from cron.job where jobname = 'alpha-mail-tick');

select cron.schedule('alpha-mail-tick', '0 9-17/2 * * 1-5', $$select public.appeler_tick('/api/campaign/mail-tick')$$);

-- ─────────────────────────────────────────────────────────────────────
-- CONTRÔLE — à lancer APRÈS, et à relire vraiment.
--
-- ⚠ Un job PLANIFIÉ n'est pas un job qui a ENVOYÉ. La 2ᵉ requête montre ce que
-- la route a répondu. `return_message` contient le JSON de `mail-tick` :
-- regarde `envoyes` et `lignes`. Un `dryRun: true` signifie que
-- `CAMPAIGN_AUTOPILOT` n'est pas encore `on` — la route simule, rien ne part.
-- ─────────────────────────────────────────────────────────────────────

-- select jobid, jobname, schedule, active from cron.job where jobname = 'alpha-mail-tick';
-- select j.jobname, d.status, d.return_message, d.start_time
--   from cron.job_run_details d join cron.job j using (jobid)
--  where j.jobname = 'alpha-mail-tick' order by d.start_time desc limit 20;

-- Pour tout arrêter, sans rien désinstaller :
-- select cron.unschedule('alpha-mail-tick');
