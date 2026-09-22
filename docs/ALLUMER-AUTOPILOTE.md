# ALLUMER L'AUTOPILOTE SERVEUR — runbook

> L'autonomie existe déjà (migrations 004/005, `/api/campaign/tick`,
> `/api/push/tick`, paliers, présence). Ce document dit comment la METTRE EN
> MARCHE. Lu dans le code, pas de mémoire.

## ⚠ AVANT DE L'ALLUMER — l'ordre qui évite de scaler zéro
N'arme PAS l'autopilote tant que :
1. **l'envoi n'est pas prouvé** (`/recette`, un email qui arrive) ;
2. **de vrais prospects ne sont pas chargés** (sinon la boucle tourne à vide) ;
3. pour les APPELS : **l'agent vocal local tourne** (sinon le tick refuse de
   composer — garde de présence, migration 005 + `lib/presence-agent.ts`).

Armer avant ça = automatiser zéro, en grillant la réputation du domaine. Les
emails/push ne dépendent pas de l'agent vocal ; les appels si.

## Les gestes (tous les tiens — secrets)

### 1. Supabase → SQL Editor : appliquer les migrations
- `supabase/migrations/004-ordonnanceur.sql`
- `supabase/migrations/005-presence-agent.sql`

### 2. Supabase → Vault : deux secrets (jamais dans le SQL versionné)
```sql
select vault.create_secret('https://alphasalesos.eagleyecorp.fr', 'alpha_base_url', 'Origine publique, sans slash final');
select vault.create_secret('<UN SECRET ALÉATOIRE>', 'alpha_cron_secret', 'Doit être identique à CRON_SECRET sur Netlify');
```
> Sans ces deux valeurs, la fonction `appeler_tick` **échoue exprès** plutôt que
> d'appeler la route sans en-tête (fail-closed).

### 3. Netlify → variables (production, secret)
- `CRON_SECRET` = **exactement** la même valeur que `alpha_cron_secret` du Vault.
- `CAMPAIGN_AUTOPILOT` = `on`  (le verrou `armed()` du tick).
- `CAMPAIGN_PALIER` = `10`  (commence au plus petit ; absent = plafond le plus bas).
> `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà posés.
> Ces trois-là sont sensibles → directement dans Netlify, pas dans le chat.

### 4. Redéploie (les variables ne prennent qu'au build suivant).

### 5. Vérifie
- Le cron est planifié par 004 : `*/10 7-18 * * 1-5` (campagne),
  `*/30 7-18 * * 1-5` (push). Il ne s'exécute vraiment qu'une fois le Vault
  rempli (étape 2).
- `select * from cron.job;` doit lister `alpha-campagne-tick` et `alpha-push-tick`.
- `/moniteur` (lit le serveur) doit montrer l'activité du ROBOT — pas le store.

## Ce que le cron NE décide jamais
Le cron **demande** ; c'est la ROUTE qui refuse hors fenêtre, au-delà du palier,
sans battement d'agent. Élargir l'horaire du cron ne peut pas produire un appel
à minuit — la route mure. C'est voulu, ne le contourne pas.

## L'état honnête
Aucune de ces variables n'est encore posée (`CRON_SECRET`, `CAMPAIGN_AUTOPILOT`,
`CAMPAIGN_PALIER` absents au 22/09). L'autopilote est **prêt, pas armé** — et
c'est le bon état tant que l'envoi n'est pas prouvé et qu'aucun vrai prospect
n'est chargé.
