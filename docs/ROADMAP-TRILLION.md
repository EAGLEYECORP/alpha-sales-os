# Plan d'exécution — de l'OS à la vente payante

> État vivant. `CLAUDE.md` porte la doctrine STABLE (comptes, tarifs, cible,
> sécurité) ; **ce fichier porte le PLAN et l'AVANCEMENT RÉEL**.
>
> Dernière révision : **2026-09-10** · **1 631 tests verts** · `tsc --noEmit`
> propre · `next build` propre · 179 modules `lib/`, 148 fichiers de test,
> 44 écrans.

> ⚠⚠ **CE FICHIER AVAIT 19 JOURS DE RETARD, et ce n'est pas un détail de
> tenue.** Il annonçait « 579 tests · révision du 22 août », décrivait une
> cadence de 5 rappels abandonnée le 2 septembre, listait French Tech 2030
> **deux fois dans la même section** avec deux états contradictoires, et
> marquait « rien ne vérifie qu'un agent est vivant » alors que la garde
> existe depuis le 9 septembre. Une session qui lit ça y croit : c'est le
> fichier prévu pour dire où on en est.
>
> **La règle qui en sort** : quand une décision tombe, elle se corrige ICI le
> jour même, ou ce fichier devient le plus dangereux du dépôt — celui qu'on
> consulte au lieu de lire le code.

## Le but, dit franchement
Zakaria a besoin de **ventes encaissées**, pas de fonctionnalités. Tout ce qui
suit est classé par « ça rapproche d'un virement bancaire ».

**État au 10/09/2026 : 0 € encaissé, 0 client, 0 appel sortant réel.** Le
produit est complet et gardé ; il n'a jamais rencontré un prospect.

---

## 🎯 LA CIBLE — décidée le 09/09/2026

**Le maître d'ouvrage professionnel dont le permis de construire est actif, sur
Lyon et Villeurbanne.** Détail doctrinal dans `CLAUDE.md`, play opérationnel
dans `docs/PERMIS-LYON.md`.

- [x] Trieur de permis (`lib/permis-construire.ts`) — exclusion sèche des
      maîtres d'ouvrage qui n'ont rien à vendre (particuliers, bailleurs
      sociaux, personnes publiques), phases datées, parseur tabulaire.
- [x] **Zone Lyon + Villeurbanne** — exclusion, plus dix points de score.
      Comptée à part dans le résumé du lot.
- [x] **ICP EAGLEYE** (`lib/accounts-commercial.ts`, serveur) — le compte
      maître était le seul du portefeuille sans client parfait déclaré.
- [x] **Jeu de démonstration refait** (`lib/seed.ts`) — 8 fiches issues de
      11 arrêtés, dont 3 volontairement écartés. `tests/seed-moa.test.ts`
      rejoue chacun dans le vrai trieur.
- [x] **Registre des offres** (`lib/offer-match.ts`) — les 15 champs passent du
      vocabulaire artisan à celui de la maîtrise d'ouvrage.
- [x] **Interdits du playbook exécutables** (`InterditFroid.motif`) — la
      verticale interdisait « vous ratez des appels » pendant que le catalogue
      le faisait dire.

**Ce que ça ne prouve pas** : zéro permis converti. Les seuils (6 logements,
score 55, poids par phase) sont des **décisions**, pas des mesures.

---

## ✅ CONSTRUIT ET TESTÉ

### Le moteur de vente
- [x] **Escalier de routage** (`lib/ladder.ts`) — visibilité → EAGLEYE ·
      volume d'appels → Alpha Voice/EAGLEYE · automatisation → EAGLEYE ·
      > 40 k → Nuwacom. Cascade, pas aiguillage.
- [x] **Deep-dive à l'import** (`lib/deep-dive.ts`) — déterministe, hors-ligne.
- [x] **Triage de lot** (`lib/import-triage.ts`), **signaux vitaux**
      (`lib/vital-signs.ts`), **Master rappel** (`lib/master-rappel.ts`).
- [x] **Argumentaire** (9 blocs), **checkpoints** (17 portes), **lead magnet**.
- [x] **La boucle** — les cinq arcs de retour, gardés par
      `tests/boucle-terrain.test.ts`.

### Alpha Voice
- [x] **Entrant opérationnel** — Telnyx → LiveKit → agent (`voice/INBOUND.md`).
- [x] **Cadence de relance : 3 rappels sur 2 jours** (`[3, 24, 32]` h), calés
      sur des fenêtres d'appel ouvertes, espacement minimum de 3 h.
      *(⚠ Ce fichier annonçait encore « 5 rappels » — abandonnés le
      02/09/2026. Le total fait 4 contacts, exactement au plafond du décret
      n° 2022-1313, jamais au-dessus.)*
- [x] **Article 50** — divulgation prononcée par le code, `auditScript` refuse
      un script non conforme.
- [x] **Passage de main sur INTÉRÊT QUALIFIÉ**, plus sur le décroché.
- [x] **Présence de l'agent** (`lib/presence-agent.ts` + migration 005) — le
      tick REFUSE de composer sans battement récent.
      *(⚠ Ce fichier disait « rien ne le vérifie aujourd'hui ». C'était vrai
      jusqu'au 09/09, plus depuis.)*

### L'exécution
- [x] **Orchestrateur** (`lib/campaign-runner.ts`), **runner manuel ET auto**,
      **autopilote** (`/api/campaign/tick`), **salle de contrôle** (`/controle`).
- [x] **Paliers de campagne** 10 · 100 · 1 000 — aucun ne se valide seul.
- [x] **Ordonnanceur `pg_cron` + `pg_net`** (migration 004) — jamais Vercel
      Cron, qui émet des `GET` là où l'exécution est en `POST`.
- [x] **Moniteur** (`/moniteur`) — lit le SERVEUR, jamais le store.

### Le produit
- [x] **Portefeuille de comptes** — EAGLEYE maître, Nuwacom, rituels distincts.
- [x] **Freemium** (`lib/entitlements.ts`) — socle gratuit, frontière payante,
      invariant « jamais sous le gratuit, jamais au-dessus sans preuve en base ».
- [x] **Inscription libre** + jeu de démonstration engendré depuis l'ICP.
- [x] **Vitrine publique**, **`/offre`**, **`/trajectoire`**, **`/ceo`**.
- [x] **API v1**, **calendrier iCal**, **Notion (écriture)**, **Web Push**.
- [x] **Cloisonnement serveur** (`lib/lecture-serveur.ts`) — lecture bornée et
      filtrée par propriétaire, appliquée aux cinq appelants.

### La tenue (sécurité + données)
- [x] **Dépôt rendu PRIVÉ** + données personnelles sorties dans
      `donnees-privees/` (ignoré par git).
- [x] **Garde structurelle des numéros** — plages ARCEP fiction uniquement.
- [x] **Export public curé** (`scripts/export-public.mjs`) — liste
      d'autorisation + scanner de ce qui sort.
- [x] Injection de prompt, SSRF, force brute, fuites d'en-têtes forgés.

---

## ⏳ CE QUI RESTE

### 🔴 Bloqué sur Zakaria — je ne peux pas le faire d'ici
- [ ] **Rotate les clés NVIDIA + Fish** — collées en clair dans une
      conversation. **Toujours pas fait.**
- [ ] **Migrer le LLM hors du tier gratuit NVIDIA** — la licence **interdit la
      production**. Coût réel : < 3 € pour 1 000 appels.
- [x] ~~Créer `noreply@eagleyecorp.fr`~~ — **abandonné le 10/09/2026 : on part
      sur `contact@eagleyecorp.fr`**, qui existe et que quelqu'un LIT. Un
      `noreply@` en expéditeur de prospection annonce « ne répondez pas » à
      quelqu'un dont on attend une réponse.
      > ⚠ Le prix est réel et il est écrit : le transactionnel et le
      > commercial partagent une seule boîte. Une campagne qui prend des
      > plaintes fait tomber les mails d'inscription **en même temps**, sans
      > qu'aucun code change. Ce qui limite le risque : la montée en charge
      > de `lib/email-ramp.ts` (5/jour la première semaine) — mais elle coupe
      > l'**ÉCRAN** `/outbox`, **pas le serveur**. Le serveur ne connaît que
      > `MAX_SENDS_PER_HOUR` (40/h). Le palier du jour tient donc par
      > l'USAGE, pas par une contrainte : pendant les premières semaines,
      > envoyer depuis la Boîte d'envoi et de nulle part ailleurs. Détail :
      > [`SMTP-SUPABASE-AMEN.md`](./SMTP-SUPABASE-AMEN.md).
- [ ] **Retrouver le mot de passe de `contact@`** et le poser dans Supabase
      SMTP + `SMTP_*`. ⚠ Le réinitialiser coupe la réception le temps de
      reconfigurer les clients mail — pas le matin du lancement.
- [ ] **SPF, DKIM, DMARC sur `eagleyecorp.fr`.** ⚠ Un SPF existe déjà
      (l'adresse fonctionne) : on le MODIFIE, on n'en ajoute pas un second —
      deux SPF valent zéro SPF.
- [ ] **Séparer les domaines d'envoi**, quand le volume le justifiera :
      transactionnel sur une boîte dédiée, prospection sur un sous-domaine.
      Repoussé, pas annulé.
- [ ] **Extraire la liste de permis** Lyon + Villeurbanne — l'egress de la
      sandbox bloque `data.grandlyon.com` (mesuré, `HTTP 403`).
- [ ] **Relever les téléphones à la main** — un export de permis ne porte
      aucun numéro. C'est la troisième colonne de la doctrine.
- [ ] Migrations Supabase **002 + 003 + 004 + 005**, `CRON_SECRET`, les deux
      secrets du Vault.
- [ ] `STRIPE_CONNECT_CLIENT_ID` (formule **Express**, décidée le 09/09).
- [ ] **Tarif Telnyx France réel** — premier poste variable, hypothèse à
      0,012 $/min, le relevé autorise un facteur 29.
- [ ] **UN appel sortant réel** — il valide toute la chaîne d'un coup.
- [ ] Changer `SITE_PASSWORD`. DNS Amen + domaines Vercel.

### 🟠 Trous connus, pas encore construits
- [ ] **Table `call_sessions`** — sans elle, l'historique repart à zéro à
      chaque déploiement.
- [ ] **`meetings` n'a pas de colonne propriétaire** — la lecture est bornée,
      pas cloisonnée. Nommé, pas corrigé.
- [ ] **Registre d'offres par verticale** — les 15 champs d'`OFFRES` sont
      GLOBAUX et parlent maîtrise d'ouvrage. Ils se prononcent aussi sur
      Nuwacom, dont l'ICP est l'assurance. Dette assumée, testée, à lever
      quand un deuxième marché entre.
- [ ] **La montée en charge d'envoi n'est pas appliquée côté serveur.**
      `lib/email-ramp.ts` coupe la file de `/outbox` ; `/api/send` ne connaît
      que le plafond horaire. Un autre appelant (revue de campagne,
      newsletter, recette) peut dépasser le palier du jour. Devenu structurant
      depuis que le transactionnel et la prospection partagent `contact@`.
- [ ] **Attribution des apporteurs** — code de parrainage + capture à
      l'inscription.
- [ ] **Historique Alpha CEO** + sondes pour les 5 pannes non surveillées.
- [ ] Calendrier bidirectionnel (OAuth non testable ici), Notion en lecture.
- [ ] **Vidéo de lancement** — l'ouverture est provisoire.

### ⚫ Décidé — la porte est fermée, ce n'est plus une tâche
- **French Tech 2030 : NON ÉLIGIBLE, et l'échéance est passée.** Le critère
  d'entrée est **3 M€ de financements et/ou de CA cumulés depuis 2024** ;
  EAGLEYE CORP est à 0 €. Le seuil est éliminatoire et la promotion suivante
  appliquera le même. Porté par le CODE depuis le 10/09
  (`Opportunity.bloquant`), plus seulement par un README.
  *(Ce fichier le listait DEUX FOIS dans la même section, avec deux états
  contradictoires. Le dossier écrit resservira pour Bpifrance ou une page de
  vente — c'est tout ce qu'il reste à en attendre.)*
- **L'accord revendeur est mort** (02/09/2026). L'offre vocale est revenue chez
  EAGLEYE sous le nom **Alpha Voice**, à 100 %.

---

## Limites — à redire, parce qu'elles ne bougent pas
1. **Rien n'a été testé en conditions réelles.** Le proxy de la sandbox bloque
   Telnyx, LiveKit, Vercel, Supabase et les portails d'open data. Les 1 628
   tests prouvent que la logique est cohérente ; ils ne prouvent pas qu'un
   appel part.
2. **Aucune automatisation ne closera à ta place.** L'OS source, qualifie,
   appelle, relance et prépare. La signature reste humaine.
3. **Juillet 2026 : 78 prospects, 132 appels, 18 audits, 0 vente.** Le goulot
   n'était pas l'outillage. C'est une hypothèse, pas un acquis.
4. **179 modules pour un opérateur solo.** Ce qui n'est pas utilisé devient de
   la dette. Mieux vaut trois écrans maîtrisés que quarante survolés.
5. **Zéro preuve sociale disponible, et c'est structurel.** Pas de témoignage,
   pas de logo, pas d'affiliation. Ce qui remplace : ses chiffres à lui, une
   démonstration en direct, une garantie chiffrée.

## L'ordre qui rapporte
`le mot de passe de contact@ + DNS` → `la liste de permis` → `les numéros à la main` →
`UN appel réel` → `rotate les clés` → `table call_sessions` → le reste.

> ⚠ Les trois premiers sont chez Zakaria et rien ne part sans eux. Le
> premier s'est allégé le 10/09 : la boîte n'est plus à créer, seulement à
> configurer. Le reste du
> dépôt est prêt et gardé ; il attend une liste et une boîte mail.
