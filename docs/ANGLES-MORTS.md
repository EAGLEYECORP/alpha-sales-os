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

**1 124 tests verts · `tsc --noEmit` propre · build OK · balayage navigateur**
sur serveur réel (production, `next start`), et non en développement.

### Ce que la passe a trouvé : toujours le même défaut

Sept défauts, et **aucun n'est une erreur de logique**. À chaque fois : du code
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
| 7 | Le mur de stockage n'était branché que sur **une des quatre** surfaces d'import | moyenne |
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

### Ce qui n'a PAS pu être vérifié d'ici, et ne doit pas être présumé

Le proxy du bac à sable bloque les services live. **Rien de ce qui suit n'est
prouvé** — ce sont des vérifications à faire côté toi, une fois :

- Supabase réel (RLS à deux comptes), Stripe réel (un paiement test bout-en-bout).
- Telnyx / LiveKit / Fish : aucun appel réel passé depuis ici.
- Le webhook Stripe n'a jamais reçu d'événement authentique signé.

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
