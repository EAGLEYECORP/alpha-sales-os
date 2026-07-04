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
