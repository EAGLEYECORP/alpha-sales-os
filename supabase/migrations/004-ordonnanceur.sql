-- ─────────────────────────────────────────────────────────────────────
-- MIGRATION 004 — L'ORDONNANCEUR. Ce qui fait tourner la machine sans toi.
--
-- ── LE DÉFAUT ──
--
-- `/api/campaign/tick` et `/api/push/tick` sont écrits, testés, verrouillés…
-- et **personne ne les appelle**. Il n'existe aucun ordonnanceur dans le
-- dépôt : pas de `vercel.json`, aucun déclencheur. Les deux routes attendent
-- depuis leur écriture.
--
-- C'est le défaut récurrent de la maison, dans sa forme la plus coûteuse :
-- un mécanisme juste, branché à rien. Rien n'échoue, donc rien n'alerte.
--
-- ── POURQUOI PAS VERCEL CRON ──
--
-- ⚠ MESURÉ DANS LE CODE, PAS SUPPOSÉ. Deux raisons, chacune suffisante :
--
--  1. **Vercel Cron émet des GET.** Or les deux routes séparent volontairement
--     les verbes : `GET` = statut en lecture seule, `POST` = exécution. Un
--     cron Vercel aurait donc lu le statut toutes les heures, rendu 200, et
--     n'aurait JAMAIS passé un appel. Un ordonnanceur vert qui ne fait rien
--     est pire que pas d'ordonnanceur : on croit que ça tourne.
--  2. Sur un plan Hobby, c'est **une exécution par jour**. Pour une campagne
--     d'appels, ça ne veut rien dire.
--
-- Fusionner les deux verbes pour contenter le cron serait le mauvais échange :
-- « lire l'état » et « composer des numéros » ne doivent jamais être la même
-- requête.
--
-- ── CE QUE FAIT CE FICHIER ──
--
-- `pg_cron` planifie, `pg_net` émet un vrai POST avec l'en-tête
-- `Authorization: Bearer`. Les deux sont inclus dans Supabase. Résultat : la
-- machine tourne **sans aucun ordinateur allumé** chez toi.
--
-- ⚠⚠ LE CRON NE DÉCIDE JAMAIS QUAND APPELER. Il ne fait que DEMANDER.
-- C'est la route qui décide, et elle refuse hors des fenêtres d'appel
-- (`run.windowOpen`), au-delà du palier, et trop tôt après une tentative.
-- Élargir l'horaire ci-dessous ne peut donc pas produire un appel à minuit —
-- ça produit seulement des invocations qui se font refuser. La fenêtre est
-- dans `lib/call-cadence.ts`, elle n'est pas ici, et elle ne doit jamais être
-- recopiée ici : deux définitions de « peut-on appeler maintenant ? »
-- finiraient par diverger, et c'est celle du cron qui gagnerait.
--
-- ── LES QUATRE VERROUS RESTENT INTACTS ──
--
-- Poser ce fichier ne fait partir AUCUN appel. Il faut, en plus et
-- délibérément : `CRON_SECRET` (sinon 401), le service role Supabase (sinon
-- 412), des fiches synchronisées côté serveur (sinon la route le dit au lieu
-- de rendre un faux succès), et `CAMPAIGN_AUTOPILOT=on` (sinon elle SIMULE et
-- rend ce qu'elle aurait fait). Tant que le dernier n'est pas posé, cette
-- migration ne fait que réveiller un simulateur.
--
-- ── COMMENT L'APPLIQUER ──
--
-- 1. Renseigne les deux secrets ci-dessous (section « À REMPLIR »).
-- 2. Supabase Dashboard → SQL Editor → colle ce fichier entier → Run.
-- 3. Vérifie avec la requête de contrôle, tout en bas.
--
-- Idempotent : le relancer ne crée pas de doublon (on déplanifie avant de
-- planifier).
--
-- ⚠ NON TESTÉ CONTRE UN VRAI PROJET SUPABASE — l'environnement de
-- développement ne l'atteint pas. Relis la sortie du SQL Editor plutôt que de
-- supposer que ça a marché.
-- ─────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─────────────────────────────────────────────────────────────────────
-- À REMPLIR — deux valeurs, et le secret ne se met PAS en clair ici.
--
-- ⚠ CE FICHIER EST VERSIONNÉ. Un `CRON_SECRET` collé dans le SQL part dans
-- git, et un secret poussé reste dans l'historique même après suppression :
-- il faut le considérer comme brûlé et le faire tourner. On passe donc par
-- le **Vault** de Supabase, qui chiffre au repos et n'apparaît jamais dans un
-- diff.
--
-- Exécute ces deux lignes UNE FOIS, dans le SQL Editor, avec tes vraies
-- valeurs — puis ne les recommite pas.
-- ─────────────────────────────────────────────────────────────────────

-- select vault.create_secret('https://alphasalesos.eagleyecorp.fr', 'alpha_base_url', 'Origine publique de l''app, sans slash final');
-- select vault.create_secret('<LE MÊME QUE CRON_SECRET SUR VERCEL>', 'alpha_cron_secret', 'Doit être identique à la variable CRON_SECRET');

-- ─────────────────────────────────────────────────────────────────────
-- L'APPEL — une seule fonction, deux routes.
--
-- ⚠ UNE SEULE DÉFINITION DE « COMMENT ON APPELLE UN TICK ». Deux blocs
-- `cron.schedule` recopiant chacun leur en-tête finiraient par diverger le
-- jour où l'un des deux est corrigé — et personne ne verrait lequel.
-- ─────────────────────────────────────────────────────────────────────

create or replace function public.appeler_tick(chemin text)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  base   text;
  secret text;
begin
  select decrypted_secret into base   from vault.decrypted_secrets where name = 'alpha_base_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'alpha_cron_secret';

  -- ⚠ On ÉCHOUE plutôt que d'appeler sans en-tête. Sans secret, la route
  -- rendrait 401 et le job serait compté comme « exécuté » : un ordonnanceur
  -- qui se fait refuser toutes les dix minutes en silence est exactement le
  -- genre de panne que ce dépôt paie en boucle. Ici, ça se voit dans
  -- `cron.job_run_details`.
  if base is null or secret is null then
    raise exception 'Vault incomplet : pose alpha_base_url ET alpha_cron_secret avant de planifier.';
  end if;

  return net.http_post(
    url     := base || chemin,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body    := '{}'::jsonb,
    -- Borné : la route elle-même se limite à 60 s. Un POST qui pend plus
    -- longtemps que la fonction qu'il appelle n'apprend plus rien.
    timeout_milliseconds := 60000
  );
end;
$$;

-- Personne d'autre que le planificateur n'a à déclencher des appels.
revoke all on function public.appeler_tick(text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- LES DEUX PLANS.
--
-- ⚠ pg_cron lit ces expressions en **UTC**, pas en heure de Paris. `9-18`
-- ici, c'est 10h-19h l'hiver et 11h-20h l'été. C'est volontairement LARGE :
-- comme dit plus haut, c'est la route qui tient la fenêtre réelle. Cet
-- horaire ne sert qu'à ne pas payer des invocations la nuit.
-- ─────────────────────────────────────────────────────────────────────

select cron.unschedule('alpha-campagne-tick') where exists (select 1 from cron.job where jobname = 'alpha-campagne-tick');
select cron.unschedule('alpha-push-tick')     where exists (select 1 from cron.job where jobname = 'alpha-push-tick');

-- Campagne : toutes les 10 minutes en journée, du lundi au vendredi.
-- La route prend au plus `MAX_CALLS_PER_TICK` par passage — le débit se règle
-- là-bas, pas ici.
select cron.schedule('alpha-campagne-tick', '*/10 7-18 * * 1-5', $$select public.appeler_tick('/api/campaign/tick')$$);

-- Notifications : toutes les 30 minutes, même plage. Faire vibrer un
-- téléphone plus souvent que ça n'a jamais fait avancer un dossier.
select cron.schedule('alpha-push-tick', '*/30 7-18 * * 1-5', $$select public.appeler_tick('/api/push/tick')$$);

-- ─────────────────────────────────────────────────────────────────────
-- CONTRÔLE — à lancer APRÈS, et à relire vraiment.
--
-- ⚠ Un job PLANIFIÉ n'est pas un job qui RÉUSSIT. La deuxième requête est
-- celle qui compte : elle montre ce que la route a réellement répondu. Un
-- `status: failed` en boucle, ou des 401/412 répétés, veut dire que le Vault
-- ou les variables d'environnement ne concordent pas — et rien d'autre ne te
-- le dira.
-- ─────────────────────────────────────────────────────────────────────

-- select jobid, jobname, schedule, active from cron.job where jobname like 'alpha-%';
-- select j.jobname, d.status, d.return_message, d.start_time
--   from cron.job_run_details d join cron.job j using (jobid)
--  where j.jobname like 'alpha-%' order by d.start_time desc limit 20;

-- Pour tout arrêter, sans rien désinstaller :
-- select cron.unschedule('alpha-campagne-tick'), cron.unschedule('alpha-push-tick');
