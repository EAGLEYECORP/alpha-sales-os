# AUTOPILOTE EMAIL — retirer l'humain de la BOUCLE, pas du CLOSE

> Décidé le 22/09/2026. `lib/reponse-auto.ts` (le cerveau) ·
> `app/api/campaign/reply-tick/route.ts` (le tick) · `tests/reponse-auto.test.ts`.

## Le problème
Le loop email existe déjà de bout en bout — mais chaque saut est MANUEL :
1. Réponse entrante → `inbound_events` (webhook `/api/webhooks/inbound` ou collage).
2. L'opérateur ouvre `/campaigns`, clique « Réponse IA » → `/api/ai` rédige.
3. Il lit, il envoie.

C'est lui qui ouvre, clique, lit, envoie — sur CHAQUE réponse. Voilà le « trop
d'humain ».

## La règle qui rend l'automatisation SÛRE
« Le modèle CLASSE, le code DISPOSE » (même forme que le pont Telegram). Le
modèle range une réponse entrante dans une intention ; le CODE route, de façon
déterministe (`routerReponse`) :

| Intention | Disposition | Pourquoi |
|---|---|---|
| `veut-rdv`, `renseignement` | **auto** | Milieu de tunnel. Réponse doctrinale FIXE (proposer un créneau / expliquer sans prix). Un humain la taperait à l'identique. |
| `prix`, `veut-signer` | **escalade** | L'ARGENT et la SIGNATURE, c'est l'humain (la poignée de main — le pitch). Et jamais de prix par écrit avant la démo. |
| `objection` | **escalade** | Il faut isoler la croyance cassée, pas répondre à la va-vite. |
| `refus` | **clore** | On marque « ne plus recontacter », aucun envoi. |
| `hors-sujet` / inconnu | **escalade** | On n'auto-agit JAMAIS sur un doute. Le repli d'`interpreterClassement` tombe ici. |

**L'invariant testé** : seules `veut-rdv` et `renseignement` s'automatisent.
Déplacer une ligne vers `auto` se voit au diff — c'est exactement là qu'on perd
un deal au dernier mètre.

## Ce qui tourne, et ce qui NE tourne pas encore
- **`/api/campaign/reply-tick`** (cron, `CRON_SECRET`, `dryRun` sauf
  `CAMPAIGN_AUTOPILOT=on`) lit les réponses non traitées, les classe, et rend le
  PLAN : pour chacune, intention + disposition + motif.
- **Il ne fait partir AUCUN email.** `envoiBranche: false`. Deux raisons, dans
  l'ordre :
  1. **DKIM.** Tant qu'il n'est pas publié chez Amen, tout part en spam :
     auto-envoyer serait griller le domaine ET la fiche
     (`docs/SMTP-SUPABASE-AMEN.md`). La délivrabilité n'est pas un jugement
     qu'on force.
  2. `/api/send` est verrouillé par les droits PAR LOCATAIRE. Un chemin d'envoi
     pour l'autopilote MAÎTRE se construit avec ses propres gardes et son propre
     test — pas en ouvrant la route la plus sensible du produit en passant.

## La brique suivante (dès le DKIM publié)
Brancher l'auto-envoi des dispositions `auto` sur le plan que ce tick produit
déjà : rédaction via la tâche `reply` de `/api/ai` (source unique du « comment on
répond »), envoi via un chemin maître qui réutilise les gardes de `/api/send`
(palier, mentions, divulgation IA). Les `escalade` pingueront l'opérateur
(Telegram) ; les `clore` marqueront « ne plus recontacter ».
