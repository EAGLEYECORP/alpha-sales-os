# PONT TELEGRAM — dire à Alpha quoi faire depuis le téléphone

> `lib/telegram.ts` (logique pure) · `app/api/telegram/route.ts` (webhook) ·
> migration `013-commandes-alpha.sql` · `tests/telegram.test.ts`.

## Ce que c'est — et ce que ce n'est PAS
Un canal où **toi seul** envoies des commandes à Alpha (l'app) depuis Telegram.
C'est le cerveau **opérationnel** : statut, notes, file de consignes.

Ce n'est **pas** le cerveau agentique. Sourcer des leads, écrire un message sur
mesure, raisonner — ça, c'est **Claude / Cowork**, une session qui écoute.
Telegram n'y accède qu'avec un relais séparé. Ne pas confondre les deux.

## Commandes (v1)
- `/ping` — Alpha répond s'il est en ligne.
- `/statut` — ce qui est configuré (envoi email, autopilote, file de notes).
- `/note <texte>` — range une consigne dans la file (`commandes_alpha`). STOCKÉE,
  pas exécutée : tu la traites ensuite depuis une session.
- `/aide` — la liste.

> Aucune commande de v1 ne DÉPENSE (pas d'envoi email/SMS/appel) ni n'écrit à un
> vrai prospect. Le jour où on en ajoute une, elle passe par les gardes
> existants (`/api/send`, palier, mentions), jamais par ce webhook en douce.

## Installation (5 min)

### 1. Créer le bot
Dans Telegram, parle à **@BotFather** → `/newbot` → suis les étapes → il te donne
un **token** de la forme `123456:ABC-...`.

### 2. Connaître ton chat id
Parle à ton bot (envoie « salut »), puis ouvre dans un navigateur :
`https://api.telegram.org/bot<TON_TOKEN>/getUpdates`
Repère `"from":{"id":<un nombre>}` — c'est ton **chat id**.

### 3. Poser les variables (Netlify → Environment variables, en secret)
```
TELEGRAM_BOT_TOKEN      = 123456:ABC-...        (secret)
TELEGRAM_WEBHOOK_SECRET = <une chaîne aléatoire que tu choisis>  (secret)
TELEGRAM_OWNER_CHAT_ID  = <ton chat id, ex. 42>
```
> ⚠ Sans `TELEGRAM_WEBHOOK_SECRET`, la route répond **404** (fail-closed, comme
> le cron). C'est voulu : un webhook de commande ne s'ouvre jamais par défaut.

### 4. Appliquer la migration
Supabase → SQL Editor → colle `supabase/migrations/013-commandes-alpha.sql`.
(Sans elle, `/note` répond « noté mais NON persisté » — honnête, pas silencieux.)

### 5. Redéployer, puis enregistrer le webhook chez Telegram
```
curl "https://api.telegram.org/bot<TON_TOKEN>/setWebhook" \
  -d "url=https://alphasalesos.eagleyecorp.fr/api/telegram" \
  -d "secret_token=<LE MÊME QUE TELEGRAM_WEBHOOK_SECRET>"
```
Telegram renverra ce secret dans l'en-tête `X-Telegram-Bot-Api-Secret-Token`, que
la route compare à temps constant.

### 6. Vérifier
- `GET https://alphasalesos.eagleyecorp.fr/api/telegram` → l'état de config
  (présence des variables, **jamais** les valeurs).
- Envoie `/ping` à ton bot → « Alpha en ligne ✅ ».

## Sécurité
- Route dans `PUBLIC_PREFIXES` (appelée sans session) mais **hors** `INTERNAL` :
  sa serrure est le **secret d'en-tête + l'id de l'expéditeur**, jamais l'un
  sans l'autre.
- Un expéditeur qui n'est pas le propriétaire est **acquitté puis ignoré** —
  rien ne fuit, pas même un « accès refusé ».
- `TELEGRAM_BOT_TOKEN` est un secret : jamais commité, posé côté Netlify.

## Langage naturel (au-delà des commandes /)
Tout message qui n'est PAS une commande `/` est compris en **langage naturel**
via le moteur IA de l'app : « où en est mon pipeline ? », « rappelle-moi de
relancer PROMOVAL », « trouve-moi 10 promoteurs »…

- **Le modèle CLASSE, le code DISPOSE.** Une intention `question` → réponse ;
  `note` → rangée dans `commandes_alpha` ; `action` (sourcer/envoyer/dépenser)
  → **jamais exécutée toute seule**, on répond « compris, ça se lance depuis
  l'app / après confirmation ». La route ne sait faire que des choses sûres.
- **Voix** : un message vocal est reconnu ; la transcription (Deepgram, déjà
  dans la pile) se branchera ici — pour l'instant Alpha répond « écris-moi ».
- Si l'IA n'est pas configurée (moteur absent), Alpha le dit et renvoie vers
  `/statut` `/note` `/aide`.
