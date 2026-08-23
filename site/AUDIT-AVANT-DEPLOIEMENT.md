# Site statique — ce qui bloque avant `eagleyecorp.fr`

> Audit du dossier `site/` servi tel quel (Netlify, `publish = "."`, aucun
> build). Le site se sert, il est propre visuellement, et il n'est **pas**
> déployable en l'état.

---

## BLOQUANT 1 — Les boutons de paiement ne mènent nulle part

```
https://buy.stripe.com/REMPLACE_SOLO
https://buy.stripe.com/REMPLACE_PRO
```

« Commencer » et « S'abonner » renvoient vers des URL de gabarit. Un visiteur
qui clique tombe sur une page Stripe introuvable — au moment exact où il
voulait payer. C'est le pire endroit possible pour un lien mort.

**À faire** : créer les deux liens de paiement Stripe et les remplacer, ou
retirer les boutons et ne garder que « Nous parler ».

---

## BLOQUANT 2 — Deux sites publics, deux prix différents

| Surface | Ce qu'elle annonce |
|---|---|
| `site/` (celui-ci) | abonnement **79 € / 149 € par mois**, « commencer » en un clic |
| `/vitrine` (l'app Next.js) | **10 000 € HT** de pack + 1 000 €/mois, **cadrage obligatoire** avant tout devis |
| `CLAUDE.md` (doctrine) | 10 000 € VIP **ou** 30 % + frais de setup, cadrage obligatoire |

Ce ne sont pas deux tarifs, ce sont **deux modèles économiques**. Un prospect
qui voit 79 €/mois puis entend 10 000 € ne pense pas « il y a plusieurs
offres » : il pense qu'on l'a appâté. Et la doctrine interdit explicitement
d'annoncer un prix avant la démo — ce site en annonce trois en page d'accueil.

**À trancher avant de publier** (c'est une décision commerciale, pas
technique) :
- soit le SaaS à 79/149 € devient l'offre réelle, et la vitrine + la doctrine
  s'alignent dessus ;
- soit ce site retire ses tarifs et ne garde que « réserver un cadrage », ce
  qui est cohérent avec tout le reste.

---

## BLOQUANT 3 — Une performance affichée, zéro client pour l'appuyer

En hero, dans les trois compteurs :

> **~80 %** — « de ta vente qui tourne sans toi, une fois branché »

Un client signé à ce jour. Ce chiffre ne vient d'aucune mesure : il ne se
défend pas devant le premier prospect qui demande d'où il sort, et il
fragilise tout le reste de la page — y compris ce qui est vrai.

Les tests de la vitrine refusent déjà ce type d'affirmation dans l'app
(`aucune preuve inventée`). Ce site n'est pas couvert par ces tests.

**À faire** : remplacer par un fait vérifiable (« une seule alerte par jour »
et « 40 s pour débriefer » en sont, elles décrivent le produit, pas un
résultat), ou retirer le compteur.

---

## BLOQUANT 4 — Aucune mention légale, aucune CGV

Le site **vend** (boutons Stripe) et ne contient ni mentions légales, ni CGV,
ni politique de confidentialité, ni lien vers l'une d'elles.

En France, pour un site marchand, c'est une **obligation**, pas une bonne
pratique. Les textes existent déjà dans `legal/` :

```
legal/MENTIONS-LEGALES.md   legal/CGV.md   legal/CGU.md
legal/POLITIQUE-CONFIDENTIALITE.md   legal/DPA.md
```

**À faire** : les convertir en pages HTML dans `site/` et les lier en pied de
page. Aucun développement, une conversion.

---

## Ce qui est bon, et qu'il ne faut pas casser

- Le fichier `netlify.toml` est correct : site statique, aucun build, et il
  pose déjà HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy` et une
  `Permissions-Policy` qui coupe caméra/micro/géoloc.
- Aucune image sans attribut `alt`.
- Aucun superlatif, aucun « leader », aucun client compté.
- Le titre et la structure sémantique tiennent (un seul `<h1>`, ancres
  internes cohérentes).
- 1 000 mots, 5,5 Mo d'assets : c'est lourd pour une page unique — regarder
  les quatre PNG de `assets/` avant de s'inquiéter du reste.

---

## Déployer, une fois les bloquants levés

Netlify → nouveau site → « Deploy manually » → glisser le dossier `site/`.
Puis Domain settings → `eagleyecorp.fr` → suivre les enregistrements DNS
indiqués, à poser chez Amen.

⚠ Le certificat HTTPS ne s'émet qu'une fois le DNS propagé. `HSTS` avec
`preload` est déjà actif dans les en-têtes : **ne pas** brancher le domaine
avant que le HTTPS fonctionne, sinon les navigateurs mémorisent l'échec.
