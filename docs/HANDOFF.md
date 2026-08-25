# ALPHA SALES OS® — Passation (état des lieux & blueprint n8n)

> Pour le prochain thread. Lis ceci en premier. Le mythos, l'architecture, ce
> qui marche, ce qui manque, et **exactement** à quoi les workflows n8n doivent
> ressembler pour que tout coule entre le back (n8n + Sheets + Supabase) et le
> front (cette app).

---

## 0. Le mythos (pourquoi ça existe)

EAGLEYE fait de l'**outreach ultra-qualifié** pour des entreprises qui ont
besoin de clients et ne savent pas prospecter. Le MOAT n'est pas le logiciel —
c'est **la compréhension complète du cycle de vente** (20+ ans), encodée dans
la doctrine : *la décision EST le produit ; émotion d'abord (démo avant prix),
logique ensuite ; obstacles ≠ objections ; 3 Croyances à 10 ; chaque contact
finit par un next step daté ; la Taxe d'Ignorance chiffre l'inaction.* Le
business : **setup + 30 % du CA généré**, ou **setup + abonnement au volume**.

Trois couches, un seul organisme :

```
        ┌──────────────────────────────────────────────────────────┐
        │  FRONT — ALPHA SALES OS (cette app, Next.js)             │
        │  affiche · calcule · collecte · déclenche · human-in-loop │
        └───────────────▲───────────────────────────▲──────────────┘
                        │ webhook (thin client)      │ /api/* (durable)
        ┌───────────────┴───────────────┐   ┌────────┴───────────────┐
        │  CERVEAU — n8n (workflows)     │   │  MÉMOIRE DURABLE —      │
        │  read / write / send / inbound │◀─▶│  Supabase (service role)│
        └───────────────▲───────────────┘   └────────▲───────────────┘
                        │ Sheets API                  │ crm_records, tracking…
        ┌───────────────┴───────────────────────────────────────────┐
        │  MÉMOIRE SOURCE — Google Sheets (le CRM que l'humain voit) │
        └────────────────────────────────────────────────────────────┘
```

**Règle d'or de la donnée** : Google Sheets = ce que l'humain édite à la main.
Supabase = la copie durable/centralisée que l'app lit/écrit (partagée entre
instances). n8n = le pont bidirectionnel. **Info critique saisie dans l'app →
Supabase (`/api/crm/patch`) → n8n → Google Sheets.** Info éditée dans le Sheet →
n8n → Supabase → l'app la relit.

---

## 1. Ce qui MARCHE (inventaire, avec les fichiers)

**CRM « mémoire » (Google Sheets + Apps Script)** — `integrations/google-apps-script/`
- Schéma CRM (colonnes issues de la liste régies Lyon), **génération de scripts
  selon l'étape**, Web App `doGet/doPost` protégé par token :
  `list · get · script · upsert · history · stage · due`. Seed des ~32 régies.

**Backend n8n** — `integrations/n8n/`
- `alpha-dashboard-api.workflow.json` : le **webhook que l'app interroge**
  (`ping · list · event`).
- `alpha-crm-agent.workflow.json` : agent conversationnel (Claude + outils CRM).

**Connecteur front ↔ n8n** — `lib/n8n.ts`, `components/setup-wizard.tsx`
- Config webhook (localStorage), `callN8n / testN8n / syncFromN8n / notifyN8n`,
  mapping défensif `n8nRowsToProspects`, **assistant de config non-technique**.
- Nouveau : `prospectToRow` + `syncProspectToCrm` (front → Supabase + n8n → Sheets).

**Envoi** — `app/api/send/route.ts`, `lib/email-html.ts`, `lib/deliverability.ts`
- Emails **HTML soignés** (responsive, dark-aware, bouton bulletproof), multipart
  html+texte. Désinscription = **réponse STOP** (pied + List-Unsubscribe mailto),
  gérée par n8n (flag/suppression/refill). Lint anti-spam. Rate-limit **durable**
  (Supabase) + **dédup « déjà contacté »** durable (`CONTACT_COOLDOWN_DAYS`).

**Tracking** — `lib/tracking.ts`, `app/api/track/*`
- Pixel d'ouverture + redirection de clic (no open-redirect), `getStats`,
  `countRecentSends`, `contactedEmails`. Mémoire en dev, **Supabase durable** en
  prod (`tracking_messages`). Webhook sortant optionnel (`TRACKING_WEBHOOK_URL`).

**Relecture avant envoi (gate humain)** — `components/campaigns/campaign-review.tsx`
- Un brouillon par prospect ciblé, **aperçu HTML + lint**, édition, Approuver/
  Ignorer, **envoi bloqué tant qu'un message est « à valider »**. Pré-marque
  « déjà contacté ». Alerte variables `{…}` non remplies.

**Routines (human-in-the-loop)** — `lib/routines.ts`, `components/routines-panel.tsx`
- Dérive du réel les actions à faire : relance, next-step manquant, **info
  critique manquante**, relire, répondre (inbound), confirmer/débriefer RDV,
  closer, contrat, encaisser, livraison, satisfaction, témoignage, upsell.

**Client 360** — `lib/types.ts`, `app/prospects/[id]/page.tsx`
- Historique/timeline, audit, commercial (paiements, contrat, livraison),
  **Suivi & fidélisation** (canal, satisfaction, témoignage, upsell) — tout en
  CRUD. AI Coach (réponses suggérées). Fichiers. **Bouton « Synchroniser CRM »**.

**Infos critiques manquantes** — `lib/missing-info.ts` *(nouveau)*
- `criticalGaps(prospect)` → ce qu'il faut obtenir (coordonnée, décideur,
  chiffres Taxe d'Ignorance, offre, contrat). Surfacé en routine + bandeau fiche.

**Passthrough Supabase → Sheets** — `app/api/crm/patch/route.ts` *(nouveau)*
- Écrit l'info critique dans `crm_records` (Supabase, service role). n8n lit les
  lignes `synced_to_sheet = false` → écrit dans Sheets → repasse le flag.

**Funnel campagne** — `lib/campaign-funnel.ts`, `app/(app)/campaigns/page.tsx`
- Taux réels : délivré(nospam)/ouvert/réponse/follow-thru/follow-up/closed +
  **LTV + satisfaction**, dérivés du tracking × pipeline.

**Modèle & prix** — `lib/pricing.ts`, `app/(app)/offre/page.tsx` — calculateur de ROI.

**Thème** — clair/sombre sans flash (`lib/theme.ts`, tokens CSS).

**Sécurité** — `middleware.ts` (même-origine sur endpoints internes + rate-limit),
`next.config.ts` (HSTS/COOP/CORP/CSP…), `SECURITY.md`.

**Supabase** — `lib/supabase.ts` (liable au runtime OU env), `supabase/schema.sql`
(prospects, campaigns, meetings, activities, audit_log, inbound_events,
tracking_messages, **crm_records**), `/api/health` + panneau « État du système ».

**Ops** — `docs/RUNBOOK.md` (install + checkpoints 100 / 1 000 / 10 000 / 100 000).

---

## 2. Ce qui MANQUE / prochain (honnête)

1. **Infra d'envoi à l'échelle** (le vrai plafond) — domaines, IP, warmup, MTA/
   ESP, rotation d'inbox. Aucun code ne l'absorbe ; c'est de l'ops (RUNBOOK).
2. **« Délivré (nospam) » ≈ envoyé** — sans ESP/Google Postmaster on ne détecte
   ni bounce ni spam. Brancher Postmaster/feedback loops au checkpoint 10k.
3. **Attribution réponse/follow-thru** — actuellement **inférée** de l'avancement
   des prospects touchés. À affiner quand n8n écrit des events reply/stage
   par prospect (voir blueprint § inbound).
4. **Boucle Sheets → app complète** — l'app lit via `list` (pull) ; le write-back
   critique existe (`/api/crm/patch` + `syncProspectToCrm`) mais **le workflow
   n8n qui consomme `crm_records` et écrit Sheets reste à câbler** (§ 3.5).
5. **KPIs page** : rollup des funnels de toutes les campagnes (agrégé).
6. **Auth équipe** (Supabase magic link câblé mais léger), a11y, self-host fonts.

---

## 3. Blueprint n8n — à quoi les workflows doivent ressembler

Cinq workflows. Chacun a un rôle clair. **Objectif : demander à l'humain les
bonnes questions, afficher un max d'info lisible, et faire circuler la donnée.**

### 3.1 READ / SYNC (Sheets/Supabase → app)
`alpha-dashboard-api.workflow.json` — Webhook `POST { action }` :
- `ping` → `{ ok:true }`
- `list` → **toutes les lignes du CRM** `{ rows:[…] }`. Source = Google Sheets
  (ou Supabase `crm_records` si tu centralises). Clés attendues : `prospect,
  contact, email, phone, city, stage, rating, reviews, tax, website, audit,
  notes, channel, satisfaction, testimonial, upsell, delivery, meeting, history,
  obstacles, objections, closeDate, deadline`.
- `get { id }` → une ligne. `script { id }` → scripts par étape.
- **CORS** : Allowed Origins = l'URL de l'app.

### 3.2 WRITE (app → Sheets/Supabase)
Même webhook, actions d'écriture (l'app les appelle via `callN8n`) :
- `upsert { data }` → écrit/merge la ligne dans **Sheets ET Supabase**
  (`crm_records`). C'est ce que déclenche le bouton **« Synchroniser CRM »** et
  `syncProspectToCrm`. Merge par `prospect` (nom) ou `email`.
- `event { type, id, payload }` → journalise (`campaign.sent`, `stage`, `note`…)
  dans la colonne History + met à jour l'étape.
- `history { id, text }`, `stage { id, stage, action }` (déjà dans l'agent).

### 3.3 SEND / OUTREACH (le cœur — avec human-in-the-loop)
Trigger (Sheet updated / cron) → lire le prospect → **AI: Message a model**
(prompt = doctrine + données réelles du prospect + script de l'étape) → **Switch:
Action Router** → Email (draft) / Calendar (RDV) / relance → **Update Pipeline**.
- **Le gate humain vit dans l'app** : n8n produit le *draft*, l'app le fait
  **relire/approuver** (Campagnes → Réviser & envoyer) avant l'envoi réel.
- Prompting : un **prompt par étape** (prospect → contact → audit → demo → offre
  → redzone → signe → perdu), variables `{contact} {commerce} {ville} {note}
  {avis} {taxe} {closer}`. Loops : relances J+2/J+4 tant que pas de réponse et
  pas STOP. Jamais de prix par écrit avant la démo.

### 3.4 INBOUND / STOP (réponses → mémoire → refill)
Email reçu → parse → `POST {app}/api/webhooks/inbound` (header
`x-webhook-secret`) `{ type:"email.reply", email, name, campaignId, message }`.
- Si `message ≈ STOP` → **flag + supprime le prospect de la feuille + enfile un
  remplaçant** (ta règle). Sinon → l'app l'affiche dans « Réponses entrantes »,
  génère un brouillon de réponse IA (objectif : un créneau daté), et l'attache
  au prospect (event `email.reply` → sert aussi à l'attribution du funnel § 2.3).

### 3.5 CRITICAL-INFO PASSTHROUGH (app → Supabase → Sheets) ⭐ à câbler
Quand l'humain **doit fournir une info critique** (coordonnée, chiffres de la
Taxe, offre, contrat…), l'app la détecte (`criticalGaps`), l'affiche en routine
+ bandeau, l'utilisateur la saisit, puis **« Synchroniser CRM »** :
1. app → `POST /api/crm/patch` → **Supabase `crm_records`** (`synced_to_sheet=false`).
2. app → `callN8n('upsert', { data })` (écriture immédiate).
3. **Workflow n8n** : `integrations/n8n/alpha-crm-sync.workflow.json` — cron
   (2 min) → lit `crm_records` où `synced_to_sheet=false` → écrit/merge dans
   Google Sheets (clé `prospect`) → repasse `synced_to_sheet=true`. Idempotent.
> ✅ Livré. La boucle est fermée : il reste à **mapper tes credentials** à
> l'import (Supabase + Google Sheets).

**Les prompts de l'agent pour CHAQUE étape du cycle** (deep-dive audit → 1re
impression + PDF cadeau → découverte → awareness → objections → booking →
closing → satisfaction → témoignage → upsell), avec la carte des webhooks W1-W12
et les 10 checkpoints human-in-the-loop : **`integrations/n8n/PROMPTS.md`**.

**Le jeu de workflows complet est dans le repo** (voir `integrations/n8n/README`) :
`alpha-dashboard-api` (ping/list/**upsert**/event), `alpha-outreach` (Sheet→IA→
Switch→Gmail/Calendar→pipeline, mirroir de ton écran), `alpha-inbound`
(réponses & STOP), `alpha-crm-sync` (Supabase→Sheets), `alpha-crm-agent` (chat).
Toutes les colonnes = **`integrations/schema/crm-schema.json`** (63 variables,
visibles aussi dans l'app : Réglages → Dictionnaire CRM).

---

## 4. Contrats & endpoints (référence rapide)

| Front → | Endpoint / appel | Rôle |
|---|---|---|
| app → n8n | `POST {webhook} { action:list/get/script/upsert/event/history/stage }` | lecture + écriture CRM |
| app → app | `POST /api/send` | envoi email HTML + tracking + dédup/rate-limit |
| app → app | `POST /api/email/preview` | aperçu HTML + lint (relecture) |
| app → app | `GET /api/track/stats?campaignId=…` | funnel campagne |
| app → app | `GET /api/track/contacted?emails=…` | dédup « déjà contacté » |
| app → app | `POST /api/crm/patch { id, company, data }` | **info critique → Supabase** |
| provider → app | `POST /api/webhooks/inbound` (secret) | réponses + STOP |
| app → app | `GET /api/health` | ce qui est configuré (sans secrets) |

Endpoints **internes** (même-origine only, cf. `middleware.ts`) : send, ai,
agent, email/preview, track/stats, track/contacted, **crm/patch**.

---

## 5. Lancer, vérifier, gotchas (pour le prochain agent)

```bash
npm install && npm run build && npm start   # http://localhost:3000
npm run typecheck                            # doit être clean
```
- **Vérifier en conduisant l'app** (skill `verify`) : Chromium est à
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` ; scripts Playwright à
  lancer **depuis la racine du repo** (résolution `playwright-core`).
- **SMTP de test** : un sink SMTP local (voir historique) permet d'observer un
  vrai envoi ; l'assistant de config se ferme via « Explorer la démo ».
- **Gotcha shell** : un `pkill` en fin de commande fait sortir le shell en code
  144 et **avale la sortie** — mets le `pkill` dans une commande séparée, ou
  capture la sortie dans un fichier avant.
- **Artefact de test** : les labels en `uppercase` (CSS) cassent les
  `includes('Texte')` en Playwright `innerText` — matcher en MAJUSCULES ou lire
  le DOM/outerHTML.
- **Branche** : `claude/crm-n8n-email-tracking-4qxtwr`. Commits FR, verbeux.

---

## 6. La ligne directrice

Le back (n8n + Sheets + Supabase) porte la mémoire, les automatisations et les
prompts (scripts par étape, loops de relance). Le front (cette app) **affiche,
calcule, collecte, déclenche et orchestre le human-in-the-loop**. La donnée
circule dans les deux sens, l'info critique remonte jusqu'à la feuille. Tout est
fait pour que **scaler = ajouter du volume et des workflows**, pas réécrire.
« Chaque contact se termine par un next step daté. Sans exception. »
