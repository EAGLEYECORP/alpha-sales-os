# RENDRE LE POST VRAI — la liste, ligne par ligne

> **Écrit le 4 septembre 2026.** Le post de lancement LinkedIn contient onze
> affirmations. Six sont vraies ou le deviennent avec du travail ; deux ne
> peuvent pas devenir vraies par du travail et doivent sortir.
>
> Une affirmation ne devient pas vraie parce qu'on la répète. Elle devient
> vraie parce qu'un fait existe derrière — et ce document dit lequel, pour
> chacune.

---

## 0. L'ORDRE, AVANT TOUT LE RESTE

**Ne pas publier tant que l'inscription ne marche pas de bout en bout.**

Le post envoie des gens vers un formulaire. Le service d'email intégré de
Supabase est plafonné à **2 messages/heure** et ne délivre **qu'aux membres du
projet** : tel quel, aucun inscrit ne reçoit sa confirmation. Un lancement ne se
fait qu'une fois — vingt inscrits qui ne peuvent pas confirmer, c'est vingt
contacts brûlés et un post qu'on ne peut pas rejouer.

Détail complet : [`docs/INSCRIPTION.md`](./INSCRIPTION.md). Test qui fait foi :
une inscription réelle, adresse jetable, navigation privée, jusqu'à voir
`/demarrage`.

---

## 1. CE QUI EST DÉJÀ VRAI

| Affirmation | Pourquoi c'est vrai |
|---|---|
| « Le site est en ligne » | Vérifié : `auth.verrou: true`, 403 sur un compte non maître |
| « Offre VIP white-label » | Le pack existe (10 000 € HT) et le produit est réellement white-label — marque, adresse et logo suivent le compte (`lib/signature.ts`) |
| « Un audit deep-dive par prospect » | `lib/deep-dive.ts` existe et tourne — **mais c'est une brique PAYANTE**, voir §2 |
| « Le forcing ne me plaisait pas… » | C'est ton histoire. Personne ne peut la contester, et c'est la meilleure ligne du post |

---

## 2. CE QUI DEVIENT VRAI AVEC DU TRAVAIL — et lequel

### A. « #Gratuit contre votre email » — **fait aujourd'hui**

| Ce qu'il fallait | État |
|---|---|
| Un socle réellement gratuit | ✅ existait déjà (`crm · closer · cerveau · pilotage`, sans durée) |
| Que l'inscrit reçoive sa confirmation | ⏳ **les 4 réglages Supabase — à toi** |
| Que le SITE le dise | ✅ **fait ce jour** — la vitrine ne mentionnait le gratuit nulle part |

> ⚠ Le défaut le plus embarrassant de la journée : le socle est ouvert depuis
> le 02/09, le serveur l'applique, des tests le gardent — et la page publique
> ne proposait **qu'une seule porte**, « demander un cadrage ». C'est-à-dire un
> rendez-vous avec un inconnu, proposé à quelqu'un qui n'a rien vu du produit.
> La porte qui ne coûte que dix secondes existait dans le code et pas sur la
> page.

### B. « #Payant pour couches téléphonie » — **la phrase doit changer**

C'est **faux**, et ça se paie en remboursements. La frontière réelle :

| Gratuit | Payant |
|---|---|
| `crm` · `closer` · `cerveau` · `pilotage` | `campagnes` · `alpha-voice` · `agent-alpha` · `audits` · `tracking` · `alpha-live` |

Donc l'envoi d'emails, l'agent IA, **et les audits deep-dive que tu vantes
trois lignes plus bas** sont payants. Le post promet en gratuit ce qui est
facturé.

Pourquoi cette ligne ne peut pas devenir vraie « en ouvrant plus » : `/api/send`
lit `SMTP_*` dans l'environnement du **serveur**, `/api/voice/call` lit
`LIVEKIT_*`, `/api/ai` brûle nos jetons. **Il n'existe aucun chemin
d'identifiants par locataire.** Ouvrir ces briques au gratuit revient à prêter
notre carte bancaire à des inconnus.

**Formulation vraie** : *« Ce qui vous organise est gratuit. Ce qui AGIT à votre
place se paie : les envois, les appels, l'agent qui écrit, les audits. »*

### C. « + 30 % de CA généré » — **retirer du post, garder au cadrage**

Écrit ainsi, ça se lit « pour avoir le gratuit, tu me dois 30 % de ton CA ».
Deux problèmes, et le second est le vrai :

1. le gratuit est **sans contrepartie** ; les 30 % sont une **alternative** au
   pack 10 000 €, sur devis, après cadrage ;
2. **on ne sait pas mesurer « le CA généré par Alpha ».** Aucun mécanisme
   d'attribution n'existe dans le produit. Réclamer un pourcentage d'un nombre
   qu'on ne sait pas calculer, c'est un litige au premier trimestre — sur le
   dénominateur, pas sur le taux.

**Pour que ça devienne vrai** : construire l'attribution (quelle affaire vient
d'une touche Alpha, avec quelle fenêtre, quelle règle en cas de contact
multiple) et l'écrire dans un contrat. C'est des semaines, et ça se décide
avec un premier client réel, pas avant.

En attendant : le montant se dit au cadrage. La vitrine, elle, **interdit déjà
d'afficher ce taux** — `tests/vitrine-fuite.test.ts` refuse `30 %` sur la page
publique.

### D. « Après tests internes en entreprises » — **une seule entreprise, nommée**

Zéro client, zéro vente. Le pluriel invente un programme de validation.

**Pour que ça devienne vrai** : faire un pilote réel chez **une** entreprise
qui accepte d'être citée, et obtenir son accord **par écrit**. Une semaine, et
ça ne dépend que d'un oui.

> Le dépôt mentionne la **Carrosserie des Brotteaux** comme « convertie »
> (`voice/README.md`) alors que `CLAUDE.md` affirme zéro vente. **Les deux ne
> peuvent pas être vrais.** Si une démo réelle a eu lieu là-bas, tu as le droit
> de le dire — précisément, au singulier, nommément. Pas « des tests internes
> en entreprises ».

### E. « la même qualité de service client que sur place » — **remplacer par la démo**

Invérifiable par nature, et l'agent n'a jamais passé d'appel réel à un prospect.

Ce qui la remplace et qui est **plus fort** : *faire sonner l'agent pendant le
rendez-vous, sur son métier à lui.* C'est ce que la doctrine appelle la
démonstration en direct, et ça ne demande aucune confiance.

---

## 3. CE QUI NE PEUT PAS DEVENIR VRAI PAR DU TRAVAIL

### F. « leur calendrier se remplit à 80 % automatiquement »

**Le chiffre le plus dangereux du post** : spécifique, vérifiable, et faux.

Aucune campagne n'a jamais été mesurée. Les trois taux qui gouvernent tout le
dimensionnement — décroché, intérêt qualifié, coût minute — sont **des
hypothèses déclarées comme telles** dans `lib/paliers-campagne.ts`. Le produit
lui-même refuse d'afficher un taux sans dénominateur ni intervalle de
confiance : le post ferait dehors ce que le code interdit dedans.

Pour qu'un tel chiffre existe un jour : palier 10 → palier 100, avec mesure.
Des mois. **D'ici là, ce n'est pas « pas encore prouvé », c'est inventé.**

Et c'est aussi le seul point du post qui expose juridiquement : une promesse de
performance non étayée est attaquable, y compris entre professionnels.

> `tests/vitrine-fuite.test.ts` refuse déjà ce motif sur le site :
> `/\+\s*\d+\s*%\s*de\s*(ventes|chiffre|conversion)/`.

### G. « la vision des différents CEOs… excités à l'idée d'avoir une solution »

Endossement fabriqué. Tu as **un** CEO réel — Christophe, chez Nuwacom — et
c'est un **partenaire**, pas un client enthousiaste du produit.

Ça peut devenir vrai, mais pas par du travail de ta part seule : il faut que
des dirigeants **acceptent d'être cités**, nommément, avec une phrase qu'ils
assument. Tant que ce n'est pas le cas, le pluriel et le mot « excités » sont
de la preuve inventée.

> `tests/preuve-sociale.test.ts` interdit exactement ça **dans** le produit :
> `lib/hormozi.ts` disait « nos clients ambulanciers » et un seul « lesquels ? »
> terminait l'entretien. Le post le fait dehors.

---

## 4. LE SITE, ALIGNÉ SUR LE DÉPÔT — ce qui a été corrigé ce jour

### Vitrine (`app/vitrine/page.tsx`) — la page que le post pointe

| Avant | Après |
|---|---|
| Le socle gratuit n'apparaissait **nulle part** | Section « Commencer », les quatre briques, et une porte vers `/souscrire` |
| Seule grille voix affichée : 364 € le millier d'appels **sortants** | La grille de l'accueil, décidée le 02/09 : **990 € HT + 149 / 349 €/mois**, 0,25 €/min au-delà |
| La garantie n'était pas dite | « L'installation ne se paie qu'au premier rendez-vous », **avec ses trois bords** (30 jours, périmètre, RDV pris) |
| L'article 50 n'était pas dit | La divulgation IA servie **comme argument** — c'est le seul fait de la page qui ne demande aucune confiance |

### Site statique (`site/index.html` — eagleyecorp.fr)

- Le palier **« Solo 79 €/mois » vendait ce qui est devenu gratuit.** Remplacé
  par le socle gratuit, avec le lien d'inscription.
- Le palier voix annonçait **149 € sans les 990 € d'installation** — c'est
  exactement le « palier d'entrée à perte » que la grille du 02/09 a corrigé.
  L'installation est rétablie, le palier Intensif ajouté, la garantie affichée.
- « L'audit de ta vente est offert » promettait une brique **payante**.
  Remplacé par la frontière réelle.

> Je m'étais trompé en disant que ce site vendait à perte : le plafond de
> 200 appels existait, avec le commentaire qui l'explique. La divergence était
> ailleurs — il facturait le gratuit et omettait l'installation.

### Ce qui reste ouvert, et qui est un arbitrage COMMERCIAL, pas un bug

- **L'offre « Solo » à 79 €/mois existe toujours**, avec un plan Stripe actif
  (`STRIPE_PRICE_SOLO`). Trois de ses quatre capacités sont désormais
  gratuites ; il ne lui reste réellement que les audits et la boîte d'envoi.
  Son texte a été corrigé pour ne plus promettre « tout le cœur du système ».
  **A-t-elle encore un sens à 79 € face à un socle gratuit ? C'est ta décision,
  pas la mienne.** Un test refuse désormais le seul cas indéfendable : une
  offre payante qui n'ouvrirait QUE des briques gratuites.
- **La grille Alpha Voice (990 / 149 / 349) n'est pas dans `OFFRES`**, la liste
  des offres validées. Elle vit dans `ALPHA_VOICE_PALIERS`. Les deux sont
  cohérentes et testées, mais ce sont deux structures — donc deux endroits où
  un prix peut diverger un jour.

---

## 5. LA LISTE, EN CLAIR

**Avant de publier :**

1. Poser les 4 réglages Supabase (`docs/INSCRIPTION.md` §2.2).
2. Faire **une inscription réelle** en navigation privée jusqu'à `/demarrage`.
3. Déployer le site corrigé (**sans cache** : les `NEXT_PUBLIC_*` sont figées au build).
4. Relire la page publique en se demandant, ligne par ligne : *est-ce que je
   peux le prouver à quelqu'un qui me le demande ?*

**Dans le post :**

5. Corriger la frontière gratuit/payant (§2-B).
6. Retirer les 30 % (§2-C) — ils se disent au cadrage.
7. Retirer « tests internes en entreprises » (§2-D) ou nommer l'entreprise.
8. Retirer les 80 % (§3-F). Sans négociation.
9. Retirer « les CEOs excités » (§3-G), ou obtenir une citation assumée.
10. Remplacer « même qualité que sur place » par la démo en direct (§2-E).
11. Ajouter ce que tu n'utilises pas : les prix nets, la garantie, l'article 50.

**Après :**

12. Le premier qui répond « ça m'intéresse » vaut plus que tout ce document.
    Ce qu'il dit se range dans le Cerveau, pas dans une note de fiche.
