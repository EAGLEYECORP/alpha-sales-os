---
name: alpha-vente
description: >-
  À charger dès qu'une session Alpha Sales OS touche à la VENTE : sourcer des
  leads pour l'ICP (maître d'ouvrage / promoteur lyonnais), lancer de la
  prospection, brancher le pont « commande → Alpha exécute », ou dès qu'on
  parle de revenu / premier client / campagnes. Encode le workflow qui MARCHE
  et les pièges qui ont coûté du temps, pour ne pas les refaire.
---

# ALPHA VENTE — aller chercher le premier euro sans se planter

> État de départ (à réactualiser) : **0 vente**. L'infra est prête (auth prouvée,
> SMTP câblé, autopilote codé). Le goulot n'est PAS l'outil — c'est d'envoyer de
> vrais messages à de vrais maîtres d'ouvrage et de closer. Ne jamais confondre
> « construire encore » avec « vendre ».

## 1. Règles de collaboration — le « ne pas fuck up »
- **Honnêteté brutale, mais AGIR.** Ne pas répéter « je ne peux pas » quand le
  propriétaire a donné un feu vert. Un « c'est approuvé / vas-y / go » est un
  ordre d'exécuter, pas d'attendre confirmation à chaque étape.
- **Ne jamais simuler du progrès.** Si c'est bloqué sur une action humaine, le
  dire en UNE ligne et tenir — ne pas empiler des docs ni boucler.
- **Pas de docs quand il faut de l'action.** Le propriétaire veut un PONT
  (commande → exécution), pas un cinquième fichier. Livrer de l'exécutable.
- **Jamais dépenser de crédits / d'argent sans OK explicite** ET sans avoir
  affiché le coût d'abord. Un feu vert global sur les *autorisations d'outil*
  n'est pas un feu vert pour *dépenser*.

## 2. L'ICP (source de vérité : `lib/permis-construire.ts` + `accounts-commercial.ts`)
Promoteur/bailleur **professionnel** qui **commercialise du neuf**, permis actif,
**Lyon/Villeurbanne**, **≥ 6 logements**, phase **pré-commercialisation (2-12 mois)**,
qui **croule** sous les contacts acquéreurs (1-2 personnes pour relancer).
**Canal : LinkedIn.** Offre : OS de vente en **part au résultat** (gratuit tant
que ça ne rapporte pas, 30 % du CA encaissé — `lib/part-resultat.ts`).
Exclusions sèches : particulier, collectivité, hors zone, < 6 logements.

## 3. Le pont « commande → Alpha exécute »
```
SOURCE → outil de prospection (MCP Vibe_Prospecting) : promoteurs/décideurs région Lyon
IMPORT → CSV → Alpha (pont scripts/maps-vers-alpha.mjs déjà codé)
SÉQUENCE → autopilote (migrations 004/005, /api/campaign/tick) — voir docs/ALLUMER-AUTOPILOTE.md
CALENDRIER → réponses → RDV
CLOSE → HUMAIN (par design ET par la loi — ne jamais automatiser le closing à froid)
```

## 4. Sourcing qui marche (MCP Vibe_Prospecting) — mesuré le 22/09/2026
- **Localisation France** : `company_region_country_code = ["FR-ARA"]` (Auvergne-
  Rhône-Alpes contient Lyon). `city_region` est **US-only** — ne pas l'utiliser.
  Ne jamais mettre `company_country_code` ET `company_region_country_code` (exclusifs).
- **Le BON filtre pour promoteurs** : `linkedin_category = ["real estate"]` +
  `website_keywords = ["promotion immobilière","programme neuf","logements neufs"]`.
  → ramène de vrais promoteurs/bailleurs.
- **Le MAUVAIS filtre** : `linkedin_category = ["residential building construction"]`
  → ramène des **constructeurs de maisons individuelles** et des fournisseurs
  (menuiserie, électricité) = hors ICP. Piège vécu.
- **Décideurs** : entité `prospects` + `job_level = ["owner","founder","c-suite",
  "president","director"]` (les intitulés `job_title` anglais exacts rendent 0
  sur des fiches FR — passer par `job_level`).
- **L'exploration (fetch/autocomplete/sample) est GRATUITE** ; noms+postes+société
  suffisent pour LinkedIn. Les **emails/téléphones** = enrichissement PAYANT
  (`enrich-prospects-contacts`) → afficher le coût, attendre le OK, et le canal
  email exige d'abord le test `/recette` prouvé.
- **Limite honnête** : ce sourcing cible par SECTEUR, pas par PERMIS actif (le
  vrai déclencheur). Les sources open-data FR du permis sont bloquées depuis le
  sandbox. C'est un point de départ réel, pas l'ICP parfait — le dire.

## 5. Les données réelles ne descendent JAMAIS dans le dépôt
Noms de personnes, raisons sociales, emails, téléphones de prospects réels :
**en chat uniquement**, jamais commités (doctrine `tests/donnees-reelles`,
`tests/noms-reels`). Décrire une règle par sa FORME, jamais par l'échantillon.

## 6. Le piège des autorisations (mobile)
Le client **mobile** n'affiche pas les fenêtres d'autorisation d'outil → les
appels restent « en attente » invisibles. Fix : approuver depuis **claude.ai/code
(web)** ou l'app **desktop**, ou passer la session en **auto-accept /
bypassPermissions**. Un agent (Hermes/OpenHands) ne perce PAS ce mur — même
autorisation requise. Ne pas le vendre comme une solution.

## 7. Contraintes sandbox (re-mesurer, ça dérive)
- **Bloqués** : `*.netlify.app`, hôtes Supabase, open-data FR (403 proxy).
- **OK** : github (git), **DNS via Node `dns.resolve` UDP 53** (le DoH est bloqué),
  build local, Chromium.
- Tests live (envoi email, appel, deploy) = côté propriétaire, pas prétendre les
  avoir faits.

## 8. Garde-fous doctrine (non négociables)
- **L'humain close.** Alpha fait tout AVANT/AUTOUR, jamais la poignée de main.
- **Zéro preuve sociale inventée** (0 vente = 0 témoignage).
- **Pas de dépendance npm** sans raison impérieuse ; **pas de scraper à
  contournement de détection** (contredit la conformité — cf. `docs/COLLECTEURS-EXTERIEURS.md`).
- **Sécurité** : jamais de secret collé/commité ; scanner chaque commit.

## 9. Pointeurs
`docs/OUTREACH-KIT-MOA.md` (messages prêts) · `docs/ALLUMER-AUTOPILOTE.md`
(autonomie serveur) · `docs/A-FAIRE-ZAKARIA.md` (bloqué sur le propriétaire) ·
`docs/HANDOFF-2026-09-18.md` (état) · `CLAUDE.md` (doctrine complète).
