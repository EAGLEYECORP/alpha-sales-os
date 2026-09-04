# eagleyecorp.fr — le site de la SOCIÉTÉ

Page unique, statique, dans la charte EAGLEYE (Bricolage Grotesque / Inter
Tight / JetBrains Mono, papier & encre, accent vermillon).

## ⚠ CE QUE CETTE PAGE VEND, ET CE QU'ELLE NE VEND PAS

Elle présente **EAGLEYE CORP** : ce que la société fait, comment elle
travaille, et ce qu'elle refuse. **Elle ne porte aucun prix produit.**

C'était une deuxième page de vente d'Alpha Sales OS, avec sa propre grille
tarifaire. Deux surfaces qui portent les mêmes prix : l'une des deux finit
périmée, et c'est toujours celle qu'on oublie de rouvrir. Ça a dérivé deux
fois — « Solo 79 €/mois » facturait ce qui était devenu gratuit, et le palier
voix annonçait son abonnement sans ses 990 € d'installation.

| Surface | Son travail |
|---|---|
| **eagleyecorp.fr** (ce dossier) | La société. Cinq chantiers, la méthode, les refus. Aucun prix. |
| **alphasalesos.eagleyecorp.fr** (l'app Next) | Le produit : `/vitrine` présente et chiffre, `/souscrire` encaisse, `/` est le tableau de bord derrière la connexion. |

`tests/offres-publiques.test.ts` refuse tout montant en euros dans
`index.html`, et exige qu'il renvoie vers le produit — retirer les prix sans
donner de porte échangerait une dérive contre une impasse.

Fichiers :

- `index.html` — la page (CSS et logo en ligne, aucune dépendance sauf les
  polices Google). Thème clair/sombre, bascule mémorisée.
- `eagleye-logo.svg` — le logo aigle, autonome (encre `#0E0E0D`).
- `favicon.svg` · `favicon-32.png` · `apple-touch-icon.png` — icônes d'onglet.
- `og.png` — image de partage social (1200×630), aux couleurs de la charte.
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

- Brancher le domaine `eagleyecorp.fr` (DNS) sur Netlify.
- Le bouton « Demander un cadrage » ouvre un email pré-rempli vers
  `contact@eagleyecorp.fr`. Remplace-le par ton lien Cal.com quand il existe —
  la page n'a aucune autre dépendance.
- **Aucun paiement ne se fait ici, et c'est voulu.** Les boutons d'achat vivent
  sur `alphasalesos.eagleyecorp.fr/souscrire`, où se trouvent aussi les prix
  Stripe. Remettre un bouton de paiement ici recréerait la deuxième source.
