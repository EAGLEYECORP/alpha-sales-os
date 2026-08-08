# ALPHA SALES OS® — état complet

**EAGLEYE CORP · Lyon · Zakaria Tazi**
Le système d'exploitation de la vente terrain. Ce document est la carte
d'ensemble : ce qui existe, ce qui tourne, et ce qui attend une clé.

---

## Ce que c'est

Un OS commercial local-first (Next.js 15, React 19, TypeScript strict,
Zustand). Il tient la vente terrain de bout en bout : connaître, prioriser,
décider, débriefer, envoyer, relancer — et tourner ~80 % sans toi une fois
branché. Zéro vendor lock-in : SMTP standard, Textbelt open-source, Supabase
optionnel, n8n auto-hébergeable.

## Les briques (toutes construites et vérifiées)

| Domaine | Où | État |
|---|---|---|
| Pipeline, fiches, CRM 360 | `/pipeline`, `/prospects/[id]` | ✅ |
| **Aujourd'hui** — urgent/important calculé | `/aujourdhui` · `lib/priorites.ts` | ✅ |
| **À décider** — la boucle humaine | `/decisions` | ✅ |
| **Débrief terrain** — voix (navigateur + serveur) | `/debrief` · `lib/debrief.ts` | ✅ |
| Transcription serveur (tous navigateurs) | `app/api/transcribe` · `use-recorder.ts` | ✅ code · clé ASR à brancher |
| Assistant d'appel — objections + alertes doctrine | `/appels`, `/closer` · `lib/live-assist.ts` | ✅ |
| **Alpha Voice** — agent vocal (art. 50) | `/voice` · `voice/` | ✅ code · LiveKit à brancher |
| **Audits** — cadeau, 1 ou N | `/audits` · `lib/audit-doc.ts` | ✅ |
| **Boîte d'envoi** + brouillons Gmail HTML | `/outbox` · `lib/gmail-*.ts` | ✅ code · SMTP à brancher |
| **Récap urgent** — SMS/email, à la demande + cron | `/aujourdhui` · `app/api/digest` | ✅ code · Textbelt à brancher |
| Campagnes, templates, prescripteurs, newsletter | `/campaigns`, `/templates`, … | ✅ |
| Closer OS — tournée, closing, sparring | `/closer` | ✅ |
| Délivrabilité + emails HTML « calme » | `lib/deliverability.ts`, `lib/email-html.ts` | ✅ |
| Tracking ouvertures/clics | `lib/tracking.ts` | ✅ code · Supabase pour la durabilité |
| Pilote automatique (n8n) | `integrations/n8n/*` | ✅ workflows · n8n à lancer |
| Import CSV / Sheets / ICP Callflow | `lib/csv.ts`, `lib/prospects-icp.ts` | ✅ |
| Site vitrine eagleyecorp.fr | `site/` | ✅ Netlify-ready |

## Vérification (dernier passage)

- **137 tests** au vert · **typecheck** 0 erreur · **build** 53 routes.
- L'app démarre, toutes les pages répondent 200, tous les endpoints répondent.
- Rendu vérifié : Débrief (micro corrigé), site vitrine (clair + sombre).

## Ce qui tourne SANS clé (dès que l'app est en ligne)

Tout le cerveau : pipeline, priorités, décisions, audits (aperçu +
téléchargement), scripts, débrief hors-ligne, prévisualisation des brouillons,
imports, KPIs. Le micro du navigateur marche sur Chrome/Edge/Safari en HTTPS.

## Ce qui attend UNE clé (chacune indépendante)

| Capacité | Clé | Doc |
|---|---|---|
| Envoi email + brouillons Gmail | `SMTP_USER` / `SMTP_PASS` | `docs/BROUILLONS-GMAIL.md` |
| Récap urgent SMS | `TEXTBELT_KEY` + `ALERT_PHONE` | `docs/RECAP-URGENT.md` |
| Dictée sur tous navigateurs | `DEEPGRAM_API_KEY` | `docs/VOIX.md` |
| IA (débrief, extraction) | `NVIDIA_API_KEY` | `.env.example` |
| Mémoire durable | Supabase (Réglages) | `docs/CHECKLIST-100.md` |
| Autopilote + alerte matin | n8n + `WEBHOOK_SECRET` + `APP_BASE_URL` | `integrations/n8n/README.md` |
| Agent vocal sortant | `LIVEKIT_*` + trunk SIP | `voice/README.md` |

L'app ne casse jamais si une clé manque : elle désactive la capacité et le dit.

## Ce qui reste à la main (hors code)

1. **Déployer** l'app (Vercel) et **le site** (Netlify) — `docs/CHECKLIST-100.md`,
   `site/README.md`. C'est la seule chose que le code ne peut pas faire seul.
2. Coller les clés voulues dans Vercel (bloc `.env`).
3. Lier Supabase dans Réglages, coller le lien Cal.com.
4. DNS : `eagleyecorp.fr` → Netlify ; DMARC/DKIM pour la délivrabilité.

## La doctrine, non négociable

Rien ne part sans relecture. Toujours une prochaine étape datée. L'émotion
avant le prix. Aucun chiffre gonflé. Les ~20 % qui font signer restent humains,
par choix — le reste, la machine le porte.
