# LE PAYSAGE GTM, ET L'IDENTITÉ D'ALPHA

> Écrit le 16/09/2026, en levant la tête du guidon comme demandé. Le marché
> vient de **dehors** (recherche datée, sources en bas), le reste vient du code.
> L'identité elle-même vit dans `lib/promesse.ts` — pas ici. Ce document dit
> **pourquoi** elle est celle-là.

---

## 1. CE QUI SE PASSE DEHORS, ET QUI CHANGE LA QUESTION

Trois faits mesurés, pas des impressions :

**Le marché a CONSOLIDÉ, il ne s'est pas fragmenté.** Les équipes revenus ont
coupé environ **38 % de leurs outils** en 2026. HubSpot a racheté Warmly (30/06),
Zoom a racheté Common Room (02/07), Apollo a racheté Pocus (18/03), Salesloft a
fusionné avec Clari. La pile qui gagne tient en quatre briques : un CRM, une
couche de signaux, un moteur d'outbound, une couche pub.

**L'argument de vente est devenu universel.** Tout le monde annonce « des agents
qui EXÉCUTENT à une échelle qu'un humain n'atteint pas ». Et tout le monde
reconnaît la même limite : le remplacement complet d'un SDR est à **12–24 mois**,
tout tourne sous supervision humaine.

**L'article 50 du règlement IA est EN VIGUEUR depuis le 2 août 2026.** Six
semaines. Amendes jusqu'à **15 M€ ou 3 % du CA mondial**. Un automate d'appel
qui se présente « bonjour, c'est Sarah de la société X » sans annoncer qu'il est
une IA est en infraction, quelle que soit la qualité de la voix. La divulgation
doit être **au début**, claire, ni marmonnée ni noyée dans un disclaimer.

> ⚠ Une échéance de plus arrive : **2 décembre 2026** pour le marquage
> **lisible par machine** des contenus générés. Onze semaines. Savoir si Alpha
> est dans le périmètre (fournisseur ? déployeur ?) est une question ouverte —
> voir §5.

---

## 2. LA MAUVAISE NOUVELLE, ET IL FAUT LA LIRE EN ENTIER

Sur ce marché-là, **« l'OS de vente complet » est le pire positionnement
disponible**, et pas pour une raison de goût :

- C'est une promesse de **SURFACE**. La surface est le seul axe où une équipe
  financée bat systématiquement une personne seule. HubSpot n'a pas construit
  Warmly, il l'a acheté en un après-midi.
- Le marché **retire** des outils. Se présenter comme un outil de plus, même
  excellent, c'est arriver au moment exact où l'acheteur coupe.
- Et le nombre qui décide : **`gagnes: 0`**. Aucune vente. Sur le terrain de
  la surface, on part sans référence contre des acteurs qui en ont des milliers.

Il y a une donnée de plus, qui n'a jamais été écrite ici et qui gouverne tout
le reste : **le temps disponible va se réduire.** Toute identité qui exige
d'expédier en continu pour rester devant est morte à l'écriture. Ce n'est pas
un avis, c'est une contrainte d'entrée.

---

## 3. ⚠⚠ POURQUOI « LE APPLE DU GTM » EST REFUSÉ

C'est la demande, et je ne la suis pas. Quatre raisons, dont trois étaient déjà
écrites dans `lib/promesse.ts` avant qu'elle soit formulée :

1. **Ça contredit notre seul argument vérifiable, dans la même phrase.** La
   vitrine défend que l'automatisation commerciale des PME françaises ne
   devrait pas dépendre d'acteurs américains, et `tests/vitrine-fuite` EXIGE
   que cet angle reste. Emprunter le nom d'un de ces acteurs pour se décrire
   se réfute tout seul.
2. **Ça invite la comparaison qu'on perd.** « Le X de Y » signale **DÉRIVÉ**.
   À zéro vente, ça rejoint la famille des affirmations invérifiables —
   superlatifs, affiliations — que ce dépôt refuse partout ailleurs.
3. **Ça appelle la question qu'on ne veut pas.** « Quel modèle entraînez-vous ? »
   Aucun. On loue l'intelligence comme tout le monde.
4. **Et celle-ci est propre à CETTE marque :** son identité désigne une
   stratégie d'**intégration verticale** — tout maîtriser, tout polir, tout
   livrer d'un bloc. C'est la stratégie qui coûte le plus d'heures par unité de
   temps. L'adopter, c'est s'engager publiquement sur le seul jeu qu'on ne peut
   pas jouer, devant des gens qui vérifieront.

> ⚠ **Le garde existant ne l'aurait PAS attrapée.** Il cherchait « le X **de la
> vente** » et une liste de **labos**. « Le Apple du GTM » sortait par les deux
> côtés à la fois : un nom hors liste, un domaine hors motif. Corrigé le même
> jour — le garde vise désormais la FORME quel que soit le domaine, et la leçon
> déjà écrite (« une liste seule serait périmée au prochain acteur à la mode »)
> s'est vérifiée en trois semaines.

**Ce qui est GARDÉ de l'intention, parce qu'elle est juste** : le soin, le refus
de livrer du bâclé, le produit qui se tient d'un seul bloc. Ça n'a besoin
d'aucun nom emprunté — ça se démontre en ouvrant l'app, et un nom emprunté le
remplacerait par une comparaison.

---

## 4. L'IDENTITÉ — et elle était déjà dans le code

> **« Tout le monde vend un agent qui en fait plus. Alpha est celui qui
> refuse. »** (`CATEGORIE`, `lib/promesse.ts`)

Ce n'est pas un slogan cherché : c'est la **description littérale** de ce qui a
été construit. Regarde les huit garanties de `PREUVES` — **aucune n'ajoute une
capacité, toutes retirent une possibilité** :

| Ce qu'Alpha refuse | Le fichier |
|---|---|
| un script d'appel sans divulgation IA | `lib/voice-script.ts` |
| une sollicitation au-delà du plafond légal | `lib/call-cadence.ts` |
| un script dans un secteur où c'est interdit | `lib/secteurs-interdits.ts` |
| un envoi sans mentions, un forçage du palier | `lib/email-ramp.ts` |
| un email signé d'une raison sociale qui n'est pas la sienne | `lib/signature.ts` |
| un devis sans cadrage | `lib/cadrage.ts` |
| un zéro qui ressemble à un résultat | `lib/calibration.ts` |
| « c'est l'IA » quand c'est un humain qui a relu | `lib/signature-ia.ts` |

**Un test l'exige désormais** : si quelqu'un ajoute cinq garanties du type
« Alpha rédige aussi vos… », la majorité bascule, la catégorie cesse d'être
vraie, et le test tombe **avant** que la phrase parte sur une page publique.
L'identité se **dérive** des preuves ; elle n'est pas posée à côté.

### Pourquoi c'est la seule identité qui tient

- **Elle est vraie aujourd'hui**, sans un seul client. Contrairement à toute
  promesse de résultat.
- **Elle s'ouvre.** « Ouvre le fichier » bat n'importe quel chiffre sur un
  stand — et c'est impossible à imiter par une page de CGU.
- **Elle est à contre-courant exact** de ce que les huit autres annoncent. Dans
  un marché où le message est identique partout, être celui qui dit non est la
  seule place libre.
- **⚠⚠ Et elle ne se périme pas sans nous.** Un avantage de FONCTIONNALITÉ se
  dégrade dès qu'on arrête d'expédier : rattrapé en semaines. Un avantage de
  **conformité encodée** se dégrade au rythme où la loi bouge — lentement, sur
  des dates annoncées des années à l'avance. **C'est le seul actif de ce dépôt
  qui vaut encore quelque chose après trois mois sans commit.**

### Ce que cette identité coûte, et il faut l'accepter

Elle **rétrécit** la cible. « Celui qui refuse » ne parle pas à qui veut
envoyer 10 000 emails demain — et c'est le gros du marché. Elle parle à qui a
quelque chose à perdre : une marque, un agrément, un secteur régulé, un
dirigeant qui a lu le montant des amendes. C'est moins de monde, et ce sont les
seuls qui paieront un premium à une personne seule plutôt qu'à une plateforme.

---

## 5. COMMENT ALPHA ÉVOLUE QUAND LE TEMPS MANQUE

La conséquence pratique de tout ce qui précède. **On n'ajoute plus de
surface** : chaque brique de plus est un front à défendre contre des gens
financés. On approfondit le seul axe qui ne se dégrade pas.

Le calendrier de la loi remplace une feuille de route produit — et il a
l'avantage rare d'être **connu d'avance** :

1. **2 décembre 2026 — marquage lisible par machine des contenus générés.**
   Onze semaines. ⚠ **La question d'abord, le code ensuite** : Alpha est-il
   fournisseur ou déployeur ? Il loue les modèles, il ne les fabrique pas. La
   réponse décide si c'est une obligation ou un argument commercial. **Ne pas
   coder avant d'avoir tranché** — et si c'est un argument, c'en est un que
   personne d'autre en outbound français n'aura.
2. **Ce que la concurrence ne fera pas** : le décret 2022-1313, l'ePrivacy
   française, les secteurs interdits. Cognigy, PolyAI, Parloa font du
   **contact center entrant** d'entreprise ; Apollo et Salesloft font de
   l'**outbound américain**. Personne n'occupe l'intersection *outbound + PME
   française + contrainte légale exécutable*. C'est étroit, c'est ennuyeux,
   c'est juridictionnel — c'est exactement pour ça que c'est libre.
3. **Une cadence mensuelle suffit.** Une veille réglementaire se lit une fois
   par mois. Une course aux fonctionnalités se perd en une semaine d'absence.

> ⚠ **Ce que ça ne règle pas, et ne prétendons pas le contraire.** Cette
> identité ne produit pas une vente. `gagnes` vaut toujours **0**, et le taux
> rendez-vous → signature n'a jamais été observé ici. Un positionnement juste
> sur un marché libre reste un positionnement sans client. La seule chose qui
> change ce nombre est celle de demain : des conversations, et des dates de
> cadrage posées.

---

## Sources

- [8 GTM Engineering Trends In 2026 — Factors.ai](https://www.factors.ai/blog/gtm-engineering-trends)
- [Go-to-Market AI Strategies: A 2026 GTM Guide — ZoomInfo](https://pipeline.zoominfo.com/sales/gtm-ai)
- [GTM Engineering Trends 2026: What Is Actually Changing — DevCommX](https://www.devcommx.com/blogs/gtm-engineering-trends-2026)
- [EU AI Act: Transparency Obligations Take Effect 2 August 2026 — Cooley](https://www.cooley.com/news/insight/2026/2026-08-03-eu-ai-act-transparency-obligations-take-effect-2-august-2026)
- [Transparency obligations under Article 50 — Commission européenne](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act)
- [EU AI Act's Transparency Rules: What Went Into Effect on 2 August — Morgan Lewis](https://www.morganlewis.com/blogs/sourcingatmorganlewis/2026/08/eu-ai-acts-transparency-rules-what-went-into-effect-on-2-august)
- [AI Cold Calling Compliance EU 2026 — Knowlee](https://www.knowlee.ai/blog/ai-cold-calling-compliance-eu-2026)
- [EU Voice AI Regulations 2026: AI Act, GDPR & Call Recording — Softcery](https://softcery.com/lab/eu-voice-ai-regulations-founders-guide)
- [Best AI Voice Agent for European Enterprise Contact Centres — Ainora](https://ainora.lt/blog/ai-voice-agent-for-european-enterprise-contact-centre-2026)
