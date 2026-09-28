# Vendre Alpha Sales OS à la carte — comptes et briques

> Comment un client obtient un compte qui n'ouvre QUE ce qu'il a payé, et
> comment notre usage (EAGLEYE) reste séparé du sien.

---

## Les deux modes, et pourquoi ils ne se comportent pas pareil

C'est la subtilité qui casse un produit si on la rate.

| Situation | Comportement | Pourquoi |
|---|---|---|
| **Aucun compte configuré** (pas de `SUPABASE_JWT_SECRET`) | **SOLO** — tout ouvert | C'est l'usage d'aujourd'hui : l'outil d'une personne. Refuser ici transformerait un outil qui marche en écran vide. |
| Comptes actifs, **session absente ou invalide** | **REFUS** | Un droit qu'on ne peut pas prouver n'existe pas. |
| Comptes actifs, **base injoignable** | **REFUS** | Ouvrir « parce que la base ne répond pas » est exactement la panne qu'un attaquant provoque. |
| Comptes actifs, **email dans `OWNER_EMAILS`** | **MAÎTRE** — tout ouvert | C'est nous. Aucune lecture de base : si la base tombe, on doit encore pouvoir entrer chez nous. |
| Comptes actifs, ligne trouvée | les briques de la ligne | |
| Comptes actifs, **ligne absente** | **REFUS** | Compte créé mais jamais provisionné : ce n'est pas un client sans brique, c'est un client qu'on a oublié. |

**Activer le multi-compte est irréversible dans les faits** : dès que
`SUPABASE_JWT_SECRET` et `NEXT_PUBLIC_SUPABASE_URL` sont posés, les comptes non
provisionnés sont refusés. Provisionner AVANT de poser les variables.

---

## La table à créer

```sql
create table if not exists public.entitlements (
  tenant_id      uuid primary key references auth.users(id) on delete cascade,
  bricks         text[] not null default '{}',
  statut         text   not null default 'essai'
                 check (statut in ('essai','actif','suspendu')),
  essai_jusqu_a  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- Un compte lit SES droits, jamais ceux d'un autre.
create policy "lecture de ses propres droits"
  on public.entitlements for select
  using (auth.uid() = tenant_id);

-- Personne n'écrit ses propres droits depuis l'app. L'écriture passe par le
-- service role (nous). Sans cette absence de policy d'écriture, un client
-- pourrait s'accorder toutes les briques.
```

⚠ Le serveur lit avec le **service role**, qui contourne la RLS. La policy de
lecture protège l'accès direct depuis un navigateur ; le cantonnement côté
route vient de `tenant_id = auth.uid()` dans la requête (`lib/entitlements.ts`).

### Provisionner un client

```sql
insert into public.entitlements (tenant_id, bricks, statut, essai_jusqu_a)
values (
  '<uuid du compte auth.users>',
  array['alpha-voice'],          -- ce qu'il a acheté
  'essai',
  now() + interval '14 days'
)
on conflict (tenant_id) do update
  set bricks = excluded.bricks,
      statut = excluded.statut,
      essai_jusqu_a = excluded.essai_jusqu_a,
      updated_at = now();
```

### Identifiants de briques valides

`alpha-voice` · `campagnes` · `cerveau` · `crm` · `audits` · `tracking` ·
`alpha-live` · `closer` · `agent-alpha` · `pilotage`

Une valeur inconnue est **ignorée**, pas rejetée : elle n'accorde simplement
aucun droit (`normaliserBriques`). Une faute de frappe donne donc un client
sans accès, pas un client tout-puissant.

---

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | active le mode comptes |
| `SUPABASE_JWT_SECRET` | active le mode comptes + vérifie les sessions |
| `SUPABASE_SERVICE_ROLE_KEY` | lit les droits. **Absente = tout refusé** |
| `OWNER_EMAILS` | nos adresses. `@eagleyecorp.fr` ou une adresse exacte, séparées par des virgules |

**`OWNER_EMAILS` vide n'ouvre rien** — la garde est testée. Une variable mal
remplie donne zéro maître, jamais tous.

---

## Où est la barrière, et où elle n'est pas

**La barrière** — `middleware.ts` :
- refuse la **page** → redirection vers `/compte?bloque=<chemin>` ;
- refuse l'**API** → 403 `{ code: "brique_absente" }`.

Les deux passent par la même fonction `autorise()`. **Une page bloquée dont
l'API répond ne protège rien** : c'est le trou classique du contrôle d'accès
« par écran », et c'est pour ça que les API sont traduites vers leur chemin
métier (`lib/api-access.ts`) plutôt qu'exemptées.

**Ce qui n'est PAS une barrière** :
- la navigation filtrée (`lib/use-droits.ts`) — pur confort, pour ne pas
  promener un client dans des culs-de-sac ;
- `/api/compte/droits` — informatif. Le jour où on autorise à partir de sa
  réponse, le trou est rouvert.

### Ce qui reste ouvert, et qu'il faut assumer

Le **code JavaScript** des briques non achetées reste téléchargeable :
`_next/static/**` est exclu du middleware et `_buildManifest.js` liste tous les
chunks. Un client curieux peut lire l'interface d'une brique qu'il n'a pas.

**Ce n'est pas une faille de données** — le serveur refuse la donnée et
l'action. C'est une fuite de propriété intellectuelle sur l'UI. Le corriger
demande un découpage du bundle par brique, qui est un vrai chantier.

**Conséquence commerciale, à dire clairement** : on peut vendre « accès
limité à ce que tu as payé ». On ne peut pas encore promettre « le code des
autres briques t'est invisible ».

---

## Ce qui est réservé à l'équipe, quelles que soient les briques

`/payouts` et `/offre` ne sont ouverts par **aucune** brique. Ce ne sont pas
des fonctionnalités : ce sont nos commissions, nos coûts et notre économie de
partenariat. Un client qui achète tout le catalogue n'y accède pas. Testé.

---

## Ajouter une page ou une route

Le contrôle d'accès se dégrade **par ajout**. Deux tests l'empêchent :

- toute page de `app/(app)/` doit figurer dans `ACCES_PAR_CHEMIN` ou
  `CHEMINS_COMMUNS` ;
- toute route de `app/api/` doit figurer dans `CHEMIN_PAR_API`.

Un oubli fait échouer la suite. Et par défaut, un chemin non classé est
**refusé**, pas autorisé : le bug se voit en développement plutôt qu'en
production.

---

## Ce qui reste à faire avant de facturer un client

1. **Créer la table** et provisionner au moins deux comptes de test.
2. **Tester à deux comptes réels** : un client mono-brique, un maître.
   Vérifier qu'un `fetch` direct vers une API interdite renvoie bien 403 —
   c'est le test qui compte, pas la navigation.
3. **Brancher la facturation sur les briques** : aujourd'hui `bricks` se met à
   jour à la main. Le webhook Stripe ne l'écrit pas encore.
4. **Décider** pour le découpage du bundle (voir plus haut).

Rien de tout ça n'a été testé contre un vrai projet Supabase : l'environnement
de développement n'a pas accès aux services live.
