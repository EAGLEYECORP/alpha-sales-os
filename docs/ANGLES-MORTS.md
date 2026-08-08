# Angles morts & reste à faire — ALPHA SALES OS

État franc au terme du chantier SaaS. Ce qui est posé, ce qui n'est pas prouvé,
ce qui reste. Pas de « c'est bon » de complaisance.

---

## ✅ Posé et testé (en build)

- **Comptes multi-locataires** — Supabase Auth, mur de connexion (`AuthGate`),
  page `/compte`, reset de mot de passe.
- **Isolation données utilisateur** — RLS (prospects/campaigns/meetings/…),
  preuve outillée `npm run verify:rls`.
- **Frontière serveur** — JWT HS256 vérifié dans le middleware (opt-in,
  fail-closed). 7 tests + smoke test live.
- **Tables service-role scopées** par `user_id` (tracking/inbound/crm). 4 tests.
- **Facturation Stripe** — Checkout, portail, webhook signé, `subscriptions`,
  garde-fou d'envoi, **accès propriétaire par domaine**. 9 tests + smoke test live.
- **Économie IA** — compression de contexte opt-in au chokepoint `runAI`,
  adoptée dans l'agent + audit/extract. 6 tests.
- Total : **168 tests**, typecheck 0, build OK.

---

## ⚠ Les angles morts (à traiter avant d'ouvrir aux clients)

### 1. Rien n'est prouvé contre les VRAIS services
Tout est vérifié en build + tests synthétiques, mais **pas contre un vrai projet
Supabase ni un vrai compte Stripe**. À faire côté toi, une fois :
- `npm run verify:rls` à deux comptes → verdict VERT (`docs/PREUVE-RLS.md`).
- Un paiement test Stripe bout-en-bout (`docs/FACTURATION.md`, carte `4242…`).
**Tant que ces deux preuves ne sont pas faites, ne facture personne.**

### 2. Légal / conformité (bloquant commercial, hors code)
Avant de vendre un SaaS qui traite les prospects de tes clients :
- **CGV/CGU**, **Politique de confidentialité**, **DPA** (sous-traitance RGPD —
  leurs prospects sont des données personnelles), mention légale, cookies.
- Registre des traitements, durée de conservation, export/suppression sur demande.
Rien de tout ça n'est dans le code — c'est un chantier juridique à mener.

### 3. Modèle de déploiement à trancher explicitement
Deux modèles, l'archi supporte les deux — **choisis** :
- **(a) Une instance par client** (BYO-creds) : chaque commercial déploie SON
  instance avec SES clés (Supabase, SMTP, IA). Marche AUJOURD'HUI, simple,
  aligné « one-person business » (cf. Buzz). C'est ce que tu as décrit.
- **(b) Une instance mutualisée** : un seul déploiement, N locataires. L'isolation
  données est faite (RLS + JWT + scoping), MAIS **SMTP / IA / voix restent des
  creds GLOBAUX** (niveau déploiement), pas par locataire. Pour du vrai (b), il
  faudrait un **coffre de creds par locataire** — non fait.
Recommandation : lancer en **(a)**, garder **(b)** pour plus tard.

### 4. Rate-limit & anti-abus en serverless
Le rate-limit (middleware + envoi) est **en mémoire, par instance**. Sur Vercel
multi-instances, il est approximatif. Le rate-limit d'envoi durable existe déjà
via Supabase ; le rate-limit HTTP du middleware, non. Acceptable au lancement,
à durcir (Redis/Upstash ou table Supabase) si le volume monte.

### 5. Dépendances (CVE)
`next`/`sharp` portent des CVE (libvips) corrigées seulement par Next 16
(changement cassant). Planifier la montée de version + re-tester.

---

## 🔧 Reste produit (par valeur décroissante)

- **Sorties structurées généralisées (Outlines)** — amorcé (audit/extract passe
  par la cascade + validation `parseLoose`). À étendre : un validateur de schéma
  réutilisable pour le patch CRM et la classification d'objections.
- **Cache de réponses IA (GPTCache)** — candidat : moins cher + plus rapide sur
  les générations répétées. À cadrer (invalidation par version de doctrine).
- **Compteur tokens/coût (CodeBurn)** — `runAI` renvoie déjà `promptTokens` ;
  reste à l'afficher (État du système / débrief) pour voir ce que l'IA coûte.

### Grosses briques différées (décision produit)
- **Agent voix « coach »** — Alpha qui entraîne au closing / relance / upsell
  (au-delà de l'appel sortant déjà en place). Gros build.
- **Modes mobile Sparring / Closing** — accès complet + modes dédiés terrain.
  Gros build UI.
Ces deux-là sont des projets à part entière : à prioriser quand le SaaS tourne.

---

## L'ordre que je recommande

1. **Prouver** (RLS deux comptes + paiement Stripe test) — débloque la facturation.
2. **Légal** (CGV/DPA/confidentialité) — débloque la vente.
3. **Lancer en modèle (a)** une instance par client.
4. Puis produit : compteur coût → cache IA → agent voix coach → modes mobile.
