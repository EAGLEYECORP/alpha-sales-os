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

## Les tables service-role — désormais cloisonnées par locataire

Trois tables sont écrites/lues par la **clé service_role**, qui **contourne la
RLS** par conception :

- `tracking_messages` — ouvertures / clics des emails
- `inbound_events` — réponses entrantes
- `crm_records` — pont vers Google Sheets

Elles portent maintenant une colonne **`user_id`**, et les routes serveur
l'estampillent depuis le **JWT signé** du commercial (`lib/tenant.ts`) puis
**filtrent** leurs lectures dessus. Concrètement (prouvé par les tests du
chemin mémoire, `tests/tracking-tenant.test.ts`) :

- `/api/send` — le **rate-limit** et la **dédup « déjà contacté »** comptent
  par compte : un commercial n'épuise pas le quota d'un autre et ne bloque pas
  ses relances ; le message tracké est estampillé `user_id`.
- `/api/track/stats` — chaque commercial ne voit **que ses** ouvertures/clics.
  (Les endpoints `/api/track/open|click` restent anonymes — ils incrémentent
  une ligne précise déjà rattachée à son locataire, aucun filtrage requis.)
- `/api/crm/patch` — chaque enregistrement CRM porte le `user_id`.
- `/api/webhooks/inbound` — la lecture (GET) et l'acquittement (PATCH) par
  l'app sont scopés au compte connecté.

**En mode solo (sans compte), `user_id` reste `null`** → pool unique,
comportement d'origine inchangé. L'isolation s'active dès que les comptes sont
en place.

### La nuance honnête sur les webhooks ENTRANTS

Un webhook entrant (réponse d'un prospect) arrive d'un **fournisseur externe**
authentifié par un **secret partagé**, sans session. Impossible d'en déduire le
locataire tout seul. L'attribution est donc **déclarative** : chaque commercial
configure SON provider pour inclure SON identifiant —
`POST /api/webhooks/inbound?t=<user_id>` (ou `userId`/`tenant` dans le corps).
On valide la **forme UUID** ; sans identifiant valide, l'événement tombe dans le
pool non attribué (comme en solo) — on n'invente jamais un rattachement. Pour
un vrai multi-client, documente cet `?t=` dans la config provider de chaque
commercial.

### Ce qui reste (hors périmètre données)

`crm_records` est **relu par le n8n** de l'opérateur (via service_role) pour
pousser vers Google Sheets. En vrai multi-client mutualisé, ce n8n doit lui
aussi filtrer `user_id` — mais l'architecture n8n/Sheets est **par opérateur**,
donc à cadrer selon ton modèle (un n8n par client, ou un n8n central qui
filtre). La colonne `user_id` est là pour le permettre.
