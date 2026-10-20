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
