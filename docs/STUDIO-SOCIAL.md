# Studio social + génération vidéo

Publication de contenu tech (EAGLEYE CORP) sur **LinkedIn · X (Twitter) · Meta**,
avec vidéo optionnelle. Page `/social`.

## Doctrine : assisté, jamais automatisé
Comme la machine LinkedIn de prospection : l'app **rédige** le post calibré par
plateforme (un sujet → 3 posts), **tu relis, tu publies**. Le partage se fait par
**intent** (X pré-remplit le texte ; LinkedIn/Meta ne pré-remplissent que le
lien → bouton « Copier ») ou copier-coller. **Aucun auto-post.**

### Pourquoi pas d'auto-post API ?
Publier automatiquement sur LinkedIn/Meta exige des **apps OAuth approuvées** +
des **jetons par compte** (revue de plateforme, maintenance). C'est hors
périmètre volontairement — et l'humain garde la main sur ce qui sort. Si un jour
tu veux l'auto-post X (API v2), c'est un ajout ciblé.

## Génération de posts (`/api/social/draft`)
IA via la cascade (`runAI`, avec compression de contexte). **Sans IA**, un
gabarit déterministe prend le relais — la page marche toujours. Chaque post est
borné à la limite de sa plateforme (`lib/social.ts`), X est découpé en fil.

## Vidéo (`/api/video/render`)
Deux voies, optionnelles, pilotées par l'environnement :

| Voie | Env | Ce que c'est |
|---|---|---|
| **json2video** (recommandé) | `JSON2VIDEO_API_KEY` | Rendu par **gabarit JSON**, sans GPU. Offre gratuite. La voie qui marche tout de suite. Tu l'as déjà. |
| **text-to-video** | `VIDEO_GEN_ENDPOINT` (+ `VIDEO_GEN_KEY`) | Connecteur générique vers un endpoint GPU. |

### ⚠ HunyuanVideo — la vérité
HunyuanVideo (Tencent) est un **modèle**, pas une API : il exige un **gros GPU**
(≈ 45–80 Go VRAM). **Il ne tourne pas dans l'app Next**, et je ne peux pas
l'embarquer. Deux options réalistes :
1. Tu l'héberges (serveur GPU / Replicate / fal) derrière un endpoint HTTP qui
   prend `{ prompt }` et rend `{ url }` → mets `VIDEO_GEN_ENDPOINT`, Alpha
   l'appelle.
2. Tu restes sur **json2video** pour le contenu social (largement suffisant pour
   des vidéos de posts) — c'est gratuit et ça marche sans infra.

Le connecteur est prêt pour (1) ; (2) est la voie par défaut.

## Config rapide
```
JSON2VIDEO_API_KEY=…                 # ta clé gratuite
# optionnel, si tu héberges un modèle text-to-video (HunyuanVideo…) :
VIDEO_GEN_ENDPOINT=https://ton-endpoint/generate
VIDEO_GEN_KEY=…
```
L'état s'affiche dans Réglages → État du système.
