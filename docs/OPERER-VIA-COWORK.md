# FAIRE TOURNER ALPHA AVEC COWORK — le manuel d'exploitation

> Tu as demandé comment **faire tourner** Alpha via Cowork, avec le maximum
> d'autonomie. `COWORK-CONNEXION.md` explique comment BRANCHER. Ce fichier
> explique comment OPÉRER : la boucle quotidienne, ce que l'agent fait tout
> seul, et ce qui reste sur toi — sans vernis.

Écrit le 29/09/2026.

---

## 0. LE MODÈLE MENTAL — deux moteurs, un point de rencontre

Alpha tourne sur **deux moteurs distincts** qui se rejoignent sur **les
propositions que tu approuves** :

| Moteur | Où | Ce qu'il fait seul |
|---|---|---|
| **Serveur** (`pg_cron`) | ton hébergeur, 24/7 | envoi à froid, relance, tri des réponses, prise de RDV — **gardé** (palier, mentions, art. 50) |
| **Cowork** (une Routine) | une session Claude qui se réveille chaque matin | source (GetLeads) → pousse au CRM → prépare la campagne → **te propose** |

Le serveur EXÉCUTE dans les règles. Cowork RÉFLÉCHIT et PROPOSE. Aucun des deux
ne close : **le closing reste à toi** (doctrine `lib/promesse.ts`).

> ⚠ Ce que Cowork ne remplace PAS : le serveur. C'est le `pg_cron` qui envoie
> les mails à froid, pas l'agent Cowork — l'agent n'a même pas le droit
> d'envoyer (voir §3). Cowork est le **cerveau du matin** ; le serveur est les
> **bras qui tournent la nuit**.

---

## 1. LA BOUCLE QUOTIDIENNE (ce que l'agent Cowork enchaîne)

1. **Sourcer** — via le connecteur GetLeads : décideurs de la maîtrise
   d'ouvrage sur Lyon/Villeurbanne (promoteurs, bailleurs, aménageurs).
2. **Pousser au CRM** — POST HTTP sur `/api/v1/prospects` avec la clé
   `prospects.write`. Depuis le 29/09, `sector:"promoteur"` (ou `MOA`,
   `bailleur`, `maîtrise d'ouvrage`…) tombe **enfin** sur la bonne verticale ;
   avant, il finissait dans « autre » et perdait son playbook.
3. **Lire le pipe + l'état d'exploitation** — outils MCP `etat_du_pipe` (qui est
   prêt, qui dort) et `diagnostic` (armé ?, palier du jour, réponses auto, quel
   moteur classe — Laya/Jev/LLM).
4. **Vérifier les propositions déjà déposées** — `lister_propositions` (pas de
   mémoire entre deux réveils : sans ça, il repropose ce que tu as rejeté).
5. **Préparer la campagne** — `preparer_campagne` : le texte EXACT de chaque
   mail, divulgation art. 50 comprise, **plafonné au palier du jour**.
6. **Proposer** — `proposer` : dépose ce qui mérite ta décision, en citant les
   FAITS de la fiche.
7. **Rapport** — une synthèse : combien sourcés, combien poussés, combien
   proposés, ce qui bloque.

Toi le matin : tu ouvres l'app, tu **approuves** ce qui tient, tu **armes**
l'autopilote si ce n'est pas fait. Le serveur envoie ensuite, dans les règles.

---

## 2. LE SETUP — DEUX clés, et c'est voulu

Les droits viennent de la **clé**, jamais de l'agent. La boucle a besoin de deux
rôles séparés, donc deux clés dans `ALPHA_API_KEYS` :

```
cowork-cerveau:operateur:etat.read|campagne.read|propositions.read|propositions.write:<SECRET_A>
cowork-sourcing:operateur:prospects.write:<SECRET_B>
```

- **`cowork-cerveau`** — la clé du **connecteur MCP** (§4 de `COWORK-CONNEXION.md`).
  Lecture + proposition. **Pas** de `prospects.write` : le MCP ne doit jamais
  écrire dans le CRM sans passer par la file de propositions que tu approuves.
- **`cowork-sourcing`** — `prospects.write` SEULE. Elle sert au **POST HTTP**
  d'ingestion (étape 2). C'est la seule porte par laquelle une fiche sourcée
  entre dans le pipe.

> ⚠⚠ **POURQUOI DEUX CLÉS ET PAS UN OUTIL MCP `pousser_prospects`.** Ce serait
> plus simple d'ajouter un outil au MCP. On ne le fait PAS, et c'est une
> décision de sécurité : le MCP est verrouillé « lecture + plan + proposition »
> (`tests/middleware-public` → `AUTORISES`), et un outil qui écrit dans le CRM
> alimenterait le seul chemin d'envoi automatique — une fiche à froid poussée
> serait cold-emailée par le serveur une fois l'autopilote armé, **sans que tu
> voies la fiche**. En séparant, l'ingestion garde sa propre clé, révocable
> seule, et le cerveau MCP garde sa garantie « il ne peut rien casser ».
> Si un jour tu veux l'outil MCP quand même, c'est un arbitrage à trancher —
> pas une ligne qu'une session pose en douce.

- **Génère chaque secret toi-même** (`openssl rand -hex 32`), ne me les colle
  jamais, ils vivent uniquement dans les variables d'environnement de
  l'hébergeur. Redéploie après édition.

---

## 3. CE QUI TE PROTÈGE PENDANT QUE ÇA TOURNE

- **L'agent Cowork n'envoie RIEN.** Le MCP refuse tout chemin d'action (testé).
  L'ingestion entre les fiches au stade `prospect` et **refuse** `stage`,
  `probability`, `payments` : un agent qui délire ne peut pas marquer une fiche
  « signée » ni déclencher un paiement.
- **Une collision d'identifiant entre deux locataires se REFUSE**, elle ne
  fusionne pas : l'agent ne peut pas récupérer le pipe de quelqu'un d'autre.
- **L'envoi réel reste gardé côté serveur** : palier du jour, mentions
  obligatoires, divulgation art. 50, plafond légal 4 contacts/30 j. `force` ne
  passe outre aucune de ces trois.
- **Rien ne s'envoie tant que l'autopilote n'est pas armé** par toi, et
  l'auto-réponse exige en plus ton attestation DKIM (`REPLY_AUTOSEND=on`).

Autrement dit : le pire qu'un agent Cowork emballé puisse faire, c'est **remplir
le pipe de mauvaises fiches** — récupérable, et le triage les signale. Il ne
peut ni envoyer, ni facturer, ni closer.

---

## 4. LA ROUTINE À ARMER (le prompt exact)

Une **Routine Cowork quotidienne** (fresh session à chaque réveil) porte ce
prompt. Elle a besoin de DEUX connecteurs sur ton compte : **GetLeads** et
**Alpha** (l'endpoint MCP `/api/mcp` ajouté en §4 de `COWORK-CONNEXION.md`).

```
Tu opères Alpha Sales OS pour EAGLEYE CORP (maîtrise d'ouvrage, Lyon/Villeurbanne).
Charge la skill alpha-vente si disponible. Enchaîne, sans jamais envoyer toi-même :

1. GetLeads : trouve 20 à 40 décideurs de la maîtrise d'ouvrage (promoteurs,
   bailleurs sociaux, aménageurs) sur Lyon et Villeurbanne, avec email pro.
2. Pousse-les dans Alpha : POST https://<ton-app>/api/v1/prospects
   (Authorization: Bearer <SECRET_B>), corps { "prospects": [ {company, name,
   email, city, sector:"promoteur", notes} ] }, par lots de 500 max. Lis le
   triage renvoyé.
3. Connecteur Alpha (MCP) : etat_du_pipe, diagnostic, puis lister_propositions.
4. preparer_campagne (sans max) : récupère le lot vérifié, plafonné au palier.
5. proposer : dépose une proposition par mail qui tient, en citant les FAITS
   de la fiche (jamais le permis ni l'adresse à froid — c'est interdit).
6. Rapport final : sourcés / poussés (dont exploitables) / proposés / ce qui
   bloque. Ne close jamais, ne relance pas manuellement.
```

- **Fréquence** : une fois par jour en semaine (le palier d'envoi est quotidien,
  sourcer plus vite ne sert à rien tant que le palier n'a pas grimpé).
- **Le secret dans le prompt** : `<SECRET_B>` est la clé `prospects.write`. Si tu
  ajoutes Alpha comme **connecteur MCP** pour l'ingestion aussi, le Bearer vit
  dans la config du connecteur (pas dans le prompt) — préférable. Tant que tu
  passes par un POST brut, le secret est dans le prompt de la Routine : traite-le
  comme tel (clé dédiée, portée `prospects.write` seule, révocable).

---

## 5. À LA DEMANDE (sans Routine)

Ouvre une session Cowork avec le connecteur Alpha et dis simplement :
« Prépare la campagne du jour et propose-moi les mails. » L'agent fait les
étapes 3→6. Le sourcing (1→2) se lance sur demande : « Source 30 promoteurs
lyonnais et pousse-les dans Alpha. »

---

## 6. CE QUE JE NE PEUX PAS FAIRE POUR TOI (honnête)

- **Ajouter le connecteur Alpha à ton compte claude.ai.** Ça se fait dans TES
  réglages de connecteurs — je ne peux pas l'injecter dans une session que je
  crée. C'est le seul geste manuel qui débloque la Routine.
- **Créer la Routine à ta place tant qu'Alpha n'est pas un connecteur** : je
  peux la créer une fois qu'Alpha figure dans tes connecteurs (je peux déjà y
  mettre GetLeads). Dis-le-moi et je l'arme avec le prompt ci-dessus.
- **Tester l'envoi réel** : SMTP/DKIM/LiveKit ne se testent pas depuis mon bac à
  sable. Ça se vérifie de ton côté, sur l'app en ligne.

---

## 7. L'ORDRE, SI TU PARS DE ZÉRO

```
1. Infra live (Supabase, SMTP, APP_BASE_URL)      → docs/A-FAIRE-ZAKARIA.md
2. Les DEUX clés dans ALPHA_API_KEYS + redéploie  → §2 ici
3. Alpha ajouté comme connecteur MCP dans Cowork  → COWORK-CONNEXION.md §3-4
4. GetLeads connecté sur ton compte               → déjà fait
5. Arme la Routine (ou demande-moi de l'armer)    → §4 ici
6. Chaque matin : approuve, arme, close           → c'est tout ce qui reste à toi
```
