# Play « Permis de construire Lyon → maîtres d'œuvre »

> ICP à **déclencheur** : un maître d'œuvre (MOE) nommé sur un permis de
> construire **en cours** est en pleine activité — il a des chantiers, des
> clients à gérer, des appels, une image à tenir. C'est le meilleur moment
> pour l'approcher. On l'audite, puis on le route vers **la bonne offre
> EAGLEYE**.

## La règle de routage (après audit)

Chaque MOE audité tombe dans une offre — c'est `matchOffer()`
(`lib/offer-match.ts`) qui décide sur les vrais signaux de la fiche :

| Signal dominant | Offre |
|---|---|
| Appels manqués, métier au téléphone (chantiers, urgences) | **Alpha Voice** — accueil & relance IA 24/7 |
| Leads/deals à structurer, cycle de vente B2B, gros paniers | **Alpha Sales OS** — l'OS de vente intelligent |
| Invisible en ligne (pas de site, peu d'avis, réseaux morts) | **Visibilité / Growth** — offre personnalisée |

> Un MOE cumule souvent deux besoins (téléphone **et** visibilité) : on mène
> avec l'offre au score le plus fort, on garde l'autre en upsell.

## Où est la donnée (open data, gratuite)

- **Grand Lyon** — `data.grandlyon.com` : jeu « permis de construire » /
  « autorisations d'urbanisme » (adresse, pétitionnaire, **nature des
  travaux**, dates, parfois le MOE).
- **Sit@del / data.gouv.fr** — base nationale des autorisations d'urbanisme.
- Le **nom du maître d'œuvre** n'est pas toujours dans le permis : on le
  retrouve via le panneau de chantier, le pétitionnaire, ou une recherche
  société (SIRENE) sur l'adresse.

## ⚠ Le handoff (honnête)

**L'app déployée sur Vercel — comme l'environnement de dev — n'a pas
forcément accès sortant à ces portails** (egress filtré : testé, `HTTP 403`
depuis ici). La récupération se fait donc côté **n8n**, qui tourne chez toi
avec un accès internet plein :

```
n8n (chez toi)                              Alpha Sales OS
─────────────                               ──────────────
1. HTTP Request → data.grandlyon.com  ┐
   (permis en cours, Lyon)            │
2. Filtre : permis récents            │  →  3. POST /api/webhooks/inbound
   + extraction MOE / adresse         │        (ou import CSV depuis Réglages)
                                       ┘  →  4. Fiches créées, prêtes à auditer
```

Puis, dans l'app, pour chaque fiche : **audit** (`/prospects/:id` → onglet
Audit, ou audit en lot) → **routage d'offre** (`matchOffer`) → séquence.

## Le déroulé opérationnel

1. **n8n tire** les permis Lyon en cours → pousse les MOE dans l'app.
2. **Audit** de chaque MOE (site, note Google, avis, présence — `site-fetch`
   marche sur les sites publics ; le reste se saisit).
3. **Routage** : l'app propose l'offre (Alpha Voice / Alpha Sales OS / Visibilité).
4. **Séquence personnalisée** selon l'offre : l'accroche vient de
   `matchOffer().pitch`, l'audit-cadeau porte ta marque.
5. **RDV → démo → close.** Setup **2 500 €** (Alpha Sales OS) ou **990 €**
   (Alpha Voice) selon l'offre retenue.

## Pourquoi ce play est fort

- **Déclencheur public et daté** : le permis prouve l'activité — pas du cold à froid.
- **Volume renouvelé** : de nouveaux permis chaque semaine à Lyon.
- **Trois offres, un seul flux** : tu ne jettes aucun prospect — s'il n'est pas
  Alpha Sales OS, il est Alpha Voice ou Visibilité. Personne ne sort les mains vides.
