# Backend n8n — agent conversationnel qui remplit le CRM

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
