# ALPHA SALES OS — mémoire de projet

> Ce fichier se charge à CHAQUE session. Il porte la doctrine stable pour ne
> jamais relire toute la conversation. Ce qui bouge (plan, avancement) vit dans
> `docs/ROADMAP-TRILLION.md`. Mets à jour ici quand une RÈGLE change, pas quand
> une tâche avance.

## Qui / quoi
- **Propriétaire** : Zakaria Tazi — EAGLEYE CORP, Lyon. Français par défaut dans
  tout ce qui est produit (code en anglais, UI + docs + prompts en français).
- **Produit** : Alpha Sales OS — OS de vente white-label. Next.js 15 / React 19 /
  TS strict, Zustand persist (`alpha-sales-os-v2`). **Les briques qui
  capteraient de la donnée métier — crypto, CSV, RAG, PDF — sont faites à la
  main.** Ne JAMAIS ajouter une dépendance npm sans raison impérieuse.
  > ⚠ Ne pas dire « **zéro** dépendance runtime » : `package.json` en déclare
  > quatorze (Next, React, client Supabase, nodemailer, recharts, SDK IA…).
  > La formule courte est fausse et se vérifie en trente secondes — elle
  > décrédibiliserait tout ce qui l'entoure, à commencer par un dossier de
  > candidature. Ce qui est vrai, c'est que rien de ce qui touche la donnée
  > MÉTIER ne passe par un tiers.
- **Branche de travail** : `claude/crm-n8n-email-tracking-4qxtwr`. Commit + push
  systématiques. Tests : `npm test` (node:test). Types : `npx tsc --noEmit`.
  Les deux doivent être verts avant push.

## Ton
Brutalement honnête. Pas de flatterie, pas de « tu as raison ». Si un chiffre
est faux, une idée irréaliste ou un truc pas testé — le dire net. L'utilisateur
demande explicitement ça et il a besoin de **ventes réelles**, pas de démos.

### FIN DE CHAQUE RÉPONSE — trois blocs, rien d'autre (17/09/2026)
Toute réponse se termine par :

```
## CE QUE J'AI FAIT
- une ligne par chose livrée, le résultat d'abord

## À FAIRE — TOI
- les actions qui sont sur LUI, la plus bloquante d'abord

## ÉTAPE SUIVANTE
- UNE seule action, la prochaine
```

> ⚠ **Le premier bloc a été ajouté à sa demande**, et il ne dispense pas du
> corps de la réponse : le corps porte le RAISONNEMENT (ce qui a été mesuré,
> ce qui a été écarté et pourquoi), le bloc n'en porte que le RÉSULTAT. Les
> confondre donnerait soit un résumé qui ne prouve rien, soit un bloc aussi
> long que le texte — et dans les deux cas on ne lit plus ni l'un ni l'autre.

- **« À faire — toi » ne contient que ce qui est sur LUI.** Ce que j'ai fait moi va
  au-dessus, dans le corps de la réponse. Mélanger les deux fabrique une liste
  où il ne trouve plus sa part — c'est-à-dire une liste qu'on ne lit pas.
- **« Étape suivante » est UNE action, jamais deux.** Une liste de priorités
  n'est pas une priorité. S'il y a un ordre imposé (les 4 variables Vercel
  AVANT le SMTP, les secrets Vault AVANT la 004), c'est cet ordre qui décide
  laquelle est la prochaine — pas ce qui est le plus rapide à faire.
- **Zéro action sur lui ⇒ on l'écrit** (« rien sur toi »), on ne supprime pas
  le bloc. Un bloc absent et un bloc vide ne se lisent pas pareil : le premier
  ressemble à un oubli. Même mode de panne que le moniteur qui affiche du
  calme quand la base est morte.
- Il lit ça **au salon, sur un téléphone**, entre deux conversations. C'est ce
  qui impose la brièveté, pas une préférence de style.

## Les 2 comptes (portefeuille white-label) — `lib/accounts.ts`
Le compte MAÎTRE (EAGLEYE) est l'interface qui pilote tout. Basculer de compte
change l'identité + l'offre + la commission, **pas** les données.

| Compte | Ce qu'il prend | Ce qui NOUS revient |
|---|---|---|
| **EAGLEYE CORP** (maître) | **nos offres** : visibilité (sites, growth), **Alpha Sales OS** (VIP ou **à la carte**), **OS personnalisé**, digitalisation **< 40 k**, **Alpha Voice** | **100 %** |
| **Nuwacom** | chantiers **> 40 k** (sinon trop lourd pour nous) | **15 %**, puis **100 %** de la maintenance |

> ⚠ **ILS ÉTAIENT TROIS — 02/09/2026, l'accord ScintIA / Callflow est MORT.**
> Le compte a été retiré du portefeuille. Son offre, elle, n'est pas morte : le
> besoin ne dépendait pas de l'accord, et **Alpha Voice fait ce travail et il
> est à nous** — revenu chez EAGLEYE à **100 %** au lieu de 30 % + 10 %.
> · Le nom « Callflow » ne doit plus apparaître nulle part : c'était **leur**
>   marque. **`tests/marque-morte.test.ts` l'applique** — la règle est restée
>   écrite et non branchée pendant des semaines. Interdit : la marque dans une
>   **chaîne** (ce qui s'affiche, s'envoie, se stocke) et dans un **identifiant
>   de doctrine**. Autorisé : un **commentaire** qui explique pourquoi une garde
>   ou un repli existe — effacer ces noms-là laisserait des décisions sans leur
>   raison.
> · Leur grille (990 € + paliers 59/115/169/219/319) et leur cadence de
>   5 rappels ont été **remplacées le même jour**. Les sections « Tarifs » et
>   « Cadence de relance » plus bas font foi.
> 📦 Ce que sa mort a laissé traîner huit jours — doctrine qui se contredit,
> dix-sept traces de la marque, une famille de routage prescrite qui n'existait
> plus : `docs/ANGLES-MORTS.md`.

> ⚠ **Deux « 30 % » différents, ne jamais les confondre.**
> · Le taux d'un compte = ce qui NOUS revient. Sur EAGLEYE c'est **100 %** :
>   c'est notre société, il n'y a personne à qui reverser. Il ne descend sous
>   100 % que là où nous sommes **intermédiaires** — il n'en reste qu'un : Nuwacom.
> · Les **30 % + setup** de l'offre commerciale = ce qu'on **facture au
>   client** sur le CA qu'on lui fait gagner (`lib/pricing` → `REV_SHARE`).
>   C'est un PRIX, pas une commission reversée.

> ⚠ **LE DOSSIER D'UN PARTENAIRE NE DESCEND PAS DANS LE NAVIGATEUR.**
> `lib/accounts.ts` est importé par le store et cinq composants client : tout
> ce qu'on y écrit part dans un chunk `_next/static/**` que n'importe qui
> télécharge **sans compte**. L'entrée Nuwacom y portait ses deux domaines et
> un ICP COMPLET (acheteur, douleurs, déclencheurs, canaux, disqualifiants,
> angle) — notre travail de ciblage, public. Mesuré, pas supposé.
> · Ce qui vit désormais dans `lib/accounts-commercial.ts` (serveur, servi par
>   `/api/catalogue` au **maître seul**) : nom d'usage, domaines, proposition
>   de valeur, ICP, acte de closing — le champ `identite`.
> · Ce qui RESTE côté client : l'**id** et les **familles d'offres**. Elles
>   ROUTENT : les vider casse le périmètre d'offre, les rituels de closing,
>   le deep-dive et les segments — mesuré en les retirant, pas supposé. Sans
>   nom en face, « ce compte peut porter telle famille » ne dit rien.
> · Le **nom** reste aussi, faute de mieux : il est porteur dans une dizaine
>   de modules de routage. L'en sortir est un vrai refactor (l'identité
>   viendrait des Réglages, hydratés du serveur), pas une ligne.

**Règle de routage** : faisable par nous → EAGLEYE · > 40 k → Nuwacom.
Il n'y a plus d'exception par OFFRE : c'est la TAILLE qui sous-traite.

> ⚠⚠ **DEUX CRITÈRES, ET UN SEUL MORDAIT — réparé le 13/09/2026**
> (`lib/veille.ts`). Le **PRIX** était exécutable (`NUWACOM_THRESHOLD_HT`, lu
> par le calculateur). La **FAISABILITÉ** — « si un open-source ou nous-mêmes
> pouvons le faire vite → on le fait nous » — vivait dans une **chaîne** de
> `lib/accounts-commercial.ts`. Le défaut exact déjà payé par `forbidden` et
> par `structuralPain` : une règle juste, en prose, que rien ne pose.
> · **Les deux se contredisent.** Un chantier à 60 k qu'un outil libre règle en
>   une semaine : le prix l'envoie à 15 %, la faisabilité dit 100 %. **51 000 €
>   d'écart sur un seul dossier.**
> · **On NOMME le conflit, on ne tranche pas** (`arbitrage-humain`). Précédent :
>   `fit` vs `bloquant` dans `lib/opportunites.ts`. Un routage automatique
>   aurait choisi le critère le plus facile à coder — le prix — et sous-traité
>   à 15 % ce qu'on sait faire à 100 %.
> · **Deux questions distinctes** : *peut-on le FAIRE ?* (non ⇒ Nuwacom, quel
>   que soit le montant — aucun prix ne rend faisable ce qu'on ne sait pas
>   livrer) et *doit-on le PRENDRE ?* (taille et risque).
> · **L'effort cumule les bornes HAUTES.** Additionner les basses suppose le
>   meilleur des cas sur chaque brique en même temps — le biais qui fait tenir
>   un devis sur le papier et pas à la livraison. Et **une seule brique « à
>   construire » sort du régime rapide**, même courte : ce n'est pas sa durée
>   qui coûte, c'est son incertitude.
> · **`EFFORT_RAPIDE_MAX_JOURS = 10`** est une DÉCISION — deux semaines pleines
>   d'une seule personne, puisque l'installation se fait à la main et par une
>   seule personne.
> · **La table `CAPACITES` est VIDE, et c'est l'état honnête.** Une veille se
>   remplit en regardant ce qui sort, pas en écrivant de mémoire : des entrées
>   devinées qui ont l'air mesurées **routeraient de vrais dossiers**. Chaque
>   entrée portera son niveau de preuve (`mesure-maison` seulement après une
>   livraison réelle), et se décrira par sa **FONCTION** — un nom de produit
>   périme la table et décrit notre stack dans un dépôt public.

### L'ESCALIER — le check de CHAQUE prospect (`lib/ladder.ts`)
Cascade, pas aiguillage : un prospect peut déclencher plusieurs marches, et
chacune revient à un compte. On monte **une marche à la fois**, jamais tout d'un
coup.
1. **Visibilité** détectée → **EAGLEYE** (100 % — c'est nous).
2. **Volume de demandes très élevé** → **ALPHA VOICE / EAGLEYE** (100 %).
   *(Cette marche revenait à un revendeur à 30 % + 10 %. L'accord est mort ; la
   marche reste, le besoin n'ayant jamais dépendu de lui.)*
3. **Automatisation demandée en plus** → **EAGLEYE** (100 %). *Argument clé* :
   Alpha Voice est le **point d'entrée** — il capte l'info exacte sur chaque
   appelant, donc l'automatisation qui suit coûte **moins de setup** (les données
   sont déjà là, le process est cartographié). Cet argument n'est servi QUE si
   Alpha Voice est effectivement en amont.
4. **Trop gros pour nous (> 40 k)** → **NUWACOM** : le gros devis justifie les
   **15 %**, puis **100 % de toute la maintenance mensuelle**.

**Nuwacom** : `nuwacom.ai` (+ `nuwacom.fr` / `nuwacom.com/en`). CEO **Christophe**
(accord de principe donné). Fort en Allemagne + Benelux, **entre sur le marché FR**.
> ⚠ **Ce qu'ils vendent — corrigé le 15/10/2026.** Le dépôt les décrivait
> comme « refonte des parcours assurance », à Lyon. Leurs annonces disent :
> **plateforme IA d'entreprise** (connaissances internes, équipes et agents IA
> dans un même espace), pôle au Luxembourg orienté **secteurs régulés**.
> L'assurance reste la porte d'entrée ; l'angle devient « vos équipes utilisent
> déjà l'IA — sur quelles données ? ». Leur plateforme accepte des **serveurs
> MCP personnalisés** : Alpha peut s'y brancher (non testé).

**Le schéma convenu** : nous amenons le client → **visio de cadrage / chiffrage
à trois** (Christophe + client + nous) → **contrat de commission 15 % APRÈS** →
nous tenons le rôle de **PO pendant le delivery**. Le contrat se dresse **après
le cadrage** → levier de négociation. Doctrine :
**si un open-source GitHub ou nous-mêmes pouvons le faire vite → on le fait
nous** (meilleur levier) ; si trop lourd, ou si on leur a présenté et qu'ils
n'en veulent pas → on passe par leur plateforme.

## ⚠⚠ ALPHA EST HORIZONTAL — la cible est celle de l'INSCRIT (21/10/2026)
Décision de Zakaria : « il faut qu'Alpha soit utilisé par n'importe quelle
entreprise ». Objectif : 10 M d'utilisateurs. La cible permis n'est plus la
nôtre ; le module reste, comme **source** optionnelle (section suivante).

**LA RÈGLE : nos verticales, nos offres, nos marques, nos prix et notre
doctrine ne servent qu'au compte MAÎTRE.** Tout ce qu'un inscrit voit, dit ou
envoie vient de SON profil (`ProfilOperateur` : ce qu'il vend, à qui, où).
Le verdict « maître ? » vient du **serveur** (`resoudreDroits`) partout où il
décide de ce qui part ; `useDroits()` (optimiste) ne sert qu'à l'affichage.

Mesuré le jour même, en exécutant le vrai code — six endroits servaient NOTRE
produit à un inscrit qui vend autre chose :
| Ce qu'il voyait | Corrigé par |
|---|---|
| script d'appel = pitch Alpha Voice (« un accueil qui décroche ») | `lib/script-operateur.ts` (`scriptAServir`) |
| assistant d'appel / ALPHA LIVE soufflant nos réponses, notre « offre à pousser » | `OBJECTION_CUES.universel` (inventaire gelé) |
| emails signés « EAGLEYE CORP », notre aigle — dès qu'il saisissait son prénom | `habillageEnvoi({ maitre })`, refus 422 |
| prompts IA : « tu agis pour EAGLEYE CORP », escalier Nuwacom 15 %, nos offres | réglages d'usine vides · `REGLES_DE_METHODE` |
| démo d'accueil : huit promoteurs, nos campagnes, nos prix | `demoDeDepart` (six métiers, zéro montant) |
| fiche saisie à la main : « maîtrise d'ouvrage, Lyon, 290 €/mois » · aperçu de valeur sur nos offres | `nouvelleFiche` · `apercuInscrit` |

> ✅ **Fermé le 22/10/2026** : les **textes écrits** (invitation, message et
> relance LinkedIn, email, WhatsApp — `ExpediteurInscrit`, `approcheInscrit`)
> signaient du nom du COMPTE (« d'EAGLEYE CORP ») et posaient la question de
> NOS aimants ; ils se copient à la main, aucun serveur ne les relit. Les
> écrans les fabriquent désormais sur `useMaitreProuve` — **pessimiste** : dans
> le doute (réponse pas arrivée, panne), le texte s'écrit pour l'inscrit. Les
> **prompts IA** (`/api/ai`, `/api/agent`, `/api/icp`) : identité arbitrée par
> le serveur (`identiteServie`), ni nos familles, ni notre ICP, ni notre
> playbook — prouvé en interceptant le prompt réellement envoyé. Les
> **réglages persistés** d'un ancien navigateur sont purgés sur verdict serveur
> (`purgerIdentiteUsine`, monté dans la coquille).
> ✅ **Fermés le 22/10/2026 aussi** : la **fiche** (segment, deep-dive,
> escalier, devis, deck → une carte « ton offre » et le diagnostic seul) ;
> la **bibliothèque** (`lib/modeles-inscrit.ts`) ; le **sparring**
> (`lib/sparring.ts` — le prospect simulé était « un patron de commerce
> local » à qui l'on proposait NOTRE audit gratuit) ; les **prescripteurs**
> (`prescripteurPrompt(id, maitre)` et l'écran : un inscrit reçoit la peur de
> l'archétype et la règle, jamais nos ouvertures sur l'accueil téléphonique ni
> un potentiel chiffré sur notre setup — `PRESCRIPTEUR_UNIVERSEL`).
> Chacun prouvé par mutation, les routes en interceptant le prompt envoyé.
> ⚠⚠ **Ce qui se PRONONCE suit le verdict PROUVÉ, comme ce qui se copie**
> (22/10/2026, trouvé en filmant l'écran d'un inscrit) : `/appels`, ALPHA LIVE et
> l'aperçu de valeur lisaient `useDroits()`, optimiste — « maître » tant que la
> réponse n'est pas arrivée, et pour de bon si elle échoue. Selon le moment,
> l'inscrit recevait NOTRE script. Tout écran qui appelle `scriptAServir` ou
> `apercuInscrit` lit `useMaitreProuve()` ; la garde les TROUVE
> (`tests/script-operateur.test.ts`), elle ne les liste pas.
> ⚠ **Ce qui reste à nous, servi à un inscrit, et c'est voulu** : le groupe
> « Démo mobile » de la bibliothèque du MAÎTRE (il ne la voit pas), et les
> noms des modules (« Alpha Voice » est un écran du produit qu'il utilise).
> Pas balayé : les guides de page (`lib/page-guides.ts`) et `lib/os-map.ts`,
> qui décrivent notre méthode d'écran — à relire avec la même question.
> ✅ **La doctrine du MAÎTRE** (`DEFAULT_BUSINESS_RULES`) **dérive désormais ses
> prix** (22/10/2026) : elle récitait le forfait mort, l'offre « 1 000 appels »
> retirée et une fourchette à la carte périmée (AGENT ALPHA à 490), et visait
> un secteur à démarchage téléphonique interdit. Un test refuse le retour d'une
> offre retirée.

## TROUVER DES CLIENTS : LE REGISTRE OFFICIEL, PAR MÉTIER ET PAR ZONE (29/10/2026)
`/trouver` · `lib/trouver-clients.ts` · `lib/naf.ts` + `lib/naf-sous-classes.ts` ·
`lib/fusion-fiches.ts` · `tests/trouver-clients.test.ts`.

La promesse est qu'ALPHA trouve les clients pendant que l'inscrit travaille son
produit. Il ne trouvait rien : il triait ce qu'on lui donnait, et un inscrit sans
fichier restait devant un CRM vide. L'inscrit dit le métier de ses clients et la
zone ; le registre de l'État (`recherche-entreprises.api.gouv.fr`, sans clé)
rend des entreprises ACTIVES avec leur SIREN ; leurs annonces légales sont lues
au passage ; un clic les importe. **Gratuit, ouvert au visiteur sans compte.**
- **⚠⚠ Du NAVIGATEUR, jamais par notre serveur** (même règle que le BODACC) :
  une route à nous recevrait le métier et la zone que vise chaque inscrit. Un
  test refuse une recherche par activité sous `app/api/`. (`/api/onboarding/site`
  y lit le SIREN de l'inscrit LUI-MÊME : sa raison sociale, pas sa cible.)
- **Ce n'est pas un collecteur** : une requête au clic, une page de 25, vers un
  service public fait pour ça. `lib/registre-entreprises.ts` (l'appariement
  d'un import Maps) garde le choix inverse — 1 000 fiches = 1 000 requêtes.
- **⚠⚠ LE REGISTRE OUBLIE EN SILENCE UN FILTRE QU'IL NE CONNAÎT PAS** (mesuré :
  un paramètre inconnu rend les 10 000 premières entreprises du département).
  La lecture revérifie activité, zone et taille sur CHAQUE résultat ; ce qui ne
  correspond pas est écarté et compté, jamais importé.
- **Il ne donne ni téléphone ni email**, et l'écran le dit AVANT le premier
  résultat : la fiche arrive `a-joindre`, sans canal, sans nom deviné (le
  dirigeant déclaré va dans les notes ; ni date de naissance ni nationalité).
- **La zone est un CODE** (département ou codes postaux, jamais les deux),
  « 10 000 » se dit « 10 000 ou plus », une panne est `non-lu`, une société en
  liquidation n'est PAS importée, le non-diffusible ne se nomme pas.
- **La table NAF est celle de l'INSEE, vérifiée par empreinte** (732 lignes) ;
  `METIERS` relie les mots de tous les jours à des codes que le test cherche
  dans la table. Un métier non prévu se trouve dans les libellés officiels.
  ⚠ Vu au rendu : « plombiers » proposait la métallurgie du plomb — un radical
  commun n'est pas un métier, seul le pluriel l'est.
- **La fusion d'import est SIREN d'abord** (`memeFiche`) : deux SIREN différents
  sont deux entreprises, même homonymes (« GARAGE DU CENTRE » écrasait l'autre).
- **⚠ NAF 2025 au 1ᵉʳ janvier 2027** (`BASCULE_NAF_2025`) : le filtre lit la
  rév. 2, aucun filtre NAF 2025 n'existe aujourd'hui (mesuré). Après la date
  l'écran prévient ; si le registre bascule, il répond 400 et l'écran le dit.
- **Le numéro et l'email** : fermé le même jour par le pilote automatique
  (Dropcontact avec la clé de l'inscrit, section suivante).

## ⚠⚠ ALPHA FAIT TOUTE LA CHAÎNE — LE PILOTE AUTOMATIQUE DE L'INSCRIT (29/10/2026)
`/autopilote` · `lib/autopilote-inscrit.ts` (décide) · `components/autopilote/moteur-autopilote.tsx`
(exécute, monté dans la coquille) · `lib/enrichissement.ts` · `lib/imap-lecture.ts` +
`lib/mime-lecture.ts` · `app/api/reponses` · `lib/reponses-inscrit.ts` · `tests/autopilote-inscrit.test.ts`.

Décision de Zakaria : « ALPHA doit tout faire ». La chaîne existait — pour NOTRE
compte seulement (ticks serveur sur notre pipe, notre boîte, n8n). Pour un inscrit,
elle est rebâtie sur SES outils : registre (navigateur) → coordonnées Dropcontact
(navigateur, SA clé) → premier message depuis SA boîte (`/api/send`, autonome) →
lecture de SA boîte (`/api/reponses`) → trois créneaux numérotés → « 2 » pose le
rendez-vous + invitation `.ics` → relance seulement avec une raison neuve.
- **⚠⚠ L'onglet ouvert reste la frontière** (décision du 21/10) : un passage
  toutes les 3 min tant qu'ALPHA est ouvert. L'écran le dit ; rien ne prétend la nuit.
- **Dropcontact du navigateur** : préflight CORS vérifié (notre origine,
  `x-access-token`). La clé vit HORS du magasin (`lib/cle-locale.ts`) — le magasin
  s'exporte et se synchronise. Email `nominative@pro` puis `generic@pro`, JAMAIS
  `@perso` ni `catch_all`. Non testé contre le vrai service (payant, pas de clé ici).
- **⚠⚠ Un contact va à la fiche que son SIREN désigne** (`associerContacts`) — vu au
  rendu : associer par position aurait posé l'email d'une société sur une autre.
- **IMAP fait main, `EXAMINE` (lecture seule)** : rien marqué lu, déplacé, effacé ; seul
  le corps des expéditeurs listés est rapatrié ; rien stocké. Le serveur IMAP vient
  d'une table par SMTP (de mémoire, la connexion tranche) ; un serveur saisi doit
  être du MÊME domaine (sinon son mot de passe partirait n'importe où). **NOTRE boîte
  ne se lit que pour le maître.** Microsoft refuse la lecture par mot de passe : dit.
- **L'historique cité est coupé** avant de classer : notre « STOP » et nos « 1. 2. 3. »
  seraient relus comme sa réponse.
- **Le classement sans modèle est ÉTROIT** : refus > prix > signature > doute >
  choix de créneau > oui > question > `hors-sujet`. Le prix, la signature, le doute et
  tout ce qui est ambigu REMONTENT (tag `reponse-a-traiter` + étape datée). Une
  réponse aux créneaux qui n'en choisit aucun remonte : on ne réserve pas une heure
  mal comprise. La table de `reponse-auto` est réutilisée ; ses TEXTES (notre offre)
  ne le sont pas — un inscrit répond sur SON profil, et sans profil la question remonte.
- **Gardes** : tout part en `autonome` (divulgation IA dans le corps) ; hors fenêtre
  utile il lit sans écrire (une réponse qui demande un envoi attend la fenêtre sans
  être marquée vue) ; le palier du SERVEUR gagne (429 ⇒ suspension) ; jamais à une
  fiche de DÉMO (vu au rendu : le 1er envoi partait vers le jeu d'accueil), ni à qui a
  refusé, est liquidé, a déjà reçu un message ou attend l'humain ; une cible épuisée
  n'est relue que le lendemain (vu au rendu) ; le mur de stockage est consulté avant
  d'importer ; budget Dropcontact par jour.
- **Prouvé au RENDU** (build de production, Chromium, horloge accélérée, services
  extérieurs simulés) : registre → 3 entreprises → coordonnées (ordre inversé, bien
  associées) → 3 premiers messages → « oui » → 3 créneaux → « 2 » → RDV + `.ics`.
  **25 mutations mordent.** Non prouvé : un vrai Dropcontact, une vraie boîte IMAP.
- **Compte maître** : son autopilote SERVEUR (`/api/autopilote`, Pilote) existe déjà ;
  l'écran le prévient de ne pas lancer les deux sur les mêmes fiches.

## LE SIGNAL DE TOUTE ENTREPRISE : LES ANNONCES LÉGALES (22/10/2026)
`lib/signaux-publics.ts` · `lib/siren.ts` · `components/prospects/signaux-publics-panel.tsx` ·
`components/appels/annonces-de-la-file.tsx` · `tests/signaux-publics.test.ts`.

Après la bascule horizontale, un inscrit n'avait plus aucun signal (le permis
ne dit rien d'un garage). Le BODACC dit, pour toute société, par son SIREN :
**qui ne pas appeler** (procédure collective < 24 mois, radiation non suivie
d'une recréation, dissolution — exclusion SÈCHE, comptée et nommée) et **quand appeler**
(nouvelle direction, déménagement, rachat ou fusion, création, capital,
activité, nouveau nom — frais < 60 j, la fiche remonte en tête).
- **⚠⚠ QUATRE endroits posent « peut-on le démarcher ? », et tous lisent
  `exclusionPublique`** : la file humaine (`dansLaFile`), le robot
  (`buildCampaignRun`), la routine du matin (`computeRoutines` — une seule
  routine « à trancher », priorité moyenne) et les brouillons de campagne
  (`prepareCampaignDrafts`, `skipped` + raison). Les deux derniers ont été
  trouvés AU RENDU : la file écartait la société pendant que la bande « ALPHA
  a besoin de toi » demandait de lui « poser un next step ». Les brouillons
  ignoraient aussi `aRefuseTouteRelance` — corrigé le même jour.
  ⚠⚠ **Et la RELECTURE** (trouvé en tournant le spot TV, même jour) : la raison du
  brouillon mis de côté ne s'affichait jamais (l'adresse passait devant), et un
  clic sur « Ignoré » le remettait dans la pile à ENVOYER. `raisonDeNePasEcrire`
  (`lib/ne-pas-ecrire.ts`) est la seule définition : la préparation l'écrit, la
  relecture la MONTRE, verrouille le brouillon, et la redemande au moment de
  partir — un brouillon d'hier ne sait rien de l'annonce lue ce matin.
- **Le fait choisit le MOMENT, il ne se dit pas** — même interdit que citer
  son permis à froid. `phraseDuMoment` porte la consigne dans la phrase.
- **⚠⚠ LA LECTURE PART DU NAVIGATEUR, jamais par notre serveur.** L'API répond
  `access-control-allow-origin: *` et la CSP laisse sortir `https:`. Une route
  à nous aurait reçu la liste des SIREN d'un inscrit, c'est-à-dire son pipe.
  Un test refuse toute mention du BODACC sous `app/api/`.
- **Rien n'est deviné** : SIREN exact, jamais un nom. Panne → `non-lu`, jamais
  une lecture vide (qui se lirait « saine »). Clé de Luhn fausse → `invalide`,
  sans requête. **`000000000` passe Luhn et porte 1 563 annonces** au BODACC
  (remplissage) : refusé partout, cadence légale comprise.
- **Mesuré sur de vraies annonces avant d'écrire les tests** (bac à sable,
  rien commité) : « immatriculation » = déménagement hors ressort, pas une
  création ; « Modification du capital » ne dit pas son sens ; une vente ou
  une fusion range parfois l'ABSORBÉE en tête du registre — c'est la liste des
  anciens propriétaires qui tranche. 22 mutations mordent.
- **Fixtures** : SIREN de test HORS registre (vérifiés au BODACC et au registre
  national). Un numéro à 9 chiffres qui passe Luhn appartient presque toujours
  à une vraie société — cinq sur cinq au premier essai.
- **Les fenêtres (24 mois, 180 j, 365 j, 60 j, 30 j) sont des DÉCISIONS.**
- **Reste** : la plupart des fiches n'ont pas de SIREN, et on ne le devine pas.
  Le retrouver par la recherche publique AVEC confirmation humaine est le
  chantier suivant. Quota de l'API : 5 M d'appels/jour pour TOUT le domaine.

## LE MODULE PERMIS — ex-cible (09/09 → 21/10/2026), désormais une SOURCE parmi d'autres
`lib/permis-construire.ts` · ICP dans `lib/accounts-commercial.ts` (serveur) ·
`docs/PERMIS-LYON.md`. Tout ce qui suit reste **vrai du module** : un export
de permis importé est encore reconnu et trié ainsi. Ce n'est plus la cible du
produit, ni le contenu de la démo d'accueil.

**Le maître d'ouvrage PROFESSIONNEL dont le permis de construire est actif, en
Auvergne-Rhône-Alpes** (Lyon + Villeurbanne seuls jusqu'au 30/09/2026). ICP à **déclencheur**, pas à secteur : « les
promoteurs » dit QUI, un permis dit QUI **et** OÙ EN EST l'affaire au mois près
— donc **quand** appeler. L'arrêté est public, daté, vérifiable.

> ⚠ **« Maître d'ouvrage » est un RÔLE juridique, pas un métier.** Le même
> export contient le promoteur qui bâtit 68 lots POUR LES VENDRE, le bailleur
> social qui construit pour ATTRIBUER, la commune qui bâtit une école, et le
> couple qui fait construire sa maison — ce dernier étant le **gros du
> volume**. Les trois derniers n'ont **rien à vendre**. Et le couple est un
> **consommateur** : le décret n° 2022-1313 s'applique, et c'est nous qui
> portons le risque. Le tri sort ces cas par **exclusion sèche**, jamais par un
> score qui pourrait les rattraper.

- **La zone est une exclusion**, pas dix points de score (`zoneDuPermis`,
  `DEPARTEMENTS_ZONE`). Un bon permis hors zone sortait *retenu* et rien ne le
  disait. Les hors-zone se comptent à part des « rien à vendre » : le premier
  veut dire « refiltre à la source », le second est le fonctionnement normal.
  > ⚠⚠ **ÉLARGIE À AUVERGNE-RHÔNE-ALPES le 30/09/2026** (décision de Zakaria).
  > Mesuré sur Sitadel : Lyon + Villeurbanne donnait une file trop courte pour
  > apprendre quoi que ce soit ; la région, 842 groupes sur 24 mois. **Ce qu'on
  > perd** : « je suis à Villeurbanne, votre programme est à trois rues » ne
  > vaut plus qu'à Lyon. Ailleurs on est « de la région » — vérifiable, plus
  > faible. Le message ne doit pas prétendre plus.
  > ⚠⚠ **Le département se lit sur un CODE, jamais sur un nom** : code postal
  > ou INSEE (commune, puis adresse), puis numéro d'arrêté (`PC 069…` → 69).
  > « Saint-Priest » existe dans trois départements. Lyon et Villeurbanne
  > restent reconnus au nom (ancrage en début de libellé, jamais un
  > `includes("lyon")` — « Lyons-la-Forêt » est dans l'Eure). Un autre nom
  > SANS code → `manque`, jamais une exclusion ; commune **absente** ≠ hors
  > zone. Seul un code qui PROUVE un autre département exclut.
  > ⚠ **Élargir la zone a ouvert un trou, fermé le même jour** : les offices
  > « X Habitat » de la région (Isère Habitat, Auvergne Habitat…) portent une
  > catégorie juridique générique dans Sitadel et aucun sigle — ils sortaient
  > retenus. `BAILLEURS_REGION` les liste NOM PAR NOM ; « habitat » seul reste
  > interdit (SMART HABITAT, DH HABITAT sont des promoteurs). Et le motif se
  > lit sans accent ni point (« HABITATIONS A LOYER », « H.L.M. »).
- **Sous 6 logements, on n'exclut pas — on dit disproportionné.** 10 000 € d'OS
  de vente sur trois lots est une part indécente du budget de
  commercialisation. C'est **Alpha Voice seul** qui se propose là.
- **La phase décide de l'angle** : recours (< 2 mois) → se faire connaître,
  **ne rien vendre** · pré-commercialisation (2-12 mois) → la meilleure fenêtre
  · > 12 mois sans chantier → le signal le plus fort **et le plus ambigu**
  (l'opération peut être morte : le premier appel sert à le vérifier, rien
  d'autre) · chantier → queue de programme.
- **Canal par défaut : LinkedIn.** Un export de permis ne porte **aucun
  numéro** ; mettre « tel » ferait entrer la fiche dans la file d'appels où
  elle resterait muette. Le téléphone se relève **à la main** — troisième
  colonne.
- **Zéro permis converti à ce jour.** 6 logements, score 55, les poids par
  phase : ce sont des **décisions**, pas des mesures.

> ⚠⚠ **L'ICP DOIT CROULER SOUS LA DEMANDE — pas en chercher** (13/09/2026).
> C'est la règle qui décide si le prospect peut **payer**, et elle n'était
> écrite nulle part dans le code.
> · Qui **manque** de demande a besoin de CLIENTS. On serait son seul espoir,
>   sur un budget qu'il n'a pas, avec une promesse qu'on ne tient pas — **Alpha
>   ne crée pas de marché, il empêche de perdre ce qui arrive déjà.** Le jour
>   où ça ne marche pas, il n'a pas perdu un outil : il a perdu sa dernière
>   chance. C'est le pire client possible, et c'est celui qui dit oui le plus
>   vite.
> · Qui **croule** a déjà l'argent, et sa douleur est datée : les contacts
>   qu'il n'a pas rappelés existent, il peut les compter.
> ⚠ **La règle était déjà là, EN PROSE** : `structuralPain` de la verticale
> maîtrise d'ouvrage dit « des centaines de contacts acquéreurs, une ou deux
> personnes dédiées ». Invisible pour le code — le défaut exact que `forbidden`
> a payé dans `lib/playbook.ts`.

- **`LecturePermis.demande`** (`saturee` · `faible` · `inconnue`) **nomme** la
  question au lieu de la noyer dans le score. Le nombre de logements ajoutait
  15, 25 ou 30 points et disparaissait dans un total : une opération de huit
  lots et une de soixante sortaient au même score, pour des raisons opposées.
  **Un score agrège ; une décision d'ICP se nomme.**
  > ⚠⚠ **DEUX SEUILS, DEUX QUESTIONS**, longtemps confondus par commodité :
  > `LOGEMENTS_MIN` (6) demande « le **PRIX** est-il proportionné ? » ;
  > `SATURATION_LOGEMENTS` (20) demande « y a-t-il plus de **contacts que de
  > bras** ? ». Entre les deux, le prix tient et la douleur n'existe pas — on
  > vendait quand même « vos acquéreurs refroidissent » à dix lots.
  > **20 est une DÉCISION**, aucune vente ne l'a validée.
  > ⚠ **`inconnue` n'est PAS `faible`.** Une colonne manquante ne dit pas que
  > l'opération est petite ; les confondre amputerait la file sans que
  > personne sache pourquoi.
- **On COMPTE, on n'exclut pas.** Mesuré sur le jeu de démonstration : 8
  retenus, dont **2 sous le seuil**. Le résumé d'import le dit en clair. Exclure
  sur un chiffre que personne n'a validé amputerait la file d'un quart sur une
  intuition — le jour où un maître d'ouvrage dit « à douze lots je suis déjà
  noyé », ce compteur devient une exclusion, en une ligne qui se voit au diff.

### L'ESCALIER ÉTAIT AVEUGLE À NOTRE MARCHÉ — réparé le 13/09/2026
`demandEvidence` (`lib/ladder.ts`) ne détectait la saturation **que** par
`missedCallsPerWeek`. Sur une fiche issue d'un permis, ce champ est vide : la
marche « volume de demandes » ne se déclenchait **jamais** sur le marché qu'on
prospecte depuis le 09/09. Rien ne tombait — le détecteur rendait une liste
vide, ce qui ressemble trait pour trait à « ce prospect n'a pas de problème ».

- **`DeepAudit.lotsACommercialiser`** porte la saturation, **structurée**. Le
  nombre de lots survivait déjà dans les **notes**, en texte libre : le lire par
  motif aurait été la devinette que ce dépôt refuse partout (« la verticale se
  lit sur le tag, pas sur le texte »). `deepAudit` porte déjà les nombres
  MESURÉS et importables — un lot lu sur un arrêté public en est un.
- **⚠⚠ LA PREUVE SEULE NE SUFFISAIT PAS.** Le `pitch` de la marche était FIGÉ
  sur « chaque appel manqué est un client qui appelle le concurrent » — la
  phrase exacte que la verticale INTERDIT. Brancher la détection sans toucher
  au pitch aurait produit le pire résultat possible : **la marche se déclenche
  à raison et sert la phrase qui fait raccrocher.** La preuve et la phrase
  viennent désormais de la même source (`PITCH_DEMANDE`), sinon l'une des deux
  ment.
- **Le nombre de lots entre dans la PREUVE, jamais dans la PHRASE.** Le second
  interdit de la verticale refuse de citer permis, adresse ou nombre de lots à
  froid — « la donnée est publique, mais l'annoncer sonne fliqué. Elle sert à
  CHOISIR qui on appelle, pas à ouvrir l'appel. »
- **Le seuil est IMPORTÉ** de `permis-construire`, jamais recopié : deux
  définitions de « croule-t-il ? » feraient dire « demande faible » à l'import
  pendant que l'escalier proposerait la marche.

> ⚠⚠ **LE SIXIÈME TEXTE QUE PERSONNE NE RELISAIT.**
> `tests/playbook-interdits.test.ts` auditait « les CINQ textes que l'offre
> fait dire » plus le script assemblé. Les `pitch` de l'escalier s'écrivent
> entre guillemets et se PRONONCENT : c'est un sixième, et il portait déjà la
> phrase refusée. Elle ne s'était jamais servie pour une raison qui n'est pas
> rassurante — **un bug la masquait**. Elle est maintenant croisée contre les
> motifs exécutables, sur un prospect de chaque famille.

> ⚠⚠ **J'AI TESTÉ LES MAILLONS, PAS LA CHAÎNE — et la mutation l'a dit.**
> Après avoir réparé l'escalier, j'ai retiré `lotsACommercialiser` de la
> conversion d'import : **aucun test n'est tombé**. La fiche ne portait plus la
> saturation, l'escalier redevenait aveugle, et trois tests verts l'affirmaient
> réparé. Un test part désormais d'un **arrêté** et va jusqu'à **la phrase
> prononcée** ; retirer n'importe quel maillon le fait tomber.
> Mesuré sur le jeu de démonstration : **6 des 8 retenus** déclenchent la
> marche, les 2 sous le seuil ne la déclenchent pas.

> ⚠ **La phrase « appels manqués » n'est pas supprimée du produit**, et un
> contre-test l'exige : elle est fausse SUR CETTE VERTICALE, pas dans l'absolu.
> Un garage qui ne décroche pas perd vraiment le client au profit du suivant.

### ⚠⚠ NOS 8 FICHES ICP SUR 8 PARTAIENT SUR LA MAUVAISE OFFRE (17/09/2026)
`lib/mesure-champ.ts` · `lib/offer-match.ts` · `tests/routage-offre-verticale.test.ts`.

Mesuré de l'arrêté jusqu'à l'aimant servi : les huit permis retenus recevaient
**Visibilité / Growth**, alors que la verticale `maitrise-ouvrage` sert l'OS de
vente. Le message d'approche s'ouvrait donc sur « quelqu'un qui cherche du neuf
dans le quartier tombe sur votre programme » — un sujet qu'on n'avait relevé
sur aucune de ces fiches.
- **UN GARDE ÉCRIT SUR UN ÉTAT QUE LE TYPE REND IMPOSSIBLE.** `matchOffer`
  testait `websiteState !== undefined`, avec en commentaire l'intention exacte
  (« on ne score que ce qui est mesuré »). Mais `DeepAudit` déclare ce champ
  `string` OBLIGATOIRE et **`prospectDefaults.deepAudit` — le socle de TOUS les
  imports — écrit `""`**. Le champ est donc toujours défini, et `weakWebsite("")`
  rendait `true` : +3 « site absent ou obsolète » sur chaque fiche importée.
  Même famille que `AngleKey = Exclude<Sector, "autre">` : un type qui rend
  fausse la garde écrite à côté de lui.
- **ET L'ESCALIER RÉPONDAIT JUSTE SUR LES MÊMES FICHES** (`filled()` avant de
  conclure). Deux définitions de « son site est-il un problème ? », deux
  réponses opposées, même produit, même fiche. `estMesure` n'en laisse qu'une ;
  les deux copies faibles qui survivent (`master-rappel`, `checkpoints`) sont
  **nommées avec leur motif**, parce que les basculer changerait des écrans que
  je n'ai pas mesurés.
- **⚠⚠ LA RÈGLE EST DISSYMÉTRIQUE EXPRÈS : un signal MESURÉ peut contredire la
  verticale ; un vide ne le peut pas.** Un maître d'ouvrage dont on a CONSTATÉ
  l'absence de site part sur la visibilité — 1re marche de l'escalier, même
  compte. Sans rien de mesuré, c'est `offreDeLaVerticale` qui tranche, au lieu
  d'un ordre de départage écrit en dur. `sansSignal` dit à l'appelant si le
  routage vient d'une observation ou d'un défaut : un angle mort se DIT.
- **⚠⚠ UNE MUTATION N'A PAS MORDU, ET C'EST LA LEÇON.** Débrancher la verticale
  du deep-dive laissait six tests verts : la maîtrise d'ouvrage sert
  `alpha-sales-os`, qui est AUSSI le défaut en dur — **l'assertion était
  satisfaite par une coïncidence du code existant**. Le test se joue désormais
  sur une verticale qui sert une autre offre.
- Mesuré : ICP réel **8/8 → 0/8**. Jeu de démonstration 5/8 → 4/8, et les 4
  restants sont des routages MESURÉS (31/18/14 appels relevés en audit sur
  place, un site constaté absent) — ils doivent rester, c'est la règle.

### LE SECTEUR NOMME LE MARCHÉ — et rien d'autre n'en dépend (11/09/2026)
`Sector` (`lib/types.ts`) était resté au marché d'AVANT deux jours après la
bascule. Faute de valeur pour le dire, `permisVersProspect` rangeait NOS fiches
dans `"autre"`, le fourre-tout.
- **Ce que ça coûtait** : `verticalForProspect` lit tag → texte → **secteur**.
  Une fiche qui perd son tag — un aller-retour par un tableur suffit — tombait
  sur `verticalForSector("autre")`, donc la verticale **générique**. Le script
  du marché en cours existait et était inatteignable par le seul chemin dont
  dispose un import plat. Le secteur est ce qui survit à un CSV ; le tag, non.
- **On n'a PAS recopié `TypeMaitreOuvrage`** ici. Promoteur / bailleur /
  collectivité / particulier répond à « a-t-il quelque chose à vendre ? », pas
  à « quel métier ? ». Deux axes. Le déverser aurait créé un **quatrième**
  vocabulaire en prétendant en réparer un second.
- **Les trois valeurs du marché d'avant restent** : elles portent des playbooks
  et des angles écrits. Ce qui les fait disparaître des écrans, c'est
  qu'aucune fiche ne les porte (`secteursPresents`, `lib/secteurs.ts`), jamais
  une suppression de vocabulaire.

> ⚠⚠ **`AngleKey` S'ÉCRIVAIT `Exclude<Sector, "autre">`, ET CE COUPLAGE ÉTAIT UN
> MENSONGE.** Il affirmait que TOUT secteur a un angle d'appel manqué. Ces
> gabarits font dire « des lots qui vont chez le concurrent qui répond » et
> « mettez vos horaires à jour » — la famille accueil téléphonique / visibilité
> locale. Laissé couplé, **ajouter le marché au type aurait FORCÉ, sous peine
> d'erreur de compilation, d'écrire pour la maîtrise d'ouvrage l'argument que
> sa propre verticale interdit.** Le type aurait exigé le mensonge.
> `AngleKey` est désormais une union EXPLICITE, et un test croise les deux
> côtés : aucun gabarit n'est engendré pour un secteur dont la verticale porte
> un interdit exécutable. Deux indices qu'il était déjà faux avant : la liste
> contenait `equipe-terrain` et `centre-appels`, qui ne sont pas des secteurs.

> ⚠ **L'ICP écrit et le code qui trie sont DEUX endroits qui posent la même
> question.** `tests/permis-construire.test.ts` rejoue chaque disqualifiant
> annoncé dans `lirePermis` — reformuler est libre, retirer du code ne l'est
> pas. Une prose qui dérive du code ne casse rien : elle ment, à l'endroit
> précis où quelqu'un vient chercher la règle.

### CE QUE LE SCRIPT A LE DROIT DE DIRE (`InterditFroid`, `lib/playbook.ts`)
Chaque verticale déclare ses **interdits d'appel à froid**. Sur la maîtrise
d'ouvrage, le premier est : « **Vous ratez des appels** » — faux ici, et ça
prouve qu'on n'a pas compris le métier. Sa perte, ce sont des **acquéreurs déjà
rencontrés que personne n'a rappelés**.

> ⚠⚠ **UNE RÈGLE ÉCRITE EN PROSE N'EST PAS UNE RÈGLE.** `forbidden` était un
> tableau de chaînes — invisible pour le code — pendant que le catalogue
> d'offres faisait prononcer l'argument qu'il interdit, dans le MÊME prompt.
> · Chaque interdit porte désormais, **dans la même entrée**, la `regle`
>   lisible ET son `motif` exécutable. Deux listes divergeraient, et c'est
>   celle qu'on ne relit pas qui cesserait de mordre.
> · `motif` est **absent** quand l'interdit relève du jugement (« citer son
>   permis à froid ») — un motif approximatif produit des faux positifs
>   jusqu'à ce que le garde entier soit désarmé.
> · `tests/playbook-interdits.test.ts` croise les interdits contre les CINQ
>   textes que l'offre fait dire, **et** le script assemblé.
> ⚠ Le motif a dû être corrigé **deux fois par MUTATION, pas par relecture** :
> **un garde par motif n'attrape que ce qu'on a déjà vu**, il se rouvre à
> chaque tournure neuve. 📦 Détail : `docs/ANGLES-MORTS.md`.

### LA VERTICALE SE LIT SUR LE TAG, PAS SUR LE TEXTE (`verticalForProspect`)
Ordre : **tag → texte → secteur**. Un tag posé par l'importeur est
DÉTERMINISTE ; un mot dans une note est une devinette qui se trompe en silence.

> ⚠ Mesuré : les huit fiches de maîtrise d'ouvrage tombaient toutes sur la
> verticale **AUTO-ÉCOLE** — le mot « Permis » de leurs notes la déclenchait.
> En production, la file du matin aurait servi le script du moniteur de
> conduite à des directeurs de programmes. Aucune erreur, aucun log.
> · Un motif d'appartenance exige un **contexte**, jamais une liste
>   d'exceptions : elle est toujours en retard sur la façon dont les gens
>   écrivent.
> · « permis » NU est **ambigu** et ne rattache à rien. Les deux erreurs ne
>   coûtent pas pareil — rater une auto-école coûte un rattachement, servir son
>   script à un promoteur coûte l'appel et la crédibilité.
> · La règle existait déjà pour le Cerveau (« verticale par tag, jamais par
>   ressemblance de mots ») : elle n'était branchée qu'à un endroit.

> ⚠ **L'ICP a déménagé** de `IdentiteCompte` vers `AccountCommercial`.
> `identite` n'existe que pour les comptes PARTENAIRES (la marque qu'on
> masque) — le compte MAÎTRE était donc le seul du portefeuille sans client
> parfait déclaré, faute d'endroit où l'écrire. « Quelle marque parle ? » et
> « à qui on écrit ? » sont deux questions distinctes ; la seconde n'a aucune
> raison d'être conditionnée à la première. Les deux restent **serveur**.

### Le jeu de démonstration EN DESCEND (`lib/seed.ts`)
> ⚠ **Depuis le 21/10/2026, ce jeu n'est plus la démo d'accueil** : un
> navigateur neuf part de `demoDeDepart` (`lib/demo-icp.ts`). Il reste le banc
> d'essai du module permis — d'où les tests qui le rejouent.

Il décrivait encore un bouchon, un pub irlandais et deux sociétés
d'ambulances — le marché d'AVANT. Le premier bouton de l'app étant « Explorer
la démo », **la première chose qu'un prospect apprenait du produit décrivait
une cible qu'on ne prospecte plus.**
- Chaque fiche déclare son arrêté dans `PERMIS_DEMO` ; `tests/seed-moa.test.ts`
  le rejoue dans le **vrai** `lirePermis`. Une démo qui contredirait le module
  de ciblage montrerait exactement ce que le produit refuse de faire.
- Le lot garde **3 arrêtés écartés** (particulier · hors zone · périmé) : « 8
  fiches » ne dit rien du travail fait, « 8 retenus sur 11 » le dit.
- Les **quatre garanties** du jeu engendré valent maintenant des deux côtés :
  préfixe `demo-` · plages ARCEP fiction · domaines **RFC 2606** (il portait des
  `.fr` INVENTÉS, déposables par n'importe qui demain) · « (démo) » dans le nom.
- **Aucun montant recopié** : les prix viennent de `lib/offres-publiques.ts`.

> ⚠ **La preuve sociale fabriquée passait par des NOMS, pas par des
> possessifs.** L'ancien jeu portait une chaîne de recommandation complète, et
> le générateur d'aimants dictait quatre études de cas chiffrées.
> `tests/preuve-sociale.test.ts` ne les voyait pas : son motif cherche « nos
> clients » / « qu'on équipe », et une **référence nommée n'en porte aucun**.
> C'est la forme la plus convaincante des trois, et la seule qu'aucun garde ne
> tenait. 📦 `docs/ANGLES-MORTS.md`.
>
> ⚠⚠ **ELLE EST RESTÉE NON BRANCHÉE, ET VOICI CE QU'ELLE A LAISSÉ PASSER :**
> « et c'est ce qui a **converti** la \<enseigne réelle\> », recopiée dans
> **cinq** fichiers dont `lib/os-map.ts` et `lib/voice-script.ts`, qui
> alimentent les prompts. **Deux fautes en huit mots** : elle nommait une
> entreprise réelle dans un dépôt public, **et elle était fausse** — la fiche
> est au stade `offre`, `JUILLET_REEL.gagnes` vaut **0**. Rien n'a jamais été
> signé. `docs/POST-LANCEMENT-VERITE.md` avait relevé la contradiction sans
> pouvoir la trancher ; la donnée l'a tranchée.
> · **Quatrième famille** désormais armée : la conversion **attribuée à un
>   nom**. Les trois motifs existants cherchent un possessif, un « on » nu ou
>   une troisième personne collective — une conversion attribuée à un nom
>   propre n'en porte **aucun**.
> · Le motif exige un **nom propre derrière le verbe** : « taux de conversion »
>   et « convertir un prospect » restent du vocabulaire de vente légitime. Il a
>   mordu au premier passage sur une phrase honnête du README (« consentement
>   du **client depuis** SON compte ») — resserré le jour même, jamais la
>   phrase juste reformulée.
> · Ce qui remplace, et qui tient debout seul : l'ordre « émotion avant prix »
>   est une **décision de méthode**, pas un résultat mesuré.
>
> ⚠ **Cinquième forme, relevée le 30/09/2026 : le VERBE.** « Je travaille
> avec les promoteurs de la région » se lit « j'ai des promoteurs pour
> clients » — à zéro client, c'est faux. Elle partait par les quatre
> générateurs écrits (invitation et message LinkedIn, email, forme courte).
> Une seule phrase désormais, `phraseCritere` (`lib/approche-ecrite.ts`) :
> « je m'adresse aux … » garde le critère choisi sans rien affirmer, et
> `tests/linkedin.test.ts` refuse le retour de la tournure dans le texte
> ENVOYÉ. **Tranché le même jour pour l'ORAL aussi** (décision de Zakaria) :
> les 13 répliques d'appel du playbook, l'argumentaire, le script
> d'ouverture des modèles, le pitch terrain et celui des prescripteurs.
> `tests/preuve-sociale.test.ts` porte désormais le motif du verbe, et sa
> liste de rédacteurs inclut le playbook — il n'y était pas, c'est pour ça
> que la tournure y avait survécu. Les objections (`q:`) sont exclues : c'est
> le PROSPECT qui parle de SES clients.
> Et sa cousine, l'**EXPÉRIENCE affirmée** (« chez vos confrères, on retrouve
> toujours… », « la plupart des … du coin ») : retirée des modèles le même
> jour, motif ajouté au même test. On POSE la question, on ne la tranche pas.
> Puis deux formes de plus, trouvées en balayant le dépôt : la **clientèle au
> présent** (vitrine : « on installe peu de clients à la fois » → au FUTUR, la
> règle est vraie, la clientèle n'existe pas encore) et l'**observation de
> marché inventée** (consigne de relance J+60 du jeu de démo : « un constat
> frais — ce qu'on voit passer », qui contredisait `lib/raison-neuve.ts`).
> Le jeu de démo et la section de la vitrine n'étaient pas dans la liste du
> garde : c'est le fichier qui manquait, pas le motif.
> Même jour : une fiche de PERMIS ne cite plus sa commune dans l'invitation —
> c'est celle du chantier, donc l'interdit « citer son adresse à froid ».

## L'ICP EST LE CLIENT FULL-STACK, ET L'ABONNEMENT SE FACTURE AU SIÈGE (13/09/2026)
`lib/offres-publiques.ts` → `abonnementMensuel()` · `tests/tarif-sieges.test.ts`.

**Décision de Zakaria : on va chercher des clients qui prennent le PACK COMPLET.**
L'à-la-carte n'est pas supprimé — il reste servi et testé, et une offre portée
par une fiche signée ne s'efface pas — mais ce n'est plus ce qu'on va vendre.

```
Installation      10 000 € HT, une fois    (travail humain, fait à la main)
Socle plateforme     600 € HT/mois         (indépendant du nombre de têtes)
Par utilisateur       80 € HT/mois
Alpha Voice          à l'usage, INCHANGÉ   (149/349 + 0,20 €/min)
```

- **Le défaut corrigé** : `PACK_MONTHLY_HT` était un FORFAIT de 1 000 €/mois.
  Une société de trois personnes et une de trente payaient le même prix. Le
  relevé de marché l'avait nommé le 12/09 sans pouvoir le réparer — « c'est le
  vrai chantier de tarification, et il est plus grand que n'importe quel
  montant écrit ici ». C'est ce chantier.
- **⚠⚠ DEUX TERMES, ET LE SOCLE N'EST PAS UN ARRONDI.** Une partie de ce qu'on
  vend **ne dépend pas du nombre de personnes** : le moteur de conformité
  (art. 50, décret 2022-1313, fenêtres, mentions, palier d'envoi), le Cerveau,
  l'autopilote. C'est aussi **l'actif le moins copiable du produit** — le noyer
  dans un prix par tête le ferait disparaître de la négociation. Un prix par
  siège NU aurait en plus divisé le revenu par huit sur une petite équipe.
- **⚠⚠ ON NE FACTURE JAMAIS AU SIÈGE CE QUI REMPLACE UN SIÈGE.** Alpha Voice
  est hors formule, et un test l'interdit : il augmenterait avec le nombre
  d'humains alors qu'il sert à en avoir moins, et il perdrait son seul ancrage
  gagnant — **un SALAIRE** (~35-45 k€/an chargés), jamais un abonnement par
  utilisateur.
- **Neutre à la référence, et c'est vérifié** : `600 + 5 × 80 = 1 000`, soit
  exactement le forfait d'avant. Le passage au siège n'est pas une hausse
  déguisée en changement d'unité — la manœuvre qu'un client repère.
  Mesuré au rendu : `1 → 680 € (-32 %)` · `5 → 1 000 € (0)` ·
  `10 → 1 400 € (+40 %)` · `20 → 2 200 € (+120 %)` · `50 → 4 600 € (+360 %)`.
- **`PACK_MONTHLY_HT` est DÉRIVÉ**, jamais recopié : c'est la constante que les
  écrans affichent et la formule ce que le client paie. Deux nombres écrits à
  la main auraient divergé au premier ajustement, et c'est la vitrine — celle
  qu'on ne recalcule pas — qui aurait menti.
- **`SIEGES_REFERENCE` a DÉMÉNAGÉ** de `lib/marche.ts` vers les prix : tant
  qu'il n'était qu'une hypothèse de COMPARAISON, sa place était dans le relevé ;
  c'est devenu un paramètre de TARIFICATION. Un test refuse la redéclaration.
- **600 et 80 sont des DÉCISIONS**, pas des mesures — `gagnes: 0`. Le seul
  élément mesuré est la bande du marché par siège (14–79 €) : 80 € se pose
  juste au-dessus, parce qu'Alpha embarque Agent ALPHA et Alpha Live, dont la
  catégorie relevée commence à 250 $.
  > ⚠ **Et la formule est BRANCHÉE à un écran**, curseur compris
  > (`components/offre/calculateur-complet.tsx`). Sans ça elle aurait été un
  > export que personne n'appelle — le défaut récurrent du dépôt, commis par la
  > correction elle-même : une grille au siège inatteignable laisse le forfait
  > en place dans les faits tout en donnant l'impression qu'il a disparu. Trois
  > mutations le tiennent : curseur retiré · prix affiché figé à côté du
  > curseur · chiffrage qui ignore le nombre saisi.
  > ⚠ **Une saisie invalide ne fait pas tomber un chiffrage.**
  > `abonnementMensuel` JETTE sur 0 / décimal / négatif — juste pour une
  > facture. `chiffrer()` borne et **l'annonce dans les alertes** : l'écran sert
  > quelqu'un qui tape, et un champ vidé une seconde ne doit pas vider la page.
  > Mais corriger en silence ferait partir un devis avec un nombre que
  > personne n'a choisi.

### TARIFER CHACUN SUR CE QU'ALPHA LUI A RAPPORTÉ (`lib/valeur-produite.ts`)
Décidé le 13/09/2026. Le socle et le prix par siège sont des DÉCISIONS faute de
vente ; une cohorte d'utilisateurs gratuits est le seul instrument capable d'en
faire des mesures.

> ⚠⚠ **ET LE SERVEUR NE VOIT RIEN D'UN COMPTE GRATUIT.** Mesuré : aucune
> télémétrie, aucune table d'usage, et le CRM vit dans le `localStorage`
> (`pipeServeur` est opt-in). Pas une fiche, pas un RDV, pas un euro.
> **Ce n'est pas une lacune, c'est la promesse** — « rien de ce qui touche la
> donnée métier ne passe par un tiers » est l'argument de souveraineté qui
> tient la vitrine debout, celui qui a remplacé une affiliation inventée.
> Mesurer une cohorte se DÉCIDE ; ça ne se code pas en douce.

> ⚠⚠ **LE PIÈGE QUI DÉCIDE DE TOUT : indexer un prix sur un nombre que le
> client TAPE lui donne une raison d'en taper un plus petit.** Aujourd'hui il
> n'en a aucune. `part-resultat` le dit déjà pour la part au résultat (« celui
> qui paie contrôle le dénominateur ») ; ici ce serait pire — on fabriquerait
> l'incitation là où elle n'existe pas.
> · **`mesure-infra`** (emails de `/api/send`, minutes de `/api/voice/call`) :
>   compté chez nous, infalsifiable au bénéfice du client. **Seul facturable.**
> · **`declare-client`** (montants, stades, RDV) : utile pour lui montrer SA
>   performance, jamais une base de facture. Un test l'interdit, et un signal
>   inconnu n'est pas facturable par défaut — on n'ouvre jamais par omission.

- **Le partage porte des COMPTES, jamais du CONTENU**, et le garde vise le
  **TYPE** : toute `string` est refusée dans `PartageCohorte`, sauf le
  `tenantId`. Une liste de mots interdits avait mordu sur `emailsEnvoyes` (un
  compteur) et aurait laissé passer un `notesLibres`. Mesuré par mutation : un
  champ de contenu **optionnel** compile sans rien casser — c'est celui-là qui
  serait passé.
- **Rien ne sort aujourd'hui, et c'est le bon état.** `prixJustifie` est typé
  `null` LITTÉRALEMENT : « aucun poids ne s'auto-corrige » appliqué au type.
  Même sur 500 comptes, le module rend un verdict et l'humain change la
  constante — un ajustement automatique apprendrait le bruit de quarante
  comptes et le graverait dans la facture de tout le monde.
- **`COHORTE_MIN = 20`**, et le seuil se dit AVEC sa valeur. Sous ce nombre, un
  seul utilisateur très actif déplace la médiane.
- **« Rien ne remonte » ≠ « personne n'utilise »** (`etatDuDispositif`) — même
  mode de panne que le moniteur qui affiche du calme quand la base est morte.

> ⚠ **Ce que la décision « full-stack seulement » laisse ouvert, et qu'il faut
> trancher** : l'échelle du gratuit n'a plus de barreau intermédiaire. Un
> opérateur qui gagne ses premiers euros avec le socle gratuit fait face à
> 10 000 € + 680 €/mois — il n'y a rien entre les deux. Le gratuit était conçu
> pour « qu'il rapporte assez pour payer la suite » ; la suite vient de
> s'éloigner. Aucune vente ne dit encore si c'est un problème.

## Tarifs Alpha Sales OS (à refléter sur le site)
- **10 000 € d'installation + la grille au siège ci-dessus** (offre haute), OU
  **30 % + frais de setup** (local / cloud) sur devis. Ces 30 %-là sont un
  **PRIX facturé au client** (part de SON CA généré), pas une commission
  reversée — voir l'encadré plus haut.
- **Cadrage OBLIGATOIRE** avant devis : visio, appel ou SMS, avec **date + heure
  décidées** et validation de la suite côté Zakaria.
- **Prix à la carte par brique** : un client peut ne prendre qu'Alpha Voice.
  Il ne voit QUE sa brique ; nous voyons tout.
- **OS personnalisé** : un OS taillé sur le métier du client, pas une
  déclinaison du nôtre. Chiffré au cadrage.
- **Alpha Voice** — ⚠ **retirée de la vente en ligne le 20/10/2026** (voir « Deux
  formes ») : elle se vend installée chez le client. La grille ci-dessous reste
  la référence de coût et de marge. Grille DÉCIDÉE le 02/09/2026 (`lib/offres-publiques.ts`) :
  **1 490 € HT** de setup (relevé le 12/09, voir plus bas), puis **deux** paliers — **Essentiel 149 €/mois**
  (500 min, ~200 appels) et **Intensif 349 €/mois** (1 500 min, ~600 appels).
  Au-delà : **0,20 €/min** (descendu de 0,25 le 04/09/2026), pas de
  coupure, pas de palier à revendre.
  > ⚠ Ce qui a changé, et pourquoi — c'est le raisonnement qui compte, pas les
  > nombres : **cinq paliers font comparer les paliers entre eux** au lieu de
  > comparer à ce qu'il perd. Et le plancher passe de 59 € à 149 € parce que
  > **59 € ne couvrait pas le socle fixe (~57 €/mois)** : le palier d'entrée
  > était une perte déguisée en offre d'appel. Marges sur coût mesuré :
  > ~81 % et ~76 %. Un client Essentiel couvre désormais le socle à lui seul.
  > **Le coût/minute est mesuré ; les prix sont des DÉCISIONS** — aucune vente
  > ne les a validés. Le premier client qui refuse en disant pourquoi vaudra
  > plus que ce raisonnement.

### ⚠⚠ LE PIPELINE ENTIER ÉTAIT CHIFFRÉ SUR LA GRILLE MORTE (17/09/2026)
`lib/grille-perimee.ts` · `components/prospects/alerte-prix-perime.tsx` ·
`tests/grille-perimee.test.ts`.

Mesuré sur le pipeline réel : **16 fiches sur 16** portent `setupValue = 990`
et un mensuel pris dans `59 / 115 / 169 / 219 / 319`. C'est exactement la
grille remplacée le 02/09, puis réajustée le 12/09 — **les trois offres encore
sur la table comprises**. Écart sur le seul setup : 990 → 1 490, soit
**1 500 € sur trois dossiers**.
- **Le défaut de signature du dépôt, appliqué à l'argent** : une DÉCISION prise
  dans la doctrine qui n'atteint jamais la DONNÉE. Le Cerveau l'avait déjà payé
  (`sc-voix-tarifs`). Ici c'est pire — le Cerveau alimente un prompt, une fiche
  alimente un **devis**.
- **⚠⚠ ET LA DOCTRINE RÉPÉTAIT LE PRIX MORT.** « 3 fiches en offre (2 970 €) »
  revenait dans chaque compte rendu : 2 970 = **3 × 990**. Le chiffre qui
  servait à décider de la priorité était celui de la grille disparue. Une prose
  qui recopie un montant se périme sans bruit — la règle « ne jamais recopier
  une grille dans une prose » existait, et c'est le suivi qui l'a violée.
- **ON SIGNALE, ON NE CORRIGE PAS — l'inverse du cadrage.** Le cadrage BLOQUE
  un document ; ici on ne bloque rien et **aucun bouton ne propose de
  corriger** : un prix ANNONCÉ au prospect ne se réécrit pas en douce, ce
  serait renégocier sans le dire. « Aucun poids ne s'auto-corrige », appliqué
  à une facture.
- **⚠⚠ DEUX CERTITUDES, ET C'EST LA DATE QUI TRANCHE.** `datee` = la fiche n'a
  pas bougé depuis le remplacement, le montant vient de l'ancienne grille.
  `coincidence` = elle a vécu depuis, 115 €/mois peut être un choix assumé — on
  le dit, on ne l'affirme pas, et la phrase n'ordonne rien. Un garde qui crie
  sur une fiche juste est un garde qu'on désarme.
- **La dernière touche se lit sur les ÉVÉNEMENTS**, jamais sur un « modifié
  le » : ce dernier bouge au moindre clic, et une fiche figée depuis juillet
  passerait pour vivante — l'alerte perdrait sa force là où elle compte.
- **Les montants PÉRIMÉS se recopient dans ce module** (ils n'existent plus
  ailleurs, c'est le seul endroit légitime) ; les montants **EN VIGUEUR sont
  IMPORTÉS**, et un test refuse qu'ils soient écrits en dur ici.

### LE PRIX S'ANCRE SUR TROIS CHOSES, ET IL N'EN UTILISAIT AUCUNE (12/09/2026)
`lib/marche.ts` (le relevé) · `lib/positionnement.ts` (le rapprochement) ·
`lib/pricing-briques.ts` (le coût) · `tests/marche-briques.test.ts`.

Un prix s'appuie sur le **coût**, le **marché** ou la **vente**. État mesuré au
12/09 : le coût ne mord pas sur du logiciel (`pricing-briques` rend lui-même
`hors-regle` sur six briques), le marché n'était relevé pour aucune des dix
briques du catalogue à la carte, et la vente n'existe pas. **Six prix sur dix
ne venaient de rien.** `lib/marche.ts` existait depuis le 26/08 et
`positionnement` rapprochait les OFFRES — les BRIQUES, jamais.

- **⚠⚠ LE PIÈGE N°1 : le marché facture par SIÈGE, nous par COMPTE.** Passer
  « CRM 190 €/mois » et « Pipedrive 14–79 €/utilisateur » dans le même
  `comparer()` rend « ×2,4, HORS MARCHÉ » — une phrase juste sur deux
  grandeurs qui n'ont pas la même unité, et qui pousse à BAISSER un prix situé
  au milieu de sa bande. D'où `parSiege` + `comparerParCompte`.
  > ⚠ `SIEGES_REFERENCE = 5` est une **DÉCISION**. Le vrai défaut qu'elle
  > révèle est plus grand que n'importe quel montant : **le catalogue n'a pas
  > de dimension « siège »**, donc la grille est juste pour une seule taille
  > d'équipe et fausse pour toutes les autres. Le relevé ne le corrige pas, il
  > le rend visible.
- **Quatre prix ont bougé, et l'un BAISSE** — c'est ce qui prouve que le relevé
  n'a pas été fait pour justifier une hausse : Agent ALPHA 220 → **490 €**
  (il était sous le plancher d'une catégorie qui commence à 250 $, le premier
  concurrent sérieux étant à ~1 650 €) · Closer OS 140 → **190 €** (il était
  AU plancher) · tracking 140 → **120 €** (seul **au-dessus** de sa bande, sur
  la brique la plus facile à comparer du catalogue) · setup Alpha Voice
  990 → **1 490 €**.
- **Six prix ne bougent pas**, et ne rien faire est un résultat : ils sont au
  milieu de leur bande. Bouger un prix sans raison est du mouvement, pas du
  travail.
- **⚠⚠ DEUX ANCRAGES OPPOSÉS COHABITAIENT DANS LE DÉPÔT, à un facteur 15.**
  Mise en service d'un télésecrétariat : 100–300 €. Installation par une agence
  d'automatisation : 1 840–11 040 €. Les deux étaient dans `lib/marche.ts`
  depuis le 26/08, et le setup vivait entre les deux sans raison écrite.
  **Ce qui tranche est l'ACHETEUR, pas une moyenne** : l'artisan compare au
  télésecrétariat (marché d'avant), le maître d'ouvrage compare à l'agence
  (marché en cours depuis le 09/09). L'ancrage applicable a changé avec l'ICP,
  le prix n'avait pas suivi.
- **Niveau de preuve : aucune page tarifaire d'éditeur n'a été ouverte.** Le
  proxy sortant autorise la RECHERCHE et refuse la RÉCUPÉRATION de page
  (`EGRESS_BLOCKED`, vérifié). Tout est `secondaire` ou `fourchette` ;
  `source-primaire` reste **vide**, et un test l'exige. Pire : les guides de
  prix du marché français de l'agent vocal sont publiés **par des agences qui
  vendent ce service** — la source la plus utile et la plus intéressée à la
  fois. On ne les suit donc pas jusqu'en haut.
- **`null` + un motif écrit vaut mieux qu'une comparaison bancale.** Le
  pilotage n'a AUCUN comparable défendable (le seul trouvé est une plateforme
  de prévision d'entreprise américaine à 100–400 $/siège) et le dit, au lieu
  de rendre « sous le marché de 340 € » — un verdict qui a l'air calculé.

> ⚠⚠ **LE CERVEAU PORTAIT LA GRILLE DU REVENDEUR MORT.** `sc-voix-tarifs`
> (`lib/knowledge-seed.ts`) annonçait « Installation : 990 € HT » et les cinq
> paliers 59/115/169/219/319 — remplacés le 02/09 — **et affirmait « le PRIX
> n'a pas encore été décidé par nous »**, faux depuis dix jours. Son
> `updatedAt` portait le 02/09 : quelqu'un avait touché la DATE le jour de la
> décision sans toucher au CONTENU. Le Cerveau alimente les prompts, et les
> prompts écrivent de VRAIS emails : c'est la seule source de prix que le
> modèle peut citer. La note DÉRIVE désormais des constantes.
> · Le garde a dû être écrit **deux fois** : la première cherchait le montant
>   courant n'importe où dans la note, et la phrase de contexte (« passée de
>   990 à 1 490 € ») le satisfaisait. Il vise maintenant la **ligne
>   d'annonce** — celle que le modèle recopie.

> ⚠⚠ **UNE CORRECTION DU CERVEAU N'ATTEIGNAIT AUCUN NAVIGATEUR** (30/09/2026).
> Le socle ne s'écrit qu'UNE fois (`knowledgeSeeded`) : la correction du 12/09
> des prix Alpha Voice n'est jamais arrivée chez qui avait déjà ouvert l'app.
> `reviserSocle` (`lib/knowledge.ts`) remplace une note stockée **seulement si
> sa date est une date d'usine** (`DATES_SOCLE_ANTERIEURES`) — `upsertNote`
> date toute édition à l'instant, donc une note touchée par l'utilisateur est
> GARDÉE, une note supprimée ne revient pas.
> · **Corriger une note du socle = nouvelle `updatedAt` + ancienne date dans
>   `DATES_SOCLE_ANTERIEURES` + `REVISION_SOCLE` incrémenté.** Oublier l'un
>   des trois et la correction reste dans le dépôt. Un test exige les dates.
> · Les notes (offre, chiffres, routage, permis, cadence, ICP) DÉRIVENT des
>   modules qui font foi — elles portaient 2 500 €, « 5 rappels », un CAC, et
>   un ICP intérim. Deux tests épinglaient l'état faux.

> ⚠ **Ne jamais recopier une grille dans une prose.** Trois fautes de rendu
> trouvées en imprimant la note, aucune déductible du code : « 1490 € » sans
> espace des milliers, « 0,2 €/min » au lieu de « 0,20 », et un « trois fois
> sous le marché » qui était faux (990 contre 1 500, c'est 1,5×).

## Répartition du travail — ce qu'Alpha fait, ce que le client fait
Doctrine de cadrage, à dire au client dès le premier rendez-vous : elle évite
la promesse floue qui se paie à la livraison.

| | Qui |
|---|---|
| Prospection, qualification, relances, scripts, suivi, pipeline, présentations, mesure | **Alpha Sales OS** |
| **La livraison** de la prestation vendue | **le client** |
| **La réassurance humaine** — la présence, la voix, la poignée de main au moment de signer | **le client** |

Alpha ne livre pas le chantier et ne remplace pas la personne qui rassure. Il
supprime tout ce qui se trouve AVANT et AUTOUR : le travail répétitif qui fait
qu'un bon vendeur passe sa journée à ne pas vendre.

### La troisième colonne : ce qu'Alpha NE FAIT PAS
**Si Alpha ne sait pas le faire, on le fait à la main — et on montre au client
comment le faire.** Ce n'est pas un aveu, c'est une position : le lien Google
Sheet est la porte prévue pour ça (`/api/import/sheet`, direct, sans n8n ; ou
la synchro bidirectionnelle via n8n). L'humain relève, la feuille transporte,
Alpha trie.

C'est ce qui permet de refuser d'embarquer un collecteur dans le produit
(scraping d'annuaire, session LinkedIn, aspiration de Maps) sans perdre le
service : la collecte reste dehors, remplaçable, et sous la responsabilité de
celui qui la fait.

> 📦 **La règle appliquée à des dépôts précis** : `docs/COLLECTEURS-EXTERIEURS.md`.
> Deux ponts existent (`scripts/permis-lyon.mjs`, `scripts/maps-vers-alpha.mjs`),
> et deux tests refusent qu'un fichier de `lib/`, `components/` ou `app/` les
> importe — en visant un **chemin d'import**, jamais le nom du fichier.
> · **Maps ne source PAS notre ICP** et il faut le dire avant de le lancer : une
>   SCCV n'a pas de fiche Maps, et « promoteurs à Lyon » est un ciblage par
>   SECTEUR — QUI, jamais OÙ EN EST l'affaire. Ce qu'il apporte vraiment, c'est
>   **la troisième colonne** : le téléphone que l'arrêté ne porte pas.
> · **Le rapprochement est EXACT ou n'a pas lieu**, et un nom ambigu est écarté :
>   un faux rapprochement pose le numéro d'une société sur la fiche d'une autre,
>   et ce numéro part dans une file d'appels.
> · **Le secteur se DÉCLARE**, il ne se devine pas sur la catégorie Google — le
>   défaut du moniteur d'auto-école servi à des directeurs de programmes.
> · `ScrapeGraphAI` est **refusé**, avec ses trois motifs écrits (23 dépendances
>   Python, coût par page, et `undetected-playwright` — un contournement de
>   détection, dans un produit dont l'argument est la conformité).

> ⚠ La contrepartie, à cadrer AVANT de la promettre. « On montre au client
> comment faire » est du **service**, pas du logiciel : ça ne s'automatise pas,
> ça ne se duplique pas, et sans limite écrite ça devient du travail gratuit
> illimité. Ça se vend comme une prestation d'accompagnement bornée (nombre de
> séances, périmètre), ou ça se donne une fois au cadrage — jamais « on est là
> si besoin ».

> ⚠ Ne PAS écrire « les meilleurs du marché » dans un artefact vendu ou public.
> Zéro vente à ce jour : c'est une conviction, pas une preuve, et les tests de
> la vitrine refusent déjà les affirmations invérifiables. Ce qui se dit sans
> mentir : « on fait tout sauf la livraison et la poignée de main ».

## Offres — modifiables sans redéployer (`lib/offer-catalogue.ts`)
Ce que l'OPÉRATEUR vend à SES prospects (≠ `lib/bricks.ts`, qui est NOTRE
catalogue). Éditable dans Réglages : ajouter, modifier, désactiver.
- Chaque offre se rattache à une **famille de routage** (`alpha-sales-os`,
  `alpha-voice`, `visibilite-growth`). La famille décide du compte, de l'aimant
  et de la marche — **pas le nom**. Créer une 4ᵉ mécanique de routage demande
  encore du code.
  > ⚠ La doc nommait ici la famille du revendeur disparu. Le code, lui, avait
  > déjà été renommé en `alpha-voice` : **la doc décrivait une famille qui
  > n'existe plus**, et quiconque l'aurait recopiée aurait créé une offre que
  > `validerOffre` refuse. Une doc fausse coûte plus cher qu'une doc absente.
  > `tests/marque-morte.test.ts` refuse désormais un identifiant portant cette
  > marque dans la doctrine — la citer en prose reste permis, la PRESCRIRE non.
- On **désactive**, on ne supprime pas : une offre portée par une fiche signée
  ne s'efface pas sans rendre l'historique illisible.

## Alpha Voice (opérationnel)
- Pile : Deepgram STT · LLM **NVIDIA NIM `openai/gpt-oss-20b`** (défaut — sans
  latence ; le 70B fait la file d'attente ~14 s, ne pas y revenir) · Fish TTS ·
  Silero VAD. `voice/agent.py`.
- **Entrant OK** : Telnyx `+33451222182` → FQDN `5mwzznpudte.sip.livekit.cloud`
  (préfixe SIP LiveKit ALÉATOIRE, ≠ slug projet — c'était le bug), port 5060 UDP
  → trunk → dispatch rule → agent `alpha-voice`. Voir `voice/INBOUND.md`.
- **Art. 50 EU AI Act** : la 1re phrase (IA + pas une personne + pour le compte
  de X) est prononcée par le CODE (`first_sentence`, `allow_interruptions=False`)
  et `audit_script` refuse un script non conforme. **Ne jamais contourner.**
- **APPEL À FROID — doctrine du 28/08/2026.** Alpha Voice **démarche à froid**
  et mène l'appel ENTIER : il qualifie et conclut lui-même. La constante
  `COLD_CALLING_REFUSED` qui l'interdisait décrivait un état faux
  (`prospection-b2b` était déjà `allowed: true`) — elle est devenue
  `COLD_CALLING_DISCIPLINE`. L'ancien argument reste vrai et devient une
  contrainte de script : **une IA qui démarche n'a droit à aucune
  improvisation**.
  > ⚠ **La correction n'avait été faite que dans `lib/`.** `app/(app)/voice/page.tsx`
  > a gardé **treize jours de plus** « le démarchage à froid n'est pas
  > proposé » — dans l'écran qui mappe sur `CALL_MODES`, donc qui le **sert**,
  > et qui porte même une branche `isProspection`. Un commentaire faux ne fait
  > rien tomber : il ment à la session suivante, qui le croit et raisonne
  > dessus. `tests/voice-script.test.ts` relie désormais la **prose** à la
  > **donnée** — il ne cherche pas une phrase interdite dans l'absolu, il
  > refuse une phrase que `CALL_MODES` contredit. Si un mode repasse
  > `allowed: false`, l'écrire redevient licite et le garde se tait.
  > **Les citations (« … ») sont exclues** : une phrase rapportée n'est pas une
  > phrase affirmée, et effacer l'explication laisserait la décision sans sa
  > raison.
- **Le passage de main se fait sur INTÉRÊT QUALIFIÉ, plus sur le décroché.**
  Nouveau résultat `interesse` (`lib/call-cadence.ts`) : lui seul rend
  `handoffToHuman: true`. Un « non » ou un « rappelez-moi » se traite et se
  consigne **sans mobiliser personne**. Avant, les quatre résultats « il a
  décroché » réveillaient un closer — un refus coûtait autant qu'un RDV, et
  c'est ce qui rendait le volume impossible.
  > ⚠ `interesse` est un SOUS-ENSEMBLE de « a décroché » : tout ce qui compte
  > les décrochés passe par `aDecroche()`. La calibration avait déjà perdu les
  > RDV de son dénominateur en une ligne.
- **Script d'appel à froid — ce que `auditScript` REFUSE** : objectif unique
  (le RDV), aucun prix, le NON qui raccroche, le OUI qui passe la main. Et sur
  un **COMPTE PARTENAIRE**, une exigence de plus : **aucune autre société,
  aucune autre offre citée**. Sur son appel c'est SA marque qui parle — nous ne
  sommes qu'intermédiaires.
  > ⚠ **Cette garde s'armait sur l'OFFRE (l'accueil téléphonique), parce que
  > c'est le revendeur qui la portait qui l'avait demandée.** L'offre est
  > revenue chez nous : laissée en l'état, elle aurait interdit de citer
  > EAGLEYE sur NOTRE propre appel, et n'aurait rien gardé sur un appel
  > Nuwacom. Elle suit maintenant le **COMPTE** — et **des deux côtés** : ce
  > que `buildVoiceScript` ÉCRIT et ce qu'`auditScript` EXIGE doivent poser la
  > même question, sinon l'un des deux ment.
- **Cadence de relance** : après le 1er appel sans réponse → **3 rappels sur
  2 jours** (`[3, 24, 32]` h : même jour plus tard · lendemain matin · lendemain
  après-midi — trois CRÉNEAUX différents, jamais deux fois la même heure). Dès
  qu'il répond, la cadence **s'arrête** ; l'humain n'est appelé que sur un OUI.
  > ⚠ **Le décret n° 2022-1313 plafonne le démarchage à 4 sollicitations par
  > consommateur sur 30 jours glissants.** Il vise le B2C, mais une liste
  > terrain est MÊLÉE et c'est nous qui portons le risque. La cadence fait
  > **exactement 4 contacts** (1er appel + 3 rappels) : au plafond, jamais
  > au-dessus. `plafondRappels` reste armé (SIREN connu → cadence entière ;
  > pas de SIREN → 4) — un filet qui ne mord plus, et c'est l'état qu'on veut.
  > **Remonter le tableau réactive ce régime à deux vitesses**, et c'est testé :
  > le filet ne s'enlève pas avec le chiffre.
  > ⚠ **Les rappels sont CALÉS sur des fenêtres d'appel ouvertes**
  > (`prochaineFenetreOuverte`), **et espacés d'au moins 3 h**. Deux règles
  > DISTINCTES qui doivent coexister : le calage seul renvoyait cinq rappels au
  > lundi matin entre 9h et 10h — corriger « au bon moment » avait cassé « de la
  > bonne manière ».
  > 📦 Le récit complet (5 rappels non mesurés, les relevés jeudi/vendredi, la
  > doctrine qui se contredisait) : `docs/ANGLES-MORTS.md`.

## L'OFFRE ALPHA VOICE (`lib/offre-alpha-voice.ts` + `docs/OFFRE-ALPHA-VOICE.md`)
Construite sur l'équation de valeur — **Résultat × Probabilité ÷ (Délai ×
Effort)**. Le piège du pitch est de ne travailler que le numérateur : chez un
artisan, ce qui bloque est au DÉNOMINATEUR (pas le temps, déjà déçu par un
outil jamais installé).
- **Zéro preuve sociale, et un test le refuse.** Zéro vente = pas de
  témoignage disponible ; en fabriquer un est la seule façon de perdre un
  client pour de bon. Ce qui remplace : **ses chiffres à lui**
  (`computeLosses`), **une démo en direct** (on fait sonner l'agent pendant le
  rendez-vous), **une garantie chiffrée**.
- **La garantie est le levier qui remplace la preuve.** Celle qu'on offre
  (décidé le 02/09/2026) : **« le setup ne se paie qu'au premier RDV »**. Les
  deux autres ne coûtent rien et ne lèvent rien.
  > ⚠ **Son vrai coût n'est PAS celui qu'on croit.** `coutGarantiePremierRdv`
  > chiffre les MINUTES — quelques euros, poste négligeable. Ce qu'on risque,
  > c'est le **temps d'installation**, fait à la main : une garantie activée
  > coûte une demi-journée, pas 8 €. Elle est offrable parce qu'on en offre
  > **peu à la fois** — c'est pour ça qu'elle va de pair avec la rareté.
  > ⚠⚠ **Trois bords, dits à l'oral** : une DURÉE (30 j de ligne active), un
  > PÉRIMÈTRE (le setup, pas l'abonnement consommé), un CRITÈRE (un RDV
  > **pris**, pas honoré — qui vient et qui signe ne dépend plus de nous).
  > Sans bords, elle s'active au bout de trois jours ligne coupée.
- **La rareté est un FAIT** (l'installation se fait à la main, par une seule
  personne), jamais un compteur de places inventé — ça se vérifie au coup de
  fil suivant.
- **Aucun montant en dur dans le module**, et un test l'interdit : les prix
  vivent dans `lib/offres-publiques.ts`, une seule source.
- **Le prix arrive APRÈS la démonstration, et jamais sans la garantie.**

## Rituels de closing (par compte) — `Account.closing`
Se tromper de rituel = perdre le deal au dernier mètre.
- **EAGLEYE** → DEVIS EAGLEYE CORP, envoyé depuis `contact@eagleyecorp.fr`.
- **Nuwacom** → visio de CADRAGE / CHIFFRAGE **à trois** (Christophe, CEO + le
  client + nous), fuseau **Europe/Luxembourg**. Le contrat de commission se
  dresse APRÈS (= le levier) ; nous sommes PO pendant le delivery.

### LE CADRAGE EST EXÉCUTABLE SUR LE CHEMIN VIVANT — 17/09/2026
`lib/cadrage.ts` · `Prospect.cadrage` · `components/prospects/cadrage-panel.tsx` ·
`app/api/catalogue/route.ts` · `tests/cadrage-devis.test.ts`.

« Cadrage OBLIGATOIRE avant devis » était écrit ici, et `peutEmettreDevis`
l'exécutait correctement. Son seul appelant applicatif était **`renderDevis`,
que personne n'importe**. Le devis qui PART réellement — `quoteText`, titré
`DEVIS — <client>`, daté, quinze jours de validité, servi par `/api/catalogue`
et copié depuis la fiche — ne posait la question à personne.
- **Le défaut récurrent, avec une aggravation** : la règle n'était pas branchée
  à un endroit sur deux — **l'endroit branché était le MORT**. Qui lisait
  `lib/cadrage.ts` en concluait que la porte tenait.
- **`EtatCadrage` n'avait aucun PRODUCTEUR.** Même en appelant la règle, il n'y
  avait rien à lui donner : aucun champ de la fiche ne la portait. D'où
  `Prospect.cadrage`, **structuré** — un événement `meeting` dit qu'une
  rencontre a eu lieu, pas qui a validé la suite. Le déduire d'un résumé libre
  serait la devinette que ce dépôt refuse (précédent : `lotsACommercialiser`).
- **⚠⚠ ON REFUSE LE DOCUMENT, PAS LE CHIFFRAGE.** Le `texte` ne se fabrique pas
  sans cadrage ; `quote` et `pack` sortent quand même. Ce sont SES prix sur SON
  dossier, et chiffrer pour soi n'est pas émettre. Couper les nombres ferait
  d'une discipline commerciale une **panne d'outil** — et devant un outil en
  panne on recopie la grille à la main, c'est-à-dire on se trompe de montant au
  dernier mètre. Mesuré : deux autres écrans (calculateur `/offre`, prix du
  deck) n'appellent ce POST **que** pour les nombres.
- **Le verdict voyage AUSSI quand c'est bon** : sinon l'appelant ne distingue
  pas « autorisé » de « cette route ne connaît pas la règle ».
- **⚠⚠ ON NE PRÉ-REMPLIT PAS CE QU'ON VÉRIFIE.** Mettre `settings.closerName`
  dans « validé par » aurait satisfait la 3ᵉ condition par **configuration** et
  non par un **acte** : deux conditions sur trois cochées au premier créneau
  saisi. Et « la visio s'est tenue » ne se déclare pas sur un créneau à venir
  (`creneauPasse`, horloge **injectée**) — un point déclaratif ne s'offre pas
  tant que sa condition n'existe pas.
- **Reprogrammer le créneau remet « tenu » à faux** : un drapeau qui survit à
  la réécriture atteste d'une rencontre qui n'a pas eu lieu. Même défaut que
  `perimee` dans `validation-partenaire`.
- **`lireCadrage` fail-closed** : `{ reelementTenu: "non" }` passerait pour vrai
  avec un `Boolean()`. L'inconnu **bloque** ici, il ne se contente pas de se
  dire.

> ⚠⚠ **ET LA DATE DÉRIVAIT — défaut trouvé le jour même où je l'ai écrit.**
> Le panneau réaffichait le créneau avec `toISOString().slice(0, 16)` : de
> l'**UTC** reposé dans un `datetime-local`, qui l'interprète en heure
> **LOCALE**. Deux heures perdues à chaque lecture — et comme l'enregistrement
> suivant reconvertit local → UTC, **l'erreur se CUMULE** :
> `tapé 14:00 → relu 12:00 → réenregistré → relu 10:00`. Trois ouvertures et le
> cadrage change de jour.
> · **Ce n'est pas cosmétique** : cette date part sur un DEVIS (« établi après
>   le cadrage du … »), le document engageant, et elle est ce qui prouve que le
>   cadrage a précédé.
> · **Seule la LECTURE était fausse** : `new Date("2026-09-15T14:00")` sans `Z`
>   est parsé en heure locale par le moteur, avec le bon décalage d'été.
>   « Réparer » les deux sens aurait réintroduit le décalage à l'envers.
> · **Le décalage est celui de LA DATE stockée**, pas celui d'aujourd'hui : un
>   cadrage d'août relu en novembre bougerait d'une heure.
> · ⚠⚠ **C'est l'ALLER-RETOUR qui l'attrape, pas la conversion.** Tester
>   `isoVersChampLocal` seule aurait demandé d'écrire la valeur attendue — et je
>   l'aurais écrite AVEC mon erreur, puisque je ne la voyais pas. Le test juste
>   ne connaît **aucune valeur** : il exige qu'écrire puis relire rende ce qu'on
>   a tapé, sur quatre fuseaux. Même leçon que « j'ai testé les maillons, pas la
>   chaîne ».

> ⚠ **TRANCHÉ le 17/09/2026 : `renderDevis` + `estRefus` SUPPRIMÉS** (avec le
> type `RefusDevis`). Il y avait deux rendus de devis dont un seul atteignable ;
> le mort était sûr (il appelait la règle) mais c'était un second endroit où se
> décidait « comment rend-on un devis ? », qu'une session future aurait
> rebranché sans garantie de repasser par la porte. Le devis vivant part par
> `quoteText`, gardé par le cadrage sur `/api/catalogue` et testé là. Un devis
> HTML imprimable, si on en veut un, se construira SUR cette voie — pas en
> ressuscitant un mort. Le module ne garde que sa voie vivante : `renderPreDevis`
> et `emailPreDevis` (le pré-devis).

### L'IMPORT CRM : LE TRI DÉCIDE QUI ON APPELLE, PAS QUI EXISTE (20/10/2026)
`importerPourCrm` (`lib/sourcing-terrain-import.ts`) · `tests/import-crm.test.ts` ·
brief et réponses confrontés au code : `docs/BRIEF-AUTONOMIE.md`.

Reproduit sur trois PME lyonnaises **complètes** (téléphone, email, site,
secteur, audit) dont seules « note » et « avis » étaient vides : deux marqueurs
suffisent à `ressembleAuTerrain`, la feuille allait au tri terrain, chaque
fiche sortait à **20/100 pour un seuil de 45**, n'était jamais créée, et l'écran
annonçait « ✓ 0 nouveau(x) ». Le repli vers l'import générique ne se
déclenchait pas non plus, parce que `ecartes.length > 0`.
- **Le tri répond à « qui appeler ? » (une file), on lui avait confié « qu'est-
  ce qui entre dans le CRM ? » (un registre).** Un champ facultatif absent
  fermait la porte à une fiche complète. 45 est une DÉCISION non validée : il
  ordonne, il n'interdit pas (même principe que `LOGEMENTS_MIN` — on COMPTE).
- **La lecture générique crée toutes les lignes ; le tri est une surcouche.**
  Une fiche appelable gagne ses signaux, une fiche faible reçoit le tag
  `a-qualifier`. **Seules les fiches HORS SUJET ne sont pas créées**
  (`CiblageTerrain.horsSujet` : enseigne nationale, standard déjà en place) —
  nommées avec leur motif, jamais tues. Un numéro manquant n'est PAS hors sujet.
- **Deux défauts cachés derrière le premier** : « Nombre d'avis » et « Extrait
  d'avis » (les en-têtes les plus naturels en français) n'étaient **pas** dans
  la table d'alias du tri — l'apostrophe donne `nombredavis` ; et « Audit
  commercial », « Problème probable », « Prochaine action » étaient jetés sans
  un mot. Les colonnes non lues sont désormais **nommées** dans le résumé.
- **Le « ✓ » ne se pose que si quelque chose a été écrit** (`messageImport`).
- Mesuré par mutation : traiter tout non-retenu comme à retirer fait tomber 7
  tests sur 12 ; une coche inconditionnelle en fait tomber un.

### UNE ROUTE PEUT ENFIN S'EXÉCUTER DANS UN TEST (`tests/resolution-alias.mjs`)
`npm test` compile avec `tsc` puis lance `node --test`. `tsc` **ne réécrit pas
les alias `paths`** : le fichier compilé garde `require("@/lib/…")`, que Node ne
résout pas. Conséquence mesurée : **aucune des ~45 routes `app/api/**` n'était
exécutable depuis un test**, et toutes étaient donc gardées par des assertions
sur le TEXTE SOURCE.
- **C'est la famille de garde qui a le plus souvent échoué ici** — « l'assertion
  était satisfaite par la PROSE », « asserter la PRÉSENCE du refus au lieu de la
  CONDITION ». Un import inutilisé, un `if (false)`, un commentaire bien écrit :
  tout ça passe un `grep`. Mesuré sur la garde du cadrage : la mutation qui
  garde l'import et rend la condition inerte (`verdict !== null`) est la
  seule qu'un test de source n'aurait pas vue.
- Le crochet (`node:module`, **aucune dépendance**) ne fait qu'une chose :
  remplacer `@/` par la racine de `.test-build`. Il ne transforme aucun code.
- **Écrire désormais un test de route en l'APPELANT**, pas en la lisant.

## VALIDATION PARTENAIRE (`lib/validation-partenaire.ts`)
Sur un compte revendeur, le prospect n'entend pas « Alpha pour le compte
d'Untel » : il entend **Untel**. Ce qui se dit là engage une réputation qui
n'est pas la nôtre. Rien ne sort d'un compte partenaire — script d'appel, email,
SMS — sans un tampon de relecture.
- **La conformité n'est PAS l'accord.** `auditScript` refuse un texte illicite ;
  il ne dit rien de ce que le partenaire a effectivement relu. Deux contrôles
  distincts, aucun ne remplace l'autre.
- **Le tampon porte sur le TEXTE EXACT, pas sur son nom** : il stocke
  l'empreinte (`empreinte()`, un hash 32 bits — pas de la cryptographie, la
  menace c'est notre propre oubli). Un tampon attaché à « la trame d'appel »
  survivrait à sa réécriture : on fait relire, on modifie le lendemain, et tout
  le monde croit que le contrôle a eu lieu. Réécrire ⇒ `perimee`.
- Un compte non partenaire est `non-requise` — on ne se demande pas
  l'autorisation à nous-mêmes. Détail complet : `docs/COMPTE-PARTENAIRE.md`.
> ⚠ Le piège de test rencontré quatre fois ici : asserter la PRÉSENCE du refus
> (`status: 422`) au lieu de la CONDITION qui y mène. Un `if (false)` laisse le
> 422 en place et le test passe. Toujours muter la condition pour vérifier.

## QUI SIGNE, ET CE QUI NE PART PAS SANS MENTIONS
Deux contrôles distincts sur **tout** message sortant, tous deux arbitrés
côté serveur dans `/api/send` — le seul endroit d'où un message PART.
- **Le signataire** (`lib/signature.ts`) : on ne devine JAMAIS l'identité d'un
  humain. Ordre de repli : le nom saisi → la **société** (une raison sociale
  identifie légalement, et elle est à l'expéditeur) → le libellé d'usine,
  **rendu visible** (`usine: true`) au lieu d'être masqué.
  > ⚠⚠ **LE BALAYAGE S'ÉTAIT ARRÊTÉ AUX EMAILS** (11/09/2026). Trois modules
  > sortants signaient encore en dur : les **trois** messages LinkedIn,
  > l'**argumentaire d'appel** — qui se PRONONCE — et le repli d'agence de
  > `mail-compose` (plus sa ville, « Lyon »). Un revendeur écrivait à SES
  > prospects sous NOTRE raison sociale.
  > · `presentation()` (`lib/signature.ts`) est désormais la seule source de la
  >   phrase « je suis … ». Elle tient deux règles que deux fichiers
  >   recopiaient : ne pas nommer la société **deux fois** quand le repli tombe
  >   sur elle (« je suis EAGLEYE CORP, de EAGLEYE CORP » — défaut CRÉÉ en
  >   retirant le prénom en dur), et l'**élision** (« d'EAGLEYE CORP » mais
  >   « de Nuwacom » ; jamais devant un h, le h aspiré ne se devine pas).
  > · **Un email est rattrapé par `/api/send`, une invitation LinkedIn NON** :
  >   elle se copie à la main, aucun serveur ne la relit. `/linkedin` porte
  >   donc le bandeau d'identité d'usine que `/outbox` avait déjà.
  > · ⚠ Un garde qui cherche la RAISON SOCIALE ne voit pas un **prénom** en
  >   dur — et `lib/signature.ts` appelle celui-là « le pire des quatre ».
  >   Mesuré : deux mutations sur trois n'ont pas mordu. Le garde ne nomme donc
  >   personne : on passe un nom SAISI et on exige qu'il ressorte, par la file
  >   entière, pas seulement par les fonctions appelées en direct.

  > ⚠ Le produit est **white-label**. Aucun repli ne remet « EAGLEYE » : la
  > marque, l'adresse légale, le papier à en-tête et le logo suivent le
  > **compte**. Ils étaient tous les quatre en dur — un email partenaire partait
  > avec notre en-tête, notre raison sociale et notre aigle. Seule survit la
  > mention de **plateforme** (« Envoyé avec Alpha Sales OS® »), qui nomme
  > l'éditeur de l'outil et reste vraie partout.
- **Les mentions obligatoires** (`lib/conformite.ts` → `verifieMentions`) :
  qui écrit + moyen de refus. Vérifiées sur **ce qui part réellement** —
  l'email sur le texte RENDU (le pied « STOP » est ajouté par le rendu), le
  SMS sur `body.body` (rien ne s'y ajoute : il partait nu).
  > ⚠ On **refuse**, on n'ajoute pas en douce : un SMS se paie au segment, et
  > masquer un trou le rend indétectable. Et **`force` ne passe pas outre** —
  > il arbitre le score anti-spam et la fenêtre de recontact, deux jugements ;
  > une mention obligatoire n'en est pas un.
- **Le palier du jour** (`lib/email-ramp.ts` → `rampDepuisPremierEnvoi`) :
  5 envois/jour la première semaine, +5 par semaine, **40 au plafond** pour une
  seule boîte. Au-delà, on ne gagne pas plus — on grille le domaine d'un coup.
  > ⚠ **IL NE COUPAIT QUE LA FILE D'UN ÉCRAN.** Le barème était enfermé dans
  > `emailRamp()`, qui prend des `Prospect[]` — donc inatteignable depuis le
  > serveur, qui n'a pas le CRM du navigateur. `/outbox` était borné ; les
  > **trois autres appelants** (revue de campagne, newsletter, recette) ne
  > connaissaient que `MAX_SENDS_PER_HOUR`. Le palier tenait par la mémoire de
  > celui qui envoie. Branché côté serveur le 10/09/2026.
  > ⚠ **24 h GLISSANTES, pas la journée civile**, et ce n'est pas une
  > divergence par négligence avec l'écran : un jour calendaire autorise cinq
  > envois à 23h59 et cinq à 00h01 — dix messages en deux minutes depuis une
  > boîte neuve, soit le schéma exact que les filtres cherchent.
  > ⚠ **`force` ne passe pas outre**, comme pour les mentions. La réputation
  > d'un domaine n'est pas un jugement : elle ne se répare pas en redéployant.
  > ⚠ **Toute panne mène au palier le plus BAS.** `firstSendAt` rend `null` sur
  > une base injoignable, une table vide ou un service role absent → 5/jour.
  > C'est l'inverse du réflexe « en cas de doute, ne pas bloquer » : rendre une
  > date sur une panne ouvrirait le plafond au moment précis où l'on ne sait
  > plus rien.
  > **Conséquence à connaître** : une newsletter plus large que le palier est
  > COUPÉE au palier. Ce n'est pas une panne.
- **Le câblage** (`lib/expediteur.ts` → `identiteEnvoi`) : les **quatre**
  appelants de `/api/send` (barre d'envoi, revue de campagne, newsletter,
  recette) étalent le même triplet. Trois annonçaient le compte, aucun le
  signataire, la recette rien du tout. Le client ne tranche rien : il
  transmet, le serveur arbitre.

### D'OÙ PARTENT NOS EMAILS — `contact@eagleyecorp.fr` (10/09/2026)
La boîte `noreply@` prévue n'a jamais été créée, et attendre bloquait tout.
`contact@eagleyecorp.fr` existe, fonctionne, et **quelqu'un la lit**.
- Un `noreply@` en expéditeur de **prospection** n'est pas une convention
  neutre : il annonce « ne répondez pas » à quelqu'un dont on attend
  précisément une réponse. Et `contact@` est déjà l'adresse du cadrage sur la
  vitrine et celle d'émission des devis — le prospect qui répond tombe là où
  quelqu'un regarde, du premier message jusqu'à la signature.
> ⚠⚠ **CE QUE ÇA COÛTE, et c'est écrit plutôt que tu.** Le transactionnel et
> le commercial partagent désormais UNE SEULE boîte. Une campagne qui prend
> des plaintes fait tomber les mails d'inscription Supabase **en même temps**
> — aucun code ne change, rien ne le signale, et un client qui ne reçoit pas
> son lien de confirmation ne devient jamais client. La même réputation porte
> les devis.
> ⚠ `docs/CHECKLIST-LANCEMENT.md` disait **l'inverse** (« une adresse distincte
> de celle des campagnes »), et elle avait raison sur le fond. La ligne n'a pas
> été supprimée : elle porte la décision qui l'annule et son motif. Une
> consigne remplacée sans sa raison se fait réappliquer à l'envers par la
> session suivante, qui croit corriger un oubli.
> ⚠ Ce qui rend le choix tenable est le **palier du jour ci-dessus**, et rien
> d'autre. La séparation des domaines (transactionnel sur une boîte dédiée,
> prospection sur un sous-domaine) est **repoussée, pas annulée**.
> Procédure : `docs/SMTP-SUPABASE-AMEN.md`.

## Références externes (`lib/references.ts`) — un livre n'est PAS une vérité
Les sources extérieures (livres, vidéos, cours) entrent dans le Cerveau avec
trois choses attachées, jamais sans :
1. **la provenance** (titre, auteur, année) ;
2. **le niveau de preuve** — `mesure-maison` (constaté sur NOS affaires : la
   seule catégorie qui mérite le mot « vérité ») · `source-primaire` ·
   `praticien` (la plupart des livres de vente) · `folklore` (répété partout,
   sans source — ex. « il faut sept expositions ») ;
3. **le statut face à la doctrine** — `applicable` · `sous-condition` ·
   `conflit-doctrine` · `bloque`.

> ⚠ Un statut `conflit-doctrine`, `bloque` ou `sous-condition` **exige une
> réserve écrite**. Un avertissement sans contenu se fait ignorer, et la leçon
> s'applique par défaut. C'est ce point-là qui évite l'erreur, pas le volume de
> citations accumulées.

Les notes de référence sont marquées `[SOURCE EXTERNE — non vérifiée chez nous]`
dans le contexte IA : la doctrine alimente les prompts, les prompts produisent
de VRAIS emails. Une phrase de livre ne doit jamais revenir au même rang qu'un
chiffre mesuré.

**Ce qui reste bloqué tant qu'il n'y a pas de client** : témoignages, logos,
endossements, « 101 histoires de réussite ». Zéro vente = zéro preuve sociale
disponible ; l'appliquer quand même fabrique de la preuve inventée.

> ⚠⚠ **IL Y A UNE TROISIÈME FAMILLE, ET C'EST LA PIRE : L'AFFILIATION.**
> Trouvée EN LIGNE le 10/09/2026, pas par un test. La vitrine affirmait
> « c'est aussi ce qui nous vaut de candidater à French Tech 2030 » — un
> programme dont un critère d'entrée **éliminatoire** nous écarte, et dont
> l'échéance était passée sans dépôt.
> · Les gardes existants refusaient les témoignages comptés et les
>   superlatifs. Un LABEL, un PROGRAMME, un ACCÉLÉRATEUR, un « lauréat »
>   forment une famille à part — et la plus dangereuse : un témoignage inventé
>   se démonte en conversation, une affiliation **se vérifie auprès de
>   l'organisme, sans nous prévenir**.
> · `tests/vitrine-fuite.test.ts` la refuse désormais, et exige que l'argument
>   qui la remplaçait RESTE : la souveraineté est vraie et tient debout sans
>   aucun label.
> ⚠ Le garde a immédiatement mordu sur une phrase honnête (« ce qu'Alpha
> **supprime** » — `prim[ée]` sans limite de mot). Resserré le jour même : un
> garde qui refuse une phrase juste est un garde qu'on assouplira au mauvais
> endroit la fois suivante.

## L'ADMISSIBILITÉ N'EST PAS L'ADÉQUATION (`lib/opportunites.ts`)
Sur tout dossier d'aide, de programme ou d'appel à projets, **deux questions
distinctes** qui se lisaient comme une seule :
- `fit` — « ce programme nous va-t-il ? ». Une question de pertinence.
- `bloquant` — « avons-nous le DROIT d'entrer ? ». Un critère qu'on ne remplit
  pas et qui **ne se rattrape pas** par la qualité du dossier.

> ⚠ **French Tech 2030 : porte FERMÉE.** Le critère d'entrée est 3 M€ de
> financements et/ou de CA cumulés depuis 2024 ; nous sommes à 0 €. Le seuil
> est éliminatoire, **et la promotion suivante appliquera le même**.
> ⚠⚠ Ce constat était écrit, daté et exact — **dans un README**. Le code, lui,
> ne connaissait pas le critère : `/trajectoire` affichait « adéquation :
> plausible » en AMBRE (une couleur qui encourage) et `lib/mission-french-tech`
> découpait neuf lots de travail pour un dossier rejeté à la première page.
> Personne ne relit un README avant de cocher une case dans un tableau de bord.
> · Un blocage **GRISE** l'adéquation à l'écran : rangé dans une phrase sous la
>   carte, il se lit APRÈS la couleur, et la couleur avait déjà rassuré.
> · Le critère se nomme **avec sa valeur** — « non éligible » sans le seuil
>   envoie chercher la porte suivante, qui appliquera le même.
> · Les dossiers OUVERTS ne portent aucun blocage, et c'est testé : sinon on en
>   remplit partout par prudence et l'écran devient un mur rouge que personne
>   ne lit.

## MASTER RAPPEL (`lib/master-rappel.ts` + `lib/vital-signs.ts`)
Pour chaque prospect, à chaque instant : **signaux vitaux** (prêt à signer ?),
**fatigue** (saturé ?), **fenêtre** (quand revenir sans l'agacer), **actions
séparées humain / Alpha**, **checklist « ça tourne + Alpha reçoit la donnée »**,
et le **plan de comms** (quoi dire, quand, comment, à quelle fréquence).
Règles dures :
- La fréquence suit la **réactivité**, jamais le calendrier. Prêt → tous les
  jours ; saturé → silence de 7-21 j puis **raison NEUVE** (jamais « je me
  permets de relancer »).
  > ⚠⚠ **CETTE RÈGLE ÉTAIT ÉNONCÉE CINQ FOIS ET PRODUITE ZÉRO FOIS** —
  > mesuré le 17/09/2026. Elle vit dans `master-rappel`, `priorites`,
  > `reactivite`, `vital-signs` et `business-rules` ; **aucun des cinq n'en
  > fabrique une.** `master-rappel` en liste les formes EN PROSE et s'arrête.
  > Résultat sur l'écran du matin : « Revenir avec une raison NEUVE » s'affiche
  > à quelqu'un qui n'en a aucune — **et qui écrira « je me permets de
  > relancer », la phrase même que la règle interdit, produite PAR la règle
  > faute d'alternative.**
  > · `lib/raison-neuve.ts` la PRODUIT, et **n'invente rien** : zéro fait daté
  >   → `null`, et `AUCUNE_RAISON` dit alors de **ne pas relancer**. Une raison
  >   fabriquée est pire que pas de raison — un prétexte ne se rejoue pas.
  > · **Deux sources seulement, parce qu'il n'existe que deux faits datés** :
  >   le **prix honoré** (`grille-perimee`) et une **ouverture/clic récente**
  >   (`reactivite`). « Une actualité de son métier » serait une INVENTION tant
  >   qu'aucune source ne l'alimente : elle n'est pas écrite.
  > · **Le prix passe devant l'ouverture** : il APPORTE quelque chose, quand
  >   « vous avez ouvert mon message » n'apprend rien au prospect et le met en
  >   position de se justifier. On ouvre sur ce qu'on donne.
  > · **Le fait se dit, l'observation NON.** « J'ai vu que vous aviez ouvert »
  >   est vrai et sonne fliqué — même interdit que citer son permis à froid.
  >   Le fait sert à choisir le MOMENT, jamais à ouvrir la conversation.
  > · **Aucun montant dans la phrase** : un prix écrit se transfère et se cite
  >   hors de son périmètre. Il se redit de vive voix.
  > · Les phrases sont croisées contre les **motifs exécutables** des
  >   verticales — c'est un texte qui se prononce, donc un « sixième texte ».
  > ⚠ Le garde « aucun montant » a dû être resserré le jour même : écrit
  > `\d{3,}`, il faisait tomber ma propre phrase sur « jusqu'au 17/10/**2026** »
  > — une DATE, qui est justement ce qui rend la raison défendable.
  > ⚠⚠ **ET CETTE DATE A EXPIRÉ : depuis le 18/10/2026, le cycle de relance est
  > À L'ARRÊT** (mesuré le 21/10, `docs/GTM-CYCLE-ECART.md` § 2). La source
  > « prix honoré » exige `PRIX_HONORE_JUSQU_AU ≥ maintenant` ; l'autre
  > (ouverture tracée) n'existe que côté serveur, pour notre pipe. Jeu de démo :
  > 0 raison sur 8. **Ne PAS repousser la date pour relancer la machine** : ce
  > serait fabriquer une échéance. Une nouvelle source honnête se TRANCHE (date
  > d'arrêté structurée qui choisit le moment sans jamais affirmer « purgé de
  > recours », engagement daté pris par le prospect, ou relance humaine assumée).
  > ✅ **Remis en marche le 22/10/2026 par la seule source qui vaut pour tout
  > métier : LA DATE QU'IL A DONNÉE** (`NextStep.demandePar: "prospect"`, saisie
  > à l'écran d'appels après « Rappeler », `etapeASaDate`). Source `sa-date`,
  > devant les deux autres, fenêtre de la veille à J+14
  > (`FENETRE_SA_DATE_JOURS`, une décision). **Notre délai par défaut (3 j) n'est
  > JAMAIS lu comme sa demande** — un test l'exige. La date d'arrêté de permis
  > n'a pas été faite : ce n'est plus la cible.
- Le compteur de saturation **repart à zéro dès qu'il répond**.
- 3+ touches ignorées → **changer de canal** (le format a déjà été ignoré)…
  **sauf s'il OUVRE** (`lib/reactivite.ts`) : là le canal passe, c'est la
  DEMANDE qui coince. Changer de registre jetterait le seul canal dont on a
  la preuve qu'il arrive.
- Jamais de prix avant la démo. Jamais de closing sur un vital au rouge.
  Jamais doubler un RDV déjà calé.

## LA BOUCLE — la sortie doit revenir corriger l'entrée
Le flux allait dans un seul sens : sourcing → tri → appel → résultat écrit →
plus rien. Chaque module était juste, et la chaîne ne bouclait pas. Les cinq
arcs de retour sont branchés ; ils se protègent par
`tests/boucle-terrain.test.ts`, qui suit la chaîne entière.

1. **Résultat d'appel → cadence.** `RESULTATS_MANUELS` (`lib/call-outcome.ts`)
   est la SEULE source du texte écrit à la main, et l'aller-retour
   résultat → texte → résultat est testé ligne par ligne. Écrire un résumé
   d'appel ailleurs casse le test — c'est voulu.
2. **Résultat d'appel → poids du tri.** `lib/calibration.ts` mesure ; il ne
   corrige rien tout seul.
3. **Débrief / objection / perte → Cerveau → file d'appels** du même métier
   (`lib/lecons-terrain.ts`), verticale identifiée par **tag**, jamais par
   ressemblance de mots.
4. **Cible → plafond légal**, lu de façon identique par l'autopilote et par le
   plan humain (`cibleDepuisProspect`).
5. **Ouvertures / clics → plan de comms** (`lib/reactivite.ts`).

### LES PALIERS DE CAMPAGNE — 10 · 100 · 1 000 (`lib/paliers-campagne.ts`)
Trois chiffres gouvernent tout le dimensionnement et **aucun n'est mesuré** :
décroché (hyp. 30 %), intérêt qualifié parmi les décrochés (hyp. 20 % — c'est
lui qui fait dire « un closer suffit pour 500/jour »), tarif Telnyx à la minute
(le relevé réel autorise un facteur 29). On les mesure par paliers.
- **Un palier BORNE, il ne décore pas.** Le plafond est un compte CUMULÉ passé
  à `buildCampaignRun` ; les fiches en trop sont écartées en `palier-atteint`.
  Ne jamais le confondre avec `dailyCap` (fatigue, remis à zéro chaque matin) —
  ce dépôt a déjà payé une constante à deux sens.
- **Deux gestes, deux endroits, et c'est voulu** : l'écran suit les paliers
  validés dans les réglages ; le cron suit `CAMPAIGN_PALIER` (10/100/1000/aucun,
  **absente = plafond le plus bas**). Valider dans l'app ne débride pas le cron.
- Points `mesure` (la base répond, ils ne se cochent pas) vs `declaratif` (même
  vocabulaire que `lib/checkpoints.ts`) — et **un point déclaratif ne s'offre
  pas** tant que sa condition n'existe pas : cocher « j'ai entendu la phrase
  art. 50 » sans décroché fabriquerait la preuve.
- **Aucun palier ne se valide seul**, même tout vert. Automatique = le REFUS.
- Le coût d'un palier vit dans `lib/paliers-campagne-cout.ts` (**serveur
  uniquement** — `voice-costs` porte nos marges) et sort en fourchette.

> ⚠ **Les trois règles qui empêchent la boucle de fabriquer de la fausse
> science** — elles valent pour tout nouveau module de mesure :
> · **zéro donnée → zéro chiffre.** `source: "aucune"`, `valeur: null`. Un
>   `0 %` se lit comme un résultat ; l'angle mort se DIT.
> · **jamais un taux nu** : dénominateur + intervalle de Wilson à 95 %, et la
>   réserve qui va avec (un taux d'ouverture est un *plancher*, pas une mesure).
> · **aucun poids ne s'auto-corrige.** Sur quarante appels, un ajustement
>   automatique apprend le bruit et le grave dans le tri. Le module rend un
>   verdict et nomme le fichier ; la constante se change à la main, et ça se
>   voit dans un diff.

## CE QUI TOURNE SANS PERSONNE — l'ordonnanceur et le moniteur
Décidé le 09/09/2026. Le but : Alpha tourne dans la poche du client ET sur son
ordi, sans qu'aucune machine reste allumée chez nous.
- **L'ordonnanceur est `pg_cron` + `pg_net`** (`supabase/migrations/004-ordonnanceur.sql`),
  jamais Vercel Cron. **Vercel Cron émet des `GET`**, or `/api/campaign/tick`
  et `/api/push/tick` réservent le `GET` au STATUT en lecture seule et le
  `POST` à l'exécution : un cron Vercel aurait rendu 200 toutes les heures sans
  jamais passer un appel. Vert, silencieux, inutile. Et sur un plan Hobby,
  c'est une exécution par jour. Fusionner les verbes pour contenter le cron
  serait le mauvais échange : « lire l'état » et « composer des numéros » ne
  sont pas la même requête.
  > ⚠ Le secret vit dans le **Vault** Supabase, jamais dans le SQL versionné.
- **⚠⚠ LE CRON NE DÉCIDE JAMAIS QUAND APPELER, IL DEMANDE.** C'est la route qui
  refuse hors fenêtre, au-delà du palier, trop tôt après une tentative.
  L'horaire du plan n'est qu'une économie d'invocations : l'élargir ne peut pas
  produire un appel à minuit. **Un test interdit au SQL de recopier la fenêtre
  d'appel** — deux définitions de « peut-on appeler maintenant ? » et c'est
  celle du cron qui gagne, parce qu'elle s'exécute en premier et que personne
  ne relit du SQL.
- **`/moniteur` LIT LE SERVEUR, jamais le store** (`lib/moniteur.ts`), et un
  test interdit `useAlpha` dans cet écran. Le store vit dans le `localStorage` :
  un téléphone et un ordinateur sont DEUX Alpha. L'autopilote, lui, tourne sur
  le serveur — un moniteur branché sur le store afficherait zéro appel pendant
  que le cron en passe quarante, en ayant l'air parfaitement fonctionnel.
  > ⚠ **Seules les tentatives du ROBOT** comptent comme travail de la machine
  > (préfixe d'identifiant posé par `appendCallAttempt`). Sinon l'écran annonce
  > « la machine a passé 3 appels » un jour où l'humain les a passés à la main.
  > La garde est dans un test qui fabrique l'événement avec la VRAIE fonction :
  > changer ce format ferait tomber le moniteur à zéro **en silence**.
  > ⚠ **Un écran de supervision a un mode de panne à lui : afficher du calme.**
  > Base injoignable → `null` et un tiret, jamais `0`. Zéro parce que rien ne
  > tourne, zéro parce qu'on ne voit rien et zéro parce que tout va bien
  > demandent trois gestes opposés.
- **OÙ TOURNE L'AGENT VOCAL — décidé le 09/09/2026.** `voice/agent.py` reste
  **en LOCAL chez nous** ; un VPS ne se monte que **pour les clients**.
  > ⚠ **La conséquence à tenir** : un appel composé sans agent vivant sonne dans
  > le VIDE — la ligne compose, le prospect décroche, personne ne parle. C'est
  > PIRE que de ne pas appeler (fiche brûlée, réputation du numéro, minutes
  > facturées) et `/api/voice/call` rend `dispatched: true` dans les deux cas.
  > **Refermé** par `lib/presence-agent.ts` + migration 005 : l'agent bat toutes
  > les 30 s, le tick REFUSE de composer sans battement récent.
  > · **L'inconnu vaut REFUS.** Ici, contrairement aux écrans de mesure, `null`
  >   ne se contente pas de se dire — il bloque. Ne pas appeler coûte un
  >   créneau ; appeler dans le vide coûte une fiche, un numéro et de l'argent.
  > · La garde ne s'applique **qu'à l'EXÉCUTION** : `dryRun` continue de rendre
  >   ce qu'il aurait fait, sinon on perd l'outil qui explique pourquoi rien ne
  >   part.
  > · Un battement prouve qu'un **processus tourne**, pas qu'il sait parler —
  >   une clé TTS expirée laisserait le voyant vert.
- **Stripe Connect : formule EXPRESS** (décidé le 09/09/2026). On garde la main
  sur le parcours ; le client n'a pas de tableau de bord Stripe à lui.
- **`/ceo`** (`lib/alpha-ceo.ts` + `lib/ceo-sondes.ts`) diagnostique tout ça.
  Sur notre cloud : maître seul, **masqué** et non grisé — griser, c'est
  annoncer, et cette console y parle de NOTRE exploitation. **Livrée aux
  installations client le 20/10/2026** (voir « L'ombrelle des agents ») : là,
  l'exploitation est la sienne.

## Les quatre règles d'écran (elles ont toutes coûté un bug)
1. **`prospectDefaults` (`lib/seed.ts`) est le socle de TOUS les imports**, pas
   des données de démo. Tout champ non optionnel de `Prospect` y a sa valeur
   neutre. Il manquait cinq tableaux → `/aujourdhui` tombait en écran blanc
   après un import terrain. `merge` renormalise à chaque réhydratation, sinon
   le stock déjà écrit dans les navigateurs reste cassé (`migrate` est gated
   par la version).
2. **Une seule façon de demander « a-t-il dit non ? »** :
   `aRefuseTouteRelance` (`lib/voice-script.ts`), tag **et** timeline. La
   question se posait à trois endroits, deux répondaient non — la fiche
   revenait dans la file d'appels et dans le plan du matin.
3. **Un écran se plafonne, et ce qui est replié se COMPTE** (nombre, minutes,
   € pondérés). 1 000 fiches → 1 000 lignes n'est pas un plan de journée,
   c'est l'export du CRM. Vaut pour `/aujourdhui`, le tableau pipeline
   (paginé) et le kanban (borné). On borne l'affichage, **jamais le compte**.
4. **Le mur localStorage se montre AVANT de coller** (`projeterImport`). Une
   écriture qui rate ne ressemble pas à une panne : l'écran continue
   d'afficher les fiches, elles disparaissent en fermant l'onglet. Une fiche
   terrain ≈ 1,3 Ko → 1 000 numéros ≈ la moitié du quota de 5 Mo.

> **La sortie de la 4, quand le volume la dépasse** (`lib/hydratation.ts`) :
> au-delà de ~1 200 fiches aucun élagage ne suffit, et le pipe doit vivre sur
> le serveur — réglage **opt-in** `pipeServeur`, les fiches ne sont plus
> persistées localement (`partialize`) et se chargent au démarrage.
> ⚠ **L'invariant unique qui rend ça sûr : on ne pousse JAMAIS depuis un état
> qu'on n'a pas chargé** (`peutSynchroniser`). Un navigateur qui a raté son
> chargement a une liste vide, et la synchro sortante calcule des
> suppressions. L'état d'hydratation **ne se persiste pas** : le relire du
> disque affirmerait « chargé » sur une liste vide, et rouvrir l'onglet
> effacerait le pipe. Deuxième filet, distinct et voulu : `SEUIL_EFFACEMENT`.
> Corollaire : le moteur de synchro se monte dans la **coquille**, jamais dans
> un écran — sans persistance locale, une synchro qui ne tourne que sur
> `/settings` perd la journée de qui n'y va pas.

> ⚠ Corollaire de la 4 : **ne jamais recopier de la doctrine dans une fiche.**
> Les notes d'import portaient l'explication de chaque signal — mille copies du
> même paragraphe, 47 % du poids — pendant que la phrase du client, elle, était
> jetée. On garde ce qui ne se recalcule pas ; le reste vit dans le code.

## LE MATÉRIAU ET LE RYTHME (`app/globals.css` + `components/ui/page-header.tsx`)
Gardés par `tests/mise-en-page.test.ts`. Trois classes, et **une seule
définition de chacune** — c'est tout le sujet.
- **`.page`** = le rythme d'un écran (`animate-fade-up space-y-5`). Le padding
  appartient à la **coquille**, jamais à la page : deux écrans ajoutaient `p-4`
  par-dessus et avaient un cadre plus épais que tous les autres. Les exceptions
  (`/agent` pleine hauteur, `/login` centré, `/overlay` fenêtre Electron) sont
  **listées avec leur motif** dans le test, et le test refuse une exception qui
  survit à sa page.
- **`.card`** = la plaque de verre de premier plan. Une plaque translucide, ce
  sont **quatre** choses ensemble : transparence · flou · **saturation** ·
  arête haute éclairée + arête basse dans l'ombre. Retirer la saturation
  suffit à la faire rendre **gris et sale** — c'est celle qu'on oublie.
- **`.panel`** = la sous-surface CREUSÉE dans une plaque. Teintée avec
  `--card-fg` (la couleur du TEXTE) : elle s'éclaircit sur fond sombre et
  s'assombrit sur crème sans une seule règle par thème.
- **`.glass-chrome`** = le rail, l'en-tête mobile, la barre du bas. Ils
  encadrent le même contenu et portaient **trois opacités différentes**.

> ⚠ **Pas de verre dans le verre.** Un `backdrop-filter` imbriqué ne floute pas
> la page : il floute le rendu **déjà flouté** de son parent. Ce n'est pas
> « plus de verre », c'est de la boue grise, et chaque niveau coûte une couche
> de composition. `.card .card` et `.card .panel` perdent leur flou d'office.

> ⚠ **Le clair ne redéfinit PAS le matériau, il reteinte les jetons
> `--glass-*`.** `html.light .card` existait et redéclarait ombre + bordure : le
> sombre a reçu le flou et la saturation, le clair **ne les a jamais eus**. Deux
> définitions du même matériau = deux vérités, et les deux « marchaient ».

> ⚠ **Une carte sans flou doit devenir OPAQUE, sinon elle est illisible** — le
> texte se pose sur le dégradé et le grain de la page. Deux cas réels : le
> navigateur qui ne sait pas flouter (`@supports not`), et l'utilisateur qui a
> demandé moins de transparence dans son système
> (`prefers-reduced-transparency`, réglage d'**accessibilité** — même statut
> que `reduced-motion`, qu'on respecte déjà).

- **`PageHeader`** est le seul endroit où s'écrit un titre d'écran (la chaîne
  `font-display text-2xl font-bold text-paper` était recopiée dans 35
  fichiers). Ordre imposé : sur-titre → `<h1>` → phrase → actions. La
  **pastille d'état a sa propre entrée** et se rend HORS du `<h1>` : dedans, un
  lecteur d'écran annonce « titre : Machin Négociation » d'un bloc.

## LE TÉLÉPHONE EST UN POSTE DE TRAVAIL, PLUS UN ÉCRAN DE CONSULTATION
`lib/modes-mobile.ts` · `StepDef.surface` (`lib/onboarding-path.ts`) ·
`tests/modes-mobile.test.ts` · décidé le 12/09/2026.

La coquille portait une justification écrite : « on règle depuis un ordinateur,
on regarde ce que la machine a fait depuis un téléphone ». Elle était vraie
quand l'autopilote demandait une machine allumée. **Il tourne sur le serveur
depuis le 09/09** — la phrase est morte le jour de cette bascule, et les deux
défauts qu'elle couvrait sont restés.

### 1. La barre du pouce n'atteignait ni le pipeline, ni les campagnes, ni le CEO
Cinq entrées FIGÉES. Trois des écrans les plus utilisés imposaient d'ouvrir la
palette et de taper.
- **Cinq entrées, toujours** — la contrainte est physique, elle tient. On ne
  rallonge pas la barre : on change ce qu'elle DÉSIGNE. Un **mode** = un moment
  du métier (terrain · pipeline · campagnes · closer · Alpha CEO), mémorisé par
  navigateur, sélecteur dans l'en-tête (lui donner une place dans la barre
  l'aurait payé avec un écran).
- **Le mode par défaut reprend l'ancienne barre à l'identique**, et c'est
  testé : sur une barre de pouce on clique par mémoire musculaire, pas en
  lisant. Une nouveauté qui déplace ce que les gens savent faire se paie en
  désorientation.
- **Les modes ne créent aucun écran et n'en cachent aucun** : ils réordonnent
  l'accès. Un test exige que chaque route d'un mode existe dans la navigation —
  sinon on aurait une deuxième navigation, qui divergerait.
- **`maitreSeul` MASQUE, `brique` GRISE.** Alpha CEO disparaît chez un client
  (griser, c'est annoncer notre économie) ; les campagnes restent visibles et
  grisées chez un gratuit (on ne peut pas vouloir ce qu'on ne voit pas). C'est
  la doctrine du rail, appliquée au pouce.
  > ⚠ **Un mode mémorisé qui n'est plus visible ne doit pas vider la barre.**
  > Cas réel : le propriétaire choisit « Alpha CEO », puis ouvre l'app avec un
  > compte client dans le même navigateur. Sans repli, la barre n'a plus
  > AUCUNE entrée — et une barre vide ne ressemble pas à un droit manquant,
  > elle ressemble à une panne.

### 2. Le parcours d'installation s'arrêtait au deuxième barreau sur un mobile
`/demarrage` déroule ses étapes dans l'ordre. La deuxième est « Brancher
l'envoi email », dont le premier geste est « colle-le dans `.env.local` ». Sur
un téléphone, ce geste n'existe pas — et **rien ne disait que les treize
suivantes se font très bien au pouce**. On repose le téléphone en pensant que
le produit n'est pas pour soi.
- **`StepDef.surface` est OBLIGATOIRE** (`"partout" | "ordinateur"`). Un défaut
  implicite ferait passer une étape de plomberie pour une étape de pouce au
  premier ajout distrait. Mesuré : le script qui a posé ces valeurs a **sauté
  `n8n`** — identifiant avec un chiffre — et c'est `tsc` qui l'a rattrapé.
- **Cinq étapes sur dix-huit exigent une machine** : SMTP, DNS, IA, n8n,
  webhook entrant. Toutes les autres se font au téléphone. Le produit était
  déjà mobile ; son parcours d'installation ne le savait pas.
  > ⚠ Conséquence mesurée, et elle est forte : **un compte GRATUIT n'a aucune
  > étape d'ordinateur** — les cinq servent des briques qu'il n'a pas, et le
  > filtre par droits les retire déjà. Son installation est intégralement
  > faisable depuis un téléphone.
- **⚠⚠ ON NE CACHE PAS les étapes d'ordinateur sur mobile, on les SÉPARE**, avec
  le motif de chacune. Filtrer donnerait un écran propre et un parcours qui se
  termine en croyant avoir tout installé — alors que les emails ne peuvent pas
  partir. Et « pas faisable sur mobile » sans raison se lit comme une limite du
  PRODUIT, alors que c'est une limite du GESTE.
- **« Rien à faire ici » et « tu as fini » ne se disent pas pareil**
  (`bloqueSurMobile`). Même mode de panne que le moniteur qui affiche du calme
  quand la base est injoignable.

> ⚠ **Vu au RENDU, jamais déduit** : le bloc mobile et l'encadré « prochaine
> action » affichaient LA MÊME ÉTAPE l'une sous l'autre dès qu'elle était
> faisable au pouce — c'est-à-dire la plupart du temps. Deux cartes identiques
> ne se lisent pas comme une redite, elles se lisent comme un bug. L'encadré
> général est passé `hidden md:block`.

## « DONNE TON SITE, ALPHA SE CONFIGURE » (13/10/2026)
`lib/lecture-site.ts` · `app/api/onboarding/site` · `components/lire-mon-site.tsx`
(dans « À qui vends-tu ? ») · `tests/lecture-site.test.ts`.

L'inscrit colle l'adresse de son site ; le serveur lit l'accueil + trois pages
au plus (contact, mentions légales, à propos — MÊME hôte, garde-fou SSRF rejoué
à chaque redirection) et pré-remplit profil, identité, ville, lien de RDV.
- **On lit, on n'invente pas.** Chaque valeur porte sa source et l'extrait où
  elle a été lue ; ce qui manque se DIT (`manques`). Pas de clientèle nommée sur
  le site → le secteur reste vide et le bouton dit pourquoi.
- **La clientèle est une suggestion avec preuve**, comptée, jamais un verdict ;
  « entreprise de … » nu ne range personne en B2B.
- **⚠⚠ Le dirigeant lu sur les mentions légales n'est JAMAIS signataire
  d'office** : case « c'est moi » décochée par défaut. Celui qui s'inscrit n'est
  pas forcément lui (`lib/signature.ts` : on ne devine pas l'identité d'un humain).
- **Gratuit** (`/api/onboarding` → `/settings`) : aucun modèle, aucun crédit —
  des requêtes vers le site de l'inscrit et le registre public si un SIREN
  valide (clé de Luhn) y est écrit.
- **Limite** : un site rendu en JavaScript (sans HTML serveur) se lit mal par
  `fetch` direct ; `SCRAPE_ENDPOINT` ne s'applique pas à cette voie aujourd'hui.
### LE PREMIER ÉCRAN D'UN INSCRIT : `/bienvenue` (13/10/2026)
`lib/bienvenue.ts` · `app/(app)/bienvenue/page.tsx` · `tests/bienvenue.test.ts`.
La lecture existait, rangée dans un bandeau replié : personne ne l'ouvrait le
premier jour. Un client connecté, sans profil, est désormais emmené UNE fois
(`proposerBienvenue`, depuis `/` ou `/aujourdhui` seulement) sur un écran à
une question — son site — puis voit chaque réglage se poser, avec sa source
et ce qu'il change, avant de valider.
- **Une étape n'existe que si elle règle quelque chose** : l'email et le
  téléphone lus ne s'affichent pas, aucun réglage ne les reçoit. Un test
  exige que chaque `reglage` annoncé soit écrit par la validation.
- **Pendant la lecture, on DIT ce que fait le serveur, on ne coche rien** :
  une barre de progression inventée est une petite preuve fabriquée.
- **`patchReglages` est la seule définition** de « qu'est-ce qu'une lecture
  a le droit d'écraser ? » — partagée avec le formulaire « À qui vends-tu ? ».
  Une valeur non lue n'efface jamais une valeur posée.
- **Le maître est prévenu avant de valider** : montrer la lecture devant un
  prospect est un usage voulu ; la valider depuis notre compte remplacerait
  notre raison sociale par la sienne.
- ⚠⚠ **`/api/onboarding/site` exige une session** : son chemin métier
  (`/settings`) est commun, donc ouvert à TOUTE requête. N'importe qui
  faisait lire n'importe quel site par notre serveur. 401 sans compte,
  testé par mutation.
- **Vu au rendu, pas déduit** : le champ écrasé à dix caractères sur mobile,
  et les réglages qui se posaient sous la ligne de flottaison — l'écran suit
  désormais chaque étape (sauf en mouvement réduit).

## DEUX FORMES : EN LIGNE GRATUIT, CHEZ VOUS PAYANT (20/10/2026)
`DEUX_FORMES` (`lib/public-catalogue.ts`) · `OFFRE_CHEZ_VOUS` (`lib/offres-publiques.ts`) ·
`tests/deux-formes.test.ts`. Décision de Zakaria, en trois choix :

| | En ligne (le cloud) | Chez vous |
|---|---|---|
| Prix | **gratuit**, sans durée | **la grille complète** : 10 000 € + socle + siège |
| Ce qui consomme (IA, email) | s'ouvre **avec les comptes du client** (BYOK) | les comptes du client |
| Téléphonie | **pas de clé par locataire** → pas en ligne | comprise |
| Où ça tourne | chez nous | **sur LE serveur du client**, installé à la main |

- **« Chez vous » n'est pas une 8ᵉ offre** : c'est `business` (dix briques,
  installation, abonnement au siège). Deux définitions du même produit au même
  prix auraient divergé. Un test exige qu'elle ouvre TOUTES les briques.
- **On ne promet une clé que pour ce que le produit sait servir** : `ia` et
  `email` (`lib/capacites-cle.ts`). Un test refuse « appels / téléphonie avec
  vos comptes » tant que la capacité n'existe pas — sinon l'écran envoie le
  client vers une porte que le serveur refuse.
- **« Vos données ne quittent jamais votre serveur » est INTERDIT** : une clé
  d'IA envoie du texte au fournisseur du modèle. On dit où tournent
  l'application et sa base, et à qui sont les comptes.
- `FRONTIERE_PAYANT` affirmait encore « aucun chemin d'identifiants par
  locataire » — faux depuis le BYOK, et servi sur la page publique. Réécrite.

> ⚠⚠ **TRANCHÉ LE MÊME JOUR : retirés de la VENTE** (`OFFRES_RETIREES`) —
> les abonnements Alpha Voice du cloud (149/349, omnicanal, 1 000 appels) et
> le Lifetime. **On désactive, on ne supprime pas** : les définitions restent
> dans `OFFRES` (webhook Stripe, provisionnement), mais vitrine, `/souscrire`,
> paiement (**410**), écran de refus et grille apporteur lisent
> `OFFRES_EN_VENTE`. Un test refuse qu'une de ces surfaces relise `OFFRES`.
> · L'écran de refus propose donc « chez vous » pour Alpha Voice.
>   `peut-se-payer` comparait `prixHT` à un CA MENSUEL : sur « chez vous » ce
>   prix est l'installation (10 000 €) — il lit désormais l'abonnement du plan.
> · Le garde-fou neuf a mordu au premier passage : la FAQ promettait encore
>   « l'installation ne se paie qu'au premier rendez-vous », renvoyant à des
>   bords « écrits plus bas » qui venaient d'être retirés.
> · `eagleyecorp.fr` (`site/`) suit : plus de « Voir l'offre » Alpha Voice,
>   les deux formes dites. **Il se publie à la main** (glisser `site/` sur
>   Netlify Drop) — rien ne part tant que ce geste n'est pas fait.
>
> ⚠⚠ **LIVRER « CHEZ VOUS » : `ALPHA_INSTALLATION=client`** (20/10/2026,
> `installationClient()` · `tests/installation-client.test.ts` · procédure
> `docs/INSTALLATION-CHEZ-VOUS.md`). Trois défauts trouvés en suivant le
> chemin RÉEL d'une installation, tous fermés le même jour :
> · **Sans serrure** une installation retombait au socle gratuit (le client
>   payait tout, les briques vendues restaient fermées) ; **avec mot de passe**
>   le solo la rendait MAÎTRE — nos marges (`/api/voice-costs`), notre playbook,
>   `/payouts`, ouverts sur SON serveur. Le mode client rend TOUTES les briques
>   et `maitre: false`, et le middleware contrôle les droits dans ce mode (sans
>   ça, aucun contrôle ne s'exécutait). Il **exige une serrure** : sans
>   mot de passe ni comptes, le repli gratuit reste. Testé en APPELANT le
>   middleware, vérifié par mutation.
> · **`.dockerignore` n'excluait pas `donnees-privees/`** : une image construite
>   sur ta machine pouvait embarquer nos fiches réelles chez un tiers.
> · **`docker-compose.yml` ne transmettait ni `SITE_PASSWORD` ni le mode**, et
>   publiait Ollama (aucune authentification) et n8n sur toutes les
>   interfaces. Les trois services sont liés à `127.0.0.1` ; Caddy devant.
> · Une équipe exige des comptes (Supabase à SON nom) : sans eux, chaque
>   navigateur garde son CRM. Et l'appel sortant en autopilote refuse de
>   composer sans battement de présence, qui s'écrit en base.
>
> ⚠ **Ce qui reste ouvert** :
> · **Aucune installation n'a encore été faite hors de chez nous** : la
>   première est le test (une demi-journée, retour arrière prévu).
> · **Hébergement « sans argent »** : le site tourne sur Vercel, dont le plan
>   gratuit (Hobby) est réservé au NON commercial. Netlify gratuit l'autorise
>   (sources tierces) mais plafonne à **300 crédits/mois, ~15 par mise en
>   production** — un déploiement à chaque push vide le quota en vingt
>   commits, et **tous les sites du compte sont alors mis en pause**,
>   `eagleyecorp.fr` compris. Déployer depuis une branche dédiée, pas à chaque
>   commit.

## LES VIDÉOS, ET L'OBJECTIF DES 10 M (20/10/2026)
`.claude/skills/alpha-motion/SKILL.md` · `scripts/video/` · `docs/OBJECTIF-10M.md`.

- **Une vidéo se fabrique avec HyperFrames**, installé HORS du produit
  (`scripts/video/hyperframes-bac-a-sable.sh` : Chromium local, ffprobe, GSAP
  copié — le CDN est refusé ici —, télémétrie coupée). Prouvé sur deux rendus
  d'essai, pas encore sur une vidéo complète. Le son : `bande-son.mjs`,
  synthétisé et **déterministe** (testé).
- **Nos vidéos d'octobre portaient les trois défauts** qu'HyperFrames nomme
  comme signature du « diaporama d'agent » : ressort qui dépasse, cartes qui
  oscillent en boucle, poussée lente en fin de scène — plus une ligne de huit
  mots lisible 0,55 s. Corrigés sur la vidéo du 21/10 ; la règle est dans la
  compétence, pas dans ma mémoire.
- **« Montre la chose »** (/brag) : les vrais écrans, capturés par
  `scripts/pub/capturer.mjs` sur le jeu de démo, battent des cartes dessinées.
- **⚠⚠ LE FILM « LE CYCLE » (21/10/2026)** — `scripts/video/compositions/cycle/` ·
  `marketing/post-cycle-agents-2026-10-21.md` · `tests/film-cycle.test.ts`. Sans
  exemple, les huit agents dans l'ordre du cycle, les cinq moments qui reviennent
  à l'humain, les quatre surfaces qui le préviennent (bande, onglet, notification,
  journal). Le code visuel EST l'argument : machine = sombre et bronze, humain =
  papier clair. **Prêt, pas publié** (zéro envoi LinkedIn sans ton « go »).
  · **Le test JOUE la timeline** (GSAP simulé, aucune dépendance) et mesure le
    plancher de lecture : cinq textes tenaient trop peu sur une composition que je
    croyais conforme. La règle « 0,3 s par mot » vivait en prose.
  · **J'y avais écrit deux universels faux** — « chaque action est consignée »
    (le journal = les 12 derniers événements du CRM) et « sur chaque écran » (pas
    sur `/login`, ni `/overlay`). Trouvés en relisant, avant publication ; le garde
    refuse désormais la forme « chaque / tous les X est… ».
  · **Le post dit la frontière que le film ne peut pas tenir en 27 s** : en ligne,
    tout tourne dans le navigateur, onglet ouvert ; ALPHA VOICE, ALPHA ASSIST et
    ALPHA CEO s'installent chez vous. Cette phrase est dérivée de `AGENTS_ALPHA`.
  · « Ton 100 M » = l'exécution (retenue, rythme, son), jamais un chiffre, un logo
    ou un label qu'on ne pourrait pas défendre en rendez-vous.
- **⚠⚠ LE SPOT TV (22/10/2026)** — `scripts/video/compositions/spot-tv/` ·
  `docs/SPOT-TV.md` · `tests/film-spot-tv.test.ts`. 30 s, 1920×1080, 25 i/s, vrais
  écrans en mode inscrit, données fictives ; on remplace la RÉPONSE du BODACC, jamais
  l'app. **La télévision se mesure** : mentions ARPP à 22 px réels de hauteur d'x
  (lue dans la police, revue sur l'image : 23 px), −23 LUFS relus sur le fichier
  écrit (`scripts/video/mastering-tv.sh`). **Prêt pour l'avis ARPP, pas diffusé** —
  l'avis et le format de la régie sont sur Zakaria.
- **10 M ne se met pas dans un `/goal`** : l'évaluateur ne lit que la
  conversation, et ce conteneur ne joint pas Supabase. Le nord vit dans
  `docs/OBJECTIF-10M.md` ; chaque `/goal` vise un livrable prouvable du palier
  suivant. Le premier mur n'est pas le marketing : **les emails de
  confirmation d'inscription**, plafonnés par Supabase et partis de la boîte
  de prospection.

- **On remplit la limite d'abord** (décision du 20/10/2026) : pas de boîte de
  confirmation dédiée, pas de plan d'hébergement avant que le mur des emails
  soit atteint. Le coût de ce choix est écrit dans `docs/OBJECTIF-10M.md`.
- **⚠⚠ LE TABLEAU D'ADOPTION EST CELUI DES PROPRIÉTAIRES, PAS CELUI DES
  COMPTES** (20/10/2026 — « alpha sales os dépasse EAGLEYE CORP maintenant »).
  `/adoption` (`lib/adoption.ts` · `017-adoption.sql` · `/api/adoption`) : maître
  seul, **masqué** chez les autres, **absent des installations client**
  (`CHEMINS_EXPLOITATION` ne l'ouvre pas). Il a quitté `/ceo` — console qu'on
  LIVRE — où une première version l'avait logé : un test refuse qu'il y revienne.
  · **Il compte des COMPTES, jamais ce qu'ils font** : le serveur ne voit rien
    des fiches d'un compte gratuit, et c'est la promesse. Mesurer l'usage serait
    une télémétrie — elle se DÉCIDE.
  · **L'agrégat se calcule EN BASE** (`adoption_stats`, jouée sur un Postgres 16
    réel : `anon` et `authenticated` refusés, `service_role` accepté, rejouable).
    Lire la liste des comptes page par page tient à cent inscrits, pas à dix
    millions. Sans la migration, la lecture REPLIE sur l'API d'administration
    (total + dernière heure seulement) et **nomme la migration manquante**.
  · **Nos comptes sont exclus** (`OWNER_EMAILS` passé à chaque appel, jamais
    stocké) : le palier « 10 » dit « dix comptes qui ne sont pas les nôtres ».
    Quand l'exclusion n'a pas eu lieu, l'écran le dit.
  · **`null` n'est pas `0`**, jamais un taux nu (« 41 confirmés sur 50 »), et
    « connectés » est dit **sous-compté** (`last_sign_in_at` = dernière saisie
    du mot de passe, pas dernière visite). Sept mutations mordent.

### BRANCHER SES COMPTES EN DEUX CHAMPS (20/10/2026)
`lib/identifiants-assistes.ts` · `app/api/credentials` (+ `/detect`) ·
`components/settings/cle-ia.tsx` · `tests/identifiants-assistes.test.ts`.

Décision de Zakaria : « le moins de friction possible ». Mesuré avant d'écrire :
la boîte d'envoi demandait QUATRE champs techniques (serveur, port, identifiant,
mot de passe), l'IA deux champs de clé sans dire lequel sert à quoi. Sans
identifiants rien ne s'ouvre — c'est l'écran où un inscrit abandonne.
- **IA : UNE clé, collée n'importe où.** Elle se reconnaît à sa forme
  (`sk-ant-` Anthropic, `nvapi-` NVIDIA), se nettoie (guillemets, saut de
  ligne, `export CLE=…`, bloc `.env` entier) et, si elle est valide, se vérifie
  au COLLER, sans second clic. **Une clé qu'ALPHA ne sait pas servir (OpenAI,
  Gemini, Groq) est refusée tout de suite**, avec la phrase qui dit quoi faire —
  pas après quinze secondes d'un refus d'un fournisseur qui n'est pas le sien.
- **Envoi : UNE adresse + UN mot de passe.** L'hébergeur se déduit de l'adresse
  (Gmail, Outlook, Orange…) puis, pour un domaine perso, de son enregistrement
  MX (`/api/credentials/detect`, session exigée : sinon c'est un résolveur DNS
  ouvert). Le serveur et le port se déduisent ; **le port se REPLIE** (587 puis
  465, ou l'inverse selon l'hébergeur) et on enregistre celui qui a authentifié.
- **⚠⚠ LA TABLE DES HÉBERGEURS EST ÉCRITE DE MÉMOIRE ET NE FAIT JAMAIS FOI.**
  Aucune de ses adresses n'a été jointe d'ici (le proxy sortant refuse le
  SMTP). Elle PROPOSE ; `verifierBoite` se connecte ET s'authentifie vraiment
  avant d'accepter : `ok` veut dire « une connexion authentifiée a eu lieu ».
  Une ligne fausse produit un refus lisible, jamais une boîte enregistrée à tort.
- **Hébergeur inconnu → on DEMANDE le serveur**, on ne devine pas
  « smtp.<domaine> » : réussir une fois sur deux fabrique des échecs inexplicables.
- **Un mot de passe REFUSÉ arrête tout** : le serveur est joint, un autre port
  n'y change rien (et marteler un serveur qui a dit non brûle une réputation).
  Le conseil dit CE QU'IL FAUT FAIRE (« mot de passe d'APPLICATION, pas celui de
  ta messagerie » + le lien pour le créer), jamais le message brut seul.
- **Le secret ne revient toujours JAMAIS du serveur** (empreinte seulement).
  Sept mutations mordent.

### « LANCER ALPHA » — LA MISSION EN UN BOUTON (20/10/2026)
`lib/mission-alpha.ts` · `components/mission/lancer-alpha.tsx` (monté en haut de
`/aujourdhui`) · `tests/mission-alpha.test.ts` · analyse complète :
`docs/STATION-AUTONOME.md`.

Décision de Zakaria : ALPHA doit travailler « comme Cowork ou Manus » devant
l'utilisateur. **Aucun des projets open source de la liste n'est une dépendance**
(licences, langage, et surtout parce que leur pouvoir — navigateur, exécution de
code — est ce que la doctrine refuse) ; on prend leurs PATRONS, déjà écrits ici.
⚠ **Suna/Kortix est sous Elastic License 2.0 : interdit comme base d'un SaaS.**
- **Six étapes RÉELLES**, rendues à mesure qu'elles finissent : lire le pipe,
  trier (`triageImport`, le verdict est celui de l'import mot pour mot), décider
  (`computeRoutines`), préparer les messages, constituer la liste d'appels,
  bilan. **Aucun délai d'ambiance, aucune barre de progression** : une étape
  instantanée est instantanée (une progression inventée est une petite preuve
  fabriquée). Le décalage entre les cartes est une animation d'entrée.
- **⚠⚠ UN SEUL GESTE QUI ÉCRIT : préparer des brouillons.** `ActionsMission` n'a
  aucune fonction d'envoi, d'appel ou de suppression : ce n'est pas une
  consigne, il n'existe rien à appeler. Un test lit l'interface. Le bilan dit
  « rien n'est parti » en toutes lettres, et le résultat porte `envoyes: 0`.
- **⚠⚠ UNE MISSION RELANCÉE N'ÉCRASE JAMAIS LES BROUILLONS.**
  `prepareCampaignDrafts` REMPLACE ceux d'une campagne ; sans la garde
  « cette campagne a déjà des brouillons : on n'y touche pas », relancer le bouton
  perdait la relecture de la veille. Trouvé en lisant la fonction, tenu par mutation.
- **Une seule définition de « ce qui t'attend »** : le bilan et la bande de
  présence lisent `computeRoutines`, le bilan APRÈS la préparation (il relit
  l'état à chaque étape — un état figé au départ compterait à rebours).
- **La boîte d'envoi se branche SUR PLACE** quand c'est ce qui manque (et
  seulement à un compte locataire, seulement s'il y a des messages à envoyer).
- **Ça tourne dans le navigateur, onglet ouvert, et l'écran le dit.** ALPHA qui
  travaille pendant que l'inscrit dort exige que son pipe vive chez nous :
  **TRANCHÉ le 21/10/2026 (Zakaria) — NON** (`docs/STATION-AUTONOME.md`, § 4-5).
  Sept mutations mordent.

### « ALPHA A BESOIN DE TOI » — la présence d'un agent, et ce qu'elle ne prétend pas (20/10/2026)
`lib/presence-alpha.ts` · `components/shell/alpha-presence.tsx` (monté dans la
coquille) · `tests/presence-alpha.test.ts`.

Décision de Zakaria : ALPHA doit se vivre comme un agent qui travaille et qui
PRÉVIENT quand un humain est nécessaire (« comme Manus ou Cowork »), pas comme
un tableau qu'on ouvre pour chercher quoi faire. Première tranche : une bande
sur chaque écran, un « (3) » dans l'onglet, une notification quand un point
URGENT apparaît.
- **Une seule définition de « ce qui attend un humain » : `computeRoutines`**
  (celle de l'accueil, de `/pilote` et de l'Agent ALPHA). La bande ne recompte
  rien ; un test refuse que `lib/presence-alpha.ts` relise les fiches. `/decisions`,
  `lib/priorites`, `lib/push-digest` et `lib/alpha-ceo` posent chacun une
  variante de la même question — **dette connue, non réparée ici.**
- **Les règles de la notification sont celles de `lib/push-digest.ts`** : hors
  fenêtre utile on se tait (la même `fenetreOuverte`), UNE notification par
  passage, seules les routines HAUTES interrompent, un intervalle minimal.
  Plus deux, trouvées en écrivant : **le premier passage est une ligne de base**
  (sinon chaque ouverture rejouait l'arriéré) et **une nouveauté tue — hors
  fenêtre — reste nouvelle** (la marquer « vue » sans l'avoir dite la perdait).
  Sept mutations mordent.
- **La permission ne se demande JAMAIS toute seule** : un bouton, un geste.
- **⚠⚠ CE QUE ÇA NE FAIT PAS, ET IL FAUT LE DIRE À UN INSCRIT.** Tout tourne
  DANS LE NAVIGATEUR, onglet ouvert. Le serveur ne voit pas le CRM d'un compte
  gratuit (la promesse de souveraineté) : il ne peut ni travailler à sa place ni
  le prévenir app fermée. **Un agent qui agit SANS l'onglet exige que le pipe
  vive sur un serveur (`pipeServeur`, opt-in) ET un tick par locataire** — ce
  qui n'existe aujourd'hui que pour NOTRE pipe (`/api/push/tick` lit
  `lireProspectsOperateur`) et pour une installation « chez vous ». C'était le
  vrai chantier de l'autonomie, et une décision de souveraineté : **TRANCHÉE le
  21/10/2026 — NON, le pipe d'un inscrit en ligne ne vit pas chez nous.**
  · **L'onglet ouvert est donc la frontière, plus un manque provisoire** : la
    bande ne promet jamais le contraire à un inscrit, et personne ne code « un
    tick par locataire » sur le cloud. La promesse « rien de ce qui touche la
    donnée MÉTIER ne passe par un tiers » reste entière — c'est elle qui tient
    la vitrine.
  · **Conséquence commerciale, à dire telle quelle** : un ALPHA qui travaille
    app fermée existe, mais seulement sur l'installation « chez vous » (le
    pipe est sur SON serveur, le tick est le sien — `ALPHA_INSTALLATION=client`).
    C'est une raison d'acheter la grille complète, pas une fonction gratuite
    qui attend d'être codée.
  · `pipeServeur` reste ce qu'il est (volume, opt-in) et ne sert PAS de porte
    dérobée vers l'autonomie : l'ouvrir à un inscrit en ligne rouvrirait la
    décision, en une ligne qui se verrait au diff.

### « ALPHA AU TRAVAIL » — ce que la machine fait, étape par étape, en mouvement (21/10/2026)
`lib/circuit-alpha.ts` · `lib/alpha-ici.ts` · `app/(app)/travail` ·
`components/alpha/` · `components/shell/alpha-ici.tsx` ·
`tests/circuit-alpha.test.ts` · `tests/alpha-ici.test.ts`.

Décision de Zakaria : un tableau de bord pour l'UTILISATEUR qui montre ce
qu'ALPHA fait, « toutes les pages donnent l'info détaillée de chaque étape », et
en mouvement comme la lecture du site à l'inscription. Deux surfaces :
`/travail` (pouls · circuit des huit étapes · garde-fous armés · journal) et, sur
les écrans que le registre a lus, une ligne « Ce qu'ALPHA fait ici » montée UNE
fois dans la coquille, sous la bande de présence.
- **⚠⚠ Chaque ligne « ce qu'ALPHA fait » NOMME son fichier et son symbole, et un
  test les ouvre.** Une description qui dérive du code ne casse rien : elle
  ment, à l'endroit où l'on vient lire ce que fait le produit. Même règle que
  `lib/promesse.ts` pour les preuves de la vitrine. Il a mordu dès le premier
  passage — **sur son propre outil** : mon retrait de commentaires par
  expressions régulières a avalé la déclaration de `STAGES`, parce qu'un
  commentaire de LIGNE de `lib/hormozi.ts` contient une étoile entre deux barres
  (`app/(app)/*/page`) que l'expression prenait pour l'ouverture d'un bloc. Un
  vrai lecteur (chaînes, `//`, bloc) l'a remplacé (`tests/citations-alpha.ts`).
- **Le mouvement n'accompagne que des FAITS** : une carte qui entre à l'écran,
  un nombre qui CHANGE, une ligne neuve du journal. **Aucune animation qui
  boucle** (un test refuse `animate-pulse`, `spin`, `infinite`… dans ces
  composants) : un écran qui dit « ALPHA agit » avec un voyant qui clignote est
  une petite preuve fabriquée. Les nombres s'animent en JavaScript — le réglage
  « réduire les animations » est donc respecté DEUX fois (feuille de style +
  `useReduitMouvement`), et un test exige la branche.
- **Aucune définition de plus** : « ce qui attend un humain » est
  `attendentUnHumain` (extrait de `presenceAlpha`, que la bande utilise
  toujours) ; les étapes sont `STAGES` ; la fenêtre, le plafond et le refus
  viennent de leurs modules. « À toi » compte des **fiches**, pas des routines
  (trois choses sur une fiche = une fiche), rangées par l'étape de LA FICHE
  visée — aucune table « catégorie → étape » à tenir.
- **Un écran absent du registre n'affiche RIEN**, jamais un texte générique :
  on ne décrit pas ce qu'on n'a pas lu. **Tranche 1 = sept écrans**
  (`/aujourdhui`, `/pipeline`, `/decisions`, `/appels`, `/campaigns`,
  `/linkedin`, `/cerveau`) ; les autres s'ajoutent un par un, avec la même
  preuve, et le test refuse une route qui n'existe pas. « Toutes les pages » est
  un programme, pas un commit.
- **La frontière reste dite** : tout lit le CRM du NAVIGATEUR, onglet ouvert
  (décision du 21/10). L'écran écrit que l'ALPHA qui travaille app fermée
  n'existe que sur l'installation « chez vous ».
- Vu au rendu (mobile et bureau, aucun débordement) ; **treize mutations
  mordent**.

## L'OMBRELLE DES AGENTS — et ALPHA CEO livré aux clients (20/10/2026)
`lib/agents-alpha.ts` · `tests/agents-alpha.test.ts` · `Entitlement.exploitant` ·
`CHEMINS_EXPLOITATION` / `API_EXPLOITATION` · `tests/installation-client.test.ts`.

- **Les noms des agents sont TOUJOURS EN CAPITALES** (décision de Zakaria) :
  ALPHA SCOUT · ALPHA VOICE · ALPHA CAMPAGNES · AGENT ALPHA · ALPHA LIVE ·
  ALPHA ASSIST · ALPHA CERVEAU · ALPHA CEO. Une seule définition, que la
  vitrine importe et que posts et vidéos recopient à la lettre.
  > ⚠ **ALPHA ASSIST = l'IA DU CLIENT, branchée par MCP ou clé d'API** (« Votre
  > IA » dans la vidéo d'orchestration). Elle ne se confond pas avec AGENT
  > ALPHA, qui est NOTRE IA dans l'app : deux noms proches, deux pouvoirs
  > différents. **Elle entre par la clé de l'hôte, pas par un écran**
  > (`entree: "cle-de-l-hote"`) : `/controle`, où l'on relit ses propositions,
  > est gratuit — jugée sur lui, elle serait annoncée « en ligne, gratuit »
  > alors qu'un inscrit ne peut pas la brancher (clés dans l'environnement du
  > serveur, jeton OAuth réservé au maître). Elle est donc « chez vous ».
- **⚠ L'ombrelle NE RENOMME AUCUN ÉCRAN** (« renomme pas dans l'app »). Les
  écrans gardent « Le Cerveau », « Campagnes » ; chaque agent DÉSIGNE des
  écrans existants, et un test refuse un écran inconnu du contrôle d'accès.
- **Chaque agent dit ce qu'il n'a pas le droit de faire, et nomme le fichier
  qui l'en empêche** — la règle « plus un agent réfléchit, moins il a le
  droit d'agir ». ALPHA SCOUT cherche au registre public À LA DEMANDE, trie
  ce qu'on lui donne, et n'aspire jamais rien (voir « TROUVER DES CLIENTS »).
- **La disponibilité est DÉCLARÉE (le module n'importe rien : la vitrine est
  un composant client) et VÉRIFIÉE** contre `peutOuvrir` et
  `cheminOuvertParCle`. ⚠ Elle a mordu au premier passage : j'avais annoncé
  ALPHA CAMPAGNES « chez vous » seulement, alors que la clé email du client
  l'ouvre en ligne. Une vitrine qui sous-vend une porte ouverte ment aussi.
- **ALPHA CEO est livré aux installations client.** Sur NOTRE cloud,
  `/ceo` et `/moniteur` restent au maître : ils parlent de notre
  déploiement. Sur le serveur d'un client (`ALPHA_INSTALLATION=client`), le
  déploiement, le SMTP et le pipe opérateur SONT les siens — `exploitant:
  true` ouvre sa console (`/ceo`, `/moniteur`, `/api/moniteur`) et RIEN
  d'autre : marges, playbook, fiches, `/payouts`, `/offre` restent fermés
  partout. Prouvé en appelant le middleware, et par quatre mutations.
  > ⚠ **Une console livrée doit se taire sur ce qui n'est qu'à nous**
  > (`seulementChezNous`) : prix Stripe, enveloppe d'essais, modules morts,
  > statut des apporteurs. Sans ça, le client recevait « renseigne
  > STRIPE_PRICE_* » sur sa propre console — une alarme qu'aucun de ses
  > gestes n'éteint, donc une console qu'il apprend à ne plus lire.
  > `/api/health` dit l'installation ; une valeur inconnue retombe sur « chez
  > nous », jamais sur le mode client.

## FREEMIUM — qui entre, et ce qu'il obtient (`lib/entitlements.ts`)
**L'inscription est LIBRE** : n'importe qui crée son compte quand il veut. Il
démarre à **zéro + le jeu de démonstration**, avec **ses propres identifiants**.

| | Ce qu'on ouvre |
|---|---|
| **GRATUIT**, sans limite de durée (`BRIQUES_GRATUITES`) | `crm` · `closer` · `cerveau` · `pilotage` · `alpha-live` — **tout ce qui tourne chez TOI** |
| **PAYANT** | `campagnes` · `alpha-voice` · `agent-alpha` · `audits` · `tracking` — **tout ce qui DÉPENSE chez nous** |
| **MAÎTRE seul** | `/payouts`, `/offre`, `MAITRE_SEULEMENT` — notre économie |

### LE BUT DU GRATUIT : qu'il rapporte assez pour payer la suite (12/09/2026)
Ce n'est **pas** de donner un aperçu. C'est qu'un opérateur sans un euro puisse
prospecter POUR DE VRAI — cibler, écrire, approcher, appeler, décrocher des
rendez-vous, en tirer du chiffre — et acheter **ensuite** ce qui lui fait gagner
du temps. Un gratuit qui s'arrête avant le premier rendez-vous ne convertit
personne : il fabrique des comptes morts.

**La frontière : écrire est gratuit, envoyer depuis NOTRE infrastructure se paie.**

> ⚠⚠ **TROIS ÉCRANS ÉTAIENT PAYANTS SANS NOUS COÛTER UN CENTIME**, et les trois
> pour la même raison : rangés par **famille**, pas par coût. Le même défaut que
> `alpha-live`, à trois endroits de plus.
> · **`/linkedin`** — mesuré : **zéro `fetch`** dans la page. Les messages se
>   copient à la main, la doctrine le disait déjà ailleurs. C'est le canal par
>   défaut de notre propre ICP, et il était derrière un paywall.
> · **`/templates`** — n'appelle que `/api/email/preview`, et `app/api/email/`
>   ne contient QUE `preview` : aucun `sendMail`, aucun transport. On fermait
>   l'aperçu à quelqu'un qui allait de toute façon copier le texte lui-même.
> · **`/appels`** — « la liste du matin » est une session d'appels **humaine** :
>   l'opérateur compose depuis SON téléphone. Elle était avec `alpha-voice`, le
>   ROBOT qui compose depuis NOS minutes. Seul le mot « appel » les rapprochait.

> ⚠⚠ **DEUX DE PLUS LE 13/10/2026, et les deux motifs étaient FAUX**
> (`PAYANT_SANS_COUT`, `tests/entitlements.test.ts`, désormais vide).
> · **`/activity` → `crm`.** Motif écrit : « les ouvertures et les clics de
>   NOTRE tracking ». Mesuré : zéro `fetch`, la page lit le store. Le piège
>   était à côté : `/api/track` et `/api/webhooks` étaient RATTACHÉES à cet
>   écran — l'ouvrir sans les déplacer (vers `/recette`, même brique) ouvrait
>   notre pixel et notre webhook à tout inscrit. Les étapes n8n + webhook du
>   parcours ont suivi : un test exige qu'un gratuit n'ait AUCUNE étape
>   d'ordinateur, et c'est la mutation qui a montré qu'il manquait.
> · **`/moniteur` → MAÎTRE SEUL.** Motif écrit : « un écran de zéros ».
>   Mesuré : `/api/moniteur` lit `lireProspectsOperateur` — NOTRE pipe — et
>   rendait le nom des sociétés à rappeler à tout client `campagnes` **et à
>   tout essai**. L'autopilote qu'il surveille est aussi le nôtre (aucun
>   `CRON_SECRET` par locataire). Un test pose la question à **toutes** les
>   routes : qui lit le pipe de l'opérateur doit être maître seul, exiger une
>   clé, ou COMPARER un secret (`safeEqual`) — le lire ne suffit pas, la
>   mutation l'a prouvé. Il redevient vendable le jour où il lira le pipe du
>   locataire connecté.
> · **Ce qui reste payant, et pourquoi** — tout dépense chez nous : `/voice`
>   (minutes), `/agent` · `/social` (jetons, rendu — BYOK ouvre l'IA),
>   `/campaigns` · `/newsletter` (notre SMTP), `/outbox` (notre boîte IMAP),
>   `/audits` (notre egress), `/recette` (notre tracking).

> ⚠⚠ **L'ÉCRAN DU REFUS DIT POURQUOI, ET OÙ ALLER** (13/10/2026,
> `/offre-brique` · `lib/verrous.ts` · `tests/verrous.test.ts`). Ordre imposé :
> la raison (notre dépense) → **l'issue gratuite** → le prix. Un refus qui
> enchaîne sur l'offre se lit comme une rançon.
> · `ALTERNATIVE_GRATUITE` : une issue par brique payante, faite à la main,
>   qui dit ce qui reste payant. Chaque lien est rejoué sur le VRAI contrôle
>   d'accès d'un compte gratuit — une issue vers une autre porte fermée serait
>   un deuxième refus.
> · `clesQuiOuvrent` : l'écran affirmait « aucun moyen de passer par TES
>   identifiants » — faux depuis le BYOK. Il dérive maintenant la réponse de
>   `cheminOuvertParCle` (`lib/capacites-cle.ts`, extrait pour ne pas tirer
>   Supabase dans le bundle), la fonction même du middleware.
> · Des libellés, jamais des identifiants (« agent-alpha ») ; aucun nombre de
>   briques écrit à la main (« Quatre », il y en a cinq).

> ⚠ **On ne crée pas une 7ᵉ brique pour ça** : une brique de plus se recopie
> dans huit fichiers (catalogue, offres, provisionnement, vitrine, relevé de
> marché) et n'aurait rien à vendre. C'est le **CHEMIN** qu'on reclasse, sur
> `crm`. Précédent : `/controle`, ouvert par `["pilotage", "crm"]`.

> ⚠⚠ **UN SEUL TEST REGARDE LA CHAÎNE, ET C'EST LUI QUI A TOUT TROUVÉ**
> (`⚠⚠ LE PARCOURS ORGANIQUE COMPLET TIENT DANS LE GRATUIT`). Chaque écran pris
> isolément avait l'air correctement classé ; c'est le PARCOURS qui était coupé,
> à trois endroits, et aucun test ne le parcourait. Son contre-test
> (`…et il s'arrête net quand ça part de CHEZ NOUS`) est obligatoire : sans lui,
> un produit entièrement gratuit le satisferait.

> ⚠ **`/api/email` a été retirée de `API_QUI_DEPENSENT`** — son entrée disait
> « SMTP — notre serveur » et c'était **faux**, la seule route du dossier rend un
> aperçu. Retirer une entrée de cette liste sans garde serait ouvrir une porte en
> silence : un test **liste le dossier** `app/api/email/` et refuse toute route
> autre que `preview`. Motif : `cheminMetierDeLApi` prend le **premier** préfixe
> qui correspond, pas le plus spécifique — un `app/api/email/send/` ajouté demain
> hériterait du chemin **gratuit** et partirait de notre SMTP pour tout inscrit.

> ⚠ **Cette ligne n'est PAS un arbitrage commercial, elle est imposée par un
> fait technique.** `/api/send` lit `SMTP_*` dans l'environnement du SERVEUR,
> `/api/voice/call` lit `LIVEKIT_*`, `/api/ai` brûle nos jetons. **Il n'existe
> aucun chemin d'identifiants par locataire.** Ouvrir une de ces briques au
> gratuit revient à donner notre carte de crédit et notre nom de domaine à des
> inconnus — et ça ne se voit que sur la facture, un mois plus tard. Le jour où
> les identifiants deviennent par locataire, la ligne se rediscute. Pas avant.

> ⚠⚠ **LE CRITÈRE EST LE COÛT, ET IL EST DÉSORMAIS EXÉCUTABLE** (12/09/2026).
> La doctrine disait déjà « ce n'est pas un arbitrage commercial, c'est un fait
> technique » — mais rien ne le vérifiait, et **une brique était classée par
> FAMILLE** (« la machine agit à ta place ») au lieu de l'être par sa dépense.
> · `alpha-live` — le copilote d'appel — ne garde que `/overlay`, **aucune
>   route API ne sert ce chemin**, et `components/live/alpha-live.tsx` n'appelle
>   aucun `/api/…` : store local, RAG maison hors-ligne, reconnaissance vocale
>   du navigateur. Zéro jeton, zéro minute, zéro SMTP. Il est passé au gratuit.
> · Pire que le classement : `POURQUOI_PAYANT["alpha-live"]` **disait au client
>   une raison fausse** — « fait tourner le modèle en continu, même mécanique
>   que l'agent ». Une ANALOGIE servie comme une mesure, démontable en ouvrant
>   un fichier. Faire payer est légitime ; inventer le motif ne l'est pas.
> · Le garde (`⚠⚠ UNE BRIQUE N'EST PAYANTE QUE SI ELLE COÛTE`) dérive les
>   payantes de `BRIQUES_CONNUES \ BRIQUES_GRATUITES` et exige, pour chacune,
>   un chemin servi par une API de `API_QUI_DEPENSENT`. Deux listes écrites à
>   la main ont été supprimées le même jour : c'est la recopie qui laisse
>   entrer la brique suivante sans contrôle.

> ⚠⚠ **TROIS FUITES TROUVÉES EN ÉCRIVANT LA GARDE, aucune ne se voyait** :
> `/api/ai` → `/pipeline`, `/api/sparring` → `/closer`, `/api/digest` →
> `/aujourdhui`. Les trois pointaient vers des chemins devenus gratuits le
> même jour. `tests/entitlements.test.ts` (`API_QUI_DEPENSENT`) les tient
> maintenant, et refuse une entrée orpheline.

> ⚠⚠ **LE MODE SOLO ÉTAIT LA DERNIÈRE PORTE QUI ÉCHAPPAIT À L'INVARIANT.**
> `resoudreDroits` rendait `DROIT_SOLO` — donc **maître**, donc TOUT ouvert —
> dès que les comptes n'étaient pas configurés. Sur une production joignable :
> **quiconque connaît l'URL est maître**.
> · `deploiementSansSerrure()` = **production ET aucun compte ET aucun
>   `SITE_PASSWORD`**. Les trois ensemble, jamais moins. Un mot de passe EST une
>   serrure (le middleware mure déjà tout) ; en dev, le solo reste intact.
> · On ne coupe PAS le site : on retombe au **socle gratuit**. Une page blanche
>   sur une prod en ligne est une panne, et on n'en crée pas une pour corriger
>   une faille. L'app reste utilisable, plus personne n'est maître.
> · `SITE_PASSWORD=""` (variable créée mais pas remplie, ça arrive) n'est PAS
>   une serrure — d'où le `.trim()`, et un test qui le vérifie.
> 📦 Pourquoi ce n'était pas une config manquante mais un défaut de conception :
> `docs/ANGLES-MORTS.md`.
>
> ⚠⚠ **ET LE REPLI ÉTAIT CALCULÉ SANS ÊTRE APPLIQUÉ — 13/09/2026.**
> `deploiementSansSerrure()` faisait bien retomber `resoudreDroits` au socle
> gratuit. Mais **le middleware ne lisait que `comptesActifs()`** : dans cet
> état précis, AUCUN contrôle de brique ne s'exécutait. Le défaut récurrent du
> dépôt, sur la porte la plus chère qui existe ici.
> · **Trouvé en frappant un `next start` de production**, pas en relisant :
>   `/api/send` et `/api/voice/call` rendaient **400** (validation du corps) à
>   un inconnu — donc ils ACCEPTAIENT la requête. Avec `SITE_PASSWORD` posé :
>   401. Le mot de passe était la seule serrure, et la doctrine a décidé qu'il
>   ne murerait plus l'app.
> · **La fenêtre est datée** : le jour où `SMTP_*` est posé sur Vercel et où
>   les comptes ne le sont pas encore. Ça ne se voit que sur la réputation du
>   domaine, des semaines plus tard.
> · La condition est désormais `comptesActifs() || deploiementSansSerrure()`.
>   Vérifié sur serveur réel : 403 `brique_absente` sur les deux API, 200 sur
>   `/aujourdhui`, `/templates`, `/vitrine`. **On ne coupe pas le site.**
> · ⚠ **Le garde a dû être écrit deux fois, et c'est la MUTATION qui l'a dit.**
>   Il capturait `[\s\S]*?` à travers les lignes et avalait le commentaire qui
>   explique la règle — lequel nomme les deux fonctions. **L'assertion était
>   satisfaite par la PROSE** : remis à l'état vulnérable, le test restait
>   vert. Un garde qui échoue en s'ouvrant ne fait pas de bruit, il valide.
>   On retire les commentaires avant de chercher (comme le test de `lib/auth.ts`).

### L'AVERTISSEMENT DE BUILD EST UN ANGLE MORT À PART ENTIÈRE (13/09/2026)
`lib/url-publique.ts` · `tests/url-publique.test.ts`.

`metadataBase` n'était déclaré nulle part. Next résout alors toute URL
relative de métadonnée contre `http://localhost:3000` **et l'écrit dans le
HTML livré** — vérifié sur le build, pas déduit :
`<meta property="og:image" content="http://localhost:3000/media/hero-poster.jpg">`.
C'est l'adresse annoncée à LinkedIn quand on partage le lien : la carte sort
**sans vignette**. Le layout de la vitrine porte lui-même la phrase qui chiffre
la perte, et LinkedIn est le canal PAR DÉFAUT de notre ICP.
- **`next build` le disait à chaque passage.** Les tests étaient verts, `tsc`
  aussi : c'est le seul canal d'alerte du dépôt que rien n'oblige à lire.
- **Le repli va jusqu'à `VERCEL_URL`**, que la plateforme pose seule — une
  correction qui exige une action humaine n'est pas une correction, c'est une
  ligne de checklist de plus.
- **Posée à la RACINE uniquement** : Next la fait hériter. Un test refuse
  qu'un layout enfant la redéclare.
- **Le garde va jusqu'au FICHIER** : une base absolue pointant vers une image
  supprimée donne la même carte vide, pour une autre cause. Trouvé comme ça :
  `/souscrire` — la page où l'on **achète** — déclarait des balises Open Graph
  **sans image**.

**L'INVARIANT** : *on ne descend jamais sous le gratuit, on ne monte jamais
au-dessus sans une ligne prouvée en base.*
- Pas de ligne, base injoignable, service role absent → **gratuit**. Une panne
  dégrade un payant en gratuit (visible) ; l'inverse serait invisible et cher.
- **Impayé → gratuit, pas le néant.** Ses données lui appartiennent ; le mettre
  dehors ne récupère aucun impayé, ça fabrique un ancien client qui ne peut
  même pas exporter son CRM.
- **Pas de `tenantId` = pas de session = pas de plancher — pour les API.** `DROIT_REFUSE`
  porte aussi `statut: "suspendu"` : sans ce discriminant, une requête sans
  aucune session héritait du socle. Trouvé par une assertion.

### ⚠⚠ ESSAYER SANS COMPTE — l'app s'ouvre comme ChatGPT (27/10/2026)
`pageOuverteAuVisiteur` (`lib/entitlements.ts`) · `middleware.ts` · `AuthGate` ·
`VISITEUR` (`lib/use-droits.ts`) · `tests/visiteur-sans-compte.test.ts`.
Mesuré en production : tout visiteur était renvoyé vers `/compte` puis devait confirmer
son email — **6 comptes en tout, aucun depuis le 13/10**. Décision de Zakaria :
« frictionless, sinon on est morts ».
- **Le visiteur reçoit les ÉCRANS du socle gratuit, jamais une API.** Une page gratuite lit
  le CRM du NAVIGATEUR (le sien) : la servir ne coûte rien, ne révèle rien. Les API
  restent à 401, les écrans payants renvoient vers `/compte`, une installation « chez
  vous » reste à SES comptes.
- **Le mur ne protège plus « le serveur a des comptes », il protège un navigateur qui a
  PORTÉ un compte** (`compteDejaVu` : notre marque + la clé de session Supabase) — c'est là
  que dorment des fiches d'un compte après déconnexion. Seul un « pas de compte requis »
  EXPLICITE du serveur le lève ; une panne ne le lève pas.
- **Un 401 sur `/api/compte/droits` est une RÉPONSE (`VISITEUR`), pas une panne.** Lu comme
  une panne (`OPTIMISTE`, maître), il montrait au visiteur nos entrées réservées et ouvrait
  l'assistant de NOTRE pile (« n8n = le cerveau ») en plein écran — trouvé au RENDU, comme
  notre plan de traction (taux de juillet) servi sur sa journée. Rien de ce qui barre
  l'écran ne s'ouvre sur un verdict non prouvé (`estProuve`).
- **Le mur suivant était l'email de confirmation** (`mailer_autoconfirm: false`, 30 envois/h
  partagés). **TRANCHÉ (Zakaria) : « Continuer avec Google »** (`signInWithGoogle`, `lib/auth.ts`)
  — adresse vérifiée, aucun envoi. Couper la confirmation était l'autre sortie, écartée : un
  essai sans boîte à lui envoie depuis NOTRE `contact@` (`resoudreSmtp`, repli « maison »).
  **Le bouton ne s'affiche que si Supabase sert Google** (`connexionGoogleDisponible`, panne =
  non) : il apparaît sans redéploiement. L'activation (Google Cloud + Supabase) est sur Zakaria,
  `docs/CONNEXION-GOOGLE.md`.

**Notre compte** : `OWNER_EMAILS` (+ `NEXT_PUBLIC_OWNER_EMAILS`, même liste) =
`contact@eagleyecorp.fr,eagleyecorp.ad@gmail.com`. `estMaitre()` lit l'email du
JETON, jamais un paramètre client, et court-circuite la base — si elle tombe,
on doit encore pouvoir entrer chez nous.

> ⚠ `/controle` est ouvert au gratuit (il agrège CRM + pilotage) et affiche
> donc le lanceur de campagnes. Le bouton existe, **le serveur refuse** (403
> `brique_absente`). Délibéré : voir la porte fermée vaut mieux que ne pas
> savoir qu'elle existe, et la sécurité ne dépend jamais de l'écran.

## LA PART SUR LE RÉSULTAT — ce qu'on demande à qui a gagné avec Alpha
`lib/part-resultat.ts` · `components/billing/part-resultat-panel.tsx` (sur
`/compte`) · `tests/part-resultat.test.ts` · décidé le 13/09/2026.

Le modèle qui ferme la boucle du gratuit : le produit est libre tant qu'il ne
dépense rien chez nous, donc quelqu'un sans un euro prospecte pour de vrai et
encaisse. Ce qu'on demande ensuite n'est pas un abonnement à l'aveugle, c'est
une part de ce qu'on lui a fait gagner. **On ne gagne que s'il gagne.**

> ⚠⚠ **« 10–30 % DES BÉNÉFICES » ET « 10–30 % DU CA » NE SONT PAS LA MÊME
> CLAUSE, et la différence décide si on se fait payer.** Le CA, nous le voyons.
> Le bénéfice dépend des coûts, des salaires et des amortissements du client,
> que nous ne pouvons ni lire ni auditer : **celui qui paie contrôle le
> dénominateur**. Chaque euro de charge imputé à l'affaire réduit notre
> facture, légalement, sans qu'on ait un mot à dire.
> **Un pourcentage plus petit sur une base qu'on mesure vaut mieux qu'un grand
> pourcentage sur une base qu'on subit.** `BASE_REFUSEE` rend le refus
> exécutable : le module ne chiffre rien sur une base qu'il ne mesure pas, et
> un test interdit qu'une entrée « bénéfice » y revienne par la fenêtre.

- **La base est l'argent RÉELLEMENT ENCAISSÉ** (`payments[].amount`, statut
  `paye` seulement) — la même que `buildPayoutLedger`, donc pas une deuxième
  définition. On ne prélève rien tant que le client n'a pas été payé : c'est
  l'objection la plus légitime qui existe, et on la retire d'avance.
  > ⚠⚠ **TROUVÉ AU RENDU, PAS À LA RELECTURE.** La première version facturait
  > `monthlyValue`, et l'écran affichait « 30 % de 349 € = 105 € ». 349 € est
  > un **mensuel** — on facturait 30 % d'UN MOIS en l'appelant « le CA de
  > l'affaire ». Faux dans les deux sens à la fois.
- **L'échelle 10 / 20 / 30 se DÉRIVE du travail fait**, pas d'une négociation
  au cas par cas : suivi (l'affaire a vécu ici) · approche (un contact sortant
  est consigné) · rendez-vous (une rencontre a eu lieu avant la signature). Un
  taux unique force à défendre le même prix sur une affaire portée de bout en
  bout et sur une autre où on a tenu le fil — c'est la seconde qui fait dire
  « votre pourcentage est abusif », sur toutes les autres en même temps.
  > ⚠ Le haut de l'échelle **importe `REV_SHARE`**, il ne le recopie pas.
- **⚠⚠ CE QU'ON MESURE EST « L'AFFAIRE A ÉTÉ TRAVAILLÉE DANS ALPHA », PAS
  « ALPHA A FAIT LE TRAVAIL ».** La première rédaction avait un échelon « Alpha
  a SOURCÉ la fiche » — **`tsc` l'a fait tomber** : aucun `EventKind` ne
  l'atteste, et l'échelon aurait été le plus fréquent des trois. C'était une
  invention, et c'est le compilateur qui l'a dit.
- **L'attribution se borne à AVANT la signature.** Sans cette borne, toute
  fiche finirait au palier haut : il suffit de poser un rendez-vous de suivi
  une fois le contrat signé.
- **Une fiche sans aucune touche n'est pas à nous** — quelqu'un a collé une
  affaire déjà signée pour l'archiver. `null`, pas 10 % par défaut.
- **Zéro affaire facturable → `null`, jamais « 0 € ».**

> ⚠⚠ **L'ÉCRAN DIT « SIMULATION » AVANT DE DIRE UN MONTANT**, et un test
> l'exige. Aucun contrat de part n'est signé : afficher une somme dans la
> section « Compte » se lit comme une dette. Le client découvrirait un dû
> qu'il n'a jamais contracté — la façon la plus rapide de perdre quelqu'un
> qu'on venait de convaincre. C'est aussi le seul argument de conversion
> honnête qu'on ait : il est calculé sur SES chiffres, pas sur une étude de
> cas inventée.

> ⚠ **Ce que ce module ne réglera jamais : la sous-déclaration.** Tout repose
> sur ce que le client saisit. Aucun code ne corrige ça — c'est une clause de
> contrat (droit de regard sur les factures de l'affaire) ou un forfait.
> L'écrire ici évite de croire qu'un calcul juste suffit à se faire payer.

## ⚠ AUCUNE DONNÉE RÉELLE DANS LE DÉPÔT (`tests/donnees-reelles.test.ts`)
**Le dépôt a été rendu public le 09/09/2026, et il contenait des données
personnelles de tiers** — seize fiches prospects réelles, dont une personne
physique identifiée avec son mobile personnel.

> ⚠ **Trois gardes existaient, et les trois ont fait leur travail.** Toutes
> empêchaient la donnée d'atteindre un **navigateur**. Aucune n'empêchait le
> **fichier** d'être lu — et un dépôt public ne se visite pas, il se `clone`.
> Le modèle de menace entier supposait un attaquant qui passe par le produit.

- Les fiches vivent dans **`donnees-privees/`**, ignoré par git.
  `lib/pipeline-juillet.ts` et `lib/prospects-icp.ts` sont des **chargeurs** :
  absent ⇒ vide, jamais une exception (une CI ou un déploiement neuf n'a pas ce
  dossier).
- Ce qui RESTE dans le code : les **chiffres agrégés** (`JUILLET_REEL` — 78
  prospects, 132 appels, 6 RDV, 0 gagné). Ils n'identifient personne et ce sont
  eux dont la doctrine se sert. Les effacer par excès de prudence détruirait la
  mesure sans protéger qui que ce soit.
- **Tout numéro du dépôt est dans une plage ARCEP réservée à la fiction**
  (décision 2018-0881) : `0199 00` · `0261 91` · `0353 01` · `0465 71` ·
  `0536 49` · `0639 98`. Ni appelables, ni attribuables.
  > **Une seule exception, nommée** : `+33 4 51 22 21 82`, NOTRE ligne entrante
  > Alpha Voice. Elle existe pour être appelée — mais elle nous est facturée à
  > la minute : un dépôt public l'expose à l'abus.
- La garde cherche la **FORME** d'un numéro, jamais une liste de numéros connus
  — une liste de ce qu'il faut cacher serait une copie de ce qu'on cache.
- **Les NOMS sont gardés à la même échelle que les numéros** (`tests/noms-reels.ts`,
  branché dans `tests/donnees-reelles`). Ils ne l'étaient pas : les numéros
  étaient cherchés dans **tout fichier commité**, les noms seulement dans le
  **bundle client** — donc sous le modèle de menace « atteindre un navigateur »,
  celui dont l'encadré ci-dessus dit qu'il est insuffisant. Mesuré : 18 fichiers
  de `lib/`, `tests/`, `docs/`, `voice/` portaient des raisons sociales réelles
  hors bundle. Le garde du bundle a été **retiré**, pas doublé : sur un
  sous-ensemble strict, il créait une deuxième définition de la même règle.
  > ⚠ **Deux niveaux, et la calibration EST le sujet.** Le nom distinctif rare
  > se cherche **seul** — c'est la forme courte qui fuit, une enseigne se
  > recopiant presque toujours amputée de son mot de métier. L'enseigne bâtie
  > sur un **toponyme** se cherche **entière** : un quartier nu décrit un
  > territoire de prospection dans une dizaine de fichiers justes, et seul le
  > couple *métier + toponyme* identifie quelqu'un. Les interdire au mot aurait
  > fait tomber des phrases vraies — et un garde qui refuse une phrase vraie
  > est un garde qu'on assouplit au mauvais endroit.
  > ⚠⚠ **Cette règle-ci s'est fait attraper par elle-même** : la première
  > rédaction du paragraphe ci-dessus **citait deux vrais noms en exemple**, et
  > le garde a fait tomber `CLAUDE.md`. C'est le bon comportement, et ça dit
  > quelque chose de général — **expliquer une règle de non-divulgation est
  > exactement le moment où l'on redivulgue.** Une règle se décrit par sa
  > FORME, jamais par l'échantillon qui l'a motivée.
- **Un test qui dépend de `donnees-privees/` déclare `skip`**, il ne passe
  jamais à vide. Trois tests tombaient sur un clone propre ; un quatrième
  passait **vacant** (une liste vide filtrée rend une liste vide). Règle :
  une **fixture** (`tests/fixtures-icp.ts`) mesure le CODE et tourne partout ;
  le **vrai fichier** mesure la DONNÉE et se déclare `skip` quand il manque.
  Asserter « chaque fiche a un téléphone » sur un texte qu'on a tapé soi-même
  ne mesure rien.

> ⚠⚠ **Rendre le dépôt privé n'annule rien.** L'historique git garde tout, les
> forks et clones existants aussi, et les caches d'indexation. Corriger `HEAD`
> arrête l'hémorragie ; ça ne rappelle pas ce qui est sorti.

> 📦 Le détail de ce qui a fuité, et pourquoi c'est le jeu de démo ÉCRIT À LA
> MAIN qui s'est fait attraper sur les numéros (pas les fiches générées) :
> `docs/ANGLES-MORTS.md`.

## Sécurité — non négociable
- L'utilisateur a déjà collé des **clés API réelles en clair** (NVIDIA, Fish).
  Elles sont à **rotate**. Ne JAMAIS écrire une clé collée dans un fichier, un
  commit ou un artefact. Scanner chaque commit. Lui redire de ne pas les coller.
- `SITE_PASSWORD`, JWT Supabase, RLS : le cloisonnement des données est la RLS +
  le JWT (`lib/tenant.ts`). Un « compte » du portefeuille est une frontière
  d'**identité commerciale**, pas de sécurité. Ne pas confondre.
- **`SITE_PASSWORD` n'est PLUS un mur sur toute l'app** (décision de Zakaria).
  Il murait aussi les clients payants, qui n'auront jamais le mot de passe de
  notre outil interne. Il ne garde plus que `ADMIN_PREFIXES` (`middleware.ts`) :
  `/payouts`, `/offre`, `/api/sync` — ce qui parle de NOTRE économie, pas de
  celle du client. Le reste est gouverné par le compte + les briques.
  > ⚠ **La garde qui rend ça sûr, et qu'il ne faut jamais retirer** : le mur ne
  > se lève QUE si `comptesActifs() && serverAuthEnforced()`. Les deux sont
  > opt-in. Sans eux, il n'existe aucune autre serrure et l'app entière serait
  > publique — `/api/send` envoie de vrais emails, `/api/voice/call` compose de
  > vrais numéros. Par défaut on protège ; on n'ouvre que sur preuve.
  >
  > ⚠⚠ **Cette question ne se pose QU'À UN ENDROIT** : `verrouDeComptesActif`
  > (`lib/entitlements.ts`). Le middleware ET l'écran de connexion la posent ;
  > deux définitions de « l'app est-elle protégée ? » finiraient par diverger,
  > et l'une des deux ouvrirait tout.

### LE MCP S'OUVRE PAR OAUTH, PAS PAR UNE CLÉ (29/09/2026)
`lib/mcp-oauth.ts` · `lib/autoriser-appelant.ts` · `app/api/oauth/**` ·
`app/oauth/authorize` · `tests/mcp-oauth.test.ts`.
Attio se branche sur Claude en un clic (OAuth) ; notre Bearer statique n'était
accepté par claude.ai/Cowork qu'en bêta limitée — Alpha n'était branchable
nulle part. Serveur d'autorisation OAuth 2.1 **fait main** (DCR, PKCE S256,
refresh), la connexion restant celle de Supabase.
- **Pas le serveur OAuth de Supabase** : `supabase/auth#2820` (ouvert) le fait
  répondre 400 à ce qu'envoie un client MCP. On ne bâtit pas la porte d'entrée
  sur un bug ouvert chez un tiers.
- **⚠⚠ Un jeton OAuth ne donne QUE le cerveau** (`PORTEES_OAUTH` : lecture +
  proposition). Jamais `prospects.write`, jamais un envoi — même au maître.
  L'invariant « le MCP ne peut rien casser » survit au changement d'auth.
- **Seul un compte MAÎTRE autorise**, revérifié à CHAQUE appel : retirer une
  adresse de `OWNER_EMAILS` coupe l'accès au prochain appel.
- **Retours limités à Claude** (claude.ai / claude.com / boucle locale de
  Claude Code, port ignoré). Ouvrir un autre client se DÉCIDE.
- **Une seule question « qui appelle ? »** : `autoriserAppelant` (clé OU
  jeton). Les routes MCP et `/api/v1` du cerveau la posent ; `prospects.write`
  reste sur `autoriserApi` seul.
- **Sans base, et c'est écrit** : code à usage unique garanti par instance
  seulement (60 s + PKCE), refresh non révocable seul. Coupe-circuits :
  `OWNER_EMAILS`, ou `OAUTH_SECRET` (sinon dérivé de `SUPABASE_JWT_SECRET`).
- **Prouvé en HTTP réel** (`next start` verrouillé, 15/15) + 5 mutations qui
  mordent, **puis par un vrai Claude le 29/09** : connecteur ajouté par
  Zakaria, consentement, `diagnostic` a répondu. C'est ce test-là qui compte.

### DU MOT DE PASSE AU COMPTE — la bascule (02/09/2026)
`SITE_PASSWORD` est un mot de passe PARTAGÉ, sans identifiant, changeable
seulement par redéploiement. Le vrai login (email + mot de passe, que le
titulaire change lui-même) est le compte Supabase, et l'écran existe déjà :
`components/security/auth-gate.tsx`.
- **Ce qui bascule** : poser `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_JWT_SECRET`
  + `OWNER_EMAILS` (+ `NEXT_PUBLIC_OWNER_EMAILS`, même liste), **puis**
  `REQUIRE_AUTH=1` **en dernier**. Les trois premières ne changent RIEN tant
  que la quatrième n'est pas là — vérifié sur serveur réel.
- **Le fail-closed** : `REQUIRE_AUTH=1` sans `SUPABASE_JWT_SECRET` → les API
  de données répondent **503**, et le mot de passe continue de tout murer. La
  misconfiguration n'ouvre jamais.
- **Après bascule, le mot de passe reste** sur `ADMIN_PREFIXES` (`/payouts`,
  `/offre`, `/api/sync`) : notre économie, jamais celle du client.
- **La pré-vérification existe déjà** : `GET /api/health`, une fois connecté,
  rend `auth.serverEnv` · `auth.serverEnforced` · `auth.misconfigured` ·
  `auth.verrou` · `proprietaire.coherent` (les deux listes `OWNER_EMAILS`
  concordent-elles). C'est ce qu'il faut lire AVANT et APRÈS avoir posé
  `REQUIRE_AUTH`.
  > ⚠ Elle **lit** ces états, elle ne les recalcule pas. Elle les redéduisait
  > avec sa propre expression régulière sur `REQUIRE_AUTH` — une seconde
  > définition, dans l'outil même qui sert à vérifier la bascule. Une
  > divergence n'aurait pas planté : elle aurait MENTI. Un test refuse toute
  > relecture locale de `REQUIRE_AUTH` dans ce fichier.
  > ⚠ **Le défaut corrigé, et il ne se voyait pas** : l'écran de connexion ne
  > se fermait que sur `settings.security.requireAuth` — un réglage du
  > NAVIGATEUR. Un navigateur neuf (client, navigation privée, autre appareil)
  > ne le voyait donc JAMAIS, quelle que soit la config serveur. **Une serrure
  > dont l'existence dépend du trousseau de celui qui entre n'est pas une
  > serrure.** Il lit maintenant le serveur (`GET /api/gate` → `compteRequis`)
  > **OU** le réglage local — un `&&` reproduirait exactement le bug.
  > Corollaire testé : une panne réseau ne conclut jamais « pas de compte
  > requis » ; elle retombe sur le réglage local, jamais sur « ouvert ».
  >
  > Vérifié sur serveur réel : sans comptes, tout reste muré ; avec comptes,
  > une page produit renvoie vers `/compte?bloque=…` (parcours client) et une
  > page admin vers `/gate` (mot de passe). Deux portes, deux publics.

## CE QUI EST BLOQUÉ SUR ZAKARIA — `docs/A-FAIRE-ZAKARIA.md`
Écrit le 13/09/2026, veille de lancement. **Une session qui ne sait pas quoi
faire commence par là** : c'est la liste de ce qu'aucune session ne peut
exécuter (Vercel, Supabase, registrar, export de fiches), avec l'ordre imposé
et la RAISON de chaque dépendance.

> ⚠ **La dépendance qui coûte cher si on l'inverse** : poser `SMTP_*` AVANT
> les quatre variables de comptes rend `/api/send` joignable par n'importe qui
> avec un SMTP qui marche — de vrais emails depuis notre domaine, pour des
> inconnus, visibles seulement sur la réputation des semaines plus tard.

> ⚠ **Le dépôt passe en privé.** Ça n'annule rien : l'historique git, les forks,
> les clones et les caches d'indexation gardent tout. Et **les gardes ne se
> retirent pas** (`tests/donnees-reelles`, `tests/noms-reels`, plages ARCEP) —
> un dépôt privé se partage, se clone, et redevient public par accident. Ce
> sont des données de tiers, pas un secret commercial.

## CE QU'ON PROMET, ET CE QU'ON REFUSE DE DIRE (`lib/promesse.ts`)
Décidé le 14/09/2026. Le positionnement vivait à **quatre endroits** — README,
section mission, trois commentaires — et aucun ne faisait autorité.

> **On ne fabrique pas l'intelligence. On fabrique ce qui permet de s'en servir
> pour vendre — en France, sans se mettre hors la loi.**
> Courte : *les humains closent, Alpha fait tourner la machine.*

> ⚠⚠ **ON NE SE POSITIONNE PAS COMME « LE \<GRAND ACTEUR\> DE LA VENTE »**, et
> ce n'est pas une question de goût :
> · **ça contredit notre seul argument vérifiable** — la vitrine défend que
>   l'automatisation des PME françaises ne devrait pas dépendre d'acteurs
>   américains, et `tests/vitrine-fuite` EXIGE que cet angle reste. Emprunter
>   le nom d'un de ces acteurs se contredit dans la même page ;
> · **ça invite la question qu'on perd** : « quel modèle entraînez-vous ? » —
>   aucun, on loue l'intelligence comme tout le monde ;
> · **« le X de Y » signale DÉRIVÉ**, et à zéro vente ça rejoint la famille des
>   affirmations invérifiables (superlatifs, affiliations) déjà refusée.
> Un test cherche la **forme** ET une courte liste de noms — une liste seule
> serait périmée au prochain acteur à la mode.

- **Chaque preuve NOMME le fichier qui l'applique**, et un test l'ouvre. C'est
  ce qui sépare une garantie d'un argument de vente : on peut la lire. Une
  preuve dont le module disparaît fait **tomber le build** au lieu de continuer
  à se dire sur une page publique.
- **Aucune preuve n'est une performance.** Pas de pourcentage, pas de « X fois
  plus » : zéro vente, donc aucune mesure à citer. Ce sont des RÈGLES que le
  logiciel applique — vérifiables aujourd'hui, contrairement à un résultat.
- **La promesse s'AJOUTE à l'angle de souveraineté, elle ne le remplace pas**
  (l'ordre est testé) : l'un dit où vivent les données, l'autre pourquoi un
  meilleur modèle ailleurs ne nous remplace pas.
- **Elle n'est recopiée nulle part** — la vitrine l'importe. C'est la recopie
  qui a fait dériver ce positionnement en quatre versions.

## L'ÉCHELLE — ce qu'on a MESURÉ, et ce qu'on ne peut pas dire (21/10/2026)
`scripts/mesure-echelle.sh` · `scripts/rejouer-lot.sh` · `supabase/migrations/018-echelle.sql` ·
`lib/limiteur.ts` · `tests/echelle.test.ts` · `tests/limiteur.test.ts`.

Demande : « que ce soit prêt pour 10 M d'utilisateurs ». **On ne dit pas « prêt ».**
On ne peut tester d'ici ni Supabase hébergé, ni Vercel, ni le SMTP. On a mesuré
ce qu'on ÉCRIT (SQL et code) sur un vrai Postgres 16 jusqu'à **1 000 000 de comptes**.

- **L'inscription est plate** (52–61 µs par compte, de 1 k à 1 M) : le démarreur
  d'essai est en O(1). Rien à réparer, et il faut que ça reste vrai — c'est le chemin
  de chaque arrivant. Le trigger du compteur ne touche sa ligne que si le delta
  n'est pas nul, sinon l'inscription se mettrait en file derrière une seule ligne.
- **⚠⚠ LA SOMME DE L'ENVELOPPE ÉTAIT FAUSSE, pas seulement lente.** Elle rapatriait
  toutes les lignes d'essai et les additionnait en JavaScript ; PostgREST borne ses
  réponses (1 000 par défaut chez Supabase — **à lire dans Settings → API → Max
  rows, pas supposé**). Au-delà, on additionnait les 1 000 premières et le plafond de
  300 € **ne se refermait plus, en silence** : la garde de sécurité qui s'ouvre sous
  la charge, l'inverse de l'invariant du dépôt. Désormais un compteur tenu par trigger
  (1,6 ms à 1 M au lieu de 112 ms), et **le repli refuse de conclure dès qu'il touche
  le plafond de lignes** : `null`, donc l'essai ferme. **Un total tronqué a l'air
  exact** — c'est le pire état d'une garde.
  · La SOMME reste LA définition ; le compteur n'en est que la copie.
    `ecart_enveloppe_essais()` les rend côte à côte, lue par `/api/health` (maître seul).
    Ça renverse un principe écrit dans `lib/compteur-essai.ts` (« pas de table de
    compteurs ») : il était juste tant que la somme coûtait quelques lignes.
- **`adoption_stats` : ×2, pas ×10.** Une passe au lieu de douze relectures d'une
  CTE matérialisée (4,2 s → 2,1 s à 1 M). **Elle reste LINÉAIRE** (≈ 2 µs par
  compte, soit ~20 s à 10 M — extrapolé) : tolérable pour un écran de propriétaires,
  pas au-delà de quelques millions. Le palier suivant est une table d'agrégats tenue
  au fil de l'eau — décision, pas un index sur le schéma `auth` de Supabase.
- **Le limiteur de débit était quadratique sous un afflux** (`middleware.ts`) : un
  balayage de toute la table à CHAQUE nouvelle IP au-delà de 10 000. Mesuré en
  rejouant sa logique à l'identique : 1,4 → 226 → 925 µs par requête à 10 k → 30 k →
  100 k IP distinctes — exactement le trafic d'un post qui marche. Réparé (un balayage
  au plus toutes les 10 s, plafond dur) : 1,2 µs à 100 k et à 1 M.
- **⚠⚠ LES TROIS ERREURS DE CETTE SÉANCE, et ce qu'elles disent :**
  · **Un chiffre gonflé que j'avais écrit** (« 7,3 s, pire que linéaire ») venait
    d'une première passe où les `VACUUM` avaient échoué sans bruit (deux instructions
    dans un même `-c` = un bloc de transaction). Refait proprement : c'est linéaire.
    Corrigé dans la migration et les tests ; une mesure se REJOUE, elle ne se cite pas.
  · **Un test d'équivalence mal construit** comparait un JSON figé à l'étape 3 avec
    un JSON calculé plus tard : `now()` avait avancé. L'hypothèse (mon test, pas la
    fonction) a été **vérifiée** — comparer les deux versions dans UNE instruction —
    avant de conclure. Même famille : une preuve de sécurité « ✗ » qui venait de
    `set -o pipefail` (psql refuse, donc sort non nul) alors que la base répondait
    bien `permission denied`. **On lit la réponse de la base avant d'accuser le code.**
  · **Un test réécrit par script a perdu sa dent en silence** : le cache partagé entre
    deux lectures est devenu deux caches neufs, et la mutation « un inconnu mis en
    cache » a survécu. Repéré parce qu'on remute après CHAQUE refactor de test.
- **1 000 utilisateurs sur le SERVEUR D'APPLICATION — mesuré le 21/10, rejouable**
  (`scripts/charge-locale.mjs`, chiffres et limites dans `docs/OBJECTIF-10M.md` § 2ter) :
  1 000 connexions simultanées, une IP chacune, routes publiques → 8 524 requêtes toutes
  en 200, p95 29 ms serveur chaud, p95 ~2 s à froid ; saturation ≈ 325–375 req/s pour un
  processus, puis file (p95 12–20 s, `ECONNRESET`). **Ce n'est PAS un test d'inscription ni
  de comptes connectés** : aucun appel Supabase (les ~17 REST par page restent le vrai
  plafond d'un connecté, non mesuré), pas Vercel, aucun email de confirmation.
- **✅ LE MUR DES 2 INSCRIPTIONS PAR HEURE EST LEVÉ** — lu le 21/10/2026
  (`rate_limit_email_sent` = 2, `smtp_host` = null), reposé le soir même et **prouvé par un
  envoi réel** (`docs/SMTP-SUPABASE-AMEN.md` : INBOX en 2 s, SPF/DKIM/DMARC `pass`), **relu le
  22/10** : `smtp_host` = `smtp-fr.securemail.pro:465`, expéditeur `contact@eagleyecorp.fr`
  (« Alpha Sales OS »), limite **30/h**. `max_rows` PostgREST = 1 000 (confirmé).
  ⚠ **Ce paragraphe a dit « 2/h, PRIORITAIRE » une journée de trop** : la correction vivait
  dans `docs/SMTP-SUPABASE-AMEN.md`, pas ici, et la session suivante a relancé Zakaria sur une
  tâche faite. Une doctrine qui ne suit pas le geste fabrique du travail en double.
  · **Le mur suivant** : 30 confirmations/heure (un post qui marche peut le toucher), puis le
    plafond Amen de 500 envois/jour, partagé avec la prospection — `docs/OBJECTIF-10M.md` § 4.
  · **Le coût écrit plus haut devient RÉEL** (« D'où partent nos emails ») : les confirmations
    partent désormais de `contact@`, la boîte de prospection.
  · (La lecture de cette config renvoie des secrets — `smtp_pass`, parfois `jwt_secret` : ne
    jamais les recopier ; n'en extraire que les champs utiles.)
- **Ce qui reste, sans fard** : (1) **chaque requête qui traverse le middleware relit
  les droits par un appel REST** — ~17 par page, d'après le commentaire du middleware.
  Le cache de droits par instance (jamais sur les routes qui dépensent, jamais sur un
  repli d'erreur) règle l'essentiel, mais il fixe combien de temps un compte déclassé
  garde ses droits : **un arbitrage de sécurité qui se décide**, pas une ligne glissée
  dans la porte qui protège l'argent. (2) Les murs d'infrastructure de
  `docs/OBJECTIF-10M.md` § 2 (emails de confirmation, hébergement commercial, plan
  Supabase) ne se réparent pas dans le code. (3) ~~La migration 018 n'est pas posée~~
  **POSÉE EN PRODUCTION le 21/10/2026, sur « go » de Zakaria** (voir ci-dessous).
- **⚠ Ce que la pose a prouvé, et ce qu'elle n'a PAS prouvé.** Lue AVANT (pas de table,
  6 comptes, 6 essais, somme 0,00, un seul trigger) et APRÈS par le catalogue
  (`pg_class` / `pg_proc` / `pg_trigger` / `has_*_privilege`, jamais `information_schema`) :
  table à une ligne = **0,00 = la somme**, RLS active et zéro politique, `anon` et
  `authenticated` **sans** droit sur la table ni sur les trois fonctions, `service_role`
  les exécute, les deux triggers (`entitlements_attribution_immuable` +
  `entitlements_enveloppe`) coexistent, `adoption_stats` est la nouvelle version.
  · **Non prouvé en production : le trigger sur une dépense RÉELLE.** Je n'ai pas
    débité un vrai compte pour le voir (même annulé, c'est une écriture que personne
    n'avait autorisée). Il est prouvé sur Postgres 16 local, lot rejoué deux fois ; en
    production il l'est par le catalogue (actif, `security definer`). Le premier essai
    réel qui dépense est le test vivant, et `/api/health` (`enveloppeEcart`, maître
    seul) dit si compteur et somme divergent — **ça se lit, ça ne se suppose pas.**
  · **La réponse de l'outil n'affichait que `BEGIN`** pour un lot de 240 lignes. Elle
    ne disait ni « passé » ni « échoué » : c'est la relecture de la base qui l'a dit.
    Ne jamais conclure sur l'accusé d'un outil d'écriture.
  · Le code déployé peut encore être l'ANCIEN (il somme côté application, le lot est
    compatible avec lui) : `enveloppeEcart` n'apparaît dans `/api/health` qu'une fois
    ce commit déployé.

## OÙ TOURNE LA PRODUCTION — vérifié le 22/10/2026, pas supposé
- **L'app (`alphasalesos.eagleyecorp.fr`) est sur VERCEL**, et **un push sur la branche de
  travail arrive en production tout seul** : vu par les en-têtes (`server: Vercel`,
  `x-vercel-cache`) et par le MP4 du commit du jour servi au bon octet quelques minutes après
  le push. Conséquence : « tests + types verts avant push » n'est pas une politesse, c'est le
  seul contrôle avant la production.
- **⚖ DÉCIDÉ le 27/10/2026 : l'app reste sur Vercel, en plan PRO** (Hobby interdit l'usage
  commercial ; un lien Stripe le rend flagrant). Mesuré le même jour : **le cron Supabase tape
  encore une copie NETLIFY de l'app** (secret Vault `alpha_base_url`) — elle se retire, dans
  l'ordre écrit en tête de `docs/A-FAIRE-ZAKARIA.md`.
- **Netlify ne sert que la vitrine `eagleyecorp.fr` (`site/`)**, publiée à la main
  (`docs/NETLIFY-EAGLEYECORP-FR.md`). « Trigger deploy » ne concerne QUE ce site.
  ⚠ Une session l'avait confondu et a demandé à Zakaria de « déployer sur Netlify » une app
  déjà en ligne. Et le Netlify branché à cette session voit une AUTRE équipe : n'y rien déployer.
- Ce qu'on publie sur LinkedIn pointe vers l'app : vérifier l'URL du média en production
  (`curl -I` via Composio) AVANT `LINKEDIN_UPLOAD_VIDEO` — le contenu servi doit être celui du
  commit qu'on annonce.

## Contraintes d'environnement (sandbox)
**Re-mesuré le 17/09/2026** — cette liste avait dérivé, et une contrainte fausse
coûte plus cher qu'une contrainte absente : elle fait renoncer sans essayer.

| | État mesuré |
|---|---|
| `git` vers **github.com** | **PASSE** (`git ls-remote` sur deux dépôts publics) |
| `data.grandlyon.com` · `data.gouv.fr` · API adresse · API Sirene | **BLOQUÉS** (`000`, refus du proxy) |
| Hôtes **Supabase** (5432 · 6543 · 443) | **BLOQUÉS** — 403 au CONNECT, politique |
| Clés live NVIDIA / Stripe · récupération de page tarifaire | bloquées |
| pypi | passe |

- **SUPABASE SE LIT ET S'ÉCRIT D'ICI PAR COMPOSIO, pas par le réseau** (21/10/2026).
  Les hôtes restent bloqués en direct (403 au CONNECT : une POLITIQUE de
  l'environnement, pas une panne de Supabase — réglage « Network access » de
  l'environnement cloud). Mais la connexion Composio « supabase » est active :
  `SUPABASE_RUN_READ_ONLY_QUERY` · `SUPABASE_BETA_RUN_SQL_QUERY` ·
  `SUPABASE_APPLY_A_MIGRATION` sur le projet `alpha-sales-os`. Avant, toute
  décision sur la base se prenait sur le CODE, jamais sur la base.
  · **Lire l'état, pas le supposer** : `pg_class` / `pg_proc` / `pg_policies`,
    **jamais `information_schema`** — il masque les tables que le rôle de
    lecture n'a pas le droit de voir (la plupart des nôtres : `revoke … from
    anon, authenticated`). Mesuré le jour même : mes deux premières lectures
    annonçaient « quatre tables » par le mauvais catalogue.
  · **Limites mesurées** : `SET ROLE service_role` est refusé — on ne peut pas
    appeler `adoption_stats` comme le fait la route ; on rejoue son corps en
    lecture seule. `cron.job_run_details` dit « succeeded » dès que l'appel
    HTTP est PARTI : la vraie réponse est dans `net._http_response` (courte
    mémoire), c'est elle qui dit si le tick a servi à quelque chose.
  · **Ce qui ne passe toujours pas** : la production Vercel (même politique).
- **La ligne « github.com bloqué » était FAUSSE.** Elle a survécu à un
  changement de politique du proxy, et personne ne la retestait — on ne teste
  pas ce qu'on croit savoir. Ce qui reste vrai : **aucune source open-data
  française n'est joignable**, donc **aucun lead ne se produit d'ici**.
- **Postgres 16 est installé en local** (`/usr/lib/postgresql/16/bin`) : une
  migration se joue pour de vrai sur une base jetable, avec un décor `auth`/
  `storage` imité. C'est comme ça que `LOT-A-COLLER.sql` a été éprouvé.
- **Chromium est là** (`/opt/pw-browsers`) et se pilote en CDP avec le
  `WebSocket` natif de Node — **aucune dépendance à ajouter**. « Vu au RENDU »
  est donc faisable d'ici, et deux défauts d'aujourd'hui ne se voyaient que là.
- **Je ne peux pas tester un service live** (Telnyx, LiveKit, Vercel,
  Supabase) : ça se vérifie côté Zakaria. Ne pas prétendre avoir testé ce qui
  ne l'a pas été.

## LE DÉFAUT RÉCURRENT DU DÉPÔT — le brancher, pas seulement l'écrire
C'est de LOIN la panne la plus fréquente ici, et elle ne ressemble pas à un
bug : **un mécanisme juste, testé, correct — branché à un seul endroit, ou à
aucun.** Le module rend la bonne réponse, personne ne la lit. Rien n'échoue,
donc rien n'alerte. Exemples payés : la garde d'`/api/send` sans appelant,
`capaciteAppels` calculé et affiché nulle part, « a-t-il dit non ? » posée à
trois endroits dont deux répondaient faux.
- **Avant de dire qu'une fonctionnalité est livrée** : chercher qui l'importe.
  Un export `lib/` que rien ne consomme est mort, pas « prêt ».
- **La question à poser, quand une règle existe** : *combien d'endroits la
  posent, et répondent-ils tous pareil ?* Une seule source, sinon un test qui
  interdit la deuxième (cf. `aRefuseTouteRelance`, `RESULTATS_MANUELS`).
- Le pendant côté doc : `tests/docs-chiffres.test.ts` exige qu'un module
  doctrinaire soit cité quelque part — sinon la session suivante le réécrit
  à côté.

### ET C'EST DÉSORMAIS EXÉCUTABLE (`tests/exports-morts.test.ts`, 17/09/2026)
La règle ci-dessus vivait **en prose** — c'est-à-dire que la règle qui décrit
la panne la plus fréquente du dépôt souffrait elle-même de cette panne.
- **L'unité juste est la FONCTION, pas le module.** Mesuré aux trois échelles :
  au niveau MODULE, 2 sur 199 sont morts (`valeur-produite`, `ceo-historique`,
  tous deux documentés) — à cette échelle le dépôt est sain, et `renderDevis`
  serait passé, puisqu'il vit dans un module parfaitement branché. Au niveau
  SYMBOLE sans distinguer l'usage interne : 141 résultats, presque tous faux.
  **Fonction exportée qu'aucun fichier de production n'appelle, pas même son
  propre module : 43.** C'est celle-là qui attrape le vrai défaut.
- **Le test GÈLE l'inventaire, il ne répare pas les 43.** Beaucoup sont
  légitimes (inertes par décision, en attente d'une brique, audits de
  cohérence). Ce qu'il empêche, c'est la **44ᵉ** — écrire une règle juste, la
  tester, et la croire livrée.
- **Chaque tolérance porte son MOTIF**, et un test refuse un motif trop court
  pour dire quoi que ce soit — sinon la liste devient la décharge où l'on
  inscrit une fonction plutôt que de la brancher. Un second test refuse une
  entrée **périmée** : sans lui, l'inventaire ment à la session suivante.
- **Les VRAIS restes sont marqués `⚠ RESTE` et PLAFONNÉS à 6.** Au-delà, on
  n'est plus en train de tolérer, on accumule. Aujourd'hui, après la
  suppression de `renderDevis` + `estRefus` (le doublon mort de devis, TRANCHÉ
  le 17/09) : `finDEssai` (jamais eu
  d'appelant), `interdictionPour` — **inatteignable par construction** : il
  s'indexe sur `formation-cpf` / `renovation-energetique` / `assurance`, des
  identifiants qui n'existent ni dans `Sector` ni dans les verticales. Lui
  trouver un appelant demanderait d'inventer un vocabulaire de plus.
  > ⚠ Les interdictions sectorielles, elles, SONT branchées — par
  > `secteursInterditsDans` (motif sur le texte du script), dans `auditScript`
  > et dans le Cerveau. La doctrine ne ment pas sur ce point. Ce qui manque est
  > le pendant DÉTERMINISTE : un script bien écrit qui évite les mots
  > déclencheurs passe. Le combler suppose que la fiche porte le secteur
  > réglementé, ce qu'aucun champ ne fait — à trancher, pas à bricoler.
- ⚠ **La limite, écrite plutôt que tue** : le test regarde UN niveau. Une
  fonction appelée seulement par une autre fonction elle-même morte passe au
  travers. L'accessibilité transitive demanderait un graphe d'appels.

## Conventions de code
- Commentaires en français, denses, qui expliquent le POURQUOI (le style du repo).
- Modules purs et testables dans `lib/`, testés dans `tests/*.test.ts`.
- Pas de `any`. Pas de dépendance nouvelle. Pas de secret en dur.
- Fin de commit : les lignes `Co-Authored-By:` et `Claude-Session:` **fournies
  par le harness**, telles quelles.
  > ⚠ Cette ligne gravait « Opus 4.8 » — un numéro périmé, que le harness
  > écrase de toute façon. Une doc qui prescrit une valeur obsolète se fait
  > recopier par la session suivante, qui croit suivre la convention. On nomme
  > la SOURCE, pas la valeur.
  > ⚠ Jamais d'identifiant de modèle ailleurs : ni dans le code, ni dans un
  > commentaire, ni dans un artefact poussé.
