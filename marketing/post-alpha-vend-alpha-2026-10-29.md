# Post LinkedIn — « ALPHA vend ALPHA » (29/10/2026)

**Statut : PUBLIÉ le 29/10/2026 vers 20 h 25 (Paris)**, sur le « go » de Zakaria —
`urn:li:ugcPost:7521652429055004672` (vidéo `urn:li:video:D4E10AQHGmGeICbYdAA`, 5 357 238 octets,
téléversée depuis l'URL de production). Relecture par l'API refusée (403, connu) : vérifier à l'œil.

Vérifié AVANT de publier : le MP4 servi par la production a la même empreinte SHA-256 que
celui du dépôt ; la vignette rendue par LinkedIn est l'affiche « ALPHA vend ALPHA. »
(empreinte réduite 16 × 20 : écart moyen 0,6/255, contre 120 pour une image du milieu du film).
Publié le soir et non à 8 h 30 : le « go » est arrivé à 20 h 19, et aucun post n'était parti ce jour-là.

- Vidéo : `public/media/linkedin/alpha-vend-alpha-2026-10-29.mp4` (1080 × 1350, son synthétisé).
- Composition : `scripts/video/compositions/alpha-vend-alpha/` · garde : `tests/film-alpha-vend-alpha.test.ts`.
- Les écrans sont RÉELS : `capturer.mjs` sert l'app en mode MAÎTRE (verdict serveur), tape notre
  offre dans le vrai champ, lance le vrai pilote automatique, et photographie son journal. Le
  réseau est remplacé par des données FICTIVES (`donnees.json`) ; les emails sont rendus par le
  serveur sur le corps exact que le pilote a envoyé.

## Après publication — ce qui reste à surveiller

- **Le mur des confirmations** : 30 inscriptions/heure. Un post qui marche peut le toucher —
  surveiller `/adoption` le soir même et le lendemain matin.
- ⚠ Le shell distant de Composio a répondu 403 ce soir-là ; l'atelier Python, lui, joignait la
  production et les images LinkedIn. C'est par lui que l'empreinte et la vignette ont été lues.

## Texte du post

```
ALPHA vend ALPHA.

On a fait l'exercice qu'on demande à chaque inscrit : dire à ALPHA ce qu'on vend, et le laisser faire. Dans le champ « Ce que tu vends », on a tapé notre propre offre : « un OS de vente qui trouve vos clients et pose vos rendez-vous ». Cible : les agences immobilières du Rhône.

Ce que la vidéo montre, de A à Z, sur les vrais écrans :
A · notre offre, dans le vrai champ
B · la cible, cherchée au registre officiel de l'État, par métier et par zone
C · des entreprises actives, puis leurs coordonnées (avec TA clé Dropcontact)
D · un premier message parti de TA boîte : une seule question, et il dit qu'il est une IA
E · un « oui » → des créneaux libres pris dans TON agenda ; le mercredi déjà pris n'est pas proposé
F · « 2 » → le rendez-vous est posé, l'invitation part, une copie arrive chez toi
G · « c'est combien ? » → ALPHA ne répond pas. Le prix et la signature remontent à toi.
Z · toi, tu closes.

Filmer le cycle, c'est le tester. En préparant ces images, on a trouvé et corrigé cinq défauts dans ce qui part chez un prospect — dont deux signatures et trois « STOP » dans le même email, et une liste de créneaux sans ses numéros alors qu'on demande de répondre « 1, 2 ou 3 ».

Ce qu'on ne prétend pas : ALPHA qui vend ALPHA n'a encore signé aucun client. Les entreprises du film sont fictives.

En ligne, c'est gratuit. Ton CRM vit dans ton navigateur, et ALPHA travaille tant que l'onglet est ouvert.

Écrans réels de l'application, données fictives (illustratives).

alphasalesos.eagleyecorp.fr/vitrine

#prospection #vente #b2b
```

## Ce que le texte ne dit pas, exprès

- Aucun prix, aucun pourcentage, aucun résultat : zéro vente, donc rien à citer — et on le dit.
- Pas « ALPHA trouve vos clients pendant que vous dormez » : en ligne, il travaille onglet ouvert
  (décision du 21/10). L'ALPHA qui tourne app fermée n'existe que sur l'installation « chez vous ».
- Pas « vos données ne quittent jamais nos serveurs » : une clé d'IA envoie du texte à son
  fournisseur, et Dropcontact reçoit le nom des entreprises à enrichir.
- Dropcontact est nommé parce que c'est vrai et vérifiable (la clé est celle de l'utilisateur) ;
  ce n'est ni un partenariat ni une affiliation.
