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

## Signaler une faille

Contact : sécurité EAGLEYE CORP. Merci de ne pas divulguer publiquement avant
correction.
