# Une station qui travaille seule — ce qu'il faut, ce qui existe, et où ça s'arrête

Question posée le 20/10/2026 : « faut-il l'un de ces projets open source pour
qu'ALPHA devienne une station qui travaille seule d'un bouton, et que le SaaS
travaille devant l'utilisateur comme Cowork ou Manus ? » Liste de départ :
`rodrigoandrigo/open-source-alternatives-to-manus-ai` (une liste de liens, sans
code). Trois projets ont été clonés et lus : OpenManus, Suna/Kortix, Magentic-UI.

## 1. Ce qu'est une « station », en quatre pièces

1. **Une boucle d'agent** : un modèle qui planifie, appelle des outils, regarde le résultat, recommence.
2. **Des outils** : ce que la boucle a le droit de faire.
3. **Un bac à sable** (navigateur, terminal, VM) : seulement si l'agent doit agir sur des interfaces qu'il ne maîtrise pas.
4. **Une vue en direct avec garde d'approbation** : l'utilisateur voit les étapes et valide ce qui engage.

## 2. Verdict par projet — aucun n'est une dépendance d'ALPHA

| Projet | Ce que c'est | Pourquoi pas chez nous |
|---|---|---|
| **OpenManus** (MIT) | Agent généraliste Python : outils bash, exécution Python, navigateur, `crawl4ai`, recherche web, `ask_human`, MCP | Autre langage (Python) et une quarantaine de dépendances ; son pouvoir est précisément ce qu'ALPHA refuse d'embarquer — collecte de pages et exécution de code. Un agent qui peut tout faire n'est pas un agent qu'on peut laisser agir sur un pipe réel. |
| **Suna / Kortix** (**Elastic License 2.0**) | « Système d'exploitation IA » : un ordinateur cloud isolé par session, branche git par tâche, passerelle de modèles, approbation humaine | ⚠ **Licence qui interdit d'offrir le logiciel en service hébergé à des tiers** : impossible comme base d'un SaaS. Une version « marque blanche » existe, sous une licence à part. Et c'est le même parti pris : un ordinateur par session. |
| **Magentic-UI** (MIT, Microsoft) | Agent de navigation qui garde l'humain dans la boucle : on le dirige, on approuve, on reprend la main ; il s'arrête avant une action critique | Python + VM + modèle de navigation dédié. **Son idée est la bonne — et elle est déjà la nôtre** : le plan se relit, rien d'engageant ne part seul. |
| Les agents « computer use » de la liste | Pilotent un bureau par captures d'écran | Un robot qui clique sur des sites tiers, au nom d'un inscrit : c'est le contournement de détection que la doctrine refuse (`docs/COLLECTEURS-EXTERIEURS.md`). |

**Ce qu'on prend, et qui ne s'installe pas : des PATRONS.** L'arrêt avant une
action critique (Magentic), la règle « l'agent demande, l'humain approuve » (Kortix,
`ask_human` d'OpenManus), le journal d'étapes visible (tous). Ils sont déjà
écrits ici : `lib/propositions.ts`, `lib/mission-alpha.ts`, `lib/presence-alpha.ts`.

**Le bon rapport avec ces projets est inverse** : ils sont des CLIENTS d'ALPHA.
Le serveur MCP d'ALPHA (`/api/mcp`) leur donne des outils qui ne peuvent rien
casser (lire l'état, déposer une proposition). Un utilisateur qui préfère
piloter ALPHA depuis son propre agent le branche — c'est ALPHA ASSIST. Aucune
ligne de ces projets n'entre dans le dépôt.

## 3. Ce qui existe désormais

- **« Lancer ALPHA »** (`/aujourdhui`, `lib/mission-alpha.ts`) : un bouton, six
  étapes réelles (lire, trier, décider, préparer les messages, constituer la liste
  d'appels, bilan), rendues à mesure qu'elles finissent. **Un seul geste qui écrit :
  préparer des brouillons.** Elle n'a aucun moyen d'envoyer ni d'appeler — pas une
  consigne, une absence de fonction.
- **« ALPHA a besoin de toi »** (`lib/presence-alpha.ts`) : la bande sur chaque
  écran, le « (3) » dans l'onglet, la notification.
- **Brancher ses comptes en deux champs** (`lib/identifiants-assistes.ts`).
- **« ALPHA au travail »** (`/travail`, `lib/circuit-alpha.ts`) : ce que la
  machine fait à chaque étape, avec la règle qui l'applique (fichier + symbole,
  vérifiés par un test), l'état des garde-fous et le journal réel. Et, sur sept
  écrans, « Ce qu'ALPHA fait ici » (`lib/alpha-ici.ts`).

## 4. Où ça ne se fait PAS aujourd'hui, et pourquoi

| Ce qui manque | Pourquoi | Ce que ça exigerait |
|---|---|---|
| **ALPHA qui travaille pendant que l'inscrit dort** | Le CRM d'un compte gratuit vit dans son navigateur ; le serveur ne le voit pas. C'est la promesse de souveraineté. Un agent ne peut pas travailler sur ce qu'il ne voit pas. | Le pipe de l'inscrit sur NOTRE serveur (`pipeServeur`, opt-in) **et** un déclencheur par locataire. Aujourd'hui seul NOTRE pipe a ça (`/api/push/tick` lit `lireProspectsOperateur`). **Décision de souveraineté, TRANCHÉE le 21/10/2026 par Zakaria : NON.** Le pipe d'un inscrit en ligne ne vit pas chez nous ; l'onglet ouvert est la frontière. Ça existe app fermée sur l'installation « chez vous » (son serveur, son tick) — c'est une raison d'acheter la grille complète. |
| **Envoi automatique depuis la boîte de l'inscrit** | Possible techniquement (ses identifiants sont chiffrés, `tenant_credentials`), mais c'est sa réputation de domaine qui est en jeu, et aucune règle d'armement par locataire n'existe : l'autopilote est global, maître seul (`015-autopilote-reglage.sql`). | Un interrupteur et un palier d'envoi par locataire, les mêmes gardes que `/api/send` (mentions, palier du jour, présence). |
| **Appel téléphonique depuis la version en ligne** | Pas de clé par locataire pour la téléphonie : ça brûlerait NOTRE ligne. | Un lot « BYOK téléphonie » (`docs/BYOK-CHIFFRAGE.md`) — ou l'installation « chez vous ». |
| **LinkedIn envoyé par ALPHA** | Aucune API légitime pour cet usage ; l'automatiser, c'est du faux comportement humain. | Rien : on le fait à la main, et on le dit (« troisième colonne »). |
| **ALPHA qui trouve les prospects** | La collecte reste dehors, sous la responsabilité de celui qui la fait. | Un collecteur externe (ou l'assistant de l'utilisateur via MCP) qui dépose une feuille. |
| **Un agent généraliste qui navigue et code** | Ce n'est pas le métier d'ALPHA, et c'est la surface d'abus la plus chère. | Ne pas le construire. |

## 5. Le chemin vers « la station », dans l'ordre

1. ✅ Brancher ses comptes sans friction (fait).
2. ✅ La mission en un bouton, devant l'utilisateur (fait, onglet ouvert).
3. **Extraire le moteur côté serveur.** Cinq étapes sur six sont des fonctions
   pures qui tournent telles quelles sur un serveur (`triageImport`,
   `computeRoutines`, `buildCallSession`). La sixième (les brouillons) est liée au
   store du navigateur : sa logique (`fillTemplate`) est à extraire.
4. ✅ **Décidé le 21/10/2026 : NON** — le pipe d'un inscrit en ligne ne vit pas
   chez nous. Les marches 5 à 7 ne se construisent donc **pas sur le cloud**.
5. *(installation « chez vous » seulement)* Un déclencheur sur le serveur du
   client (même modèle que `004-ordonnanceur.sql`), qui joue la mission et
   DÉPOSE ses résultats comme propositions — jamais comme envois.
6. *(idem)* Les notifications push depuis son serveur (le dispositif existe
   pour nous seuls).
7. *(idem)* Seulement après : un interrupteur d'envoi, derrière les gardes.

Chaque marche est livrable seule. Le « non » du 21/10 déplace le chantier : de
« un tick par inscrit en ligne » (abandonné) à « un tick dans l'installation du
client » (la marche 3 reste le prérequis, et elle sert les deux).
