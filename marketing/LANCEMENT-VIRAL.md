# Lancement viral — ALPHA SALES OS

Cadré sur la mécanique des comptes vus en veille (syntaix.ai, coderss_world,
futurewalt.ai, nick_saraev) : **carrousels value-bomb + hook choc + preuve +
CTA « commente X »**, énergie Cluely. Adapté à NOTRE ICP et NOTRE marque.

**ICP :** commerciaux terrain & petites forces de vente (resto, artisan, B2B
local), puis agences outbound. **Géo :** Lyon → France → worldwide (versions
FR puis EN).

---

## Le parti pris de marque (l'innovation, pas le clone)

Ces comptes sont tous en **néon vert sur noir**. Si on copie, on disparaît dans
la masse. On garde leur **FORMAT** (hooks gras, avant/après, preuve chiffrée,
CTA commentaire) mais **notre palette EAGLEYE** :

- Fond **encre `#0E0E0D`**, texte **papier `#F4F2ED`**, accent **vermillon
  `#D2402F` / `#E5564E`**.
- Titres **Bricolage Grotesque** (extra-bold, énormes), mono **JetBrains Mono**
  pour les stats, corps **Inter Tight**.
- Signature : l'**aigle** EAGLEYE + `ALPHA SALES OS®` + `Eagleye Corp — Lyon`.

Résultat : reconnaissable en 0,3 s, impossible à confondre avec un compte « AI
tools » générique. Le vermillon sur encre, c'est NOTRE vert néon.

---

## Le hook (angle Cluely — provocation honnête)

Cluely marche parce qu'il **casse un tabou** puis **tient sa promesse**. Nos
angles, provocateurs mais vrais (aucune fausse allégation) :

1. **« Ton CRM est un cimetière de deals. »** → Alpha : la décision EST le produit.
2. **« Arrête de remplir des cases. Commence à closer. »** → tout est terrain-first.
3. **« Le commercial terrain n'a pas besoin d'un logiciel. Il a besoin d'une
   arme. »** → OS de combat, pas tableur.
4. **« Le Buzz de Jack Dorsey pour la vente. Ton serveur, tes agents, tes
   données. »** → surfe sur une tendance déjà validée (cf. docs/VEILLE-OUTILS.md).

CTA récurrent (mécanique d'engagement) : **« Commente ALPHA et je t'envoie l'accès. »**

---

## Format A — La vidéo héros (30–45 s, 9:16)

Structure Cluely : **hook 3 s → tension → révélation → preuve → CTA.**

| # | Plan (2–4 s) | Voix / texte à l'écran | Prompt vidéo (artflo/Higgsfield) |
|---|---|---|---|
| 1 | Commercial épuisé, 22 h, écran de tableur qui brille | « Il est 22 h. Tu remplis encore ton CRM. » | *Cinematic close-up, exhausted salesperson at night lit by a laptop, spreadsheet glow, moody, 9:16* |
| 2 | Gros titre vermillon sur encre | « TON CRM EST UN CIMETIÈRE DE DEALS. » | *Bold typographic slate, deep ink background, vermillion oversized text, film grain* |
| 3 | Main qui pose le téléphone, l'app ALPHA s'ouvre (aigle) | « ALPHA SALES OS. La décision EST le produit. » | *Hand holding phone, sleek dark sales app opening, eagle logo, premium UI, 9:16* |
| 4 | Split : avant (chaos) / après (pipeline net) | « Terrain-first. Zéro deal perdu. » | *Split-screen before/after, messy notes vs clean pipeline board, vermillion accents* |
| 5 | Chiffres qui montent (RDV, closing) | « +RDV. +Closing. Sans t'asseoir. » | *Animated stat counters, mono font, dark UI, energetic* |
| 6 | Aigle plein écran + CTA | « Commente ALPHA. » | *Eagle emblem on ink, vermillion glow, end card* |

**Voix off :** Fish Audio (voix clonée déjà en place, `voice/agent.py`) ou une
voix FR grave et posée. Musique : trap/cinématique sous licence.

---

## Format B — Le carrousel « value-bomb » (10 slides)

Reprend le squelette « REPO #N » → chez nous **« RÉFLEXE #N du closer »** ou
**« ERREUR #N qui te coûte des ventes »**. Une idée par slide, une stat, un
visuel avant/après. Slide 1 = hook, slide 10 = CTA + aigle.

Exemples de séries prêtes à décliner :
- **« 7 erreurs qui tuent tes ventes terrain »** (obstacle vs objection, démo
  avant prix, relance J+2…). Chaque slide = une doctrine d'Alpha.
- **« Ce qu'un CRM ne te dira jamais »** (les 3 croyances, l'oignon du blâme…).
- **« J'ai remplacé mon CRM par ça »** (captures réelles de l'app, façon
  ugc-saas).

Gabarit : encre `#0E0E0D`, titre Bricolage extra-bold papier, mot-clé en
vermillon, stat en mono, footer `ALPHA SALES OS® · Eagleye Corp — Lyon`.

---

## Production — comment on tourne SANS budget

**Higgsfield est connecté mais à 0 crédit (plan free).** Deux chemins :

### Chemin gratuit (recommandé pour tester vite)
Les sites vus en veille rendent la génération gratuite :
- **artflo.ai/workspace** — Kling 2.6 / Sora 2 / Seedance / PixVerse **gratuits** :
  colle les prompts du tableau ci-dessus, un plan à la fois, 9:16.
- **yupp.ai** — Claude/GPT/Gemini gratuits pour itérer les scripts/hooks/légendes.
- Montage : CapCut (gratuit) — enchaîne les 6 plans, sous-titres gras vermillon,
  musique, CTA final. 30–45 s.
- Visuels carrousel / logo : **le workflow `brandkit`** de Higgsfield (voir plus
  bas) ou Canva avec la palette EAGLEYE.

### Chemin Higgsfield (dès que tu ajoutes des crédits)
Je peux tout générer ici en une passe. Les workflows qui matchent :
- **`ugc-saas-flow`** — pub UGC à partir de l'app (captures réelles à l'écran,
  créateur qui parle) : idéal « J'ai remplacé mon CRM par ça ».
- **`brandkit`** — logo aigle décliné, kit visuel, gabarits carrousel, bannières.
- **`youtube-thumbnail-generator`** — vignettes/covers percutantes.
Dis-moi « les crédits sont là » et je lance la génération + l'attente + le rendu.

---

## Calendrier de lancement (2 semaines)

| Jour | Contenu | Plateforme |
|---|---|---|
| J-7 → J-1 | 3 carrousels « erreurs qui coûtent des ventes » (teasing) | IG / LinkedIn / TikTok |
| J0 | **Vidéo héros** + post « on lance ALPHA SALES OS » | tous |
| J+1 → J+7 | 1 carrousel/jour (doctrine) + 1 UGC « dans l'app » | IG / TikTok |
| J+3 | Angle **« le Buzz de la vente »** (tendance one-person business) | LinkedIn / X |
| continu | CTA « commente ALPHA » → DM automatisé → `/compte` (essai) | — |

**Séquence FR d'abord (Lyon + France), puis versions EN pour le worldwide** —
mêmes gabarits, script traduit (yupp.ai).

---

## À brancher sur le produit

- Le CTA « commente ALPHA » renvoie vers **la page publique** (site) → bouton
  **S'abonner** (Stripe, déjà en place, `docs/FACTURATION.md`).
- Les captures « dans l'app » = écrans réels d'ALPHA (pipeline, closer, audits) —
  authenticité > mockup.
- Chaque nouveau client crée son compte et **branche ses creds** (Supabase, SMTP,
  IA) : modèle one-person business, aligné Buzz.
