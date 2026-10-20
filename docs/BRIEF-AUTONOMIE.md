# Le brief d'autonomie (20/10/2026) — confronté au code

Deux briefs « rendre Alpha Sales OS autonome » ont été écrits par un assistant
externe (Manus) **sans lire le dépôt**, puis une série de réponses d'un moteur de
recherche IA a décrit le produit de l'extérieur. Ce document dit ce qui est
**déjà là**, ce qui **manque**, ce qui est **refusé par doctrine**, et ce qui
est **impossible quoi qu'on code**. Il existe pour qu'une session future ne
reprenne pas ces textes comme un cahier des charges.

> Le brief est **bon sur les principes** (preuves, `null` ≠ 0, aucune action
> sortante sans permission, file de travail, arrêt d'urgence) et **faux sur
> l'état du produit** : il décrit comme absent beaucoup de ce qui existe, et
> demande comme neuf ce que la doctrine a déjà tranché.

## 1. Ce que le brief demande — et ce que le code a déjà

| Demande du brief | État réel | Où |
|---|---|---|
| Un fichier incomplet ne doit pas être écarté | **Bug réel, reproduit et corrigé le 20/10.** Trois PME complètes mais sans avis → score 20/45 → « écartées » → « ✓ 0 nouveau(x) » | `importerPourCrm`, `tests/import-crm.test.ts` |
| Inconnu ≠ zéro | **Partiel.** Les écrans de supervision affichent `—`. Mais l'import générique pose encore des valeurs par défaut (`trust`, `conviction`, montants à 0) : à traiter fiche par fiche, pas globalement | `lib/csv.ts`, `lib/moniteur.ts` |
| Téléphone / email `verified` · `unverified` · `missing` | **Absent.** Les champs sont des chaînes optionnelles, sans statut de vérification | `Prospect` |
| Une source par information vérifiée (`source_url`) | **Absent** au niveau de la fiche. Existe pour les références externes (niveau de preuve) | `lib/references.ts` |
| Alpha CEO orchestre le pipeline | **Non : ALPHA CEO diagnostique** (points humains, pannes silencieuses). Il ne lit pas le pipe fiche par fiche. La détection « sans prochaine action / relance en retard » vit dans les écrans du matin | `lib/alpha-ceo.ts`, `lib/priorites.ts`, `/aujourdhui` |
| Trois niveaux : lire / préparer / exécuter | **Existe, sous une autre forme** : un assistant externe lit et **dépose une proposition** (liste fermée d'actes) ; l'humain approuve dans l'app. Aucune portée « exécuter » — par décision | `lib/propositions.ts`, `lib/api-keys.ts`, `docs/ORCHESTRATEUR.md` |
| API pour un assistant externe | **Existe** : `/api/v1` (état, prospects, propositions, campagne, diagnostic) + serveur MCP + OAuth (maître seul) | `app/api/v1`, `app/api/mcp`, `lib/mcp-oauth.ts` |
| `work_queue` (tâches typées, statuts, retry borné) | **Absent.** La table `commandes_alpha` est une boîte de réception (« stockée, pas exécutée ») | migration 013 |
| Moteur de preuves (`claim` · `source_url` · `confidence`) | **Absent** pour les audits de prospects | — |
| Classer les réponses entrantes, règle explicite par classe | **Existe pour l'email** : « le modèle classe, le code dispose », escalade au moindre doute | `lib/reponse-auto.ts` |
| Désinscription = arrêt immédiat | **Existe** : `aRefuseTouteRelance`, une seule définition | `lib/voice-script.ts` |
| Arrêt d'urgence | **Existe pour l'autopilote** (interrupteur en base, lu avant d'agir). Pas un arrêt global de toutes les automatisations | migration 015, `/api/autopilote` |
| Routines matin / semaine | **Existe** : ordonnanceur `pg_cron` + `pg_net`, le cron demande, la route décide | migration 004 |
| Tableau de contrôle du matin | **Existe en pièces** : `/aujourdhui`, `/controle`, `/ceo`, `/moniteur` | — |
| Contrat à partir d'un modèle validé | **Modèle écrit**, pas de génération branchée à une fiche | `docs/CONTRAT-PRESTATION.md` |
| Cadrage avant devis | **Exécutable** : le document est refusé sans cadrage | `lib/cadrage.ts` |
| Signature électronique | **Absente.** Aucun connecteur. C'est un prestataire externe + un compte : ça ne se code pas, ça se contracte | — |
| Prise de rendez-vous, calendrier | Partiel (rendez-vous dans l'app). Pas de connecteur calendrier bidirectionnel | — |

## 2. Ce que le brief demande et que la doctrine REFUSE — il faut le dire

- **« Découvrir des entreprises » par Alpha lui-même.** La collecte reste
  **dehors**, sous la responsabilité de celui qui la fait (fichier, feuille
  partagée, assistant externe). Alpha **trie ce qu'on lui donne**
  (`docs/COLLECTEURS-EXTERIEURS.md`). Le brief étendu contourne ça en faisant
  collecter « Manus ou Claude » : c'est **conforme** à condition que l'assistant
  externe reste un collecteur externe, jamais un module embarqué.
- **« Autonomie complète jusqu'à la signature ».** La doctrine a déjà posé trois
  catégories de points humains (`lib/alpha-ceo.ts`) : *automatisable*,
  *humain-par-décision*, *humain-par-contrainte*. Une remise, un engagement
  juridique, une signature sont des deux dernières. Ce ne sont **pas un retard à
  rattraper : ils sont le produit.**
- **Un paramètre `executer: true`** sur la route des propositions : refusé,
  écrit dans la route pour que le diff se voie.
- **Négocier librement.** Le prix passe **après** la démonstration, jamais sans
  garantie ; une remise est une décision du propriétaire.

## 3. Les obstacles réels, par ordre de coût

1. **Il n'y a aucune vente.** Le brief optimise un cycle qui n'a jamais
   tourné une fois jusqu'au bout (78 prospects, 6 rendez-vous, 0 gagné). Chaque
   étape automatisée avant d'avoir été faite à la main au moins une fois est une
   hypothèse figée dans du code.
2. **La conformité par canal.** Email : domaine, palier, mentions. Appel :
   fenêtres, plafond du décret n° 2022-1313, mention IA dite par le code.
   LinkedIn : dans le produit, l'envoi reste à la main (une invitation se
   copie, aucun serveur ne la relit). Ce sont déjà des gardes exécutables ; le
   brief les ignore.
3. **L'accès aux données privées.** Messages LinkedIn, boîtes mail d'un tiers,
   comptes de téléphonie : sans connecteur et sans autorisation, c'est
   **impossible**, et contourner par un faux comportement humain est refusé.
4. **Les coûts qui bouclent.** Un agent qui relance, ré-analyse et recommence
   sans résultat. Réponse déjà en place : budget de jetons, palier d'envoi,
   plafond d'appels. À étendre à toute future `work_queue` (retry borné).
5. **La sécurité d'un système qui va jusqu'à la signature.** Les portées
   séparées existent ; une portée « signer » n'existe pas et ne doit pas être
   la première chose ajoutée.

## 4. Impossible — à ne jamais promettre

Obtenir un nombre de réponses · faire signer chaque prospect · garantir un
revenu journalier · savoir qu'un prospect a un budget · prédire la décision d'un
dirigeant · remplacer la poignée de main. **Aucun code ne change ça.**

## 5. Ce que les réponses du moteur de recherche IA ont affirmé à tort

Elles décrivent le produit d'après des extraits publics. Plusieurs affirmations
sont **fausses** et deux seraient **dangereuses** si on les appliquait :

- **« Forcer tous les droits à vrai pour tout le monde »** (`entitlements`) —
  *dangereux.* L'invariant du dépôt : on ne monte jamais au-dessus du gratuit
  sans une ligne prouvée en base. Ouvrir les briques payantes à tout inscrit,
  c'est donner **notre** SMTP, **nos** minutes et **nos** jetons à des inconnus.
- **« Mettre tous les prix à zéro dans `offres-publiques` »** — *dangereux et
  faux de fond.* La forme « chez vous » est **payante** par décision ; la vider
  ferait disparaître la grille que les écrans lisent.
- **Un forfait mensuel unique « pour 5 utilisateurs » avec consommation incluse,
  un setup à quelques milliers d'euros, un abonnement solo avec recharges** —
  *faux.* La grille décidée est : installation + socle plateforme + prix par
  siège, Alpha Voice à l'usage et **hors formule**. Les montants vivent dans
  `lib/offres-publiques.ts` ; **ils ne se recopient pas dans une prose.**
- **« L'application refuse toute autonomie, aucun message ne part sans
  relecture »** — *inexact.* L'appel à froid est mené en entier par Alpha Voice
  (doctrine du 28/08), l'autopilote email existe avec son interrupteur. Ce qui
  est vrai : aucune de ces automatisations ne contourne une garde.
- **« Alpha Voice se vend en ligne, avec recharge »** — *périmé.* Retiré de la
  vente en ligne le 20/10 : il se vend installé chez le client.
- **« Passer à l'échelle : sharding, files BullMQ, base vectorielle »** — *dans
  le mauvais ordre.* Le premier mur de 10 M n'est pas l'architecture mais les
  **emails de confirmation d'inscription** (`docs/OBJECTIF-10M.md`).
- **Un premier client « qui veut bien l'utiliser »** — c'est une **intention**,
  pas une signature. Le compteur de ventes reste à zéro tant qu'un devis n'est
  pas signé et payé.

## 6. Ordre recommandé (celui du brief, avec deux corrections)

1. ~~Corriger l'import~~ — **fait le 20/10.**
2. **`work_queue` minimale, en lecture seule d'abord** : générer la liste des
   tâches *à partir de ce que les écrans du matin calculent déjà* (fiche sans
   prochaine action, relance en retard, audit incomplet, donnée manquante).
   Aucune exécution. Le test : la file se vide quand on traite la fiche.
3. **Brancher le tout dans ALPHA CEO** — comme une source de points de plus
   (« tâche du pipe »), pas comme un second moteur.
4. **Faire le cycle une fois à la main avec le premier intéressé**, du cadrage au
   devis signé, en notant chaque geste : c'est la spécification réelle de tout
   le reste.
5. Connecteur de signature : **après** 4, et choisi sur ce que 4 a montré.

*Correction 1 :* la signature électronique ne vient pas avant le premier cycle
manuel. *Correction 2 :* aucune portée « exécuter » n'est ajoutée — le canal
d'écriture d'un assistant reste la proposition.
