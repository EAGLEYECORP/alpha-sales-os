# Sourcer des profils LinkedIn — ce qui est branchable, et ce qui ne l'est pas

> Où trouver les profils, comment les faire entrer, et pourquoi une partie de
> l'outillage disponible est écartée alors qu'elle marche.

---

## La règle, en une ligne

**Alpha ne se connecte jamais à LinkedIn avec ton compte.** La collecte se fait
dehors, l'app reçoit du texte. C'est ce qui fait que ton profil ne se fait pas
restreindre — et un test refuse tout module qui piloterait un navigateur ou
détiendrait un identifiant LinkedIn.

Ce n'est pas de la prudence décorative. Tu as **un** profil LinkedIn, un
premier client au bout, et une restriction se lève en semaines quand elle se
lève.

---

## Agent Reach — ce qu'on en prend, ce qu'on en laisse

[Agent Reach](https://github.com/Panniantong/agent-reach) est une trousse
Python qui donne à un agent la capacité de lire le web (pages, YouTube, RSS,
GitHub, Reddit, X, LinkedIn…). Elle s'installe **sur ta machine**, à côté de
l'agent — **rien n'entre dans `package.json`**, donc la règle « zéro
dépendance runtime » du produit n'est pas touchée.

Elle propose **deux chemins** pour LinkedIn, et ils ne se valent pas.

### ✅ Jina Reader — lecture de pages publiques

Lit une page LinkedIn publique et la rend en texte propre. **Aucun compte,
aucun cookie, aucune session.** C'est ce que fait n'importe quel navigateur
sur une page publique, et ça ne met aucun compte en jeu — surtout pas le tien.

C'est exactement ce dont le ciblage a besoin : intitulé de poste, entreprise,
ville, effectif. Rien de plus n'est utilisé par `lib/linkedin-ciblage.ts`.

### ❌ `mcp-server-linkedin` — automatisation navigateur

Le second chemin d'Agent Reach passe par
[`mcp-server-linkedin`](https://github.com/stickerdaniel/linkedin-mcp-server),
qui demande :

```
uvx mcp-server-linkedin@latest --login
```

Ce `--login`, c'est **ta session LinkedIn**. À partir de là, chaque requête est
faite *en ton nom* par un navigateur automatisé. C'est le mécanisme précis qui
fait restreindre les comptes, et il donne accès à `search_people`,
`get_person_profile`, `search_jobs` — c'est-à-dire exactement le confort qui
rend la tentation forte.

**On ne le branche pas.** Le gain (des champs mieux structurés) ne paie pas le
risque (l'actif commercial). Si tu veux le faire quand même un jour, fais-le
sur un compte qui n'est pas celui avec lequel tu vends.

> Note d'honnêteté : je n'ai testé aucun de ces deux chemins depuis ici. Le
> proxy de développement n'atteint ni LinkedIn ni Jina. Ce qui est vérifié,
> c'est le contenu du dépôt Agent Reach — pas son comportement en ligne.

---

## Les autres sources, sans outil

Elles marchent, et deux d'entre elles sont **au-dessus** du scraping en
qualité :

| Source | Ce que ça donne | Coût |
|---|---|---|
| **Sales Navigator** | export/copie de listes filtrées, InMail | payant, et c'est le chemin que LinkedIn vend lui-même |
| **Recherche LinkedIn + copier-coller** | lent mais irréprochable | gratuit |
| **Annuaires métier, CCI, Pages Jaunes, Google Maps** | l'entreprise, pas la personne | gratuit |
| **Événements & salons** | des gens qui attendent d'être approchés | déplacement |

⚠ Sur la cible réelle du playbook, les annuaires battent LinkedIn — voir plus
bas.

---

## Faire entrer les profils

**LinkedIn → « Sourcer des profils »**. Colle du CSV, du TSV, du JSON ou du
JSONL. L'en-tête attendu :

```
nom;titre;entreprise;ville;url;secteur;taille
Claire Berthier;Gérante;Régie Berthier;Lyon 6e;linkedin.com/in/claire;immobilier;11-50
```

Les noms de colonnes tolèrent les alias courants (`name`, `title`, `headline`,
`company`, `location`, `profileUrl`, `industry`, `companySize`…). Une colonne
non reconnue est **signalée**, pas devinée en silence.

Ce que l'écran rend avant que tu cliques :

- **les retenus**, avec leur score et les faits qui l'expliquent ;
- **les écartés, AVEC leur raison** — c'est là qu'on découvre qu'une colonne
  était mal nommée dans l'export ;
- **le calendrier** : combien de jours ouvrés et de semaines pour ce volume ;
- **les lignes illisibles**, numérotées.

Réimporter le même lot ne crée pas de doublon : l'identifiant est stable sur
l'URL du profil. Sur ce canal, un doublon n'est pas une ligne en trop dans un
tableau — c'est une **deuxième invitation** à la même personne.

---

## Ce que le tri refuse, et pourquoi

Les invitations sont un budget **plafonné à la semaine**. Celle dépensée sur
un apprenti est celle qui n'ira pas au gérant du garage d'à côté.

Trois exclusions sèches, que le score ne rattrape pas :

1. **Effectif au-dessus de 250** — il y a un standard, un service
   informatique et un processus d'achat. La douleur qu'on vend n'existe pas,
   et le décideur n'est pas joignable en un message.
2. **Même métier que nous** (agence, growth, consultant IA, éditeur) — on ne
   dépense pas une invitation à vendre à un vendeur.
3. **Ni nom ni URL** — il n'y a personne au bout.

Ensuite un score, où **le rôle pèse plus que le décor** : « responsable » et
« chargé de » ne comptent pas comme décideurs. Les inclure ferait passer
presque tout le monde, c'est-à-dire ne filtrerait plus rien.

---

## ⚠ L'aveu à lire avant de dépenser 200 invitations

**Les métiers du playbook ne sont pas sur LinkedIn.** Couvreurs, garagistes,
restaurateurs, ambulanciers, auto-écoles : la plupart n'ont pas de profil
actif, et ceux qui en ont un ne l'ouvrent pas.

C'est exactement la douleur qu'on leur vend — *« vous êtes sur le terrain, pas
devant un écran »* — et elle vaut aussi pour ce canal.

Conséquence concrète : sur LinkedIn, ce qui remonte n'est pas la cible du
playbook, c'est surtout des agences, des consultants et des éditeurs. Nos
concurrents.

Ce n'est pas une raison de ne pas le faire. C'est une raison de savoir **qui**
on cherche avant de commencer. Sur LinkedIn, la cible plausible est le
**dirigeant de PME de services** — immobilier, santé, formation, centres
d'appels. Pour l'artisan, le téléphone et le terrain portent mieux, et
`PRESENCE_LINKEDIN` le dit verticale par verticale, sur chaque lot importé.

---

## Les plafonds, une fois les fiches entrées

| | Valeur | Pourquoi |
|---|---|---|
| Invitations / semaine | **100** | c'est l'unité que LinkedIn compte — pas la journée |
| Montée en charge | 40 → 60 → 80 → 100 | le changement de rythme se voit plus que le volume |
| Retrait des invitations en attente | après **21 jours** | le taux d'acceptation est le chiffre qui protège le compte |
| File d'attente maximale | 200 | au-delà, il faut ralentir, pas nettoyer |

⚠ Ces chiffres viennent de ce que LinkedIn publie et de ce que les praticiens
observent — **pas d'une mesure faite ici**. Aucune campagne n'a encore tourné
sur ce compte. Ce sont des plafonds prudents, à corriger dès qu'une semaine
réelle sera derrière nous.

Et l'entonnoir **refuse d'afficher un taux** tant qu'aucune campagne n'a
tourné. « 30 % d'acceptation » traîne partout et a l'air sérieux ; ce chiffre
ne vient d'aucune campagne de cette maison, sur aucune de ces verticales, avec
ce message. La question qui se tranche vraiment est l'inverse : combien de
rendez-vous justifient 200 invitations relues à la main.
