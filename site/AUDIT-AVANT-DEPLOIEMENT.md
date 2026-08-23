# Site statique — état avant `eagleyecorp.fr`

> Audit du dossier `site/`, servi tel quel (Netlify, `publish = "."`, aucun
> build). Ce fichier est le journal de ce qui a été corrigé et de ce qui
> **reste à trancher — par toi, pas par moi**.
>
> Rappel de méthode : `site/` n'a ni build, ni types, ni compilation. Rien n'y
> échoue bruyamment. C'est pourquoi `tests/site-statique.test.ts` existe
> maintenant : il refuse les liens morts, les chiffres non mesurés, les
> gabarits oubliés et les pages légales absentes. Ces défauts-là ne se
> remarquent pas en relisant un diff.

---

## Ce qui reste à trancher — décisions commerciales

### ⚠ 1. Deux modèles économiques sur la même marque

| Surface | Ce qu'elle annonce |
|---|---|
| `site/` (celui-ci) | abonnement **79 € / 149 € par mois** |
| `/vitrine` (l'app Next.js) | **10 000 € HT** + 1 000 €/mois, **cadrage obligatoire** |
| `CLAUDE.md` (doctrine) | 10 000 € VIP **ou** 30 % + frais de setup, cadrage obligatoire |

Ce ne sont pas trois tarifs, ce sont **trois modèles**. Un prospect qui lit
79 €/mois puis entend 10 000 € ne se dit pas « il y a plusieurs offres » : il
se dit qu'on l'a appâté. Et la doctrine interdit d'annoncer un prix avant la
démo — cette page en annonce deux dès l'accueil.

Ce n'est **pas** une décision technique et je ne l'ai pas prise. Les deux
sorties possibles :

- le SaaS à 79/149 € devient l'offre réelle → la vitrine et la doctrine
  s'alignent dessus ;
- ce site retire ses tarifs et ne garde que « réserver un cadrage » → cohérent
  avec tout le reste du dépôt.

En attendant, les boutons ne mentent plus : ils mènent au cadrage (voir §
suivant). Mais **les prix sont toujours affichés**.

### ⚠ 2. Aucun paiement n'est possible sur le site

Les deux liens Stripe pointaient vers des URL de gabarit
(`buy.stripe.com/REMPLACE_SOLO`) : le visiteur tombait sur une page
introuvable **au moment exact où il voulait payer**.

Les trois boutons mènent maintenant au **cadrage** par mail — ce qui est de
toute façon la doctrine maison. Conséquence assumée : la mention « paiement
sécurisé par Stripe » a été retirée, parce qu'elle était devenue fausse.

**Pour rebrancher le paiement** : créer les liens Stripe, les poser dans les
`href` des deux boutons de tarif, et remettre la mention. Un test refuse
d'annoncer un paiement sans lien de paiement — les deux vont ensemble.

---

## Ce qui a été corrigé

| | Avant | Maintenant |
|---|---|---|
| **Liens de paiement** | 2 URL de gabarit, page Stripe introuvable | cadrage par mail, aucun lien mort |
| **Mentions légales / CGV / CGU / confidentialité / DPA** | absentes — sur un site qui vend, c'est une obligation, pas une bonne pratique | 5 pages générées depuis `legal/*.md`, liées en pied de page |
| **Crochets de gabarit juridique** | `[7] jours`, `[30] jours`, `[24] mois` — un contrat qui a l'air inachevé | supprimés dans `legal/`, pages régénérées |
| **« ~80 % de ta vente qui tourne sans toi »** | aucun client signé, aucune mesure derrière | remplacé par des faits qui décrivent le produit |
| **Poids** | 5,5 Mo, dont 5 Mo de PNG référencés nulle part | **468 Ko** |
| **Capture produit** | aucune — on vendait un logiciel sans jamais le montrer | capture réelle du build de production, WebP + repli JPEG |
| **`<title>` / `meta description`** | 79 et 229 caractères — coupés au milieu d'un mot en recherche | 58 et 150 |
| **`section-offres-eagleye.html`** | fragment orphelin dans le dossier publié, annonçant un **3ᵉ** modèle (30 % du CA encaissé) à `/section-offres-eagleye.html` | déplacé dans `docs/` |
| **404** | page Netlify par défaut | page maison, dans le ton du site |
| **`robots.txt` / `sitemap.xml`** | absents | présents, testés contre les pages réellement livrées |

---

## Vérifié en navigateur, pas à l'œil

Sur la page servie (`index.html` + les 5 pages légales) :

- aucun échec réseau, aucune image manquante, tous les `alt` présents ;
- un seul `<h1>`, `lang="fr"` partout, aucun lien vide ;
- aucun Markdown brut résiduel dans les pages juridiques ;
- la 404 maison est bien servie sur une URL inconnue ;
- **aucun débordement horizontal à 390 px** (accueil et CGV).

Deux fausses alertes, notées pour ne pas les rechercher deux fois : dans un
navigateur sans compositeur, aucune image n'est peinte, donc les animations
`.reveal` restent gelées à leur première frame et l'image `loading="lazy"`
n'est jamais demandée. Les deux se lèvent dès qu'on force une capture d'écran.
Ce n'était pas un défaut du site.

En revanche `.reveal` a perdu son `fill-mode: both` : `both` fait porter à
l'élément l'état de départ — `opacity: 0` — tant que l'animation n'a pas
démarré. C'est ce qui peut laisser une page blanche, pas ce qui l'en protège.
Sans fill-mode, le rendu est identique quand l'animation tourne, et la page
reste lisible le jour où elle ne tourne pas.

---

## Ce qui est bon, et qu'il ne faut pas casser

- `netlify.toml` : statique, aucun build, et il pose déjà HSTS,
  `X-Frame-Options`, `nosniff`, `Referrer-Policy` et une `Permissions-Policy`
  qui coupe caméra / micro / géolocalisation.
- Aucun superlatif, aucun « leader », aucun client compté — et un test le
  garde désormais.
- Le juridique a **une seule source** : `legal/*.md`. On modifie là, puis
  `node scripts/build-legal.mjs`. Éditer le HTML de `site/` directement
  garantit que la correction sera écrasée à la prochaine génération.

---

## Déployer

Netlify → nouveau site → « Deploy manually » → glisser le dossier `site/`.
Puis Domain settings → `eagleyecorp.fr` → suivre les enregistrements DNS
indiqués, à poser chez Amen.

⚠ Le certificat HTTPS ne s'émet qu'une fois le DNS propagé, et `HSTS` avec
`preload` est déjà actif dans les en-têtes : **ne pas** brancher le domaine
avant que le HTTPS fonctionne, sinon les navigateurs mémorisent l'échec — et
`preload` se désinscrit lentement.

Rien de tout ça n'a été déployé depuis ici : l'environnement de développement
n'atteint ni Netlify, ni le DNS. Ce qui est vérifié l'a été sur le dossier
servi en local.
