# Facturation Stripe — abonnements SaaS

> Revendre ALPHA SALES OS : le visiteur choisit une offre sur `/souscrire`,
> crée son compte, paie chez Stripe, et **ses droits s'ouvrent tout seuls**.
> **Toi, propriétaire, tu as un accès permanent** — jamais bloqué par la facture.
>
> ⚠ **Ce document était périmé sur trois points** et quiconque le suivait
> aboutissait à un client qui paie et se fait refuser. Corrigé le 27/08/2026 :
> il y a **quatre** offres payables et non deux, le parcours passe par
> `/souscrire` et non `/compte`, et **la table `entitlements` doit exister**
> — sans elle, le paiement réussit et l'application refuse l'accès.

Zéro dépendance : l'app parle à l'API Stripe en `fetch` et **vérifie la
signature des webhooks à la main** (HMAC-SHA256). Pas de SDK.

---

## Ce qui est déjà en place (et prouvé)

- **`lib/stripe.ts`** — Checkout, portail client, vérif de signature, mapping
  plan↔prix, statut d'accès. 9 tests unitaires (signature valide/mauvaise/
  falsifiée/rejeu/multi-v1, statuts, allowlist propriétaire, plans).
- **`POST /api/billing/checkout`** — crée la session de paiement pour le compte
  connecté (identité du JWT, jamais d'un paramètre client).
- **`POST /api/billing/portal`** — ouvre le portail Stripe (gérer / annuler).
- **`POST /api/webhooks/stripe`** — signature vérifiée, met à jour la table
  `subscriptions`. Testé en live : sans/mauvaise signature → 400, signature
  valide → 200.
- **`/souscrire`** — la page PUBLIQUE où on achète : offre → compte → paiement,
  puis le retour de Stripe y affiche l'onboarding daté. Hors de `(app)`, donc
  accessible sans le mot de passe de l'outil interne.
- **`/compte`** — statut d'abonnement du client CONNECTÉ, bouton Gérer.
  Badge « Accès propriétaire » pour les emails de `NEXT_PUBLIC_OWNER_EMAILS`.
- **Provisionnement des droits** — le webhook écrit AUSSI la table
  `entitlements` (briques ouvertes + statut), et la REFERME à la résiliation.
- **Garde-fou** (`REQUIRE_SUBSCRIPTION=1`) : l'envoi d'email exige un abonnement
  actif — le propriétaire passe toujours.

---

## Mise en place (côté toi, une fois)

### 1. Crée les produits/prix dans Stripe

**QUATRE offres sont payables en ligne**, pas deux. La grille est
`lib/offres-publiques.ts` — c'est elle qui fait foi, pas ce tableau.

| Offre | Mode Stripe | Prix | Variable |
|---|---|---|---|
| Essai terrain | **paiement unique** | 290 € HT | `STRIPE_PRICE_ESSAI` |
| Solo | abonnement mensuel | 79 € HT | `STRIPE_PRICE_SOLO` |
| Pro | abonnement mensuel | 149 € HT | `STRIPE_PRICE_PRO` |
| Alpha Voice — 1 000 appels | abonnement mensuel | 364 € HT | `STRIPE_PRICE_VOIX_1000` |

⚠ **L'essai est un paiement UNIQUE.** Le créer en récurrent prélèverait 290 €
tous les mois à quelqu'un qui croyait payer une mise en route. Le code déduit
le mode de la cadence de l'offre — mais si le prix Stripe est mal créé, c'est
Stripe qui gagne.

L'installation complète (10 000 €) n'a **pas** de prix Stripe, et c'est
volontaire : la doctrine impose le cadrage avant tout devis.

### 2. Variables d'environnement (Vercel → Settings → Environment Variables)

```
STRIPE_SECRET_KEY=sk_live_…            # Stripe → Developers → API keys
STRIPE_PRICE_ESSAI=price_…             # paiement UNIQUE, 290 €
STRIPE_PRICE_SOLO=price_…              # abonnement, 79 €
STRIPE_PRICE_PRO=price_…               # abonnement, 149 €
STRIPE_PRICE_VOIX_1000=price_…         # abonnement, 364 €
STRIPE_WEBHOOK_SECRET=whsec_…          # étape 3
OWNER_EMAILS=contact@eagleyecorp.fr        # ton accès permanent (serveur)
NEXT_PUBLIC_OWNER_EMAILS=contact@eagleyecorp.fr  # LA MÊME VALEUR (navigateur)
REQUIRE_SUBSCRIPTION=1                  # exiger un abonnement pour envoyer
```

⚠ **Les deux listes de propriétaires doivent porter la même valeur.** Si elles
divergent, l'écran te traite en propriétaire et le serveur répond 403 — ou
l'inverse. Réglages → **État du système → Compte propriétaire** le dit.

### 2 bis. ⚠ APPLIQUE LES MIGRATIONS — sans elles, le client paie pour rien

`supabase/schema.sql` est en `create table if not exists` : sur une base DÉJÀ
créée, **il ne fait rien**, et le SQL Editor annonce quand même « Success ».
Passe donc les migrations, dans l'ordre, Dashboard → SQL Editor :

1. `supabase/migrations/001-proprietaire-et-tables-serveur.sql`
2. `supabase/migrations/002-entitlements.sql`

La **002** crée `entitlements`, la table que le middleware interroge à chaque
requête pour savoir ce qu'un compte a le droit d'ouvrir. Sans elle, la
séquence est : le client paie → le webhook enregistre son abonnement → le
middleware ne trouve aucune ligne de droits → **accès refusé**. Rien ne
plante, rien ne prévient.

### 3. Déclare le webhook Stripe

Stripe → **Developers → Webhooks → Add endpoint** :

- URL : `https://ton-app.vercel.app/api/webhooks/stripe`
- Événements : `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`
- Copie le **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`. Redéploie.

### 4. Teste de bout en bout

Fais-le **en navigation privée**, comme un vrai inconnu — c'est la seule façon
de voir ce qu'il voit.

1. Ouvre `/souscrire` (sans être connecté). Les quatre offres s'affichent.
2. Choisis **Solo** → crée un compte (email + mot de passe) → **Payer** →
   carte de test `4242 4242 4242 4242`, date future, CVC quelconque.
3. Retour automatique sur `/souscrire?achat=ok&offre=solo` : « Commande
   envoyée » + les premières étapes datées de la mise en route.
   ⚠ L'écran ne dit JAMAIS « paiement confirmé » — une redirection n'est pas
   une preuve, seul le webhook l'est.
4. **Vérifie les DEUX tables** dans Supabase, c'est le point qui compte :
   · `subscriptions` → une ligne, `status = active`, `plan = solo` ;
   · `entitlements` → une ligne, `statut = actif`, `bricks` contenant
     `crm, closer, audits, pilotage`.
   Si la seconde est vide, la migration 002 n'a pas été appliquée.
5. Ouvre `/pipeline` avec ce compte : ça doit passer. Ouvre `/voice` : ça doit
   renvoyer vers `/compte?bloque=/voice` (Solo n'inclut pas la voix).
6. **Gérer l'abonnement** → portail Stripe → annule. Le webhook repasse
   `subscriptions.status` à `canceled` ET `entitlements.statut` à `suspendu`.
   Re-teste `/pipeline` : refusé. Sans cette dernière vérification, tu ne sais
   pas si résilier coûte quelque chose au client.
7. Refais le tour avec **Essai terrain** : le paiement doit être UNIQUE (pas
   d'abonnement créé dans Stripe) et `entitlements.statut` doit valoir
   `essai`, avec `essai_jusqu_a` à +14 jours.

---

## Comment l'accès est décidé

`accountHasAccess(userId, email)` (serveur) :

1. `REQUIRE_SUBSCRIPTION` absent/désactivé → **toujours oui** (mode solo/local
   inchangé) ;
2. email dans `OWNER_EMAILS` → **toujours oui** (toi) ;
3. sinon → abonnement `active` / `trialing` / `past_due` requis.

La source de vérité est la table `subscriptions`, écrite **uniquement** par le
webhook signé. Le navigateur ne peut que **lire sa propre ligne** (RLS
self-select) — il ne peut pas s'auto-attribuer un abonnement.

---

## ⚠ Honnêteté

- **Non testé contre un vrai compte Stripe** dans l'environnement de build. La
  mécanique (signature, mapping, statut) est prouvée par tests + smoke test
  live du webhook, mais le **parcours réel checkout → webhook → statut** reste à
  valider avec tes clés (étape 4). Fais-le avant d'ouvrir aux clients.
- **Le webhook est la seule écriture** du statut : si `STRIPE_WEBHOOK_SECRET` ou
  le service role Supabase manquent, le paiement peut réussir côté Stripe sans
  que l'app le sache. L'État du système (Réglages) montre ces cases — elles
  doivent être vertes avant d'encaisser.
- **Le garde-fou `REQUIRE_SUBSCRIPTION` ne couvre que l'envoi.** Le contrôle
  qui compte désormais est ailleurs : `entitlements` + le middleware, qui
  gouvernent CHAQUE page et CHAQUE API selon les briques achetées.
- **La migration 002 n'a pas été jouée contre un vrai projet Supabase** —
  l'environnement de développement ne l'atteint pas. Relis la sortie du SQL
  Editor plutôt que de supposer que ça a marché.
