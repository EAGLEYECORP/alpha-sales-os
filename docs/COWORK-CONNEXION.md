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

Dans les réglages de connecteurs de Claude (côté claude.ai / Cowork), ajoute un
**serveur MCP distant (HTTP)** :

- **URL** : `https://<ton-app>/api/mcp`
- **Authentification** : en-tête `Authorization: Bearer <SECRET>` (Alpha
  s'authentifie par **clé API**, pas par OAuth).

> ⚠⚠ **CETTE ÉTAPE PEUT ÊTRE IMPOSSIBLE SUR TON COMPTE — vérifié le 29/09/2026
> dans la doc officielle des connecteurs Claude.** claude.ai / Cowork acceptent
> trois authentifications : **OAuth** (par défaut, pour tous), **aucune**, et
> **en-têtes statiques** (`static_headers`) — cette dernière est en **bêta,
> réservée à un nombre limité d'organisations**, et seul un **Owner**
> d'organisation la voit. Sans elle, la section « Request headers » **n'apparaît
> pas** quand on ajoute le connecteur : il n'y a nulle part où coller le Bearer.
> · **Test en 10 secondes** : Réglages → Connecteurs → Ajouter un connecteur
>   personnalisé. Section « Request headers » visible ? → ce guide marche tel
>   quel. Absente ? → Alpha ne peut PAS être branché sur Cowork aujourd'hui, et ce
>   n'est pas une erreur de ta part.
> · **Claude Code (terminal) n'a pas cette limite** : `claude mcp add --transport
>   http alpha https://<ton-app>/api/mcp --header "Authorization: Bearer <SECRET>"`.
> · **Ce qui lève la limite pour tout le monde : OAuth** — c'est pour ça qu'Attio
>   se branche en un clic (OAuth sur `mcp.attio.com`, aucune clé). Le serveur
>   OAuth de Supabase aurait été la voie naturelle, mais son ticket `supabase/auth#2820`
>   (ouvert) le fait répondre 400 aux clients publics, à `offline_access` et au
>   paramètre `resource` — exactement ce qu'envoie un client MCP. Chantier
>   ouvert, pas encore livré : voir `docs/AUTONOMIE-100.md`.
>
> Cette doc prescrivait le Bearer comme s'il était disponible partout. C'était
> faux pour la plupart des comptes, et c'est pire qu'une doc absente : on
> cherche un champ qui n'existe pas en croyant se tromper.

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
