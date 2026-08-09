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

## ⏳ Ce qui reste EAGLEYE-spécifique (à généraliser)

- **Prompts IA** (`/api/agent`, `/api/ai`, `/api/sparring`, `/api/social/draft`,
  `/api/voice/call`) : ils disent « EAGLEYE CORP (Lyon) » en dur. À remplacer par
  l'identité du compte (injecter `agencyName` + `offer` comme on injecte déjà
  `businessRules`). L'IA parlerait alors AU NOM du revendeur, pour SON offre.
- **Page `/offre`** : le calculateur et les paliers (setup 2 500 €, 30 %,
  Starter/Growth/Scale de `lib/pricing.ts`) sont le modèle **d'EAGLEYE**. Pour un
  revendeur, ce sont SES prix — à rendre configurables (ou masquer selon le rôle).
- **Studio social** (`lib/social.ts`) : le générateur nomme « EAGLEYE CORP ». À
  brancher sur `agencyName`/`offer`.
- **Divulgation voix** (art. 50) : « pour le compte de EAGLEYE CORP » doit devenir
  « pour le compte de {agencyName} » — important juridiquement pour un revendeur.

## L'ordre recommandé

1. **Fait** : documents prospect white-label + config « Mon offre ».
2. Prompts IA → injecter l'identité du compte (le gros levier : l'IA vend l'offre
   du revendeur). ⚠ À tester avec une vraie clé IA.
3. Divulgation voix au nom du compte (juridique).
4. `/offre` : prix configurables par compte (ou séparer « le modèle EAGLEYE » du
   « ton offre à toi »).

> Tant que les prompts IA ne sont pas généralisés, un revendeur a des **documents**
> à sa marque mais une **IA** qui parle encore comme EAGLEYE. C'est la prochaine
> brique, et c'est celle qui change tout pour la revente.
