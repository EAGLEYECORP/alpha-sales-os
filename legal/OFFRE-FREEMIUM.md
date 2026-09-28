# Offre — délimitation Gratuit / Payant

Définit ce qui est **gratuit (freemium)** et ce qui est **payant**. Sert de
référence commerciale (site, CGV) ET de spécification produit (ce que le code
doit ouvrir/limiter par formule). Aligné sur l'architecture **local-first /
BYO-creds** : le cœur marche en local ; le payant gère l'hébergé, l'IA cloud, le
volume et le support.

## Tableau des formules

| Capacité | Gratuit | Solo — 79 €/mois | Pro — 149 €/mois | Agence — devis |
|---|---|---|---|---|
| Utilisateurs | 1 | 1 | 1 | Plusieurs |
| CRM + pipeline complet | ✅ | ✅ | ✅ | ✅ |
| Fiches prospects | jusqu'à **50** | illimité (usage loyal) | illimité | illimité |
| Rédaction assistée | **templates** (hors-ligne) | **IA cascade** | IA cascade | IA cascade |
| E-mails suivis / mois | **20** | fair use (≈ 40/h) | volume supérieur | sur mesure |
| Tracking durable (ouvertures/clics) | ❌ (mémoire) | ✅ (Supabase) | ✅ | ✅ |
| Débrief voix / transcription | ❌ | ✅ | ✅ | ✅ |
| Appels sortants (voix) | ❌ | option | ✅ | ✅ |
| Sourcing & séquences avancées | ❌ | basique | ✅ | ✅ |
| Studio social (LinkedIn/X/Meta) | ✅ (templates) | ✅ (IA) | ✅ (IA + vidéo) | ✅ |
| Synchro cloud multi-appareils | ❌ | ✅ | ✅ | ✅ |
| Support | communauté / docs | e-mail | e-mail prioritaire | dédié |

> Les seuils entre crochets sont des **valeurs de départ à ajuster**. Le mode
> **local-first reste gratuit** : un commercial peut faire tourner son instance
> avec ses propres clés (Supabase, SMTP, IA) — c'est le socle « one-person
> business ». Le payant = confort, IA gérée, volume, support.

## Principe de délimitation (le « pourquoi »)

- **Gratuit = essayer et travailler en petit**, sans carte bancaire. On ne bride
  pas la valeur pédagogique (toute la doctrine, tout le CRM), on borne le
  **volume** (50 fiches, 20 envois/mois) et l'**IA cloud** (templates seulement).
- **Payant = passer à l'échelle** : IA, tracking durable, voix, volume, synchro,
  support. C'est là que se paie le coût réel (IA, infra, assistance).

## Traduction produit (où le code applique la limite)

| Règle | Point d'application actuel | État |
|---|---|---|
| Envoi exige un abonnement actif (garde-fou) | `REQUIRE_SUBSCRIPTION` → `accountHasAccess` (`lib/stripe.ts`), `/api/send` 402 | ✅ en place (opt-in) |
| Propriétaire = accès permanent | `OWNER_EMAILS` (domaine) | ✅ |
| Plafond d'envoi/heure | `MAX_SENDS_PER_HOUR`, `countRecentSends` par locataire | ✅ |
| **Quota mensuel gratuit (20 envois)** | à ajouter : compteur mensuel par locataire dans `/api/send` | ⏳ à faire |
| **Plafond 50 fiches en gratuit** | à ajouter : contrôle à la création (store/UI) | ⏳ à faire |
| IA cloud réservée au payant | à ajouter : court-circuiter la cascade IA → templates si non abonné | ⏳ à faire |

> `lib/billing.ts` expose déjà les formules payantes (`PLAN_UI`) ; une constante
> `FREE_TIER` documente les limites du gratuit pour l'UI. L'**enforcement** des
> quotas gratuits (mensuel, fiches, IA) est un lot produit à part, à faire quand
> tu ouvres réellement le freemium — chaque limite doit être testée.

## Mentions à reporter dans les CGV

Le tableau ci-dessus doit être résumé à l'article 3 des CGV et sur la page
Tarifs du site, avec la mention « prix HT, TVA en sus » et la définition du
« usage loyal » (fair use) pour éviter l'abus du terme « illimité ».
