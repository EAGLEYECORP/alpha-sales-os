# Backend n8n — le jeu de workflows complet

Huit workflows couvrent tout le cycle (5 opérationnels + sourcing + tracking + alerte). Les colonnes/variables sont définies une
seule fois dans [`../schema/crm-schema.json`](../schema/crm-schema.json), et
**tous les prompts de l'agent (étape par étape, avec webhooks et checkpoints
human-in-the-loop) sont dans [`PROMPTS.md`](./PROMPTS.md)**.

| Fichier | Rôle | Déclencheur |
|---|---|---|
| [`alpha-dashboard-api.workflow.json`](./alpha-dashboard-api.workflow.json) | **Webhook lu/écrit par l'app** : `ping · list · upsert · event` | Webhook (POST) |
| [`alpha-outreach.workflow.json`](./alpha-outreach.workflow.json) | **Outreach doctrine** : Sheet → IA (script par étape) → Switch → Gmail brouillon / Calendar / MAJ pipeline | Google Sheets (rowUpdate) |
| [`alpha-inbound.workflow.json`](./alpha-inbound.workflow.json) | **Réponses & STOP** : email entrant → STOP (marque désinscrit) ou → app `/api/webhooks/inbound` | Gmail Trigger |
| [`alpha-crm-sync.workflow.json`](./alpha-crm-sync.workflow.json) | **Info critique** : Supabase `crm_records` (non synchronisés) → Google Sheets → flag | Cron (2 min) |
| [`alpha-crm-agent.workflow.json`](./alpha-crm-agent.workflow.json) | Agent conversationnel (Claude + outils CRM) | Chat |
| [`alpha-sourcing.workflow.json`](./alpha-sourcing.workflow.json) | **Sourcing (refill)** : secteur + ville → Google Places → Pappers (SIREN) → Apollo (email dirigeant) → dédup → CRM | Formulaire n8n |
| [`alpha-tracking-sync.workflow.json`](./alpha-tracking-sync.workflow.json) | **Tracking → CRM** : Supabase `tracking_messages` → colonnes délivré/ouvertures/clics du Sheet (clé = email). Remplace `TRACKING_WEBHOOK_URL` quand n8n est local et le tracking sur Vercel | Cron (10 min) |
| [`alpha-error-alert.workflow.json`](./alpha-error-alert.workflow.json) | **Alerte erreur** : n'importe quel workflow ALPHA échoue → email d'alerte (nom, nœud, erreur, lien) | Error Trigger |

## Sourcing — remplir le haut du pipeline

Le refill après chaque STOP (et la croissance tout court) : le formulaire
n8n (`http://localhost:5678/form/alpha-sourcing` une fois le workflow
**activé**) demande **Secteur + Ville + Nombre**, puis :

1. **Google Places** trouve les entreprises (nom, note, nb d'avis, tél,
   site) — clé requise : `GOOGLE_PLACES_KEY`
   ([console.cloud.google.com](https://console.cloud.google.com) → activer
   *Places API (New)*).
2. **Pappers** ajoute le SIREN + forme juridique — `PAPPERS_TOKEN`
   ([pappers.fr/api](https://www.pappers.fr/api), gratuit jusqu'à un quota).
   *Optionnel : sans clé, l'étape passe.*
3. **Apollo** cherche l'email direct du dirigeant (owner/founder/C-suite) —
   `APOLLO_API_KEY` ([apollo.io](https://www.apollo.io), payant).
   *Optionnel : sans clé, le prospect arrive sans email direct (tu passeras
   par le formulaire de contact du site).*
4. **Dédup** contre le CRM existant (nom + email, insensible à la casse) —
   relancer le formulaire ne crée jamais de doublon.
5. Ajout dans le Sheet en étape `prospect`, avec `history` horodaté
   (`Sourcing auto — Maps+Pappers+Apollo (secteur)`).

Multi-secteurs par design : le champ **Secteur** devient la colonne `type`
du CRM — les stats par industrie de l'app s'alimentent toutes seules.

> À l'échelle : garde le rythme d'ajout aligné sur ta capacité d'envoi
> (`MAX_SENDS_PER_HOUR`) et vérifie les emails avant envoi (les bounces
> détruisent la réputation SMTP plus vite que les plaintes spam) — voir
> RUNBOOK checkpoint 1 000.

## Alerte erreur — jamais de panne silencieuse

Si `alpha-crm-sync` plante un vendredi soir, tu ne veux pas le découvrir
lundi. Le workflow d'alerte le transforme en email immédiat :

1. **Import from File** → `alpha-error-alert.workflow.json`, choisis ta
   credential Gmail, **Save** (pas besoin de l'activer — n8n déclenche les
   Error Workflows automatiquement).
2. Variable d'env au lancement de n8n :
   `export ALPHA_ALERT_EMAIL="ton@email.fr"`.
3. **À faire sur CHACUN des 5 autres workflows** : ouvre le workflow →
   menu `⋯` (en haut à droite) → **Settings** → **Error Workflow** →
   sélectionne « ALPHA SALES OS — Alerte erreur ». Sans cette étape, rien
   ne se déclenche.

Test : dans `alpha-crm-sync`, mets temporairement un mauvais Sheet ID,
exécute → tu dois recevoir l'email d'alerte en moins d'une minute.

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
- `ALPHA_ALERT_EMAIL` — pour `alpha-error-alert` (destinataire des alertes).
- `GOOGLE_PLACES_KEY` (requis), `PAPPERS_TOKEN`, `APOLLO_API_KEY` (optionnels)
  — pour `alpha-sourcing`.
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
