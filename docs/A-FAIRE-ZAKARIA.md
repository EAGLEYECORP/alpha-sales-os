# CE QUE JE NE PEUX PAS FAIRE À TA PLACE

> Écrit le 13/09/2026, veille de lancement. Tout ce qui est ici est **bloqué
> sur toi** — je n'ai accès ni à ton Vercel, ni à ton Supabase, ni au portail
> de ton registrar, et le proxy de développement me refuse `github.com`,
> `data.grandlyon.com` et toute clé live (vérifié, pas supposé).
>
> Ce qui n'est PAS ici est fait : le code est vert (`tsc` + 1854 tests), le
> build de production passe sans un avertissement.

---

## 🔴 BLOQUANT — sans ça, rien ne part

### 1. Les quatre variables Vercel, **dans cet ordre**

C'est le seul écart entre aujourd'hui et « `contact@eagleyecorp.fr` en pleine
capacité ». Mesuré : sans `OWNER_EMAILS`, `estMaitre("contact@eagleyecorp.fr")`
rend **`false`**, et tu restes au socle gratuit comme n'importe quel inscrit.

```
1. NEXT_PUBLIC_SUPABASE_URL   = https://<projet>.supabase.co
2. SUPABASE_JWT_SECRET        = (Supabase → Settings → API → JWT Secret)
3. OWNER_EMAILS               = contact@eagleyecorp.fr,eagleyecorp.ad@gmail.com
   NEXT_PUBLIC_OWNER_EMAILS   = (EXACTEMENT la même liste)
4. REQUIRE_AUTH               = 1        ← EN DERNIER, jamais avant
```

> ⚠ **Les trois premières ne changent RIEN tant que la quatrième n'est pas
> posée** — vérifié sur serveur réel. Et `REQUIRE_AUTH=1` sans
> `SUPABASE_JWT_SECRET` fait répondre **503** aux API de données : la
> misconfiguration n'ouvre jamais, elle ferme.

**Vérification, avant et après** : `GET /api/health` une fois connecté. Lis
`auth.serverEnv`, `auth.serverEnforced`, `auth.misconfigured`, `auth.verrou`
et `proprietaire.coherent` (les deux listes `OWNER_EMAILS` concordent-elles).

> ⚠ Depuis le 13/09, sur une production **sans comptes ET sans
> `SITE_PASSWORD`**, plus personne n'a les briques payantes — toi compris.
> Avant, tout le monde les avait, y compris un inconnu. C'est le bon
> comportement, et ça rend cette étape **bloquante** au lieu d'optionnelle.
> Si tu déploies avant de poser les variables, garde `SITE_PASSWORD` : il
> mure tout tant que les comptes ne sont pas actifs.

### 2. Les migrations, 002 → 008

Dans le SQL editor Supabase, **dans l'ordre**. Toutes vérifiées rejouables :
aucun DDL non protégé, tu ne casses rien en repassant une migration.

```
002-entitlements.sql            droits par compte
003-organisation.sql            multi-utilisateur
004-ordonnanceur.sql            pg_cron + pg_net (⚠ secret dans le VAULT)
005-presence-agent.sql          battement de l'agent vocal
006-rendez-vous-cloisonnes.sql
007-attribution-apporteurs.sql
008-essai-plafond-cout.sql      ← NOUVELLE : le plafond de dépense de l'essai
```

> ⚠ Le secret du cron vit dans le **Vault** Supabase, jamais dans le SQL
> versionné. `CRON_SECRET` sur Vercel doit valoir exactement la même chose.

### 3. Le carburant — l'export de fiches

**Le seul vrai bloquant que je ne peux pas contourner.** Le proxy me refuse
`data.grandlyon.com`. Sans fiches, le compteur de traction affiche `8 / 300`
(le jeu de démo) et toute la mécanique tourne à vide.

Cible : **300 fiches** de l'ICP (`FUEL_TARGET`). À 7,7 % mesurés, ça vaut
**11 à 47 rendez-vous**.

> Tu as déjà **20 fiches** dans `donnees-privees/prospects-icp.csv` et
> **16 fiches de juillet** (3 au stade `offre`, 3 en `demo`, 1 en `redzone`).
> Ce n'est pas rien : les 3 `offre` sont ce qui peut produire du cash cette
> semaine.

---

## 🟠 AVANT LE PREMIER ENVOI

### 4. SMTP — `contact@eagleyecorp.fr`

```
SMTP_HOST · SMTP_PORT · SMTP_USER · SMTP_PASS · SMTP_FROM
```

Procédure complète : `docs/SMTP-SUPABASE-AMEN.md`.

> ⚠⚠ **À poser APRÈS l'étape 1.** Tant que les comptes ne sont pas actifs et
> que `SITE_PASSWORD` n'est pas là, `/api/send` est joignable par n'importe
> qui. Avec le SMTP configuré, ça veut dire de vrais emails partant de ton
> domaine, pour des inconnus — et ça ne se voit que sur la réputation, des
> semaines plus tard.

> ⚠ Le transactionnel (inscriptions Supabase) et le commercial partagent cette
> boîte. Une campagne qui prend des plaintes fait tomber les mails de
> confirmation **en même temps**. Ce qui rend ça tenable : le palier d'envoi
> (5/jour la première semaine, +5 par semaine, 40 au plafond), et rien d'autre.

### 5. SPF · DKIM · DMARC

Chez ton registrar. Sans eux, les campagnes partent en spam et le domaine se
grille en une semaine. `/api/health` → `capabilities.email` te dit ce qui
manque côté serveur, mais **pas** l'état DNS : ça se vérifie chez le
registrar.

### 6. `CRON_SECRET`

Sur Vercel **et** dans le Vault Supabase, identiques. Sans ça, `/api/campaign/tick`
rend **401** — et c'est voulu : « une route qui passe des appels ne s'ouvre pas ».

---

## 🟡 POUR QUE L'AGENT VOCAL PARLE

### 7. Lancer `voice/agent.py` — chaque matin

```bash
python voice/agent.py
```

**Le seul geste qui exige ta machine.** L'agent bat toutes les 30 s ;
`lib/presence-agent.ts` refuse de composer sans battement récent.

> ⚠ Sans lui, la ligne compose, le prospect décroche, **personne ne parle**.
> C'est pire que de ne pas appeler : fiche brûlée, réputation du numéro,
> minutes facturées. La garde existe — ne la contourne pas.

Les **seize variables** de `voice/.env` ne vont **pas** sur Vercel (documenté
dans `.env.example`).

---

## 🔵 À VÉRIFIER TOI-MÊME — je n'y ai pas accès

### 8. Y a-t-il eu des inscriptions ?

Je ne peux pas le savoir : aucune variable Supabase ici, sortie vers
`supabase.com` bloquée. Dans le SQL editor :

```sql
select count(*) as inscrits, max(created_at) as derniere from auth.users;
select email, created_at, last_sign_in_at
from auth.users order by created_at desc limit 20;
```

### 9. Le dépôt passe en privé

> ⚠⚠ **Ça n'annule rien de ce qui est déjà sorti.** L'historique git garde
> tout, les forks et clones existants aussi, et les caches d'indexation.
> Passer en privé arrête l'hémorragie ; ça ne rappelle pas ce qui est parti.
>
> **Les gardes ne se retirent pas pour autant** : `tests/donnees-reelles`,
> `tests/noms-reels`, les plages ARCEP. Un dépôt privé se partage, se clone,
> et redevient public par accident. Ce sont des données de tiers, pas un
> secret commercial.

### 10. Supprimer la vidéo Higgsfield

`5ca79265-6144-4f43-974d-b27a1952d24a`, depuis l'interface — le MCP n'expose
aucun outil de suppression.

---

## ⚪ DÉCISIONS QUI N'ATTENDENT QUE TOI

| Sujet | Ce qui bloque |
|---|---|
| **Partage cohorte** des comptes gratuits | Mesurer la valeur produite exige de collecter. Compteurs seulement, opt-in, jamais de contenu — mais **ça touche l'argument de souveraineté**. Ça se décide, ça ne se code pas en douce. |
| **La table de veille** (`lib/veille.ts`) | Vide, exprès. Des entrées devinées **routeraient de vrais dossiers**. Donne-moi trois ou quatre dépôts que tu as en tête et je les qualifie. |
| **`currentProcess`** — l'opérationnel du prospect | Ta méthode dit « comprendre de l'intérieur **sans les déranger** ». Rien ne remplit ce champ sans un échange. Dis-moi comment tu le fais en vrai et je le code. |
| **Le prix au siège** | Critère d'abandon écrit : *si tes trois premiers prospects discutent le comptage des utilisateurs au lieu du prix, c'est raté.* |

---

## CE QUI EST FAIT, POUR QUE TU NE LE REFASSES PAS

- Grille au **siège** (socle 600 + 80/utilisateur), neutre à 5 sièges, branchée à un curseur sur `/offre`
- **Essai 30 jours** avec plafond de dépense dérivé (30 €), coût inconnu ⇒ fermé
- **Interdictions sectorielles** (CPF, rénovation énergétique, assurance) dans `auditScript` **et** dans le Cerveau
- **Plan de traction** sur `/aujourdhui` : une seule prochaine action, projection avec intervalle, **zéro euro projeté**
- **Routage** par faisabilité **et** par taille, avec `arbitrage-humain` quand les deux se contredisent
- Le **taux de juillet corrigé** : 7,7 % (brut) et non 11,8 % (qualifié) — 300 fiches valent ~23 RDV, pas 35
- La **vignette de partage** ne pointe plus vers `localhost`
- Une prod sans serrure n'ouvre plus les briques payantes
- Le **Cerveau** : 11 notes, toutes dérivées des modules

---

## L'ORDRE, SI TU NE DEVAIS RETENIR QU'UNE CHOSE

```
1. Les 4 variables Vercel          → tu as ton accès complet
2. Les migrations 002 → 008        → la base suit
3. SMTP + DNS                      → tu peux envoyer  (JAMAIS avant 1)
4. L'export de fiches              → la machine a de quoi mordre
5. python voice/agent.py           → l'agent peut parler
```

**Rien ne sert de faire 3 avant 1.** C'est la seule dépendance qui coûte cher
si on l'inverse.
