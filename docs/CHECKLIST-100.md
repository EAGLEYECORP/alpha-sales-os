# Ce que TU fais pour que tout tourne à 100 %

**EAGLEYE CORP · ALPHA SALES OS®**

Je ne peux pas me connecter à tes comptes Vercel et Supabase depuis ici (je
n'ai pas tes accès). Voici donc **la liste exacte, dans l'ordre**, de ce qu'il
te reste à faire. Coche au fur et à mesure. Rien de tout ça ne prend plus de
quelques minutes.

Légende : ⏱ temps · 🎯 ce que ça débloque · ⚠ sans ça

---

## Étape 0 — Mettre l'app en ligne (le socle)

Tant que l'app n'est pas en ligne (HTTPS), **le micro ne marche pas** et le
cron du matin n'a rien à joindre.

- [ ] **Créer le projet Vercel** ⏱2 min
  [vercel.com/new](https://vercel.com/new) → *Import Git Repository* →
  `EAGLEYECORP/alpha-sales-os` → framework **Next.js** (auto) → *Deploy*.
- [ ] **Mettre CE travail en prod** ⏱1 min
  Vercel → *Settings → Git → Production Branch* → choisis
  `claude/crm-n8n-email-tracking-4qxtwr`.
  🎯 l'adresse principale sert la dernière version. ⚠ sinon tu vois l'ancienne.
- [ ] **Protéger l'accès** ⏱1 min
  Vercel → *Settings → Environment Variables* → `SITE_PASSWORD` = un mot de
  passe à toi. 🎯 personne d'autre n'entre. ⚠ sinon l'app est publique.
- [ ] **Ouvrir l'app sur ton téléphone**, autoriser le micro (cadenas →
  Autorisations → Microphone). 🎯 Débrief terrain + assistant d'appel.

> Après chaque ajout de variable : Vercel → *Deployments → Redeploy*.

---

## Étape 1 — Supabase (mémoire durable, multi-appareil) ⏱5 min

Sans Supabase, l'app marche mais tes données vivent dans **un seul
navigateur**. Avec, elles suivent, et le tracking/inbound deviennent durables.

- [ ] **Créer le projet** [supabase.com](https://supabase.com) → *New project*
  (région **Paris**). Note l'**URL** et la clé **anon public**
  (*Settings → API*).
- [ ] **Créer les tables** : *SQL Editor → New query* → colle **tout**
  `supabase/schema.sql` du dépôt → *Run*.
- [ ] **Lier dans l'app** (pas de redéploiement) : **Réglages → Supabase** →
  colle URL + clé anon → *Lier*.
- [ ] **Pour le tracking/inbound côté serveur** : ajoute en variable Vercel
  `SUPABASE_SERVICE_ROLE_KEY` (*Supabase → Settings → API → service_role*).
  ⚠ jamais dans le navigateur, seulement côté serveur (Vercel).

---

## Étape 2 — Les emails (envoi + brouillons Gmail) ⏱5 min

- [ ] **Mot de passe d'application Gmail** : compte
  `eagleyecorp.ad@gmail.com` → validation en 2 étapes activée →
  [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
  → crée-en un pour « Courrier ».
- [ ] **Vérifier qu'IMAP est activé** : Gmail → Paramètres → POP/IMAP →
  *Activer IMAP*.
- [ ] **Variables Vercel** :
  `SMTP_HOST=smtp.gmail.com` · `SMTP_PORT=587` ·
  `SMTP_USER=eagleyecorp.ad@gmail.com` · `SMTP_PASS=<le mot de passe 16 car.>` ·
  `SMTP_FROM=EAGLEYE CORP <eagleyecorp.ad@gmail.com>`.
  🎯 Boîte d'envoi **et** brouillons Gmail HTML (le même identifiant sert aux deux).

---

## Étape 3 — L'alerte urgente sur ton téléphone ⏱3 min

- [ ] **SMS** (recommandé) : crée une clé sur
  [textbelt.com](https://textbelt.com) → variables Vercel
  `TEXTBELT_KEY=<clé>` et `ALERT_PHONE=<ton mobile, format +33…>`.
  🎯 le bouton « M'envoyer le récap » (onglet Aujourd'hui) et le cron du matin.
- [ ] *(ou repli email)* `DIGEST_EMAIL=<ton email>` (utilise déjà les SMTP
  de l'étape 2).

---

## Étape 4 — L'IA (optionnel mais gratuit) ⏱2 min

- [ ] **NVIDIA NIM** (gratuit) : clé sur
  [build.nvidia.com](https://build.nvidia.com) → variable Vercel
  `NVIDIA_API_KEY=nvapi-…`.
  🎯 affine les débriefs et l'extraction de recherche. ⚠ sans elle, repli sur
  les moteurs déterministes (ça marche quand même).

---

## Étape 5 — n8n (le pilote automatique, quand tu es full terrain) ⏱15 min

n8n tourne en continu (chez toi ou hébergé) et fait vivre l'app pendant que tu
es dehors. Importe les workflows du dossier `integrations/n8n/` :

- [ ] `alpha-inbound.workflow.json` — capte les réponses, gère les STOP
  (variable partagée `WEBHOOK_SECRET`, identique côté app et n8n).
- [ ] `alpha-digest-urgent.workflow.json` — **le SMS urgent chaque matin
  7h30** (variable n8n `APP_BASE_URL` = l'adresse Vercel).
- [ ] `alpha-crm-sync.workflow.json` — tient le Google Sheet à jour.
- [ ] `alpha-tracking-sync.workflow.json` — remonte ouvertures/clics.
- [ ] `alpha-error-alert.workflow.json` — te prévient si un workflow rougit.

Détail par workflow : `integrations/n8n/README.md`.

---

## Étape 6 — Les délivrabilités DNS (pour ne pas finir en spam) ⏱10 min

- [ ] **eagleye.fr** : publier un enregistrement DMARC + activer DKIM (OVH).
  Détail : `docs/ENVOI.md`.
- [ ] **scintia.ai** (pour ton partenaire) : le constat est prêt à envoyer —
  `docs/SCINTIA-MESSAGE.md`.

---

## L'ordre minimal si tu ne fais qu'une chose aujourd'hui

1. **Étape 0** (déployer + micro) — 5 min, et le terrain est équipé.
2. **Étape 3** (SMS urgent) — 3 min, et tu es alerté sans ouvrir l'app.

Le reste se rajoute quand tu veux. Chaque étape est indépendante : l'app ne
casse jamais parce qu'une clé manque — elle désactive juste la capacité
concernée et te le dit.

---

## Comment vérifier que ça tourne

- **`/api/health`** (ajoute-le à l'adresse de l'app) → état de Supabase, SMTP,
  IA, tracking.
- **Onglet « À décider »** → si tout est vide, ton pipe est propre.
- **Bouton « M'envoyer le récap »** (Aujourd'hui) → si tu reçois le SMS, la
  chaîne d'alerte est bonne.
