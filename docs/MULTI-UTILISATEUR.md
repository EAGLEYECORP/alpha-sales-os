# « QUE D'AUTRES L'UTILISENT, ET QUE CE NE SOIT PAS MA SESSION »

> **Écrit le 4 septembre 2026.** État réel de l'isolation entre utilisateurs :
> ce qui tenait déjà, ce qui ne tenait pas, et ce qui reste ouvert.
>
> ⚠ Rien de ce qui suit n'a été vérifié contre un vrai projet Supabase depuis
> ce bac à sable (clés live bloquées). Les règles sont testées, le parcours
> réel se vérifie à deux comptes, en navigation privée.

---

## 1. CE QUI TENAIT DÉJÀ — et que j'ai d'abord cru cassé

**La base de données.** Le cloisonnement repose sur la RLS Supabase et le JWT
(`lib/tenant.ts`). Un compte ne lit jamais les lignes d'un autre : ce n'est pas
l'app qui filtre, c'est la base qui refuse.

**Nos jeux de données réels.** `/api/pipeline` sert `lib/pipeline-juillet` —
78 entreprises réellement démarchées, avec adresses et numéros de téléphone.

> ⚠ **Je me suis trompé en annonçant une fuite.** J'avais cherché la garde
> dans `lib/bricks-access.ts` et `lib/entitlements.ts`, conclu qu'elle
> n'existait pas, et annoncé que tout inscrit pouvait lire ces fiches. C'est
> faux : `MAITRE_SEULEMENT` (`middleware.ts:280`) liste cette route et refuse
> **403** à tout compte non maître, **avant** le contrôle par brique. Un test
> le garde depuis longtemps. La route n'a jamais été ouverte.

Ce qui était réellement incohérent : `CHEMIN_PAR_API` rattachait cette route à
`/pipeline`, donc à la brique `crm` — devenue **gratuite** le 02/09/2026. Les
deux couches répondaient l'inverse l'une de l'autre à la même question, et
seule la plus haute disait vrai. Alléger `MAITRE_SEULEMENT` — un geste qui
ressemble à du rangement — aurait suffi à ouvrir la route à tous les inscrits.
**Une défense qui ne tient que parce qu'une autre tient n'est pas une défense
en profondeur : c'est un point unique déguisé en deux.** Les deux disent
maintenant la même chose (`/jeux-internes`, aucune brique).

---

## 2. CE QUI NE TENAIT PAS — le vrai « c'est ma session »

### 2.1 Le navigateur gardait le pipe du précédent

Le pipe vit dans le `localStorage`, sous une clé **unique et non nominative**
(`alpha-sales-os-v2`). `signOut()` ne faisait qu'une chose : fermer la session
Supabase. **Il ne touchait pas au stockage.**

Sur n'importe quelle machine partagée — à commencer par l'ordinateur de
démonstration :

1. tu travailles, ton pipe s'écrit dans le `localStorage` ;
2. tu te déconnectes ;
3. un client crée son compte et se connecte sur la même machine ;
4. il ouvre `/pipeline` — **et il voit tes fiches.**

Ce n'est pas une faille serveur : la RLS fait son travail, la base ne lui rend
rien. C'est le **navigateur** qui garde l'état du précédent. Il hérite
littéralement de ta session, avec des noms, des téléphones et des montants.

**Corrigé** (`lib/session-locale.ts`) : le stockage note à qui il appartient.
À chaque changement de session, on compare.

| Situation | Décision |
|---|---|
| Personne n'est connecté | **rien** |
| Stockage sans propriétaire | **adopter** — le compte qui arrive le réclame |
| Le même revient | **rien** |
| **Un autre compte se connecte** | **purger**, puis recharger |

> ⚠ **On ne purge PAS à la déconnexion, et c'est délibéré.** L'app est
> local-first : tant que `pipeServeur` est éteint, le `localStorage` est la
> **seule** copie qui existe. Effacer à la déconnexion détruirait le travail de
> quelqu'un qui se déconnecte pour se reconnecter. Et ce n'est pas nécessaire :
> une fois déconnecté, l'écran de connexion est fermé. La purge tombe au moment
> utile — quand un **autre** ouvre une session.
>
> ⚠ **Un doute ne purge jamais.** Stockage bloqué (navigation privée, réglage
> navigateur) → propriétaire illisible → on adopte, on n'efface pas. On ne
> détruit pas sur une information qu'on n'a pas.
>
> ⚠ **Le rechargement après purge n'est pas une commodité.** L'état zustand vit
> en mémoire : vider le `localStorage` ne le vide pas, et l'écran continuerait
> d'afficher les fiches du précédent — en pire, puisque le nouvel arrivant les
> prendrait pour les siennes et écrirait dessus.

**Le corollaire à connaître** : sur une machine où des données existent déjà
sans propriétaire (tout ce qui a été créé avant que les comptes existent),
c'est **le premier qui se connecte** qui les réclame.

### 2.2 Tout nouveau compte signait « EAGLEYE CORP »

`DEFAULT_SETTINGS` pose `agencyName: "EAGLEYE CORP"` pour **tout le monde**.
Le produit est white-label : un opérateur qui n'ouvre jamais les Réglages
envoie ses messages, ses devis et ses en-têtes sous **notre** raison sociale.

Et le parcours de démarrage, qui lui déroulait seize étapes, ne le lui disait
nulle part.

**Corrigé** : une étape **« Mettre TON nom sur l'outil »** ouvre désormais le
parcours, avant toute plomberie. Elle se vérifie toute seule, et elle
distingue les deux cas — pour le compte **maître**, « EAGLEYE CORP » **est** la
bonne réponse ; pour tous les autres, la valeur d'usine laissée en place n'est
pas un réglage, c'est l'absence de réglage.

Ce qu'un inscrit gratuit voit maintenant, mesuré :

```
INSCRIT GRATUIT : 8 étapes, 10 verrouillées
  1 · Brancher → identite, booking, offre
  2 · Charger  → fuel, qualite
  3 · Lancer   → first-meeting
  4 · Tenir    → rythme, premier-signe
→ première action : Mettre TON nom sur l'outil
   détail : encore « EAGLEYE CORP » : tes messages partent sous la raison
            sociale de l'éditeur
```

---

## 3. CE QUI RESTE OUVERT — et ce n'est pas un détail

### 3.1 Aucun identifiant par locataire

C'est **la** limite du multi-utilisateur, et elle est structurelle.

`/api/send` lit `SMTP_*` dans l'environnement du **serveur**. `/api/voice/call`
lit `LIVEKIT_*`. `/api/ai` brûle nos jetons. **Il n'existe aucun chemin
d'identifiants par locataire.**

Conséquences concrètes :

- c'est **la seule raison** pour laquelle les briques qui agissent sont
  payantes — ce n'est pas un arbitrage commercial mais une contrainte
  technique ;
- un acheteur d'Alpha Voice a besoin que **tu** configures sa téléphonie à la
  main. Environ une demi-journée par client ;
- tant que ça n'existe pas, « ils apportent leurs propres identifiants » n'est
  pas implémentable, quoi qu'on écrive sur une page de vente.

Le jour où les identifiants deviennent par locataire, la frontière
gratuit/payant se rediscute. Pas avant.

### 3.2 L'identité vit encore dans le portefeuille

`agencyName` et `accountId` viennent de `lib/accounts.ts`, qui décrit **notre**
portefeuille (EAGLEYE, Nuwacom). Un locataire client n'y figure pas : il
« emprunte » l'entrée maître et écrase le nom dans ses réglages.

Ça marche, et ce n'est pas la bonne architecture. L'identité devrait venir des
Réglages, hydratés depuis le serveur. C'est un vrai refactor — une dizaine de
modules de routage portent le nom du compte — déjà identifié comme tel dans
`CLAUDE.md`. L'étape d'identité du §2.2 traite le symptôme, visiblement et
utilement ; elle ne remplace pas ce chantier.

### 3.3 Ce qui n'a pas été vérifié en conditions réelles

Le parcours complet — deux comptes, deux navigateurs, purge constatée, données
séparées — **demande un vrai projet Supabase joignable**. Depuis ce bac à
sable, je ne peux pas le faire.

**Le test qui vaut** : ouvre une session, crée deux fiches, déconnecte-toi,
connecte-toi avec un second compte sur le **même navigateur**. La page doit se
recharger et le pipe doit être vide. Reconnecte-toi avec le premier : ses
fiches ont disparu **de ce navigateur** — c'est voulu, et c'est pourquoi
`pipeServeur` existe pour qui veut retrouver son pipe ailleurs.
