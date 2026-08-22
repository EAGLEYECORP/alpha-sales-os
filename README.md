# ALPHA SALES OS® — EAGLEYE CORP

**L'OS de vente qui sort le savoir commercial de la tête des gens pour le mettre dans un système.**

Alpha Sales OS trouve les prospects, les audite, les appelle, les relance, tient
l'historique de chaque conversation et dit à l'humain quoi faire — pour lui,
maintenant. Next.js 15 · React 19 · TypeScript strict · **zéro dépendance
runtime** (crypto, CSV, PDF, RAG : tout est fait main).

> La décision EST le produit. Émotion d'abord (démo avant le prix), logique ensuite.

## À qui ça s'adresse

L'OS a démarré pour le commerce de proximité lyonnais. Ce n'est plus le marché.
Une fois les briques posées, il s'installe pour des **organisations** — et
chacune achète pour une raison différente. Catalogue complet dans
[`lib/segments.ts`](./lib/segments.ts).

| Segment | Ce qui fait mal | Brique d'entrée |
|---|---|---|
| **Équipe terrain** — toiture, isolation, photovoltaïque, porte-à-porte (3 à 50 commerciaux) | L'écart entre le meilleur vendeur et les autres est énorme, et son savoir reste dans sa tête | **Alpha Live** + CRM |
| **Centre d'appels** — plateaux, qualification, relation client (5 à 200 postes) | Les équipes brûlent leur énergie sur des appels qui ne décrochent pas | **Alpha Voice** |
| **Agence & services B2B** (1 à 30 personnes) | Le closing dépend du fondateur : le chiffre plafonne à ses heures | CRM + Campagnes + Cerveau |
| **Réseau, franchise, groupement** (10 à 500 points de vente) | Le discours se dilue en s'éloignant du siège | CRM + Alpha Live + Pilotage |
| **Commerce local** — garages, artisans, santé (1 à 10 personnes) | Chaque appel manqué part chez le concurrent, sans qu'on le sache | **Alpha Voice** (Callflow) |
| **Assurance en transformation** (25 à 2 000 salariés) | Parcours fragmentés, frictions non chiffrables | CRM + Cerveau + Pilotage |

Chaque segment porte ses **déclencheurs** (quand approcher), son **angle** (qui
nomme SA douleur, pas notre produit) et ses **disqualifiants** — dire non vite
vaut mieux que traîner un dossier qui ne signera pas.

## Doctrine encodée dans le logiciel

Ce n'est pas un CRM avec des citations Hormozi — les règles sont **exécutées** :

- **Obstacles ≠ Objections** : les obstacles vivent pré-offre (Oignon du Blâme : Circonstances → Les Autres → Soi), les objections n'existent qu'en **Red Zone** (post-offre) et pointent chacune une des 3 Croyances cassées.
- **Gate de signature** : impossible de glisser une carte en « Signé » si conviction < 10/10, démo mobile non faite avant le prix, croyances < 10 ou objections ouvertes. Le Kanban refuse et explique pourquoi.
- **Next step daté obligatoire** : le dashboard affiche les violations en rouge ; la timeline refuse un contact sans prochaine étape datée.
- **Taxe d'Ignorance** : chiffrée par prospect, cumulée dans le temps, injectée dans les scripts et les templates d'emails.
- **Confettis bronze** sur « Signé ». Évidemment.


## Trajectoire — 0 → 10 M€ et French Tech 2030

> Écran vivant : **`/trajectoire`**. Modules : `lib/paliers.ts` (blueprint),
> `lib/opportunites.ts` (argent hors client), `lib/voice-costs.ts` (coût usine).

### ⏱ French Tech 2030 — dépôt avant le **4 septembre 2026, 23h59** (heure de Paris)

3e promotion. Accompagnement 12 mois : optimisation du financement, mise en
relation stratégique, simplification administrative. Résultats annoncés en
octobre 2026. Domaines prioritaires : **IA**, quantique, cybersécurité, spatial,
robotique, électronique, infrastructures numériques, santé, énergie.

```
21 août ─────────────────────────────────────────────────► 4 sept.  ►  octobre
   │         │            │             │            │        │           │
   J-14      J-11         J-7           J-4          J-2     DÉPÔT     résultats
   │         │            │             │            │        │
   ▼         ▼            ▼             ▼            ▼        ▼
 Vérifier  Pitch de   Traction      Rédaction    Relecture  Dépôt
 le dépôt  SOUVE-     RÉELLE        du dossier   à froid    (incomplet
 encore    RAINETÉ    (clients,     (problème,   + pièces   = rejeté)
 ouvert    (où vivent  CA encaissé,  solution,   jointes
           les données, pipeline —   marché,
           quelle       jamais des   différen-
           dépendance   projections)  ciation)
           supprimée)
```

**Adéquation : plausible, pas gagnée d'avance.** L'IA est bien un domaine
prioritaire et l'argument de souveraineté est réel (zéro dépendance runtime,
données hébergeables en France, pile vocale auto-hébergeable). Mais le programme
vise plutôt la deep-tech de souveraineté que le logiciel de vente : le dossier
se défend sur *« l'automatisation commerciale ne doit pas dépendre d'acteurs
américains »*, **pas** sur la liste des fonctionnalités.

### Les 4 paliers — une seule contrainte à la fois

| Palier | La contrainte unique | Porte de sortie mesurable |
|---|---|---|
| **0 → 100 k€** | Trouver des clients qui **paient**, à la main | 10 paiements encaissés · un canal ≥ 30 % · CAC < 25 % du panier |
| **100 k → 1 M€** | Sortir la vente **de ta tête** | 3 deals fermés sans le fondateur · 50 % des RDV automatiques · MRR ≥ 20 % |
| **1 M → 3,5 M€** | Livrer sans se noyer | 80 % des livraisons sans toi · churn < 3 %/mois · satisfaction ≥ 80 |
| **3,5 M → 10 M€** | Croître **par les autres** | 50 % du CA via comptes/partenaires · 30 jours sans toi, chiffres à l'appui |

Chaque palier porte aussi son **« ce qu'on ne fait PAS encore »** — le piège
classique de l'étape (recruter trop tôt, refondre le produit, lever des fonds
pour masquer un problème de livraison).

### La barre du jour — ce qui se double vraiment

> **Doubler le chiffre d'affaires chaque jour est arithmétiquement impossible :
> 2³⁰ = 1 073 741 824.** Partir de 1 € et doubler quotidiennement donnerait un
> milliard en un mois. Vendre cette idée fait abandonner au jour 6, quand la
> courbe casse.

Ce qui se double, c'est le **levier** : le rendement d'une même heure de travail.
`/trajectoire` mesure quatre ratios chaque jour et **nomme le goulot** :

| Ratio | Seuil | Ce que ça dit |
|---|---|---|
| **% automatisé** | ≥ 40 % | En dessous, tu es la machine |
| **Taux de contact** | ≥ 10 % | En dessous, c'est le ciblage ou l'accroche |
| **Conversation → RDV** | ≥ 25 % | En dessous, c'est le script |
| **Touches/heure** | ≥ 10 | En dessous, la file est trop courte |

La réalité compensée : **+1 %/jour composé = ×37,8 en un an. +2 %/jour = ×1 377.**
C'est spectaculaire *et* tenable — contrairement au doublement quotidien.

## Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript strict |
| UI | Tailwind CSS, composants maison style shadcn, lucide-react, Bricolage Grotesque / Inter / JetBrains Mono |
| État | Zustand + persistance localStorage (local-first, zéro backend requis) |
| Data | TanStack Table (vue liste), Recharts (funnel, forecast MRR, secteurs) |
| IA (texte) | Endpoint compatible OpenAI (NVIDIA NIM / Groq / Ollama) avec **fallback moteur de templates hors-ligne** |
| **Alpha Voice** | LiveKit Agents (Python) · Deepgram STT · LLM compatible OpenAI · Fish Audio TTS · Silero VAD · SIP Telnyx |
| RAG | BM25 lexical fait main (`lib/knowledge.ts`) — pas de base vectorielle, pas de clé |
| Cloud (optionnel) | Supabase : auth lien magique, Postgres + RLS, Storage, Realtime |

## Structure du projet

`95 modules · 39 pages · 34 routes API · 55 composants · 469 tests`

```
alpha-sales-os/
├── app/
│   ├── page.tsx                 # Dashboard : KPIs, funnel, forecast, taxe cumulée
│   ├── vitrine/                 # ⭐ Page de VENTE publique (hors mot de passe)
│   ├── controle/                # ⭐ Salle de contrôle : appels en cours, file, blocages
│   ├── trajectoire/             # ⭐ Palier 0→10 M, barre du jour, opportunités
│   ├── pipeline/ · prospects/   # Kanban, fiche complète (master rappel, checkpoints)
│   ├── cerveau/                 # RAG lexical + import de fichiers (PDF/DOCX/HTML)
│   ├── voice/ · appels/         # Alpha Voice : scripts, conformité, sessions
│   ├── campaigns/ · outbox/     # Séquences, relecture avant envoi
│   └── api/
│       ├── v1/prospects         # ⭐ API publique (clé) — ingestion + triage
│       ├── campaign/tick        # ⭐ Autopilote (cron n8n, triple verrou)
│       ├── voice/{call,session} # Dispatch + journal de sessions/transcriptions
│       └── track/ · webhooks/   # Ouvertures, clics, réponses entrantes
├── lib/                         # Modules PURS et testés
│   ├── accounts · ladder        # Portefeuille white-label + l'ESCALIER de routage
│   ├── segments · icp           # ⭐ À qui on vend, et pourquoi
│   ├── deep-dive · import-triage# Audit à l'import, verdict d'un lot
│   ├── vital-signs · master-rappel · checkpoints
│   ├── argumentaire · lead-magnet · templates · playbook
│   ├── call-cadence · campaign-runner · campaign-tick · call-outcome
│   ├── call-log · file-extract  # Transcriptions ; PDF/DOCX sans dépendance
│   ├── bricks · pricing · voice-costs · paliers · opportunites
│   └── knowledge · store · types
├── voice/                       # Agent Python (LiveKit) + guides SIP
├── tests/                       # 51 fichiers, 469 tests (node:test)
└── docs/                        # Déploiement, API v1, autopilote, roadmap
```

### Les briques vendables

Chaque brique se vend seule (`lib/bricks.ts`) ; l'addition des huit dépasse
largement le pack — c'est l'ancrage.

| Brique | Installation | Mensuel |
|---|---|---|
| **Alpha Voice** — agent vocal entrant/sortant, 24/7 | 3 500 € | 364 € (1 000 appels) |
| **Campagnes & outreach** | 2 500 € | 290 € |
| **Le Cerveau (RAG)** | 2 500 € | 240 € |
| **CRM & Pipeline** | 2 000 € | 190 € |
| **Audits automatisés** | 1 800 € | 150 € |
| **Tracking & délivrabilité** | 1 500 € | 140 € |
| **Closer OS & Alpha Live** | 1 500 € | 140 € |
| **Salle de contrôle & KPIs** | 1 200 € | 120 € |
| **PACK COMPLET** | **10 000 €** | **1 000 €** |

Ou **30 % + frais d'installation** sur devis. **Cadrage obligatoire** avant
tout chiffrage. Alpha Voice sortant se paie au volume, sans engagement :
1 000 appels 364 € · 4 000 appels 1 092 € (le 4ᵉ millier offert).

### Ce que le système REFUSE de faire

La doctrine n'est pas dans des commentaires, elle est **exécutée** :

- **Article 50 (EU AI Act)** — la divulgation IA est prononcée par le code,
  non interruptible. `audit_script` refuse un script non conforme : l'appel
  n'a pas lieu.
- **Anti-harcèlement** — l'autopilote écrit la tentative **avant** d'appeler.
  Si l'écriture échoue, l'appel ne part pas. On préfère perdre un appel que
  d'en répéter un.
- **Dès qu'il répond**, Alpha Voice s'arrête et passe la main à l'humain.
- **Opposition** (« ne me rappelez plus ») → arrêt définitif, prioritaire sur
  tout le reste.
- **Jamais de prix avant la démo**, jamais de closing sur un signal vital au
  rouge, jamais de relance sur un prospect saturé.
- **Aucun chiffre inventé** : sans données, l'argumentaire dit « je ne vous
  annonce pas de chiffre » au lieu d'estimer.

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

## Offre & Tarifs

Les prix vivent dans `lib/bricks.ts` — **une seule source**. La vitrine, le
devis et le catalogue lisent le même fichier : impossible qu'ils divergent.
Voir la grille des briques plus haut.

**Le coût usine est chiffré** (`lib/voice-costs.ts`), tarifs fournisseurs
relevés en août 2026, chaque ligne portant sa source. À 1 000 appels/mois :
≈ 88 € de coût pour 364 € encaissés. Le poste dominant n'est pas la
téléphonie, c'est le **fixe** (57 €/mois) — d'où l'effet d'échelle : le premier
client porte tout, le dixième est quasi gratuit.

> ⚠ **NVIDIA NIM gratuit est interdit en production** (licence : développement,
> test, recherche et évaluation uniquement). Le modèle de coût retient donc un
> LLM payant — c'est le seul chiffrage honnête. Migrer coûte moins de 3 € pour
> 1 000 appels.

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

## Mode test / manuel (sans n8n)

La boucle complète se fait à la main — parfait pour tester le message avant
d'automatiser :

1. **Prospects** : import CSV / Google Sheets (Réglages) ou saisie manuelle
   (Pipeline → + Prospect).
2. **Scripts** : Templates → **Mes scripts** — écris tes propres emails/DM
   (variables `{prenom} {commerce} {taxe}…`), édite, supprime.
3. **Envoi** : sélectionne un prospect → variables remplies → bouton Email
   (HTML + tracking automatiques).
4. **Réponses** : elles arrivent par webhook (n8n) OU tu les **colles à la
   main** (Campagnes → Réponses entrantes → « Coller une réponse ») depuis ta
   boîte mail.
5. **Suggestion à chaque étape** : bouton « Réponse IA » sur chaque réponse
   (fonctionne même sans clé API — moteur doctrine hors-ligne), édite, envoie.
6. **Taux de réponse** : affiché en tête de l'inbox (répondants / contactés),
   ouvertures/clics dans Tracking et KPIs.

Quand le message convertit → branche l'agent conversationnel n8n
(`integrations/n8n/PROMPTS.md`) et la même boucle devient automatique, avec
les mêmes garde-fous de relecture.

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

📖 **[`docs/BIBLE.md`](./docs/BIBLE.md) — la Bible de la bonne utilisation.**
Le seul document à relire quand on ne sait plus quoi faire de sa journée :
les dix commandements, le premier mois dans l'ordre, la journée type, les
règles d'efficacité, **ce que l'OS ne fera jamais** (la part humaine, qui
ne se délègue pas), les sept péchés, et quand changer quelque chose.
**À lire en premier** — les guides ci-dessous traitent de l'installation et
de l'architecture, celui-là traite de l'usage.

**Guide pas à pas complet** (pour installer, vérifier chaque phase, et former
un employé à l'opérer) : [`docs/INSTALLATION.md`](./docs/INSTALLATION.md).
Faire tourner en continu et tenir le volume : [`docs/AUTOPILOTE.md`](./docs/AUTOPILOTE.md).
Capacités réelles et modèle de conversion : [`docs/CHIFFRES.md`](./docs/CHIFFRES.md).
Enrichir la méthode terrain : [`docs/TERRAIN.md`](./docs/TERRAIN.md).
Montée en volume : [`docs/RUNBOOK.md`](./docs/RUNBOOK.md).
Prospection multi-plateformes (email + LinkedIn + WhatsApp + SMS, quotas
anti-spam par canal) : [`docs/MULTICANAL.md`](./docs/MULTICANAL.md).
Contrat-type (setup + 30 % à vie, clauses anti-contournement & audit) :
[`docs/CONTRAT-PRESTATION.md`](./docs/CONTRAT-PRESTATION.md) — à faire valider
par un avocat.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
```

C'est tout. L'app démarre **sans aucune configuration** : données de démo lyonnaises, persistance localStorage, IA en mode templates Hormozi.

**Ou toute la pile (app + n8n + Ollama) en une commande** avec Docker :

```bash
docker compose up -d --build
docker compose exec ollama ollama pull qwen2.5:3b   # une fois — l'IA locale
```

Détails (credentials n8n, variables, mises à jour) :
[`docs/INSTALLATION.md`](./docs/INSTALLATION.md) § Docker.

### Activer l'IA (locale gratuite, ou Claude)

```bash
cp .env.example .env.local
# Option 1 — 100 % local, zéro coût (recommandé) :
#   ollama pull qwen2.5:3b
#   OLLAMA_MODEL=qwen2.5:3b        (OLLAMA_URL=http://localhost:11434 par défaut)
# Option 2 — cloud : ANTHROPIC_API_KEY=sk-ant-…  (Ollama prioritaire si les deux)
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
