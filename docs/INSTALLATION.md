# INSTALLATION — pas à pas, pour former et employer

> Guide de formation. Objectif : une personne **non technique** installe tout
> l'OS en ~1h en suivant chaque étape, et sait ensuite l'opérer au quotidien.
> Chaque phase se termine par un **✅ Vérification** : ne passe à la suivante
> que si la vérification passe. En cas de blocage → § Dépannage en bas.

**Ce qu'on installe (4 briques) :**

| Brique | Rôle | Où ça tourne |
|---|---|---|
| **Google Sheets + Apps Script** | la mémoire (le CRM que l'humain voit) | Google |
| **n8n + 5 workflows** | le cerveau (lit, écrit, rédige, route) | ta machine (`localhost:5678`) |
| **ALPHA SALES OS (l'app)** | le tableau de bord (affiche, relit, envoie) | ta machine (`localhost:3000`) |
| **Supabase** *(recommandé)* | la mémoire durable (tracking, sync) | cloud (gratuit) |

---

## Phase 0 — Prérequis (10 min)

1. **Node.js 20+** : [nodejs.org](https://nodejs.org) → installe la version LTS.
   Vérifie dans un terminal : `node -v` → doit afficher `v20.x` ou plus.
2. **Un compte Google** (Sheets, Gmail, Calendar).
3. *(Optionnel mais recommandé)* un compte **Supabase** ([supabase.com](https://supabase.com), gratuit),
   **Ollama** installé ([ollama.com](https://ollama.com), gratuit — puis `ollama pull qwen2.5:3b`), et des identifiants **SMTP** (Gmail app-password, Brevo, OVH…).

✅ **Vérification** : `node -v` répond dans le terminal.

---

## Phase 1 — La mémoire : Google Sheets + Apps Script (10 min)

1. Crée un Google Sheets vierge. Nomme-le (ex. « CRM EAGLEYE »).
2. **Extensions → Apps Script**. Supprime le contenu, colle tout le fichier
   [`integrations/google-apps-script/Code.gs`](../integrations/google-apps-script/Code.gs). **Enregistre** (💾).
3. Recharge l'onglet du Sheets → un menu **🦅 ALPHA SALES OS** apparaît.
4. Menu 🦅 → **① Initialiser / réparer le CRM** (autorise le script à la 1re
   exécution : Autorisations → ton compte → Paramètres avancés → Accéder).
   → Les colonnes se créent (elles suivent
   [`integrations/schema/crm-schema.json`](../integrations/schema/crm-schema.json)).
5. *(Optionnel démo)* Menu 🦅 → **② Charger les régies Lyon**.
6. **Secret** : Apps Script → ⚙ Paramètres du projet → Propriétés du script →
   ajoute `API_TOKEN` = un secret long (garde-le, on l'appellera `TOKEN_SHEETS`).
7. **Déploie le Web App** : Déployer → Nouveau déploiement → ⚙ type
   **Application Web** → Exécuter en tant que **moi**, accès **Tout le monde**
   → Déployer. **Copie l'URL `…/exec`** (on l'appellera `URL_SHEETS`).
8. Note aussi l'**ID du Sheet** : dans l'URL du Sheets,
   `https://docs.google.com/spreadsheets/d/`**`CET_ID`**`/edit` (on l'appellera `SHEET_ID`).

✅ **Vérification** : dans un navigateur, ouvre
`URL_SHEETS?token=TOKEN_SHEETS&action=list` → tu vois du JSON avec tes lignes
(`{"ok":true,"rows":[…]}`).

---

## Phase 2 — Le cerveau : n8n local + les 5 workflows (20 min)

### 2.1 Lancer n8n

Dans un terminal :
```bash
export ALPHA_APP_URL="http://localhost:3000"
export ALPHA_WEBHOOK_SECRET="choisis-un-secret"     # le même ira dans l'app (Phase 3)
export ALPHA_CRM_URL="URL_SHEETS"                    # Phase 1.7
export ALPHA_CRM_TOKEN="TOKEN_SHEETS"                # Phase 1.6
npx n8n
```
Ouvre `http://localhost:5678` → crée ton compte propriétaire local.

### 2.2 Les credentials (une fois pour toutes)

n8n → **Credentials → Add credential** :
- **Google Sheets OAuth2** (suis l'assistant Google) — sert à 4 workflows.
- **Gmail OAuth2** — brouillons + trigger entrant.
- **Google Calendar OAuth2** — création de RDV.
- **Ollama** — base URL `http://localhost:11434` (avoir fait `ollama pull qwen2.5:3b` avant). C'est l'IA des scripts, 100 % locale et gratuite.
- *(Si Supabase, Phase 4)* **Supabase** — Host = URL du projet, clé **service_role**.

### 2.3 Importer les 5 workflows (dans cet ordre)

Pour chacun : **Workflows → ⋯ → Import from File** → choisis le fichier dans
[`integrations/n8n/`](../integrations/n8n/) → ouvre chaque nœud marqué et mappe :

| # | Fichier | À mapper | Puis |
|---|---|---|---|
| 1 | `alpha-dashboard-api.workflow.json` | nœuds Google Sheets : credential + `SHEET_ID` ; nœud **Webhook** : `Allowed Origins (CORS)` = `http://localhost:3000` | **Activer** (interrupteur en haut à droite) |
| 2 | `alpha-outreach.workflow.json` | Sheets trigger + Sheets update (`SHEET_ID`), **Ollama**, Gmail, Calendar | **Activer** |
| 3 | `alpha-inbound.workflow.json` | Gmail trigger, Sheets (`SHEET_ID`) — le POST vers l'app lit `ALPHA_APP_URL`/`ALPHA_WEBHOOK_SECRET` | **Activer** |
| 4 | `alpha-crm-sync.workflow.json` | Supabase (×2) + Sheets (`SHEET_ID`) — *saute-le si pas de Supabase pour l'instant* | **Activer** |
| 5 | `alpha-crm-agent.workflow.json` | **Ollama** — les outils lisent `ALPHA_CRM_URL`/`ALPHA_CRM_TOKEN` | **Activer** |

> ⚠ Piège n°1 : utiliser l'URL de **Test** du webhook. La bonne URL est celle de
> **Production** : `http://localhost:5678/webhook/alpha` (sans `-test`).
> ⚠ Piège n°2 : oublier d'**activer** le workflow (il doit être « Active »).

✅ **Vérification** : dans un terminal —
```bash
curl -X POST http://localhost:5678/webhook/alpha \
  -H "content-type: application/json" -d '{"action":"ping"}'
```
→ répond `{"ok":true,…}`. Puis avec `{"action":"list"}` → tes lignes du Sheet.

---

## Phase 3 — Le tableau de bord : ALPHA SALES OS (10 min)

1. Dans le dossier du projet :
   ```bash
   npm install
   cp .env.example .env.local
   ```
2. Ouvre `.env.local` et renseigne au minimum :
   - `WEBHOOK_SECRET=` **le même** que `ALPHA_WEBHOOK_SECRET` (Phase 2.1) ;
   - pour envoyer : `SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM`
     + `CLOSER_NAME=TonPrénom` ;
   - *(IA locale)* `OLLAMA_MODEL=qwen2.5:3b` (ou `ANTHROPIC_API_KEY=`) ; *(si Supabase, Phase 4)* les 3 clés Supabase.
3. Lance :
   ```bash
   npm run build && npm start     # → http://localhost:3000
   ```
4. **L'assistant s'ouvre** au premier lancement. Suis-le :
   Bienvenue → Préparer n8n (coche) → **Connecter** : colle
   `http://localhost:5678/webhook/alpha` → **Vérifier** : « Tester la
   connexion » doit dire **Connecté ✓** → **Importer** : « Importer mes
   prospects » → Prêt.
5. Va dans **Réglages → État du système** : les lignes essentielles doivent
   être vertes (SMTP si configuré, secret webhook…).

✅ **Vérification** : le **Pipeline** affiche les prospects de ton Sheet, et
Réglages → Connexion n8n affiche le badge **connecté**.

---

## Phase 4 — La mémoire durable : Supabase *(recommandé, 10 min)*

Sans Supabase, tout marche en mono-poste ; avec, le tracking, le rate-limit,
la dédup « déjà contacté » et la sync deviennent **durables et partagés**.

1. [supabase.com](https://supabase.com) → New project.
2. **SQL Editor** → colle tout [`supabase/schema.sql`](../supabase/schema.sql) → **Run**.
3. Project Settings → API : copie **URL**, **anon public**, **service_role**.
4. Dans `.env.local` de l'app :
   ```
   NEXT_PUBLIC_SUPABASE_URL=…
   NEXT_PUBLIC_SUPABASE_ANON_KEY=…
   SUPABASE_SERVICE_ROLE_KEY=…
   ```
   puis relance l'app (`npm start`).
5. Dans n8n : crée la credential **Supabase** (host + service_role) et mappe-la
   dans `alpha-crm-sync` → **Active** le workflow.

✅ **Vérification** : Réglages → État du système →
« Persistance : **Supabase (durable)** ». Sur une fiche prospect, clique
**Synchroniser CRM** → dans Supabase, Table editor → `crm_records` : une ligne
apparaît, et ≤ 2 min plus tard elle est dans le Google Sheets
(`synced_to_sheet` repasse à `true`).

---

## Phase 5 — Recette finale : la boucle complète (10 min)

Fais UN tour complet, comme au quotidien :

1. **Campagnes → Réviser & envoyer** sur une campagne → des brouillons
   apparaissent → ouvre un **Aperçu HTML** → **Approuve** un email de test
   (vers TA propre adresse) → **Envoyer**.
2. Ouvre l'email reçu : il est beau (bandeau EAGLEYE), le pied dit
   « Répondez STOP ». Clique un lien.
3. **KPIs** : le funnel global affiche 1 délivré / 1 ouvert / le clic.
4. Réponds « STOP » à l'email → dans le Sheet, la ligne passe
   `unsubscribed=true` (workflow inbound). Réponds autre chose depuis une autre
   adresse → elle apparaît dans **Campagnes → Réponses entrantes**.
5. **Dashboard → Routines** : la liste te dit quoi faire — c'est le poste de
   pilotage de l'employé.

✅ **Vérification** : les 5 points ci-dessus passés = l'OS est opérationnel.

---

## La journée type de l'opérateur (à enseigner)

1. **Matin — Dashboard → Routines** : traite du haut vers le bas
   (urgent → à faire). Chaque ligne est cliquable vers l'action.
2. **Réponses entrantes** (Campagnes) : répondre = UN objectif, un créneau daté.
3. **Réviser & envoyer** : relire CHAQUE message (c'est le métier — l'IA
   propose, l'humain dispose). Corriger les variables `{…}` signalées.
4. **Fiches** : après chaque contact, consigner (timeline) + next step daté
   — l'app refuse sans. Info critique manquante (bandeau rouge) → l'obtenir
   → **Synchroniser CRM**.
5. **Vendredi — KPIs** : la ligne dorée. Sous la cible → on revoit le
   *message*, pas le volume.

**Règles non négociables** (la doctrine fait le reste) : démo avant prix ·
jamais de prix par écrit avant la démo · chaque contact finit par un next step
daté · on ne force JAMAIS un envoi non relu.

---

## Dépannage

| Symptôme | Cause probable | Remède |
|---|---|---|
| « Tester la connexion » échoue | URL de Test au lieu de Production ; workflow pas activé ; CORS | URL `…/webhook/alpha`, activer, `Allowed Origins = http://localhost:3000` |
| L'app https ne joint pas n8n | contenu mixte (https → http bloqué) | ouvrir l'app en `http://localhost:3000`, ou tunnel https devant n8n |
| `action=list` vide | mauvais `SHEET_ID` / onglet ≠ `CRM` | vérifier le nœud Google Sheets |
| Envoi email 503 | SMTP non configuré | `SMTP_*` dans `.env.local`, relancer |
| Envoi 409 « déjà contacté » | dédup (14 j par défaut) | c'est voulu ; `force:true` ou `CONTACT_COOLDOWN_DAYS` |
| Envoi 429 | plafond `MAX_SENDS_PER_HOUR` | c'est voulu (réputation) ; ajuster si besoin |
| Réponses entrantes vides | secrets différents app/n8n | `WEBHOOK_SECRET` = `ALPHA_WEBHOOK_SECRET` |
| `crm_records` ne part pas vers Sheets | `alpha-crm-sync` pas actif / credential | activer + mapper Supabase & Sheets |
| Emails en spam | DNS | **SPF + DKIM + DMARC** sur le domaine d'envoi (voir RUNBOOK) |

**Pour aller plus loin** : montée en volume → [`RUNBOOK.md`](./RUNBOOK.md)
(checkpoints 100 → 100 000) · architecture & contrats → [`HANDOFF.md`](./HANDOFF.md)
· variables du CRM → [`../integrations/schema/`](../integrations/schema/).
