# Sourcer — ce qui est branchable, et ce qui ne l'est pas

> Deux canaux, deux sourcings : **LinkedIn** (des personnes, pour les inviter)
> et **le terrain** (des entreprises, pour les appeler). Ce document couvre les
> deux, parce que la règle qui les gouverne est la même : *la collecte reste
> dehors, l'app reçoit du texte et trie.*

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


---

# Sourcer du terrain — les 1 000 numéros

## Ce qu'Agent Reach ne fait PAS

**Agent Reach n'a pas de canal Google Maps.** Dix-neuf canaux (web, YouTube,
RSS, GitHub, X, Reddit, Facebook, Instagram, Xiaohongshu, LinkedIn, V2EX,
Bilibili, Xueqiu, Xiaoyuzhou, recherche Exa…), aucun pour Maps. La seule
mention de Maps dans le dépôt est dans un **encart sponsor** pour BrowserAct —
un produit tiers payant, pas une capacité de l'outil.

Ce qu'il a et qui pourrait servir de loin :

| Canal | Ce que ça donne ici |
|---|---|
| `web.py` (Jina Reader) | lit une page publique — mais Maps est rendu en JS, ses avis sont derrière une interaction, et `web.py` embarque une détection d'anti-bot parce que ces pages bloquent |
| `exa_search.py` | recherche sémantique — utile pour trouver des entreprises, pas pour en extraire téléphone + avis structurés |

**Verdict : Agent Reach ne résout pas ce problème.** Il reste bon pour ce qu'on
lui a gardé (lecture de pages publiques LinkedIn), pas pour construire une
liste d'appels.

## Aspirer Google Maps : non, et pour la même raison que LinkedIn

Le scraping des pages Maps viole les conditions d'utilisation de Google. C'est
exactement la catégorie du backend LinkedIn à session qu'on a refusé — refuser
l'un et faire l'autre serait une doctrine à géométrie variable.

## L'API Places — la voie propre

Elle rend précisément ce dont le tri a besoin, **texte des avis compris** :

```
places.displayName,places.primaryTypeDisplayName,places.shortFormattedAddress,
places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,
places.regularOpeningHours.weekdayDescriptions,places.reviews
```

`reviews` est le champ non négociable : c'est lui qui porte la plainte
d'injoignabilité, le signal qui pèse plus que tous les autres.

**Appels → Alimenter la file → colle la réponse JSON telle quelle.** Le format
est reconnu tout seul (une réponse Places commence par une accolade et porte
`places` / `displayName`) ; aucune case à cocher, aucune clé Google ne transite
par l'app.

⚠ Trois réserves, à vérifier avant de lancer 1 000 requêtes :
- l'API est **payante**, et facturée au champ demandé — réclamer tout coûte
  plus cher pour rien ;
- elle plafonne à **5 avis par établissement** ;
- le tarif et les quotas gratuits changent régulièrement. **Je n'ai pas pu les
  vérifier** : le proxy de développement n'atteint pas Google.

## Ce que le tri cherche, et qui n'est pas un métier

Un **volume de demandes qui se perd**. Le déclencheur de la marche 2 de
l'ESCALIER, pas un secteur — un garage sans clients ne l'a pas plus qu'un
cabinet d'avocat.

| Signal | Poids |
|---|---|
| Un avis dit « impossible de les joindre » | **le plus fort** — le prospect a écrit l'ouverture à ta place |
| Volume d'avis élevé | fort — proxy de la demande, **pas une mesure des appels** |
| Fermé le midi ou le week-end | moyen — les appels de ces heures sont perdus par construction |
| Verticale du playbook reconnue | moyen |
| Excellente note | moyen — elle ne parle que des clients qui les ont EUS au téléphone |

Trois exclusions sèches que le score ne rattrape pas : **pas de numéro
composable** (c'est une liste d'appels), **enseigne nationale ou franchise**
(téléphone mutualisé, décision ailleurs), **déjà équipé d'un standard**
(l'offre n'a plus d'objet).

## Le plafond de sollicitations

`planifierAppels` alerte au-delà de **4 tentatives**. Le décret n° 2022-1313
plafonne le démarchage à 4 sollicitations par consommateur sur 30 jours
glissants. Il vise le B2C — mais un artisan en nom propre sur sa ligne
personnelle est exactement la zone grise, et c'est nous qui portons le risque
sur une liste mêlée.

⚠ **À arbitrer — par toi seul désormais** : la cadence est de **cinq
rappels sur deux jours**, soit six contacts. Sur une cible qui bascule en B2C,
elle est hors des clous.
