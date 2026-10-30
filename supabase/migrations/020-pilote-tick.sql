-- ─────────────────────────────────────────────────────────────────────
-- LA PLANIFICATION DU PILOTE SERVEUR (30/10/2026) — table : 019.
--
-- Ce fichier RÉUTILISE `public.appeler_tick(chemin)` (défini par 004, qui pose
-- le Vault) : il reste donc HORS du lot à coller, comme 014 et 016.
--
-- Toutes les 5 minutes, jours ouvrés, de 8 h à 19 h UTC (couvre 9 h–18 h à
-- Paris, heure d'été comme d'hiver). ⚠ Le cron ne DÉCIDE pas de la fenêtre
-- d'écriture : la route lit `fenetreOuverte` et, hors fenêtre, lit sans
-- écrire. L'horaire n'est qu'une économie d'invocations.
--
-- Réutilise `appeler_tick` (migration 004 : URL de base et secret lus dans le
-- Vault). ⚠ Si `alpha_base_url` pointe encore vers une copie Netlify, ce tick
-- frappe la mauvaise application : la rebaser sur Vercel AVANT d'armer.
select cron.unschedule('alpha-pilote-tick') where exists (select 1 from cron.job where jobname = 'alpha-pilote-tick');

select cron.schedule('alpha-pilote-tick', '*/5 8-19 * * 1-5', $$select public.appeler_tick('/api/campaign/pilote-tick')$$);

-- ⚠ Rien ne part tant que la ligne `pilote_serveur.actif` est fausse : la
-- route lit l'interrupteur à chaque appel et rend 200 « à l'arrêt » sinon.
