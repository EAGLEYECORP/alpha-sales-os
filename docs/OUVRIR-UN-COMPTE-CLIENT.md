# Ouvrir un compte à un client — procédure opérationnelle

> Modèle **concierge** : chez EAGLEYE, Alpha Sales OS vend Alpha Sales OS. Tu
> ouvres un compte à un commercial revendeur quand il en veut un, et il ne voit
> que SES données (isolation RLS par compte). Ce document est le mode d'emploi
> pour le faire sans réfléchir à chaque fois.

## 0. Une fois pour toutes (préalable, à faire UNE seule fois)

1. **Supabase lié** — projet créé, `supabase/schema.sql` appliqué (SQL Editor),
   URL + clé anon renseignées dans `Réglages → Supabase`.
2. **Signups fermés** — Supabase → Authentication → Providers → Email →
   **décocher « Allow new users to sign up »**. Personne n'entre sans invitation.
   C'est ce qui fait de toi le portier.
3. **Toi = propriétaire** — variable d'env serveur (Vercel) :
   `OWNER_EMAILS=eagleyecorp.ad@gmail.com,contact@eagleyecorp.fr` (+ tes autres).
   → ces comptes passent en tier `owner` = **illimité, jamais facturé**.
4. **Auth exigée** — `Réglages → Sécurité → Exiger un compte` coché (ou
   `REQUIRE_AUTH=1` côté serveur pour un verrou dur, fail-closed).
5. **⚠ Preuve d'isolation** — AVANT de facturer le 1er client : crée deux comptes
   de test, connecte-toi avec chacun, vérifie que l'un ne voit jamais les fiches
   de l'autre (`docs/SECURITE.md` / `docs/PREUVE-RLS.md`). L'isolation se prouve,
   elle ne se suppose pas.

## 1. Créer le compte du client (5 clics, côté toi)

1. Supabase → **Authentication → Users → Add user → Invite user**.
2. Entre l'email du client → il reçoit un mail d'invitation / lien magique.
3. (Facultatif) S'il devient payant tout de suite, tu peux le laisser passer par
   Stripe lui-même (voir §4) — sinon il démarre en tier `free` (quota gratuit).

> Alternative : laisse le client aller sur `/login`, entrer son email → il reçoit
> le lien magique **seulement si tu l'as invité** (signups fermés). S'il n'est pas
> invité, Supabase refuse. C'est voulu.

## 2. Ce que le client remplit de SON côté (white-label)

Une fois connecté, il rend l'OS à SA marque dans `Réglages` :

- **Agence** → `Nom d'agence`, `Closer`, `Lien de réservation` (Cal.com/Calendly).
- **Mon offre** → `Ville`, `Ce que tu vends` (une ligne), `Proposition de valeur`.
  → pilote ses **documents** (audit cadeau, projection) et l'**identité de l'IA**
  (elle parle en son nom, vend SON offre — jamais EAGLEYE).
- **Tarifs — mon offre** → setup, part sur CA, paliers → pilote sa page `/offre`.
- **Règles business** → sa doctrine, injectée dans chaque génération IA.
- **Coffre à clés / env** → SES credentials pour que ça tourne CHEZ LUI :
  - clé IA (Anthropic, ou NVIDIA / Ollama local) — côté serveur uniquement ;
  - domaine d'envoi + SPF/DKIM/DMARC (`Réglages → Délivrabilité`) ;
  - éventuellement son propre Stripe / n8n / webhook entrant.

> Principe : **le client apporte ses propres clés**. L'infra tourne à SON nom, sur
> SES quotas, avec SA délivrabilité. Toi tu fournis l'OS et l'accès.

## 3. Isolation — ce qui est garanti (et ce qui reste à prouver)

- **Garanti par conception** : RLS Supabase par `user_id` — chaque compte ne lit
  que ses lignes (prospects, campagnes, RDV, tracking). JWT vérifié en middleware
  (fail-closed si `REQUIRE_AUTH`). Tables service-role scoupées par locataire.
- **À prouver avant facturation** : le test deux-comptes du §0.5. Non négociable.

## 4. Facturation (si tu factures l'accès)

- Le client ouvre `/compte` → carte facturation → **Stripe Checkout** (self-serve).
- Tiers : `free` (quota gratuit) → `active` (abonnement Stripe payé) → `owner` (toi).
- Webhook `POST /api/webhooks/stripe` (signature HMAC vérifiée) met à jour
  `subscriptions`. Quota mensuel appliqué via `lib/plans.ts` (FREE_TIER).
- Variables serveur requises : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_ID` (voir `docs/FACTURATION.md`).

## 5. Fermer / suspendre un compte

- Supabase → Authentication → Users → **Delete / ban** l'utilisateur.
- Ses données restent isolées ; supprime ses lignes si demandé (droit RGPD à
  l'effacement — voir DPA `legal/DPA.md`).

---

### Récapitulatif — les deux modèles (rappel)

| | **Concierge (défaut)** | **Self-serve (viral)** |
|---|---|---|
| Signups Supabase | OFF — tu invites | ON — lien `/login` public |
| Qui entre | Ceux que tu invites | Quiconque a le lien |
| Bon pour | Clients triés, haute valeur | Croissance de masse |

Le code supporte les deux sans changement — seul le toggle Supabase + la diffusion
(ou non) du lien `/login` décident.
