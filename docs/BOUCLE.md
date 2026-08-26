# LA BOUCLE — où va la donnée, et par où elle revient

> Ce document sert à UNE chose : voir d'un coup d'œil si un module écrit dans
> le vide. Il ne décrit pas ce qu'on aimerait, il décrit ce qui est branché —
> et `tests/boucle-terrain.test.ts` le vérifie à chaque `npm test`.

## Le problème qu'on avait

Le flux terrain allait dans un seul sens :

```
sourcing → qualification (poids devinés) → file d'appels → appel
  → résultat consigné → … et plus rien.
```

Chaque module était juste pris isolément. **Trois défauts sur cinq étaient des
modules corrects, mal raccordés** — c'est le mode d'échec dominant de ce
projet, et c'est celui que les tests unitaires ne voient pas.

## Le tour complet

```
        ┌─────────────── TERRAIN ───────────────┐
        │                                        │
  tableur / Places ──► import + qualification ──► file d'appels
        ▲                    ▲         ▲              │
        │                    │         │              ▼
        │              (2) poids   (3) leçons     appel passé
        │               calibrés    du métier          │
        │                    ▲         ▲               ▼
        │                    │         │        résultat consigné
        │                    │         │         (RESULTATS_MANUELS)
        │                    │         │               │
        │                    │         │      ┌────────┼────────┐
        │                    │         │      ▼        ▼        ▼
        │                    │         │  (1) cadence  │   (4) plafond
        │                    │         │   du robot    │      légal
        │                    │         │               ▼
        │                    └─────────┴────────  débrief → Cerveau
        │                                                    │
        └──── (5) ouvertures / clics ──► plan de comms ◄──────┘
```

## Les cinq arcs de retour

| # | De | Vers | Module | Ce qui était cassé |
|---|---|---|---|---|
| 1 | résultat d'appel | cadence du robot | `lib/call-outcome.ts` (`RESULTATS_MANUELS`) | « à rappeler » et « pas intéressé » étaient relus « sans réponse ». Le robot rappelait des gens qui avaient déjà décroché, et des gens qui avaient dit non. |
| 2 | résultat d'appel | poids du tri | `lib/calibration.ts` | Aucun module ne relisait les résultats. `AVIS_DEMANDE_ELEVEE = 80`, plainte = 45 points : des hypothèses que rien ne pouvait démentir. |
| 3 | débrief / objection / perte | file d'appels du métier | `lib/lecons-terrain.ts` | `leconDeDebrief` n'était appelée nulle part, et la session d'appels ne lisait pas le Cerveau. Ce qui avait débloqué un garagiste mardi était invisible mercredi. |
| 4 | fiche (SIREN) | plafond de sollicitations | `cibleDepuisProspect` | L'autopilote appliquait le plafond du décret n° 2022-1313, le plan affiché à l'humain annonçait « rappel n/5 ». Deux réponses pour la même fiche, et la mauvaise était montrée. |
| 5 | ouvertures / clics | plan de comms | `lib/reactivite.ts` | « il ouvre cinq fois » et « il n'ouvre jamais » produisaient le même plan (« saturé »). Ce sont deux situations opposées. |

## Les trois règles qui empêchent la fausse science

Elles s'appliquent à **tout** nouveau module de mesure. Ce ne sont pas des
préférences de style : sans elles, la boucle produit des chiffres qui ont
l'air d'être des preuves.

### 1. Zéro donnée → zéro chiffre

`source: "aucune"`, `valeur: null`. Jamais un `0 %` par défaut : `0 %` est un
**résultat**, l'absence de mesure est un **angle mort**. Les deux se lisent
différemment et mènent à des décisions opposées.

C'est aussi pour ça que `calibrer([])` rend une liste `manque` : se taire
serait aussi trompeur que mentir.

### 2. Jamais un taux nu

Dénominateur + intervalle de **Wilson à 95 %**, systématiquement. « 20 % » sur
10 appels, c'est en réalité « entre 6 % et 51 % » — soit rien.

Wilson et pas l'approximation normale : sur 8 appels sans décroché, la normale
affirme « 0 % ± 0 », ce qui est faux **et** dangereux.

Et la réserve voyage avec le chiffre : un taux d'ouverture est un **plancher**
(les images sont bloquées par défaut), une ouverture comptée ne prouve pas
qu'un humain a lu (proxys de confidentialité), un clic simultané à l'envoi est
un scanner de sécurité.

### 3. Aucun poids ne s'auto-corrige

Sur quarante appels, un ajustement automatique apprend le **bruit** et le grave
dans le tri. Le module rend un verdict (`confirme` / `infirme` / `indecis` /
`insuffisant`, sur fourchettes disjointes) et **nomme le fichier à modifier**.
La constante se change à la main, et ça se voit dans un diff.

> Le verdict sur fourchettes disjointes est plus SÉVÈRE qu'un test de
> comparaison de proportions : on ratera de vrais écarts. C'est le sens de
> l'erreur qu'on choisit — un faux « confirmé » durcit un poids et oriente des
> milliers d'appels.

## Ce qu'il faut faire pour que la boucle serve à quelque chose

**Appeler un lot MÉLANGÉ.** N'appeler que les meilleurs scores empêche
définitivement de savoir si le score est bon : il n'y a plus de bras de
comparaison. `calibrer` le dit à l'écran quand ça arrive.

Seuils actuels : `ECHANTILLON_MIN = 30` tentatives pour qu'un taux pilote le
plan ; `ECHANTILLON_MIN_BRAS = 12` fiches de chaque côté pour juger un critère.

## Ce qui n'est PAS bouclé, et pourquoi

- **Le taux de RDV mesure le closer humain, pas Alpha Voice.** Par doctrine,
  l'agent passe la main dès qu'on lui répond : il ne pose jamais de RDV.
- **Les ouvertures ne deviennent pas des événements de la timeline.** Elles
  sont lues au moment d'afficher le plan. Les transformer en touches
  fausserait le compteur de saturation, qui compte des touches SORTANTES.
- **Rien n'est entraîné.** Aucun modèle, aucun poids appris. C'est une mémoire
  qui s'écrit et une mesure qui se lit — prétendre autre chose serait mentir.
