# Sécurité — ALPHA SALES OS®

Posture de sécurité et menaces couvertes (anciennes et récentes). L'app est
local-first ; les secrets vivent côté serveur (jamais dans le navigateur) ou
dans des backends que tu contrôles (n8n, Supabase, ton SMTP).

## Modèle de menace & mitigations

| Menace | Statut | Mitigation |
|---|---|---|
| **XSS** (injection de script) | ✅ | React échappe par défaut ; la sortie IA/markdown est échappée avant rendu ; **CSP** stricte (`script-src 'self'`), pas de `dangerouslySetInnerHTML` sur du contenu utilisateur ; aperçus email rendus en `iframe sandbox=""`. |
| **Clickjacking** | ✅ | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'`. |
| **CSRF** | ✅ | Endpoints internes en **même origine uniquement** (middleware : `Sec-Fetch-Site` + `Origin`), JSON-only (pas de form cross-site), cookies non utilisés pour l'état sensible. |
| **Open redirect** | ✅ | `/api/track/click` ne redirige QUE vers une URL stockée à l'envoi ; jamais d'URL arbitraire depuis la query. |
| **SSRF** (import Sheets) | ✅ | `/api/import/sheet` : allowlist d'hôtes (`docs.google.com`), HTTPS forcé, pas de suivi vers des IP internes. |
| **Injection SQL** | ✅ | Supabase via client paramétré + **RLS** par utilisateur ; aucune requête concaténée. |
| **Fuite de secrets** | ✅ | Clés serveur (`ANTHROPIC_API_KEY`, `SMTP_*`, `SUPABASE_SERVICE_ROLE_KEY`) jamais exposées au client ; `/api/health` ne renvoie que des booléens ; `.env*` git-ignoré. |
| **DoS / scraping / brute-force** | ✅ | **Rate-limit par IP** (middleware) + rate-limit d'envoi (`MAX_SENDS_PER_HOUR`) + garde-fou taille de charge utile. |
| **Downgrade / MITM** | ✅ | **HSTS** (`max-age=63072000; includeSubDomains; preload`). |
| **Fingerprinting** | ✅ | `X-Powered-By` retiré ; `Origin-Agent-Cluster`, `X-Permitted-Cross-Domain-Policies: none`. |
| **Isolation cross-origin (Spectre-like)** | ✅ | `Cross-Origin-Opener-Policy: same-origin` ; `Cross-Origin-Resource-Policy: cross-origin` (nécessaire au pixel de tracking chargé par les clients mail). |
| **MIME sniffing** | ✅ | `X-Content-Type-Options: nosniff`. |
| **Prompt injection** (LLM) | ⚠️ Atténué | Les routes IA sont même-origine et rate-limitées ; l'IA ne dispose d'aucun outil d'écriture depuis l'app (génération de texte uniquement) ; côté n8n, l'agent n'a que les outils CRM explicitement branchés. Le contenu entrant (réponses prospects) est traité comme **données non fiables**. |
| **Abus d'envoi / spam / usurpation** | ✅ | Désinscription par réponse **STOP** (traitée par n8n) + List-Unsubscribe mailto, lint anti-spam, rate-limit ; **SPF/DKIM/DMARC** à configurer côté DNS (voir plus bas). |
| **Détournement de session (verrou local)** | ✅ | Verrou PIN optionnel (SHA-256, jamais en clair) ; auth réelle par lien magique Supabase + RLS en mode équipe. |
| **Supply chain** | ⚠️ | Dépendances épinglées (`package-lock.json`) ; `npm audit` recommandé en CI ; aucune dépendance CDN exécutée au runtime hormis les polices Google (self-hostables). |
| **Exfiltration via webhook n8n** | ⚠️ | Le lien n8n est saisi par l'utilisateur (même appareil) ; secret partagé optionnel (`x-alpha-secret`) ; garde n8n derrière ton réseau. |
| **Lecture publique des réponses prospects** | ✅ | `GET/PATCH /api/webhooks/inbound` exigent le navigateur **même-origine** (l'UI) ou `x-webhook-secret` — un déploiement public (Vercel/tunnel) n'expose pas les réponses en lecture. Le `POST` reste ouvert cross-origin, protégé par le secret (son rôle). |

## En-têtes de sécurité (next.config.ts + middleware)

`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (caméra/micro/géo/FLoC coupés), `Cross-Origin-Opener-Policy`,
`Cross-Origin-Resource-Policy`, `Origin-Agent-Cluster`, `X-Permitted-Cross-Domain-Policies: none`.

> Choix assumé : `connect-src` autorise `https:` (le tableau de bord appelle le
> **webhook n8n de l'utilisateur**, domaine arbitraire). Pour durcir davantage,
> restreins-le à ton domaine n8n une fois connu.

## À faire côté opérateur (hors code)

1. **HTTPS partout** (HSTS n'a d'effet qu'en TLS).
2. **SPF + DKIM + DMARC** sur le domaine d'envoi — ~80 % de la délivrabilité et
   la protection contre l'usurpation.
3. **Secrets** dans le gestionnaire de l'hébergeur (Vercel/1Password), jamais en
   dépôt. Renseigne `UNSUB_SECRET`, `WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
4. **Supabase** : applique `supabase/schema.sql` (RLS activée partout), garde la
   `service_role` côté serveur uniquement.
5. **n8n** derrière un tunnel/réseau authentifié ; active un secret partagé.
6. **Dépendances** : `npm audit` + Dependabot ; mets à jour régulièrement.
7. **PIN de verrouillage** pour les postes partagés (Réglages → Sécurité).
8. **RGPD / prospection B2B (CNIL)** : le pied d'email intègre déjà l'origine
   des données (sources publiques), le droit d'opposition (STOP) et les droits
   d'accès/rectification/suppression. À toi de tenir le reste : traiter toute
   demande d'effacement (purger Sheets + Supabase `tracking_messages` +
   `crm_records`), et purger le tracking > 12 mois (politique de rétention).

## État d'audit (dernier passage complet)

- **XSS** : 3 usages de `dangerouslySetInnerHTML`, tous vérifiés — 2 constantes
  statiques (thème, logo SVG) + le rendu markdown qui **échappe l'entrée avant
  tout formatage** (`components/ui/markdown.tsx`). Aperçus email en
  `iframe sandbox=""` (aucune capacité).
- **Endpoints internes** (même-origine via middleware) : send, ai, agent,
  **sparring**, email/preview, **import/sheet**, track/stats, track/contacted,
  crm/patch. Publics par conception : track/open|click (clients mail),
  webhooks/inbound (secret), health (booléens seulement).
- **npm audit** : 8 avis (4 low / 4 moderate), tous **transitifs** et hors de
  nos chemins d'exécution — `jsondiffpatch` XSS (HtmlFormatter jamais utilisé ;
  dép. de `ai` v4), « resource consumption » de `@ai-sdk/provider-utils`
  (streams côté serveur que nous bornons), `postcss` via `next` (concerne le
  build, le « fix » proposé par npm est un downgrade Next 9 — absurde).
  **Décision** : pas de montée majeure à l'aveugle ; planifier `ai` v4→v7 +
  `@ai-sdk/anthropic` v1→v4 comme chantier dédié (API breaking).
- **CSP** : `script-src 'self' 'unsafe-inline'` — l'inline est requis par le
  script anti-flash du thème ; durcissement possible plus tard via nonce.

## Signaler une faille

Contact : sécurité EAGLEYE CORP. Merci de ne pas divulguer publiquement avant
correction.
