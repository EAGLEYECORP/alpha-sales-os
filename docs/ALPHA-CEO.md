# ALPHA CEO — le pilote, pas le maximiseur

> Module : [`lib/alpha-ceo.ts`](../lib/alpha-ceo.ts) ·
> Tests : [`tests/alpha-ceo.test.ts`](../tests/alpha-ceo.test.ts)

**Ce qu'il fait** : il regarde toute l'installation, dit ce qui demande une
main humaine maintenant, ce qui est cassé sans le dire, et dans quel ordre s'en
occuper. Macro d'abord ; le micro s'ouvre sur le module concerné.

---

## ⚠ Le piège est dans le nom

La demande d'origine parlait d'« une version meilleure et plus légère de
paperclip AI ». Le maximiseur de trombones est l'histoire canonique d'un
optimiseur qui **détruit tout ce qui l'entoure en poursuivant un objectif
unique sans regarder ses contraintes**.

Un Alpha CEO qui optimiserait « plus de rendez-vous » ferait exactement trois
choses que la doctrine interdit déjà — et chacune a été payée :

| Ce qu'il ferait | Ce que ça casse |
|---|---|
| Appeler dès que la file est prête | Un premier appel un vendredi renvoyait cinq rappels sur le week-end, **dont un à minuit** |
| Relancer tant qu'il n'y a pas de réponse | Le décret n° 2022-1313 plafonne à **4 sollicitations sur 30 jours glissants** |
| Envoyer au rythme de la génération | La réputation d'un domaine se construit en mois et se perd en une soirée |

**Alpha CEO respecte ces gardes plus vite. Il ne les retire pas.** C'est toute
la différence entre un pilote et un maximiseur, et un test l'applique : le
module ne contient **aucun verbe d'exécution**. Il diagnostique, il ordonne, il
prépare. Le jour où il enverra ou appellera, ça demandera une garde par action —
pas une fonction de plus dans ce fichier.

---

## Les trois natures d'un « point humain »

C'est la distinction qui structure tout. Les confondre est la faute que ce
module existe pour empêcher.

### `automatisable`
Un humain le fait par habitude ou par manque d'outil. **Rien ne se perd à
l'automatiser** — et c'est la minorité des cas.

> Caler les rappels sur les fenêtres d'appel · proposer la prochaine action
> datée · changer de canal après 3 touches ignorées · ordonner la file du jour.

### `humain-par-decision`
**Nous** avons choisi qu'un humain tranche, parce que l'automatiser
**fabriquerait de la preuve**.

> « Aucun palier ne se valide seul, même tout vert. **Automatique = le
> REFUS.** »

Cocher « j'ai entendu la phrase de l'article 50 » sans qu'un appel ait décroché
n'est pas un gain de temps : c'est un faux. Sur quarante appels, un ajustement
automatique des poids apprend le **bruit** et le grave dans le tri.

Alpha CEO **prépare** la décision — il rassemble, il chiffre, il prévient — et
s'arrête avant de la prendre.

### `humain-par-contrainte`
La loi ou un tiers l'exige. Ce n'est même pas notre choix.

> Le tampon d'un partenaire sur un texte qui engage **sa** réputation ·
> l'annonce article 50 de l'AI Act · un SIRET pour facturer une commission ·
> la poignée de main au moment de signer.

Aucune quantité d'ingénierie ne les supprime.

> ⚠ **Les deux dernières catégories ne sont pas un retard à rattraper — elles
> sont le produit.** Une session future qui « optimisera » un point
> `humain-par-decision` en croyant finir le travail cassera précisément ce qui
> distingue cet outil d'un envoyeur de masse. C'est pour ça que **chaque point
> humain porte la RAISON de l'être**, et qu'un test l'exige.

---

## Les pannes silencieuses — l'autre moitié du travail

Le défaut le plus fréquent de ce dépôt n'est pas un bug : c'est **un mécanisme
juste, testé, branché à un seul endroit ou à aucun**. Rien n'échoue, donc rien
n'alerte.

Alpha CEO ne servirait à rien s'il ne surveillait que les décisions. Chaque
panne du relevé porte trois champs, et c'est le deuxième qui a de la valeur :

| Champ | Ce qu'il donne |
|---|---|
| `symptome` | ce que subit celui qui le vit |
| **`pourquoiInvisible`** | **pourquoi personne ne le voit** — le champ qui dit où chercher |
| `detection` | comment le constater, concrètement |

Exemples relevés, tous réels ou structurellement possibles aujourd'hui :

- **SMTP absent** — l'inscription *réussit* côté Supabase, l'écran dit « vérifie
  tes emails » et c'est vrai. Le SMTP par défaut ne délivre qu'au propriétaire
  du projet. L'inscrit croit avoir mal tapé son adresse.
- **SPF cassé** — les mails partent, aucun rebond, journal vert. Et un domaine
  avec **deux** enregistrements SPF est traité comme un domaine qui n'en a
  **aucun** : on casse en croyant améliorer.
- **Migration absente** — `schema.sql` est en `create table if not exists` : sur
  une base déjà créée il ne fait rien, et le SQL Editor annonce quand même
  « Success ». Le client paie, l'app le refuse.
- **Stockage saturé** — une écriture `localStorage` qui rate ne ressemble pas à
  une panne : l'écran continue d'afficher les fiches. Elles disparaissent en
  fermant l'onglet.
- **Pipe non chargé** — un navigateur qui a raté son chargement a une liste
  vide, et la synchro sortante calcule des **suppressions**.
- **Compte sans session** — le serveur rend `statut: "suspendu"`, qui est son
  discriminant interne ; l'écran le lisait comme une phrase adressée à un
  humain, et annonçait un impayé à des visiteurs. *Une valeur, deux sens.*

---

## Les deux règles du diagnostic

### 1. « Pas mesuré » ne produit AUCUNE alerte

`null` n'est pas `false`. « Je n'ai pas regardé » n'est pas « tout va bien » —
mais ce n'est pas une panne non plus. Alarmer sur une absence de mesure
remplirait l'écran de rouge le premier jour, et **on apprendrait à ne plus le
lire**. C'est comme ça qu'un tableau de bord meurt.

L'angle mort se **dit**, séparément (`anglesMorts`). Le taire serait pire : un
tableau tout vert qui n'a rien mesuré ment plus qu'un tableau rouge.

### 2. L'urgent d'abord — l'ordre est la moitié du produit

Une liste non triée se lit dans l'ordre d'écriture du code, donc au hasard.
Celui qui la parcourt traite ce qui est en haut : si le haut n'est pas le plus
coûteux, l'écran fait **perdre** du temps au lieu d'en gagner.

Est `urgent` ce qui coûte quelque chose **qu'on ne récupère pas** : réputation
d'expéditeur, conformité, données perdues.

---

## Ce qu'une alerte porte toujours

- une **action à l'impératif** — une alerte sans verbe informe et reste ;
- un **écran** où aller — c'est là que le micro commence ;
- un drapeau **`humain`** : *Alpha va s'en occuper* ou *Alpha attend que tu
  tranches*. Sans lui, une validation de palier dort jusqu'à ce que quelqu'un
  se demande pourquoi rien ne bouge.

---

## L'écran et les sondes

> Écran : [`app/(app)/ceo/page.tsx`](../app/(app)/ceo/page.tsx) ·
> Branchement : [`lib/ceo-sondes.ts`](../lib/ceo-sondes.ts) ·
> Tests : [`tests/ceo-sondes.test.ts`](../tests/ceo-sondes.test.ts)

`/ceo` affiche les trois blocs dans cet ordre : ce qui demande une main
maintenant · ce qu'on n'a pas regardé · le micro (la carte par nature, puis le
relevé des pannes). L'écran est **réservé au compte maître** et **masqué**
plutôt que grisé chez les autres — c'est l'exploitation de notre déploiement,
rien n'y est à vendre.

| Champ de `EtatSysteme` | Sonde réelle |
|---|---|
| `smtpConfigure` | `GET /api/health` → `capabilities.email.configured` |
| `prixStripeConfigures` | `GET /api/health` → `capabilities.billing.prices` |
| `stockage` | `readStorageHealth()` (`lib/storage-health.ts`) |
| `pipeSynchronisable` | `peutSynchroniser(hydratationPipe)`, **seulement si `pipeServeur`** |
| `brouillonsEnAttente` | les brouillons du store en statut `pending` |
| `fichesSansProchaineAction` | fiches **vivantes** sans `nextStep.date` |
| `palierEnAttente` | `evaluerProgression(...).courant.etat === "pret"` |

> ⚠ **Le branchement vit dans un module pur, pas dans la page**, et ce n'est
> pas du rangement. `/api/health` ne rend le détail qu'au porteur du cookie
> d'accès : sans lui la réponse est `{ ok, checkedAt }`, un 200 valide **sans
> `capabilities`**. Un `Boolean(...)` autour de la lecture rendrait `false` —
> « aucune inscription n'aboutit », en rouge et en permanence, sur une
> installation saine. Écrit dans un composant client, rien ne pourrait tester
> ça. Écrit dans `lib/`, une mutation le fait tomber.

> ⚠ Deuxième piège du même genre : hors mode serveur, `peutSynchroniser`
> répond **vrai** (mode `locale`, historique). Recopié tel quel, l'écran
> allumerait un voyant vert sur un organe absent — pire qu'un voyant éteint.
> D'où le `null` quand `pipeServeur` est inactif.

## Ce qui reste à faire

- l'**historique** : une alerte qui revient toutes les semaines est un défaut
  de conception, pas une tâche — et rien ne le voit aujourd'hui ;
- les pannes du relevé qui n'ont **pas encore de sonde** (`spf-casse`,
  `migration-absente`, `module-mort`, `fiche-demo-envoyee`, `plafond-decret`)
  sont documentées et détectables à la main, pas mesurées. Elles restent donc
  affichées en gris : le relevé ne prétend pas les surveiller.
