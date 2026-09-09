# Play « Permis de construire → maîtres d'OUVRAGE, Lyon + Villeurbanne »

> **⚠ Ce document visait les maîtres d'ŒUVRE. C'était faux, et c'est corrigé.**
> Un maître d'œuvre est celui qui CONSTRUIT ; le maître d'OUVRAGE est celui qui
> commande — et surtout, c'est lui qui devra VENDRE ce qu'il a fait bâtir.
> C'est là qu'est le problème commercial, donc notre offre. La doc décrivait
> une cible que le code ne trie pas : une doc fausse coûte plus cher qu'une doc
> absente.

L'avatar EAGLEYE, décidé le 09/09/2026 : **le maître d'ouvrage professionnel
dont le permis de construire est actif, sur Lyon et Villeurbanne**.

C'est un ICP à **déclencheur**, pas à secteur. « Les promoteurs » dit QUI ; un
permis dit QUI **et** OÙ EN EST l'affaire, au mois près — donc **quand**
appeler. L'arrêté est public, daté et vérifiable.

---

## ⚠ Le piège, et c'est lui qui justifie tout le play

« Maître d'ouvrage » n'est pas un métier, c'est un **rôle juridique** : celui
qui commande les travaux. Le même fichier d'open data contient donc :

| Qui | Devra-t-il vendre ? | Décision |
|---|---|---|
| Promoteur / SCCV qui bâtit 68 lots **pour les vendre** | oui | **cible** |
| Société sans marqueur de promotion (SAS, SARL) sur 30 lots | probablement | **cible, avec le doute écrit** |
| Constructeur de maisons individuelles | oui | **cible** |
| Bailleur social — il **attribue**, il ne vend pas | non | écarté |
| Commune, métropole, hôpital — marché public | non | écarté |
| Un couple qui fait construire sa maison | non | **écarté, et c'est le gros du volume** |

Trier « les maîtres d'ouvrage » sans faire cette distinction revient à
prospecter des particuliers avec un OS de vente à 10 000 €. Et ce n'est pas
qu'une erreur de ciblage : un particulier est un **consommateur**, donc le
décret n° 2022-1313 plafonne le démarchage à 4 sollicitations sur 30 jours
glissants, et c'est nous qui portons le risque.

**C'est implémenté, pas seulement écrit** : `lib/permis-construire.ts` pose
d'abord la question binaire (`devraVendre`) et sort tout ce qui répond non par
une **exclusion sèche que le score ne rattrape pas**.

---

## La fenêtre : le permis dit où en est l'affaire

`phaseDuPermis()` situe chaque ligne. C'est ce qui décide de l'angle — et
appeler avec le mauvais angle coûte l'appel entier.

| Phase | Ce que ça veut dire | Ce qu'on fait |
|---|---|---|
| **recours** (< 2 mois) | le délai de recours des tiers court encore | se faire connaître. **Ne rien vendre** — on arrive deux mois trop tôt |
| **commercialisation** (2–12 mois, chantier non ouvert) | pré-commercialisation : le nombre de réservations conditionne le financement | **la meilleure fenêtre.** Le sujet est le plus vif |
| **lancement-bloqué** (> 12 mois, chantier non ouvert) | soit la commercialisation ne passe pas le seuil, soit l'opération est morte | **le signal le plus fort ET le plus ambigu.** Premier appel = vérifier qu'elle est vivante, rien d'autre |
| **chantier** (DOC déposée) | une partie des lots est vendue | queue de programme : les derniers lots sont les plus longs à écouler |
| **achevé** / **périmé** | plus rien derrière la ligne | écarté |

Validité : **3 ans** (art. R. 424-17 du code de l'urbanisme), prorogeable deux
fois un an. Les prorogations ne sont presque jamais dans l'open data — d'où le
champ `prorogations`, à saisir à la main quand on le sait.

---

## La zone : Lyon + Villeurbanne, et rien d'autre

**Exclusion sèche**, pas un malus de score. Un bon permis de Bron sortait
auparavant *retenu* et rien ne le disait.

Ce que la zone achète : l'ancrage local est le **seul argument vérifiable**
qu'on ait à zéro vente. « Je suis à Villeurbanne, votre programme est à trois
rues » se vérifie ; « je couvre la région » ne vaut rien.

Ce que ça coûte, et c'est assumé : un export métropolitain perd la majorité de
ses lignes. Le lot le **dit** (`trierPermis` compte les hors-zone à part) —
sinon un import qui rend trois fiches sur deux cents ressemble à une panne du
parseur.

> La reconnaissance est **ancrée en début de libellé**, jamais un
> `includes("lyon")` : « Sainte-Foy-lès-Lyon », « Métropole de Lyon » et
> « Grand Lyon » contiennent tous « lyon » et ne sont pas la cible.
> Commune **absente** ≠ hors zone : c'est un angle mort qu'on nomme, pas une
> ligne qu'on jette.

---

## La taille : l'offre doit être proportionnée

Sous **6 logements**, l'opération n'est **pas exclue** — elle est dite
disproportionnée pour l'offre VIP. 10 000 € d'OS de vente représentent une part
indécente du budget de commercialisation de trois lots. C'est **Alpha Voice
seul** qui se propose là, et c'est ce que fait la fiche de démonstration
« Résidences des Gratte-Ciel » (9 logements).

---

## Où est la donnée, et pourquoi elle n'entre pas toute seule

- **Grand Lyon** — `data.grandlyon.com` : autorisations d'urbanisme (numéro,
  pétitionnaire, nature des travaux, dates, parfois le nombre de logements).
- **Sit@del / data.gouv.fr** — base nationale.

**⚠ L'app ne va chercher aucune donnée, et ce n'est pas une limitation
technique.** C'est la troisième colonne de la doctrine : *l'humain relève, la
feuille transporte, Alpha trie.* La collecte reste dehors, remplaçable, et sous
la responsabilité de celui qui la fait. (Accessoirement : l'egress est filtré
depuis l'environnement de dev comme depuis Vercel — mesuré, `HTTP 403`.)

```
n8n / à la main (chez toi)                  Alpha Sales OS
──────────────────────────                  ──────────────
1. Extraire les permis Lyon + Villeurbanne ┐
2. Coller le tableau                       │ → Réglages → panneau de sourcing
   (le format est reconnu tout seul :      │   `ressembleAuPermis` → `importerPermis`
    deux marqueurs, jamais un)             ┘ → fiches créées, déjà triées
```

`parserPermis` accepte un collage tabulaire (CSV, TSV, copie d'un tableur) et
mappe les colonnes par alias (`COLONNES_PERMIS`).

---

## Ce que l'import produit, fiche par fiche

`permisVersProspect()` :

- `stage` reste **prospect** — un maître d'ouvrage relevé dans un fichier
  d'open data n'a **rien demandé**. L'avancer ferait mentir toutes les
  prévisions.
- `preferredChannel` = **linkedin**, pas téléphone. Un export de permis ne porte
  **aucun numéro**, et un directeur de programmes ne se joint pas au standard.
  Mettre « tel » ferait entrer la fiche dans la file d'appels, où elle
  resterait sans numéro jusqu'à ce que quelqu'un s'en aperçoive.
- `notes` porte des **faits datés** (numéro, arrêté, logements, phase), jamais
  la doctrine recopiée : mille fiches qui répètent le même paragraphe pèsent la
  moitié du quota `localStorage` pour zéro information.
- **Aucun euro.** Le nombre de logements dit la taille de l'opération, pas ce
  que le prospect va nous payer.

Puis, pour chaque fiche : **audit** → **routage d'offre** (`matchOffer`) →
séquence.

| Signal dominant | Offre |
|---|---|
| Appels non aboutis sur la ligne du bureau de vente | **Alpha Voice** |
| Contacts à structurer, relances non tenues, cycle long | **Alpha Sales OS** |
| Invisible en ligne (pas de site, peu d'avis) | **Visibilité / Growth** |

Les prix vivent dans `lib/offres-publiques.ts` — **une seule source**, et ils
ont déjà changé deux fois. Aucun montant ne se recopie dans un document.

---

## Le jeu de démonstration en est fait

`PERMIS_DEMO` (`lib/seed.ts`) porte onze arrêtés : **huit** produisent une
fiche, **trois** sont écartés — un particulier, un hors zone, un périmé.
`tests/seed-moa.test.ts` rejoue chacun dans le vrai `lirePermis`.

C'est délibéré que les trois écartés restent dans le lot : « 8 fiches » ne dit
rien du travail fait, « 8 retenus sur 11 » le dit.

---

## Ce que ce play ne prouve pas encore

**Zéro permis converti à ce jour.** Tous les seuils de `lib/permis-construire.ts`
— 6 logements, score minimum 55, les poids par phase — sont des **décisions**,
pas des mesures. Le jour où dix affaires les auront contredits, ce sont eux qui
bougent, à la main, et ça se verra dans un diff.

Ce qui est vrai aujourd'hui, sans rien exagérer : le déclencheur est **public
et daté**, le volume se **renouvelle chaque semaine**, et personne ne sort les
mains vides — un maître d'ouvrage qui n'est pas Alpha Sales OS est Alpha Voice
ou Visibilité.
