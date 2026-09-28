# Publicité motion design — les écrans de l'app (9:16)

> Script arrêté le 11/09/2026. Format vertical, **26 s**, lisible sans le son.
> Deuxième pièce de la série ; la première (`docs/PUB-MOTION-MOA.md`) est
> typographique et ne montre pas le produit. Celle-ci ne montre que lui.

---

## Ce que cette vidéo affirme, et comment on le tient

| Affirmation | Ce qui la rend vraie |
|---|---|
| « captures réelles » | `scripts/pub/capturer.mjs` construit l'app, la sert, ouvre les vraies routes et photographie ce qu'elles rendent. La recette est dans le dépôt : elle se rejoue. |
| « pas une maquette » | Aucun écran n'est dessiné. Aucun pixel n'est retouché. |
| « données de démonstration » | **Dit à l'écran, plan 1.** Les fiches viennent de `lib/seed.ts` : identifiant `demo-`, numéros en plage ARCEP fiction (2018-0881), domaines RFC 2606, « (démo) » dans le nom **et dans tout texte rattaché à la fiche**. |

> ⚠ **La ligne « données de démonstration » n'est pas une précaution
> juridique, c'est l'argument.** Les captures portent des montants
> (« en jeu », « pondéré »). Sans cette ligne ils se lisent comme des
> résultats, et **il n'y en a aucun** — `JUILLET_REEL.gagnes` vaut 0. La dire
> coûte une ligne de 30 px et rend crédible tout ce qui suit.

> ⚠⚠ **Ce chantier a trouvé une fuite avant de filmer.** Le marqueur « (démo) »
> vivait dans `Prospect.company`, que l'écran du matin n'affiche jamais ; les
> titres de rendez-vous et les messages d'activité — eux affichés — le
> portaient pas. Dont « SIGNÉ ✓ \<fiche\> ». Sur une image sortie de son
> contexte, c'était un client signé inventé. Corrigé, et le garde est devenu
> STRUCTUREL (`tests/seed-moa.test.ts`) : une fiche se reconnaît à son
> identifiant, jamais à son nom.

---

## Les écrans retenus, et ceux qui sont écartés

Quatre écrans filmés : **Aujourd'hui · la fiche · Alpha Voice · le Cerveau.**
Ils montrent le MÉCANISME — ce qu'on fait, ce qui s'est dit, ce que l'agent a
le droit de dire, où tout est rangé.

Écartés **après les avoir capturés et regardés**, pas sur intuition :

| Écran | Pourquoi il ne passe pas |
|---|---|
| `/moniteur` | affiche « Autopilote · **Éteint** » — l'ordonnanceur n'est pas configuré sur la machine de capture. Vrai, et désastreux en publicité. |
| `/appels` | affiche « **RDV 0** ». |
| `/closer`, `/pipeline` | mettent un **montant** en tête d'écran, là où l'œil se pose en premier. |

> ⚠ `/pipeline` porte aussi des filtres secteur hérités du marché d'AVANT
> (restauration, ambulances…). `CLAUDE.md` interdit de lire la campagne en
> cours dans la portée de l'outil, donc ce n'est pas forcément un reliquat —
> mais ça n'a rien à faire dans une pub maîtrise d'ouvrage.

---

## Le script

**Plan 1 — 0 → 3,4 s · Ce que la vidéo affirme**
> Voilà l'écran.
> **Pas une maquette.**
>
> captures réelles · données de démonstration

**Plan 2 — 3,4 → 8,6 s · L'écran du matin**
> CALCULÉ, PAS DÉCLARÉ
> Ce que tu fais
> aujourd'hui.

**Plan 3 — 8,6 → 13,4 s · La mémoire**
> LA FICHE
> Ce qui s'est dit.
> Et le pas suivant.

**Plan 4 — 13,4 → 18,2 s · L'agent se déclare**
> ALPHA VOICE · ART. 50
> L'IA se déclare.
> Dans le code.

*C'est la phrase d'annonce prononcée par le CODE, pas par le modèle — un
modèle peut reformuler une consigne, pas une ligne de code. Le montrer À
L'ÉCRAN vaut mieux que l'affirmer : la capture est la preuve.*

**Plan 5 — 18,2 → 22,4 s · Tout au même endroit**
> LE CERVEAU
> Tout au même
> endroit.

**Plan 6 — 22,4 → 26,0 s · La sortie**
> Un cadrage.
> 20 minutes.
>
> **eagleyecorp.fr**
>
> Lyon · Villeurbanne

---

## Le mouvement

Un seul geste, répété : la capture fait **1,4 hauteur d'écran** et **défile**
dans un cadre qui en montre une. C'est ce défilement qui dit « c'est un écran,
pas une image » — un aplat fixe se lit comme une maquette, c'est-à-dire
exactement ce que le plan 1 jure que ce n'est pas.

Le défilement est adouci aux deux bouts : démarrer et s'arrêter net ressemble à
une coupure de montage, pas à une main.

---

## Comment la refaire

```
npm run build
npx next start -p 3100 &
node scripts/pub/capturer.mjs          # → scripts/pub/caps/*.jpg
node scripts/pub/rendre.mjs scene-app  # → scripts/pub/frames-scene-app/
ffmpeg -y -framerate 30 -i frames-scene-app/%04d.jpg \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart app.mp4
```

> ⚠ Les JPEG **ne sont pas commités** : binaires, régénérables, et ils
> dateraient (le jeu de démonstration porte des dates relatives). `rendre.mjs`
> refuse de rendre s'ils manquent, plutôt que de produire une vidéo à cadres
> vides. Il refuse aussi sans Archivo Black, et sur tout texte qui sort de la
> boîte utile — les trois gardes valent pour les deux scènes, parce qu'il n'y a
> qu'un seul rendu.
