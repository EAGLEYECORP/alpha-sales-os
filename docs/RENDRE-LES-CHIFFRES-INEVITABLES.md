# Ce qu'il faut faire pour qu'il soit déraisonnable de ne PAS avoir de chiffres

> Écrit le 13/09/2026. Ce document ne promet rien : il part de la **seule
> mesure maison** du dépôt (`JUILLET_REEL`) et dit ce qui, mécaniquement, en
> découle — puis il dit où la mécanique s'arrête.

---

## Ce qui est MESURÉ, et ce qui ne l'est pas

Juillet 2026, constaté sur nos propres affaires :

| | |
|---|---|
| Prospects travaillés | **78** |
| Appels | 132 · Audits envoyés : 18 · SMS : 24 |
| **RDV obtenus** | **6** |
| Taux travaillés → RDV | **11,8 %** |
| **Gagnés** | **0** |

**Deux conclusions opposées sortent du même tableau, et il faut tenir les deux.**

1. **Le RDV est une mécanique.** 11,8 % est un taux mesuré, sur un
   dénominateur connu. Travailler 300 fiches produit ~35 RDV, non pas parce
   qu'on l'espère mais parce que c'est ce qui s'est produit sur 78.
2. **L'euro n'est pas une mécanique.** `gagnes: 0`. Le taux RDV → signature
   n'a **jamais** été mesuré chez nous. Aucun raisonnement, aucune projection
   et aucun tableur ne peut le produire : il faut une signature.

> ⚠ **Donc la phrase honnête n'est pas « fais ça et tu gagneras X € ».** C'est :
> **« fais ça et il devient déraisonnable de ne pas avoir de RDV — et le
> premier closing mesurera ce que personne ici ne sait encore. »**

---

## Les sept actions, dans l'ordre des dépendances

### 1. Charger 300 fiches de l'ICP — et pas 50

`FUEL_TARGET = 300`. C'est le seul chiffre qui rend le reste inévitable : à
11,8 %, 300 fiches valent ~35 RDV et 50 fiches en valent 6. Un taux ne se
négocie pas, un dénominateur si.

> ⚠ **C'est la seule étape que personne ne peut faire à ta place.** Le proxy de
> développement n'atteint pas `data.grandlyon.com`. Sans carburant, tout ce qui
> suit est une simulation.

### 2. Ne garder que ceux qui CROULENT sous la demande

`SATURATION_LOGEMENTS = 20`. Qui manque de demande a besoin de clients, pas
d'un système : on serait son seul espoir, sur un budget qu'il n'a pas. Le
résumé d'import compte désormais les retenus sous le seuil — ils sortent de la
file d'attaque, pas du fichier.

### 3. Un audit écrit AVANT toute séquence

La seule leçon *mesurée* de juillet, et elle est brutale :

| Secteur | Prospects · Appels · Audits · Opportunités |
|---|---|
| Auto-école | 3 · 7 · **2** · **3** |
| Immobilier | 8 · 10 · **4** · **2** |
| Dépannage / plomberie | 14 · **26** · **0** · **0** |

**26 appels sans une seule pièce écrite n'ont rien produit.** Là où un audit
est parti, le taux monte. Ce n'est pas une opinion sur la méthode : c'est le
seul levier du dépôt dont l'effet ait été constaté.

### 4. Tenir le rythme : 20 touches par jour, 5 jours sur 14

`RHYTHM_DAYS = 5`, `RHYTHM_MIN_TOUCHES = 20`. En dessous, le taux mesuré ne
s'applique pas — il a été constaté sur un mois travaillé, pas sur trois jours.
La régularité n'est pas une vertu, c'est ce qui rend le dénominateur réel.

### 5. Saisir le montant, et marquer les paiements `payé`

Sans ça, `/preuves`, `/payouts` et `lib/part-resultat` rendent **`null`**, pas
un chiffre. C'est voulu — on n'invente pas un résultat — mais ça veut dire
qu'**un encaissement non saisi est un encaissement invisible**. Tu aurais fait
le chiffre sans pouvoir le montrer.

### 6. Consigner CHAQUE résultat d'appel dans l'app

C'est ce qui fait exister le dénominateur. Un appel passé et non consigné ne se
voit nulle part : il ne corrige pas les poids du tri (`lib/calibration.ts`), il
ne nourrit pas le Cerveau, il ne compte pas dans les taux. Un mois de travail
non consigné produit exactement les mêmes chiffres que zéro mois.

### 7. Mesurer, une fois, le taux RDV → signature

**L'action qui vaut le plus, et elle ne demande aucun outil.** Ce taux est le
seul inconnu entre le RDV et l'euro. Tant qu'il vaut `null` :
- aucune projection de chiffre d'affaires n'est défendable ;
- aucun palier de campagne ne peut être dimensionné autrement qu'au doigt ;
- la part sur le résultat n'a pas de base.

Six RDV ont eu lieu en juillet et zéro n'a été gagné. **On ne sait pas si c'est
le produit, le prix, la cible ou le closing** — et on ne le saura pas en y
réfléchissant.

---

## Ce que ces sept actions rendent déraisonnable

Si les sept sont faites, **ne pas avoir de rendez-vous** devient déraisonnable :
le taux est mesuré, le dénominateur est posé, le levier de l'audit est connu.

**Ne pas avoir d'euros reste possible**, et il faut le dire : ça dépend d'un
taux que personne ici n'a jamais observé. Le premier client qui signe — ou qui
refuse en disant pourquoi — vaudra plus que tout ce document.

> ⚠ **Les hypothèses à NE PAS confondre avec ce qui précède.** Les paliers de
> campagne (`lib/paliers-campagne.ts`) supposent 30 % de décroché et 20 %
> d'intérêt qualifié parmi les décrochés. **Ni l'un ni l'autre n'est mesuré**,
> et c'est le second qui fait dire « un closer suffit pour 500 appels/jour ».
> Ces deux nombres ne doivent jamais entrer dans une projection présentée à
> quelqu'un.
