# L'APPROCHE PULL — on ne demande rien, on rend visible

> Ce document remplace `CAMPAGNE-ALPHA-TEST-1.md`, supprimé le 02/09/2026.
>
> Ce fichier-là s'appelait « SCINTIA × EAGLEYE CORP » et s'ouvrait sur un
> partage de rôles à trois — la voix, la méthode, la solution — dont la
> troisième ligne appartenait au revendeur avec qui l'accord est mort.
> **Ce qui est parti avec lui : ce partage de rôles, rien d'autre.** La
> mécanique, les seuils, les garde-fous et le post de lancement n'ont jamais
> dépendu de lui — ils décrivent comment on ouvre une conversation sans
> mendier, et ça reste vrai que la solution soit la nôtre ou celle d'un autre.
>
> Le nom aussi est parti : « test 1 » datait d'une semaine précise et d'un
> déroulé horaire de la veille pour le lendemain. Ce qui est reproductible
> n'est pas la journée, c'est la méthode.

---

## 1. Qui dit quoi — ce qui a changé le 02/09

Avant, trois rôles et trois porteurs : nous écrivions, nous auditions, et
**quelqu'un d'autre** installait la solution. D'où la règle « on ne vend
jamais leur produit en ouverture » : c'était en partie une contrainte
d'intermédiaire.

Aujourd'hui la voix, la méthode ET la solution sont à nous (Alpha Voice est
notre produit). Le partage de rôles disparaît. **La règle, elle, reste — pour
une meilleure raison :**

| | |
|---|---|
| **On ouvre sur** | une observation de métier. Ce qu'on voit, pas ce qu'on vend. |
| **On enchaîne sur** | une question de diagnostic — c'est LUI qui doit nommer la fuite. |
| **On offre** | l'audit, seulement s'il le demande. |
| **On ne montre le produit** | qu'une fois la perte reconnue et chiffrée **par lui**. |

Ce n'est plus « on ne vend pas le produit d'un tiers en ouverture ». C'est la
doctrine générale du dépôt : **le prix arrive après la démonstration, jamais
avant** (`docs/OFFRE-ALPHA-VOICE.md`). Un produit annoncé avant que le
problème soit reconnu transforme la conversation en négociation.

## 2. La mécanique — la lettre d'abord, l'audit à la demande

C'est le cœur du dispositif, et ce qui le distingue du spam :

```
Publication régulière (LinkedIn + newsletter)
   « voilà ce que j'observe sur les accueils téléphoniques à Lyon »
                    │
                    ▼
        Quelqu'un manifeste un intérêt
                    │
                    ▼
   Audit PERSONNALISÉ envoyé — offert, à lui quoi qu'il arrive
                    │
                    ▼
        RDV 15 min pour recaler sur ses vrais chiffres
                    │
                    ▼
     Démonstration en direct, puis le prix — dans cet ordre
```

L'audit n'est **jamais** envoyé d'office — et il n'est même pas proposé. On dit
qu'il existe, une fois, sans insister. C'est le prospect qui vient le chercher :
c'est ce qui en fait un cadeau, et non une pièce jointe déguisée en lead magnet.

> **Posture assumée : on ne demande rien.** Pas de « répondez AUDIT », pas de
> « dites-moi oui ». Le seul chemin visible est le lien de réservation — une
> porte ouverte n'est pas une demande. Coût honnête : le taux de réponse
> immédiat baisse. Contrepartie : ceux qui viennent sont déjà convaincus, et le
> closing est beaucoup plus court. Condition pour que ça marche : **publier
> régulièrement, longtemps.**

**Où ça se pilote dans l'app :**

| Étape de la mécanique | Page |
|---|---|
| La lettre régulière (le « tout le temps ») | **Newsletter** (`/newsletter`) |
| Les invitations et messages LinkedIn | **LinkedIn** (`/linkedin`) |
| Les appels préparés | **Appels** (`/appels`) |
| L'audit personnalisé, après un « oui » | fiche → onglet Audit → cadeau |
| Les chiffres | **Preuves** (`/preuves`) et **KPIs** (`/kpis`) |

## 3. Le périmètre d'une série

- **Territoire :** un seul. Lyon 6e (Brotteaux, Foch, Part-Dieu ouest) pour
  la première.
- **Volume :** 25 fiches maximum. On ne teste pas une mécanique sur 200
  prospects — on la teste sur assez peu pour tout lire.
- **Verticales :** une seule à la fois dans une même session (la voix se cale
  sur un registre). Commencer par celle où l'on a déjà un client référent.

> ⚠ Ce périmètre est le même raisonnement que les **paliers 10 · 100 · 1 000**
> (`lib/paliers-campagne.ts`), appliqué à l'écrit : on mesure petit avant de
> monter, et aucun palier ne se valide tout seul.

## 4. Le post de lancement

> Depuis quelques semaines, j'appelle des commerces et des cabinets du 6e à des
> heures normales. Pas pour vendre : pour écouter ce qui se passe quand le
> téléphone sonne.
>
> Ce que j'observe revient toujours au même endroit.
>
> Ce n'est pas que les gens répondent mal. C'est que **personne n'est
> disponible au moment exact où le client appelle** — pendant le service, sur
> le chantier, en rendez-vous, entre midi et deux.
>
> Et le client qui n'a personne au bout du fil ne rappelle pas. Il appelle le
> suivant. L'entreprise ne saura jamais qu'il a existé : aucune trace, aucun
> avis, aucune statistique. C'est une perte parfaitement invisible — c'est ce
> qui la rend dangereuse.
>
> Je publie ici ce que je constate, métier par métier.
>
> Il m'arrive de préparer, pour une entreprise en particulier, un audit de son
> accueil téléphonique : ce qu'elle capte, ce qui lui échappe, et ce que ça
> représente sur un mois.
>
> Je ne le propose à personne. Je dis juste que ça existe.
>
> Zakaria — EAGLEYE CORP, Lyon 🦅

**À poster** mardi–jeudi entre 8h et 10h. Pas de lien dans le post (la portée
chute) : le lien va en premier commentaire s'il y en a un. Trois hashtags
maximum : #Lyon #Commerce #AccueilTéléphonique.

## 5. La séquence LinkedIn — dans l'app

Page **LinkedIn** (`/linkedin`). Périmètre « Lyon 6 ». Séquence automatique
par fiche :

| Étape | Quand | Contenu |
|---|---|---|
| 1 · Invitation | J0 | ≤ 300 caractères, un critère, zéro pitch, zéro chiffre. |
| 2 · Message | J+2 | Le critère, UNE question de diagnostic, l'audit proposé. |
| 3 · Relance | J+4 | On assume le silence, on ferme sur un choix binaire. |

L'app prépare le texte, ouvre le bon profil et consigne la touche. **Toi tu
colles, tu relis, tu envoies** — c'est réellement toi qui écris, donc aucun
risque de restriction de compte.

> ⚠ Le quota n'est plus un seul nombre. LinkedIn compte à la **semaine** autant
> qu'à la journée : 25/jour tenus cinq jours font 125, au-dessus du plafond.
> `quotaDuJour` (`lib/linkedin-plan.ts`) croise les trois limites — jour,
> semaine, montée en charge — et l'écran nomme celle qui mord. Ne pas recopier
> un chiffre ici : il périmerait, et c'est le code qui arbitre.

## 6. La journée type

| Créneau | Action | Où |
|---|---|---|
| 8h30 | Publier le post | LinkedIn |
| 9h00 | Vérifier les fiches du périmètre (nom, contact, verticale) | `/pipeline` |
| 9h15 | Les invitations LinkedIn du jour | `/linkedin` |
| 9h45 | La lettre au segment | `/newsletter` |
| 10h00 | Session d'appels sur les fiches les plus chaudes | `/appels` |
| 12h00 | Répondre à TOUS les commentaires et messages | LinkedIn |
| 14h00 | Répondre à ceux qui sont venus d'eux-mêmes | fiche → Audit → cadeau |
| 17h00 | Relire les touches consignées du jour | `/preuves` |

> ⚠ Les appels sont calés sur les **fenêtres d'appel ouvertes**, pas sur ce
> tableau. 12h–14h est le plancher du décroché : `prochaineFenetreOuverte`
> (`lib/call-cadence.ts`) le sait, ce planning non. En cas de désaccord, c'est
> le code qui a raison.

**Réflexe non négociable :** toute demande d'audit reçue le matin part **le
jour même**. La vitesse de réponse est exactement ce qu'on vend — si on est
lent, le message est mort avant d'être lu.

## 7. Ce qu'on mesure (et rien d'autre)

Une série ne se juge pas au chiffre d'affaires. Elle se juge à ceci :

- **Taux d'acceptation des invitations** — si < 30 %, le message d'invitation
  est trop commercial : le retravailler.
- **Taux de réponse au message J+2** — si < 15 %, la question de diagnostic
  n'est pas la bonne pour ce métier.
- **Nombre de personnes venues d'elles-mêmes** (réponse spontanée ou créneau
  réservé) — c'est LE chiffre. Attention : en posture « pull », il démarre bas
  et monte avec la répétition. Ne juge pas sur une semaine.
- **Nombre de RDV posés** — la conversion réelle.
- **Temps de réponse moyen** aux demandes — doit rester sous 2 heures.

Tout se lit dans `/preuves` (touches consignées) et `/kpis` (taux de passage).
On ne change **qu'une variable à la fois** entre deux séries.

> ⚠ Ces cinq seuils sont des **hypothèses, pas des mesures** — au même titre
> que les 30 % de décroché et les 20 % d'intérêt qualifié des paliers de
> campagne. Zéro vente à ce jour : aucun n'a été validé par le terrain. Le
> premier chiffre réel les remplace.

## 8. Garde-fous

- L'audit ne part **jamais** sans un oui explicite.
- Aucun chiffre € dans les messages à froid — ni sur LinkedIn, ni au téléphone.
  Les montants n'existent que dans l'audit, et toujours étiquetés comme des
  estimations à valider.
- Jamais la note Google d'un prospect dans un message : à l'écrit comme à
  l'oral, ça se prend comme une attaque.
- Relire le **prénom** avant chaque envoi. Un prénom faux détruit tout le
  travail d'audit qui suit.
- Le profil LinkedIn est un actif : on ne le grille pas pour trois touches de
  plus. Le quota affiché par l'écran fait foi.
- Toute personne qui demande l'arrêt est retirée immédiatement, sans relance
  de politesse.
