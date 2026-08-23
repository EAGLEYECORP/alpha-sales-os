---
name: ai-workflow-webapp
description: Construire une application web métier dont le cœur est un workflow piloté par IA — prise de rendez-vous, gestion de dossiers patients, CRM, back-office. Couvre l'architecture (ce qui vit côté serveur vs navigateur), la doctrine de repli sans IA, la défense contre l'injection de prompt, les données personnelles et de santé, et les murs de volume. À utiliser pour démarrer un nouveau repo de ce type, pour auditer un existant, ou quand une fonctionnalité IA doit entrer dans un produit qui traite de vraies données de vraies personnes.
---

# Application web métier + workflows IA

Cette skill encode ce qui a été appris **en cassant des choses**, pas en lisant
de la documentation. Chaque règle vient d'un bug mesuré sur un produit réel
(Alpha Sales OS), pas d'une bonne pratique recopiée.

Elle vise les produits où l'IA n'est pas la fonctionnalité mais le **moteur
d'un workflow métier** : Tabib.ma / prise de RDV médicale, gestion de dossiers
patients, CRM, back-office opérationnel.

---

## Posture

**Une app métier n'a pas le droit de se tromper en silence.** C'est la seule
règle dont toutes les autres découlent. Un CRM qui perd une note, un agenda
médical qui rate un rappel, une IA qui répond sans sa doctrine : dans les trois
cas la réponse arrive, l'écran a l'air normal, et personne ne sait.

Avant d'écrire une ligne, poser la question : **si ça rate, qui le voit et
quand ?** Si la réponse est « personne » ou « dans six mois », c'est le bug à
traiter en premier, avant la fonctionnalité.

---

## 1. La frontière serveur / navigateur — la règle la plus chère

> **Tout ce qu'un composant client importe est PUBLIC.**

Dans Next.js, `_next/static/**` est servi sans passer par le middleware. Le
`buildId` figure dans le HTML public ; `_next/static/<buildId>/_buildManifest.js`
liste **tous** les chunks de **toutes** les pages. Un mot de passe de site, une
authentification, une page derrière login : rien de tout ça ne protège le
JavaScript. Trois secondes de devtools suffisent.

### Ce qui a réellement fui, sur un produit en production

| Fuite | Chemin |
|---|---|
| Grille tarifaire complète | `page → store → module métier → catalogue` |
| Emails et URLs de partenaires | recopiés dans un corpus RAG *après* avoir été retirés du registre |
| Coûts fournisseurs à la minute (la marge) | un panneau d'admin |
| **16 entreprises réelles : nom, adresse, téléphone** | `require("./data")` dans une action du store |

Ce dernier est le pire, et le plus instructif : **`require()` de chemin statique
n'est pas paresseux pour le bundler.** Le module part dans le chunk même s'il
n'est jamais appelé.

### Les trois leçons

1. **Suivre le GRAPHE d'imports, pas les fichiers.** Un secret retiré d'un
   fichier reste publié si une *phrase* le répète ailleurs dans le graphe. Ça
   s'est produit trois fois de suite sur le même secret.
2. **`import type` est effacé à la compilation.** C'est la seule façon de
   partager la *forme* d'une donnée serveur avec le client sans l'embarquer.
3. **Une « vue publique » dans le même fichier que la donnée privée ne protège
   rien.** Il faut un module séparé, recopié à la main, dont la synchronisation
   est garantie par un **test**, pas par un import.

### Le garde-fou à écrire dès le premier jour

Un test qui part de **chaque fichier `"use client"`** du dépôt, suit le graphe
d'imports (relatifs **et** alias — un walker qui ne suit que `@/` rate tout ce
qui se passe dans `lib/`), et refuse d'atteindre les modules serveur.

Voir `references/garde-fous.md` pour le code du walker.

**Vérifier ce garde-fou par mutation** : réintroduire l'import interdit doit
faire échouer le test. Un test de sécurité qu'on n'a pas vu échouer ne prouve
rien.

---

## 2. Données personnelles et de santé — spécifique à Tabib.ma / dentiste

Ce qui précède devient d'une autre gravité quand la donnée est médicale.

- **Aucune donnée patient ne doit jamais transiter par un module client-importé.**
  Nom, téléphone, motif de consultation, historique : tout passe par une route
  serveur, jamais par un import.
- **Le stockage navigateur (`localStorage`, IndexedDB) n'est pas chiffré et
  survit à la déconnexion.** Sur un poste partagé de cabinet, c'est une fuite
  physique. Un CRM commercial peut se le permettre ; un dossier patient, non.
- **Les logs sont des données personnelles.** Un journal d'activité qui écrit
  « RDV créé — Mme X, 14h, détartrage » est un dossier médical déguisé.
  Journaliser des identifiants, pas des motifs.
- **Les prompts envoyés à un fournisseur d'IA sont une transmission à un tiers.**
  Envoyer un motif de consultation à une API américaine est une décision
  juridique, pas technique. Elle se prend explicitement, se documente, et
  souvent se refuse — pseudonymiser avant l'appel, ou tourner en local.

**Cadre marocain** : la loi 09-08 sur la protection des personnes physiques à
l'égard du traitement des données à caractère personnel, avec la **CNDP** comme
autorité. Les données de santé y sont sensibles et leur traitement demande une
autorisation, pas une simple déclaration. **Vérifier l'état du droit et le
périmètre exact avec un juriste avant de lancer** — ne pas traiter cette section
comme un avis juridique. Si des patients européens sont concernés, le RGPD
s'applique en plus.

**Ce qu'il faut décider avant la première ligne de code**, parce que ça change
l'architecture entière :
- où la donnée patient est **hébergée** (le Maroc exige un encadrement des
  transferts hors du pays) ;
- qui y accède, et comment c'est **prouvé** (RLS + JWT, pas un test côté client) ;
- combien de temps elle est **conservée**, et ce qui la supprime.

---

## 3. Chaque fonctionnalité IA a un repli déterministe

**L'app doit fonctionner sans IA.** Pas « dégradée » — fonctionnelle.

Une clé expire, un fournisseur tombe, un quota saute, le réseau du cabinet
lâche. Si le formulaire de RDV a besoin d'un LLM pour valider un créneau, le
cabinet ferme.

```
IA disponible  → le meilleur résultat
IA absente     → un gabarit déterministe, moins bon, jamais vide
Échec de l'IA  → le gabarit, et on le DIT ("moteur : gabarit hors-ligne")
```

**Le repli mérite autant de soin que le prompt.** C'est lui qui tourne le jour
où ça compte, et c'est précisément le jour où personne ne peut rattraper à la
main. Un repli générique annule tout le travail de personnalisation exactement
au mauvais moment.

**Corollaire souvent raté** : si un prompt a besoin d'un contexte (doctrine,
règles métier, profil), le **serveur** doit avoir ce contexte en repli. Ne
jamais dépendre de ce que le navigateur veut bien envoyer — un client neuf
envoie une chaîne vide, l'IA répond quand même, en moins bien, et rien ne le
signale.

---

## 4. Défense contre l'injection de prompt

Dès qu'un texte que **nous n'avons pas écrit** entre dans un prompt — note
importée, message de patient, transcription d'appel, champ libre d'un
formulaire — il peut contenir des instructions.

Trois mesures, cumulatives :

1. **Clôturer** la donnée non fiable dans un bloc marqué par un nonce
   aléatoire, que le contenu ne peut pas deviner ni fermer.
2. **Placer les règles APRÈS la donnée.** Les modèles pondèrent la récence :
   des consignes en tête de prompt sont plus faciles à écraser.
3. **Détecter et signaler** les motifs d'injection connus plutôt que de les
   filtrer en silence — un filtre muet cache une attaque en cours.

Voir `references/prompts-ia.md`.

**Ne jamais donner à un prompt un pouvoir qu'on n'accepterait pas d'un
inconnu.** Si le LLM peut annuler un rendez-vous, alors le texte du patient
peut annuler un rendez-vous. L'IA propose, un humain ou une règle déterministe
dispose.

---

## 5. Les workflows : ce qui rend une app métier utile

Le cœur d'un produit comme Tabib.ma n'est pas l'IA, c'est **l'enchaînement qui
ne casse jamais**. Points à traiter explicitement :

- **Chaque étape se termine par une action DATÉE.** Un rendez-vous sans rappel
  programmé, une relance sans date : le workflow s'arrête sans que ça se voie.
- **La fréquence suit la réactivité, jamais le calendrier.** Relancer un patient
  qui ne répond pas selon un rythme fixe le fait fuir.
- **Les fuseaux et les heures ouvrables se calculent avec `Intl`, pas avec
  `getHours()`.** Le serveur tourne en UTC ; un rappel « à 9 h » part à 10 h ou
  à 8 h selon la saison, et personne ne comprend pourquoi.
- **Toute troncature doit être dite.** `.limit(2000)` sur une file de rappels
  signifie que des patients ne sont jamais rappelés. Lire une ligne de plus que
  la limite pour *savoir* qu'on tronque, et le remonter.
- **Idempotence.** Un cron rejoué, un bouton double-cliqué, un webhook livré
  deux fois : identifiant déterministe pour tout ce qui s'écrit automatiquement.

---

## 6. Les murs de volume — mesurer, jamais estimer

Écrire un banc d'essai avant d'optimiser. Sur Alpha Sales OS, la mesure a
contredit l'intuition : le mur ressenti (saccade à 500 fiches) n'était pas le
mur supposé (quota à 1 200).

À mesurer systématiquement :

| Quoi | Comment ça casse |
|---|---|
| Poids sérialisé d'un enregistrement | × N donne la date du mur |
| Coût d'une écriture d'état | si un champ écrit à chaque frappe, la frappe rame |
| Recherche / filtrage en mémoire | s'exécute-t-elle pendant une interaction temps réel ? |
| Ce qui grossit sans plafond | journaux, mémoire, historiques |
| Rendu de liste | virtualiser au-delà de ~200 lignes |

**Deux pièges systématiques :**

- **Le stockage navigateur est un cul-de-sac.** ~5 Mo partagés, écriture
  synchrone, tout l'état resérialisé à chaque changement. Acceptable pour un
  outil personnel ; jamais pour un produit multi-utilisateur. Pour Tabib.ma :
  base dès le premier jour, le navigateur n'est qu'un cache.
- **Un débounce de persistance perd des données** si l'onglet se ferme pendant
  le délai. Vider sur `pagehide` **et** `visibilitychange` — `beforeunload` ne
  se déclenche pas sur iOS.

---

## 7. Tests : seuls comptent ceux qui mordent

Un test qui passe la première fois qu'on l'écrit ne prouve rien.

**Protocole obligatoire pour tout test de garde-fou** : casser volontairement
ce qu'il protège, vérifier qu'il échoue, remettre. Si retirer le garde-fou ne
casse aucun test, le garde-fou n'existe pas.

Ce qui mérite un test dans ce type de produit :
- les invariants de sécurité (graphe d'imports, routes internes, absence de
  donnée personnelle dans un bundle) ;
- les **plafonds** — un plafond retiré ne casse rien aujourd'hui, il casse dans
  six mois chez l'utilisateur ;
- les **replis** — et le fait qu'ils soient branchés partout, pas seulement
  qu'ils existent ;
- l'arithmétique métier, posée à la main dans le test (`30 % de 990 = 297`), pas
  recalculée par le code testé ;
- les entrées absurdes : zéro, négatif, `NaN`, chaîne vide. Vérifier qu'aucune
  division par zéro ne produit `NaN` à l'écran.

**Piège vécu deux fois** : un test qui cherche une chaîne interdite dans un
fichier source la trouve dans le *commentaire qui explique pourquoi elle a été
retirée*. Retirer les commentaires avant d'analyser le contenu — sinon on
finit par supprimer l'explication pour faire taire le test.

---

## 8. Démarrer un nouveau repo

Ordre qui évite de tout refaire :

1. **Décider où vit la donnée** (base, pas navigateur) et **qui y accède**
   (RLS + JWT vérifié côté serveur). Tout le reste en découle.
2. **Poser le garde-fou du graphe d'imports** avant d'avoir des secrets à
   protéger. Après, c'est un chantier.
3. **Middleware** : liste explicite des routes publiques, tout le reste fermé
   par défaut. Une route ajoutée doit être *classée*, pas oubliée.
4. **Un module métier pur par domaine**, testé, sans réseau ni clé. C'est ce qui
   permet de tester la logique sans monter l'app.
5. **Le repli déterministe AVANT l'appel IA.** Écrire le gabarit d'abord.
6. **Le banc d'essai de volume** avant la première optimisation.

`references/demarrage.md` contient la checklist opérationnelle,
`references/garde-fous.md` le code des tests structurels,
`references/prompts-ia.md` les patrons de prompt et de défense.

---

## Ce que cette skill ne fait pas

Elle ne choisit pas la pile technique, ne dessine pas l'interface, et ne
remplace pas un juriste sur les données de santé. Elle dit **où sont les pièges
qui ne se voient pas à la relecture** — ceux qui coûtent six mois plus tard.
