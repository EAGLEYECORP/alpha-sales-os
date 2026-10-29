---
name: alpha-motion
description: >-
  À charger dès qu'une session fabrique une VIDÉO pour Alpha Sales OS / EAGLEYE :
  post LinkedIn vidéo, pub, film de lancement, motion design, démo animée, ou
  quand on parle de HyperFrames, /brag, Remotion, whatships. Porte l'outil
  (HyperFrames, installé hors du produit), les lois de mouvement tirées des
  meilleures références (HyperFrames, /brag, Apple, Emil Kowalski) et les
  interdits propres à Alpha — une vidéo se PUBLIE, elle engage la marque.
---

# ALPHA MOTION — des vidéos qui montrent le produit, sans tricher

Établi le 20/10/2026 après une recherche sur quatre sources. Chacune est une
source de **praticien** (voir `lib/references.ts`) : aucune de nos vidéos n'a
encore été reliée à une inscription ou à une vente. Ces règles disent ce qui
sépare un film de lancement d'un diaporama fait par agent ; elles ne disent pas
ce qui fait vendre — ça, seule une mesure le dira.

| Source | Ce qu'on en garde |
|---|---|
| **HyperFrames** (HeyGen, Apache-2.0) — `skills/product-launch-video/references/motion-language.md` | l'outil, et la doctrine de mouvement (§ 3) |
| **/brag** (latent-spaces, MIT) — `skills/brag-slim/SKILL.md`, `references/step-2-plan.md` | les lois de création (§ 2) |
| **Apple**, *Designing Fluid Interfaces* (WWDC 2018) | ressort amorti critique, cohérence spatiale, typographie |
| **Emil Kowalski** (animations.dev) | courbes, « jamais depuis scale(0) », revoir au ralenti |

---

## 1. L'outil — HyperFrames, en local, hors du produit

```bash
bash scripts/video/hyperframes-bac-a-sable.sh          # une fois par conteneur
source "${ALPHA_VIDEO_OUTILS:-$HOME/.cache/alpha-video}/env.sh"
npx hyperframes init ma-video --example blank --non-interactive --resolution portrait
gsap_local ma-video                                      # le CDN de GSAP est refusé ici
cd ma-video && npx hyperframes lint && npx hyperframes render
```

- Une composition = du HTML avec `data-start` / `data-duration` / `data-track-index`,
  une timeline GSAP **en pause** enregistrée dans `window.__timelines`. Le
  rendu cherche chaque image dans Chromium headless et encode avec ffmpeg.
- **Prouvé ici le 20/10/2026** : deux rendus d'essai, puis une vidéo complète
  (`scripts/video/compositions/orchestration/` — 23,6 s, 708 images, son
  compris, **rendue en 60 s** contre une dizaine de minutes pour l'ancien
  pipeline). `npx hyperframes check` a refusé ce que l'œil aurait laissé
  passer : 12 textes sous le contraste WCAG AA, deux tweens qui se
  chevauchaient sur le curseur. On ne rend pas sans un `check` à 0 erreur.
- Les 6 avertissements « sous-composition » sur un fichier unique sont une
  préférence d'organisation, pas un défaut d'image : un fichier par vidéo
  courte reste plus simple à relire.
- **Rien dans `package.json`.** C'est un outil d'atelier ; dans le dépôt, il
  monterait dans l'image Docker livrée au client.
- **Télémétrie coupée** par le script — rien de ce qui se fabrique ici n'a à sortir.
- Le **connecteur claude.ai « HyperFrames by HeyGen »** existe (outils
  `compose`, `render_video`). **Inutile** : le rendu local est gratuit et
  privé ; le connecteur rend sur leurs serveurs.
- `scripts/pub/rendre.mjs` (canevas) reste la voie des deux scènes qu'il porte
  déjà. Le pipeline DOM des vidéos LinkedIn d'octobre vivait dans un
  scratchpad, il n'est pas versionné et ne doit pas renaître à côté : une
  troisième mécanique de rendu serait la copie qu'on ne relit pas.
- **Le son** : `node scripts/video/bande-son.mjs partition.json sortie.wav` —
  synthétisé, aucun échantillon tiers, **déterministe** (testé). Exemple :
  `scripts/video/partitions/deux-formes.json`. Le WAV se monte dans la
  composition comme piste audio.

## 2. Les lois de création (de /brag, adaptées)

1. **Montre la chose.** L'app réelle qui fait son travail bat une page qui le
   décrit. Les vrais écrans se capturent avec `scripts/pub/capturer.mjs` sur le
   **jeu de démonstration** (jamais un pipe réel). Des cartes « illustratives »
   ne sont permises que quand il n'y a pas de parcours à montrer — une offre,
   un prix — et alors **une seule** sert de cadre, jamais de remplissage.
2. **L'accroche décide de tout** : les 2 premières secondes. On l'écrit en premier.
3. **Court** : 15–25 s, 18–22 idéal. Forme de départ : accroche (2–3 s) →
   révélation (2–4 s) → 2–3 temps forts → chute (2–4 s).
4. **Lisible** : toute ligne à lire reste **posée** (entrée finie, sortie pas
   commencée) au moins **0,3 s par mot**, plancher 1,2 s ; une étiquette de 1–3
   mots, 0,8 s. Le rythme vient des coupes et du mouvement, **jamais** d'un
   texte retiré trop tôt.
   > ⚠ Mesuré sur notre propre vidéo du 20/10 : « L'IA et l'email : avec vos
   > propres comptes » (8 mots) restait posée **0,55 s** pour 2,4 s requises.
   > Corrigé avant publication en allongeant la scène, pas en raccourcissant
   > la phrase.
5. **Spécifique** : nos mots, nos écrans. Interdit : « optimisez votre
   workflow » et tout ce qui irait sur n'importe quel produit.
6. **Image d'affiche** : l'image la plus forte, **posée**, remplace l'image 0
   (sans changer la durée) — LinkedIn en fait la vignette. Un titre à moitié
   entré en vignette, c'est un post qu'on ne lance pas.
7. **Chaque image est publiable** : une image figée au hasard doit pouvoir
   être partagée seule.

## 3. La doctrine de mouvement (d'HyperFrames — « porteuse »)

Les trois défauts qui font lire « diaporama fait par un agent », et les trois
étaient dans nos vidéos d'octobre :

1. **Amorti plutôt que rebond.** Entrées en longue décélération (`power3.out`,
   `expo.out` pour une arrivée rapide) ou ressort **amorti critique** (ζ = 1 —
   Apple, « damping 1.0 »). **Aucun dépassement** par défaut ; le rebond est
   réservé à ce qu'un geste a lancé. ⚠ Notre ancien `ressort()` dépassait sa
   cible : retiré le 20/10.
2. **Révéler au fil du texte, dans la seconde moitié de la scène.** Rien n'est
   versé à l'écran dans le premier quart puis figé. Chaque élément arrive
   quand on en parle, en décalé (30–80 ms entre éléments d'une même salve).
3. **Pas de respiration paresseuse, pas de poussée lente en fin de scène.**
   Une carte qui oscille en boucle se lit « écran de veille » ; un zoom lent
   pendant qu'on lit gêne l'œil. **Pas de mouvement plutôt qu'un mauvais
   mouvement.** Seule vie permise pendant une tenue : les internes d'un sujet
   (un voyant qui clignote sur un serveur), ou un très léger tremblé.
4. **Coupes à vitesse égale** : on coupe au pic de vitesse, même direction des
   deux côtés. Un fondu entre deux mises en page chargées fait une double
   exposition boueuse : on sort l'ancien, PUIS on entre le nouveau (ou on passe
   par le fond).

**Le noyau « seek-safe » (règles dures)** : chaque image est une fonction pure
du temps · aucun `Math.random` ni `Date.now` (le grain se tire d'une graine) ·
entrées en `fromTo` explicite · aucune `transition` CSS ni `@keyframes` pour le
mouvement · attendre les polices avant la première capture.

**Typographie (Apple)** : grand titre en approche négative (−0,03 em) et
interligne serré (~1,04) ; corps proche de 0. Jamais une entrée depuis
`scale(0)` (Emil) : partir de 0,9 avec l'opacité.

**Revoir au ralenti** : planche d'images clés **et** images en pleine
transition, avant le rendu complet. Les défauts de lecture ne se voient
qu'au rendu.

## 4. Ce qu'une vidéo Alpha n'a pas le droit de dire

Déjà dans `CLAUDE.md` ; rappelé ici parce qu'une vidéo se publie et ne se
corrige plus.

- **« Scène illustrative »** à l'écran ET dans le texte du post. Données
  fictives seulement : préfixe `demo-`, domaines RFC 2606, numéros des plages
  ARCEP de fiction. Aucun vrai prospect, aucun vrai nom.
- **Aucune preuve sociale, aucun chiffre de performance** (« +RDV », « x3 »,
  « zéro deal perdu »), aucun superlatif, aucune affiliation, jamais « le X de
  Y » (`lib/promesse.ts`), jamais « je travaille avec… » (→ « je m'adresse
  aux… »), jamais « vous ratez des appels » à la maîtrise d'ouvrage.
- **Aucun prix dans le texte du post** : il se recopie hors contexte. Il est
  sur la vitrine.
- **Les noms des agents viennent de `lib/agents-alpha.ts`, TOUJOURS EN
  CAPITALES** : ALPHA SCOUT, ALPHA VOICE, ALPHA CAMPAGNES, AGENT ALPHA,
  ALPHA LIVE, ALPHA ASSIST (l'IA du client branchée par MCP — « Votre IA »
  dans l'ancienne vidéo d'orchestration), ALPHA CERVEAU, ALPHA CEO. Recopiés à la lettre, avec ce que
  chacun n'a pas le droit de faire. ⚠ Le post du 20/10 les a écrits en
  minuscules (« Alpha Voice ») : la règle est née juste après.
- **Le lien pointe vers `/vitrine`** : la racine du domaine ouvre le tableau
  de bord de l'app, pas l'offre (vérifié le 20/10).
- **Palette réelle** (`app/globals.css`) : encre `#0A0807`, papier `#F3EEE4`,
  gris `#A79F92`, bronze `#E8C98A`. Titres Bricolage Grotesque, corps Inter
  Tight, chiffres JetBrains Mono.
  > ⚠ `marketing/LANCEMENT-VIRAL.md` est ANTÉRIEUR à ces règles : sa palette
  > vermillon n'est pas celle du produit, et son accroche n°4 (« le X de
  > Y »), son plan 5 (« +RDV. +Closing. ») et « Zéro deal perdu » sont
  > interdits. Son format (accroche → tension → révélation) reste bon.

## 5. Publier sur LinkedIn (chemin éprouvé)

1. MP4 dans `public/media/linkedin/<sujet>-<date>.mp4`, tests + types verts, push.
2. Attendre Vercel, vérifier l'URL publique (`curl -I` via Composio : le
   conteneur ne joint pas le domaine) — 200, `video/mp4`, le bon poids.
3. `LINKEDIN_UPLOAD_VIDEO` (URL) → URN. Ne publie rien.
4. Texte en Little Text Format : échapper `\ | { } @ [ ] ( ) < > # * _ ~` ;
   hashtags `{hashtag|\#|mot}`.
5. `LINKEDIN_CREATE_VIDEO_POST` **après son feu vert seulement**. Un post par
   jour au plus (le second mange la portée du premier) ; 8 h 30, heure de Paris.
   Programmer = `send_later` avec le texte ENTIER dans le message : le
   conteneur peut être recyclé avant.

### Ce que le film « le cycle » (21/10/2026) a appris — `tests/film-cycle.test.ts`

`scripts/video/compositions/cycle/` · `scripts/video/partitions/cycle.json` ·
`marketing/post-cycle-agents-2026-10-21.md`. Sans exemple, huit agents dans l'ordre
du cycle, les cinq moments qui reviennent à l'humain, les quatre surfaces qui le
préviennent. Il a coûté trois corrections que la compétence aurait dû empêcher :

- **⚠⚠ LE PLANCHER DE LECTURE SE MESURE, il ne se coche pas.** Le test JOUE le
  script de la composition avec un GSAP simulé (aucune dépendance) et compte,
  pour chaque texte, le temps où il est entré ET pas encore sorti. À la première
  exécution : **cinq textes** sous leur plancher sur une composition que je
  croyais conforme (la dernière carte : 1,5 s posée pour 2,4 s requises ; la
  notification : 2,5 s pour 3,3 s). On allonge la tenue ou on avance l'entrée,
  jamais l'inverse. Le plancher vaut pour la PHRASE ENTIÈRE d'un bloc (libellé +
  légende), pas pour ses lignes une à une.
- **⚠⚠ UN UNIVERSEL SE VÉRIFIE DANS LE CODE.** « Chaque action est consignée »
  était écrit, tourné, testé… et faux : le journal est `journalRecent`, les 12
  derniers événements du CRM. Même famille : « sur chaque écran » (la bande n'est
  pas sur `/login` ni `/overlay`). Les formes « chaque / tous les / toutes les X
  est/sont … » et « sur chaque écran » sont désormais refusées par le garde.
- **Le post et le film passent par la MÊME liste d'interdits** (`INTERDITS`), et
  la phrase de disponibilité du post est dérivée de `AGENTS_ALPHA` : si
  l'ombrelle change, le texte public cesse d'être vrai et le test tombe.
- **Piège d'outil — la version épinglée.** `npx hyperframes` lancé HORS de
  l'installation (un `env.sh` sans `node_modules/.bin` dans le `PATH`) télécharge
  la dernière version (0.8.183) : son filtre audio (`adelay … all=1`) est refusé
  par le ffmpeg 4.x de l'atelier et le rendu s'arrête (`audio_processing_failed`).
  Le script `hyperframes-bac-a-sable.sh` met bien `.bin` dans le `PATH` : n'en
  improvise pas un autre. Vérifier `hyperframes --version` = 0.8.181 avant de rendre.
- **Piège d'affiche — une seule image.** `overlay=…:enable='lt(t,0.034)'` attrape
  aussi l'image 1 (à 0,0333 s) : l'affiche restait deux images. Seuil : `0.02`.
  Se prouve par PSNR : image 0 ≈ affiche (> 40 dB), images 1 et 2 ≪ (≈ 5 dB).
- `check` signale parfois un contraste sur un texte **à 0,05 s du début de son
  fondu** (échantillon à opacité ≈ 0). Recalculer le rapport sur les couleurs
  posées avant de conclure à un défaut — dans les deux sens.

### Ce que le film « Tu vends quoi ? » (22/10/2026) a appris — `tests/film-tu-vends-quoi.test.ts`

`scripts/video/compositions/tu-vends-quoi/` (+ `capturer.mjs`, `profils.json`) ·
`scripts/video/partitions/tu-vends-quoi.json` · `marketing/post-tu-vends-quoi-2026-10-22.md`.
Le motif des meilleurs films faits par agent (liste « awesome-opus5-5-videos ») : le
VRAI produit, frappe, curseur, mouvement de caméra. On l'a fait sans rien dessiner.

- **⚠⚠ FILMER LE PRODUIT, C'EST LE TESTER.** Deux défauts du produit sont tombés en
  préparant les captures, aucun test ne les voyait : le script écrivait « parler de des
  cuisines » (`lib/script-operateur.ts`), et `/appels` servait NOTRE script à un inscrit
  tant que le serveur n'avait pas répondu (verdict optimiste — `useMaitreProuve`
  désormais). Les deux auraient été dans la vidéo.
- **La frappe est réelle** : une capture du vrai champ PAR LETTRE (`capturer.mjs`), posée
  par `tl.set`. Le test exige `longueur + 1` images, dans l'ordre, avant le script.
- **Chaque citation est recalculée** par le test avec `scriptOperateur` : si le code change
  la phrase, le film tombe au lieu de mentir.
- **Les polices de l'app viennent de Google Fonts**, injoignable ici, et sa CSP
  (`font-src 'self' https://fonts.gstatic.com`) refuse une police en `data:` : en
  capture, elles se servent depuis l'adresse gstatic interceptée. Sinon : police système,
  sans erreur visible.
- **Le piège de version est revenu** : `npx hyperframes` dans le dossier de rendu a pris
  0.8.185. Appeler le binaire (`hyperframes`, dans le `PATH` après `source env.sh`).
- **Le plancher de lecture a mordu au premier passage** (une citation : 1,35 s pour 1,5 s
  requises), calcul fait à la main juste avant. Les outils des tests de film sont
  partagés (`tests/film-outils.ts`) — une seule définition du plancher et des interdits.
- `check` exige **28 px** minimum sur 1 080 : la mention « EXEMPLES ILLUSTRATIFS » est
  justement celle qui doit se lire.

### Ce que le spot TV (22/10/2026) a appris — `tests/film-spot-tv.test.ts` · `docs/SPOT-TV.md`

`scripts/video/compositions/spot-tv/` (+ `capturer.mjs`, `donnees.json`) ·
`scripts/video/partitions/spot-tv.json` · `scripts/video/mastering-tv.sh`.
Le brief suivi : le « film produit niveau Apple » de la liste skillry (un plan = une idée,
le produit est le héros, retenue) et le Mercury de whatships (toile chaude, interface
réelle qui flotte, texte qui passe du gris à l'encre).

- **La télévision a ses règles, et elles se MESURENT** :
  · format 1920×1080, 25 i/s, 30,0 s pile ; tout texte dans la zone de sécurité
    graphique EBU R95 (5 % de chaque bord) ;
  · **mentions ARPP** : la minuscule à tête plate atteint 2 % de la hauteur, soit
    **22 px réels en HD**. « Corps 22 » ne veut rien dire : le test lit la hauteur d'x
    DÉCLARÉE dans le WOFF2 (`metriquesPolice`, Brotli de Node) — Inter Tight 500 à
    42 px donne 22,9 px ; une mention ne reste à l'écran que le temps de la lire, et
    jamais deux jeux de mentions à la fois ;
  · **son à −23 LUFS, crête vraie ≤ −1 dBTP** (EBU R128, délibération CSA du
    19/07/2011) : `mastering-tv.sh` fait deux passes et RELIT ce qu'il a écrit ;
  · texte à l'écran en français (loi n° 94-665). L'avis ARPP avant diffusion et le
    format exact de la régie ne se fabriquent pas ici.
- **⚠⚠ FILMER LE PRODUIT, C'EST LE TESTER — troisième fois.** La relecture de campagne
  cachait la raison d'un message mis de côté (liquidation, refus, démo) et un clic le
  remettait dans la pile à envoyer (`lib/ne-pas-ecrire.ts`, corrigé avant le tournage).
- **On remplace la RÉPONSE DU RÉSEAU, jamais l'app** : l'API du BODACC reçoit des
  annonces fictives, et c'est le vrai bouton, le vrai tri, le vrai clic qui produisent
  les écrans. Le test rejoue ces annonces dans `lireSignaux` et `buildCallSession`.
- **On retire une fiche des DONNÉES, pas une ligne du MONTAGE** : la file filmée est la
  file entière. Masquer une ligne au montage aurait montré un état que l'app n'a jamais eu.
- **L'image 0 n'est PAS une affiche à la télévision** : le master commence sur la toile.
  L'affiche ne sert qu'aux versions web.
  ⚠⚠ **Et le master TV ne se publie JAMAIS tel quel sur le web** : publié sur LinkedIn le
  22/10, sa vignette est sortie VIDE (aplat crème, l'image 0). Deux fichiers, deux usages :
  `public/media/tv/` pour la régie, `public/media/linkedin/` (affiche en tête) pour le web.
  ⚠⚠ **LINKEDIN NE PREND PAS L'IMAGE 0 : il prend l'IMAGE 3 (0,12 s à 25 i/s)** — mesuré le
  22/10 avec une vidéo-sonde numérotée image par image, téléversée sans être publiée. La
  première version web (affiche sur l'image 0 seule) est ressortie aussi vide que le master.
  L'affiche couvre donc les premières images JUSQU'À ce que l'animation la rejoigne
  (images 0–23 sur le spot : PSNR > 64 dB dès l'image 24, raccord invisible). « Image 0 =
  affiche » (§ 2 et § 5) ne suffit pas : vérifier la vignette RENVOYÉE par LinkedIn
  (`LINKEDIN_GET_VIDEOS` → `thumbnail`) AVANT de publier, jamais après.

### Ce que le film « ALPHA vend ALPHA » (29/10/2026) a appris — `tests/film-alpha-vend-alpha.test.ts`

`scripts/video/compositions/alpha-vend-alpha/` (+ `capturer.mjs`, `donnees.json`) ·
`scripts/video/partitions/alpha-vend-alpha.json` · `marketing/post-alpha-vend-alpha-2026-10-29.md`.
Le compte MAÎTRE donne notre offre au vrai pilote automatique ; le film montre le cycle de A à Z.

- **⚠⚠ FILMER LE PRODUIT, C'EST LE TESTER — quatrième fois, et la plus rentable : CINQ défauts**
  de ce qui part chez un prospect, aucun vu par un test. Le maître écrivait sur notre escalier ;
  chaque email portait deux signatures et trois « STOP » (le rendu ajoutait ce que le corps
  portait déjà) ; le pied affirmait une clientèle ; l'email des créneaux montrait des puces sous
  « Répondez 1, 2 ou 3 » ; le bandeau forçait l'email à 600 px sur téléphone. Plus le journal
  en « créneau(x) proposé(s) ». **On montre ce qui ARRIVE** : l'email rendu par le serveur
  (`/api/email/preview`, même habillage que `/api/send`) sur le corps exact envoyé.
- **Les surlignages se posent sur des positions MESURÉES** (`reperes`, `caps/inventaire.json`),
  et la caméra de frappe suit la position RÉELLE du curseur, lettre par lettre. Un repère à l'œil
  glisse sur la ligne voisine au premier changement de texte.
- **Pièges d'atelier** : le cookie du mot de passe est `Secure` — Chromium l'envoie à 127.0.0.1,
  le client HTTP de Playwright non (401) : lire le serveur par une PAGE. Un `setContent` sur une
  page de l'app hérite de sa CSP (logo refusé) : rendre l'email sur une page vierge. Le conteneur
  est en UTC : `timezoneId: "Europe/Paris"`, sinon un rendez-vous à 9 h s'affiche 08:00. Une règle
  `.ecran img` (plus spécifique) écrasait la largeur des images de frappe : la caméra glissait sur
  une image non agrandie — vu à la planche, invisible au `check`.
- **Un email à 600 px de large se lit mal dans un fil mobile (24 px dans le film)** : capturé à
  480 px, 32 px. Zoomer n'était pas la solution — ses lignes occupent toute la largeur, un zoom
  les coupe. Panoramique vers la question quand la hauteur déborde.
- **37,5 s, au-delà de la règle des 25 s, et c'est assumé** : la demande était le cycle ENTIER,
  étape par étape. Le test borne à 38 s et dit pourquoi.

## 6. Avant de dire « c'est prêt »

- [ ] L'accroche se comprend en 2 s, sans le son.
- [ ] On voit le produit réel, ou il n'y a pas de parcours à montrer.
- [ ] Chaque ligne tient son plancher de lecture (compter les mots).
- [ ] Aucun dépassement, aucune oscillation en boucle, aucune poussée finale.
- [ ] Image 0 = affiche posée.
- [ ] « Scène illustrative » à l'écran et dans le post ; aucune donnée réelle.
- [ ] Texte du post passé au crible du § 4.
- [ ] Planche d'images regardée AVANT le rendu complet.

## 7. Où regarder pour s'entraîner l'œil

- **whatships.com** — 2 159 films de lancement tirés de X, rubriques Motion et
  Design, annuaire des studios et des outils. ⚠ Injoignable depuis ce
  conteneur (DNS) : on étudie ce que Zakaria y choisit et envoie.
- **Les blueprints d'HyperFrames** (`skills/hyperframes-animation/blueprints/`) :
  titre, compteur, curseur qui clique, zoom arrière sur l'espace de travail —
  des formes éprouvées à instancier plutôt qu'à réinventer.
- **21st.dev** — registre de composants React animés (shadcn). C'est de l'UI
  PRODUIT, pas de la vidéo ; ses composants tirent `motion`, une dépendance :
  refus par défaut (CLAUDE.md), à justifier au cas par cas.
