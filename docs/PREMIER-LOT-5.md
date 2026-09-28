# ENVOYER LE PREMIER LOT DE 5 — le guide

> Objectif : sortir **5 emails à froid** vers des maîtres d'ouvrage, aujourd'hui,
> sans griller le domaine ni se mettre hors-la-loi. Cinq, pas plus : c'est le
> palier de la première semaine (`lib/email-ramp.ts`). Le but n'est pas le
> volume, c'est de **prouver que ça inboxe et que ça répond**.

Rédigé le 28/09/2026. Les fiches et les emails prêts ont été livrés en session
(`alpha-import-promoteurs.csv`, dossiers `.eml`). Ce guide ne nomme aucun
prospect : la donnée de tiers ne va pas dans le dépôt.

---

## 0. Avant d'envoyer le moindre mail — 3 vérifs

1. **DKIM aligné** : un mail reçu depuis `contact@eagleyecorp.fr` doit porter
   `DKIM-Signature` avec `d=eagleyecorp.fr` (Gmail → Afficher l'original).
   Sans alignement, les 5 partent en spam et tu as brûlé 5 fiches pour rien.
2. **L'envoi inboxe** : `/recette` → test vers une adresse à toi → il arrive en
   **boîte de réception** (pas spam). C'est la seule preuve qui compte.
3. **Tu es bien le compte maître** dans l'app (sinon tu ne verras pas l'outbox).

> ⚠ Si l'un des trois n'est pas vert, **n'envoie pas**. Un premier lot en spam
> abîme la réputation du domaine pour des semaines, et ça porte AUSSI tes devis
> et les mails d'inscription (même boîte).

---

## 1. Choisir les 5 — la qualité prime

Dans `alpha-import-promoteurs.csv`, prends **5 fiches, colonne `Lot = 1-décideurs`,
`Ville = Lyon`** (ou agglo lyonnaise).

- **Pourquoi Lyon d'abord** : à zéro vente, l'**ancrage local** est le seul
  argument vérifiable qu'on ait. « Je suis à Lyon, je travaille avec des
  promoteurs d'ici » se dit sans mentir.
- **Pourquoi des décideurs** : dirigeant / directeur commercial / directeur de
  programme — ceux qui décident d'un outil de vente, pas un stagiaire.
- **Une seule fiche par société** pour ce premier lot : cinq personnes de la
  même boîte le même jour, c'est du spam interne.

---

## 2. Le message — déjà écrit, ne le réinvente pas

Le corps est prêt (`construireMailCold`, `lib/mail-autopilote.ts`) : objet
« Vos acquéreurs déjà passés au bureau de vente », angle **acquéreurs refroidis**,
un seul objectif (le RDV), question fermée à deux créneaux, mention STOP.

**Ce que le message ne dit JAMAIS à froid** (interdits de la verticale
maîtrise d'ouvrage — `lib/playbook.ts`) :
- ❌ « vous ratez des appels » (faux ici, et ça prouve qu'on n'a pas compris le métier),
- ❌ citer un **permis**, une **adresse**, un **nombre de lots** (public, mais
  l'annoncer sonne fliqué),
- ❌ un **prix** (le prix vient après la démo, jamais dans le premier mail).

### ⚠ La seule chose à AJOUTER si tu envoies à la main

Si tu envoies les `.eml` depuis ton client mail (hors app), **le garde serveur
ne s'applique pas** : c'est toi qui portes la conformité. Ajoute **une phrase de
provenance** au premier message (obligation CNIL quand l'adresse vient d'un
tiers / d'une source publique), par exemple :

> « J'ai trouvé vos coordonnées professionnelles en ligne. Vous pouvez vous
> opposer à tout nouveau message en répondant STOP. »

Adapte à la vérité de la source. La mention STOP + la divulgation IA sont déjà
dans le gabarit ; **la provenance, non** — c'est le seul manque en envoi manuel.

> Envoi **via l'app** (`/outbox` après import du CSV) : là, `/api/send`
> **exige** la provenance au premier message et **refuse** sinon, ajoute STOP au
> rendu, et applique le palier tout seul. C'est la voie la plus sûre si l'infra
> est prête.

---

## 3. Envoyer — deux voies

### Voie A — par l'app (recommandée si le SMTP tourne)
1. Réglages → **Importer un CSV** → `alpha-import-promoteurs.csv`.
2. `/outbox` → sélectionne tes 5 fiches Lyon → envoie. Le serveur applique
   palier, mentions, provenance, tracking. Rien à surveiller à la main.

### Voie B — à la main (fallback)
1. Ouvre les 5 fichiers `.eml` correspondants (double-clic → brouillon
   pré-rempli, expéditeur `contact@eagleyecorp.fr`).
2. Ajoute la phrase de provenance (§2).
3. **Espace-les** sur la matinée (pas les 5 en une minute depuis un domaine
   neuf). Envoie.
4. **Note qui tu as contacté** (dans le CRM ou la fiche) : sinon la cadence de
   relance et le plafond légal ne peuvent pas se calculer.

---

## 4. Après l'envoi

- **Ne relance pas avant la cadence** : après un 1er contact sans réponse →
  3 rappels max sur des créneaux différents, **4 contacts au total sur 30 j**
  (décret 2022-1313). Le produit le tient tout seul ; à la main, compte-les.
- **Un « STOP » ou un refus → on retire tout de suite**, définitivement. C'est
  l'obligation, et c'est ce qui protège le domaine.
- **Une réponse intéressée → RDV**, et c'est là que TU prends la main (démo en
  direct + closing). Alpha prépare, il ne signe pas.

---

## 5. Ce qu'on mesure sur ce premier lot

Cinq mails, ce n'est pas une campagne — c'est un **test à trois questions** :
1. **Est-ce que ça inboxe ?** (regarde si des ouvertures remontent, ou demande à un contact test).
2. **Est-ce que ça répond ?** Même un « non » motivé vaut de l'or : il dit
   pourquoi l'angle ne prend pas.
3. **Le pitch tient-il ?** Un promoteur qui répond « je n'ai pas ce problème »
   ou « qui êtes-vous » t'apprend plus que ce guide.

Le premier client qui refuse **en disant pourquoi** vaut plus que 500 mails
envoyés dans le vide. Écoute ces 5 réponses avant d'ouvrir le robinet.

---

## 6. Quand passer à l'échelle

- Semaine 1 : 5/jour. Puis **+5 par semaine**, plafond **40/jour** pour une
  boîte (`lib/email-ramp.ts`). Ne force jamais ce palier : c'est lui qui rend
  tenable le fait de partager la boîte avec le transactionnel.
- Une fois DKIM confirmé + fiches synchronisées + un lot qui inboxe et répond :
  tu peux **armer l'autopilote** (`/controle`) et/ou brancher Cowork
  (`docs/COWORK-CONNEXION.md`) pour industrialiser — jamais avant.
