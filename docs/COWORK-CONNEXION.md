# BRANCHER CLAUDE COWORK SUR ALPHA — le guide

> Objectif : une session Claude (Cowork, dans le cloud) se connecte au serveur
> MCP d'Alpha et **fait le travail commercial** — lire le pipe, préparer une
> campagne à froid, déposer des propositions. Elle n'envoie **jamais** un email
> ni ne bouge une fiche : ça, c'est gardé côté serveur et armé par toi.

Rédigé le 28/09/2026. Ce guide décrit ce qui EXISTE dans le code
(`app/api/mcp/route.ts`, `lib/api-keys.ts`, `app/api/v1/*`). Si un écran diverge,
c'est le code qui fait foi.

---

## 0. Ce que ça fait, et ce que ça ne fait PAS

Alpha expose un **serveur MCP** (`/api/mcp`, JSON-RPC 2.0 sur POST, MCP
2024-11-05). Un agent branché dessus dispose de cinq outils, et **d'aucun
autre** :

| Outil | Ce qu'il fait | Portée requise |
|---|---|---|
| `etat_du_pipe` | Lit l'état du pipe (prêts, endormis, saturés) — **sans aucune coordonnée** | `etat.read` |
| `diagnostic` | Lit l'état d'EXPLOITATION : autopilote armé ?, palier du jour, réponses auto (DKIM), et quel moteur classe (Laya/Jev/LLM). **Lecture seule.** | `etat.read` |
| `preparer_campagne` | PLANIFIE un lot d'emails à froid : texte exact + préflight art. 50, plafonné au palier du jour. **N'envoie rien.** | `campagne.read` |
| `lister_propositions` | Liste les propositions déjà déposées et leur statut | `propositions.read` |
| `proposer` | Dépose une proposition pour revue humaine. **N'exécute rien.** | `propositions.write` |

> ⚠ **La règle qui tient tout le dispositif** : aucun outil n'envoie d'email, ne
> lance d'appel, ni ne modifie une fiche. L'agent PROPOSE et PRÉPARE ; l'humain
> approuve ; la garde serveur exécute (palier, DKIM, mentions) une fois
> l'autopilote armé. Ne branche jamais un outil qui enverrait — c'est la seule
> chose qui rend sûr le fait de laisser un agent tourner sur un pipe réel.

---

## 1. Prérequis (dans l'ordre, et pourquoi)

Le branchement MCP lui-même ne demande que **l'app déployée + une clé**. Mais
pour que l'agent voie et fasse quelque chose d'utile :

1. **L'app est déployée et joignable en HTTPS.** Cowork tourne dans le cloud :
   un `localhost` ne marche pas. Il faut l'URL publique (Netlify/Vercel).
2. **Supabase est posé** (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
   Sans lui, `/api/v1/*` répond **503** : le serveur ne voit RIEN du pipe (le CRM
   vit dans le navigateur de l'opérateur). Voir `docs/A-FAIRE-ZAKARIA.md`.
3. **Le pipe est synchronisé côté serveur** (Réglages → Synchro du pipe, opt-in
   `pipeServeur`). Sinon l'agent lit un pipe **vide** — et l'outil le DIT
   (« pipe invisible », pas « pipe vide »).
4. **Pour l'envoi réel** (pas pour la connexion) : DKIM/SMTP posés
   (`docs/SMTP-SUPABASE-AMEN.md`) + autopilote armé. Tant que ce n'est pas fait,
   l'agent peut tout préparer, rien ne part — c'est voulu.

> ⚠ Ordre qui coûte cher si on l'inverse : **Supabase et les comptes AVANT le
> SMTP.** Détail et raison dans `docs/A-FAIRE-ZAKARIA.md`.

---

## 2. Créer la clé API (une fois)

Les droits viennent de la **clé**, pas de l'agent. Format d'une entrée de
`ALPHA_API_KEYS` (`lib/api-keys.ts`) :

```
nom:proprietaire:portee1|portee2|...:secret
```

Pour un agent commercial Cowork, la clé minimale utile :

```
cowork-vente:operateur:etat.read|campagne.read|propositions.read|propositions.write:<SECRET>
```

- **Génère le secret toi-même**, long et aléatoire — par ex. `openssl rand -hex 32`.
  Ne me le colle jamais, ne le mets jamais dans le dépôt : il vit **uniquement**
  dans les variables d'environnement de l'hébergeur.
- Plusieurs clés se séparent par une virgule dans `ALPHA_API_KEYS`.
- **Pose aussi `APP_BASE_URL`** = l'URL publique de l'app. Le serveur MCP appelle
  ses propres routes `/api/v1/*` en interne ; sans base absolue, certains
  hébergeurs ne résolvent pas le chemin.
- Après avoir posé/édité `ALPHA_API_KEYS`, **redéploie** (les variables ne sont
  lues qu'au boot).

> ⚠ **Le principe des portées** : une clé sans portée ne peut RIEN, et un outil
> dont la portée manque **disparaît** de la liste de l'agent au lieu d'échouer à
> l'appel. Donne exactement ce dont l'agent a besoin — ni plus (il n'a rien à
> faire de `prospects.write`), ni moins.

---

## 3. Vérifier l'endpoint (avant de brancher Cowork)

Une sonde en lecture seule confirme que la clé est reconnue :

```bash
curl -s https://<ton-app>/api/mcp \
  -H "authorization: Bearer <SECRET>"
```

Réponse attendue (extrait) :

```json
{
  "serveur": "alpha-sales-os",
  "protocole": "MCP 2024-11-05 (JSON-RPC 2.0 sur POST)",
  "authentifie": true,
  "appelant": "cowork-vente",
  "portees": ["etat.read", "campagne.read", "propositions.read", "propositions.write"],
  "doctrine": "Lecture et proposition uniquement. Aucun outil n'envoie, n'appelle ni ne modifie."
}
```

- `authentifie: false` → la clé n'est pas reconnue : vérifie `ALPHA_API_KEYS` et
  le redéploiement.
- Tester un outil en direct (JSON-RPC) :

```bash
curl -s https://<ton-app>/api/mcp \
  -H "authorization: Bearer <SECRET>" -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Tu dois voir les 5 outils listés (seulement ceux que la clé permet).

---

## 4. Ajouter Alpha comme connecteur MCP dans Cowork

> ✅ **Depuis le 29/09/2026 : OAuth, AUCUNE clé à créer ni à coller.** Alpha
> embarque son propre serveur d'autorisation (`lib/mcp-oauth.ts`), exactement
> comme Attio : on colle l'URL, on se connecte, on clique « Autoriser ».
> L'étape 2 (clé API) n'est plus nécessaire pour Cowork — elle reste utile pour
> n8n et pour le sourcing par `prospects.write`.

1. claude.ai → **Réglages → Connecteurs → Ajouter un connecteur personnalisé**.
2. **Nom** : `Alpha Sales OS`. **URL** : `https://alphasalesos.netlify.app/api/mcp`
   (ou ton domaine custom une fois branché — l'URL saisie doit être celle où
   l'app répond).
3. Laisse les champs OAuth (Client ID / secret) **vides** : Claude s'enregistre
   tout seul.
4. Clique **Connecter** → une page Alpha s'ouvre. Connecte-toi avec ton compte
   **maître** (`contact@eagleyecorp.fr` ou `eagleyecorp.ad@gmail.com`), relis
   « Il pourra / Il ne pourra jamais », clique **Autoriser**.
5. Retour dans Claude : le connecteur est actif, avec 5 outils.

**Ce que le jeton OAuth donne, et rien d'autre** : lecture du pipe, état de la
machine, préparation de campagne (sans envoi), dépôt de propositions. Jamais
`prospects.write`, jamais un envoi — même pour le maître.

**Qui peut autoriser** : seulement un compte listé dans `OWNER_EMAILS`. Un
client qui essaie reçoit un refus (les outils lisent le pipe de l'opérateur ;
la lecture par locataire n'existe pas encore). Retirer une adresse de
`OWNER_EMAILS` coupe son accès **au prochain appel**.

**Couper tout de suite, pour tout le monde** : pose (ou change) `OAUTH_SECRET`
sur Netlify (≥ 32 caractères) et redéploie — tous les jetons meurent. Sans
cette variable, le secret est dérivé de `SUPABASE_JWT_SECRET` : rien à poser
pour que ça marche.

> ✅ **Éprouvé le 29/09 par un vrai Claude** : connecteur ajouté depuis le
> compte de Zakaria, consentement donné, l'outil `diagnostic` a répondu.
>
> **Limites écrites plutôt que tues** : pas de base, donc un code
> d'autorisation n'est garanti à usage unique que sur une même instance (il vit
> 60 s et reste inutile sans le vérificateur PKCE), et un refresh token ne se
> révoque pas seul (coupe-circuits : `OWNER_EMAILS` ou `OAUTH_SECRET`). Seuls
> les retours vers Claude sont acceptés : un autre client MCP (ChatGPT…) sera
> refusé tant qu'on ne l'a pas décidé.

**Claude Code (terminal)** : `claude mcp add --transport http alpha
https://alphasalesos.netlify.app/api/mcp` — il ouvrira la même page
d'autorisation dans ton navigateur.

---

## 5. Le workflow que l'agent suit

Charge la skill **`alpha-vente`** dans la session Cowork (elle encode le
workflow et les pièges). Puis l'agent :

1. **`etat_du_pipe`** — toujours d'abord : qui est prêt, qui dort, qui n'a pas de
   prochaine étape.
1b. **`diagnostic`** — l'état de la machine : armée ?, palier du jour, réponses
   auto, quel moteur classe (Laya/Jev/LLM). C'est ce qui permet un rapport du
   matin honnête (« ça tourne, voici ce qui bloque »).
2. **`lister_propositions`** — pour ne pas reproposer ce qui a déjà été rejeté
   (aucune mémoire entre deux sessions).
3. **`preparer_campagne`** (`max` optionnel) — obtient le lot vérifié : objet +
   corps exact de chaque mail, divulgation art. 50 incluse, **plafonné au palier
   du jour**, écartés motivés. Rien ne part.
4. **`proposer`** — dépose ce qui mérite une décision humaine, en citant les
   FAITS de la fiche.

Toi, dans l'app : tu approuves. L'envoi réel part ensuite par la voie gardée
(palier + mentions + divulgation), une fois **l'autopilote armé** (le bouton sur
`/controle`).

---

## 6. Ce qui te protège (et pourquoi tu peux le laisser tourner)

- **Aucun envoi depuis MCP** — testé (`tests/middleware-public.test.ts` refuse
  tout chemin d'action dans le serveur ; `tests/preparer-campagne.test.ts` refuse
  tout transport dans la route de préparation).
- **Préflight art. 50** par la même fonction que l'envoi : un mail sans aveu IA
  est signalé, le lot ne s'envoie pas.
- **Palier du jour** : le lot est plafonné, le reste attend — on ne grille pas le
  domaine d'un coup.
- **Zéro coordonnée ne sort** : l'agent voit le texte à relire, jamais l'adresse
  email.
- **Clé scopée** : une portée en trop, tu la retires ; l'outil disparaît.

---

## 7. Révoquer / faire tourner une clé

Retire l'entrée de `ALPHA_API_KEYS` (ou change son secret) et **redéploie**. La
clé cesse d'être reconnue au boot suivant. Fais tourner le secret si tu doutes
qu'il ait fuité — c'est une variable d'environnement, pas un déploiement de code.

---

## 8. Pannes fréquentes

| Symptôme | Cause | Remède |
|---|---|---|
| `authentifie: false` / 401 | Clé absente ou mal formée dans `ALPHA_API_KEYS` | Vérifier le format `nom:prop:portees:secret`, redéployer |
| Un outil manque dans `tools/list` | La clé n'a pas la portée | Ajouter la portée à l'entrée de clé |
| `/api/v1/*` → **503** | Supabase pas configuré | Poser `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| `preparer_campagne` rend `vu: 0` | Pipe non synchronisé côté serveur | Réglages → Synchro du pipe (opt-in) |
| Le plan est prêt mais rien ne part | Normal : l'envoi est humain-gardé | DKIM (`docs/SMTP-SUPABASE-AMEN.md`) + armer l'autopilote |

> ⚠ « Rien ne part » n'est pas une panne : c'est la conception. L'agent prépare,
> tu armes, la garde envoie.
