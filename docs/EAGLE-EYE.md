# Vue d'aigle — ALPHA SALES OS : où on en est vraiment

> Lecture stratégique **honnête**, sans hype. Ce qu'il y a, ce qui est fort, ce
> qui manque, ce qui colle au marché, et **la valeur réelle**. Écrit pour
> décider, pas pour se rassurer.

## 1. Ce qu'il y a (l'inventaire réel)

- **34 écrans**, **27 routes API**, **63 modules**, **173 tests**, **12 workflows n8n**, **30 docs**.
- Un vrai **CRM/pipeline** opinionné (doctrine Hormozi : « la décision EST le produit »).
- **Prospection multi-canal** : e-mail HTML tracké, LinkedIn assisté, séquences, relances.
- **IA** en cascade (Ollama local → NVIDIA → Claude) : agent, audits, sparring, coaching.
- **Voix** : appels sortants (LiveKit + Fish), transcription, débrief terrain.
- **Studio social** (LinkedIn/X/Meta) + génération vidéo (json2video).
- **SaaS-ready** : comptes multi-locataires, RLS + JWT + isolation prouvée par tests,
  facturation Stripe, accès propriétaire, freemium défini.
- **Local-first / BYO-creds** : tourne sans cloud, données chez l'utilisateur.

C'est **un produit réel et substantiel** — l'équivalent de plusieurs mois de dev
senior, pas un prototype.

## 2. Ce qui est fort (les vrais différenciateurs)

1. **Opinionné, pas neutre.** Un CRM générique attend que tu saches vendre.
   Alpha impose une **méthode** (obstacles vs objections, démo avant prix, 3
   croyances, next-step daté). Pour un commercial terrain, c'est un coach, pas un
   tableur. **Rare sur le marché.**
2. **Local-first / one-person-business.** Tes données, tes clés, ton serveur.
   C'est exactement la vague « Buzz / one-person business » (cf. VEILLE-OUTILS).
   Anti-lock-in : argument fort face aux SaaS qui séquestrent la donnée.
3. **Voix + terrain.** Débrief vocal, appels sous garde-fous légaux, mobile.
   Peu d'outils vente couvrent le terrain vocal proprement.
4. **Zéro-dépendance / artisanat.** Sécurité (JWT, Stripe, IMAP faits main),
   testés. Dette faible, surface d'attaque maîtrisée. Rare et sain.
5. **Bilingue France-first.** Doctrine et conformité (RGPD, Bloctel, Art. 50 IA)
   pensées pour le marché FR — un angle que les US-first ignorent.

## 3. Ce qui colle au marché (usage réel)

- Abonnement SaaS, IA d'assistance, tracking e-mail, multi-canal : **standard
  attendu** — on est dans les clous.
- Positionnement **agentique / one-person business** : **en avance** sur la vague
  (bon timing).
- Freemium local-first : **différenciant** et dans l'air du temps (open/anti-SaaS).

## 4. Ce qui manque (vs marché ET vs « vraie boîte »)

**Produit / marché :**
- **Intégrations** : pas d'écosystème (Google Calendar réel, import CRM standard,
  Zapier/Make, LinkedIn API, Slack). Le marché attend des connecteurs.
- **Mobile natif** : PWA seulement ; un commercial terrain veut une app.
- **Analytique** : KPIs présents, mais pas de reporting profond / prévisions.
- **Délivrabilité prouvée** : l'e-mail marche, mais réputation d'envoi = le nerf ;
  à durcir (SPF/DKIM/DMARC guidés, warm-up).
- **Équipe** : mono-utilisateur ; le B2B veut rôles, partage, manager view.
- **Onboarding self-serve** : l'assistant existe, mais l'activation « en 5 min
  sans toi » n'est pas prouvée.

**Business / crédibilité :**
- **Traction = 0 client payant prouvé.** C'est LE trou.
- **Rien prouvé en réel** : Supabase/Stripe testés en synthétique, pas en prod.
- **Juridique** : projets prêts, pas validés par avocat, pas en ligne.
- **Marque / distribution** : pas de notoriété, pas de moteur d'acquisition rodé.
- **Sécurité entreprise** : pas de SOC2/ISO ; bloquant pour les gros comptes.

## 5. La valeur réelle — sans se mentir

**Comme actif logiciel (IP + code) :** *sérieux.* Un SaaS de vente multi-locataire,
opinionné, testé, avec voix et local-first — c'est un vrai socle, difficile et
long à reconstruire. Si tu devais le faire chiffrer comme développement : plusieurs
dizaines de milliers d'euros de travail incorporé, facilement.

**Comme entreprise (valeur de marché) :** *aujourd'hui, proche de l'option, pas de
la rente.* La valeur d'une boîte SaaS ≈ sa traction (revenus récurrents × rétention).
À **0 client payant**, la valeur d'entreprise réelle est faible **quel que soit le
code** — parce que rien n'est encore prouvé sur un marché. Ce que tu détiens, c'est
une **optionalité forte** : un produit prêt à convertir.

**Le point d'inflexion, chiffré :** les **5 à 10 premiers clients payants qui
restent 3 mois**. Ça transforme « beau produit » en « business » et multiplie la
valeur perçue par 10 à 100. Tout le reste (features, marque) vient après ça.

### Verdict en une phrase
> **Produit d'exception, entreprise à prouver.** Le code te met déjà dans le
> 1 % — mais la valeur ne se matérialise qu'avec les premiers euros récurrents.
> Priorité absolue : **prouver (Supabase/Stripe réels) → 3 documents légaux en
> ligne → 5 clients payants.** Pas plus de features avant ça.

## 6. Les 5 prochains gestes (ordre de valeur décroissante)

1. **Prouver en réel** : `verify:rls` à 2 comptes + 1 paiement Stripe test (1 j).
2. **Légal en ligne** : faire valider les 4 docs par un avocat Lyon, les publier (1 sem).
3. **10 démos** : viser 5 commerciaux/agences, closer 3-5 payants (le vrai test).
4. **Délivrabilité + intégrations minimales** (Calendar, import CSV pro) : réduire
   la friction d'activation.
5. **Ensuite seulement** : mobile, équipe, analytique — selon ce que les 5 clients demandent.
