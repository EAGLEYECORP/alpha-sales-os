# Checklist de lancement — ce qui BLOQUE, dans l'ordre

> Ce document dit **quoi faire et dans quel ordre**. Le **comment** (setup
> machine, gabarit `.env.local`, ordre de démarrage des trois process,
> dépannage) est dans `docs/LANCEMENT.md`, qui reste la référence
> opérationnelle. Les deux se lisent ensemble.
>
> Ordre imposé par les dépendances, pas par le confort. Chaque bloc suppose le
> précédent fait. Rien ici n'a été vérifié en conditions réelles : le sandbox
> de développement n'atteint ni Telnyx, ni LiveKit, ni Vercel, ni Supabase.
>
> **Un seul test compte vraiment : un appel réel qui aboutit.** Tout le reste
> peut attendre.

---

## BLOC 0 — Ce qui est déjà brûlé (à faire aujourd'hui, avant tout)

- [ ] **Faire tourner la clé NVIDIA** (deux ont été collées en clair dans une
      conversation).
- [ ] **Faire tourner la clé Fish Audio** (idem).
- [ ] Ne plus jamais coller une clé dans un chat. Les variables passent par
      Vercel → Environment Variables, jamais par un message.

Une clé exposée reste exposée. Tant que ce n'est pas fait, tout le reste
s'appuie sur des secrets compromis.

---

## BLOC 1 — L'appel qui prouve que ça existe

Sans ça, Alpha Sales OS est un logiciel de gestion. Avec ça, c'est un produit.

- [ ] Poser `VOICE_WEBHOOK_SECRET` (sinon la salle de contrôle affiche
      « journal d'appels : non autorisé » — c'est visible sur la capture).
- [ ] Vérifier le trunk Telnyx → `5mwzznpudte.sip.livekit.cloud`, port 5060 UDP.
      ⚠ Le préfixe SIP LiveKit est **aléatoire**, ce n'est PAS le slug du
      projet — c'est le bug qui a coûté le plus de temps.
- [ ] **Passer UN appel entrant réel** sur `+33451222182`. Écouter la première
      phrase : elle doit annoncer l'IA (art. 50), prononcée par le code.
- [ ] **Passer UN appel sortant réel**, sur ton propre numéro d'abord.
- [ ] Tirer l'**export CDR Telnyx** (Reporting → Usage Reports) et reporter le
      tarif minute réel dans `lib/voice-costs.ts` (`telnyx`). Seule ligne du
      modèle jamais vérifiée, et la plus lourde. Ce qu'on sait depuis le
      27/08 : 2,05 $ dépensés sur le mois dont ~1 $ de numéro — un PLAFOND,
      pas un tarif. Selon le volume réel, ça vaut de 0,018 à 0,35 $/min, soit
      ×1,5 à ×29 l'hypothèse. L'écart décide de la marge.
- [ ] Relever le **compteur Fish AVANT et APRÈS un appel isolé** (30 s de
      travail). Fish a été mesuré à ×2,24 l'hypothèse — 4 922 octets pour
      ~3 min, soit plus de parole que l'appel n'a duré. La piste « on paie de
      la synthèse jamais entendue » est **écartée** : `livekit-agents` 1.7.1
      a `preemptive_tts: False` par défaut et l'agent ne le surcharge pas.
      Reste le compteur cumulé sur plusieurs essais — auquel cas le coût réel
      est plus BAS que ce que le modèle retient, et la marge meilleure.

**Ne rien facturer avant ce bloc.** Le tier gratuit NVIDIA interdit
contractuellement l'usage de production ; conduire des transactions
commerciales dessus nous met en infraction. Le modèle de coût retient déjà un
LLM payant, c'est le seul chiffrage honnête.

- [ ] Migrer le LLM vers une offre payante avant la première facture.

---

## BLOC 2 — Le déploiement

- [ ] DNS chez Amen → Vercel.
- [ ] `SITE_PASSWORD` posé. ⚠ **Il ne mure plus l'app entière** (décision du
      27/08) : il garde `ADMIN_PREFIXES` — `/payouts`, `/offre`, `/api/sync` —
      et tout le reste TANT QUE la serrure de remplacement n'est pas en place.
      `/vitrine`, `/souscrire`, `/sw.js`, le manifeste et les crons sont
      publics par conception.
- [ ] **Les quatre variables qui décident de tout**, à poser ensemble :
      `OWNER_EMAILS` et `NEXT_PUBLIC_OWNER_EMAILS` (**la même valeur** — si
      elles divergent, l'écran promet ce que le serveur refuse), plus
      `REQUIRE_AUTH=1` et `SUPABASE_JWT_SECRET`. Sans ces deux dernières, le
      mur ne se lève jamais et tes clients restent dehors **sans erreur
      visible**. Réglages → État système → **Compte propriétaire** le dit.
- [ ] Variables d'environnement : il y en a **63**, toutes documentées dans
      `.env.example` (un test le vérifie). Utiliser Réglages → État système,
      qui liste exactement ce qui manque.
- [ ] `CRON_SECRET` + brancher l'ordonnanceur sur `/api/campaign/tick` et
      `/api/push/tick`. ⚠ Sans `CRON_SECRET`, ces routes **refusent tout** —
      c'est voulu, mais rien dans la réponse ne le relie au réglage.
- [ ] `CALENDAR_TOKEN` pour le flux iCal.
- [ ] `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` pour les notifications.
- [ ] Vérifier que `/vitrine` est bien indexable et que l'app ne l'est pas.

---

## BLOC 3 — Les tables Supabase

Le SQL existe désormais en MIGRATIONS. ⚠ `supabase/schema.sql` est en
`create table if not exists` : sur une base déjà créée **il ne fait rien**, et
le SQL Editor annonce quand même « Success ». Passe les migrations.

- [ ] `supabase/migrations/001-proprietaire-et-tables-serveur.sql` —
      crée `propositions`, `call_sessions`, `push_subscriptions` et corrige
      `prospects.user_id`. Sans `call_sessions`, la salle de contrôle reste
      muette ; sans `push_subscriptions`, aucune notification hors-app.
- [ ] `supabase/migrations/002-entitlements.sql` — crée `entitlements`, la
      table que le middleware interroge à CHAQUE requête. **Sans elle, un
      client paie et l'application le refuse** : le webhook enregistre
      l'abonnement, le middleware ne trouve aucun droit, `DROIT_REFUSE`.
      ⚠ À passer AVANT de poser `REQUIRE_AUTH` : dès que les comptes sont
      actifs, tout compte non provisionné est refusé — y compris le tien si
      `OWNER_EMAILS` n'est pas posé.
- [ ] `prospects` — ⚠ **elle est lue par l'autopilote et remplie par
      personne.** Aucun composant de l'app ne pousse le CRM vers Supabase. Tant
      que la synchro n'existe pas, `/api/campaign/tick` tourne à vide en
      renvoyant `ok: true`. C'est un chantier, pas un réglage.

---

## BLOC 4 — La première vente

Rien de technique ici, et c'est le bloc qui compte.

- [ ] ~~**Envoyer le devis du revendeur**~~ — **caduc, accord terminé**. ⚠ Ce qui suit reste vrai pour tout devis : le devis
      historique est 3 500 € + 364 €/mois, mais la grille publique propose
      désormais un **essai terrain à 290 € HT** (mise en route + 100 appels
      réels, déduits du 1er mois). Le parcours recommandé dans
      `docs/PRICING.md` est démo gratuite → essai payant → mensualité — c'est
      l'essai qui donne le premier taux de décroché mesuré, celui qui remplace
      l'hypothèse à 20 % dans toute l'app. Décide lequel part, mais décide.
- [ ] **Dépôt French Tech** — échéance **2026-09-04 23:59**.
- [ ] Choisir **un** prospect du pipe de juillet et le closer. Un seul.

**Zéro vente à ce jour.** Une suite de tests complète, et aucun euro. Tout ce qui est construit
est une hypothèse tant que ce bloc n'est pas entamé — le code n'a jamais été
le facteur limitant.

---

## BLOC 5 — Avant de facturer un CLIENT de l'OS

À ne faire qu'après le bloc 4.

- [ ] Tester à **deux comptes réels** : un client mono-brique, un maître.
      Le test qui compte n'est **pas** la navigation, c'est un `fetch` direct
      vers une API interdite → doit renvoyer 403.
- [x] ~~Brancher le webhook Stripe sur `entitlements.bricks`~~ — **fait le
      27/08**. Le webhook provisionne les droits à l'encaissement (et
      seulement à l'encaissement), et les REFERME à la résiliation. Reste à
      le prouver sur un vrai compte Stripe : `docs/FACTURATION.md`, étape 4,
      qui vérifie LES DEUX tables et la résiliation.
- [ ] Créer les **quatre** prix Stripe (`STRIPE_PRICE_ESSAI`, `_SOLO`, `_PRO`,
      `_VOIX_1000`). ⚠ L'essai est un paiement **UNIQUE** : le créer en
      récurrent prélèverait 290 € tous les mois à quelqu'un qui croyait payer
      une mise en route.
- [ ] **Ce qu'on peut vendre** : « accès limité à ce que tu as payé ».
      **Ce qu'on ne peut pas encore promettre** : « le code des autres briques
      t'est invisible ». Le JavaScript reste téléchargeable — le serveur
      refuse la donnée et l'action, pas la lecture de l'interface.
- [ ] Décider si le découpage du bundle par brique vaut le chantier.

---

## Les limites connues, à dire plutôt qu'à découvrir

| Limite | Où ça casse |
|---|---|
| **~500 fiches** | la frappe dans les Notes devient perceptible |
| **~1 500 fiches** | quota localStorage → les écritures échouent (une alerte s'affiche, rien n'est perdu en silence) |
| **2 000 prospects** | l'autopilote tronque — il le dit maintenant dans sa réponse |
| **400 leçons** | plafond de la mémoire de terrain ; au-delà, les plus anciennes partent |

Le correctif de fond — sortir les prospects de localStorage vers Supabase —
n'a de sens qu'après les premières ventes.

---

## Ce qui est prêt et qui n'attend rien

Pour mémoire, parce que la liste ci-dessus donne une impression sombre :

- **Chaque garde-fou vérifié par MUTATION** — on casse la
  garde, on confirme que le test échoue, on restaure ;
- **le tunnel de vente complet** : `/vitrine` → `/souscrire` → compte →
  paiement Stripe → encaissement → ouverture des droits → onboarding daté →
  résiliation qui referme. Chaque maillon a été cassé et retesté ;
- la doctrine tenue **par construction** — le générateur de présentation ne
  peut pas produire un prix avant l'étape offre ;
- l'article 50 prononcé par le code, et `audit_script` qui refuse un script
  non conforme ;
- aucune dépendance tierce sur les briques qui touchent la donnée métier —
  ce qui reste à auditer, c'est notre propre code ;
- la grille tarifaire, les données de prospects réels et l'économie du
  portefeuille **hors** des bundles navigateur (mesuré sur le build) — ET
  hors de portée d'un client connecté depuis le 27/08 : `/api/pipeline`,
  `/api/voice-costs` et `/api/knowledge` sont réservés au compte maître, ce
  qui n'était pas le cas (une brique `crm` suffisait à charger nos fiches
  réelles) ;
- un **taux horaire** relevé sur le marché (71 €/h, TJM 500 €), qui débloque
  le chiffrage des dix briques et de tout devis de setup.
