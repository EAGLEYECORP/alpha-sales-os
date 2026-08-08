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

1. **Comptes individuels** — Supabase Auth (email + mot de passe, ou magic
   link). Chaque commercial a son compte.
2. **Isolation par locataire** — chaque ligne porte `user_id` (ou `org_id`) ;
   la RLS (déjà écrite dans le schéma) garantit qu'un client ne voit jamais les
   données d'un autre. À activer et à **tester** avec deux comptes.
3. **Session** — remplacer la porte `SITE_PASSWORD` par la session Supabase ;
   le middleware vérifie le JWT au lieu du cookie partagé.
4. **Facturation liée au compte** — le Stripe Payment Link devient un
   abonnement rattaché à l'utilisateur (webhook Stripe → statut du compte).

C'est un vrai build (auth + migration du local-first vers le multi-tenant), pas
un commit. Je peux le démarrer dès que tu dis go.

---

## Le reste de la feuille de route (par priorité)

**Avant le premier client :**
- [ ] Auth multi-locataire + isolation RLS testée (ci-dessus).
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

- Endpoints sensibles ajoutés à la protection **même-origine** (anti-CSRF) :
  `digest`, `gmail/draft`, `transcribe`, `voice/call`, `debrief`.
- `npm audit fix` (correctifs non cassants appliqués).
- `/.well-known/security.txt` pour la divulgation responsable.
- Ce document, comme feuille de route honnête.

---

## Le principe qui prime

**« Toute la cybersécurité possible » n'est pas un état, c'est un programme.**
Le socle défensif est solide ; la brique qui manque vraiment pour vendre à
d'autres, c'est l'**auth multi-locataire**. Tant qu'elle n'est pas là, on ne
facture pas un client dont les données partageraient l'espace d'un autre. C'est
la ligne à ne pas franchir.
