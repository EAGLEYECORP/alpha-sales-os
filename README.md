# ALPHA SALES OS® — EAGLEYE CORP

Système d'exploitation commercial **Hormozi-natif** pour agence lyonnaise (sites premium + overlays IA pour restaurants, pubs, ambulances, artisans). Monochrome bronze, encre & papier, dark only.

> La décision EST le produit. Émotion d'abord (démo mobile avant le prix), logique ensuite.

## Doctrine encodée dans le logiciel

Ce n'est pas un CRM avec des citations Hormozi — les règles sont **exécutées** :

- **Obstacles ≠ Objections** : les obstacles vivent pré-offre (Oignon du Blâme : Circonstances → Les Autres → Soi), les objections n'existent qu'en **Red Zone** (post-offre) et pointent chacune une des 3 Croyances cassées.
- **Gate de signature** : impossible de glisser une carte en « Signé » si conviction < 10/10, démo mobile non faite avant le prix, croyances < 10 ou objections ouvertes. Le Kanban refuse et explique pourquoi.
- **Next step daté obligatoire** : le dashboard affiche les violations en rouge ; la timeline refuse un contact sans prochaine étape datée.
- **Taxe d'Ignorance** : chiffrée par prospect, cumulée dans le temps, injectée dans les scripts et les templates d'emails.
- **Confettis bronze** sur « Signé ». Évidemment.

## Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript strict |
| UI | Tailwind CSS, composants maison style shadcn, lucide-react, Bricolage Grotesque / Inter / JetBrains Mono |
| État | Zustand + persistance localStorage (local-first, zéro backend requis) |
| Data | TanStack Table (vue liste), Recharts (funnel, forecast MRR, secteurs) |
| IA | Vercel AI SDK + `@ai-sdk/anthropic` (Claude `claude-opus-4-8`) avec **fallback moteur de templates Hormozi hors-ligne** |
| Cloud (optionnel) | Supabase : auth lien magique, Postgres + RLS, Storage, Realtime |

## Structure du projet

```
alpha-sales-os/
├── app/
│   ├── layout.tsx              # Shell global (sidebar + bottom nav mobile), fonts, PWA meta
│   ├── page.tsx                # Dashboard : KPIs, funnel, forecast MRR, heatmap Oignon, taxe cumulée
│   ├── pipeline/page.tsx       # Kanban drag-drop + vue liste TanStack + filtres + actions bulk
│   ├── prospects/[id]/page.tsx # Fiche : Doctrine (3C, obstacles, objections) / Timeline / AI Coach / Templates / Fichiers
│   ├── campaigns/page.tsx      # Séquences email/WhatsApp/appel + stats + générateur de lead magnet
│   ├── meetings/page.tsx       # RDV avec liens Cal.com, rappels, résultats
│   ├── nurture/page.tsx        # Séquences perdus-90j & referrals-signés
│   ├── intel/page.tsx          # Fiches concurrents avec « notre contre »
│   ├── activity/page.tsx       # Fil d'activité global + journal d'audit (mode équipe)
│   ├── settings/page.tsx       # Règles business (injectées IA), coffre à clés, export/import, sync Supabase
│   ├── login/page.tsx          # Lien magique Supabase (ou mode local)
│   └── api/ai/route.ts         # Claude via Vercel AI SDK, fallback templates
├── components/
│   ├── shell/app-shell.tsx     # Sidebar responsive + bottom nav
│   ├── pipeline/{kanban,prospect-form}.tsx
│   ├── charts.tsx              # Recharts, palette bronze séquentielle
│   └── ui/{modal,progress-ring,stage-badge,markdown}.tsx
├── lib/
│   ├── types.ts                # Modèle de domaine complet
│   ├── hormozi.ts              # Doctrine : étapes, bibliothèques obstacles/objections, gates, NBA, moteur fallback
│   ├── store.ts                # Zustand + persist + audit log
│   ├── seed.ts                 # Données de démo Lyon (7 prospects, campagnes, RDV, concurrents)
│   ├── supabase.ts             # Client optionnel + sync snapshot
│   └── utils.ts, confetti.ts
└── supabase/schema.sql         # Tables + RLS + storage + audit log
```

## Données réelles (pas de mock)

- **Tout vider** : Réglages → « Tout vider — mode données réelles » efface la démo.
- **Import Google Sheets** : colle un lien de partage (« tous ceux qui ont le lien ») ou de publication CSV — le serveur convertit et fusionne (matching par email/commerce, jamais de doublon). Import fichier CSV identique.
- **Colonnes reconnues** (FR/EN, accents ignorés) : commerce, nom, secteur, ville, téléphone, email, étape, abonnement, setup, taxe, **note Google, avis, appels ratés/sem, panier moyen, % conversion, site, réseaux, concurrence, process**, problèmes (séparés par `|`), notes. Bouton « Copier le modèle de colonnes » dans Réglages.
- **Deep audit par prospect** : onglet Audit & Offre → grille structurée (Google rating/avis, appels ratés, panier, conversion, site, réseaux, concurrence locale, process actuel) avec **calcul automatique de la Taxe d'Ignorance** (appels ratés × 4,33 × conversion × panier) applicable au deal en un clic.

## Webhooks — réponses entrantes

```
POST /api/webhooks/inbound
Header : x-webhook-secret: $WEBHOOK_SECRET
Body   : { "type": "email.reply", "email": "…", "name": "…", "campaignId": "…", "message": "…" }
```

Branche Instantly / Smartlead / Lemlist / Zapier / Make dessus. Les événements apparaissent dans **Campagnes → Réponses entrantes** : attache-les au prospect (timeline + stats campagne + trust), ou crée le prospect à la volée, et génère un **brouillon de réponse IA** (objectif unique : un créneau daté, jamais de prix par écrit avant la démo). Stockage : mémoire process en local, table `inbound_events` Supabase (clé `SUPABASE_SERVICE_ROLE_KEY`) en serverless.

## Envoi réel (open-source, zéro vendor lock-in)

- **Email** : [Nodemailer](https://github.com/nodemailer/nodemailer) (MIT) sur n'importe quel SMTP — `SMTP_HOST/PORT/USER/PASS/FROM` dans `.env.local` (Gmail app-password, OVH, Brevo, ton Postfix…).
- **SMS** : API compatible [Textbelt](https://github.com/typpo/textbelt) (open-source, auto-hébergeable) — `TEXTBELT_KEY` (+ `TEXTBELT_URL` si self-host).
- **WhatsApp** : lien `wa.me` pré-rempli — le message part de TON téléphone, dans TA conversation.

Boutons d'envoi partout où il y a un message : bibliothèque Templates (prospect sélectionné), onglet Templates d'une fiche, brouillons IA de l'inbox. Chaque envoi est consigné dans la timeline du prospect.

## KPIs — rollup global

La page **KPIs** ouvre sur le rollup (`components/kpis/rollup.tsx`) :
**funnel global** agrégé sur toutes les campagnes (délivré → ouvert → réponse →
follow-thru → closed, barres visuelles), **la ligne dorée** (réel vs cibles du
RUNBOOK avec statut vert/ambre/rouge + garde-fou petit échantillon),
**l'économie chiffrée** (CA généré an 1, notre part, MRR, LTV moyenne — le
no-brainer à dérouler en RDV) et le **comparatif par campagne** (où investir
l'effort, trié par LTV).

## Offre & Tarifs (modèle économique)

Page **Offre & Tarifs** (`app/offre`, `lib/pricing.ts`) : deux modèles calés
sur les standards du marché — **Performance** (setup + 30 % du CA généré,
incitations alignées) et **Abonnement** (setup + mensuel par paliers de
prospects : Starter / Growth / Scale / Enterprise). Un **calculateur de ROI**
interactif projette RDV → ventes → CA, compare le coût an 1 des deux modèles et
recommande le plus avantageux — à dérouler en RDV pour rendre la décision
chiffrée.

## Thème clair / sombre

Bascule clair/sombre (icône soleil/lune dans la sidebar et le header mobile),
persistée, appliquée avant le premier paint (aucun flash). Sombre = défaut
marque. Détails d'implémentation : jetons CSS dans `tailwind.config` +
`globals.css`, `lib/theme.ts`.

## Sécurité

Posture complète dans [`SECURITY.md`](./SECURITY.md) : middleware anti-CSRF
(même origine sur les endpoints internes) + rate-limit, en-têtes durcis (HSTS,
COOP/CORP, CSP…), lint anti-spam, désinscription STOP, RLS Supabase, checklist
opérateur (HTTPS, SPF/DKIM/DMARC, secrets).

## Relecture avant envoi (campagnes)

**Rien ne part tant que l'humain n'a pas validé.** Sur une campagne →
**Réviser & envoyer** : l'app génère un brouillon par prospect ciblé (premier
palier de la séquence, variables remplies avec ses vrais chiffres), puis
`components/campaigns/campaign-review.tsx` affiche chaque texte/email pour
relecture :

- **aperçu HTML fidèle** de chaque email (iframe) + **lint anti-spam** ;
- édition libre de l'objet / du corps ; alerte si des **variables `{…}` non
  remplies** subsistent ; les fiches sans coordonnée sont écartées ;
- **Approuver / Ignorer** par message ; **l'envoi est bloqué** tant qu'il reste
  un message « à valider » (garde-fou) ;
- « Envoyer les N emails approuvés » → passe par `/api/send` (HTML soigné +
  tracking + délivrabilité), consigne dans la timeline et notifie n8n
  (`campaign.sent`). Les DM WhatsApp approuvés s'ouvrent depuis ton téléphone.

## Emails, tracking & délivrabilité

**Que de beaux emails HTML.** Tout email part **rendu en HTML soigné**
(gabarit bronze EAGLEYE, table-based, responsive, lisible en clair sombre
comme clair, bouton « bulletproof » Outlook), **en multipart html + texte**.
Le corps texte des scripts est mis en forme automatiquement (`lib/email-html.ts`).
Aperçu avant envoi : `POST /api/email/preview` → `{ html, text, lint }`.

**Tracking (le « nombre de clics »).** Avant l'envoi, chaque email est
réécrit (`lib/tracking.ts`) :

- chaque lien passe par `GET /api/track/click/<id>?l=<n>` (compte le clic puis
  redirige vers l'URL d'origine — **aucun open-redirect**) ;
- un pixel 1×1 `GET /api/track/open/<id>` compte les ouvertures.

Stats : `GET /api/track/stats?prospectId=…` (ou `campaignId`, `messageId`) →
`{ messages, opens, clicks, openRate, clickRate, records }`. Stockage :
mémoire de process en local, table `tracking_messages` Supabase (clé
`SUPABASE_SERVICE_ROLE_KEY`) en serverless. Chaque ouverture/clic peut être
renvoyée à un webhook n8n (`TRACKING_WEBHOOK_URL`) pour alimenter le History
du CRM.

**Ne PAS finir dans les spams** (`lib/deliverability.ts`) :

- **Désinscription = réponse « STOP »** : le pied de chaque email invite à
  répondre STOP ; le webhook entrant remonte la réponse et **n8n** retire le
  prospect de la feuille puis en enfile un nouveau. L'en-tête
  `List-Unsubscribe: <mailto:…>` fait que le bouton natif Gmail/Apple envoie
  lui aussi un email STOP — même flux, zéro page à héberger.
- **Lint anti-spam** : mots déclencheurs, MAJUSCULES, prix dans l'objet, ratio
  texte/lien, alternative texte manquante… Score `risque` → envoi bloqué (422)
  sauf `force:true`.
- **Rate-limit anti-pic** : `MAX_SENDS_PER_HOUR` (défaut 40) — un volume
  régulier protège la réputation.
- **Infra DNS/SMTP** : configure **SPF + DKIM + DMARC** sur ton domaine
  d'envoi (voir `integrations/README.md`) — c'est 80 % de la délivrabilité.

## Tableau de bord branché sur n8n (assistant de configuration)

L'app peut fonctionner en **thin client** : la mémoire et les automatisations
vivent dans **n8n**, l'app **récupère** les données, fait les calculs et
affiche les métriques.

- **Assistant de configuration** (`components/setup-wizard.tsx`) — s'ouvre au
  premier lancement et se relance depuis **Réglages → Connexion n8n → Relancer
  l'assistant**. En 4 étapes en français simple (non-technique) : préparer n8n
  → coller l'URL du webhook → tester → importer ses prospects.
- **Connecteur** (`lib/n8n.ts`) — un seul webhook, contrat `POST { action }` :
  `ping` / `list` (→ prospects) / `event`. Le lien reste dans le navigateur ;
  le mapping des lignes est défensif (plusieurs alias de colonnes).
- **Webhook prêt à l'emploi** : [`integrations/n8n/alpha-dashboard-api.workflow.json`](./integrations/n8n).
- Les liens du navigateur vers ton n8n sont autorisés par la CSP
  (`connect-src` élargi aux domaines HTTPS + localhost). Pense à activer le
  **CORS** dans le nœud Webhook (`Allowed Origins = *`).

**Réglages → État du système** montre en un coup d'œil ce qui est configuré
(IA, SMTP, tracking, Supabase…) : une fois les identifiants en place, tout
passe au vert.

## CRM « mémoire » (Google Sheets) + backend n8n

Le CRM **est** un Google Sheets piloté par Apps Script ; le backend est un
**n8n local** dont l'agent conversationnel **remplit la mémoire à chaque
étape**. Tout est dans [`integrations/`](./integrations/README.md) :

- [`integrations/google-apps-script/`](./integrations/google-apps-script) — schéma CRM (colonnes de la liste régies Lyon), **génération de scripts selon le statut du prospect**, Web App `doGet/doPost` (token) pour n8n, seed des ~32 régies.
- [`integrations/n8n/`](./integrations/n8n) — workflow importable : agent Claude + outils `CRM_List/Get/Script/Upsert/History/Stage/Due`, mémoire de conversation.

La boucle : **n8n remplit le Sheets → l'app importe & envoie des emails HTML trackés → clics renvoyés dans le History → l'agent voit tout.**

## Training — Mode Closing & Sparring

- **▶ Mode Closing** (fiche prospect) : plein écran à dérouler PENDANT le rendez-vous. Script en 6 étapes construit avec les données réelles du deal (ses problèmes, sa taxe, son offre personnalisée), objections connues à un tap avec leur contre, écran de fin qui fait avancer le pipeline (Signé gaté par la doctrine + confettis / Red Zone / Perdu).
- **🥊 Sparring** : le prospect est joué par l'IA (méfiant mais juste — il s'adoucit si tu vends bien, durcit si tu pitches ou parles prix trop tôt). Un coach commente chaque réponse. Verdict : RDV décroché ou raté. Fonctionne aussi sans clé API (moteur local basé sur la doctrine).

## Agent conversationnel ALPHA

Page **Agent ALPHA** : chat en streaming branché sur l'état réel complet (deals, croyances, audits, RDV, campagnes, règles business). « Prépare ma journée », « quels deals sont en danger ? », rédaction de relances… Sans clé API, il répond quand même avec un briefing chiffré hors-ligne.

## Installer & former

**Guide pas à pas complet** (pour installer, vérifier chaque phase, et former
un employé à l'opérer) : [`docs/INSTALLATION.md`](./docs/INSTALLATION.md).
Montée en volume : [`docs/RUNBOOK.md`](./docs/RUNBOOK.md).

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
```

C'est tout. L'app démarre **sans aucune configuration** : données de démo lyonnaises, persistance localStorage, IA en mode templates Hormozi.

### Activer Claude (IA)

```bash
cp .env.example .env.local
# ANTHROPIC_API_KEY=sk-ant-…
npm run dev
```

L'onglet **AI Coach** passe automatiquement du moteur de templates à Claude (scripts terrain, notes d'audit, recadrage d'objections, résumés). Modèle par défaut : `claude-opus-4-8` (surchargeable via `AI_MODEL`).

### Activer Supabase (production)

1. Crée un projet sur [supabase.com](https://supabase.com).
2. SQL Editor → colle `supabase/schema.sql` → Run (tables + RLS + bucket attachments + audit log).
3. Authentication → Providers → Email → active **Magic Link**.
4. Renseigne dans `.env.local` :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
   ```
5. Connecte-toi via `/login`, puis Réglages → Supabase → **Pousser** pour envoyer ton état local. RLS isole chaque utilisateur ; Realtime activable table par table pour la synchro d'équipe.

## Déploiement (Vercel + Supabase)

```bash
npm i -g vercel
vercel            # lie le repo
```

Dans Vercel → Project → Settings → Environment Variables :

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | IA (server-only, jamais exposée au client) |
| `AI_MODEL` | optionnel, défaut `claude-opus-4-8` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sync + auth |

Puis `vercel --prod`. Le manifest PWA est servi ; l'app s'installe sur mobile (bottom nav dédiée).

## Vérifications

```bash
npm run typecheck   # TypeScript strict
npm run build       # build production Next.js
```

## Données

- **Export** : Réglages → JSON complet (prospects, campagnes, RDV, réglages) ou CSV prospects.
- **Import** : JSON au même format (le seed est un exemple valide).
- **Reset** : Réglages → « Reset seed » restaure la démo Lyon.

---

*« Chaque contact se termine par un next step daté. Sans exception. »*
