# SEMAINE DU 14 AU 20 SEPTEMBRE 2026 — viser le premier encaissement

> Objectif annoncé : **10 000 €**. Ce document ne le répète pas comme un slogan,
> il dit ce qu'il faudrait exactement, ce que le pipe permet, et l'écart entre
> les deux. Tous les chiffres viennent du code, pas de mémoire.

---

## L'ARITHMÉTIQUE, AVANT LA LISTE

**Ce qu'encaisse une signature :**

```
Pack COMPTANT ............ 10 000 €   ← une seule suffit
Pack ÉCHELONNÉ ...........  2 500 € d'acompte, puis 10 × 800 €
Setup Alpha Voice ........  1 490 €
```

**10 000 € cette semaine = 1 pack comptant, OU 4 acomptes échelonnés.**

**Ce que le pipe contient réellement :**

| Stade | Nombre | Ce que ça vaut |
|---|---|---|
| `offre` | **3** | **2 970 €** de setup cumulé |
| `demo` | 3 | — |
| `redzone` | 1 | — |
| `audit` | 6 | — |
| `contact` | 3 | — |

> ⚠⚠ **LES TROIS OFFRES NE FONT PAS 10 000 €.** Ce sont des deals Alpha Voice,
> pas des packs : 2 970 € au total. Les fermer toutes les trois — ce qui serait
> déjà un excellent résultat — laisse **7 030 € d'écart**.
>
> **10 000 € cette semaine exige donc une vente qui n'est pas dans le pipe
> aujourd'hui.** Ce n'est pas impossible ; ce n'est pas une mécanique. Et la
> seule donnée de closing qu'on ait est **6 rendez-vous en juillet → 0 signé**.

**Donc deux objectifs, et je les sépare :**

- **Réaliste et mesurable cette semaine : `gagnes` passe de 0 à 1.** C'est le
  chiffre qui débloque tout le reste — le taux RDV → signature vaut `null`, et
  ce `null` interdit toute projection dans le produit.
- **Le 10 000 € : il faut ouvrir un pack.** Ce qui veut dire un prospect à
  10–50 commerciaux, à qui on vend l'OS complet et pas une brique. C'est la
  cible de la semaine côté nouveau.

---

## LUNDI 14 — débloquer, sinon rien d'autre ne compte

- [ ] **Les 4 variables Vercel, dans l'ordre.** Dix minutes. Sans elles,
      `estMaitre("contact@eagleyecorp.fr")` rend `false` et tu es au socle
      gratuit. Détail : `docs/A-FAIRE-ZAKARIA.md`.
- [ ] **Migrations 002 → 011** dans le SQL editor (010 et 011 : le BYOK).
- [ ] `GET /api/health` une fois connecté → vérifier `auth.serverEnforced` et
      `proprietaire.coherent`.
- [ ] **Les 3 fiches `offre` : une relance chacune, aujourd'hui.** Pas un
      « je me permets de relancer » — une **raison neuve**. Le pré-devis en est
      une : fiche → onglet commercial → Ouvrir le document.
- [ ] **La fiche `redzone` : tranchée aujourd'hui.** Sauvée ou perdue, pas
      laissée ouverte. Un deal en zone rouge qui traîne pollue le compteur et
      la tête.

## MARDI 15 / MERCREDI 16 — ✅ LE CANAL QUI ENVOIE EST OUVERT

> **Le bloquant n°1 de la semaine est levé.** DKIM activé chez Amen, SMTP
> Supabase branché, **les mails de confirmation d'inscription arrivent**. Tout
> le produit était derrière cette porte : un inscrit qui ne reçoit pas son lien
> ne devient jamais client.

- [x] **SMTP `contact@eagleyecorp.fr`** branché côté Supabase.
- [x] **DKIM chez Amen.** SPF et DMARC étaient déjà posés (relevé DNS du 15/09) —
      en créer un second de l'un ou l'autre revenait à n'en avoir aucun.
- [ ] **Relever `s=` et `d=`** dans l'en-tête `DKIM-Signature` d'un message
      reçu. Vingt secondes, et c'est le seul geste qui dise **lequel des deux
      leviers tient** : DKIM aligné, ou SPF.
      ⚠ Le DMARC est en `p=quarantine` avec **alignement strict**. Que les mails
      arrivent en boîte de réception prouve que DMARC **passe** — un échec
      partirait en indésirables. Mais on ne sait pas encore par quelle jambe,
      et le jour où l'une bouge (changement de plateforme, sous-domaine
      d'envoi), on voudra le savoir. `docs/SMTP-SUPABASE-AMEN.md` §3.
- [ ] **Les 3 `demo` → `offre`.** Ils ont vu le produit ; il leur manque un
      devis, pas une démo de plus. Le cadrage est la porte : pas de devis sans
      lui, et c'est le code qui le tient.
- [ ] Relance 2 sur les `offre` qui n'ont pas répondu — **canal différent**
      de lundi.

## MERCREDI 16 — le carburant

- [ ] **Export des fiches ICP.** Cible `FUEL_TARGET = 300`. C'est le seul
      blocage que je ne peux pas contourner (proxy).
- [ ] **Charger les 20 fiches du CSV** en attendant.
- [ ] **Premier lot d'approches LinkedIn** sur l'ICP services B2B — 10 à 50
      commerciaux, qui croulent sous les demandes entrantes.
- [ ] `python voice/agent.py` lancé le matin, et chaque matin.

## JEUDI 17 — le pack, c'est-à-dire les 10 000 €

- [ ] **Cinq conversations ouvertes sur le PACK COMPLET**, pas sur une brique.
      C'est la seule ligne de cette semaine qui peut produire 10 000 €.
- [ ] Pour chacune : **pré-devis envoyé** (il n'engage rien) + **créneau de
      cadrage proposé**. L'estimateur de la vitrine fait le même calcul si le
      prospect préfère se servir seul.
- [ ] 20 touches minimum (`RHYTHM_MIN_TOUCHES`) — le compteur de `/aujourdhui`
      te dit où tu en es.

## VENDREDI 18 — closer ce qui est mûr

- [ ] **Cadrages tenus** sur les `offre`. Rappel : le devis n'est émis qu'après
      un cadrage **tenu ET validé** — trois conditions, et le code les exige.
- [ ] **Devis envoyés** dans la foulée de chaque cadrage validé.
- [ ] **Saisir les montants et marquer `payé`** dès qu'un virement arrive.
      Sans ça, `/preuves`, `/payouts` et la part au résultat rendent `null` :
      **un encaissement non saisi est un encaissement invisible.**

## SAMEDI 19 / DIMANCHE 20 — la mesure

- [ ] **Consigner chaque résultat d'appel** de la semaine, s'il en reste.
      Un appel non consigné ne corrige pas le tri, ne nourrit pas le Cerveau,
      et ne compte pas dans le taux.
- [ ] **Relever les quatre compteurs** de `/aujourdhui` : fiches chargées,
      jours au rythme, audits envoyés, résultats consignés.
- [ ] **Si une affaire est signée : noter le nombre de RDV qu'il a fallu.**
      C'est la première mesure du taux RDV → signature, et elle vaut plus que
      les 10 000 €.

---

## LES TROIS CHOSES QUI FONT ÉCHOUER CETTE SEMAINE

1. **Poser le SMTP avant les comptes.** `/api/send` devient joignable par
   n'importe qui, avec un SMTP qui marche. De vrais emails depuis ton domaine,
   pour des inconnus — visible seulement sur la réputation, des semaines après.
2. **Pousser quatre deals à la fois pour atteindre 10 000 €.** Tu en as trois
   de mûrs. Étaler l'effort sur des affaires qui ne sont pas prêtes est la
   façon la plus rapide de n'en fermer aucune.
3. **Ne rien consigner.** Une semaine non consignée produit exactement les
   mêmes chiffres qu'une semaine sans travail — et tu perds la mesure que cette
   semaine existe pour obtenir.

---

## CE QUI EST VRAI, ET QU'IL FAUT GARDER EN TÊTE

Le RDV est une **mécanique** : 7,7 % mesuré sur 78 fiches travaillées
(fourchette réelle 3,6 %–15,8 %). 300 fiches valent 11 à 47 rendez-vous.

L'euro n'est **pas** une mécanique. `gagnes: 0`. Le taux rendez-vous →
signature n'a jamais été observé ici, et aucun raisonnement ne le remplace.

> **La phrase honnête de la semaine n'est pas « on fait 10 000 € ».**
> C'est : *« on ferme ce qui est mûr, on ouvre cinq conversations pack, et on
> mesure enfin ce que coûte une signature. »* Si un pack se ferme, les 10 000 €
> viennent avec. S'il ne se ferme pas, on saura pourquoi — et c'est la première
> fois qu'on pourra le dire.
