# Backend n8n — le jeu de workflows complet

Cinq workflows couvrent tout le cycle. Les colonnes/variables sont définies une
seule fois dans [`../schema/crm-schema.json`](../schema/crm-schema.json).

| Fichier | Rôle | Déclencheur |
|---|---|---|
| [`alpha-dashboard-api.workflow.json`](./alpha-dashboard-api.workflow.json) | **Webhook lu/écrit par l'app** : `ping · list · upsert · event` | Webhook (POST) |
| [`alpha-outreach.workflow.json`](./alpha-outreach.workflow.json) | **Outreach doctrine** : Sheet → IA (script par étape) → Switch → Gmail brouillon / Calendar / MAJ pipeline | Google Sheets (rowUpdate) |
| [`alpha-inbound.workflow.json`](./alpha-inbound.workflow.json) | **Réponses & STOP** : email entrant → STOP (marque désinscrit) ou → app `/api/webhooks/inbound` | Gmail Trigger |
| [`alpha-crm-sync.workflow.json`](./alpha-crm-sync.workflow.json) | **Info critique** : Supabase `crm_records` (non synchronisés) → Google Sheets → flag | Cron (2 min) |
| [`alpha-crm-agent.workflow.json`](./alpha-crm-agent.workflow.json) | Agent conversationnel (Claude + outils CRM) | Chat |

## Le flux complet

```
                       ┌──────────────── alpha-outreach ───────────────┐
  Google Sheets ──────▶│ trigger → IA(script/étape) → Switch → Gmail    │──▶ brouillon
   (le CRM)            │  draft / Calendar RDV / MAJ pipeline            │      │
      ▲   ▲            └────────────────────────────────────────────────┘      ▼
      │   │                                                        RELU dans l'app
      │   │  alpha-dashboard-api (webhook)                         (Réviser & envoyer)
      │   └──── list ◀──── app (syncFromN8n)                              │
      │        upsert ◀─── app (Synchroniser CRM)                        envoi réel
      │                                                                    │
      │  alpha-crm-sync (cron)                                    tracking + STOP
      └── Supabase crm_records ◀── app /api/crm/patch                      │
                                                                    alpha-inbound
                                          email STOP ◀──────────────── (Gmail)
```

## n8n en local (http://localhost:5678)

Config typique quand n8n tourne sur ta machine :

- **URL du webhook (dans l'app)** : `http://localhost:5678/webhook/alpha`
  (l'URL de *Test* est `…/webhook-test/alpha` — n'utilise pas celle-là).
- **Lance l'app en local aussi** : `http://localhost:3000`. Un site servi en
  `https://` **ne peut pas** appeler `http://localhost` (contenu mixte bloqué
  par le navigateur). Deux options si l'app est déployée en https :
  1. exposer n8n en https via un tunnel (`cloudflared`, `ngrok`) et coller
     l'URL https ;
  2. régler `N8N_HOST`/`WEBHOOK_URL` de n8n derrière ce tunnel.
- **CORS** : sur chaque nœud *Webhook*, `Allowed Origins` = l'origine de l'app
  (`http://localhost:3000`, ou `*` pour démarrer). La CSP de l'app autorise déjà
  `http://localhost:*` + tout `https:`.
- **Variables d'env n8n** (au lancement) :
  ```bash
  export ALPHA_APP_URL="http://localhost:3000"        # pour alpha-inbound
  export ALPHA_WEBHOOK_SECRET="ton-WEBHOOK_SECRET"     # doit matcher l'app
  export ALPHA_CRM_URL="…/exec"  ALPHA_CRM_TOKEN="…"   # pour l'agent (Apps Script)
  npx n8n
  ```

## Variables d'environnement n8n

- `ALPHA_CRM_URL`, `ALPHA_CRM_TOKEN` — pour l'agent (Web App Apps Script).
- `ALPHA_APP_URL`, `ALPHA_WEBHOOK_SECRET` — pour `alpha-inbound` (POST vers l'app).
- Credentials : Google Sheets, Gmail, Google Calendar, Supabase, Anthropic.

> Tous les fichiers portent des `REMPLACE_MOI` (credentials) et
> `REMPLACE_PAR_TON_SHEET_ID` : mappe-les à l'import.

---

## Détail — API tableau de bord & agent

## API tableau de bord (le webhook de l'app)

L'app ALPHA SALES OS est un **tableau de bord** : la mémoire vit dans n8n.
Elle parle à **un seul webhook**, avec ce contrat (POST JSON) :

| `action` | Réponse attendue |
|---|---|
| `ping` | `{ "ok": true }` |
| `list` | les lignes du CRM : `{ "rows": [ … ] }` **ou** un tableau `[ … ]` |
| `event` | `{ "ok": true }` *(optionnel — l'app notifie les changements)* |

Chaque ligne peut utiliser les clés du CRM (`prospect, contact, email, phone,
city, rating, reviews, stage, tax, website, audit, notes…`) — l'app mappe
défensivement plusieurs alias. Le minimum utile : `prospect` (nom) + `stage`.

### Installer

1. n8n → **Import from File** → `alpha-dashboard-api.workflow.json`.
2. Nœud **CRM — lire les lignes** : choisis ta credential Google Sheets et
   ton `documentId` / `sheetName`.
3. Nœud **Webhook (App)** : `Allowed Origins (CORS)` = `*` (ou l'URL de ton
   app), puis **active** le workflow.
4. Copie l'**URL de Production** du webhook.
5. Dans l'app : l'**assistant de configuration** (premier lancement, ou
   Réglages → Connexion n8n → « Relancer l'assistant ») te fait coller cette
   URL, tester, puis importer.

> Sécurité : si tu ajoutes un mot de passe partagé, l'app l'envoie dans
> l'en-tête `x-alpha-secret` **et** dans le corps (`secret`) — vérifie-le au
> début du workflow.

---

# Agent conversationnel qui remplit le CRM

n8n (local, open-source, auto-hébergé) est le **backend** d'ALPHA SALES OS.
Un agent conversationnel y lit et **remplit la mémoire** (le Google Sheets)
à chaque étape du pipeline, via le Web App Apps Script.

```
Toi ──▶ Chat n8n ──▶ Agent ALPHA (Claude) ──┬─▶ CRM_List / CRM_Get / CRM_Due     (lecture)
                          │                  ├─▶ CRM_Script                       (scripts par étape)
                          │                  ├─▶ CRM_Upsert / CRM_History         (remplir la mémoire)
                          │                  └─▶ CRM_Stage                        (avancer + next step daté)
                          │
                   Mémoire conversation (20 tours)
```

## Prérequis

- **n8n** local : `npx n8n` ou `docker run -it --rm -p 5678:5678 docker.n8n.io/n8nio/n8n`
- Le **Web App Apps Script** déployé (voir `../google-apps-script/README.md`)
- Une **credential Anthropic** dans n8n (Settings → Credentials → Anthropic API)

## Configuration (variables d'environnement n8n)

Les outils lisent l'URL et le token du CRM depuis l'environnement n8n — rien
à coder en dur. Au lancement :

```bash
export ALPHA_CRM_URL="https://script.google.com/macros/s/AKfycb…/exec"
export ALPHA_CRM_TOKEN="ton-secret-API_TOKEN"
npx n8n
```

> Docker : ajoute `-e ALPHA_CRM_URL=… -e ALPHA_CRM_TOKEN=…`.
> n8n n'expose `$env` aux expressions que si la variable est présente au
> démarrage (ou configure `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` selon ta
> version).

## Import du workflow

1. n8n → **Workflows → Import from File** → `alpha-crm-agent.workflow.json`.
2. Ouvre le nœud **Claude (Anthropic)** → sélectionne ta credential Anthropic
   (le champ `id: REMPLACE_MOI` sera remplacé par ta sélection).
3. **Save**, puis **Open Chat** (bouton du nœud *Chat — Agent ALPHA*).

Essaie :
- « Prépare ma journée : qui relancer ? » → l'agent appelle `CRM_Due`.
- « Rédige le premier contact pour Régie Pariset » → `CRM_Script` puis rédige.
- « J'ai eu Pariset au téléphone, RDV audit mardi 15h » → `CRM_Stage` +
  `CRM_History` (la mémoire se remplit).

## Boucle de relance automatique (optionnel)

Pour un rappel quotidien des next steps en retard, crée un petit workflow :

1. **Schedule Trigger** (tous les jours 8h).
2. **HTTP Request** GET `={{ $env.ALPHA_CRM_URL }}?token={{ $env.ALPHA_CRM_TOKEN }}&action=due`.
3. **IF** `rows` non vide → notifie (Slack / Email / Telegram) la liste des
   prospects à relancer.

## Boucle de tracking (email → CRM)

L'app Next.js expose un webhook d'événements entrants. Branche n8n dessus
pour écrire les ouvertures/clics dans le History du CRM :

1. **Webhook** n8n (ex. `/webhook/alpha-track`).
2. Depuis l'app, configure `TRACKING_WEBHOOK_URL` vers ce webhook (voir
   `../../README.md` § tracking) — chaque ouverture/clic est postée.
3. **HTTP Request** POST vers `ALPHA_CRM_URL` :
   `{ "token":"…", "action":"history", "id":"{{ $json.email }}",
      "text":"Email ouvert ({{ $json.opens }}×), {{ $json.clicks }} clic(s)" }`.

Ainsi la boucle est complète : **envoi → tracking → History du CRM → l'agent
voit tout au prochain tour.**

## Sécurité

- Le `ALPHA_CRM_TOKEN` protège le Web App : ne le commit jamais.
- Garde n8n derrière ton réseau local / un tunnel authentifié.
- L'agent n'a QUE les outils listés — il ne peut pas sortir du CRM.
