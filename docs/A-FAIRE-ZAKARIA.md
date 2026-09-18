# CE QUE JE NE PEUX PAS FAIRE À TA PLACE

> Écrit le 13/09/2026, veille de lancement. Tout ce qui est ici est **bloqué
> sur toi** — je n'ai accès ni à ton Vercel, ni à ton Supabase, ni au portail
> de ton registrar, et le proxy de développement me refuse `github.com`,
> `data.grandlyon.com` et toute clé live (vérifié, pas supposé).
>
> Ce qui n'est PAS ici est fait : le code est vert (`tsc` + 1854 tests), le
> build de production passe sans un avertissement.

---

## 📍 ÉTAT AU 18/09/2026 — L'HÉBERGEUR EST **NETLIFY**, PAS VERCEL

Cette page a été écrite pour Vercel. On a basculé sur **Netlify** (site
`alphasalesos`, id `a8a40591-b8b1-4cb6-98cf-61b2f29092ab`). Raison mesurée : le
sandbox ne peut PAS piloter Vercel (aucun jeton, aucun outil, hôtes bloqués) et
PEUT piloter Netlify (MCP `manage-env-vars`, `get-project`). Le mécanisme est
identique — Vercel Cron n'était de toute façon jamais l'ordonnanceur (c'est
`pg_cron`). Les sections « Vercel » ci-dessous se lisent « Netlify ».

**FAIT ET PROUVÉ SUR SERVEUR RÉEL (login effectué le 18/09) :**
- Les 6 variables de comptes + `REQUIRE_AUTH=1` sont posées ; **la connexion
  fonctionne** avec `contact@eagleyecorp.fr`. C'est la première fois que la
  bascule auth est prouvée en vrai (avant, aucune ACCEPTATION n'avait été
  testée, seulement les refus).
- ⚠ **Un piège traversé** : `SUPABASE_JWT_SECRET` avait d'abord reçu un **UUID**
  collé par erreur (un identifiant, pas le secret). Le code vérifie en **HS256 strict**
  (`lib/supabase-jwt.ts`) → tout jeton échouait **en silence** (`/api/health`
  affichait « sain »). Remplacé par le vrai JWT Secret → login OK. Leçon : le
  seul juge d'un secret de signature est un **login réel**, pas `/api/health`.

**FAIT — L'ENVOI EST CÂBLÉ (Amen `contact@eagleyecorp.fr`) :**
- `SMTP_HOST=smtp-fr.securemail.pro`, `SMTP_PORT=465`, `SMTP_USER` + `SMTP_FROM`
  = `contact@eagleyecorp.fr`, `SMTP_PASS` posé en secret. Deploy **Published**.
- ⚠ **Le scan de secrets Netlify a cassé le build** en prenant l'hôte, l'email
  et le port (présents dans `docs/SMTP-SUPABASE-AMEN.md`) pour des secrets.
  Désarmé par `SECRETS_SCAN_OMIT_KEYS=SMTP_HOST,SMTP_PORT,SMTP_USER,SMTP_FROM`
  — **sur ces 4 clés seulement**. Les vrais secrets (`SMTP_PASS`,
  `SUPABASE_JWT_SECRET`, `SERVICE_ROLE`) **restent scannés**. Ne JAMAIS mettre
  `SECRETS_SCAN_ENABLED=false` : ça éteindrait l'alarme le jour d'une vraie fuite.

## 🔴 CE QUI RESTE — dans l'ordre

1. **PROUVER L'ENVOI** (2 min, toi) : `/recette` → adresse test
   `eagleyecorp.ad@gmail.com` → bouton d'envoi. `/api/send` se dit « configured »
   mais ça ne prouve PAS le mot de passe ; **seul un email qui arrive** le prouve.
   Erreur `EAUTH`/`535` → mot de passe faux ; timeout → port.
2. **DÉLIVRABILITÉ DNS chez Amen** — LE prochain bloquant des VENTES. Sans ça,
   la prospection tombe en spam, **et la même boîte porte les devis ET les mails
   d'inscription Supabase** (une seule adresse). À poser : **SPF** (un seul
   `v=spf1` incluant `securemail.pro`), **DKIM** (activé le 16/09 — relever le
   sélecteur `s=` dans un en-tête reçu pour vérifier), **DMARC**. Procédure :
   `docs/SMTP-SUPABASE-AMEN.md`. La vérif DNS se fait depuis le sandbox (requête
   DNS publique NON bloquée) — une prochaine session peut la diagnostiquer.
3. **DOMAINE `alphasalesos.eagleyecorp.fr`** → le brancher sur Netlify, PUIS
   poser `APP_BASE_URL=https://alphasalesos.eagleyecorp.fr`. Aujourd'hui le code
   retombe proprement sur l'URL Netlify (`lib/url-publique.ts`) — ça marche,
   mais les métadonnées Open Graph pointent vers le sous-domaine `.netlify.app`.

---

> 📌 **Quand tu auras fait tout ça : `docs/VERIFIER-QUE-CA-MARCHE.md`.**
> Ce document-ci dit quoi faire ; celui-là dit comment SAVOIR que c'est fait.
> Les deux ne se remplacent pas — j'ai vérifié tous les REFUS sur un serveur
> de production le 16/09, mais **aucune acceptation** : ça demande un compte,
> une base et de vraies clés. Cette moitié-là ne se délègue pas.

## 🔴 BLOQUANT — sans ça, rien ne part

### 1. Les variables Vercel, **dans cet ordre**

C'est le seul écart entre aujourd'hui et « `contact@eagleyecorp.fr` en pleine
capacité ». Mesuré : sans `OWNER_EMAILS`, `estMaitre("contact@eagleyecorp.fr")`
rend **`false`**, et tu restes au socle gratuit comme n'importe quel inscrit.

```
1. NEXT_PUBLIC_SUPABASE_URL       = https://<projet>.supabase.co
2. NEXT_PUBLIC_SUPABASE_ANON_KEY  = (Supabase → Settings → API → anon public)
3. SUPABASE_SERVICE_ROLE_KEY      = (Supabase → Settings → API → service_role)
4. SUPABASE_JWT_SECRET            = (Supabase → Settings → API → JWT Secret)
5. OWNER_EMAILS                   = contact@eagleyecorp.fr,eagleyecorp.ad@gmail.com
   NEXT_PUBLIC_OWNER_EMAILS       = (EXACTEMENT la même liste)
6. REQUIRE_AUTH                   = 1     ← EN DERNIER, jamais avant
```

> ⚠⚠ **CETTE LISTE EN OMETTAIT DEUX, ET SUIVRE LA DOC TE MURAIT DEHORS DE TA
> PROPRE PRODUCTION** — mesuré le 17/09/2026, en croisant la doc avec ce que le
> code lit réellement.
> · **`NEXT_PUBLIC_SUPABASE_ANON_KEY` est ce avec quoi on SE CONNECTE.**
>   `getSupabaseConfig()` rend `null` sans elle, donc `signIn` n'existe pas.
>   Poser les quatre d'avant, puis `REQUIRE_AUTH=1`, donnait : le serveur exige
>   un compte, et le navigateur n'a pas de quoi en ouvrir un.
> · L'app avait déjà **un écran dédié à cette impasse** (« Connexion
>   impossible », `auth-gate.tsx`) — quelqu'un l'avait anticipée dans
>   l'interface sans jamais l'ajouter ici. Le défaut de signature du dépôt,
>   sur la porte d'entrée.
> · **`SUPABASE_SERVICE_ROLE_KEY`** lit les droits côté serveur. Sans elle,
>   l'invariant fait retomber **tout le monde au socle gratuit** — toi compris
>   pour les briques payantes (ton statut maître, lui, survit : `estMaitre`
>   lit l'email du JETON et court-circuite la base, exprès).
> · ⚠ Les deux `NEXT_PUBLIC_*` doivent exister **au moment du BUILD**, pas
>   seulement à l'exécution : elles sont inlinées dans le bundle. Après les
>   avoir posées, **redéploie** — sinon rien ne change.
> · `tests/variables-lancement.test.ts` croise désormais cette liste avec les
>   `process.env` du chemin d'authentification. Une variable que le code exige
>   et que la doc tait refait tomber le build.

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

### 2. Les migrations — UN SEUL COPIER-COLLER

Ouvre **`supabase/migrations/LOT-A-COLLER.sql`**, tout sélectionner, coller
dans Supabase → SQL Editor → **Run**. Une fois. Ça se fait depuis un
téléphone.

Le fichier se termine par un **tableau de vérification** : sept lignes, une
colonne `etat`. Tout `OK` = c'est fait. Tu n'as rien d'autre à interpréter.

> ⚠⚠ **Ce lot a été EXÉCUTÉ, pas seulement relu** (17/09/2026, Postgres 16
> local avec un décor `auth`/`storage` imité). Trois passages d'affilée sur la
> même base : zéro erreur, sept `OK` sur sept à chaque fois. Le déclencheur
> d'inscription a été éprouvé pour de bon — un compte créé obtient
> `statut = essai`, **30 jours**, `cout_consomme_eur = 0.00` ; `debiter_essai`
> cumule bien (0,25 € puis 1,25 €) ; rejouer le déclencheur sur un compte
> existant n'écrase pas son compteur.
>
> ⚠ **Ce que ça ne prouve PAS** : ça n'a pas tourné sur TA base, avec tes
> données et le vrai `auth.users` de Supabase. Le décor local imite le
> nécessaire, il ne remplace pas la production.

> ⚠⚠ **L'ancienne rédaction de cette section disait « 002 → 011 », et elle
> était FAUSSE de trois fichiers** : ni `schema.sql`, ni `001`, ni `012`.
> Trouvé en exécutant, pas en relisant — sur une base neuve, `001` s'arrête
> net (« relation "public.prospects" does not exist ») parce qu'il ALTÈRE des
> tables que `schema.sql` crée. Le lot les met dans le bon ordre.

> ⚠⚠ **`004-ordonnanceur.sql` N'EST PAS DANS LE LOT, et c'est délibéré.** Il
> lit deux secrets dans le Vault et **lève une exception** s'ils manquent —
> plutôt que d'appeler la route sans en-tête d'authentification. Dans un lot
> « colle et oublie », il planifierait un cron qui échoue toutes les dix
> minutes, en silence, sur ta production. Il se pose **à part, après** avoir
> renseigné les deux secrets (la marche à suivre est en tête du fichier).

> ⚠ Le lot est **engendré** par `npm run sql:lot`, jamais écrit à la main, et
> `tests/migrations-lot.test.ts` refuse qu'il dérive de ses migrations. Une
> retouche manuelle fait tomber le build — vérifié par mutation.

> ⚠ La **010** va avec une variable Vercel : **`CREDENTIALS_MASTER_KEY`**,
> 32 octets, qui chiffre les clés que les locataires collent. Sans elle,
> aucune clé ne peut être enregistrée — et c'est un refus franc, jamais un
> stockage en clair « en attendant ». Pour la générer :
> `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
>
> ⚠⚠ **À essayer en vrai dès qu'elle est posée** : Réglages → « Ta clé IA » →
> coller une vraie clé → « Vérifier et enregistrer ». Le serveur fait un VRAI
> appel avant d'accepter. Je n'ai pas pu le faire d'ici (le proxy refuse les
> clés live), donc **ce chemin n'a jamais tourné pour de bon**.

> ⚠ La **009** est ce qui fait marcher « n'exiger la mention de provenance
> qu'au premier message ». Sans elle, la colonne n'existe pas, la requête
> échoue, et on retombe sur le comportement d'avant — la mention exigée à
> chaque fois. Ça ne casse rien, mais ça ne sert à rien non plus.

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

### 5. SPF · DKIM · DMARC — **il n'en manque qu'UN**

> **Relevé le 15/09/2026 dans le DNS public**, pas supposé. Cette ligne était
> écrite comme si les trois étaient à faire : **deux étaient déjà posées.**

| | État | À faire |
|---|---|---|
| **SPF** | `v=spf1 include:spf.webapps.net ~all`, un seul | **rien — n'y touche pas** |
| **DMARC** | `p=quarantine; adkim=s; aspf=s` | **rien — n'en crée pas un second** |
| **DKIM** | **activé** (rapporté le 16/09) — non confirmé par sondage DNS | **relever le sélecteur**, voir ci-dessous |

### ✅ 16/09 — DKIM activé, et les inscriptions Supabase arrivent

**C'était le bloquant n°1 de toute la semaine.** Un inscrit qui ne reçoit pas
son mail de confirmation ne devient jamais client : tout le reste du produit
était derrière cette porte.

> ⚠⚠ **ET C'EST UNE MEILLEURE NOUVELLE QUE « LE MAIL EST ARRIVÉ ».** Le DMARC
> du domaine est en **`p=quarantine`** : un message qui échoue à
> l'authentification part en **indésirables**, il n'arrive pas en boîte de
> réception. Qu'il arrive au bon endroit veut donc dire que **DMARC passe** —
> ce n'est pas de la tolérance du destinataire, c'est une politique appliquée.

**Ce qui reste à relever, et ça prend vingt secondes** — parce que ça décide
de ce qui tient le domaine debout :

1. Ouvre un mail reçu chez Gmail → **⋮ → Afficher l'original**.
2. Dans l'en-tête `DKIM-Signature`, relève **`s=`** (le sélecteur) et **`d=`**
   (le domaine signé). **Ne copie pas le reste** — la valeur `b=` est la
   signature elle-même.
3. `d=` doit valoir **exactement `eagleyecorp.fr`**. S'il vaut
   `securemail.pro` ou autre chose, DKIM passe mais **ne s'aligne pas** avec
   `adkim=s` — et c'est alors SPF qui porte tout, sans filet.

> ⚠ Un sondage DNS depuis la session n'a trouvé **aucun** sélecteur parmi 22
> courants. **Ça ne prouve rien** — un sélecteur est une chaîne arbitraire et
> le DNS ne s'énumère pas — mais ça veut dire qu'on ne peut pas le vérifier
> d'ici tant que tu ne l'as pas nommé. Une fois `s=` connu, la vérification
> devient une commande :
> ```bash
> node -e "require('node:dns').promises.resolveTxt('<s>._domainkey.eagleyecorp.fr').then(r=>console.log(r.flat().join('')))"
> ```

Le reste — ce qu'implique l'alignement strict et quoi faire si un `pass`
manque : `docs/SMTP-SUPABASE-AMEN.md` §3.

`/api/health` → `capabilities.email` dit ce qui manque **côté serveur**, jamais
l'état DNS. Celui-là se relève en dix secondes, et la commande est dans le doc.

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

### ✅ TRANCHÉ LE 15/09 — la provenance, au PREMIER message seulement

**Option 2 retenue par Zakaria, et câblée.** Ce qui suit dit ce que ça fait,
et ce que ça ne fait pas encore.

**Ce qui est en place** (`lib/conformite.ts` · `lib/tracking.ts` · `/api/send`) :
- Au **premier** message à une adresse, `/api/send` exige une phrase disant
  d'où vient l'adresse — et le refus **donne une formulation utilisable**, un
  garde qui refuse sans dire quoi écrire se fait désarmer.
- Sur une **relance**, rien n'est exigé de plus : l'exiger refuserait un
  message parfaitement licite.
- Le **rang se calcule côté serveur** (`aDejaEcrit`), jamais depuis la
  requête. Un appelant qui pourrait annoncer « c'est une relance » se
  dispenserait de la mention en le disant.
- **Toute panne mène à « premier »**, donc à exiger la mention. Les deux
  erreurs ne coûtent pas pareil : une phrase de trop contre un manquement.
- Six mutations vérifiées une par une — retirer le contrôle, le rendre
  inconditionnel, figer le rang, le faire venir du client, ouvrir sur panne,
  affaiblir le motif. Les six font tomber un test.

> ⚠ **La mention ne vit PAS dans un gabarit, et c'est délibéré.** La
> provenance change d'une fiche à l'autre : écrire « registre public » en dur
> mettrait cette phrase sur une adresse prise ailleurs — une information
> **fausse**, donc pire que pas d'information.

**✅ LE SMS EST TRACÉ** (15/09, à ta demande). La branche SMS écrit désormais
une ligne — après acceptation seulement — et le rang se calcule comme pour
l'email. Un SMS de relance ne porte plus la mention.

> ⚠⚠ **Ce qui fait marcher ça n'est pas la colonne, c'est la NORMALISATION.**
> « 04 65 71 34 56 » et « +33465713456 » sont la même personne ; comparés
> bruts, ce sont deux personnes, et la mention repartirait à chaque SMS **en
> ayant l'air parfaitement branchée**. La clé passe par `toE164` — importé,
> pas recopié : le dépôt porte déjà deux définitions du « même numéro », une
> troisième aurait divergé.

> ⚠ **Effet de bord trouvé en faisant ça, et corrigé** : `createTrackedEmail`
> s'exécute forcément AVANT l'envoi (c'est elle qui réécrit les liens). Un
> SMTP en échec laissait donc une trace — et le message suivant se serait
> dispensé de la mention alors que le premier n'était **jamais arrivé**.
> L'invariant est désormais : **une ligne = un message effectivement parti**.
> Corollaire assumé : un envoi échoué ne compte plus dans le palier du jour
> ni dans le plafond horaire. C'est cohérent — ces bornes protègent la
> réputation du domaine, et un message jamais parti ne peut pas l'abîmer.

### ⚠⚠ L'ANCIENNE QUESTION, GARDÉE POUR SA RAISON

Trouvé le 15/09 en vérifiant la doctrine CNIL, pas par un test.

La CNIL écrit que lorsque les adresses sont **acquises auprès de tiers ou déjà
en possession**, il faut **s'assurer que la personne a bien été informée** de
l'usage possible de son adresse à des fins de prospection, et qu'elle peut s'y
opposer. `[SOURCE-PRIMAIRE — CNIL, prospection commerciale]`

**Ça vise exactement notre sourcing** : arrêtés de permis, LinkedIn, feuilles
Google. Personne, dans ces fichiers, n'a jamais été informé de quoi que ce
soit — et l'obligation ne disparaît pas parce qu'on n'a pas collecté soi-même.
En pratique, le premier email EST la première communication : c'est là que
l'information se donne (une phrase disant d'où vient l'adresse).

**Ce que `lib/conformite.ts` exige aujourd'hui sur l'email** : identité ·
objet en rapport avec la fonction · moyen de refus dans chaque message ·
traitement immédiat d'une opposition. **Les quatre sont là. La provenance de
l'adresse, non.**

> **Pourquoi je ne l'ai pas ajoutée** : `verifieMentions` **refuse** un message
> auquel il manque une mention obligatoire, et `force` ne passe pas outre —
> c'est la doctrine, et elle est juste. Ajouter une cinquième exigence
> aujourd'hui ferait donc **échouer chaque gabarit existant**, donc chaque
> envoi, le jour où tu lances. Un garde qui bloque tout le jour J n'est pas
> une protection, c'est une panne que j'aurais créée.

**Trois options, et c'est à toi de trancher :**
1. **Une phrase dans le pied de chaque email de prospection** (« votre adresse
   provient de … ; vous pouvez vous y opposer en répondant STOP »). Le plus
   propre, et le plus coûteux : tous les gabarits sont à relire.
2. **La mention seulement sur le PREMIER message** à une adresse donnée. C'est
   ce que demande le texte, mais ça exige de savoir si on a déjà écrit — le
   CRM le sait, donc c'est faisable.
3. **Ne rien changer** en assumant le risque, le temps de la semaine de
   lancement, et le faire ensuite.

> C'était l'**option 2** qui a été retenue. Les deux autres restent écrites
> au-dessus : une décision dont on efface les branches écartées se fait
> réexaminer à l'envers par la session suivante, qui croit corriger un oubli.

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
1. Les variables Vercel (6)        → tu as ton accès complet
2. LOT-A-COLLER.sql, un seul Run   → la base suit  (004 à part, après)
3. SMTP + DNS                      → tu peux envoyer  (JAMAIS avant 1)
4. L'export de fiches              → la machine a de quoi mordre
5. python voice/agent.py           → l'agent peut parler
```

**Rien ne sert de faire 3 avant 1.** C'est la seule dépendance qui coûte cher
si on l'inverse.
