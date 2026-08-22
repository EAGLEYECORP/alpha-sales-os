# Plan d'exécution — de l'OS à la vente payante

> État vivant. `CLAUDE.md` porte la doctrine STABLE (comptes, tarifs, sécurité) ;
> ce fichier porte le PLAN et l'AVANCEMENT RÉEL.
> Dernière révision : 2026-08-22 · 579 tests verts · `tsc` clean · `next build` OK.

## Le but, dit franchement
Zakaria a besoin de **ventes encaissées**, pas de features. Tout ce qui suit est
classé par « ça rapproche d'un virement bancaire ».

---

## ✅ CONSTRUIT ET TESTÉ

### Le moteur de vente
- [x] **Escalier de routage** (`lib/ladder.ts`) — visibilité → EAGLEYE ·
      volume d'appels → ScintIA · automatisation → EAGLEYE · > 40 k → Nuwacom.
      Cascade, pas aiguillage : un prospect nourrit plusieurs comptes.
- [x] **Deep-dive à l'import** (`lib/deep-dive.ts`) — déterministe, hors-ligne,
      sans coût. Signaux dicibles, trous à combler, score/fit, angle, objectif.
- [x] **Triage de lot** (`lib/import-triage.ts`) — combien de fiches sont
      réellement appelables, où part le lot, quels trous dominent.
- [x] **Signaux vitaux** (`lib/vital-signs.ts`) — readiness, fatigue (le
      compteur repart à zéro dès qu'il répond), fenêtre de rappel.
- [x] **Master rappel** (`lib/master-rappel.ts`) — actions humain/Alpha
      séparées, checklist « ça tourne », plan de comms (quoi, quand, à quelle
      fréquence).
- [x] **Argumentaire** (`lib/argumentaire.ts`) — les 9 blocs, du « se présenter »
      au « comment payer si le budget est contraint ».
- [x] **Checkpoints humains** (`lib/checkpoints.ts`) — 17 portes, vérifiables vs
      déclaratives, bloquantes ou non. `pipelineCoverage()` nomme le point qui
      bloque le plus de fiches.
- [x] **Lead magnet** (`lib/lead-magnet.ts`) — 3 aimants ciblés, jamais de prix
      dans l'email, rien envoyé si aucun ne correspond.

### Alpha Voice
- [x] **Entrant opérationnel** — Telnyx → LiveKit → agent (`voice/INBOUND.md`).
- [x] **Cadence Callflow** — 5 rappels sur 2 jours ; arrêt dès qu'il répond,
      passage au closer ; opposition = arrêt définitif.
- [x] **Article 50** — divulgation prononcée par le code, `audit_script` refuse
      un script non conforme.
- [x] **Journal de sessions + transcription** durable (Supabase), réinjectée
      dans le brief du prochain appel.
- [x] **Réconciliation du résultat** (`lib/call-outcome.ts`) — aller-retour
      résultat → texte → résultat, testé sur les 4 issues.

### L'exécution
- [x] **Orchestrateur de campagne** (`lib/campaign-runner.ts`) — file triée par
      proximité de signature, 9 raisons d'écart typées.
- [x] **Runner manuel ET auto** — armement explicite, arrêt toujours visible.
- [x] **Autopilote** (`/api/campaign/tick`) — triple verrou, plafond dur de 5
      appels/tick, écriture AVANT appel (anti-harcèlement).
- [x] **Salle de contrôle** (`/controle`) — appels en cours, file, blocages.

### Le produit
- [x] **Portefeuille de comptes** — EAGLEYE maître, ScintIA, Nuwacom, avec
      rituels de closing distincts.
- [x] **Segments / ICP** (`lib/segments.ts`) — équipes terrain, centres
      d'appels, agences, réseaux, commerce local, assurance.
- [x] **Prix à la carte** (`lib/bricks.ts`) — 8 briques, ancrage sur le pack.
- [x] **Coût usine** (`lib/voice-costs.ts`) — marge réelle, limites du gratuit.
- [x] **Cerveau cloisonné par compte** + import PDF/DOCX/HTML sans dépendance.
- [x] **Vitrine publique** (`/vitrine`) — liberté → qualification → coût →
      prix → cadrage.
- [x] **Trajectoire** (`/trajectoire`) — paliers 0→10 M, barre du jour,
      opportunités (French Tech).
- [x] **API v1** (`/api/v1/prospects`) — ingestion pour n8n et CRM tiers.
- [x] **Devis à la carte depuis la fiche** — briques cochées, montants tirés du
      catalogue, ancrage sur le pack calculé, émetteur white-label.
- [x] **Coût usine visible** (`/voice`) — marge en € et en %, coût d'un appel,
      limites du gratuit avec les deux verrous de licence.
- [x] **Scripts des deux nouveaux marchés** (`lib/playbook.ts`) — équipes
      commerciales terrain et centres d'appels, ouverture → objections.
- [x] **Notifications hors-app** (Web Push, RFC 8291/8292 faites main) — le
      serveur pousse app fermée. Chiffrement testé contre le vecteur de la RFC.
- [x] **Calendrier** (`lib/ics.ts`) — fichier .ics et flux abonnable, vers
      Google, Outlook/Teams et Apple. Sens unique, assumé.
- [x] **Notion** (`lib/notion.ts`) — envoi du pipeline, sans OAuth. Ni notes
      libres ni transcriptions ne partent.
- [x] **Présentation par prospect** (`lib/deck.ts`) — celle de SON étape.
      Aucun prix avant l'offre, aucun chiffre inventé, rituel de closing du
      compte en clôture.
- [x] **Mission French Tech** (`lib/mission-french-tech.ts`) — 9 lots, porteur
      et piège nommés, compte à rebours en jours OUVRÉS. Visible sur
      `/trajectoire` et sur la vitrine.
- [x] **Mise en route client** (`lib/client-onboarding.ts`) — 10 étapes datées,
      preuve exigée, cas « essai » traité.
- [x] **Budget de jetons** (`lib/token-budget.ts`) — coupe par priorité,
      déduplication, mesure par route. Branché sur `/api/agent`.
- [x] **Agent ALPHA** vendu comme brique (2 200 € + 220 €/mois).

---

## ⏳ CE QUI RESTE

### Bloqué sur Zakaria — je ne peux pas le faire
- [ ] **Rotate les clés NVIDIA + Fish** (collées en clair dans une conversation)
- [ ] **Migrer le LLM hors du tier gratuit NVIDIA** — la licence interdit la
      production. Coût réel : < 3 € pour 1 000 appels.
- [ ] **Table `call_sessions` dans Supabase** — sans elle, l'historique repart
      à zéro à chaque déploiement.
- [ ] **French Tech 2030** — dépôt avant le 4 septembre 2026, 23h59.
- [ ] **Envoyer le devis ScintIA** — 3 500 € + 364 €/mois, prêt.
- [ ] **Tarif Telnyx France réel** — c'est le premier poste variable ; mon
      hypothèse est à 0,012 $/min.
- [ ] **UN appel sortant réel** — il valide toute la chaîne d'un coup.
- [ ] DNS Amen + domaines Vercel (confort, pas prérequis).

### Pas encore construit
- [ ] **Calendrier bidirectionnel** (API Google / Microsoft) — exige de l'OAuth
      non testable ici, et créerait le lien Meet/Teams. Le flux iCal couvre le
      sens ALPHA → agenda, qui est celui qui sert tous les jours.
- [ ] **Notion en lecture** — aujourd'hui ALPHA écrit, Notion lit. Le sens
      inverse demande d'arbitrer les conflits, et cet arbitrage s'écrit mal
      sans vrais cas.
- [ ] **Vidéo de lancement** — la vidéo d'ouverture est en place (provisoire) ;
      la version finale reste à produire.
- [ ] Tests sur les modules d'affichage (les modules métier, le store, la
      structure de navigation et la frontière de conformité vocale sont
      couverts).

### La tenue (revue de sécurité + UX, août 2026)
- [x] **Injection de prompt** (`lib/untrusted.ts`) — tout texte tiers (PDF,
      site aspiré, réponse entrante, transcription) encadré par une balise à
      nonce, règles rappelées APRÈS les données.
- [x] **Fuites fermées** — lecture des réponses prospects et journal d'appels
      s'ouvraient sur un en-tête forgé (`Sec-Fetch-Site`, `Host`).
- [x] **SSRF** — redirections revalidées à chaque saut (site aspiré + Sheets).
- [x] **Force brute** — compteur par IP sur la porte, secrets comparés en
      temps constant, expiration JWT exigée.
- [x] **Perte de données silencieuse** (`lib/storage-health.ts`) — le quota
      localStorage sature sans rien dire ; désormais mesuré et annoncé.
- [x] **Navigation hiérarchisée** — 4 écrans de quotidien, le reste rangé par
      moment du métier. Un test interdit qu'une page reste non liée.

---

## Limites — à redire, parce qu'elles ne bougent pas
1. **Rien n'a été testé en conditions réelles.** Le proxy de la sandbox bloque
   Telnyx, LiveKit, Vercel et Supabase. Les 579 tests prouvent que la logique
   est cohérente ; ils ne prouvent pas qu'un appel part.
2. **Aucune automatisation ne closera à ta place.** L'OS source, qualifie,
   appelle, relance et prépare. La signature reste humaine.
3. **Juillet 2026 : 78 prospects, 132 appels, 18 audits, 0 vente.** Le goulot
   n'était pas l'outillage. L'OS rend plus rapide un processus qui n'a pas
   encore prouvé qu'il convertit — c'est une hypothèse, pas un acquis.
4. **108 modules pour un opérateur solo.** Ce qui n'est pas utilisé devient de
   la dette. Mieux vaut trois écrans maîtrisés que quarante survolés.

## L'ordre qui rapporte
`devis ScintIA` → `un appel réel` → `French Tech` → `rotate les clés` →
`table Supabase` → le reste.
