# Objectif : 10 millions d'utilisateurs — structuré pour `/goal`

> Décidé par Zakaria le 20/10/2026. Ce document dit **ce que « 10 M » veut
> dire, où sont les murs, et comment on le découpe en objectifs que Claude
> peut réellement atteindre et prouver**. Il ne promet pas le chiffre.

## 0. L'état mesuré, avant toute ambition

| | Valeur | Source |
|---|---|---|
| Clients payants | **0** | `JUILLET_REEL.gagnes` |
| Comptes créés | **inconnu** | aucune sonde ne les compte (voir objectif 0) |
| Utilisateurs actifs | **inconnu, et c'est voulu** | le CRM vit dans le navigateur ; le serveur ne voit rien d'un compte gratuit (`lib/valeur-produite.ts`) |
| Marché ICP actuel | **842 groupes** de permis en Auvergne-Rhône-Alpes sur 24 mois | relevé Sitadel, 30/09/2026 |

**10 M, c'est quatre ordres de grandeur au-dessus du marché qu'on prospecte.**
Ce chiffre ne viendra pas des promoteurs. Il ne peut venir que de la **forme
en ligne gratuite** devenue un outil que n'importe quel vendeur adopte seul —
c'est-à-dire d'un produit **horizontal**, en plusieurs langues, qui se propage
sans nous. Les promoteurs restent la porte d'entrée et la vente « chez vous »
reste ce qui paie.

## 1. Ce qui compte comme « un utilisateur » — à trancher

| Définition | Se mesure aujourd'hui ? | Ce qu'elle vaut |
|---|---|---|
| **Compte créé** | oui, dès l'objectif 0 (compter `auth.users`, aucun contenu) | facile à gonfler, dit peu |
| **Compte actif** (une action dans les 30 j) | **non** — exige une télémétrie de COMPTES, opt-in (`PartageCohorte`) | le vrai chiffre |

⚠ Mesurer l'activité **se décide** (CLAUDE.md : « mesurer une cohorte se
DÉCIDE ; ça ne se code pas en douce »). Tant que ce n'est pas décidé, l'objectif
porte sur les **comptes créés**, et on le dit à chaque fois qu'on l'annonce.

## 2. Les murs, dans l'ordre où on les prendra

| Palier | Le mur | Pourquoi il tombe là |
|---|---|---|
| **~30 inscriptions / heure** | les emails de confirmation | Supabase Auth plafonne par défaut l'envoi de ses emails (≈ 30/h avec un SMTP perso — **chiffre secondaire, à lire dans le tableau de bord**, Authentication → Rate Limits). Un post qui marche amène 50 inscrits en une heure : 20 n'ont pas leur lien. Et ces emails partent de `contact@`, la **boîte de prospection** — une campagne qui prend des plaintes fait tomber les inscriptions (CLAUDE.md, « ce que ça coûte »). |
| **Tout de suite** | l'hébergement | le site tourne sur Vercel Hobby, réservé au non-commercial. Le jour où ça se voit, ce n'est pas une facture : c'est une coupure. |
| **~50 000 actifs / mois** | le plan gratuit Supabase | plafond d'utilisateurs actifs de l'offre gratuite (**source secondaire**). Au-delà, l'offre Pro + un coût par utilisateur. « Le cloud sans argent » s'arrête là, au plus tard. |
| **~100 000** | le support | des inconnus gratuits posent des questions ; « on est là si besoin » sans borne devient du travail gratuit illimité. |
| **10 M** | le coût de l'authentification seule | à l'ordre de grandeur du tarif par utilisateur relevé (secondaire), plusieurs dizaines de milliers d'euros par mois — **payés par les installations « chez vous »**, ou par rien. |

Ce qui joue POUR nous, et c'est structurel : une fiche gratuite ne coûte
presque rien au serveur (le CRM est dans le navigateur, l'IA et l'email
passent par les clés du client). Le coût d'un gratuit est **un compte**, pas
une base. C'est ce qui rend un très grand gratuit pensable — pas gratuit.

### 2bis. Ce qui a été MESURÉ côté SQL (21/10/2026) — `scripts/mesure-echelle.sh`

Postgres 16 réel, migrations rejouées, **jusqu'à 1 000 000 de comptes**. Ce n'est PAS
Supabase hébergé : c'est la couche SQL que nous écrivons.

| À 1 M de comptes | Avant | Après |
|---|---|---|
| Inscription (trigger d'essai) | 52 µs/compte | 60 µs — plate de 1 k à 1 M |
| Somme de l'enveloppe, par requête d'un inscrit en essai | 112 ms, **et fausse au-delà de ~1 000 essais** (réponses PostgREST bornées) | **1,6 ms**, exacte |
| `adoption_stats` (écran propriétaires) | 4,2 s | 2,1 s — **encore linéaire** (≈ 20 s à 10 M, extrapolé) |
| Débits d'essai concurrents (16 clients) | — | 64 000, **aucun perdu**, ≈ 5 000/s sur la ligne unique du compteur |
| Limiteur de débit, 100 000 IP distinctes | 925 µs/requête | 1,2 µs |

**Posée en production le 21/10/2026** (sur « go ») et relue par le catalogue : compteur
= somme = 0,00, droits fermés à `anon` / `authenticated`. Le comportement du trigger sur
une dépense réelle n'y est pas encore vu — il l'est sur Postgres local, deux fois.

**Ce qui n'est PAS mesuré et reste le vrai mur** : le nombre d'appels REST par page
(~17, un par requête qui traverse le middleware), la limite réelle de lignes de
PostgREST (Settings → API → Max rows), les limites d'Auth, le SMTP, l'hébergement.
Rien de cela ne se mesure depuis ce conteneur.

## 3. Les paliers — 10 · 100 · 1 000 · 10 000 · 100 000 · 1 M · 10 M

Même logique que `lib/paliers-campagne.ts` : **un palier borne, il ne décore
pas**, et on ne passe au suivant que sur preuve.

| Palier (comptes) | Condition pour passer au suivant |
|---|---|
| **10** | le compteur existe (objectif 0) ; 10 comptes qui ne sont pas les nôtres |
| **100** | emails de confirmation sur une boîte DÉDIÉE (pas `contact@`), limite Supabase relevée et lue ; hébergement commercial réglé |
| **1 000** | décision prise sur la mesure d'activité ; `/bienvenue` mesuré (combien finissent la configuration) |
| **10 000** | décision sur l'anglais (vitrine + app) ; une boucle de propagation mesurée (voir § 4) |
| **100 000** | support borné et écrit ; plan Supabase payant financé par des installations |
| **1 M → 10 M** | à réécrire au palier 100 000 avec des chiffres mesurés, pas avant |

## 4. Les trois moteurs, et ce qui est déjà construit

1. **Le contenu LinkedIn** — une vidéo par jour au plus, faite selon
   `.claude/skills/alpha-motion/SKILL.md`. Construit. **Non mesuré** : aucune
   statistique de post n'est relevée aujourd'hui.
2. **La mention de plateforme** — chaque email envoyé par Alpha porte
   « Envoyé avec Alpha Sales OS® ». C'est la boucle qui a fait les grandes
   messageries gratuites. Construite. **Non mesurée** : rien ne dit combien
   d'inscriptions elle amène.
3. **La vente « chez vous »** — ce qui finance les murs du § 2. Le premier
   client LinkedIn « gant blanc » est le test (`docs/INSTALLATION-CHEZ-VOUS.md`).

## 5. Pourquoi « 10 M » ne se met PAS dans un `/goal`

`/goal` (Claude Code, `code.claude.com/docs/en/goal`) relance Claude tour après
tour jusqu'à ce qu'un petit modèle juge la condition remplie. **Cet évaluateur
ne lit que la conversation** : il n'exécute rien et ne lit aucun fichier.

- Le nombre de comptes vit dans Supabase, que ce conteneur ne joint pas
  (refus du proxy, mesuré). Claude ne peut donc pas le **montrer** dans la
  conversation ; l'évaluateur ne peut pas le **voir**.
- Une session ne crée pas d'utilisateurs : elle construit des moyens d'en avoir.

Un `/goal « 10 M d'utilisateurs »` tournerait jusqu'à être déclaré impossible,
ou jusqu'à épuiser le crédit. **Le nord reste ici ; chaque `/goal` vise un
livrable vérifiable qui rapproche du palier suivant.**

## 6. Les objectifs prêts à coller

À taper dans une session Claude Code ouverte sur ce dépôt, en mode auto si on
veut qu'il tourne sans demander. Une condition = un état final, une preuve,
des contraintes, une borne.

> ✅ **Objectif 0 LIVRÉ le 20/10/2026, puis DÉPLACÉ le même jour** : la tuile
> d'abord logée dans `/ceo` est devenue un écran de propriétaires, `/adoption`
> (`lib/adoption.ts` · `/api/adoption` · `supabase/migrations/017-adoption.sql`),
> parce que `/ceo` est la console qu'on livre aux installations client et que le
> compteur d'acquisition n'a rien à y faire. `lib/comptes-crees.ts` reste : c'est
> le REPLI quand la fonction SQL n'est pas posée. Le texte
> ci-dessous reste comme trace de la demande. Deux entiers (le total, les
> inscrits de la dernière heure), `null` et un tiret si la base est
> injoignable, aucune adresse qui remonte, maître seul (403 sinon, jouée).
> La fenêtre d'une heure est un **plancher** (« ≥ ») quand les 100 comptes
> lus sont tous dedans. **Le mur de 30/h reste SUPPOSÉ** et l'écran le dit.

**Objectif 0 — compter (palier 10)**

```
/goal Le nombre de comptes créés se lit dans /ceo, maître seul : une sonde lit le total d'auth.users par l'API d'administration Supabase (aucun email, aucun contenu ne remonte, seulement un entier), rend null et un tiret si la base est injoignable (jamais 0), et un test APPELLE la route et prouve 403 pour un non-maître. Preuve dans la conversation : `npm test` sort 0 échec et `npx tsc --noEmit` sort 0, commit poussé sur claude/crm-n8n-email-tracking-4qxtwr. Contraintes : aucune dépendance npm ajoutée, aucun autre test modifié. Ou arrête-toi après 25 tours.
```

**Objectif 1 — le moteur vidéo (palier 10 → 100)**

```
/goal Trois vidéos LinkedIn de 18 à 22 s, rendues avec HyperFrames selon .claude/skills/alpha-motion/SKILL.md, chacune montrant de VRAIS écrans de l'app capturés par scripts/pub/capturer.mjs sur le jeu de démonstration, avec sa bande-son générée par scripts/video/bande-son.mjs. Preuve dans la conversation pour chacune : la planche d'images clés regardée, la checklist du § 6 cochée ligne par ligne, le MP4 dans public/media/linkedin/, `npm test` à 0 échec. Contraintes : rien n'est publié sur LinkedIn (la publication attend le feu vert de Zakaria), aucune donnée réelle. Ou arrête-toi après 40 tours.
```

Les objectifs suivants (boîte de confirmation dédiée, anglais, mesure
d'activité) attendent une **décision** de Zakaria ou un geste dans un
tableau de bord que Claude ne peut pas faire d'ici. Ils s'écriront quand la
décision existera — un `/goal` sur une décision non prise tourne à vide.

## 7. Ce qui est sur Zakaria, dans l'ordre

> **Décision du 20/10/2026 : on remplit la limite d'abord.** Les points 1 et 3
> ci-dessous attendent qu'elle soit atteinte (« on verra le reste quand le
> moment viendra »). Ce n'est pas un oubli : c'est un ordre. Le compteur de
> `/ceo` dit quand on s'en approche, au lieu de l'apprendre par un inscrit qui
> n'a pas reçu son lien. **Le coût de ce choix**, écrit pour ne pas être
> redécouvert : les inscrits au-delà du mur n'ont pas leur email de
> confirmation, et ces emails partent de `contact@` — une plainte sur une
> campagne coupe aussi les inscriptions.

1. Lire la limite d'emails dans Supabase (Authentication → Rate Limits) et me
   la donner : c'est le premier mur, et son chiffre exact n'est pas connu ici.
2. Trancher la définition d'« utilisateur » (§ 1).
3. Régler l'hébergement commercial avant le palier 100.
