# TON PARCOURS, PAS À PAS — niveau débutant

> Tout ce qui est sur TOI, dans l'ordre, expliqué comme à quelqu'un qui n'a
> jamais touché à ça. Chaque étape dit : **où aller**, **quoi faire**, et
> **comment savoir que c'est bon**. Les détails techniques vivent dans les docs
> pointées — ici c'est la carte, pas le moteur.

Écrit le 29/09/2026. Hébergeur = **Netlify** (site `alphasalesos`).

---

## LA LIGNE D'ARRIVÉE

Un promoteur lyonnais reçoit un email d'Alpha (dans sa boîte, pas en spam),
répond « oui parlons-nous », Alpha propose un créneau, **tu closes**. Le reste
tourne seul. Tout ce qui suit sert UNIQUEMENT à ça.

---

## ✅ DÉJÀ FAIT — ne refais pas

Coché, vérifié, inutile d'y retoucher :
- Les 6 variables de comptes + `REQUIRE_AUTH=1` sur Netlify.
- `LOT-A-COLLER.sql` joué dans Supabase (les tables de base).
- SMTP posé (`contact@eagleyecorp.fr`) — **un vrai email est arrivé en boîte**.
- DKIM **activé** chez Amen (reste à confirmer l'alignement — étape 1).

---

## 🔴 ÉTAPE 1 — Confirmer la délivrabilité DNS (SPF · DKIM · DMARC)

**Pourquoi** : sans ça, tes emails tombent en spam et **la même boîte porte
aussi les mails d'inscription Supabase**. C'est LE blocage des ventes.

**Où** : ta boîte `contact@eagleyecorp.fr` + le DNS chez **Amen**.
**Quoi faire** :
1. Envoie-toi un email de test depuis Alpha (`/recette` → ton Gmail).
2. Ouvre l'email reçu → « afficher l'original / en-tête ».
3. Dans `DKIM-Signature`, relève **`s=`** (le sélecteur) et **`d=`** (le domaine).
4. Suis `docs/SMTP-SUPABASE-AMEN.md` §3 pour poser/vérifier SPF, DKIM, DMARC.

**Comment savoir que c'est bon** : `d=` doit valoir **`eagleyecorp.fr`** (pas
`securemail.pro`). Si c'est le cas, DKIM s'aligne. Colle-moi l'en-tête et je te
le confirme.

---

## 🔴 ÉTAPE 2 — Le domaine + l'URL publique

**Pourquoi** : aujourd'hui les liens de partage (LinkedIn) pointent vers
`.netlify.app`. Sur ton domaine, la carte de partage est propre.

**Où** : Netlify → Domain settings.
**Quoi faire** :
1. Branche `alphasalesos.eagleyecorp.fr` sur le site Netlify.
2. Puis Netlify → Environment variables → ajoute
   `APP_BASE_URL=https://alphasalesos.eagleyecorp.fr`.
3. **Redéploie** (Deploys → Trigger deploy).

**Comment savoir que c'est bon** : la page s'ouvre sur ton domaine, et partager
le lien montre une vignette.

---

## 🔴 ÉTAPE 3 — L'ordonnanceur : jouer les migrations pg_cron

**Pourquoi** : c'est ce qui fait tourner Alpha SANS ordinateur allumé — envoi,
tri des réponses, relances. Sans ça, rien n'est automatique.

**Où** : Supabase → SQL Editor.
**Quoi faire, dans l'ordre** (colle chaque fichier entier, clique **Run**) :
1. `supabase/migrations/004-ordonnanceur.sql` — **d'abord poser les 2 secrets
   Vault** (`alpha_base_url`, `alpha_cron_secret`). SQL Editor → Run une fois :
   ```sql
   select vault.create_secret('https://alphasalesos.netlify.app', 'alpha_base_url', 'Origine publique de l app, sans slash final');
   select vault.create_secret('<TON_SECRET>', 'alpha_cron_secret', 'Identique a CRON_SECRET sur Netlify');
   ```
   `<TON_SECRET>` = une valeur que TU génères (`openssl rand -hex 32`) — ne me la
   colle pas. ⚠ `alpha_base_url` = **`netlify.app`** tant que le domaine custom
   n'est pas branché (sinon le cron appelle un hôte mort ; passe-le à
   `alphasalesos.eagleyecorp.fr` une fois l'étape 2 faite). Puis colle 004 entier → Run.
2. Sur Netlify : ajoute `CRON_SECRET` = **exactement** la même valeur que le
   secret Vault `alpha_cron_secret`. Redéploie.
3. `014-autopilote-email.sql` → Run (planifie l'envoi à froid).
4. `016-boucles-reply-relance.sql` → Run (**NOUVEAU** — planifie l'auto-réponse
   et les relances ; sans lui, ces deux boucles ne tournent jamais).

**Comment savoir que c'est bon** : en bas de chaque fichier, il y a une requête
de contrôle en commentaire — décommente-la et Run. Tu dois voir les jobs
`alpha-mail-tick`, `alpha-reply-tick`, `alpha-relance-tick` **actifs**.

> ⚠ Poser ces crons ne fait partir AUCUN email tout seul tant que l'autopilote
> n'est pas armé (étape 5). C'est voulu.

---

## 🔴 ÉTAPE 4 — Charger le carburant (les fiches)

**Pourquoi** : le serveur n'a rien à traiter tant que le CRM vit dans ton
navigateur. Il faut que les fiches vivent côté serveur.

**Où** : dans l'app.
**Quoi faire** :
1. Réglages → active **`pipeServeur`** (le pipe passe sur le serveur).
2. Importe tes fiches promoteurs (le lot que je t'ai préparé, ou un CSV).

**Comment savoir que c'est bon** : `/moniteur` montre un nombre de fiches, pas
un tiret.

---

## 🟠 ÉTAPE 5 — Armer l'autopilote

**Pourquoi** : c'est l'interrupteur qui autorise les VRAIS envois. Rien ne part
sans ce geste — c'est ta protection.

**Où** : `/controle` dans l'app + Netlify.
**Quoi faire** :
1. Netlify → ajoute `CAMPAIGN_AUTOPILOT=on`. Redéploie.
2. Dans l'app `/controle` → clique le **bouton autopilote** (arme).

**Comment savoir que c'est bon** : le cockpit `/controle` affiche « Armé ».

---

## 🟠 ÉTAPE 6 — Autoriser l'auto-réponse (après DKIM)

**Pourquoi** : les réponses sûres (« oui, un RDV ») partent seules SEULEMENT si
tu attestes que DKIM est bon — le serveur ne peut pas le vérifier lui-même.

**Où** : Netlify.
**Quoi faire** : **une fois l'étape 1 confirmée** (`d=eagleyecorp.fr`), ajoute
`REPLY_AUTOSEND=on`. Redéploie.

**Comment savoir que c'est bon** : sans cette variable, les réponses se
préparent mais ne partent pas. Avec, et l'autopilote armé, elles partent.

---

## 🎯 ÉTAPE 7 — Le premier envoi (5 mails, pas plus)

**Où** : dans l'app.
**Quoi faire** : suis `docs/A-FAIRE-ZAKARIA.md` §« LE PREMIER ENVOI ». Le palier
te limite volontairement à 5 le premier jour — c'est ce qui protège le domaine.

**Comment savoir que c'est bon** : `docs/VERIFIER-QUE-CA-MARCHE.md` te dit quoi
regarder pour être SÛR que c'est parti.

---

## 🟢 OPTIONNEL A — Piloter Alpha via Cowork

Suis, dans l'ordre : `docs/COWORK-CONNEXION.md` (brancher) puis
`docs/OPERER-VIA-COWORK.md` (faire tourner). En résumé :
1. Crée **deux clés** dans `ALPHA_API_KEYS` (Netlify) : une « cerveau »
   (lecture + proposition), une « sourcing » (`prospects.write`). Génère les
   secrets toi-même (`openssl rand -hex 32`), ne me les colle jamais.
2. Ajoute Alpha comme **connecteur MCP** sur ton compte claude.ai.
3. Dis-le-moi → j'arme la Routine quotidienne.

---

## 🟢 OPTIONNEL B — Passer le classement des réponses en souverain (Laya)

Aujourd'hui, le tri des réponses tourne sur le LLM (ça marche, mais ça coûte des
jetons et ce n'est pas souverain). Pour basculer sur **Laya** (local, gratuit,
poids ouverts) : déploie le sidecar Laya (comme `voice/agent.py`) et pose
`LAYA_URL` sur Netlify. `diagnostic` (via Cowork) te dira quel moteur tourne.

---

## 🟢 OPTIONNEL C — L'agent vocal

Pour qu'Alpha Voice PARLE : lance `voice/agent.py` (chaque matin, en local chez
toi). Procédure : `docs/A-FAIRE-ZAKARIA.md` §« POUR QUE L'AGENT VOCAL PARLE ».

---

## L'ORDRE, EN UNE PHRASE

```
DNS (1) → domaine (2) → crons 004/014/016 + CRON_SECRET (3) → fiches (4)
→ armer (5) → REPLY_AUTOSEND (6) → 5 mails (7) → [Cowork, Laya, voix : après]
```

Ce qui reste TOUJOURS à toi, et c'est voulu : **approuver, armer, closer.**
Le reste, la machine le porte.
