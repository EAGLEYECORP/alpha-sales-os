# Ce que vaut ALPHA aujourd'hui, ce qu'il pourrait valoir, et le chemin (18/11/2026)

> Demande de Zakaria : « une vraie évaluation de la valeur actuelle, de la valeur
> latente, et comment y arriver ». Chaque chiffre porte sa source : **[M]** mesuré dans le
> dépôt ou en base · **[S]** source publique (souvent un blog d'intermédiaire, donc
> fragile) · **[H]** hypothèse de calcul. Aucun investisseur ni acheteur n'a validé
> aucun de ces montants.

## 1. Le verdict

- **Si tu vendais ALPHA aujourd'hui : presque rien.** Sous 1 M$ de revenu
  récurrent, un logiciel se vend sur ce qu'il rapporte à son propriétaire. ALPHA ne
  rapporte rien : zéro client, zéro euro. On parle d'une reprise de technologie à
  quelques dizaines de milliers d'euros, au mieux. [S]+[H]
- **Si un investisseur pariait aujourd'hui : 0,8 à 2 M€ avant son argent.** C'est
  sous la fourchette française habituelle du pre-seed (2 à 5 M€), parce que tu es
  seul et sans client. [S]+[H]
- **La valeur latente est réelle, et elle tient à une seule chose : des clients
  qui paient.** 55 entreprises BTP, c'est environ 0,6 M€ de revenu annuel et 3 à
  6 M€ de valorisation ; 275, c'est 3 M€ de revenu et 15 à 30 M€. [H]
- **L'écart entre les deux ne se comble pas avec du code.** Il y en a déjà
  beaucoup, et c'est l'actif le moins rare de tous.

## 2. Ce qui existe — mesuré

| | Mesure |
|---|---|
| Code de production (lib, composants, pages, voix, SQL) | **~120 000 lignes** [M] |
| Tests | **~54 000 lignes, 266 fichiers, 2 873 tests verts** [M] |
| Écrans · routes API | 52 · 79 [M] |
| En production | app sur Vercel, base Supabase, pilote automatique dans le cloud, ligne vocale entrante [M] |
| Activité réelle | **5 premiers emails partis, 3 ouverts** (05–06/11) [M] |
| Clients · revenu | **0 · 0 €** [M] |

### Ce que ça vaudrait de le refaire
- À la main, au rythme d'un développeur expérimenté qui teste (20 000 à 30 000
  lignes par an), ça ferait 6 à 9 années de travail, soit **0,65 à 1 M€** à
  110 k€ l'année chargée. [H]
- **Mais ce chiffre est trompeur, et un acheteur le sait** : ce dépôt a lui-même
  été écrit avec l'IA. Un concurrent équipé pareil le refait 3 à 5 fois plus vite :
  **150 à 300 k€**. Le coût de reconstruction d'un logiciel s'effondre avec l'IA ;
  ce qui ne s'effondre pas, ce sont les clients, les données et le savoir du
  terrain. [H]

### Ce qui a de la valeur, au-delà du nombre de lignes
1. **La conformité écrite dans le code** : la règle européenne sur l'IA (art. 50),
   la limite de sollicitations (décret n° 2022-1313), les mentions, les oppositions,
   et un dossier qui se vérifie à chaque `npm test`. C'est l'actif le plus difficile
   à copier, et il vaut pour toute l'Europe.
2. **Un produit qui tourne vraiment**, jusqu'à l'envoi et la lecture des réponses.
3. **Une méthode** (« on mesure, on n'invente pas ») qui rassure un investisseur
   sérieux, à condition qu'il y ait quelque chose à mesurer.

### Ce qui fait baisser la valeur
- **Fondateur seul.** C'est le premier motif de refus au pre-seed.
- **Trop large** : huit agents, cinq métiers, deux formules. On ne sait pas dire en
  une phrase ce qu'on vend ni à qui.
- **Aucune donnée de résultat** : pas un devis relancé chez un vrai client, pas une
  signature récupérée.
- **Des murs techniques** : 5 emails par jour cette semaine, une boîte partagée
  avec les inscriptions, Dropcontact à 0 email sur 43 recherches.

## 3. La valeur latente — le calcul

**Ce que rapporte un client** (grille `lib/offres-publiques.ts`, des DÉCISIONS,
aucune vente ne les a validées) : 10 000 € d'installation, puis 600 € + 80 € par
utilisateur et par mois.
- 4 utilisateurs : 920 €/mois, soit **11 040 € par an**, plus l'installation.
- 10 utilisateurs : 1 400 €/mois, soit **16 800 € par an**.

**Le marché** : ~22 000 entreprises du bâtiment de plus de 10 salariés [S, CAPEB].
Celles qui vivent de commerciaux sur le terrain en sont une partie ; disons
**~5 500** [H]. Au-delà du BTP, le même besoin existe dans l'immobilier,
l'assurance, l'énergie, les cuisinistes et partout où il y a des commerciaux de
terrain.

**Les multiples** : une société SaaS privée se valorise autour de **5 fois** son
revenu annuel récurrent, et **7 à 10 fois** si elle croît de plus de 40 % par an [S,
SaaS Capital, via des relais]. Sous 1 M$ de revenu, on parle plutôt de 2 à 4 fois [S].

| Clients | Revenu annuel récurrent [H] | Valorisation plausible [H] | Ce que ça demande |
|---|---|---|---|
| **1** | 11 k€ | 0,8 – 1,5 M€ (preuve que ça se vend) | un premier « oui » |
| **10** | 110 k€ (+100 k€ d'installations) | 1,5 – 3 M€ : pre-seed | 6 mois, un cofondateur |
| **55** (1 % du marché BTP visé) | 0,6 M€ | 3 – 6 M€ : seed | une méthode de vente qui se répète |
| **275** (5 %) | 3 M€ | 15 – 30 M€ : série A | une équipe commerciale |
| **1 000** (plusieurs métiers, Europe) | 11 M€ | 55 – 110 M€ | la conformité vendue à toute l'Europe |

⚠ Le « 30 M$ de seed » des posts LinkedIn est d'une autre nature : des équipes au
parcours déjà reconnu, l'IA de pointe et souvent une traction mesurée. Ce n'est pas
le chemin des 18 prochains mois. Le chemin, c'est le tableau ci-dessus, une ligne
après l'autre.

## 4. Comment y arriver

### Étape 1 : le premier client payant (30 jours)
- **La source** : la liste des 100 (`donnees-privees/`), LinkedIn et téléphone. Le
  pilote email est trop lent pour ça (5 envois par jour).
- **Le calcul, avec des taux non mesurés** : 200 appels → ~20 dirigeants joints →
  ~5 rendez-vous → ~2 démonstrations → **1 client**. Avec 100 invitations LinkedIn
  en plus. Ce sont des hypothèses ; les deux premières semaines donneront les
  vrais taux.
- **L'offre** : celle qui existe, le cadrage d'abord. ⚠ Une offre « client
  fondateur » (installation réduite en échange du droit de mesurer et de citer le
  résultat) peut accélérer le premier oui. **C'est une décision de prix, à prendre
  par Zakaria**, pas une ligne de code.

### Étape 2 : 10 clients et la première mesure réelle (6 mois)
- Mesurer chez chacun : devis relancés, réponses, rendez-vous, **signatures
  récupérées**. C'est la seule preuve qui déplace une valorisation.
- **Trouver un cofondateur** : un vendeur si tu construis, ou l'inverse.
- **Arrêter d'élargir** : plus de nouvelle fonction qu'un client n'a pas demandée.

### Étape 3 : la première levée (pre-seed, 0,5 à 1,5 M€)
- Sur 10 clients, leurs chiffres, et une phrase : « on relance ce que vos
  commerciaux n'ont pas le temps de relancer ».

### Étape 4 : 50 clients, un deuxième métier, la conformité comme produit (seed)
- Vendre la couche de conformité à d'autres outils de vente européens : une
  deuxième source de revenus, et l'actif le plus défendable.

## 5. Ce qu'il faut arrêter dès maintenant
- Mesurer l'avancement en fonctions livrées : **l'indicateur, c'est le nombre de
  rendez-vous par semaine**.
- Dire « prêt pour 10 millions d'utilisateurs » : ce qui manque n'est pas la
  capacité, c'est le premier utilisateur qui paie.

## Sources
- Pre-seed en France (fourchette indicative, à confirmer) : https://hayot-expertise.fr/en/blog/pre-seed-to-series-a-fundraising-france-2026
- Pre-seed en Europe : https://www.equidam.com/startup-valuation-delta-q1-2026/
- Multiples SaaS privés : https://www.saas-capital.com/blog-posts/private-saas-company-valuations-multiples/
- Sous 1 M$ de revenu (valorisation sur ce que gagne le propriétaire) : https://www.feinternational.com/blog/saas-valuation-multiples
- Entreprises du bâtiment de plus de 10 salariés : https://www.capeb.fr/www/capeb/media/document/capeb-ds-sup10salaries-bat.pdf
