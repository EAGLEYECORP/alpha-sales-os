# LE MILLION — canal LinkedIn, avatar maîtrise d'ouvrage

> **Écrit le 4 septembre 2026.** Commande : « get us to a million, channel
> LinkedIn », avatar arrêté ensuite — **les maîtres d'ouvrage avec un permis de
> construire actif sur Lyon**, pour l'offre **Alpha Sales OS VIP (10 000 €)**.
>
> ⚠ Ce document contient une conclusion que la commande n'attendait pas. Elle
> est en §2, elle est arithmétique, et elle ne se contourne pas.

---

## 0. Ce sur quoi ce plan s'appuie, et ce qu'il ne peut pas savoir

| | |
|---|---|
| **Mesuré, dans le code** | Le plafond du canal : `LINKEDIN_WEEKLY_LIMIT = 100` invitations par semaine glissante, rampe `[40, 60, 80, 100]` (`lib/linkedin-plan.ts`). |
| **Vérifié le 4/09/2026** | Un permis vaut 3 ans depuis la notification de l'arrêté, prorogeable deux fois un an ; recours des tiers 2 mois depuis l'affichage. |
| **DÉCIDÉ, pas mesuré** | Tous les seuils de `lib/permis-construire.ts` — taille minimale d'opération, poids des phases, score de rétention. Zéro permis converti à ce jour. |
| **INCONNU, et c'est le trou qui compte** | **Combien de maîtres d'ouvrage exploitables il y a réellement sur Lyon.** `data.grandlyon.com` est bloqué par le proxy de ce bac à sable : je n'ai pas pu télécharger l'export et compter. |

**Rien de ce qui suit n'est un pronostic de conversion.** Il n'y a aucune vente
derrière ce produit ; un taux annoncé ici serait inventé, et la règle du dépôt
est claire — zéro donnée, zéro chiffre.

---

## 1. L'avatar, resserré — parce que « maître d'ouvrage » ne veut rien dire

« Maître d'ouvrage » n'est pas un métier, c'est un **rôle juridique** : celui
qui commande les travaux. Dans le même export d'open data, ça recouvre :

| Sur le permis | A-t-il un problème de VENTE ? |
|---|---|
| Un promoteur / aménageur / SCCV qui construit pour vendre | **oui** — et daté, et chiffrable |
| Un constructeur de maisons individuelles | **oui** |
| Un bailleur social (OPAC, Grand Lyon Habitat…) | **non** — il attribue, il ne vend pas |
| Une commune, une métropole, un hôpital | **non** — commande publique |
| Un particulier qui construit sa maison | **non** — et c'est le GROS du volume |

Prospecter « les maîtres d'ouvrage » sans cette coupe, c'est envoyer une offre
à 10 000 € à des couples qui font construire. `lib/permis-construire.ts` pose
donc d'abord une question binaire — **devra-t-il vendre ce qu'il construit ?** —
et tout ce qui répond non sort par une **exclusion sèche** que le score ne
rattrape pas.

### Ce que le permis dit en plus, et que rien d'autre ne dit

Le permis est le seul signal de sourcing qui donne une **date**. Il ne dit pas
seulement qui, il dit **où en est l'affaire** :

| Phase | Ce qu'on peut dire |
|---|---|
| **< 2 mois** — recours en cours | Trop tôt pour la commercialisation à plein régime. Juste à l'heure pour se faire connaître avant. |
| **2 à 12 mois**, chantier non ouvert | **Pré-commercialisation.** Le sujet est le plus vif. |
| **> 12 mois**, chantier non ouvert | **Le signal le plus fort du fichier, et le plus ambigu** : soit les réservations ne suivent pas, soit l'opération est morte. Ça se demande, ça ne se devine pas. |
| Chantier ouvert | Queue de programme — les derniers lots sont les plus longs à écouler. |
| Achevé / périmé | Rien à vendre. Exclusion. |

> ⚠ La donnée est publique, mais **elle sert à CHOISIR qui on contacte, pas à
> ouvrir la conversation**. « J'ai vu que votre permis de 42 logements du
> 12 mars n'a pas encore de chantier » sonne fliqué et ferme la porte. C'est
> écrit dans les interdits de la verticale.

---

## 2. L'ARITHMÉTIQUE — et elle dit non

### 2.1 Ce qu'il faut

**1 000 000 € ÷ 10 000 € = 100 clients.**

C'est la seule façon de lire l'objectif. À 30 % + setup, le nombre change mais
pas l'ordre de grandeur du travail de vente.

### 2.2 Ce que le canal peut porter

Le plafond n'est pas un réglage, c'est la limite de LinkedIn, et elle est déjà
dans le code :

- semaines 1 à 3 (rampe) : 40 + 60 + 80 = **180**
- 49 semaines à 100 : **4 900**
- **Plafond annuel ≈ 5 000 invitations.** Une seule personne, un seul profil.

### 2.3 Ce que le vivier peut porter

C'est là que ça casse. **Il n'y a pas 5 000 maîtres d'ouvrage exploitables sur
Lyon.** Après la coupe du §1 — on retire les particuliers, les bailleurs
sociaux, les collectivités, les opérations de moins de six logements, les
permis périmés et les programmes achevés — ce qui reste, ce sont des
**sociétés** de promotion, et une société porte plusieurs permis.

L'ordre de grandeur plausible pour la métropole lyonnaise se compte en
**dizaines à quelques centaines de sociétés distinctes**, pas en milliers.

> ⚠ **Je n'ai pas pu le vérifier depuis ici** et je refuse d'inventer le
> chiffre : `data.grandlyon.com` est bloqué par le proxy. **C'est la première
> action du plan, et elle prend une heure** — voir §4.

### 2.4 La conclusion

**Si le vivier lyonnais exploitable fait ~200 sociétés, atteindre 100 clients
demande de convertir la MOITIÉ du marché adressable.** Ce n'est pas une
campagne ambitieuse, c'est une impossibilité.

> **LinkedIn + maîtres d'ouvrage + Lyon ne fait pas un million.**
> Ça fait, au mieux, **les premiers clients** — c'est-à-dire entre 30 et
> 100 k€, et surtout **les premières références**, qui sont ce qui bloque
> actuellement tout le reste (zéro vente = zéro preuve sociale = pas de cas
> client, pas de recommandation, pas de dossier de financement).

### 2.5 Ce que le million exige réellement — trois leviers, pas un

1. **La géographie.** C'est le levier le moins cher et le plus sous-estimé :
   le module, la verticale et le script ne dépendent pas de Lyon. Seule la
   ligne d'ancrage local change, et elle vient déjà de la fiche. Le jeu de
   données des permis est **national**. Lyon → Rhône → AURA → France, c'est le
   même import avec un autre fichier.
2. **Le récurrent.** 100 clients à 10 000 € font un million une fois. Les mêmes
   100 clients avec un abonnement le refont chaque année. Tant que l'offre VIP
   est un paiement unique, chaque million doit être reconquis de zéro.
3. **Le canal.** 100 invitations par semaine est un mur dur. Le téléphone n'en
   a pas — et il est déjà construit (`prospection-b2b`, paliers 10 · 100 ·
   1 000). Un directeur de programmes a une ligne directe.

**Horizon honnête : 24 à 36 mois, sur trois leviers.** Pas une campagne
LinkedIn de six mois.

---

## 3. CE QUE LA MÉTHODE DE VENTE CHANGE — le transcript Hormozi, appliqué

Deux règles nouvelles, entrées dans `DOCTRINE_TERRAIN` (`lib/playbook.ts`),
donc injectées dans les prompts de l'IA — pas rangées dans un document.

### 3.1 Compter ses affirmations, et les réduire

> *Un prospect ne croit presque rien de ce que TU dis, et presque tout de ce
> que LUI dit.*

Une affirmation offre une prise : elle se conteste. Une question n'en offre
aucune. Ce n'est donc pas une question de style — **chaque affirmation
supprimée est une objection qui ne naîtra pas.**

**Appliqué, dans le code** : l'invitation LinkedIn est désormais construite
autour d'**une question** (`inviteText`), et non plus autour d'une affirmation
sur ce qu'on fait.

### 3.2 Une affirmation, puis une ANALOGIE — jamais une liste

> *Décrire ce que tu fais sonne soit comme du travail que tu fais — il s'en
> fiche des détails — soit comme du travail qu'il devra faire, et il n'en veut
> pas.*

**Appliqué immédiatement, sur ma propre écriture.** La bascule que je venais
d'écrire pour la verticale disait :

> ~~« … qui garde chaque contact acquéreur avec sa date, son niveau d'intérêt
> et sa prochaine relance »~~ — trois fonctionnalités.

Elle dit maintenant :

> « On installe le système qui tient la liste des acquéreurs à votre place.
> C'est le même principe qu'un planning de chantier : on ne le regarde pas
> pour savoir ce qui est fait, on le regarde pour voir ce qui a pris du
> retard. »

Une affirmation, une analogie prise dans SON métier, zéro fonctionnalité.

> ⚠ Ces deux règles entrent avec leur étiquette : **`[SOURCE EXTERNE —
> praticien, non vérifiée chez nous]`**. C'est un praticien qui a vendu
> beaucoup, pas une mesure faite sur nos affaires. Elles ne doivent pas
> revenir au même rang qu'un chiffre constaté ici.

---

## 4. LA SEMAINE 1 — ce qui se fait, dans cet ordre

| # | Action | Qui | Temps |
|---|---|---|---|
| 1 | Télécharger l'export des permis de la métropole lyonnaise (open data Grand Lyon, ou Sitadel), 24 derniers mois | Zakaria | 1 h |
| 2 | Le coller dans **`/linkedin` → Sourcer** — le format est reconnu tout seul et trié « maîtrise d'ouvrage » | Alpha | 2 min |
| 3 | **LIRE LE COMPTE DE RETENUS.** C'est le chiffre qui valide ou invalide tout le §2 | Zakaria | 5 min |
| 4 | Retrouver à la main le décideur LinkedIn de chaque société retenue (le fichier donne la société, pas la personne) | Zakaria | ~3 min / société |
| 5 | Lancer le **palier 10** : dix invitations, pas cent | Alpha + Zakaria | 1 semaine |

### Ce que le palier 10 sert à mesurer — et ce n'est PAS une vente

Trois taux n'existent nulle part aujourd'hui, et ils commandent tout le
dimensionnement :

1. **taux d'acceptation** de l'invitation sur cette cible ;
2. **taux de réponse** au message post-connexion ;
3. **taux de rendez-vous** parmi les réponses.

Dix invitations ne prouvent rien statistiquement, et le module de calibration
le dira. Mais elles répondent à la seule question qui bloque : **est-ce que ces
gens-là acceptent, et est-ce qu'ils répondent ?** Si l'acceptation est nulle
sur dix, elle sera nulle sur mille — et on l'aura su pour une semaine au lieu
d'un trimestre.

> ⚠ Aucun palier ne se valide tout seul, même tout vert
> (`lib/paliers-campagne.ts`). Automatique = le REFUS.

---

## 5. CE QUI EST BRANCHÉ, ET CE QUI NE L'EST PAS

Parce que le défaut le plus fréquent de ce dépôt est un mécanisme juste branché
nulle part.

**Branché et testé :**
- `lib/permis-construire.ts` — lecture, tri, import tabulaire → fiches ;
- l'écran **`/linkedin` → Sourcer** détecte un export de permis et le route ;
- la verticale `maitrise-ouvrage` (`lib/playbook.ts`), avec son niveau de
  preuve `doctrine` qui **remonte jusqu'à l'écran de ciblage** ;
- les trois messages de la séquence LinkedIn, désormais routés par compte.

**Pas fait, et il faut le savoir :**
- **la collecte.** Alpha ne va rien chercher : l'export se télécharge à la
  main. C'est la troisième colonne, et c'est un choix, pas un manque ;
- **le décideur.** Le permis nomme la SOCIÉTÉ, jamais la personne. Retrouver le
  directeur de programmes est du travail humain, ~3 minutes par société ;
- **la vérification que l'opération est vivante** sur un permis de plus d'un an ;
- **zéro appel** derrière la verticale : le script est une hypothèse. Le
  premier maître d'ouvrage qui raccroche en disant pourquoi vaudra plus que
  tout ce document.

---

## 6. La phrase à retenir

Le million ne se joue pas sur le choix de l'avatar : il se joue sur le fait
qu'aucune vente n'a encore eu lieu. **La bonne cible de ce plan n'est pas
100 clients, c'est le premier — puis les trois suivants.** Lyon et la maîtrise
d'ouvrage sont un bon endroit pour les chercher ; ils ne sont pas un endroit où
trouver cent clients.
