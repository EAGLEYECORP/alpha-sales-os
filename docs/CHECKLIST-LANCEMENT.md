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
- [ ] Relever le **tarif Telnyx France réel** de ton compte et le reporter dans
      `lib/voice-costs.ts` (`telnyx`). C'est la seule ligne du modèle de coût
      qui n'a jamais été vérifiée — tout le calcul de marge en dépend.

**Ne rien facturer avant ce bloc.** Le tier gratuit NVIDIA interdit
contractuellement l'usage de production ; conduire des transactions
commerciales dessus nous met en infraction. Le modèle de coût retient déjà un
LLM payant, c'est le seul chiffrage honnête.

- [ ] Migrer le LLM vers une offre payante avant la première facture.

---

## BLOC 2 — Le déploiement

- [ ] DNS chez Amen → Vercel.
- [ ] `SITE_PASSWORD` posé (l'app entière passe derrière ; `/vitrine`,
      `/sw.js`, le manifeste et les crons restent publics par conception).
- [ ] Variables d'environnement : il y en a **63**. Utiliser
      Réglages → État système, qui liste exactement ce qui manque.
- [ ] `CRON_SECRET` + brancher l'ordonnanceur sur `/api/campaign/tick` et
      `/api/push/tick`. ⚠ Sans `CRON_SECRET`, ces routes **refusent tout** —
      c'est voulu, mais rien dans la réponse ne le relie au réglage.
- [ ] `CALENDAR_TOKEN` pour le flux iCal.
- [ ] `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` pour les notifications.
- [ ] Vérifier que `/vitrine` est bien indexable et que l'app ne l'est pas.

---

## BLOC 3 — Les tables Supabase

Aucune n'existe encore. Le SQL est dans les documents cités.

- [ ] `call_sessions` — sans elle, la salle de contrôle reste muette.
- [ ] `push_subscriptions` — sans elle, aucune notification hors-app.
- [ ] `entitlements` — voir `docs/COMPTES-ET-BRIQUES.md`. **Créer et
      provisionner AVANT** de poser `SUPABASE_JWT_SECRET` : dès que les
      comptes sont actifs, tout compte non provisionné est refusé.
- [ ] `prospects` — ⚠ **elle est lue par l'autopilote et remplie par
      personne.** Aucun composant de l'app ne pousse le CRM vers Supabase. Tant
      que la synchro n'existe pas, `/api/campaign/tick` tourne à vide en
      renvoyant `ok: true`. C'est un chantier, pas un réglage.

---

## BLOC 4 — La première vente

Rien de technique ici, et c'est le bloc qui compte.

- [ ] **Envoyer le devis ScintIA** : 3 500 € + 364 €/mois. Il est prêt depuis
      des semaines et n'est jamais parti.
- [ ] **Dépôt French Tech** — échéance **2026-09-04 23:59**.
- [ ] Choisir **un** prospect du pipe de juillet et le closer. Un seul.

**Zéro vente à ce jour.** 33 000 lignes de code, 676 tests, et aucun euro. Tout
ce qui est construit est une hypothèse tant que ce bloc n'est pas entamé.

---

## BLOC 5 — Avant de facturer un CLIENT de l'OS

À ne faire qu'après le bloc 4.

- [ ] Tester à **deux comptes réels** : un client mono-brique, un maître.
      Le test qui compte n'est **pas** la navigation, c'est un `fetch` direct
      vers une API interdite → doit renvoyer 403.
- [ ] Brancher le webhook Stripe sur `entitlements.bricks` (aujourd'hui écrit
      à la main).
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

- 676 tests, dont les garde-fous vérifiés par mutation ;
- la doctrine tenue **par construction** — le générateur de présentation ne
  peut pas produire un prix avant l'étape offre ;
- l'article 50 prononcé par le code, et `audit_script` qui refuse un script
  non conforme ;
- zéro dépendance runtime — rien à auditer que notre propre code ;
- la grille tarifaire, les données de prospects réels et l'économie du
  portefeuille **hors** des bundles navigateur (mesuré sur le build).
