# Compte ScintIA — loger le pipe de juillet

> Décision : le pipeline réel de juillet 2026 (16 fiches Lyon —
> `lib/pipeline-juillet.ts`) appartient à **ScintIA / Callflow**, pas à
> EAGLEYE. On crée donc un **compte ScintIA** et on y met ce pipe. C'est le
> premier vrai test du multi-locataire : un compte revendeur, ses données à
> lui, isolées.

## Ce qu'est « le compte ScintIA »

- **Marque (`agencyName`)** : `ScintIA`.
- **Offre (`offer.whatYouSell`)** : « Callflow — accueil & relance IA au
  téléphone pour les commerces ». `offer.city` : `Lyon`.
- **Tarifs (`settings.pricing`)** : setup **990 €** (`CALLFLOW_SETUP`) + paliers
  Callflow (`CALLFLOW_PALIERS`, `lib/pipeline-juillet.ts`).
- **Données** : les 16 fiches de juillet (***NOM-RETIRE***, Vauban, ***NOM-RETIRE***, Brotteaux,
  ***NOM-RETIRE***, ***NOM-RETIRE***, ***NOM-RETIRE***, ***NOM-RETIRE***, ***NOM-RETIRE***…).

## Marche à suivre

### Option A — en solo/local (rapide, pour toi tout de suite)
L'app est local-first : « compte » = l'identité white-label du navigateur.
1. **Réglages → Agence** : `Nom d'agence` = **ScintIA**.
2. **Réglages → Mon offre** : ce que tu vends = **Callflow…**, ville = **Lyon**,
   proposition de valeur = « chaque appel manqué est un client perdu — on répond
   à votre place, 24/7 ».
3. **Réglages → Tarifs — mon offre** : setup **990 €** + tes paliers Callflow.
4. **Réglages → Données → « Charger mon pipeline juillet »** : les 16 fiches
   entrent, avec leurs RDV datés.
5. **Réglages → « Client parfait (ICP) » → Générer** : l'ICP se déduit
   automatiquement de l'offre Callflow (métiers au téléphone).

> Documents, ICP, prompts IA et voix parlent désormais au nom de **ScintIA** —
> c'est le white-label qui fait le travail.

### Option B — vrai compte isolé (multi-locataire Supabase)
Quand tu veux ScintIA comme **compte séparé** (isolation RLS, revente) :
1. Suis `docs/OUVRIR-UN-COMPTE-CLIENT.md` : crée le compte (Supabase →
   Invite user) avec l'email ScintIA.
2. Connecte-toi **avec ce compte**, refais les réglages white-label ci-dessus
   (marque/offre/tarifs ScintIA).
3. Charge le pipe juillet **sous ce compte** → ses 16 fiches vivent sous son
   `user_id`, invisibles des autres comptes (RLS).
4. **Avant de facturer** : le test d'isolation à deux comptes
   (`docs/PREUVE-RLS.md`).

## Pourquoi ça compte

- Ça **prouve le white-label sur un cas réel** : EAGLEYE et ScintIA cohabitent,
  chacun son offre, ses tarifs, ses données.
- Le pipe de juillet devient **le pipe de ScintIA** — propre, attribué, prêt à
  travailler (les RDV ***NOM-RETIRE*** 3/08, Vauban 3/08, ***NOM-RETIRE*** 5/08 sont déjà datés).
- C'est la répétition générale avant d'ouvrir des comptes à d'autres revendeurs.

---

## Faire valider les textes par ScintIA (`lib/validation-partenaire.ts`)

> Ajouté le 01/09/2026, après la demande de ScintIA : *ils ont peur pour leur
> script.* Ils ont raison — sur un appel Callflow, le prospect n'entend pas
> « Alpha Sales OS pour le compte de ScintIA », il entend **ScintIA**. Ce qui
> se dit là engage une réputation qui n'est pas la nôtre.

### Ce que ça règle, et que la conformité ne réglait pas

Le dépôt savait déjà refuser un script **non conforme** : `auditScript` exige
la divulgation de l'article 50, l'objectif unique, l'absence de prix, et sur
Callflow la garde de marque partenaire (`EXIGENCE_MARQUE_PARTENAIRE`).

Mais **la conformité n'est pas l'accord**. Un texte peut être parfaitement
licite et ne pas être celui que ScintIA a relu. C'est cet écart-là que ce
module ferme.

### La règle qui rend la validation utile

**Elle porte sur le texte EXACT, pas sur son nom.** Un tampon attaché à « la
trame d'appel » survivrait à sa propre réécriture : on fait relire, on modifie
le lendemain, et tout le monde continue de croire que le contrôle a eu lieu.
C'est pire que pas de validation.

On enregistre donc l'**empreinte** du texte validé. Dès qu'un caractère bouge,
l'état retombe à **`perimee`** — et `perimee` **refuse**.

| État | Ce que ça veut dire | L'appel part ? |
|---|---|---|
| `non-requise` | Compte maître : notre marque, notre risque | oui |
| `jamais` | Jamais soumis au partenaire | **non** |
| `validee` | Validé, et le texte n'a pas bougé | oui |
| `perimee` | Validé un jour, le texte a changé depuis | **non** |

### Ça mord pour de vrai

`POST /api/voice/call` rend **422** quand le compte est partenaire et que la
trame n'est pas validée. Ce n'est pas un bouton grisé dans l'interface : un
appel ne part pas.

> ⚠ L'empreinte porte sur la **trame**, pas sur le script assemblé. Celui-ci
> contient le nom du prospect : son empreinte changerait à chaque appel, le
> contrôle serait rouge en permanence, donc ignoré, donc retiré.

### Les mails et les SMS aussi

Même règle, même module. `POST /api/send` rend **422** quand le compte est
partenaire et que le gabarit n'est pas validé.

**On valide le CADRE, pas ses déclinaisons.** `buildTemplates` produit
cadres × industries : soumettre chaque déclinaison ferait des centaines de
textes quasi identiques, personne ne les lit, et un contrôle survolé ne
contrôle rien. Le partenaire relit **12 gabarits** (6 moments × email/DM),
variables non substituées — ça se lit en une réunion.

> ⚠ **La porte est ÉTROITE, et c'est délibéré.** Elle vise ce qui part *sans
> que personne relise* : un gabarit (`cadreId`) ou une campagne
> (`campaignId`). Un message écrit **à la main** dans la barre d'envoi n'est
> pas bloqué — celui qui l'écrit l'assume, et exiger une validation pour
> répondre à un prospect rendrait le contrôle insupportable, donc contourné,
> donc inutile.
>
> Une campagne **sans cadre déclaré** est refusée : on ne peut pas vérifier ce
> qui part en masse, et « on ne peut pas vérifier » ne vaut pas « c'est bon ».

Les scripts de format `appel` de la bibliothèque en sont exclus : ils sont lus
par un humain qui décroche lui-même. C'est la **trame Alpha Voice** qui est
validée pour la voix, pas ces fiches-là.

### Ce que la porte serveur couvre — et ce qu'elle ne couvre pas

Dit exactement, parce qu'une garde dont on surestime la portée est pire qu'une
garde absente.

| Chemin | Gardé par | Force |
|---|---|---|
| Appel Alpha Voice | `/api/voice/call` → **422** | Le serveur recalcule l'empreinte de la trame. Le client ne peut pas mentir sur le contenu. |
| Gabarit de la bibliothèque | `/api/send` → **422** | Idem : `lib/templates.ts` est partagé, le serveur connaît le texte. |
| **Campagne de l'opérateur** | Écran `campaign-review` | **Plus faible.** Les textes vivent dans le navigateur ; le serveur ne les a jamais vus et ne peut rien revérifier. |
| Message écrit à la main | rien | Volontaire : celui qui l'écrit l'assume. |
| Envoi de recette (test à soi-même) | rien | Volontaire : ce n'est pas un envoi commercial. |

> ⚠ Une première version refusait tout envoi portant un `campaignId` sans
> gabarit déclaré. Ça bloquait l'**envoi de recette** et la **newsletter** —
> deux usages légitimes — sans rien protéger de plus. Corrigé : la porte
> serveur ne garde que ce que le serveur peut vérifier.

### Les campagnes : c'est là que le volume part

Les cadres de la bibliothèque servent au **copier-coller** : l'opérateur les
recopie dans sa campagne, puis les modifie. Faire valider le modèle sans
valider l'étape qui en descend laisserait partir un texte que personne n'a
relu — celui-là même qui est envoyé mille fois.

Chaque **étape de campagne** est donc une cible de validation
(`campagne:<id>:<étape>`), sur **sujet + corps** : changer l'objet d'un email
change ce que le prospect voit en premier.

L'écran de relecture refuse de lancer et **nomme les étapes** qui bloquent —
« campagne bloquée » sans dire laquelle oblige à tout rouvrir, et on finit par
contourner.

### Comment on s'en sert, en face d'eux

**Réglages → Validation partenaire.** On choisit le compte (ScintIA, Nuwacom),
on leur fait lire le texte affiché — c'est celui qui partira, mot pour mot —
et on enregistre **qui** a validé.

> ⚠ Le nom est obligatoire, et c'est le seul détail qui rend tout le reste
> vérifiable. « ScintIA a validé » ne vaut rien le jour où un appel dérape ;
> « Karim, le 3 septembre, en visio » se vérifie en un message.

L'écran vit sur le **compte maître** : c'est toi qui es en face d'eux, sur ton
app. Ils n'ont pas d'accès, et `/api/prompts` est de toute façon réservée au
maître (les prompts récitent la grille tarifaire).

### Les limites, écrites

- L'empreinte est un hachage 32 bits (`empreinte`, `lib/apprentissage.ts`),
  **pas de la cryptographie**. Le modèle de menace n'est pas quelqu'un qui
  forgerait une collision : c'est nous qui oublions avoir modifié une phrase il
  y a trois semaines. Contre l'oubli, ça suffit largement.
- La porte serveur ne résiste pas à une requête qui forgerait l'empreinte.
  Assumé : le client qui appelle cette route, c'est l'opérateur lui-même.
- **Le compte maître n'est jamais concerné.** Un contrôle qui s'applique
  partout est un contrôle qu'on apprend à cliquer sans lire.
