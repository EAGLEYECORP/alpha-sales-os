# BYOK — apporter sa propre clé : ce que ça coûte, exactement

> Chiffrage demandé le 16/09/2026.
>
> ✅ **L0 + L1 + L6 + L7 (IA) et L2 (email) ONT ÉTÉ FAITS le 16/09** — voir
> « CE QUI A ÉTÉ LIVRÉ » en fin de document. Restent L3 (SMS), L4
> (transcription) et L5 (téléphonie), ni décidés ni codés.
>
> Tout ce qui est marqué `[MESURÉ]` vient du dépôt, relevé en l'ouvrant.
> Tout ce qui est marqué `[DÉCISION]` est un choix que je propose et qui
> n'est validé par rien. Tout ce qui est marqué `[ESTIMÉ]` est un effort que
> personne n'a encore payé — c'est la catégorie la moins fiable du document.

---

## POURQUOI CETTE QUESTION SE POSE

`[MESURÉ]` Un compte gratuit peut appeler **4 familles d'API sur 20** :
`/api/brain`, `/api/crm`, `/api/knowledge`, `/api/email` (aperçu seul).

Tout le reste est fermé, et la raison est écrite à dix endroits du dépôt :

> Il n'existe aucun chemin d'identifiants par locataire.

`/api/ai` brûle NOTRE clé, `/api/send` lit NOTRE SMTP, `/api/voice` NOS
minutes. La limite du gratuit n'est donc pas un arbitrage commercial qu'on
pourrait assouplir : c'est un fait technique. **Le BYOK est la seule chose
qui le change.**

---

## 1. CE QUI SE DÉPLACE, ET CE QUI NE SE DÉPLACE JAMAIS

`[MESURÉ]` — relevé en listant les `process.env` de chaque route, commentaires
retirés.

### Éligible au BYOK — cinq capacités, et rien d'autre

| Capacité | Variables | Routes concernées |
|---|---|---|
| **ia** | `ANTHROPIC_API_KEY` `AI_MODEL` `NVIDIA_API_KEY` `NVIDIA_BASE_URL` `NVIDIA_MODEL` | `lib/ai-engine.ts` · `lib/nvidia.ts` · `/api/agent` · `/api/sparring` |
| **email** | `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `SMTP_FROM` | `/api/send` · `/api/digest` · `/api/gmail/draft` |
| **sms** | `TEXTBELT_KEY` `TEXTBELT_URL` | `/api/send` · `/api/digest` |
| **transcription** | `DEEPGRAM_API_KEY` `WHISPER_API_KEY` `WHISPER_API_URL` `WHISPER_MODEL` | `/api/transcribe` |
| **telephonie** | `LIVEKIT_URL` `LIVEKIT_API_KEY` `LIVEKIT_API_SECRET` | `/api/voice/call` |

### ⚠⚠ CE QUI NE DOIT JAMAIS DEVENIR BYOK

`SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_JWT_SECRET` · `CRON_SECRET` ·
`SITE_PASSWORD` · `STRIPE_WEBHOOK_SECRET` · `WEBHOOK_SECRET` ·
`VOICE_WEBHOOK_SECRET` · `VAPID_PUBLIC_KEY` · `APP_BASE_URL` ·
`TRACKING_BASE_URL`.

Ce ne sont pas des identifiants de service tiers : **c'est la serrure de la
maison.** Les rendre par locataire ne « personnalise » rien, ça donne les
clés du cloisonnement à celui qu'il est censé cloisonner. La distinction n'est
pas une prudence, c'est la ligne : *un identifiant BYOK achète un service à un
tiers ; un secret d'infrastructure protège les données des autres locataires.*

**Deux cas intermédiaires, à ne pas classer par réflexe :**
- `NOTION_TOKEN` / `CALENDAR_TOKEN` — techniquement BYOK, mais ils ne nous
  coûtent **rien** : `/api/notion/push` et `/api/calendar` ne brûlent ni
  jetons ni minutes. Les rendre BYOK n'ouvre aucune brique. **Hors périmètre**,
  et le dire évite de gonfler le lot sans rien débloquer.
- `IMAP_*` (`/api/gmail/draft`) — même famille que SMTP, à traiter avec lui
  ou pas du tout : un brouillon Gmail sans boîte d'envoi n'a pas de sens.

---

## 2. LA TABLE

```sql
create table if not exists public.tenant_credentials (
  tenant_id       uuid not null references auth.users (id) on delete cascade,
  capacite        text not null check (capacite in
                    ('ia','email','sms','transcription','telephonie')),
  secret_chiffre  text not null,
  nonce           text not null,
  cle_version     integer not null default 1,
  empreinte       text not null,
  cree_le         timestamptz not null default now(),
  verifie_le      timestamptz,
  dernier_echec   text,
  primary key (tenant_id, capacite)
);

alter table public.tenant_credentials enable row level security;
-- Aucune policy : PERSONNE ne lit cette table depuis un JWT client.
-- Seul le service role y accède, côté serveur.
```

### Les cinq décisions de conception, et leur motif

`[DÉCISION]` **Une ligne par CAPACITÉ, pas par variable.** SMTP a besoin de
cinq valeurs cohérentes entre elles. Une ligne par variable autoriserait un
SMTP à moitié configuré — un hôte sans mot de passe — c'est-à-dire l'état où
l'on croit avoir branché et où rien ne part.

`[DÉCISION]` **Un blob chiffré, pas des colonnes.** Ajouter un fournisseur
demain ne doit pas demander une migration. La forme interne du secret est
l'affaire du module de résolution, pas du schéma.

`[DÉCISION]` **`empreinte` = les derniers caractères, en clair.** L'écran des
Réglages doit pouvoir afficher « clé IA … a4f2 » sans jamais redescendre le
secret dans un navigateur. Même doctrine que le mot de passe SMTP que Supabase
ne réaffiche jamais : **on écrit, on ne relit pas.**

`[DÉCISION]` **`verifie_le` — une clé jamais vérifiée n'ouvre rien.** Sinon un
locataire colle une clé fausse, la brique s'ouvre, et le premier vrai usage
échoue devant un prospect. `null` ⇒ la capacité reste fermée.

`[DÉCISION]` **RLS sans aucune policy.** Le locataire ne doit pas pouvoir
relire sa propre clé : une faille XSS dans SON navigateur exfiltrerait un
secret qu'il ne peut de toute façon pas avoir besoin de lire. Écriture par une
route serveur, lecture jamais.

---

## 3. LE MODULE, ET LA RÈGLE QUI DOIT N'EXISTER QU'UNE FOIS

> ⚠ Le module ci-dessous **n'existe pas** : il est proposé. Son chemin n'est
> donc pas écrit comme un chemin du dépôt — `tests/gabarit-env.test.ts`
> refuse qu'une doc cite entre accents graves un fichier absent, et il a
> raison : une référence morte ne plante rien, elle apprend juste au lecteur
> qu'il peut cesser de croire la doc. Le fichier s'appellerait
> **lib/credentials.ts**.

```ts
export type Capacite = "ia" | "email" | "sms" | "transcription" | "telephonie";

export type Origine = "locataire" | "maison" | "aucune";

export interface Resolution<T> {
  valeurs: T | null;
  origine: Origine;   // qui paie cet appel — la réponse est toujours écrite
}

export async function resoudreIdentifiants<T>(
  tenantId: string | null,
  capacite: Capacite,
  droits: Entitlement
): Promise<Resolution<T>>;
```

**L'ordre de résolution, et il ne se pose qu'ICI :**

```
1. le locataire a une clé VÉRIFIÉE pour cette capacité   → origine "locataire"
2. sinon, la brique payante correspondante lui est ACQUISE → origine "maison"
3. sinon                                                   → "aucune", on refuse
```

> ⚠⚠ **Le point 2 est celui qui peut ruiner l'entreprise si on l'écrit à
> l'envers.** « Pas de clé locataire ⇒ on prend la nôtre » sans vérifier la
> brique, c'est exactement la situation d'aujourd'hui en pire : tout inscrit
> dépenserait sur notre compte, et **ça ne se verrait que sur la facture, un
> mois plus tard**. L'ordre doit être testé par mutation, pas par relecture.

> ⚠ **Toute panne ⇒ `origine: "aucune"`.** Base injoignable, déchiffrement
> raté, clé maître absente : on refuse. Le réflexe inverse (« en cas de doute,
> ne pas bloquer ») ouvrirait notre portefeuille au moment précis où l'on ne
> sait plus rien. C'est la même doctrine que `firstSendAt` et `aDejaEcrit`.

> ⚠ `origine` n'est pas décoratif : c'est ce qui permettra plus tard de
> compter ce que chaque locataire nous coûte VRAIMENT. Aujourd'hui personne ne
> le sait.

### Le chiffrement

`[DÉCISION]` AES-256-GCM via `node:crypto` (déjà utilisé dans le dépôt, aucune
dépendance nouvelle), clé maître dans `CREDENTIALS_MASTER_KEY` côté serveur,
`cle_version` pour permettre une rotation sans tout réécrire d'un coup.

> ⚠⚠ **C'EST LE VRAI COÛT DU BYOK, ET IL N'EST PAS DANS LE CODE.** Aujourd'hui
> une fuite de notre environnement serveur expose NOS clés — c'est grave et
> c'est notre problème. Demain, elle exposerait **les clés de nos clients** :
> leur facturation IA, et un SMTP capable d'envoyer sous LEUR domaine. Ce
> n'est pas le même risque, ce n'est pas la même responsabilité juridique, et
> aucune ligne de code ne le réduit. Ça se décide en le sachant.

---

## 4. LE GATE — une seule ligne à changer, et c'est ce qui rend le chantier faisable

`[MESURÉ]` Le contrôle d'accès aux API vit à **un seul endroit** :
`middleware.ts:459-460`.

```ts
const chemin = pathname.startsWith("/api/") ? cheminMetierDeLApi(pathname) : pathname;
if (!autorise(droits, chemin)) { /* 403 brique_absente */ }
```

Il devient :

```ts
if (!autorise(droits, chemin) && !(await apporteSaCle(droits, chemin))) { … }
```

> ⚠ **Ce `&&` est de la bonne forme, et il faut se méfier de sa jumelle.**
> L'écran de connexion a déjà payé un `&&` là où il fallait un `||`. Ici, les
> deux chemins ACCORDENT et le refus exige que les deux échouent — donc une
> panne de `apporteSaCle` doit rendre `false`, jamais lever, jamais `true`.
> Trois mutations obligatoires : inverser l'opérateur, faire rendre `true` sur
> panne, retirer la vérification de `verifie_le`.

---

## 5. LES LOTS, ET L'EFFORT

`[ESTIMÉ]` — **aucun de ces nombres n'est mesuré.** Ils cumulent les bornes
HAUTES, doctrine de `lib/veille.ts` : additionner les bornes basses suppose le
meilleur des cas sur chaque brique en même temps, et c'est ce qui fait tenir un
devis sur le papier et pas à la livraison.

| Lot | Contenu | Jours |
|---|---|---|
| **L0 — socle** | table + migration 010 + le module de résolution + chiffrement + tests de mutation | 2–3 |
| **L1 — IA** | unifier les TROIS chemins d'accès au modèle, puis y brancher la clé | 1,5–2,5 |
| **L2 — email** | 2 `createTransport` + le palier d'envoi qui devient par locataire | 1,5–2,5 |
| **L3 — SMS** | 2 points d'appel Textbelt | 0,5–1 |
| **L4 — transcription** | 1 route | 0,5–1 |
| **L5 — téléphonie** | 1 route, **mais pas seulement un secret** (voir ci-dessous) | 2–4 |
| **L6 — écran Réglages** | saisie, empreinte, bouton « tester la clé », suppression | 1,5–2 |
| **L7 — droits** | gate conditionnel + réécriture des gardes d'entitlements | 1–2 |
| **L8 — doctrine** | CLAUDE.md, README, `docs/` | 0,5 |
| | **TOTAL, bornes hautes** | **≈ 18,5 j** |

**≈ 4 semaines pleines d'une seule personne.** Pour mémoire,
`EFFORT_RAPIDE_MAX_JOURS = 10` dans `lib/veille.ts` : ce chantier est **au
double** de ce que le dépôt appelle « rapide ».

### Les trois endroits où l'estimation peut déraper

`[MESURÉ]` **L1 porte une dette avant même de commencer.** La surface IA
devait être un goulot unique — `runAI` / `runAIJson`, 7 points d'appel sur 5
routes. Mais `/api/agent` et `/api/sparring` **contournent `runAI`** et lisent
`process.env.ANTHROPIC_API_KEY` eux-mêmes, en appelant `streamText` en direct.
Ça fait **trois** définitions de « comment on joint le modèle ». Le BYOK exige
d'en avoir **une**. Environ une journée du lot L1 ne sert donc pas le BYOK :
elle paie une dette existante — et elle la paierait de toute façon au prochain
changement de fournisseur.

`[MESURÉ]` **L2 cache une règle qui change de sens.** Le palier d'envoi
(`lib/email-ramp.ts`, 5/jour puis +5/semaine, 40 au plafond) est calculé sur
**nos** lignes de tracking, pour protéger **notre** réputation de domaine. Un
locataire qui envoie depuis SON SMTP et SON domaine n'a aucune raison d'être
plafonné par notre historique — et nous n'avons aucune raison de le protéger,
puisque ce n'est plus notre domaine. Le palier doit devenir **par locataire et
par domaine**, ce qui n'est pas un branchement mais une révision de la règle.

`[DÉCISION]` **L5 n'est pas un secret, c'est une infrastructure.** Coller une
clé LiveKit ne suffit pas à passer un appel : il faut un **numéro**, un
**trunk SIP**, une **dispatch rule**, et un agent vocal vivant
(`lib/presence-agent.ts` refuse de composer sans battement). Le BYOK
téléphonie n'ouvre donc rien tout seul. **Je le sortirais du périmètre** — il
double presque le risque du chantier pour la capacité que le moins de gens
sauront configurer.

---

## 6. CE QUE ÇA RAPPORTE, ET CE QUE ÇA COÛTE EN REVENU

### Ce que ça débloque `[MESURÉ]`

Le lot **L1 seul** (IA) rend fonctionnelles : `/api/ai`, `/api/sparring`,
`/api/agent`, `/api/icp`, `/api/brain`, `/api/social`, `/api/debrief`,
`/api/audit/extract`. Donc, côté écrans : **`/closer` cesse d'être une coquille**
(ses deux fonctions sont IA), et `/prospects/[id]` — l'écran central du CRM —
récupère la moitié de ses boutons morts.

C'est, de très loin, le meilleur rapport entre l'effort et ce qui se débloque.

### ⚠⚠ Ce que ça retire du catalogue payant

| Brique | Ce qu'elle facture aujourd'hui | Après BYOK |
|---|---|---|
| `agent-alpha` (490 €/mois) | **uniquement nos jetons** | il ne reste presque rien à vendre |
| `audits` | jetons IA + récupération de sites | il reste l'egress, pas l'IA |
| `campagnes` | notre SMTP + notre tracking | il reste le tracking |
| `tracking` | **notre infrastructure** | inchangé |
| `alpha-voice` | nos minutes + le numéro + l'installation | inchangé si L5 est hors périmètre |

**Le BYOK vide `agent-alpha` de sa substance commerciale et entame
`campagnes`.** Ce n'est pas un détail d'implémentation, c'est le modèle.

> Le contre-argument honnête : `JUILLET_REEL.gagnes` vaut **0**. Un revenu
> qu'on n'a pas n'est pas un revenu qu'on perd. Mais ça change ce qu'on
> raconte, et il vaut mieux le changer exprès qu'en le découvrant.

---

## 7. CE QUE JE RECOMMANDERAIS, ET POURQUOI

**BYOK sur le GRATUIT uniquement. Les offres payantes gardent nos clés.**

```
GRATUIT  → tu apportes ta clé. Tout fonctionne. Tu paies ton fournisseur.
PAYANT   → tu ne t'occupes de rien. C'est précisément ce que tu achètes.
```

Trois raisons, et aucune n'est une préférence :

1. **Ça ne retire rien au catalogue.** `agent-alpha` continue de se vendre à
   qui ne veut pas gérer de clé — c'est-à-dire la majorité des dirigeants de
   PME, qui est notre cible. La commodité redevient le produit, au lieu du
   jeton.
2. **Ça rend le gratuit conforme à sa propre doctrine.** « Le but du gratuit,
   c'est qu'il rapporte assez pour payer la suite » est écrit dans `CLAUDE.md`
   et **ne peut pas tenir aujourd'hui** : un gratuit ne peut ni écrire avec
   l'IA, ni envoyer. La promesse existe, le produit ne la sert pas.
3. **Ça renforce l'argument de souveraineté au lieu de le contredire.** Ses
   clés, son fournisseur, ses données. C'est l'angle que `tests/vitrine-fuite`
   exige de conserver, et le BYOK en est la démonstration la plus concrète
   qu'on puisse offrir.

### Le périmètre que je proposerais

**L0 + L1 + L6 + L7 — l'IA seule.** `[ESTIMÉ]` **9,5 jours en bornes hautes**,
soit environ deux semaines.

C'est ce qui débloque le plus d'écrans morts pour le moins de risque : aucun
secret d'envoi stocké (donc pas de SMTP d'autrui à protéger), aucune
infrastructure téléphonique, et une dette de conception payée au passage.

L2 (email) mérite d'être décidé **après** — il apporte le vrai levier
commercial mais c'est lui qui porte le risque de garde (le palier d'envoi à
repenser) et la responsabilité la plus lourde (détenir le SMTP d'un client).

---

## 8. CE QUI RESTERAIT FAUX APRÈS, ET QU'IL FAUT DIRE

- **Le BYOK ne répare pas l'inscription.** `docs/A-FAIRE-ZAKARIA.md` §5 : DKIM
  absent, DMARC `p=quarantine`, alignement SPF impossible chez l'hébergeur. Un
  nouvel utilisateur qui ne reçoit pas son email de confirmation ne verra
  jamais un seul de ces écrans. **Ça passe avant, quoi qu'on décide ici.**
- **Le plafond `localStorage` reste** (~1 200 fiches) tant que `/api/pipeline`
  n'est pas ouvert. Ce n'est pas un problème de clé : c'est **notre** base, et
  ça ne s'ouvre pas avec une clé tierce. Question distincte, à trancher à part.
- **Aucune vente n'a validé quoi que ce soit ici.** Ni le fait que les gens
  aient une clé IA, ni qu'ils acceptent de la coller, ni qu'ils préfèrent
  payer pour ne pas le faire. **Le premier prospect qui dit « je n'ai pas de
  clé et je n'en veux pas » vaut plus que ce document entier.**


---

## 9. CE QUI A ÉTÉ LIVRÉ — 16/09/2026

Périmètre **L0 + L1 + L6 + L7**, l'IA seule. `tsc` propre, 1931 tests verts,
`next build` sans un avertissement.

| Lot | Ce qui existe |
|---|---|
| **L0** | `lib/credentials.ts` (Edge) + `lib/credentials-secret.ts` (Node) · migration 010 · AES-256-GCM · `CREDENTIALS_MASTER_KEY` documentée |
| **L1** | `runAI` reçoit son moteur ; `/api/agent` et `/api/sparring` ne lisent plus la clé ; la cascade dupliquée de `sparring` a disparu |
| **L6** | `components/settings/cle-ia.tsx` + `/api/credentials` (GET/POST/DELETE) |
| **L7** | seconde porte dans `middleware.ts` : brique achetée **OU** clé apportée |

### Ce que le chiffrage n'avait pas vu

**Le module devait être coupé en deux, et c'est `next build` qui l'a dit.**
Le middleware tourne en **Edge**, où `node:crypto` n'existe pas : `tsc`
compilait, les tests passaient, le build échouait. La séparation qui en
résulte est meilleure que le plan d'origine — **la porte d'entrée n'a aucune
raison de savoir déchiffrer une clé**, elle a seulement besoin de savoir
qu'il en existe une, vérifiée.

**Le défaut le plus coûteux du lot ne produit aucune erreur** :
`anthropic(model)` du SDK lit `ANTHROPIC_API_KEY` dans l'environnement. Écrit
ainsi, l'appel d'un locataire — clé collée, vérifiée, affichée comme active —
serait facturé sur NOTRE compte, et tout aurait l'air de marcher.
`createAnthropic({ apiKey })` est la seule forme qui prend la clé qu'on lui
donne ; un test refuse l'autre.

**`MODELE_ANTHROPIC_DEFAUT` était recopié quatre fois** et n'existait pas dans
`lib/modeles.ts`, où vivent pourtant les modèles morts. Corrigé au passage.

### Ce qui n'est PAS couvert, et qu'il faut savoir

⚠ **Deux replis ne sont gardés que sur la SOURCE.** Faire rendre une capacité
à `capacitesDu` sur une erreur de base, ou retirer le filtre `verifie_le` :
les deux mutations sont passées au vert, parce que sans Supabase configuré
ces branches sont **inatteignables** ici. Les gardes vérifient donc la FORME
du code, pas ce qu'il fait — ils tiennent jusqu'au jour où quelqu'un écrira
la même faute autrement. **Une base de test reste à faire.**

⚠ **Rien n'a été essayé contre un vrai fournisseur.** Le proxy de
développement refuse les clés live. La vérification de clé (`/api/credentials`
→ appel réel) n'a jamais tourné pour de bon : c'est le premier geste à faire
côté serveur, avec une vraie clé.

### ✅ VÉRIFIÉ SUR SERVEUR RÉEL — 16/09/2026

Relevé en frappant un serveur de **production** (`.next/standalone/server.js`,
l'artefact qui part réellement — `next start` avertit lui-même qu'il ne
correspond pas à la configuration `output: standalone`). Les deux se
comportent à l'identique, vérifié.

**Scénario 1 — production, aucun compte, aucun mot de passe** (le cas que le
correctif du 13/09 a fermé) :

| Route | Réponse |
|---|---|
| `/api/ai` `/api/agent` `/api/sparring` `/api/icp` | **403** `brique_absente` |
| `/api/send` (email **et** sms) | **403** `brique_absente` |
| `/api/audit/generate` `/api/social/draft` `/api/transcribe` `/api/voice/call` | **403** `brique_absente` |
| `/api/digest` | **403** `maitre_requis` ← la reclassification du 16/09 |
| `/api/pipeline` `/api/voice-costs` `/api/knowledge` `/api/references` | **403** `maitre_requis` |
| `/api/credentials` **GET** | **200** `{"cles":{}}` — joignable par un gratuit, c'est le point |
| `/api/credentials` **POST / DELETE** | **401** — le locataire vient du jeton, et rien ne part avant |
| `/aujourdhui` `/pipeline` `/closer` `/cerveau` `/linkedin` `/templates` `/settings` `/vitrine` | **200** |
| `/api/brain` `/api/email/preview` `/api/crm/patch` en GET | **405** — méthode refusée, donc la route est ATTEINTE (pas 403) |

**Scénario 2 — `SMTP_*` et `ANTHROPIC_API_KEY` posés, toujours aucun compte.**
C'est « poser le SMTP avant les comptes », que `docs/A-FAIRE-ZAKARIA.md`
appelle la dépendance la plus chère du dépôt. `/api/send` répond toujours
**403** : le correctif du 13/09 survit au refactor L2.

Et `/api/health` rend désormais, pour un appelant anonyme :
```json
{ "configured": false, "model": "moteur de templates (hors-ligne)",
  "engines": [], "origine": "aucune" }
```
**Avant le BYOK, il aurait annoncé `configured: true`** en lisant
l'environnement global. Il répond maintenant « qu'est-ce qui te répondrait, à
TOI » — un diagnostic qui rassure à tort étant pire qu'aucun.

**Scénario 3 — `SITE_PASSWORD` posé, toujours aucun compte.** Tout rend
**401** et les pages admin redirigent vers `/gate`. Conforme à
`exigeMotDePasse` : préfixes admin toujours, et **tout le reste tant
qu'aucun compte n'existe** — le mur ne se lève que lorsque la serrure de
remplacement est en place.

> ⚠⚠ **CE QUE CE RELEVÉ NE PROUVE PAS, ET C'EST LA MOITIÉ QUI MANQUE.**
> **J'ai vérifié tous les REFUS. Je n'ai pu vérifier AUCUNE acceptation.**
> Ouvrir un chemin par une clé apportée demande un compte, une base et une
> vraie clé — les trois hors de portée d'ici. Donc : on sait que rien ne
> s'ouvre par erreur ; on ne sait pas encore que quelque chose s'ouvre quand
> ça doit. Les deux comptent, et seule la première est acquise.

### Ce qu'il reste à poser côté Zakaria

1. **migration 010** dans le SQL editor ;
2. **`CREDENTIALS_MASTER_KEY`** sur Vercel — sans elle, aucune clé ne peut
   être enregistrée (et c'est un refus franc, pas un stockage en clair) :
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`


---

## 10. L2 — L'EMAIL, LIVRÉ LE 16/09/2026

Un locataire branche son SMTP dans **Réglages → « Ta boîte d'envoi »** ; le
serveur **se connecte et s'authentifie** avant d'accepter, puis ses emails
partent de SON domaine, sous SA réputation. `/campaigns` s'ouvre à lui.

### Ce que le chiffrage avait vu trop noir

**Le palier d'envoi était DÉJÀ par locataire.** Le chiffrage annonçait « une
révision de la règle » ; mesuré, `firstSendAt("email", tenantId)` et
`countRecentSends(…, tenantId)` sont scopés depuis toujours. Ce qui change
n'est donc pas le calcul mais sa RAISON : le palier ne protège plus notre
domaine, il protège **celui qui envoie** — et l'argument du taux de plainte
(§7 : une seule plainte vaut 2,5 % à 40 envois/jour) vaut pour lui aussi.

### Ce que le chiffrage n'avait pas vu, et qui était plus grave

**⚠⚠ `/api/send` sert DEUX canaux, et le canal vit dans le CORPS de la
requête.** Le middleware ne le lit pas — et ne doit pas. Ouvrir `/campaigns` à
qui apporte un SMTP rendait donc la branche **SMS** atteignable : un locataire
aurait dépensé NOS crédits Textbelt. La porte est grossière par nécessité ;
c'est la ROUTE qui est l'autorité, via `resoudreSms`. Précédent assumé dans ce
dépôt : `/controle` montre le bouton, le serveur refuse.

**⚠⚠ `/api/digest` est devenue MAÎTRE-SEUL.** Son en-tête vante une propriété
de sécurité — « le destinataire n'est JAMAIS pris dans la requête, toujours
dans l'environnement » — qui la rendait sûre pour **un** opérateur et la
retourne en multi-locataire : un tiers l'appelle, et le SMS part sur NOTRE
téléphone, à NOS frais. Le défaut préexistait ; le BYOK le rendait atteignable.

**`/api/deliverability/dns` auditait NOTRE domaine.** Sur un compte qui
apporte sa boîte, il rendait un rapport parfaitement vert et parfaitement
inutile — le pire des deux, puisqu'il rassure.

**Le lien STOP pointait vers notre boîte.** Un refus qui arrive chez nous
n'est jamais traité par celui qui doit le traiter, et le prospect continue de
recevoir ses messages après avoir dit non.

**`/api/gmail` a été volontairement laissée de côté** : elle écrit via NOTRE
IMAP, et la capacité `email` n'apporte qu'un SMTP. L'inscrire ne changerait
rien de visible aujourd'hui — et c'est exactement ce qui rend le piège
dangereux : il ne se déclencherait que plus tard.

### Les gardes

Dix mutations, toutes mordent. **L'une a dû être réécrite** : elle cherchait
`return s;` par position, et la mutation qui la fait tomber
(`if (smtpUtilisable(s)) return s;`) **contient** cette sous-chaîne — le garde
était satisfait par un fragment de la faute qu'il devait refuser.

### À poser côté Zakaria

**Migration 011.** Rien d'autre : `CREDENTIALS_MASTER_KEY` sert déjà aux deux
capacités.
