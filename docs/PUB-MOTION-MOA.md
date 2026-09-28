# Publicité motion design — maîtrise d'ouvrage (9:16)

> Script arrêté le 11/09/2026. Format vertical, ~24 s, **lisible sans le son** :
> un maître d'ouvrage scrolle en silence, dans les transports ou entre deux
> réunions. Chaque plan porte UNE idée.

---

## Ce que ce script s'interdit, et pourquoi

Une pièce publique est soumise aux mêmes gardes que la vitrine. Ce n'est pas de
la prudence : chacun de ces refus a déjà été payé une fois dans ce dépôt.

| Interdit | Pourquoi |
|---|---|
| Témoignage, logo client, « ils nous font confiance » | **Zéro vente à ce jour.** En fabriquer un est la seule façon de perdre un client pour de bon. |
| « Ce qui a converti *\<enseigne\>* » | Preuve sociale **nommée** — la forme la plus convaincante, et celle qu'aucun garde ne tenait jusqu'au 10/09. |
| Un taux, un « +X % », un « N clients » | Aucun chiffre de résultat n'est mesuré. Un pourcentage à l'écran est une promesse. |
| « Les meilleurs », « la référence », « leader » | Invérifiable. Les tests de la vitrine les refusent déjà. |
| Label, accélérateur, programme, « lauréat » | Une affiliation se vérifie auprès de l'organisme, **sans nous prévenir**. |
| Un prix | Décidé : le prix arrive **après** la démonstration. La vidéo amène au cadrage. |
| Un nom d'entreprise réelle, un vrai numéro | Dépôt public + données de tiers. Tout numéro visible est en plage ARCEP fiction. |

> ⚠ **« Vous ratez des appels » est INTERDIT sur cette verticale**
> (`InterditFroid`, `lib/playbook.ts`). C'est faux chez un maître d'ouvrage —
> il a un standard, une assistante, un portable qui sonne. Le dire prouve
> qu'on n'a pas compris son métier, et l'appel est mort à la deuxième phrase.
>
> Sa perte réelle, c'est autre chose : **des acquéreurs déjà rencontrés que
> personne n'a rappelés.** Le script est bâti sur ce renversement — et c'est
> aussi ce qui le rend crédible, parce que personne d'autre ne dit ça.

---

## Le script

**Plan 1 — 0 → 3,6 s · L'ancrage vérifiable**
> Votre permis est affiché
> depuis **4 mois**.

*Motion : le texte se pose, un cartouche d'arrêté se dessine au trait. Aucun
chiffre de performance — une durée, publique et datée.*

> ⚠⚠ **La typo d'affichage décide de la mise en page, et ça ne se voit pas
> dans le script.** Archivo Black est ~17 % plus large que la police de repli à
> taille égale. Les tailles ayant été calées sur le repli, quatre lignes ont
> débordé au premier vrai rendu — dont celle-ci, **le plan d'ouverture**, qui
> sortait du canevas. Le fichier était valide et coupé.
> `scripts/pub/rendre.mjs` instrumente désormais `fillText`, balaie les 768
> images et **refuse de rendre** si un texte sort de la boîte utile. Les
> tailles ne se recalent donc pas à l'œil : le rendu le dit.

**Plan 2 — 3,6 → 6,8 s · Le renversement**
> Vous ratez
> des appels.
>
> **Non.**

*Motion : la phrase s'affiche en gris, puis une rature rouge TRAVERSE les deux
lignes d'un coup — une négation, pas une transition. « Non. » arrive ensuite,
en blanc. On tue le cliché du marché avant que le prospect ne nous y range.*

> ⚠ La rature est dessinée **ligne par ligne, à la largeur du texte mesuré**.
> Une barre unique posée à la frontière des deux lignes SOULIGNE la première au
> lieu de nier les deux — c'est ce que faisait la première version, et ça se
> voit immédiatement à l'écran.

**Plan 3 — 6,8 → 12,0 s · La vraie perte**
> Vous avez rencontré des acquéreurs.
> **Personne ne les a rappelés.**

*Motion : trois silhouettes-points s'allument, puis s'éteignent une à une.
Abstrait — aucun visage, donc aucun faux témoin.*

**Plan 4 — 12,0 → 18,2 s · Le mécanisme**
> Alpha trie, relance,
> consigne.

puis quatre plaques qui glissent en place, une par une :

> Qui rappeler aujourd'hui
> Ce qui s'est dit la dernière fois
> Quand revenir sans agacer
> Ce qui attend une réponse

*C'est le produit MONTRÉ, pas promis : ces quatre lignes sont ce que l'écran
du matin affiche réellement.*

**Plan 5 — 18,2 → 21,6 s · La limite, dite**
> Il ne construit pas.
> Il ne serre pas
> la main.
>
> Tout le reste, si.

*Motion : les deux limites en gris, un trait bronze qui se tire sous elles,
puis la bascule en blanc. C'est le plan le plus important : il est vrai, il est
rare, et c'est lui qui rend les quatre précédents croyables.*

> ⚠ **Ce plan ne se coupe pas** pour « gagner trois secondes ». Une pub qui ne
> promet que du bien se lit comme toutes les autres, et la doctrine est
> explicite : on fait tout sauf la livraison et la poignée de main. Un test
> refuse son retrait.

**Plan 6 — 21,6 → 25,6 s · La sortie**
> Un cadrage.
> 20 minutes.
>
> **eagleyecorp.fr**
>
> Lyon · Villeurbanne

*Motion : le logo se compose, l'URL reste 2 s pleines à l'écran.*

---

## Voix off (optionnelle)

Le script tient **sans son**. Si une voix est ajoutée, elle lit le texte à
l'identique — pas une variante, pas d'improvisation.

> ⚠ Si la voix est **synthétique**, elle relève de la même discipline que
> l'agent vocal : on ne fait pas passer une IA pour une personne. Dans une
> publicité, l'art. 50 n'impose pas la phrase d'annonce d'un appel — mais la
> règle maison reste : aucune voix ne se présente comme un client, un
> utilisateur ou un témoin.

---

## Ce qui n'est pas décidé

- **Aucune diffusion n'est achetée.** Ce script est un artefact, pas une
  campagne : le budget, le ciblage et la mesure sont des décisions à part.
- **Aucun A/B.** Avec zéro diffusion passée, comparer deux accroches ne
  mesurerait rien — il faut du volume avant d'avoir un test.
