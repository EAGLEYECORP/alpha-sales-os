# ALPHA SALES OS® — Runbook de LANCEMENT (machine locale)

> **Pour le thread Claude Code local** ouvert dans
> `/home/neo4tony/Desktop/EAGLEYE CORP/alpha-sales-os/`.
> Objectif : passer LIVE. Ce fichier dit COMMENT (machine, env, process).
> Pour savoir QUOI faire et dans quel ordre — ce qui bloque réellement le
> lancement — voir `docs/CHECKLIST-LANCEMENT.md`.
> Lis ensuite `docs/HANDOFF.md`
> (architecture) et `docs/INSTALLATION.md` (détail pas-à-pas) si besoin.
> Machine cible : MacBook Air 2014 sous Linux Mint — n8n local, app locale,
> Vercel = réceptionniste publique (`https://alphasalesos.vercel.app`).

---

## 0. Règles d'or (à ne jamais casser)

- **Branche de travail : `claude/crm-n8n-email-tracking-4qxtwr`** — tout est
  dessus (emails DA calme, PWA, gate, Closer OS). Ne pas revenir sur `main`.
- **Les secrets ne quittent jamais cette machine** : ils vivent dans
  `.env.local` (gitignoré). Rien de sensible n'est commité, jamais.
- **Rien ne part sans revue humaine** ; l'IA ne marque jamais « signé »
  (portes H1–H10, voir `integrations/n8n/PROMPTS.md`).
- Le chemin contient un espace (`EAGLEYE CORP`) → **toujours citer les
  chemins** dans le terminal : `cd "/home/neo4tony/Desktop/EAGLEYE CORP/alpha-sales-os"`.

---

## 1. Mettre le code à jour

```bash
cd "/home/neo4tony/Desktop/EAGLEYE CORP/alpha-sales-os"
git fetch origin claude/crm-n8n-email-tracking-4qxtwr
git checkout claude/crm-n8n-email-tracking-4qxtwr
git pull origin claude/crm-n8n-email-tracking-4qxtwr
npm install          # seulement si package.json a changé depuis le dernier pull
node -v              # doit être ≥ 18.18 (Next 15)
```

> Le repo est privé : le pull demandera tes identifiants GitHub (token) si la
> machine ne les a pas en cache. Tes réglages locaux (localStorage, .env.local)
> ne sont PAS touchés par un pull.

---

## 2. `.env.local` — le gabarit complet

Créer/vérifier `.env.local` à la racine (copie de travail de `.env.example`).
**Remplace chaque `⟨…⟩` par ta vraie valeur** — où la trouver est indiqué.

```bash
# ── ENVOI EMAIL (obligatoire pour lancer) ────────────────────────────
# Gmail : compte → Sécurité → validation en 2 étapes → « Mots de passe
# d'application » → génère un mot de passe pour "Mail". (Ou OVH/Brevo…)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=eagleyecorp.ad@gmail.com
SMTP_PASS=⟨mot-de-passe-application-16-lettres⟩
SMTP_FROM="EAGLEYE CORP <eagleyecorp.ad@gmail.com>"
CLOSER_NAME=⟨ton prénom ou EAGLEYE⟩

# ── SUPABASE (mémoire durable partagée avec Vercel) ──────────────────
# Dashboard Supabase → Settings → API. Les MÊMES valeurs que sur Vercel.
NEXT_PUBLIC_SUPABASE_URL=⟨https://xxxx.supabase.co⟩
NEXT_PUBLIC_SUPABASE_ANON_KEY=⟨eyJ…⟩
SUPABASE_SERVICE_ROLE_KEY=⟨eyJ…  (secret ! jamais côté navigateur/Vercel public)⟩

# ── TRACKING (pixels & liens dans les emails → URL PUBLIQUE) ─────────
# ⚠ Nouvelle URL depuis la re-création du projet Vercel :
TRACKING_BASE_URL=https://alphasalesos.vercel.app
APP_BASE_URL=https://alphasalesos.vercel.app
# LAISSER VIDE (le sync passe par alpha-tracking-sync via Supabase) :
TRACKING_WEBHOOK_URL=

# ── n8n (webhooks entrants) ──────────────────────────────────────────
# Le MÊME secret que ALPHA_WEBHOOK_SECRET côté n8n.
WEBHOOK_SECRET=⟨ton-secret-partagé⟩

# ── IA LOCALE (gratuite, optionnelle mais recommandée) ───────────────
# ollama pull qwen2.5:3b  (léger, passe sur le MacBook Air 2014)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
# (Sans Ollama ni clé : moteur de templates Hormozi, l'app marche quand même.)
# ANTHROPIC_API_KEY=⟨optionnel, cloud⟩

# ── DÉLIVRABILITÉ ────────────────────────────────────────────────────
MAX_SENDS_PER_HOUR=40
CONTACT_COOLDOWN_DAYS=14

# ── GATE ─────────────────────────────────────────────────────────────
# VIDE en local (pas de mot de passe sur ton cockpit) ; OBLIGATOIRE sur Vercel.
SITE_PASSWORD=

# ── SMS (optionnel) ──────────────────────────────────────────────────
TEXTBELT_URL=
TEXTBELT_KEY=
```

**Côté Vercel** (Settings → Environment Variables — pas dans ce fichier) :
`SITE_PASSWORD` (fort, obligatoire), `TRACKING_BASE_URL` + `APP_BASE_URL` =
`https://alphasalesos.vercel.app`, `WEBHOOK_SECRET`, et les 3 clés Supabase.
Production Branch = `claude/crm-n8n-email-tracking-4qxtwr`.

---

## 3. Ordre de lancement (3 terminaux)

```bash
# T1 — n8n (le cerveau)
n8n start                      # → http://localhost:5678
#   Vérifier : les workflows alpha-* sont ACTIFS (interrupteur vert).

# T2 — Ollama (l'IA locale, optionnel)
ollama serve                   # souvent déjà en service systemd
ollama pull qwen2.5:3b         # une seule fois

# T3 — l'app (le cockpit)
cd "/home/neo4tony/Desktop/EAGLEYE CORP/alpha-sales-os"
npm run build && npm run start # mode prod local (recommandé pour le live)
# ou : npm run dev              # mode développement
```

**Contrôles santé, dans l'ordre :**
1. `curl -s http://localhost:3000/api/health` → `"email":{"configured":true}`,
   `"ai"` OK, Supabase OK.
2. `https://alphasalesos.vercel.app/api/health` (navigateur) → `gated:true`.
3. Navigation privée sur `https://alphasalesos.vercel.app` → animation → page
   de connexion (si le dashboard s'ouvre direct : `SITE_PASSWORD` manque).
4. Dans l'app : **Réglages** → connexion n8n testée ; **Recette** → dérouler le
   test bout-en-bout (envoi → ouverture → clic → réponse → STOP) jusqu'au
   « GOOD TO GO ».

---

## 4. Checklist GO-LIVE (une fois, avant les premiers envois)

- [ ] `Code.gs` à jour recollé dans Apps Script + **nouvelle version** du
      déploiement Web App (37 colonnes, dont `linkedin`). Bouton « Réparer »
      dans l'app si la migration doit s'appliquer.
- [ ] Vercel : env complètes (cf. §2) + Production Branch = la branche de
      travail + domaine `alphasalesos.vercel.app` confirmé.
- [ ] Gmail/SMTP : mot de passe d'application actif, `MAX_SENDS_PER_HOUR=40`
      max au début (réputation à chauffer progressivement — voir
      `docs/RUNBOOK.md` pour la montée en volume).
- [ ] Test réel sur TOI : t'ajouter en prospect, t'envoyer le premier email,
      vérifier le rendu (DA calme + aigle), le pixel, le clic, répondre STOP.
- [ ] PWA installée sur le Nothing Phone (`alphasalesos.vercel.app` →
      « Ajouter à l'écran d'accueil ») — page **Closer OS** en bas.
- [ ] Premier prospect réel : suivre le coach deep-dive (fiche → Audit) et
      joindre l'audit cadeau au premier email.

---

## 5. Dépannage express

| Symptôme | Remède |
|---|---|
| `EADDRINUSE :3000` | `pgrep -f next-server` puis `kill ⟨PID⟩` (vieux serveur). |
| Le pull demande un login à chaque fois | `git config credential.helper store` (token stocké localement). |
| `npm install` râle (ERESOLVE/deprecated) | Bénin — voir la note sécurité npm de `docs/INSTALLATION.md`. |
| Emails sans logo aigle | `TRACKING_BASE_URL` absent/faux dans `.env.local` → l'image pointe dans le vide. |
| Tracking à zéro | Les emails doivent partir de l'app LOCALE avec `TRACKING_BASE_URL=https://alphasalesos.vercel.app` ; les stats remontent par `alpha-tracking-sync` (n8n, toutes les 10 min). |
| n8n webhook 403 | `WEBHOOK_SECRET` (app) ≠ `ALPHA_WEBHOOK_SECRET` (n8n). |
| L'IA répond « moteur templates » | Ollama éteint ou `OLLAMA_MODEL` vide — pas bloquant. |

---

## 6. Ce que le thread local peut me demander de faire

Vérifier/écrire le `.env.local` (les valeurs restent locales), lancer et
diagnostiquer les 3 process, dérouler la Recette, corriger un workflow n8n
qui rougit (coller la sortie du nœud rouge), ajuster la montée en volume.
Tout le contexte produit/architecture est dans `docs/HANDOFF.md` ; les
prompts agent dans `integrations/n8n/PROMPTS.md`.
