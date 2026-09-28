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

## L'ENVOI À FROID AUTOMATIQUE (22/09/2026)
`lib/mail-autopilote.ts` (pur) · `app/api/campaign/mail-tick/route.ts` ·
`tests/mail-autopilote.test.ts`.

L'app démarche toute seule : un cron appelle `/api/campaign/mail-tick`, qui lit
les prospects du maître, garde les éligibles au premier contact, et envoie un
mail à froid conforme — en réutilisant EXACTEMENT les gardes de `/api/send`
(palier du jour, plafond horaire, dédup, mentions, divulgation, lint, tracking).
Les RÈGLES ont une seule définition (les libs) ; ce tick est un second APPELANT,
parce que sa porte (CRON_SECRET + maître) n'est pas celle de `/api/send`
(session + middleware). **Zéro changement à `/api/send`.**

- **Trois gardes** comme les autres ticks : CRON_SECRET, `CAMPAIGN_AUTOPILOT=on`
  (sinon `dryRun` qui planifie sans envoyer), Supabase présent.
- **⚠⚠ L'envoi autonome PORTE la divulgation IA (art. 50).** Le gabarit contient
  déjà la phrase ; `verifieDivulgation` refuse l'envoi si elle disparaît. **La
  conséquence, dite au propriétaire : un mail autonome sonne différemment d'un
  mail relu par un humain.** Qui veut le pitch sans l'aveu doit relire lui-même
  (mode `valide-par-humain`) — donc ne pas automatiser. On ne contourne pas la
  loi pour mieux vendre. `tests/mail-autopilote.test.ts` PROUVE que le mail rendu
  passe mentions + divulgation + les motifs interdits de la verticale + zéro prix.
- **Le texte est FIXE, pas engendré.** Un script à froid n'improvise pas, et
  auto-envoyer du texte de modèle non relu est ce qu'on refuse pour les réponses.
- **Compte MAÎTRE uniquement** (`DROIT_SOLO`, `accountId:"eagleye"`, notre SMTP).

**Pour qu'il TIRE, il faut la config Supabase du propriétaire** (migration 004
`pg_cron`/`pg_net` + secret Vault + `CAMPAIGN_AUTOPILOT=on`) — voir
`docs/ALLUMER-AUTOPILOTE.md`. Le code est prêt et testé ; le sandbox ne peut ni
joindre Supabase ni tester l'envoi SMTP réel, donc l'envoi vivant se vérifie
côté Zakaria (comme le reste des services live).

## La brique suivante (dès le DKIM publié)
Brancher l'auto-envoi des dispositions `auto` sur le plan que ce tick produit
déjà : rédaction via la tâche `reply` de `/api/ai` (source unique du « comment on
répond »), envoi via un chemin maître qui réutilise les gardes de `/api/send`
(palier, mentions, divulgation IA). Les `escalade` pingueront l'opérateur
(Telegram) ; les `clore` marqueront « ne plus recontacter ».
