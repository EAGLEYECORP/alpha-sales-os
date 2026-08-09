# White-label — Alpha Sales OS vend l'offre du COMPTE

> Principe : **chez EAGLEYE, Alpha Sales OS vend Alpha Sales OS.** Chez un autre
> commercial qui l'achète, l'OS vend **SON** offre à lui. L'app doit donc être
> agnostique à l'offre — EAGLEYE n'est que le **défaut**.

## Ce qui pilote l'offre d'un compte (Réglages → Agence)

- **Nom d'agence** (`agencyName`) — la marque affichée. Défaut « EAGLEYE CORP ».
- **Mon offre** (`offer`) :
  - `city` — ville sur les documents (défaut « Lyon »).
  - `whatYouSell` — ce que tu vends en une ligne (défaut « Alpha Sales OS — l'OS de vente terrain »).
  - `valueProp` — ta proposition de valeur en une phrase.
- **Closer** (`closerName`), **lien de réservation** (`bookingUrl`), **règles
  business** (`businessRules`, déjà injectées dans chaque prompt IA).

## ✅ Déjà white-label

- **Documents prospect** (audit cadeau, projection « projette-toi », lot d'audits) :
  la **marque + la ville** viennent du compte (`brandFromSettings`), plus le nom
  du closer et le lien de réservation. Un revendeur imprime des documents à SA
  marque, pas « Eagleye ».
- **Solution / offre par prospect** : le champ `solution` et `personalizedOffer`
  de chaque fiche est déjà propre au compte (rempli par lui).

- **Prompts IA** (`/api/agent`, `/api/ai`, `/api/sparring`, `/api/social/draft`) :
  ✅ **Fait**. Ils ne nomment plus EAGLEYE en dur. Le client envoie l'identité du
  compte (`buildIdentity(settings)` — `lib/identity.ts`) comme il envoie déjà
  `businessRules` ; l'IA parle AU NOM du compte et vend SON offre. Repli neutre
  (« l'agence ») si rien n'est renseigné. ⚠ Non testé contre une vraie clé IA —
  la mécanique compile/passe les tests ; le rendu réel se valide en prod.
- **Divulgation voix** (art. 50) : ✅ **Fait**. L'appel sortant se déclare déjà
  « pour le compte de {agencyName} » (`app/voice/page.tsx`) ; l'accueil ENTRANT
  (agent Python) prend `VOICE_BRAND_NAME`/`VOICE_BRAND_CITY` (défaut EAGLEYE).
- **Documents prospect** (audit / projection / lot) : ✅ **Fait** (marque du compte).

## ⏳ Ce qui reste EAGLEYE-spécifique

- **Page `/offre`** : le calculateur et les paliers (setup 2 500 €, 30 %,
  Starter/Growth/Scale de `lib/pricing.ts`) sont le modèle **d'EAGLEYE**. Pour un
  revendeur, ce sont SES prix — à rendre configurables (ou masquer selon le rôle).
- **Seed / démo** : les prospects de démonstration et certains libellés restent
  orientés EAGLEYE (sans impact pour un revendeur qui charge ses vraies données).

## L'ordre recommandé

1. ✅ Documents prospect white-label + config « Mon offre ».
2. ✅ Prompts IA + divulgation voix au nom du compte.
3. `/offre` : prix configurables par compte (ou séparer « le modèle EAGLEYE » du
   « ton offre à toi ») — dernier gros morceau EAGLEYE-spécifique.

> L'IA et la voix parlent maintenant au nom du compte. Il reste la page Tarifs à
> rendre configurable pour un white-label complet.
