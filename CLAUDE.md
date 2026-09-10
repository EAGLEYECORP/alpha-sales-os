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

**Nuwacom** : sites `nuwacom.fr` / `nuwacom.com/en`. CEO **Christophe** (visio
faite, réglo). Fort en Allemagne + Benelux, **entre sur le marché FR**. Le
contrat se dresse **après le cadrage** → levier de négociation. Doctrine :
**si un open-source GitHub ou nous-mêmes pouvons le faire vite → on le fait
nous** (meilleur levier) ; si trop lourd, ou si on leur a présenté et qu'ils
n'en veulent pas → on passe par leur plateforme.

## NOTRE CIBLE — le maître d'ouvrage à permis actif (09/09/2026)
`lib/permis-construire.ts` · ICP dans `lib/accounts-commercial.ts` (serveur) ·
`docs/PERMIS-LYON.md`.

**Le maître d'ouvrage PROFESSIONNEL dont le permis de construire est actif, sur
Lyon et Villeurbanne.** ICP à **déclencheur**, pas à secteur : « les
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

- **La zone est une exclusion**, pas dix points de score (`communeDansLaZone`).
  Elle ne l'était pas : un bon permis de Bron sortait *retenu* et rien ne le
  disait. Ce que la zone achète : l'ancrage local est le **seul argument
  vérifiable** à zéro vente. Ce qu'elle coûte : un export métropolitain perd la
  majorité de ses lignes — et le lot le **dit** (les hors-zone se comptent à
  part des « rien à vendre » : le premier veut dire « refiltre à la source »,
  le second est le fonctionnement normal).
  > ⚠ Ancré en **début de libellé**, jamais un `includes("lyon")` :
  > Sainte-Foy-lès-Lyon, Métropole de Lyon et Grand Lyon contiennent tous
  > « lyon ». Commune **absente** ≠ hors zone — c'est un `manque` qu'on nomme,
  > pas une ligne qu'on jette.
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

## Tarifs Alpha Sales OS (à refléter sur le site)
- **10 000 € VIP** (offre haute), OU **30 % + frais de setup** (local / cloud)
  sur devis. Ces 30 %-là sont un **PRIX facturé au client** (part de SON CA
  généré), pas une commission reversée — voir l'encadré plus haut.
- **Cadrage OBLIGATOIRE** avant devis : visio, appel ou SMS, avec **date + heure
  décidées** et validation de la suite côté Zakaria.
- **Prix à la carte par brique** : un client peut ne prendre qu'Alpha Voice.
  Il ne voit QUE sa brique ; nous voyons tout.
- **OS personnalisé** : un OS taillé sur le métier du client, pas une
  déclinaison du nôtre. Chiffré au cadrage.
- **Alpha Voice** — grille DÉCIDÉE le 02/09/2026 (`lib/offres-publiques.ts`) :
  **990 € HT** de setup, puis **deux** paliers — **Essentiel 149 €/mois**
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
- **Nuwacom** → RDV de CADRAGE avec **Christophe (CEO)**, fuseau
  **Europe/Luxembourg**. Le contrat se dresse APRÈS ce cadrage (= le levier).

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
  Maître seul, **masqué** et non grisé : griser, c'est annoncer, et cette
  console parle de NOTRE exploitation, pas d'une brique à vendre.

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

## FREEMIUM — qui entre, et ce qu'il obtient (`lib/entitlements.ts`)
**L'inscription est LIBRE** : n'importe qui crée son compte quand il veut. Il
démarre à **zéro + le jeu de démonstration**, avec **ses propres identifiants**.

| | Ce qu'on ouvre |
|---|---|
| **GRATUIT**, sans limite de durée (`BRIQUES_GRATUITES`) | `crm` · `closer` · `cerveau` · `pilotage` — **tes données, ton organisation** |
| **PAYANT** | `campagnes` · `alpha-voice` · `agent-alpha` · `audits` · `tracking` · `alpha-live` — **la machine agit à ta place** |
| **MAÎTRE seul** | `/payouts`, `/offre`, `MAITRE_SEULEMENT` — notre économie |

> ⚠ **Cette ligne n'est PAS un arbitrage commercial, elle est imposée par un
> fait technique.** `/api/send` lit `SMTP_*` dans l'environnement du SERVEUR,
> `/api/voice/call` lit `LIVEKIT_*`, `/api/ai` brûle nos jetons. **Il n'existe
> aucun chemin d'identifiants par locataire.** Ouvrir une de ces briques au
> gratuit revient à donner notre carte de crédit et notre nom de domaine à des
> inconnus — et ça ne se voit que sur la facture, un mois plus tard. Le jour où
> les identifiants deviennent par locataire, la ligne se rediscute. Pas avant.

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

**L'INVARIANT** : *on ne descend jamais sous le gratuit, on ne monte jamais
au-dessus sans une ligne prouvée en base.*
- Pas de ligne, base injoignable, service role absent → **gratuit**. Une panne
  dégrade un payant en gratuit (visible) ; l'inverse serait invisible et cher.
- **Impayé → gratuit, pas le néant.** Ses données lui appartiennent ; le mettre
  dehors ne récupère aucun impayé, ça fabrique un ancien client qui ne peut
  même pas exporter son CRM.
- **Pas de `tenantId` = pas de session = pas de plancher.** `DROIT_REFUSE`
  porte aussi `statut: "suspendu"` : sans ce discriminant, une requête sans
  aucune session héritait du socle. Trouvé par une assertion.

**Notre compte** : `OWNER_EMAILS` (+ `NEXT_PUBLIC_OWNER_EMAILS`, même liste) =
`contact@eagleyecorp.fr,eagleyecorp.ad@gmail.com`. `estMaitre()` lit l'email du
JETON, jamais un paramètre client, et court-circuite la base — si elle tombe,
on doit encore pouvoir entrer chez nous.

> ⚠ `/controle` est ouvert au gratuit (il agrège CRM + pilotage) et affiche
> donc le lanceur de campagnes. Le bouton existe, **le serveur refuse** (403
> `brique_absente`). Délibéré : voir la porte fermée vaut mieux que ne pas
> savoir qu'elle existe, et la sécurité ne dépend jamais de l'écran.

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

## Contraintes d'environnement (sandbox)
Le proxy sortant bloque : github.com, data.grandlyon.com, data.gouv, et les clés
live NVIDIA/Supabase/Stripe. pypi passe. **Je ne peux pas tester un service live
depuis ici** — tout ce qui touche Telnyx/LiveKit/Vercel se vérifie côté Zakaria.
Ne pas prétendre avoir testé ce qui ne l'a pas été.

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
