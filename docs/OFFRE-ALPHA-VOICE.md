# Alpha Voice — l'offre

> Construite sur l'équation de valeur. Le code qui la porte :
> `lib/offre-alpha-voice.ts` (client) et `lib/offre-alpha-voice-cout.ts`
> (serveur — il lit nos marges, il ne descend jamais dans le navigateur).
>
> ⚠ **Zéro vente à ce jour.** La méthode repose normalement sur des
> témoignages et des résultats passés. On n'en a aucun, et en fabriquer serait
> la seule façon de perdre un client pour de bon. Ce qui remplace la preuve
> sociale ici : **ses chiffres à lui**, **une démonstration en direct**, et
> **une garantie chiffrée**. Rien d'autre, et c'est suffisant.

---

## 1. Le nom, et à qui ça parle

**Alpha Voice — on décroche à votre place, 24/7.**

**L'avatar :** l'artisan ou le commerçant de 1 à 10 personnes dont le métier
se fait AVEC LES MAINS et dont les clients arrivent PAR LE TÉLÉPHONE. Garage,
plomberie, serrurerie, dépannage, cabinet dentaire, auto-école. Il ne peut pas
décrocher parce qu'il est sous un capot, sur un toit, ou avec un patient.

**Le résultat rêvé, dans ses mots :** son agenda se remplit tout seul pendant
qu'il travaille.

---

## 2. L'équation de valeur — les quatre leviers

> Valeur = (Résultat rêvé × Probabilité perçue) ÷ (Délai × Effort)

Un pitch qui ne travaille que le premier terme ne déplace rien. Chez un
artisan, **ce qui bloque est au dénominateur** : il n'a pas le temps, et il a
déjà été déçu par un outil qu'il n'a jamais fini d'installer.

| Levier | Ce qu'il vit | Ce qu'on en fait |
|---|---|---|
| **Résultat** | Des appels manqués qu'il ne compte pas, donc une perte invisible | On chiffre AVEC ses chiffres, devant lui, au lieu de promettre un gain |
| **Probabilité** | Il a déjà entendu « l'IA va tout changer » | On ne promet rien : **on fait sonner l'agent pendant le rendez-vous** |
| **Délai** | Tout outil vendu a demandé des semaines | Son numéro ne bouge pas. Ça répond dès le premier jour |
| **Effort** | Il ne veut pas apprendre un logiciel de plus | Rien à ouvrir. Un SMS par appel capté |

Les phrases exactes sont dans `EQUATION` (`lib/offre-alpha-voice.ts`) — pas
recopiées ici, pour qu'il n'y ait **qu'une seule version** à corriger.

---

## 3. La pile — chaque objection devient une ligne

Neuf objections réelles, neuf réponses. Elles ne sont pas inventées : ce sont
celles que le produit sait déjà détecter (`deepAudit`) et celles remontées en
juillet 2026. Les deux qui reviennent le plus : **« trop cher pour mon
volume »** et **« ça va sonner robot »**.

La liste complète vit dans `PILE`. Deux règles la gouvernent :

- **Un bonus qui coûte cher n'est pas un bonus, c'est une remise déguisée.**
  Chaque ligne porte son coût réel (`nul` / `faible` / `reel`), et un test
  refuse qu'un « bonus » soit marqué `reel`.
- **On répond aux objections AVANT qu'il les pose.** Celle qu'il garde pour
  lui est celle qui tue le deal après le rendez-vous.

---

## 4. La garantie — le seul levier qui remplace la preuve sociale

Un témoignage dit « ça a marché pour lui ». Une garantie dit **« si ça ne
marche pas pour VOUS, ça ne vous coûte rien »**. La seconde n'exige aucun
client passé. C'est exactement ce qu'il nous faut.

### La garantie forte

> **Le setup ne se paie qu'au premier rendez-vous.**
> On installe, l'agent tourne, et vous ne payez l'installation que le jour où
> il vous a pris un premier rendez-vous. Après **30 jours de ligne active**,
> s'il n'en a pris aucun, vous ne payez pas l'installation.

**Ce qu'elle nous coûte si le client l'active :** les minutes brûlées —
`coutGarantiePremierRdv()` les chiffre à **quelques euros** — **plus le temps
d'installation, qui est le vrai poste.**

> ⚠ **Ne te trompe pas de coût.** Les minutes sont négligeables. Ce qu'on
> risque, c'est une **demi-journée d'installation faite à la main**. La
> garantie est offrable parce qu'on en offre **peu à la fois** — c'est
> exactement pourquoi elle va de pair avec la rareté du §5, et pas parce
> qu'elle serait gratuite.

> ⚠ **Fourchette, pas mesure.** Le nombre d'appels avant un rendez-vous repose
> sur les taux hypothétiques (30 % de décroché, 20 % d'intérêt qualifié) que
> le palier 10 doit justement mesurer. Seul le **coût à la minute** est relevé
> (0,0563 €/min, 27/08/2026). C'est pour ça que la fonction rend deux bornes
> et une réserve, jamais un chiffre unique.

**C'est ce chiffrage qui rend la garantie décidable, pas le courage.** Une
garantie qu'on n'a pas chiffrée est une bravade — et elle se paie au premier
client qui l'active.

### Les trois bords, dits À L'ORAL

Une garantie sans bord est infalsifiable : un client peut l'activer au bout de
trois jours en ayant coupé la ligne. Un test exige les trois.

| Bord | Ce que ça dit | Pourquoi |
|---|---|---|
| **Durée** | 30 jours de **ligne active** | Sans ça, on ne saura jamais si l'agent a eu sa chance |
| **Périmètre** | Le **setup**, pas l'abonnement consommé | Les minutes ont été payées à l'opérateur |
| **Critère** | Un rendez-vous **pris**, pas honoré | Qui vient et qui signe ne dépend plus de nous — le promettre serait promettre son métier |

**Ça se dit à l'oral, ça ne se découvre pas sur la facture.** Et les deux
autres garanties restent des conditions normales : sans engagement (le mois
entamé reste dû — c'est un abonnement, pas une consigne), et le relevé des
appels manqués offert quoi qu'il arrive.

---

## 5. La rareté — la nôtre est vraie

> ⚠ La rareté fabriquée (« plus que 3 places ! ») est un mensonge qui se
> vérifie en rappelant la semaine suivante. Elle grille le vendeur pour de
> bon, et **un artisan lyonnais parle à ses confrères.**

La nôtre est une contrainte réelle : **l'installation se fait à la main, par
une seule personne.** Le nombre de clients démarrables dans un mois est borné
par le temps de Zakaria, pas par une décision marketing.

> « Je fais les installations moi-même, donc j'en prends peu à la fois. Si on
> se lance, on cale la date maintenant — sinon ce sera le mois suivant. »

**Interdit :** annoncer un nombre de places qu'on n'a pas compté.

---

## 6. L'ancrage du prix

On n'ancre **pas** sur un concurrent qu'on n'a pas relevé. On ancre sur deux
choses qu'il connaît déjà :

1. **Ce qu'il perd** — appels manqués × panier × transformation. C'est SON
   chiffre. Le calcul est fait par `computeLosses` sur sa fiche.
2. **Quelqu'un qui décroche** — pas le salaire net : le coût employeur, les
   congés, l'absence. **On le laisse l'estimer lui-même**, il le sait mieux
   que nous.
3. **Ne rien faire** — l'option qu'il choisit aujourd'hui par défaut. Elle a
   un prix : celui qu'on vient de calculer ensemble.

> ⚠ **Aucun montant n'est écrit dans le module d'offre, et un test l'interdit.**
> Les prix vivent dans `lib/offres-publiques.ts`, un seul endroit. Trois
> sources pour un prix, c'est un devis qui ne correspond à aucun des deux
> autres écrans.

---

## 7. Le déroulé du rendez-vous

Ce n'est pas un script à lire. C'est la **suite**, et elle compte plus que les
mots.

| | Étape | Le but |
|---|---|---|
| 1 | Sa semaine | Combien d'appels il rate. **C'est lui qui donne le chiffre.** |
| 2 | Le calcul | Multiplier devant lui. **Se taire.** Le laisser réagir au montant. |
| 3 | L'écoute | Faire sonner l'agent, **maintenant**. C'est la démonstration, pas une promesse. |
| 4 | La pile | Répondre aux objections qu'il n'a pas encore posées. |
| 5 | Le prix **+ la garantie** | Le prix ne se dit **jamais** sans la garantie. |
| 6 | La date | Pas « je vous envoie un devis » : **une date d'installation, décidée maintenant.** |

> ⚠ **Le prix arrive en 5, jamais avant.** Règle dure du dépôt
> (`vital-signs`, `master-rappel`) : un prix donné avant que la valeur soit
> vue devient le seul sujet de la conversation. Un test vérifie que l'ordre du
> déroulé le respecte.

---

## 8. Les prix, la garantie, la cadence — décidés le 02/09/2026

Tout ce qui suit était « à trancher ». C'est tranché. Le raisonnement compte
plus que les nombres : c'est lui qui te permettra de les changer sans repartir
de zéro.

### Le prix — deux paliers, plancher à 149 €

| | Minutes | Prix HT/mois | Ordre de grandeur | Marge sur coût mesuré |
|---|---|---|---|---|
| **Essentiel** | 500 | **149 €** | ~200 appels | ~81 % |
| **Intensif** | 1 500 | **349 €** | ~600 appels | ~76 % |

**Setup : 990 € HT** — et il n'est facturé qu'au premier rendez-vous (garantie).
**Au-delà du forfait : 0,20 €/min.** Pas de coupure, pas de palier à revendre.

**Ce qui a changé, et pourquoi :**

- **Cinq paliers → deux.** Cinq options, c'est un menu : l'artisan compare les
  paliers entre eux au lieu de comparer à ce qu'il perd. On doit lui faire
  choisir entre « je récupère ces appels » et « je continue à les perdre ».
- **Le plancher passe de 59 € à 149 €.** Trois raisons : (a) **59 € ne
  couvrait pas le socle fixe de la plateforme (~57 €/mois)** — le palier
  d'entrée était une perte déguisée en offre d'appel ; (b) un prix aussi bas
  se lit comme un gadget par quelqu'un qui compare mentalement à une
  secrétaire, et abîme donc la *probabilité perçue*, deuxième terme de
  l'équation ; (c) la valeur récupérée se compte en milliers d'euros par mois
  — à 149 €, on facture ~5 % de ce qu'on lui fait récupérer.

> ⚠ **Le coût à la minute est MESURÉ (0,0563 €). Les prix sont des DÉCISIONS.**
> Aucune vente ne les a validés. Le premier client qui refuse en disant
> pourquoi vaudra plus que tout ce raisonnement.

### La garantie — celle-ci, et pas les deux autres

> **Le setup ne se paie qu'au premier rendez-vous.** Après 30 jours de ligne
> active, s'il n'en a pris aucun, tu ne paies pas l'installation.

Les deux autres (sans engagement, relevé offert) restent des conditions
normales : elles ne coûtent rien et ne lèvent rien. Celle-ci répond à la
question qu'il ne pose pas à voix haute — *« et si ça ne marche pas chez
moi ? »* — celle qu'un témoignage aurait traitée, et qu'on ne peut pas traiter
autrement à zéro vente.

> ⚠ **Son vrai coût n'est pas les 8 € de minutes.** C'est le **temps
> d'installation**, fait à la main : une garantie activée coûte une
> demi-journée. Elle est offrable parce qu'on en offre **peu à la fois** —
> c'est exactement pour ça qu'elle va de pair avec la rareté du §5.

**Les trois bords, à dire à l'oral :** une **durée** (30 jours de ligne
active — couper au bout de trois jours ne la déclenche pas), un **périmètre**
(le setup, pas l'abonnement consommé : les minutes ont été payées à
l'opérateur), un **critère** (un rendez-vous **pris**, pas honoré — qui vient
et qui signe ne dépend plus de nous, et le promettre serait promettre son
métier).

### La cadence — 3 rappels, plus 5

`[3, 24, 32]` heures : même jour plus tard · lendemain matin · lendemain
après-midi. Trois **créneaux différents** — insister à 9h trois jours de suite
ne mesure rien. Calés sur des fenêtres réellement ouvertes, 3 h minimum entre
deux.

**Pourquoi trois et pas cinq :**

1. **Le régime à deux vitesses disparaît.** Le décret plafonne à 4
   sollicitations, premier appel compris — donc 3 rappels. À cinq, une fiche
   sans SIREN suivait une cadence tronquée et une fiche avec SIREN la cadence
   entière : deux comportements, et le risque toujours de notre côté. À trois,
   tout le monde suit la même et le plafond redevient **un filet qu'on ne
   touche jamais**.
2. **Les tentatives 4 et 5 ne sont pas mesurées.** Elles coûtent des minutes
   et de la réputation réelles sur une intuition. C'est à ça que servent les
   paliers, pas à la cadence.
3. **Notre doctrine le disait déjà.** Master Rappel : « 3+ touches ignorées →
   changer de canal ». Cinq appels sur une ligne muette contredisaient le
   module qui pilote tout le reste.

> ⚠ Remonter le tableau **réactive le plafond légal** sur les cibles sans
> SIREN. Le filet ne s'enlève pas avec le chiffre, et c'est testé.
