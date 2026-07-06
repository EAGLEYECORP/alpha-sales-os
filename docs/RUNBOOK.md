# RUNBOOK — installer, lancer, scaler ALPHA SALES OS®

De « zéro » à une machine à RDV qui tourne. Puis les **checkpoints de montée
en charge** : 100 → 1 000 → 10 000 → 100 000 prospects. La règle d'or de la
délivrabilité : **la réputation se gagne lentement et se perd vite.** On
augmente le volume par paliers, jamais d'un coup.

---

## 1. Installer (≈ 30 min)

### Le tableau de bord (cette app)
```bash
npm install
npm run build && npm start      # http://localhost:3000
# ou déploiement : Vercel (Import repo → Deploy)
```
Au 1er lancement, l'**assistant de configuration** s'ouvre. Sinon :
Réglages → Connexion n8n → « Relancer l'assistant ».

### Le cerveau (n8n)
1. `npx n8n` (local) ou n8n Cloud.
2. **Import from File** : `integrations/n8n/alpha-dashboard-api.workflow.json`
   (API du tableau de bord) + `alpha-crm-agent.workflow.json` (agent).
3. Nœud **Webhook** → `Allowed Origins (CORS) = *`, active le workflow, copie
   l'URL de Production.
4. Colle l'URL dans l'assistant → **Tester** → **Importer mes prospects**.

### La mémoire (Google Sheets)
`integrations/google-apps-script/` : colle `Code.gs`, menu 🦅 → Initialiser →
Charger les régies. Déploie le Web App (token). n8n lit/écrit ici.

### L'envoi (SMTP)
Renseigne `SMTP_HOST/PORT/USER/PASS/FROM` (voir checkpoints ci-dessous pour le
choix de l'infra selon le volume). `CLOSER_NAME` pour la signature.

### Vérifier
**Réglages → État du système** : tout doit passer au vert. `npm run build`
doit être clean.

---

## 2. La boucle qui tourne

```
n8n (trigger Sheet) → lit le prospect → génère le message selon l'étape
   → Switch : Email (draft) / RDV (Calendar) / relance
   → l'app RÉVISE (Campagnes → Réviser & envoyer) : l'humain valide
   → envoi (HTML + tracking) → ouvertures/clics → History du CRM
   → réponse « STOP » ? → n8n supprime + enfile un nouveau prospect
```

**Désinscription = STOP.** Pas de page ni de liste : le prospect répond STOP,
le webhook entrant le remonte, n8n le retire de la feuille et ajoute un
remplaçant. Le pied de chaque email l'indique ; le bouton natif Gmail envoie
aussi un STOP (List-Unsubscribe mailto).

---

## 3. Checkpoints de montée en charge

> Un « inbox » = une boîte d'envoi. Règle prudente : **~30–50 emails/jour/inbox**
> en régime établi, après **2–3 semaines de warmup**. On scale en ajoutant des
> **domaines** et des **inbox**, pas en poussant une seule boîte.

### 🟢 100 prospects — *valider le message*
- **Infra** : 1 domaine d'envoi (idéalement un domaine secondaire, pas ton
  domaine principal), 1 inbox (Google Workspace app-password ou SMTP dédié).
- **DNS** : **SPF + DKIM + DMARC** (`p=none` pour commencer).
- **App** : `MAX_SENDS_PER_HOUR≈20`, store mémoire OK, relecture manuelle de
  chaque email.
- **Objectif** : trouver le message qui déclenche des réponses. Taux de réponse
  cible ≥ 5 %. Rien à automatiser tant que le message ne convertit pas.
- **Piège** : envoyer 100 d'un coup depuis un domaine froid = spam immédiat.

### 🟡 1 000 prospects — *la première machine*
- **Infra** : 1–2 domaines d'envoi, 2–4 inbox, warmup terminé. SMTP dédié
  (Brevo/OVH/Postfix) plutôt que Gmail perso.
- **DNS** : DMARC en `p=quarantine`. Surveille **Google Postmaster Tools**.
- **App** : active **Supabase** (service role) → tracking + mémoire persistés
  (fini le store mémoire). `MAX_SENDS_PER_HOUR` réparti par inbox. Suivi des
  taux par industrie (Campagnes → Tracking par industrie).
- **Objectif** : flux régulier de RDV. Taux d'ouverture ≥ 40 %, réponse ≥ 5 %,
  bounce < 3 %, plaintes < 0,1 %.
- **Piège** : réutiliser le même texte partout → patterns détectés. Varier
  (variables + relecture).

### 🟠 10 000 prospects — *l'industrialisation*
- **Infra** : **plusieurs domaines** (5–10) × plusieurs inbox, **rotation**
  des expéditeurs, **IP dédiée(s)** chauffées. Passe à un vrai MTA / ESP
  (Postal, Mailu, Amazon SES, Sendgrid dédié).
- **Conformité** : au-delà de ~5 000/jour, les règles **Google/Yahoo 2024**
  imposent le **one-click unsubscribe (HTTPS)** — réintroduis un endpoint
  `List-Unsubscribe-Post` en plus du STOP (garde les deux). SPF+DKIM+DMARC
  **obligatoires**, alignés.
- **Validation de liste** : vérifie les emails **avant** envoi (bounce-check)
  pour protéger la réputation.
- **App** : Supabase obligatoire ; le rate-limit et la suppression doivent
  vivre en base (pas en mémoire mono-instance) ; monitoring délivrabilité
  (Postmaster + GlockApps).
- **Objectif** : volume prévisible, réputation stable. Bounce < 2 %, spam < 0,1 %.
- **Piège** : un pic ou une hausse de plaintes brûle un domaine — throttle par
  domaine, coupe au moindre signal.

### 🔴 100 000 prospects — *l'opération*
- **Infra** : **flotte** de domaines/IP, **pools de warmup** permanents, MTA
  cluster, **throttling par domaine récepteur** (Gmail/Outlook/…), traitement
  temps réel des **bounces + boucles de rétroaction (FBL)**, suppression et
  déduplication en base.
- **Équipe** : un(e) responsable délivrabilité ; ce n'est plus un réglage, c'est
  un métier. L'app reste le **cerveau/tableau de bord** ; l'envoi est une infra
  dédiée pilotée par n8n.
- **Process** : segmentation par secteur/marché, tests A/B continus, rotation et
  mise au repos des domaines, hygiène de liste automatisée.
- **Objectif** : machine multi-secteurs. Le MOAT n'est pas le volume — c'est la
  **qualité du ciblage + la doctrine de closing** (20 ans de cycle de vente
  encodés). Le volume sans qualité brûle la marque.
- **Piège** : croire que 100 000 « envois » = 100 000 opportunités. La bonne
  métrique reste le **RDV qualifié**, pas l'email parti.

---

## 4. Tableau de bord des métriques (par palier)

| Métrique | Bon | Alerte |
|---|---|---|
| Délivrabilité (inbox) | > 90 % | < 80 % |
| Taux d'ouverture | > 40 % | < 25 % |
| Taux de réponse | > 5 % | < 2 % |
| Bounce | < 2 % | > 4 % |
| Plaintes spam | < 0,1 % | > 0,3 % |
| RDV / 1 000 prospects | > 15 | < 5 |

Ouvertures/clics : Campagnes → Tracking (par client / par industrie).
CA projeté & modèle : page **Offre & Tarifs** (calculateur de ROI).

---

## 5. Le MOAT

L'outillage se copie. Ce qui ne se copie pas : **comprendre tout le cycle de
vente**. La doctrine est encodée dans le logiciel (obstacles ≠ objections, démo
avant prix, 3 Croyances à 10, next step daté, Taxe d'Ignorance chiffrée) — c'est
ce qui transforme un envoi en RDV, et un RDV en signature. On vend ça aux
entreprises qui ont besoin d'outreach et ne savent pas le faire.
