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

### Une règle écrite en prose n'est pas une règle

Les playbooks d'appel portent des interdits : *ce qu'on ne dit pas à froid à ce
métier-là*. Ils étaient un tableau de chaînes de caractères — lisibles par un
humain, invisibles pour le code.

Résultat mesuré : un catalogue voisin faisait prononcer, mot pour mot,
l'argument qu'un playbook interdisait en toutes lettres. Les deux textes
arrivaient dans le **même** message assemblé, à trois lignes d'écart. Rien n'a
bronché — un interdit écrit en français n'avait, structurellement, aucun moyen
de rencontrer le texte qu'il régit.

Chaque interdit porte désormais, dans la **même entrée**, la règle lisible *et*
son motif exécutable. Pas deux listes côte à côte : deux listes divergent, et
c'est toujours celle qu'on ne relit pas qui cesse de mordre. Le motif est
absent quand l'interdit relève du jugement plutôt que de la formulation —
en fabriquer un approximatif produirait des faux positifs jusqu'à ce que le
garde entier soit désarmé.

> ⚠ Ce garde a dû être corrigé **deux fois par mutation, pas par relecture**.
> Sa première version ne citait qu'une formulation littérale ; la violation
> réelle était une reformulation de bonne foi, qui ne contenait aucun des mots
> attendus. La leçon tient en une ligne : **un garde par motif n'attrape que ce
> qu'on a déjà vu**, et il faut le rouvrir chaque fois qu'on rencontre une
> tournure neuve.

### Une doc qui diverge du code ne casse rien — elle ment

C'est le pendant documentaire du défaut précédent, et il est plus coûteux :
personne ne relit un README avant de cocher une case dans un tableau de bord.

Cas réel. Un programme d'aide publique portait un critère d'entrée
**éliminatoire** que nous ne remplissions pas. Le constat était écrit, daté et
exact — dans un fichier Markdown. Le code, lui, ne connaissait pas ce critère :
il annonçait une adéquation « plausible », l'écran l'affichait dans une couleur
qui encourage, et un module découpait consciencieusement des lots de travail
pour un dossier qui aurait été rejeté à la première page.

Deux corrections, et la seconde est la vraie :

1. le critère est descendu dans le code ;
2. **l'admissibilité a été séparée de l'adéquation**. « Ce programme nous
   va-t-il ? » et « avons-nous le droit d'entrer ? » sont deux questions
   distinctes qui se lisaient comme une seule — et c'est la rassurante qui
   gagnait. Un blocage grise désormais l'adéquation à l'écran : rangé dans une
   phrase sous la carte, il se lit *après* la couleur.

Le test garde les deux moitiés : le critère doit être nommé avec sa valeur — un
« non éligible » sans le seuil envoie chercher la porte suivante, qui
appliquera le même — et les dossiers ouverts ne doivent porter aucun blocage,
sinon on en remplit partout par prudence et l'écran devient un mur rouge que
personne ne lit.

### Ne jamais fabriquer une preuve, y compris par emprunt

Les gardes refusaient déjà les témoignages inventés, les superlatifs
invérifiables et les pourcentages de résultat promis. Il manquait une troisième
famille, trouvée en ligne et non par un test : **l'affiliation
institutionnelle**. Une page publique s'adossait à un programme qui ne nous
avait rien accordé.

C'est la pire des trois. Un témoignage inventé se démonte en conversation ; une
affiliation se vérifie auprès de l'organisme, sans nous prévenir.

> Le garde a immédiatement mordu sur une phrase parfaitement honnête — un motif
> sans limite de mot attrapait un verbe courant. Corrigé le jour même : **un
> garde qui refuse une phrase juste est un garde qu'on assouplira au mauvais
> endroit la fois suivante.**

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

`node:test`, sans framework. Plus de mille six cents cas, et leur objet n'est
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
