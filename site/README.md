# eagleyecorp.fr — site vitrine ALPHA SALES OS®

Page unique, statique, dans la charte EAGLEYE (Bricolage Grotesque / Inter
Tight / JetBrains Mono, papier & encre, accent vermillon). Vend **ALPHA SALES
OS®** — le système d'exploitation de la vente terrain.

Fichiers :

- `index.html` — la page (CSS et logo en ligne, aucune dépendance sauf les
  polices Google). Thème clair/sombre, bascule mémorisée.
- `eagleye-logo.svg` — le logo aigle, autonome (encre `#0E0E0D`).
- `netlify.toml` — publication du dossier tel quel + en-têtes de sécurité.

## Mettre en ligne sur Netlify — 2 minutes

**Le plus simple (glisser-déposer) :**

1. Va sur [app.netlify.com/drop](https://app.netlify.com/drop).
2. Glisse le dossier `site/` entier dans la page. C'est en ligne.
3. *Site settings → Domain management → Add custom domain* → `eagleyecorp.fr`.
   Suis les instructions DNS (chez ton registrar : un enregistrement `A` /
   `CNAME` vers Netlify, ou délègue les DNS à Netlify).

**Ou par Git (déploiement continu) :**

1. Netlify → *Add new site → Import an existing project* → ce dépôt GitHub.
2. *Base directory* : `site` · *Build command* : (vide) · *Publish directory* :
   `site`.
3. Chaque push redéploie.

## Ce qu'il reste à faire à la main

- Brancher le domaine `eagleyecorp.fr` (DNS).
- *(optionnel)* Ajouter une image `og.png` (1200×630) pour les partages, et la
  référencer dans `index.html` (`og:image`).
- Le bouton « Réserver une démo » ouvre un email vers `contact@eagleyecorp.fr`.
  Remplace-le par ton lien Cal.com quand il est prêt.
