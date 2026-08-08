# Facturation Stripe — abonnements SaaS

> Revendre ALPHA SALES OS à d'autres commerciaux : chaque compte s'abonne
> (Solo 79 €/mois, Pro 149 €/mois), Stripe encaisse, l'app connaît le statut.
> **Toi, propriétaire, tu as un accès permanent** — jamais bloqué par la facture.

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
- **`/compte`** — statut d'abonnement, boutons S'abonner (Solo/Pro), Gérer.
  Badge « Accès propriétaire » pour les emails de `NEXT_PUBLIC_OWNER_EMAILS`.
- **Garde-fou** (`REQUIRE_SUBSCRIPTION=1`) : l'envoi d'email exige un abonnement
  actif — le propriétaire passe toujours.

---

## Mise en place (côté toi, une fois)

### 1. Crée les produits/prix dans Stripe

Stripe → **Products** → crée « ALPHA SALES OS — Solo » avec un **prix récurrent
mensuel de 79 €**, et « … Pro » à **149 €/mois**. Copie l'**ID de prix** de
chacun (`price_…`).

### 2. Variables d'environnement (Vercel → Settings → Environment Variables)

```
STRIPE_SECRET_KEY=sk_live_…            # Stripe → Developers → API keys
STRIPE_PRICE_SOLO=price_…              # l'ID de prix Solo (étape 1)
STRIPE_PRICE_PRO=price_…               # l'ID de prix Pro
STRIPE_WEBHOOK_SECRET=whsec_…          # étape 3
OWNER_EMAILS=contact@eagleyecorp.fr        # ton accès permanent (serveur)
NEXT_PUBLIC_OWNER_EMAILS=contact@eagleyecorp.fr  # idem, badge côté navigateur
REQUIRE_SUBSCRIPTION=1                  # exiger un abonnement pour envoyer
```

Et applique `supabase/schema.sql` (il crée la table `subscriptions`).

### 3. Déclare le webhook Stripe

Stripe → **Developers → Webhooks → Add endpoint** :

- URL : `https://ton-app.vercel.app/api/webhooks/stripe`
- Événements : `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`
- Copie le **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`. Redéploie.

### 4. Teste de bout en bout

1. Connecte-toi avec un compte de test (PAS un email propriétaire).
2. `/compte` → **S'abonner** (Solo) → paie avec la carte de test Stripe
   `4242 4242 4242 4242`, date future, CVC quelconque.
3. Retour sur `/compte` → le statut passe **Actif**, plan Solo, échéance
   affichée (le webhook a écrit dans `subscriptions`).
4. **Gérer l'abonnement** → le portail Stripe s'ouvre ; annule → le webhook
   repasse le statut à `canceled`.
5. Avec `REQUIRE_SUBSCRIPTION=1`, un compte **sans** abonnement qui tente un
   envoi reçoit **402** ; ton compte propriétaire, lui, envoie toujours.

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
- **Le garde-fou ne couvre que l'envoi** pour l'instant (l'action à valeur).
  Étendre à d'autres actions payantes est un ajout simple si tu le souhaites.
