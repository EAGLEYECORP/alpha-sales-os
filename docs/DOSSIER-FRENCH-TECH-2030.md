# DOSSIER FRENCH TECH 2030 — EAGLEYE CORP / ALPHA SALES OS®

> **Rédigé le 3 septembre 2026.** Dépôt annoncé avant le **4 septembre 2026,
> 23h59** (heure de Paris).
>
> ⚠ **CE DOCUMENT N'EST PAS DÉPOSABLE EN L'ÉTAT.** Il couvre les lots que je
> pouvais produire à partir de faits VÉRIFIÉS dans le dépôt. Quatre sections
> sont marquées **[À REMPLIR — ZAKARIA]** : ce sont celles qui demandent des
> chiffres d'entreprise, des pièces légales ou une décision. Elles ne sont pas
> oubliées, elles sont hors de ma portée — et un dossier incomplet est rejeté.
>
> Découpage en lots : `lib/mission-french-tech.ts`.

---

## 0. Avertissement d'honnêteté, à lire avant de déposer

**L'adéquation au programme est plausible, pas acquise.** French Tech 2030 vise
la deep-tech de souveraineté. Alpha Sales OS est un logiciel de vente. Le seul
angle qui tient est :

> *« L'automatisation commerciale des PME françaises ne doit pas dépendre
> d'acteurs américains. »*

Pas la liste des fonctionnalités. Un dossier qui déroule les écrans sera classé
« SaaS B2B » et écarté ; un dossier qui démontre une architecture réellement
dé-américanisable a une chance.

**⚠⚠ MISE À JOUR DU 3 SEPTEMBRE 2026 — LA QUESTION EST TRANCHÉE, ET PAS PAR
NOUS : LE SEUIL D'ÉLIGIBILITÉ EST DE 3 M€ CUMULÉS DEPUIS 2024. Voir §1.**

Le reste de ce document garde sa valeur : les arguments de souveraineté, de
conformité et de différenciation sont écrits, sourcés et réutilisables — pour
la promotion suivante, pour un dossier Bpifrance, ou pour une page de vente.
Ils ne périment pas avec la date.

Ce qui suit a donc été rédigé AVANT la vérification d'éligibilité. Le lire
comme un matériau, pas comme un dossier à déposer.

---

## 1. Éligibilité — **VÉRIFIÉE LE 3 SEPTEMBRE 2026 : NON RECEVABLE**

> ⚠⚠ **NE PAS DÉPOSER CETTE ANNÉE.** Le critère qui tranche est un seuil
> financier, et EAGLEYE CORP ne l'atteint pas. Vérifié sur deux recherches
> indépendantes le 3 septembre 2026 ; **à reconfirmer sur le guichet officiel**
> avant toute décision définitive.

**Critères de la 3e promotion (candidatures 2026)**

| Critère | Exigence | EAGLEYE CORP |
|---|---|---|
| **Financements et/ou CA cumulés depuis le 1er janvier 2024** | **≥ 3 000 000 €** | **0 €** ❌ |
| Maturité technologique | **TRL 6 minimum** (prototype pleinement fonctionnel validé en environnement opérationnel) | plausible, à argumenter |
| Création de la société | après le 1er janvier 2013 | ✅ |
| Capitaux propres | positifs | à vérifier |
| Obligations fiscales et sociales | à jour | à vérifier |
| Domaine | IA · quantique · cybersécurité · spatial · robotique · électronique · infrastructures numériques · santé · énergie/décarbonation | **IA** ✅ |
| Équipe | au moins un fondateur au profil technique ou scientifique lié à la technologie | ✅ |
| Date limite | **4 septembre 2026, 23h59** (Paris) · résultats en octobre | — |

**Le seuil de 3 M€ est éliminatoire et il n'est pas discutable.** Il se compte
en **financements obtenus OU chiffre d'affaires généré**, cumulés depuis le
1er janvier 2024. Une levée compte, une subvention compte, du CA compte. Zéro
des trois ne se rattrape pas la veille.

**Ce que ça change concrètement :** les huit heures de travail prévues pour ce
dossier n'ont pas d'objet cette année. Le temps est mieux placé ailleurs.

### Ce qu'il faudrait pour candidater à la promotion suivante

Une seule ligne à faire bouger : **3 M€ cumulés**. Deux chemins, pas trois.

- **Par le chiffre d'affaires** — au pack complet (10 000 € installation), c'est
  l'ordre de grandeur de **300 clients**. Hors de portée à l'horizon d'un an.
- **Par le financement** — subventions, prêts d'honneur, BPI, levée. C'est le
  chemin réaliste, et il se prépare sur douze mois.

> ⚠ Corollaire à ne pas manquer : **le programme n'est pas fait pour le stade
> où tu es.** Il accompagne des sociétés déjà financées ou déjà en revenus. Un
> dossier déposé maintenant ne serait pas « refusé de peu », il serait écarté à
> la première ligne du filtre automatique. Ce n'est pas un échec, c'est une
> erreur de porte.
>
> Les dispositifs faits pour le stade pré-revenu existent — bourse French Tech
> (Bpifrance), prêts d'honneur des réseaux d'accompagnement, aides régionales à
> l'innovation. Aucun n'a été instruit ici : c'est un travail à part, et il n'a
> pas de date limite demain.

---

## 2. L'angle souveraineté — le cœur du dossier

### 2.1 Le problème, formulé pour un évaluateur public

Une PME française qui veut automatiser sa prospection assemble aujourd'hui :
un CRM américain, un outil de séquences américain, un moteur d'IA américain, un
fournisseur de voix américain. Ses données commerciales — qui elle démarche,
quand, avec quel argument, à quel prix, avec quel résultat — transitent et
résident hors d'Europe.

Ce ne sont pas des données anodines : c'est la **cartographie de son marché**.
Elle est produite par l'entreprise et captée par la couche logicielle.

### 2.2 Ce qui est démontrable dans le code, aujourd'hui

Chaque affirmation ci-dessous est vérifiable dans le dépôt. Les références sont
données pour qu'un évaluateur technique puisse les ouvrir.

**a) La chaîne d'IA commence par le LOCAL** — `lib/ai-engine.ts`

L'ordre est : **Ollama (sur la machine) → NVIDIA NIM → Anthropic**, et si aucun
moteur n'est configuré, un **moteur de gabarits écrit à la main** prend le
relais. Le produit reste fonctionnel avec **zéro appel sortant vers un
fournisseur américain**. Ce n'est pas une option de repli dégradée que personne
n'active : c'est le premier maillon testé de la cascade.

**b) Ce qui n'a AUCUNE dépendance, parce que c'est écrit à la main**

| Fonction | Implémentation |
|---|---|
| RAG / recherche documentaire | BM25 lexical (`lib/knowledge.ts`) — pas de base vectorielle, pas de clé, pas de service |
| Extraction PDF / DOCX / HTML | `lib/file-extract.ts` |
| Génération de documents | fait main |
| CSV (lecture, écriture, fusion) | `lib/csv.ts` |
| Cryptographie (jetons, empreintes) | primitives de la plateforme |

> ⚠ **Ne pas écrire « zéro dépendance runtime » dans le dossier.** Le dépôt
> déclare **14 dépendances** de production (framework Next/React, client
> Supabase, nodemailer, recharts, SDK IA…). La formule exacte et défendable
> est : *« les briques qui capteraient de la donnée métier — RAG, extraction,
> CSV, crypto — sont écrites à la main et ne sortent rien. »* Un évaluateur
> ouvre `package.json` en trente secondes ; se faire prendre sur ce point
> décrédibilise tout le reste du dossier.

**c) La pile vocale est déplaçable**

LiveKit Agents (open source, auto-hébergeable), Silero VAD (local). Deepgram
(STT) et Fish Audio (TTS) sont aujourd'hui des services externes, et la
téléphonie passe par Telnyx. **C'est le point faible de la souveraineté, et il
faut le dire** : ce qui est acquis, c'est que l'architecture permet la
substitution ; ce qui n'est pas fait, c'est la substitution elle-même.

**d) Les données peuvent rester en France**

Persistance Postgres via Supabase (open source, auto-hébergeable, région
européenne disponible). Mode **local-first** par défaut : sans configuration,
l'application fonctionne entièrement dans le navigateur de l'utilisateur, sans
aucun serveur.

### 2.3 La conformité, appliquée par le code et non par une politique

C'est l'argument le plus fort du dossier, parce qu'il est rare et vérifiable.

**Article 50 du règlement européen sur l'IA** (applicable depuis le 2 août
2026) : un système qui interagit avec une personne doit lui faire comprendre
qu'elle parle à une IA et pour le compte de qui il agit.

Ici, ce n'est **pas une consigne dans le prompt** — un modèle peut dévier d'une
consigne. La première phrase est prononcée **par le code**, hors du modèle,
avant qu'il ait la parole, et sans interruption possible :

```python
await session.say(first_sentence(script), allow_interruptions=False)
```

`voice/agent.py` — `first_sentence` y est défini, et l'appel porte
explicitement `allow_interruptions=False`.

Et `audit_script` **refuse de démarrer l'appel** si le script ne porte pas les
trois mentions. La vérification a lieu **deux fois**, dans deux services qui ne
se font pas confiance : l'application avant l'envoi, l'agent avant de décrocher.

**Décret n° 2022-1313** (plafond de 4 sollicitations par consommateur sur 30
jours glissants) : la cadence de rappel du produit fait exactement 4 contacts,
jamais plus, et `plafondRappels` (`lib/call-cadence.ts`) reste armé pour les
cibles sans SIREN — une liste terrain est mêlée, et c'est l'éditeur qui porte
le risque.

**Opposition** : « ne me rappelez plus » déclenche un arrêt définitif,
prioritaire sur toute autre règle. Désinscription STOP en pied de chaque email,
vérifiée sur le texte **rendu** et non sur le gabarit.

> Formulation utilisable telle quelle : *« La conformité n'est pas une
> politique affichée, c'est une contrainte d'exécution : quand le script n'est
> pas conforme, l'appel n'a pas lieu. »*

---

## 3. La différenciation technique

### 3.1 Ce qui n'existe pas ailleurs

**La doctrine commerciale est exécutée, pas documentée.** Les règles de vente ne
sont pas des conseils dans une aide en ligne : le logiciel refuse.

- Impossible de marquer une affaire « signée » si la démonstration n'a pas eu
  lieu avant l'annonce du prix, si la conviction est incomplète ou si des
  objections restent ouvertes. Le tableau refuse et explique pourquoi.
- Impossible d'enregistrer un contact sans prochaine étape datée.
- Aucun chiffre inventé : sans données, l'argumentaire dit « je ne vous annonce
  pas de chiffre » au lieu d'estimer.

**Le coût de revient est mesuré, pas estimé.** `lib/voice-costs.ts` porte les
tarifs fournisseurs relevés en août 2026, **chaque ligne citant sa source**, et
distingue explicitement ce qui est mesuré de ce qui reste une hypothèse (le
tarif mobile français, par exemple, est marqué « HYPOTHÈSE, TOUJOURS NON
VÉRIFIÉE »).

**La mesure refuse de mentir** (`lib/calibration.ts`). Trois règles tenues par
la suite de tests :

- zéro donnée → zéro chiffre (`source: "aucune"`, valeur `null`) ; un « 0 % »
  se lirait comme un résultat, l'angle mort se dit ;
- jamais un taux nu : dénominateur + intervalle de Wilson à 95 % ;
- aucun poids ne s'auto-corrige : sur quarante appels, un ajustement
  automatique apprend le bruit et le grave dans le tri.

### 3.2 L'état du logiciel au 3 septembre 2026

| | |
|---|---|
| Modules `lib/` (purs, testés) | 164 |
| Écrans | 41 |
| Routes API | 51 |
| Tests automatisés (`npm test`) | 1 401, tous verts |

Ces tests ne couvrent pas que les fonctions : ils tiennent aussi ce qui ne se
voit pas à l'écran — les fuites de code confidentiel vers le navigateur, la
frontière entre gratuit et payant, l'unicité des sources de prix, la conformité
des scripts d'appel.

### 3.3 Le modèle d'accès

Ouvert : n'importe qui crée un compte et utilise gratuitement, sans limite de
durée, le CRM, l'assistant de terrain, la base de connaissance et les tableaux
de bord — **tout ce qui tourne sur ses propres données**. Le payant commence
quand la machine agit à sa place (envoi, appels, rédaction, traçage).

Cette frontière n'est pas un choix de prix : elle suit exactement la ligne du
coût d'infrastructure, ce qui la rend stable et explicable.

---

## 4. Traction — **[À REMPLIR — ZAKARIA]**

> ⚠ **Section décisive, et c'est la plus faible du dossier.** Ne rien inventer
> ici : une traction gonflée se vérifie au premier échange, et le dossier meurt
> avec la crédibilité de l'entreprise.

**Ce que le dépôt contient comme activité réelle** (juillet 2026, `lib/pipeline-juillet.ts`) :

| | |
|---|---|
| Prospects travaillés | 78 |
| Appels passés | 132 |
| Audits envoyés | 18 |
| SMS | 24 |
| Opportunités ouvertes | 7 |
| Rendez-vous obtenus | 6 |
| **Affaires gagnées** | **0** |
| **Chiffre d'affaires encaissé** | **0 €** |

**La lecture honnête, et elle est intéressante** : là où un audit écrit est
parti, le taux de passage monte ; là où il n'y a eu que des appels, il reste à
zéro. 26 appels en plomberie sans une seule pièce écrite n'ont rien produit.
C'est un **apprentissage mesuré**, et c'est ce qu'il faut présenter — pas une
courbe.

À compléter par toi :

- [ ] Chiffre d'affaires encaissé à ce jour (probablement 0 — le dire) ;
- [ ] Clients payants (probablement 0 — le dire) ;
- [ ] Lettres d'intention, engagements verbaux, partenariats signés ?
- [ ] Le partenariat de sous-traitance en cours a-t-il produit un devis ou un
      cadrage daté qu'on peut citer ?

---

## 5. Marché

### 5.1 Le marché adressable

**[À COMPLÉTER — chiffre à sourcer le jour du dépôt.]** Je ne dispose pas ici
d'une source primaire vérifiable sur le nombre de PME françaises disposant
d'une force de vente. **Ne pas citer un chiffre de mémoire** : un ordre de
grandeur faux dans un dossier public est un défaut qui se retient.

Source à utiliser : INSEE, démographie des entreprises — nombre de PME de 10 à
250 salariés dans les secteurs à force de vente terrain.

### 5.2 Les segments servis, et pourquoi chacun achète

Le produit ne s'adresse pas « aux PME ». Six segments, chacun avec sa douleur
propre (`lib/segments.ts`) :

| Segment | Ce qui fait mal |
|---|---|
| Équipe commerciale terrain (3 à 50 vendeurs) | L'écart entre le meilleur vendeur et les autres est énorme, et son savoir reste dans sa tête |
| Centre d'appels (5 à 200 postes) | Les équipes brûlent leur énergie sur des appels qui ne décrochent pas |
| Agence & services B2B (1 à 30 personnes) | Le closing dépend du fondateur : le chiffre plafonne à ses heures |
| Réseau / franchise (10 à 500 points) | Le discours se dilue en s'éloignant du siège |
| Commerce local (1 à 10 personnes) | Chaque appel manqué part chez le concurrent, sans qu'on le sache |
| Assurance en transformation (25 à 2 000 salariés) | Parcours fragmentés, frictions non chiffrables |

### 5.3 La concurrence

Les comparatifs relevés (`lib/marche.ts`) situent les agents vocaux du marché
entre **0,11 et 0,45 $/minute tout compris**, sources citées ligne par ligne et
marquées comme **secondaires** — elles datent et simplifient.

**La différence défendable n'est pas le prix**, c'est que les concurrents cités
sont des agents vocaux, quand Alpha Sales OS est la chaîne complète — ciblage,
audit, appel, relance, mémoire de la conversation, décision — avec la
conformité appliquée par le code.

### 5.4 Pourquoi maintenant

L'article 50 est applicable **depuis le 2 août 2026**. Tout produit vocal
conçu avant cette date doit être remis en conformité ; celui-ci est né avec la
contrainte dans son exécution. C'est une fenêtre, et elle est courte.

---

## 6. Équipe & gouvernance — **[À REMPLIR — ZAKARIA]**

- [ ] Qui compose l'équipe aujourd'hui, avec quel statut ;
- [ ] Ton parcours et pourquoi il légitime ce produit ;
- [ ] **Ce qui manque** — un dossier qui prétend n'avoir aucun manque n'est pas
      cru. Nommer le poste à recruter et à quelle étape.

---

## 7. Pièces à joindre — **[À REMPLIR — ZAKARIA]**

- [ ] Kbis de moins de 3 mois
- [ ] Statuts à jour
- [ ] Derniers comptes déposés (ou attestation si première année)
- [ ] RIB au nom de la société
- [ ] Attestations fiscale et sociale
- [ ] Pièce d'identité du dirigeant

> Piège classique : le Kbis périmé de trois jours. Un dossier incomplet est
> rejeté sans examen — la pièce manquante ne se rattrape pas après la date.

---

## 8. Résumé exécutif — à mettre en tête du dossier déposé

> EAGLEYE CORP développe **Alpha Sales OS**, un système d'exploitation
> commercial pour PME françaises : il trouve les prospects, les qualifie, les
> appelle, les relance et dit à l'humain quoi faire — en gardant la donnée et
> le modèle du côté de l'entreprise.
>
> **Trois choses le distinguent d'un logiciel de vente de plus.**
>
> **La souveraineté est architecturale, pas déclarative.** La chaîne d'IA
> commence par un modèle exécuté localement et retombe sur un moteur écrit à la
> main : le produit fonctionne sans qu'aucune donnée commerciale ne sorte du
> pays. Les briques qui captureraient la donnée métier — recherche
> documentaire, extraction de documents, format d'échange — sont écrites sans
> service tiers.
>
> **La conformité est une contrainte d'exécution.** La divulgation exigée par
> l'article 50 du règlement européen sur l'IA est prononcée par le code, hors du
> modèle, sans interruption possible ; un script non conforme empêche l'appel
> d'avoir lieu, et la vérification a lieu deux fois dans deux services qui ne se
> font pas confiance.
>
> **La mesure refuse de mentir.** Sans donnée, le système affiche l'absence de
> donnée plutôt qu'un zéro ; aucun taux n'est publié sans son dénominateur et
> son intervalle de confiance ; aucun poids de tri ne s'auto-corrige sur un
> échantillon trop petit.
>
> Le produit est en ligne et ouvert : le socle est gratuit et sans limite de
> durée, le payant commence quand le système agit à la place de l'utilisateur.
> **Nous sommes au stade pré-revenu** : la campagne de juillet 2026 a produit
> 6 rendez-vous sur 78 prospects travaillés, sans signature. Ce que nous
> demandons à French Tech 2030, c'est l'accompagnement qui transforme une
> technologie conforme et souveraine en clients français.

---

## 9. Ce qu'il reste à faire, dans l'ordre

| # | Lot | Qui | Durée honnête |
|---|---|---|---|
| 1 | Vérifier l'éligibilité et le seuil de CA | Zakaria | 1 h |
| 2 | Décider : déposer pré-revenu, ou pas cette année | Zakaria | 30 min |
| 3 | Sourcer le chiffre du marché (INSEE) | Zakaria | 30 min |
| 4 | Remplir traction, équipe, pièces | Zakaria | 4 h |
| 5 | Relecture à froid du dossier assemblé | Zakaria | 1 h |
| 6 | Dépôt | Zakaria | 1 h |

**Total réaliste : 8 heures.** Il en reste moins de trente avant la date.
