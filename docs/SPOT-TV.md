# Spot TV « façon Apple » — 30 s, 16:9 (22/10/2026)

Fichier de visionnage : `public/media/tv/alpha-spot-30s-2026-10-22.mp4`.
Source : `scripts/video/compositions/spot-tv/` · son : `scripts/video/partitions/spot-tv.json` ·
garde : `tests/film-spot-tv.test.ts` · mastering : `scripts/video/mastering-tv.sh`.

**Statut : PRÊT POUR L'AVIS ARPP, PAS DIFFUSÉ.** Rien ne passe à l'antenne sans l'avis
favorable de l'ARPP et une régie qui l'a programmé. Ce document dit ce qui est fait, ce qui
est mesuré, et ce qui reste à faire, par qui.

## Le film, plan par plan

Brief suivi : le « film produit niveau Apple » de la liste skillry (un plan = une idée, le
produit est le héros, retenue, transitions portées par l'objet) et le Mercury relevé sur
whatships (toile chaude, interface réelle qui flotte, texte qui passe du gris à l'encre).
Aucune voix off : musique synthétisée et texte, comme les films de référence.

| Temps | À l'écran | Ce que l'app fait vraiment (le code qui le rend vrai) |
|---|---|---|
| 0–3 s | « Qui appeler ce matin ? » | — |
| 3–9,4 s | « Alpha trie la file. Qui appeler, qui laisser. » — trois restaurants ; l'annonce de liquidation se pose sur l'un, il sort ; celui qui a changé de direction monte en tête, « prioritaire » | `lib/signaux-publics.ts` (`exclusionPublique`, `momentFrais`) · `lib/call-session.ts` (`dansLaFile`, tri) |
| 9,4–14,6 s | « Il écrit le script. Sur ce que vous vendez. » — le script réel pour « un logiciel de caisse », le métier surligné | `lib/script-operateur.ts` (`scriptOperateur`) |
| 14,6–21 s | « Il prépare les messages. Vous les relisez. » — la relecture d'une campagne, envoi bloqué ; un clic sur « Approuver » | `lib/store.ts` (`prepareCampaignDrafts`) · `components/campaigns/campaign-review.tsx` |
| 21–24,7 s | « Les humains closent. Alpha fait tourner la machine. » | `lib/promesse.ts` (`PROMESSE_COURTE`) |
| 24,7–30 s | ALPHA SALES OS · « Gratuit en ligne* » · l'adresse · la mention | `lib/public-catalogue.ts` (`DEUX_FORMES`) · `lib/capacites-cle.ts` |

**Les écrans sont réels, les données fictives**, et c'est écrit à l'écran pendant tout le
passage produit. `capturer.mjs` sert l'app en mode inscrit et fait les vrais gestes (le
bouton « Lire 3 fiches au BODACC », le clic « Approuver ») ; la seule chose remplacée est la
réponse de l'API du BODACC, qui reçoit des annonces inventées. Sociétés « (démo) », adresses
`.example`, téléphones de la plage ARCEP réservée à la fiction, SIREN vérifiés hors de tout
registre.

> ⚠⚠ **Tourner le spot a trouvé un défaut du produit.** La relecture de campagne mettait
> bien de côté le message vers une société liquidée, mais n'affichait jamais pourquoi
> (l'adresse passait devant la raison), et un clic sur « Ignoré » le remettait dans la
> pile à envoyer. Corrigé avant le tournage : `lib/ne-pas-ecrire.ts`, une seule raison,
> affichée, verrouillée, et revérifiée au moment de partir.

## Ce que la télévision exige, et où c'est tenu

| Exigence | Valeur | Tenu par |
|---|---|---|
| Image | 1920×1080, 25 i/s progressif, 30,0 s (750 images) | composition + `ffprobe` (ci-dessous) |
| Zone de sécurité graphique (EBU R95) | tout texte à ≥ 5 % des bords | `tests/film-spot-tv.test.ts` |
| Taille des mentions (ARPP, fiche « Lisibilité des mentions », 2025) | minuscule à tête plate ≥ 2 % de la hauteur = 22 px réels en HD | le test lit la hauteur d'x DANS la police : Inter Tight 500 à 42 px = 22,9 px |
| Durée d'exposition des mentions | assez pour tout lire ; jamais deux jeux de mentions à la fois | le test (0,3 s par mot, mention présente jusqu'à la dernière image) |
| Son | −23 LUFS intégrés, crête vraie ≤ −1 dBTP (délibération CSA du 19/07/2011, EBU R128) | `mastering-tv.sh`, qui relit ce qu'il a écrit |
| Langue | texte à l'écran en français (loi n° 94-665) | composition (`lang="fr"`, aucun mot étranger affiché) |

**Mesures du rendu livré** : voir « Mesuré » plus bas.

## Les deux fichiers

```
bash scripts/video/mastering-tv.sh <rendu.mp4> <dossier> alpha-spot-30s-2026-10-22
```

- `alpha-spot-30s-2026-10-22.mp4` — visionnage (H.264 + AAC 48 kHz). C'est celui du dépôt,
  celui qu'on envoie à l'ARPP pour avis et qu'on montre.
- `alpha-spot-30s-2026-10-22-prores.mov` — master de livraison : ProRes 422 HQ 10 bits,
  PCM 24 bits 48 kHz, BT.709. **Pas dans le dépôt** (plusieurs centaines de Mo) : il se
  régénère par la commande ci-dessus, depuis le rendu.
  > ⚠ Il est fabriqué depuis le rendu H.264 haute qualité d'HyperFrames, pas depuis une
  > suite d'images sans perte. Pour une source sans aucune compression intermédiaire :
  > `hyperframes render --fps 25 --format png-sequence`, puis encoder le ProRes depuis les
  > images. Sur ce film (aplats, interface), la différence ne se voit pas ; elle se dit.

## Ce qui reste, et à qui

1. **L'avis ARPP avant diffusion** — obligatoire pour toute publicité télévisée ; les
   régies ne programment pas sans lui. Il se demande avec le fichier de visionnage. Il
   jugera notamment « Gratuit en ligne* » et sa mention : elle dit que l'IA et les emails
   passent par les comptes du client, ce qui est vrai et vérifié par le test.
2. **La régie et son format** — chaque régie (et la plateforme de livraison qu'elle
   impose) a sa fiche technique : conteneur (MXF XDCAM HD 50 ou ProRes), balayage
   (1080i25 / PsF — notre 25p s'y livre tel quel), amorce, claquette, code d'identification
   du film. On la lit, puis on adapte la dernière étape ; on ne la devine pas.
3. **La date de diffusion** — « Gratuit en ligne » doit rester vrai le jour où ça passe.
   Si l'offre gratuite change, le spot ment ; le test relie la mention au contrôle d'accès
   (`cheminOuvertParCle`), mais il ne voit pas une décision commerciale prise ailleurs.

## Mesuré

Relevé le 22/10/2026 sur les fichiers ÉCRITS (pas sur les réglages demandés) :

| | Visionnage (`.mp4`, dans le dépôt) | Master (`-prores.mov`, régénéré) |
|---|---|---|
| Image | H.264, 1920×1080, 25 i/s, 750 images | ProRes 422 HQ (`apch`), 10 bits 4:2:2, BT.709, 750 images |
| Son | AAC 48 kHz stéréo | PCM 24 bits 48 kHz stéréo, 30,000 s = l'image |
| Intensité | −22,8 LUFS intégrés, crête vraie −5,7 dBTP | −22,8 LUFS intégrés, crête vraie −5,7 dBTP |
| Poids | 5,4 Mo | 461 Mo |

- **Hauteur d'x de la mention légale, mesurée sur l'image décodée : 23 px** (calcul depuis
  la police : 22,9 px ; seuil ARPP : 22 px).
- Deux défauts du premier master, trouvés par la relecture et corrigés dans le script : le
  son dépassait l'image de 16 ms (rembourrage AAC), et l'étiquette BT.709 n'était pas écrite
  dans le conteneur.
- Non mesuré ici, et à ne pas prétendre : le rendu sur un vrai téléviseur, la conformité au
  contrôle technique d'une régie, l'avis de l'ARPP.
