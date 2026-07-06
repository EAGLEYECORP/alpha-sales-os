# Intégrations — CRM « mémoire », backend n8n, tracking

Cette couche relie trois briques autour d'ALPHA SALES OS :

```
   ┌─────────────────────────┐        ┌──────────────────────────┐
   │  Google Sheets = « CRM » │◀──────▶│  Apps Script (Web App)   │
   │  la MÉMOIRE du pipeline  │  API   │  schéma · scripts/étape  │
   └─────────────────────────┘        └───────────┬──────────────┘
             ▲   ▲                                 │ HTTPS + token
             │   │ import Sheets/CSV               │
             │   └──────────────┐        ┌─────────┴──────────────┐
   ┌─────────┴───────────┐      │        │  n8n (local)           │
   │  App Next.js         │      └───────▶│  agent conversationnel │
   │  ALPHA SALES OS      │  webhook      │  remplit le CRM        │
   │  · envoi HTML        │◀──────────────┤  à chaque étape        │
   │  · tracking clics    │  tracking →   └────────────────────────┘
   │  · anti-spam         │
   └─────────────────────┘
```

| Dossier | Rôle | Détails |
|---|---|---|
| [`google-apps-script/`](./google-apps-script) | Le **CRM** (mémoire) : schéma, génération de scripts selon l'étape, Web App pour n8n | [README](./google-apps-script/README.md) |
| [`n8n/`](./n8n) | Le **backend** : agent conversationnel qui lit & remplit le CRM | [README](./n8n/README.md) |

Le **tracking** (ouvertures/clics), la **délivrabilité** (anti-spam) et les
**beaux emails HTML** vivent dans l'app Next.js — voir le
[README racine](../README.md) § *Emails, tracking & délivrabilité*.

## La boucle complète

1. **n8n** enrichit le CRM Google Sheets (upsert, history, stage) via le Web
   App Apps Script — la mémoire se remplit à chaque étape.
2. L'**app** importe la feuille (Réglages → Import Google Sheets) et envoie
   des **emails HTML soignés**, trackés, sans finir dans les spams.
3. Chaque **ouverture / clic** est renvoyée (webhook `TRACKING_WEBHOOK_URL`)
   vers n8n, qui l'écrit dans le **History** du CRM.
4. L'**agent** voit tout au tour suivant : « qui a cliqué ? qui relancer ? ».
