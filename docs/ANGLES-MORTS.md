# Angles morts & reste à faire — ALPHA SALES OS

État franc au terme du chantier SaaS. Ce qui est posé, ce qui n'est pas prouvé,
ce qui reste. Pas de « c'est bon » de complaisance.

---

## ✅ Posé et testé (en build)

- **Comptes multi-locataires** — Supabase Auth, mur de connexion (`AuthGate`),
  page `/compte`, reset de mot de passe.
- **Isolation données utilisateur** — RLS (prospects/campaigns/meetings/…),
  preuve outillée `npm run verify:rls`.
- **Frontière serveur** — JWT HS256 vérifié dans le middleware (opt-in,
  fail-closed). 7 tests + smoke test live.
- **Tables service-role scopées** par `user_id` (tracking/inbound/crm). 4 tests.
- **Facturation Stripe** — Checkout, portail, webhook signé, `subscriptions`,
  garde-fou d'envoi, **accès propriétaire par domaine**. 9 tests + smoke test live.
- **Économie IA** — compression de contexte opt-in au chokepoint `runAI`,
  adoptée dans l'agent + audit/extract. 6 tests.
- Total : **1 080 tests**, typecheck 0, build OK.

> ⚠ La liste ci-dessus date du chantier SaaS et n'a pas suivi. Ne prends pas
> cette section pour un état des lieux à jour. Ce qui suit, si.

---

## 🔎 Passe de vérification complète — 27/08/2026

**1 126 tests verts · `tsc --noEmit` propre · build OK · balayage navigateur**
sur serveur réel (production, `next start`), et non en développement.

### Ce que la passe a trouvé : toujours le même défaut

Neuf défauts, et **aucun n'est une erreur de logique**. À chaque fois : du code
juste, une doctrine juste, écrite noir sur blanc — et rien qui relie les deux.
La garde nomme un FICHIER, la donnée est recopiée dans le fichier d'à côté.

| # | Ce qui n'allait pas | Gravité |
|---|---|---|
| 1 | L'ancre du catalogue (10 000 € / 1 000 €) saisie **trois fois** ; la garde existante ne couvrait que les deux autres prix | silencieux |
| 2 | `/api/catalogue` et `/api/catalogue/reference` servaient **notre économie de partenariat** à tout locataire authentifié — dont ScintIA et Nuwacom | **haute** |
| 3 | `lib/ladder.ts` mettait `commissionPct:30` / `15` dans un **chunk public**, servi sans mot de passe | **haute** |
| 4 | `lib/accounts.ts` faisait de même avec le taux des trois comptes | **haute** |
| 5 | Trois **vrais prospects et leurs dates de RDV** (***NOM-RETIRE***, Vauban, ***NOM-RETIRE***) dans un chunk public | **haute** |
| 6 | Une fiche importée de LinkedIn sortait avec **sept champs `undefined`** | **haute** |
| 7 | `clearAllData()` (assistant) et `importData()` (restauration) **détruisaient tout en un clic**, sans rien demander — pendant que le MÊME appel, ailleurs, confirmait | **haute** |
| 8 | Le mur de stockage n'était branché que sur **une des quatre** surfaces d'import | moyenne |
| 9 | `deleteMeeting()` supprimait un RDV daté sans question, quand `deleteProspect()` demandait | moyenne |
| + | Un retour de paiement sans offre reconnue laissait l'acheteur devant une page vide | moyenne |
| + | Deux références mortes (`publicBricks()`) pointant vers du code supprimé | faible |

**Tout est corrigé, et chaque garde a été cassée puis restaurée** pour vérifier
qu'elle mord vraiment.

### Ce qui a rendu ces défauts invisibles

Trois phrases du dépôt affirmaient une protection qui n'existait pas :

- « `bricks` réimporte les prix publics » — vrai pour deux constantes sur quatre.
- « `tests/store.test.ts` le vérifie champ par champ » — **zéro occurrence** de
  `prospectDefaults` dans ce fichier.
- « Voir `publicBricks()` dans lib/bricks.ts » — fonction supprimée depuis, et
  supprimée **parce qu'elle faisait fuiter le catalogue**.

Un commentaire faux se croit sur parole, et il rassure exactement là où il
faudrait vérifier. Les nouvelles gardes **dérivent** donc leur liste de la
source (le type, les données, les appelants) au lieu de la recopier.

### Le piège qui s'est refermé cinq fois

Un test de forme qui lit la source BRUTE punit le fait d'écrire *pourquoi* :
expliquer en commentaire qu'on n'importe pas le catalogue oblige à écrire son
nom, ce que la garde interdisait. Un `import` ne s'exécute pas depuis un
commentaire — les gardes concernées jugent maintenant le code, commentaires
retirés, et une mutation vérifie qu'elles attrapent toujours la vraie faute.

### Ce qui a été vérifié en conditions réelles

- **Matrice de gating**, serveur de production avec `SITE_PASSWORD` : sans
  comptes, tout est muré ; avec comptes, une page produit renvoie vers
  `/compte?bloque=…` et une page admin vers `/gate`. Deux portes, deux publics.
- **Jeton forgé non-maître** → `403 maitre_requis` sur les routes du patrimoine ;
  jeton maître → passe. Mode solo (sans comptes) inchangé.
- **48 routes d'API** balayées en GET, POST malformé et POST vide : **aucun 500**.
  `/api/v1` et `/api/mcp` refusent tout sans clé (liste d'outils vide, message
  explicite) — fail-closed.
- **Art. 50 (IA Act)** : `audit_script` refuse les cinq scripts non conformes
  testés ; le miroir TypeScript/Python est verrouillé motif par motif.
- **Balayage du bundle construit** : plus aucun taux de partenariat sous 100 %,
  aucun nom de prospect, aucune coordonnée de closing. Les deux chaînes qui
  ressemblaient à des clés (`nvapi-…`, `eyJhbGciOi…`) sont des **placeholders**
  de formulaire, vérifié en contexte.
- **Balayage navigateur, 36 écrans, ~700 commandes cliquées** une par une, sur
  page rechargée à chaque clic (contexte neuf par écran, donc pas de dérive
  d'état). Résultat : **zéro erreur JS non rattrapée, zéro 4xx/5xx applicatif,
  zéro écran blanc.** Tout ce qui a été signalé est une confirmation légitime
  (`confirm` sur action destructrice, `alert` de doctrine « conviction 9/10 —
  il faut 10/10 »), le certificat Google Fonts injoignable dans le bac à sable,
  ou le 503 Supabase — que l'interface AFFICHE correctement avec la raison du
  serveur, vérifié dans `components/sync-prospects.tsx`.
- **Les actions vers le monde réel sont gardées, et mieux qu'avec une boîte de
  dialogue.** `/api/voice/call` oppose des portes SERVEUR non contournables
  (B2B, cible professionnelle confirmée, aucune opposition) ; seule la fenêtre
  horaire est forçable, par un bouton distinct. La newsletter confirme en deux
  temps. Rien à corriger — vérifié plutôt que supposé.

> ⚠ Limite de l'outil de balayage, à connaître avant d'y croire trop : il
> repère les commandes par (texte, rang) et recharge la page entre deux clics.
> Quand le DOM se réordonne, le libellé enregistré ne correspond plus à
> l'élément cliqué — d'où des lignes absurdes comme « Copier l'adresse
> d'abonnement → confirme la suppression d'un RDV ». Le BRUIT est réel, son
> attribution ne l'est pas. Chaque signalement a été rouvert à la main.

### Ce qui n'a PAS pu être vérifié d'ici, et ne doit pas être présumé

Le proxy du bac à sable bloque les services live. **Rien de ce qui suit n'est
prouvé** — ce sont des vérifications à faire côté toi, une fois :

- Supabase réel (RLS à deux comptes), Stripe réel (un paiement test bout-en-bout).
- Telnyx / LiveKit / Fish : aucun appel réel passé depuis ici.
- Le webhook Stripe n'a jamais reçu d'événement authentique signé.

### Ce qui laisse ce type de défaut passer, et ce que ça coûterait de fermer

Le défaut n° 6 (sept champs `undefined` sur une fiche LinkedIn) n'était pas
visible du compilateur pour deux raisons cumulées :

1. **Les `as Prospect`** en fin de constructeur (`profilVersProspect`,
   `normalizeProspect`). Un cast affirme, il ne vérifie pas. Le socle
   `prospectDefaults` est un littéral sans annotation : ajouter un champ non
   optionnel à `Prospect` ne produit **aucune erreur** là où il manque.
2. **`noUncheckedIndexedAccess: false`** dans `tsconfig.json` — explicitement
   désactivé. `tab[0]` est donc typé `T` et non `T | undefined`, alors qu'il
   peut parfaitement être vide.

Mesuré : l'activer produit **438 erreurs**, dont **195 hors tests** — surtout
`lib/store.ts` (28) et les pages (22). Ce n'est pas un interrupteur, c'est un
chantier d'une journée. Il n'est pas fait, et je ne l'ouvre pas sans que ce soit
décidé : la moitié des corrections seraient mécaniques, l'autre demande de
choisir quoi faire quand la valeur manque — c'est-à-dire du produit.

En attendant, `tests/prospect-defaults.test.ts` couvre le cas précis qui a
coûté un écran blanc, en dérivant la liste des champs du type lui-même.

### Deux points laissés en l'état, volontairement

- **`prompt()` natif sur « Marquer fait » (`/meetings`)** — alors que
  `components/ui/reason-dialog.tsx` a été écrit pour remplacer les prompts
  natifs. Le call-site porte une correction subtile (annuler doit annuler :
  `null` ≠ `""`) que le remplacement risquerait de perdre. À faire avec soin,
  pas au passage.
- **`« volume du deal estimé X € — trop lourd pour nous »`** — formulation
  interne affichée sur la fiche prospect. Ce n'est pas une fuite (elle reste
  côté opérateur), mais elle se lit mal si tu partages ton écran en rendez-vous.

---

## 🔎 Seconde passe — « ce qu'on vend » n'arrivait pas jusqu'au prospect

**1 165 tests verts.** Déclenchée par une remarque de Zakaria : *un appel
sortant doit avoir un script de base fondé sur l'offre représentée.* Il avait
raison, et le défaut allait bien plus loin que l'appel.

### Le même angle, écrit en dur à SIX endroits

`deepDive` calcule l'offre correctement depuis toujours, en la contraignant aux
offres autorisées du compte. `briefForScript` l'écrit noir sur blanc. Et six
producteurs de texte l'ignoraient, chacun figé sur l'angle **Callflow** :

| # | Où | Ce que recevait une fiche routée « visibilité » |
|---|---|---|
| 1 | rôle du script vocal | « proposer un audit de leur accueil téléphonique » |
| 2 | corps + objet de l'email | « une question sur vos appels » |
| 3 | message LinkedIn | les mêmes phrases, **dupliquées mot pour mot** |
| 4 | questions de l'argumentaire | « quand le téléphone sonne, il se passe quoi ? » |
| 5 | `gaps` du deep-dive | ordre d'aller chercher « le volume d'appels manqués » |
| 6 | contexte de `/api/ai` | aucune offre → le modèle la devine ou l'invente |

Le pire cas : l'autopilote envoyait un prompt contenant **« Offre pertinente :
Visibilité »** et **« proposer un audit de leur accueil téléphonique »** — deux
offres contradictoires, arbitrées par le modèle, en direct, devant le prospect.

Chaque correction révélait la suivante : les tests par module étaient tous
verts sur leur périmètre. D'où `tests/surface-prospect.test.ts`, qui **compose**
toutes les sorties d'une même fiche et cherche le vocabulaire des offres qu'on
ne lui vend pas. Sa limite est écrite : la liste des surfaces est explicite.

### Deux défauts trouvés en LISANT le rendu, pas le code

Les tests étaient verts dans les deux cas.

- **L'observation de métier du playbook** était ajoutée après le bon critère et
  ramenait le téléphone. Les onze critères du playbook parlent tous du
  téléphone : ils appartiennent à Callflow. C'est vérifiable, et un test le
  vérifie — le jour où ce n'est plus vrai, la règle se rediscute.
- **Le brief d'appel emportait notre estimation du deal** : « Gros chantier
  (> 40 000 €) — volume du deal estimé 48 000 € — trop lourd pour nous », dans
  le prompt d'un appel en direct, pendant que la règle dure du même script dit
  « aucun prix ». `ladderPitch` est désormais traitée comme une **frontière** :
  les faits du prospect passent, notre arbitrage non.

### ⚠ Le plus grave : cinq clients cités qui n'existent pas

`lib/hormozi.ts` — le script hors-ligne, **celui qui tourne aujourd'hui**
puisque `/api/health` rend `ai: { configured: false }` — affirmait sous
l'intitulé « Le produit fonctionne » :

> « les restos lyonnais **qu'on équipe** prennent leurs réservations la nuit »
> « **nos** pubs clients remplissent leurs mardis soir »
> « **nos** clients ambulanciers ne ratent plus une demande de nuit »

Cinq secteurs, cinq affirmations de clientèle, **zéro vente**. C'est la ligne
rouge explicite de CLAUDE.md, et un seul « lequel ? » met fin à l'entretien.

Et c'était **déjà résolu à un fichier de distance** : `lib/templates.ts` porte
depuis le début « une référence réelle si elle existe, sinon le mécanisme —
jamais un client inventé ». La discipline existait, elle n'avait pas traversé.
`proof` devient `mecanisme` : ce que le produit fait, vrai sans client et
démontrable séance tenante.

### Ce que j'ai refusé d'écrire

Trois occasions d'« améliorer » qui auraient fabriqué de la preuve :

- **La norme du marché** pour la visibilité et Alpha Sales OS. Ce sont des
  affirmations sur le marché, dites à un prospect, sur des offres jamais
  vendues. Le bloc reste vide et l'écran dit pourquoi.
- **Renommer le document d'audit** au titre de l'aimant annoncé. `magnetReadiness`
  montre qu'il ne tient que 3/4, 2/4 et 1/4 des promesses selon l'aimant : le
  renommer lui ferait promettre davantage.
- **Tripler `lib/templates.ts`** par offre. C'est une bibliothèque parcourue à
  la main, indexée par métier, sans envoi automatique — pas le même défaut.

> ⚠ **Ce qui reste à relire avant le premier lot.** Les raisons d'appel, les
> questions d'ouverture et les cinq phrases de mécanisme sont de MOI. Elles
> respectent la doctrine (aucun prix, une seule question, aucun client
> inventé) et n'ont jamais été dites à personne. Elles vivent chacune en un
> seul endroit : `lib/offer-match.ts`, `lib/approche-ecrite.ts`,
> `lib/hormozi.ts`.

**Coût mesuré** de l'offre recâblée partout : `deepDive` = 36 µs par fiche,
60 ms pour le tunnel d'envoi complet sur 1 000 fiches. Aucune mémoïsation
nécessaire.

### ⚠ Correction — un test supprimé continuait de tourner

`npm test` compilait vers `.test-build/` **sans jamais purger ce dossier**. Un
fichier de test effacé de la source y restait compilé et continuait de
s'exécuter. Constaté sur mes propres sondes temporaires : la suite annonçait
1 167 tests, un nettoyage manuel l'a ramenée à 1 163. **J'avais annoncé les
chiffres gonflés dans deux messages de commit et dans une version antérieure
de cette page.** Les chiffres corrigés sont ceux affichés ici.

Le cas qui coûte cher n'est pas le test en trop : c'est le test **supprimé
parce qu'il était faux**. Il continue de passer, donc d'imposer une règle
qu'on a justement décidé d'abandonner — et plus aucune source ne dit pourquoi.
La purge se fait maintenant en Node (aucune dépendance ajoutée), et
`tests/harnais.test.ts` vérifie qu'elle précède bien la compilation.

---

## ⚠ Les angles morts (à traiter avant d'ouvrir aux clients)

### 1. Rien n'est prouvé contre les VRAIS services
Tout est vérifié en build + tests synthétiques, mais **pas contre un vrai projet
Supabase ni un vrai compte Stripe**. À faire côté toi, une fois :
- `npm run verify:rls` à deux comptes → verdict VERT (`docs/PREUVE-RLS.md`).
- Un paiement test Stripe bout-en-bout (`docs/FACTURATION.md`, carte `4242…`).
**Tant que ces deux preuves ne sont pas faites, ne facture personne.**

### 2. Légal / conformité (bloquant commercial, hors code)
Avant de vendre un SaaS qui traite les prospects de tes clients :
- **CGV/CGU**, **Politique de confidentialité**, **DPA** (sous-traitance RGPD —
  leurs prospects sont des données personnelles), mention légale, cookies.
- Registre des traitements, durée de conservation, export/suppression sur demande.
Rien de tout ça n'est dans le code — c'est un chantier juridique à mener.

### 3. Modèle de déploiement à trancher explicitement
Deux modèles, l'archi supporte les deux — **choisis** :
- **(a) Une instance par client** (BYO-creds) : chaque commercial déploie SON
  instance avec SES clés (Supabase, SMTP, IA). Marche AUJOURD'HUI, simple,
  aligné « one-person business » (cf. Buzz). C'est ce que tu as décrit.
- **(b) Une instance mutualisée** : un seul déploiement, N locataires. L'isolation
  données est faite (RLS + JWT + scoping), MAIS **SMTP / IA / voix restent des
  creds GLOBAUX** (niveau déploiement), pas par locataire. Pour du vrai (b), il
  faudrait un **coffre de creds par locataire** — non fait.
Recommandation : lancer en **(a)**, garder **(b)** pour plus tard.

### 4. Rate-limit & anti-abus en serverless
Le rate-limit (middleware + envoi) est **en mémoire, par instance**. Sur Vercel
multi-instances, il est approximatif. Le rate-limit d'envoi durable existe déjà
via Supabase ; le rate-limit HTTP du middleware, non. Acceptable au lancement,
à durcir (Redis/Upstash ou table Supabase) si le volume monte.

### 5. Dépendances (CVE)
`next`/`sharp` portent des CVE (libvips) corrigées seulement par Next 16
(changement cassant). Planifier la montée de version + re-tester.

---

### 5. ⚠ RGPD — les polices viennent des serveurs de Google

`app/layout.tsx` charge trois polices depuis `fonts.googleapis.com` /
`fonts.gstatic.com`. **Chaque visiteur transmet son IP aux États-Unis sans
l'avoir consenti** — c'est le motif de condamnations en Europe (LG München,
janvier 2022) et un point de contrôle CNIL connu. Sur une app qui affiche un
DPA et des mentions RGPD, l'incohérence se voit à la première question.

**Ce qui est vérifié** : les 37 écrans se rendent complètement avec Google
Fonts injoignable — la pile de repli de `tailwind.config.ts` est correcte
(`system-ui`, `sans-serif`, `monospace`). L'app ne casse pas sans elles.

**Trois sorties**, et une seule est testable depuis le bac à sable :

| | Effet | Testable ici |
|---|---|---|
| `next/font/google` | téléchargées au BUILD, servies depuis notre domaine. Aspect identique. | non — le proxy bloque `fonts.gstatic.com` au build |
| auto-héberger les `.woff2` | idem, plus de contrôle | non — il faut les télécharger |
| retirer le lien, garder la pile système | zéro tiers. **Change l'aspect.** | oui |

C'est une décision d'aspect autant que de conformité : elle appartient à
Zakaria, elle n'est pas prise, et je ne restyle pas le produit à l'aveugle.

> Effet de bord à connaître avant de chasser un fantôme : dans le bac à sable,
> ces requêtes échouent en `ERR_CONNECTION_RESET` ou `ERR_CERT_AUTHORITY_INVALID`
> selon les jours. Au balayage navigateur, l'erreur s'attribue au bouton
> cliqué au même instant — sept routes et des boutons sans le moindre appel
> réseau. Ça a ressemblé trois fois à un défaut applicatif. Ce n'en est pas un.

---

## 🔧 Reste produit (par valeur décroissante)

- **Sorties structurées généralisées (Outlines)** — amorcé (audit/extract passe
  par la cascade + validation `parseLoose`). À étendre : un validateur de schéma
  réutilisable pour le patch CRM et la classification d'objections.
- **Cache de réponses IA (GPTCache)** — candidat : moins cher + plus rapide sur
  les générations répétées. À cadrer (invalidation par version de doctrine).
- **Compteur tokens/coût (CodeBurn)** — `runAI` renvoie déjà `promptTokens` ;
  reste à l'afficher (État du système / débrief) pour voir ce que l'IA coûte.

### Grosses briques différées (décision produit)
- **Agent voix « coach »** — Alpha qui entraîne au closing / relance / upsell
  (au-delà de l'appel sortant déjà en place). Gros build.
- **Modes mobile Sparring / Closing** — accès complet + modes dédiés terrain.
  Gros build UI.
Ces deux-là sont des projets à part entière : à prioriser quand le SaaS tourne.

---

## L'ordre que je recommande

1. **Prouver** (RLS deux comptes + paiement Stripe test) — débloque la facturation.
2. **Légal** (CGV/DPA/confidentialité) — débloque la vente.
3. **Lancer en modèle (a)** une instance par client.
4. Puis produit : compteur coût → cache IA → agent voix coach → modes mobile.
