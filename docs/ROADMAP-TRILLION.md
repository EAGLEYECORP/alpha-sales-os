# Plan d'exécution — de l'OS à la vente payante

> État vivant. `CLAUDE.md` porte la doctrine STABLE (comptes, tarifs, sécurité) ;
> ce fichier porte le PLAN et l'avancement. Coche ici, pas dans CLAUDE.md.
> Dernière révision : 2026-08-21.

## Le but, dit franchement
Zakaria a besoin de **ventes encaissées**, pas de features. Tout ce qui suit est
classé par « ça rapproche d'un virement bancaire » — pas par élégance technique.
Ce qui ne sert pas une vente dans les 30 jours passe en Phase 3+.

---

## Phase 0 — FAIT
- [x] Portefeuille de comptes (`lib/accounts.ts`) : EAGLEYE maître, ScintIA, Nuwacom.
- [x] Commission par offre + taille (Callflow 30 % + 10 % mensuel ; EAGLEYE 30 % ;
      Nuwacom 15 % > 40 k).
- [x] `routeAccount()` : Callflow → ScintIA · > 40 k → Nuwacom · reste → EAGLEYE.
- [x] Alpha Voice **entrant opérationnel** (Telnyx → LiveKit → agent).
- [x] LLM vocal sans latence (NVIDIA NIM `openai/gpt-oss-20b`).
- [x] `CLAUDE.md` — mémoire de session (arrête de brûler du contexte).

---

## Phase 1 — CE QUI FAIT ENTRER DE L'ARGENT (priorité absolue)

### 1.1 Site : vendre la LIBERTÉ avant le prix
Ordre imposé de la page : **liberté → qualification (est-ce qu'on matche ?) →
pourquoi ton cerveau doit acheter → prix**.
- [ ] Hero : la promesse de liberté (la machine tourne, tu vis), pas la feature.
- [ ] Bloc « on matche ? » AVANT le prix — auto-disqualification assumée.
- [ ] Argumentaire d'achat (valeur exponentielle du setup, volume, agents qui
      s'entraînent sur l'historique).
- [ ] Prix : **10 000 € VIP**, sinon **30 % + frais de setup** (local/cloud) sur
      devis, **cadrage obligatoire** (visio/appel/SMS, date + heure décidées,
      validation Zakaria).
- [ ] **Prix à la carte par brique** (ex. Alpha Voice seul).
- Skill à charger : `design-taste-frontend` (ou `impeccable` pour l'audit).

### 1.2 Cadrage obligatoire — le workflow, dans l'app
Bénéfique pour TOUS les comptes, pas seulement Alpha Sales OS.
- [ ] Objet « cadrage » : canal (visio/appel/SMS), **date + heure**, statut de
      réponse, ce qui s'est passé, données exploitables, **données manquantes**.
- [ ] Deep-dive audit rattaché → adapte script / canal / fréquence + **pourquoi**.
- [ ] Tracking des actions **des deux côtés** du deal.
- [ ] Validation Zakaria avant de passer à la suite (checkpoint humain).

### 1.3 Sortant par campagne + script personnalisé (le cœur de la conversion)
> Sans ciblage et script par prospect, tout le reste ne convertit pas. C'est la
> pièce la plus importante de la phase 1.
- [ ] **Deep-dive à l'import** : chaque prospect importé est audité → le script
      d'appel/mail découle de CE deep-dive, par compte et par offre.
- [ ] Campagnes d'appels sortants : gros volume, file, quotas, reprise.
- [ ] Tracking par appel + **historique de conversation** conservé et réinjecté.
- [ ] **Cadence Callflow (ScintIA)** : 5 rappels sur 2 jours après 1er appel sans
      réponse ; dès qu'il répond → Alpha Voice **arrête**, met à jour le pipeline,
      **passe la main au closer**.
- [ ] Vérifier que le sortant marche de bout en bout (côté Zakaria — je ne peux
      pas tester le live depuis la sandbox).

### 1.4 Salle de contrôle
- [ ] Vue unique de tous les process automatiques (campagnes, réponses en cours).
- [ ] Clic sur une tâche → détail, **intervention manuelle**, modification, reprise.

---

## Phase 2 — CE QUI COMPOSE (l'effet cumulatif)

### 2.1 Le Cerveau branché partout
- [ ] Cerveau **par compte** (ScintIA a son contexte, Nuwacom le sien).
- [ ] Semer ScintIA avec le pipeline de juillet (78 prospects, 132 appels,
      18 audits, 7 opportunités — `lib/pipeline-juillet.ts`).
- [ ] **Import de fichiers** : PDF (audits), `.html` (emails), docs, CSV → notes.
      Zéro dépendance : `DecompressionStream` natif suffit pour PDF/DOCX.
- [ ] Point d'import unique, réutilisé partout dans l'app (standard maison).

### 2.2 API Alpha Sales (les branchements clients)
- [ ] Endpoints d'ingestion : docs, images, sites, vidéos → Cerveau.
- [ ] Calendrier selon l'email (Teams / Google Meet).
- [ ] CRM externe (Notion, etc.).
- [ ] Auth par compte + périmètre (le client ne voit QUE sa brique).

### 2.3 Architecture d'orchestration IA
- [ ] Le bon prompt au bon moment, choisi par **statut de pipeline + KPIs**.
- [ ] Sous-agents par étape, routines/boucles, objectifs.
- [ ] Checkpoints humains explicites, visibles dans l'onboarding.
- [ ] KPIs qui pilotent les prompts, affichés dans la section KPI.

---

## Phase 3 — VISIBILITÉ & RECONNAISSANCE
- [ ] **French Tech — inscription avant le 4 septembre.** ⏳ *administratif, pas
      du code : c'est Zakaria qui dépose. Je peux préparer le dossier, pas le
      soumettre.*
- [ ] Vidéo de présentation (hero du site + réseaux, motion design).
- [ ] Onboarding vidéo.

---

## Limites — à dire net
1. **Je ne peux rien tester en live depuis la sandbox.** Telnyx, LiveKit, Vercel,
   Supabase, Stripe : le proxy bloque. Tout ce qui touche au live se vérifie chez
   Zakaria. Je ne dirai jamais « testé » pour un truc que je n'ai pas exécuté.
2. **Aucune automatisation ne closera à ta place aujourd'hui.** L'OS peut sourcer,
   qualifier, appeler, relancer, caler des RDV et préparer le closing. La signature
   et l'encaissement restent humains. Vendre l'inverse serait un mensonge.
3. **« Seedance »** : pas d'accès à cet outil ici. Le générateur vidéo réellement
   disponible dans cette session est **Higgsfield** (MCP). C'est ce que j'utiliserai
   si on fait la vidéo — sinon on écrit le script + storyboard et tu génères ailleurs.
4. **Le volume ne remplace pas le ciblage.** Juillet le prouve dans tes propres
   chiffres : 26 appels en plomberie sans une seule pièce écrite → 0 opportunité ;
   là où un audit est parti, le taux monte. D'où la priorité 1.3.
5. **Clés API** : celles collées en clair (NVIDIA, Fish) sont à **rotate**. Elles
   ne doivent jamais entrer dans le repo.

## Ordre d'exécution retenu
`1.3 (script/deep-dive) → 1.2 (cadrage) → 1.1 (site + prix) → 1.4 (salle de
contrôle) → 2.x → 3.x`

Raison : le script personnalisé conditionne la conversion de tout le reste. Le
site sans machine derrière ne fait que des visites ; la machine sans site convertit
déjà. On construit la machine, puis la vitrine.
