# Architecture — Alpha Sales OS

> Carte technique lue dans le code source (l'équivalent versionné de l'artifact
> « Carte technique »). Next.js 15 · React 19 · TypeScript strict ·
> **zéro dépendance runtime tierce**.
>
> ⚠ Les compteurs (pages, routes, modules) ne sont plus recopiés ici : ils
> périmaient au commit suivant sans que personne les rouvre. `find app -name
> page.tsx | wc -l` et `ls lib/*.ts | wc -l` répondent, et ils ne mentent pas.
> Version interactive & interrogeable, sur ta machine : `npx graphify .`
> (→ `graphify-out/graph.html` + `GRAPH_REPORT.md`). Voir aussi `lib/os-map.ts`
> pour la carte **produit** (les routes, donnée à l'IA pour qu'elle se guide).

## Topologie — trois zones

```
                     👤 Opérateur / Commercial
                              │
        ┌─────────────────────▼──────────────────────┐
        │  NAVIGATEUR — local-first                   │
        │  • Pages (/pipeline /voice /prospects/:id …) │
        │  • Store Zustand  alpha-sales-os-v2 (persist)│
        │  • Réglages — white-label (agence · offre ·  │
        │    tarifs · règles)  ⇢ pilote docs/IA/voix   │
        └─────────────────────┬───────────────────────┘
                              │
                   ╔══════════▼══════════╗
                   ║  MIDDLEWARE — JWT   ║   ← frontière : fail-closed
                   ║  (REQUIRE_AUTH)     ║     si REQUIRE_AUTH
                   ╚══════════╤══════════╝
        ┌─────────────────────▼───────────────────────┐
        │  SERVEUR — routes API · clés côté serveur    │
        │  IA · Envoi/Audits · Tracking · Voix · Billing│
        └───┬─────────┬──────────┬─────────┬───────────┘
            │         │          │         │
   ┌────────▼──┐ ┌────▼────┐ ┌───▼────┐ ┌──▼──────────────┐
   │ Ollama    │ │Supabase │ │ Stripe │ │ n8n · Gmail ·   │
   │ NVIDIA    │ │Auth·RLS │ │        │ │ LiveKit/SIP ·   │
   │ Anthropic │ │Postgres │ │        │ │ sites prospects │
   └───────────┘ └────┬────┘ └────────┘ └─────────────────┘
                      │ RLS : chaque compte ne voit que SES lignes
                      ⇢ store
```

## Les couches et leurs modules

| Couche | Rôle | Fichiers clés |
|---|---|---|
| **Client — local-first** | La source de vérité vit dans le navigateur | `store.ts` (Zustand persist), `types.ts`, `app/*/page.tsx` (34), `os-map.ts` |
| **Auth & multi-tenant** | Un compte = ses données, isolées | `auth.ts` (magic link), `supabase-jwt.ts` (HS256 middleware), `tenant.ts`, `access.ts`, RLS par `user_id` |
| **IA — white-label** | Parle au nom du compte, vend SON offre | `ai-engine.ts` (routeur), `ollama.ts`, `nvidia.ts`, `identity.ts` (`buildIdentity`), `playbook.ts`, `hormozi.ts`, `ai-context.ts` |
| **Envoi & délivrabilité** | Le message part, propre et suivi | `mail-compose.ts`, `email-html.ts`, `gmail-draft.ts`, `gmail-mime.ts`, `deliverability-dns.ts`, `email-ramp.ts` |
| **Tracking** | Ouvertures & clics, scoupés par compte | `tracking.ts` (service-role), `/api/track/{open,click,contacted,stats}`, table `tracking_messages` |
| **Voix — art. 50** | Démo vocale, divulgation IA non contournable | `voice-script.ts`, `call-session.ts`, `live-assist.ts`, `voice/agent.py` (LiveKit/SIP), `speech-text.ts` |
| **Audits cadeau** | Un audit à la marque du compte, par prospect | `site-fetch.ts` (SSRF-safe), `audit-extract.ts`, `audit-apply.ts`, `audit-doc.ts` (`brandFromSettings`), `audit-batch.ts` |
| **Facturation** | Freemium → payant, quota mensuel | `stripe.ts` (`accountTier`), `billing.ts`, `plans.ts` (`FREE_TIER`), `pricing.ts` (white-label), `/api/webhooks/stripe` (HMAC) |
| **Intégrations & données** | L'app est un tableau de bord sur n8n | `n8n.ts`, `supabase.ts` (push/pull snapshot), `csv.ts`, `/api/import/sheet`, `/api/webhooks/inbound` |

## Flux de données (bout en bout)

1. **Génération IA au nom du compte** — page → garde JWT → `/api/ai` → `ai-engine`
   → Ollama/NVIDIA/Anthropic → réponse échappée → store.
   *Identité white-label (`buildIdentity`) + règles business injectées en tête du
   prompt. Clé IA côté serveur uniquement.*
2. **Envoi manuel tracké** — `/outbox` → Gmail pré-rempli → envoi humain →
   pixel `/api/track/open/:id` + `/api/track/click/:id` → `tracking` (service-role).
   *Aucun SMTP requis. Tracking persistant, scoupé au compte.*
3. **Audit cadeau par prospect** — `/prospects/:id` → `/api/audit/generate` →
   `site-fetch` (SSRF-safe) → `audit-doc` (marque du compte) → impression/PDF.
4. **Démo vocale (art. 50)** — `/voice` → `/api/voice/call` → LiveKit + `agent.py`
   → SIP → divulgation prononcée par le code (non contournable, testée).
5. **Facturation freemium → payant** — `/compte` → `/api/billing/checkout` →
   Stripe → `/api/webhooks/stripe` (HMAC-SHA256) → `subscriptions` → tier.
   *`owner` (toi, via `OWNER_EMAILS`) = illimité.*
6. **Isolation multi-locataire** — `/login` (magic link) → Supabase Auth → JWT →
   RLS par `user_id` → le store ne reçoit que SES lignes.

## Où vivent les fiches — et le mur qui oblige à choisir

> Ajouté le 01/09/2026.

**Par défaut, le pipe vit dans le navigateur** (Zustand + `localStorage`). C'est
le mode historique, et il ne change pas.

**MESURÉ** (`tests/mur-stockage.test.ts`) : une fiche d'import pèse ~1,9 Ko, sa
timeline autant sur six touches, et le quota est de 5 Mo.

| | Fiches |
|---|---|
| Alerte (80 %) | ~1 200 |
| Dépassement (100 %) | ~1 500 |

Au-delà, `localStorage.setItem` échoue **en silence** : l'écran continue
d'afficher les fiches, elles disparaissent en fermant l'onglet. Aucun élagage ne
repousse cette limite — supprimer les phrases répétées des événements ne gagne
que 30 %.

### La sortie : `pipeServeur` (opt-in)

Les fiches ne sont plus persistées localement (`partialize`), elles se chargent
au démarrage depuis Supabase — route paginée, **ordonnée**, **comptée**
(`GET /api/sync/prospects?fiches=1`).

> ⚠ **L'invariant unique qui rend ça sûr** (`lib/hydratation.ts`) :
> **on ne pousse JAMAIS depuis un état qu'on n'a pas chargé**
> (`peutSynchroniser`). Un navigateur qui a raté son chargement a une liste
> vide, et la synchro sortante calcule des suppressions. Pousser de là
> effacerait le pipe.

L'état d'hydratation **ne se persiste pas** : le relire du disque affirmerait
« chargé » sur une liste vide, et rouvrir l'onglet effacerait tout. `partialize`
réécrit donc l'état de DÉPART, jamais l'état courant.

Deux filets qui se recouvrent, et c'est voulu : celui-ci empêche d'essayer,
`SEUIL_EFFACEMENT` (`lib/sync-prospects.ts`) empêche d'aboutir.

### Corollaire : le moteur de synchro vit dans la coquille

`components/sync-moteur.tsx` est monté **une fois**, dans `AppShell` — pas dans
Réglages. Tant qu'il vivait dans l'écran de réglages, un opérateur en mode pipe
serveur qui n'ouvrait jamais cette page ne poussait rien, et perdait sa journée
en fermant l'onglet. Réglages n'en garde que la vue.

Et parce que les 8 secondes de silence avant envoi sont 8 secondes pendant
lesquelles la saisie n'existe nulle part : `sendBeacon` sur `pagehide` et
`visibilitychange` (`fetch` est annulé avec la page). Écritures uniquement,
jamais de suppression — on ne vérifie pas l'accusé de réception d'un beacon.

## Frontière de sécurité

La garde JWT du middleware : en mode `REQUIRE_AUTH`, toute route API est
fail-closed. Les clés IA / Stripe / Supabase service-role ne quittent jamais le
serveur. Sortie IA échappée avant rendu (anti-XSS). Aucune dépendance CDN au
runtime.

## Statut honnête

**✓ Vérifié en session**
- TypeScript strict — `tsc --noEmit` clean
- Suite `node:test` complète, 0 échec (`npm test` pour le compte du jour)
- Build production Next.js — OK
- White-label complet : documents · prompts IA · voix · tarifs
- Divulgation voix art. 50 — testée

**⚠ À prouver contre les vrais services** (clés/hosts bloqués par l'egress en session)
- Isolation RLS — test deux-comptes **avant de facturer** (`docs/PREUVE-RLS.md`)
- Rendu réel des prompts IA — clés IA bloquées
- Webhook Stripe live · Checkout · portail
- Appel SIP réel + délivrabilité du domaine
- Scraping site (`site-fetch`) — host externe bloqué

---

Voir aussi : `docs/WHITE-LABEL.md`, `docs/SECURITE.md`, `docs/FACTURATION.md`,
`docs/OUVRIR-UN-COMPTE-CLIENT.md`.
