# Sécurité — ALPHA SALES OS® en SaaS

**EAGLEYE CORP.** · vendu à d'autres commerciaux → les données de leurs clients
transitent par l'app. La sécurité n'est plus une option : c'est le produit.

Ce document dit **ce qui est déjà en place**, **ce qui vient d'être durci**, et
**ce qui reste à construire** avant de facturer un premier client — sans rien
enjoliver.

---

## Déjà en place (défense en profondeur)

| Couche | Détail | Où |
|---|---|---|
| **En-têtes** | CSP stricte, HSTS (2 ans, preload), X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, COOP, CORP, X-DNS-Prefetch off | `next.config.ts` |
| **Porte d'accès** | Cookie signé ; rien n'est servi sans lui en déploiement public | `middleware.ts` + `lib/access.ts` |
| **Rate-limit** | Par IP, double budget (général + porte anti-force-brute) | `middleware.ts` |
| **Anti-CSRF** | Endpoints sensibles : même origine exigée (désormais y compris digest, gmail/draft, transcribe, voice/call, debrief) | `middleware.ts` |
| **Webhooks** | Secret partagé exigé sur l'inbound | `WEBHOOK_SECRET` |
| **Données** | Schéma Supabase avec **RLS par utilisateur** (`auth.uid()`), secrets jamais dans le code | `supabase/schema.sql` |
| **Divulgation** | `/.well-known/security.txt` | `public/.well-known/` |

---

## Le vrai enjeu du SaaS : l'authentification multi-locataire

**Aujourd'hui, l'app est mono-utilisateur, local-first**, protégée par **un seul
mot de passe partagé** (`SITE_PASSWORD`). Ça convient à un opérateur unique.
**Ça ne convient PAS à un SaaS vendu à plusieurs clients** : ils partageraient
tous le même mot de passe et — pire — potentiellement la même base.

C'est **le chantier n°1**, non négociable avant le premier client payant :

1. **Comptes individuels** — Supabase Auth (email + mot de passe). Chaque
   commercial a son compte. ✅ **Fait** (`lib/auth.ts`, `components/security/auth-gate.tsx`,
   page `/compte`, réglage « Exiger un compte » dans Réglages → Sécurité).
2. **Isolation par locataire** — chaque ligne porte `user_id` ; la RLS (déjà
   écrite dans `supabase/schema.sql`) garantit qu'un client ne voit jamais les
   données d'un autre. ⚠ **À activer et à tester avec DEUX comptes réels avant
   de facturer** — l'isolation se prouve, elle ne se suppose pas.
3. **Session** — la porte `SITE_PASSWORD` reste, doublée du mur de connexion
   par compte (`AuthGate`). ✅ **Enforcement serveur fait** : le middleware
   vérifie la **signature HS256** du JWT Supabase (cookie miroir posé par
   `AuthSync`, `lib/supabase-jwt.ts`) sur toutes les API de données. Opt-in via
   `REQUIRE_AUTH=1` + `SUPABASE_JWT_SECRET`. Même en contournant le gate client,
   aucune API ne répond sans jeton signé valide (401), et une config
   incomplète échoue **fermée** (503, jamais ouverte). Prouvé : 7 tests
   unitaires (signature, expiration, `alg:none`, falsification) + smoke test
   live des 3 états.
4. **Facturation liée au compte** — le Stripe Payment Link devient un
   abonnement rattaché à l'utilisateur (webhook Stripe → statut du compte).
   ⏳ **Reste à faire.**

Le socle identité est posé ; les deux briques serveur qui restent (JWT dans le
middleware + webhook Stripe) sont la condition pour facturer en confiance.

---

## Le reste de la feuille de route (par priorité)

**Avant le premier client :**
- [x] Auth multi-locataire — comptes Supabase, mur de connexion, page `/compte`.
- [x] **Preuve d'isolation RLS outillée** — `npm run verify:rls` (script
      `supabase/verify-isolation.mjs`) + procédure `docs/PREUVE-RLS.md`. Il
      RESTE à l'exécuter contre ton vrai projet à deux comptes → verdict VERT
      avant tout client payant.
- [x] **Tables service-role scopées par locataire** — `user_id` sur
      `tracking_messages`/`inbound_events`/`crm_records`, estampillé depuis le
      JWT et filtré dans `/api/send`, `/api/track/stats`, `/api/crm/patch`,
      `/api/webhooks/inbound` (`lib/tenant.ts`). 4 tests. Attribution des
      webhooks entrants = déclarative (`?t=<user_id>`), détaillée dans PREUVE-RLS.md.
- [x] **Enforcement serveur : JWT Supabase (HS256) vérifié dans le middleware**
      — `REQUIRE_AUTH=1` + `SUPABASE_JWT_SECRET`. Fail-closed. 7 tests + smoke
      test live. Reste à activer sur ton déploiement et vérifier de bout en bout.
- [ ] **Dépendances** : `next`/`sharp` portent des CVE (libvips) corrigées
      seulement par Next 16 (changement cassant). Planifier la montée de
      version et re-tester. `npm audit` : 9 restantes, 3 hautes.
- [ ] **RGPD / DPA** : registre des traitements, contrat de sous-traitance avec
      chaque client (leurs prospects sont des données personnelles), politique
      de conservation, export/suppression sur demande.
- [ ] **Secrets** : rotation, un jeu de clés par environnement, jamais en clair
      dans le chat/dépôt (la clé Deepgram partagée en clair → à régénérer).

**Rapidement après :**
- [ ] Journalisation d'audit (qui a fait quoi) — déjà amorcée (`auditLog`).
- [ ] Sauvegardes chiffrées + test de restauration.
- [ ] Alertes de sécurité (échecs d'auth, pics anormaux).
- [ ] 2FA sur les comptes admin.
- [ ] Revue de code sécurité + test d'intrusion avant lancement large.

**En continu :**
- [ ] `npm audit` à chaque release ; veille CVE.
- [ ] Principe du moindre privilège (clés API à portée minimale).
- [ ] Chiffrement en transit (HTTPS partout — ✅) et au repos (Supabase ✅).

---

## Ce qui vient d'être fait dans ce passage

- **Enforcement serveur du JWT** : `lib/supabase-jwt.ts` (vérif HS256 edge-safe
  via Web Crypto, garde anti `alg:none`, marge d'horloge), `AuthSync` (mirroir
  du jeton Supabase localStorage → cookie lisible par le middleware),
  `middleware.ts` (401 sans jeton valide sur les API de données, 503 fail-closed
  si mal configuré). Activation : `REQUIRE_AUTH=1` + `SUPABASE_JWT_SECRET`
  (Supabase → Settings → API → JWT Secret). 7 tests unitaires + smoke test live
  des 3 états (503 / 401 / 200).
- **Auth multi-locataire (couche identité)** : `lib/auth.ts` (inscription /
  connexion / déconnexion / session sur Supabase Auth), `AuthGate` (mur de
  connexion par compte, rendu par défaut ouvert comme le LockGate pour ne jamais
  blanchir l'app), page `/compte` (compte connecté + déconnexion), réglage
  « Exiger un compte » (Réglages → Sécurité, actif seulement si Supabase lié).
- Endpoints sensibles ajoutés à la protection **même-origine** (anti-CSRF) :
  `digest`, `gmail/draft`, `transcribe`, `voice/call`, `debrief`.
- `npm audit fix` (correctifs non cassants appliqués).
- `/.well-known/security.txt` pour la divulgation responsable.
- Ce document, comme feuille de route honnête.

**Non prouvé (à ne pas oublier) :** l'auth n'a pas été testée contre un vrai
projet Supabase dans l'environnement de build. Avant de facturer : créer deux
comptes, vérifier que chacun ne voit que ses données (RLS), puis passer
l'enforcement côté serveur (JWT dans le middleware).

---

## Le principe qui prime

**« Toute la cybersécurité possible » n'est pas un état, c'est un programme.**
Le socle défensif est solide ; la brique qui manque vraiment pour vendre à
d'autres, c'est l'**auth multi-locataire**. Tant qu'elle n'est pas là, on ne
facture pas un client dont les données partageraient l'espace d'un autre. C'est
la ligne à ne pas franchir.
