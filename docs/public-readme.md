# Alpha Sales OS — extrait public

> Ceci est un **extrait** d'un produit privé : la documentation d'ingénierie,
> sans la partie commerciale. Le code applicatif, la grille tarifaire, le
> ciblage et les données terrain ne sont pas ici et n'y seront pas.
>
> Ce dossier est **généré**, jamais édité à la main : `scripts/export-public.mjs`
> travaille sur une liste d'autorisation et refuse d'écrire si un fichier
> s'est mis à porter un montant, une adresse ou un numéro. La méthode est
> décrite plus bas — c'est elle qui vaut d'être lue.

---

## Ce que c'est

Un OS de vente white-label : il trouve les prospects, les qualifie, appelle,
relance, tient l'historique de chaque conversation et dit à l'humain quoi
faire maintenant. Next.js 15 · React 19 · TypeScript strict · Zustand persist ·
Supabase. Un agent vocal en Python (LiveKit, Deepgram, TTS) vit à côté.

**Ce qu'il ne fait pas**, écrit noir sur blanc parce que c'est la moitié qui
compte : il ne livre pas la prestation vendue, et il ne remplace pas la
personne qui rassure au moment de signer. Il supprime ce qu'il y a avant et
autour.

---

## Les partis pris qui structurent tout le code

### Local-first, et les briques qui touchent la donnée métier sont faites main

Le CRM vit dans le navigateur. Rien de ce qui touche la donnée **métier** —
chiffrement, import CSV, RAG, extraction PDF — ne passe par un tiers.

Ce n'est pas « zéro dépendance » : le `package.json` en déclare une quinzaine
(Next, React, le client Supabase, l'envoi d'emails, les graphiques, un SDK
IA). La formule courte serait fausse et se vérifierait en trente secondes.

### Une règle, une seule définition

Le défaut le plus fréquent de ce dépôt n'est pas un bug : c'est **un mécanisme
juste, testé, branché à un seul endroit ou à aucun**. Le module rend la bonne
réponse, personne ne la lit, rien n'échoue, donc rien n'alerte.

La question posée à chaque règle est donc : *combien d'endroits la posent, et
répondent-ils tous pareil ?* Quand la réponse n'est pas « un seul », un test
interdit le second. Exemples réels dans ce dépôt : « a-t-il refusé toute
relance ? » était posée à trois endroits, dont deux répondaient faux — la
fiche revenait dans la file d'appels et dans le plan du matin.

### Refus par défaut, jamais autorisation par défaut

Une page absente de la carte des accès est **refusée**, pas autorisée. C'est
l'inverse du réflexe, et c'est le seul choix tenable : on ajoute des écrans
sans y penser, et un écran oublié en mode « ouvert par défaut » est une fuite
qui ne se voit jamais.

Même forme ici : cet export part d'une liste d'autorisation, pas d'une liste
d'exclusion.

### Des gardes structurelles, pas des listes de ce qu'il faut cacher

Une liste de ce qu'il faut cacher est une copie de ce qu'on cache. Les gardes
cherchent donc des **formes** : la forme d'un numéro de téléphone, la forme
d'un montant, la forme d'une adresse. Un test refuse tout numéro qui ne soit
pas dans une plage réservée à la fiction par le régulateur.

### Zéro donnée mesurée → zéro chiffre affiché

Un `0 %` se lit comme un résultat. L'absence de mesure se **dit** :
`source: "aucune"`, `valeur: null`. Et jamais un taux nu — dénominateur,
intervalle de confiance, et la réserve qui va avec.

Corollaire assumé : **aucun poids ne s'auto-corrige**. Sur quarante appels, un
ajustement automatique apprend le bruit et le grave dans le tri. Le module
rend un verdict et nomme le fichier ; la constante se change à la main, et ça
se voit dans un diff.

### Ce qu'on refuse d'automatiser, et pourquoi

Voir [`docs/ALPHA-CEO.md`](docs/ALPHA-CEO.md). Trois natures de points
humains, et deux d'entre elles ne sont pas un retard à rattraper :

| Nature | Ce que ça veut dire |
|---|---|
| `automatisable` | un humain le fait par habitude ; rien ne se perd à l'automatiser |
| `humain-par-decision` | l'automatiser **fabriquerait de la preuve** |
| `humain-par-contrainte` | la loi ou un tiers l'exige ; ce n'est même pas notre choix |

Chaque point porte la **raison** d'être humain. Sans elle, la session suivante
l'optimise en croyant finir le travail.

---

## Les tests

`node:test`, sans framework. Un millier et demi de cas, et leur objet n'est
pas la couverture : c'est de tenir les décisions qui ont déjà été payées une
fois.

**La règle de méthode qui compte** : on n'asserte jamais la *présence* d'un
refus, on asserte la *condition* qui y mène. Un `if (false)` laisse le refus
en place et le test passe quand même. Chaque garde est donc vérifiée par
**mutation** — on casse la condition, et on vérifie qu'exactement le bon test
tombe. Les commentaires de test disent quelle mutation a été essayée.

Beaucoup de tests portent sur la **documentation** : qu'un module doctrinaire
soit cité quelque part, qu'une doc ne décrive pas une API qui n'existe plus.
Une doc fausse coûte plus cher qu'une doc absente.

---

## Ce qu'il y a dans ce dossier

| Fichier | Ce qu'on y trouve |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | la structure : ce qui vit côté serveur, côté navigateur, et pourquoi |
| [`docs/INSTALLATION.md`](docs/INSTALLATION.md) | l'installation complète, de zéro à une instance qui tourne — les fichiers qu'elle cite (workflows, schéma SQL, script CRM) vivent dans le dépôt privé, les références y apparaissent donc en simple `code` |
| [`docs/DEMARRAGE.md`](docs/DEMARRAGE.md) | la prise en main et le contrôle DNS de délivrabilité |
| [`docs/BOUCLE.md`](docs/BOUCLE.md) | la boucle terrain : la sortie revient corriger l'entrée |
| [`docs/ALPHA-CEO.md`](docs/ALPHA-CEO.md) | le diagnostic système, et le refus d'être un maximiseur |
| [`SECURITY.md`](SECURITY.md) | comment signaler une faille, et les classes de menace traitées |

> ⚠ **Ce qui n'est pas là, et pourquoi.** La version interne de l'architecture
> et du document de sécurité se termine par l'état d'exploitation d'un
> déploiement réel : versions, avis de sécurité en cours, ce qui reste à
> vérifier. Chaque ligne est honnête et utile en interne. Publiée à côté d'une
> application en ligne, elle forme un plan d'attaque daté. L'état d'un
> déploiement se traite avec la personne qui l'opère, pas sur une page
> publique.

---

## État du projet

Produit privé en développement actif, opéré par son auteur. Ce dépôt public
n'accepte pas de contributions et ne suit pas de calendrier de publication :
c'est une fenêtre sur la méthode, pas un logiciel à installer chez soi.

Alpha Sales OS® · EAGLEYE CORP — Lyon.
