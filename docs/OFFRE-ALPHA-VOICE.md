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
> il vous a pris un premier rendez-vous. S'il n'en prend aucun, vous ne payez
> pas l'installation.

**Ce qu'elle nous coûte si le client l'active :** les minutes de conversation
brûlées avant l'abandon. `coutGarantiePremierRdv()` les chiffre — **quelques
euros**, pas des dizaines.

> ⚠ **Fourchette, pas mesure.** Le nombre d'appels avant un rendez-vous repose
> sur les taux hypothétiques (30 % de décroché, 20 % d'intérêt qualifié) que
> le palier 10 doit justement mesurer. Seul le **coût à la minute** est relevé
> (0,0563 €/min, 27/08/2026). C'est pour ça que la fonction rend deux bornes
> et une réserve, jamais un chiffre unique.

**C'est ce chiffre qui rend la garantie décidable, pas le courage.** Une
garantie qu'on n'a pas chiffrée est une bravade — et elle se paie au premier
client qui l'active.

### Les limites, dites AVANT

Chaque garantie porte sa limite écrite, et un test l'exige :

- La garantie porte sur le **setup**, pas sur l'abonnement du mois écoulé :
  les minutes consommées ont été payées à l'opérateur. **Se dit à l'oral, ne
  se découvre pas sur la facture.**
- Sans engagement : le mois entamé reste dû. C'est un abonnement, pas une
  consigne.

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

## 8. Ce qui reste à décider — et c'est à toi

- **Le prix.** La grille actuelle (990 € + paliers 59→319 €) est **héritée de
  l'ancien revendeur**. Elle est viable (74–76 % de marge sur notre coût
  mesuré), elle n'a **jamais été décidée par nous**. Bémol : le socle fixe est
  ~57 €/mois, donc le premier palier à 59 € ne paie pas l'infrastructure seul.
- **Laquelle des trois garanties tu offres.** La forte (setup au premier RDV)
  est celle qui tue le risque, et elle coûte quelques euros. Les deux autres
  ne coûtent rien.
- **La cadence de rappel.** 5 rappels sur 2 jours étaient exigés par le
  revendeur disparu. Personne ne l'exige plus. Ils sont maintenant **calés sur
  des fenêtres d'appel ouvertes** (jamais le déjeuner, jamais la nuit, jamais
  le week-end, 3 h minimum entre deux) — mais le NOMBRE reste ton choix.
