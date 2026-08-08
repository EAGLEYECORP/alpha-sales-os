# Prouver l'isolation multi-locataire (RLS)

> **Pourquoi ce document.** Le code des comptes est là (`lib/auth.ts`, `AuthGate`,
> RLS dans `supabase/schema.sql`). Mais **l'isolation se prouve, elle ne se
> suppose pas.** Tant que tu n'as pas fait tourner cette preuve contre ton vrai
> projet Supabase, **ne facture aucun client.** C'est la règle n°1 de
> `docs/SECURITE.md`.

Objectif : démontrer qu'un commercial (compte A) ne peut **jamais** lire,
modifier, supprimer, ni usurper les données d'un autre (compte B).

---

## En 5 minutes (preuve automatique)

### 1. Applique le schéma

Supabase → **SQL Editor** → colle tout `supabase/schema.sql` → **Run**.
(Idempotent : tu peux le relancer sans risque.)

### 2. Crée deux comptes de test

Le plus simple : Supabase → **Authentication → Users → Add user**, coche
**Auto Confirm User**, crée `testA@exemple.fr` et `testB@exemple.fr` avec des
mots de passe que tu notes. (Ou via l'écran de connexion de l'app, mais il faut
alors confirmer les emails.)

### 3. Lance la preuve

Depuis la racine du projet :

```bash
export SB_URL="https://xxxx.supabase.co"      # Project Settings → API
export SB_ANON_KEY="eyJ…"                      # clé anon public (PAS la service_role)
export A_EMAIL="testA@exemple.fr"  export A_PASS="…"
export B_EMAIL="testB@exemple.fr"  export B_PASS="…"

node supabase/verify-isolation.mjs
```

Le script utilise **uniquement la clé anon publique + les deux comptes** —
aucun secret n'entre dans le dépôt. Il crée une fiche au nom de A, puis essaie
9 attaques depuis B (lire, lister, modifier, supprimer, usurper), et vérifie
qu'aucune ne passe.

### 4. Lis le verdict

```
✓ ISOLATION PROUVÉE — aucun accès croisé. Tu peux facturer en confiance côté RLS.
```

→ Code de sortie **0**. Chaque ligne doit être **VERT**.

Si une ligne est **ROUGE** (code **1**) : **fuite détectée, ne facture pas.**
Vérifie que la RLS est bien activée (`schema.sql` appliqué en entier) et
relance.

---

## Ce que le script vérifie exactement

| # | Contrôle | Attendu |
|---|----------|---------|
| 1 | A crée sa fiche | ✓ autorisé |
| 2 | A relit sa fiche | ✓ (l'isolation ne casse pas l'usage normal) |
| 3 | B lit la fiche de A | **0 ligne** |
| 4 | B liste tout | la fiche de A **absente** |
| 5 | B modifie la fiche de A | **0 ligne touchée** |
| 6 | B supprime la fiche de A | **0 ligne** |
| 7 | B crée une fiche `user_id = A` (usurpation) | **refus RLS** |
| 8 | Fiche de A intacte après les attaques | ✓ inchangée |
| 9 | Idem sur `campaigns`, `meetings`, `activities` | B ne lit rien de A |

---

## Test manuel (bonus, pour le voir de tes yeux)

1. Lie Supabase (Réglages → Supabase), puis **Réglages → Sécurité → « Exiger un
   compte »**.
2. Navigateur 1 : connecte-toi en A, crée une fiche « ACME ».
3. Navigateur 2 (ou fenêtre privée) : connecte-toi en B. Tu ne dois **jamais**
   voir « ACME ». Crée « Globex ».
4. Reviens en A : tu vois « ACME », **pas** « Globex ».

---

## ⚠ Le trou connu — à combler AVANT la revente réelle

La RLS protège les tables que le navigateur touche directement
(`prospects`, `campaigns`, `meetings`, `activities`, `audit_log`, storage).
**C'est ce que cette preuve couvre, et c'est solide.**

Mais trois tables sont écrites/lues par la **clé service_role**, qui **contourne
la RLS** par conception, et **n'ont pas de colonne `user_id`** :

- `tracking_messages` — ouvertures / clics des emails
- `inbound_events` — réponses entrantes
- `crm_records` — pont vers Google Sheets

Aujourd'hui (usage **solo**), c'est sans effet : un seul locataire. Mais dès que
tu vends à plusieurs commerciaux, ces pools sont **partagés** : côté serveur,
le tracking de l'un pourrait être lu par un autre. Ce n'est pas une faille RLS
(aucun client ne peut les lire), c'est une **isolation applicative** à ajouter :

1. Ajouter `user_id uuid` (ou `org_id`) à ces trois tables + politiques RLS.
2. Scoper les routes serveur qui les utilisent — `/api/send`, `/api/track/*`,
   `/api/crm/patch`, `/api/webhooks/inbound` — par locataire (l'identifiant
   vient de la session, pas d'un paramètre client).

Tant que ce chantier n'est pas fait, **reste en mono-locataire** (toi seul) ou
**un projet Supabase par client**. La preuve ci-dessus reste la condition côté
données utilisateur ; celle-ci est la condition côté données serveur.
