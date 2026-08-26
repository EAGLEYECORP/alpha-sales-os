# ALPHA SALES OS — mémoire de projet

> Ce fichier se charge à CHAQUE session. Il porte la doctrine stable pour ne
> jamais relire toute la conversation. Ce qui bouge (plan, avancement) vit dans
> `docs/ROADMAP-TRILLION.md`. Mets à jour ici quand une RÈGLE change, pas quand
> une tâche avance.

## Qui / quoi
- **Propriétaire** : Zakaria Tazi — EAGLEYE CORP, Lyon. Français par défaut dans
  tout ce qui est produit (code en anglais, UI + docs + prompts en français).
- **Produit** : Alpha Sales OS — OS de vente white-label. Next.js 15 / React 19 /
  TS strict, Zustand persist (`alpha-sales-os-v2`), **zéro dépendance runtime**
  (crypto, CSV, RAG, PDF : tout est fait main). Ne JAMAIS ajouter une dépendance
  npm sans raison impérieuse.
- **Branche de travail** : `claude/crm-n8n-email-tracking-4qxtwr`. Commit + push
  systématiques. Tests : `npm test` (node:test, ~235). Types : `npx tsc --noEmit`.
  Les deux doivent être verts avant push.

## Ton
Brutalement honnête. Pas de flatterie, pas de « tu as raison ». Si un chiffre
est faux, une idée irréaliste ou un truc pas testé — le dire net. L'utilisateur
demande explicitement ça et il a besoin de **ventes réelles**, pas de démos.

## Les 3 comptes (portefeuille white-label) — `lib/accounts.ts`
Le compte MAÎTRE (EAGLEYE) est l'interface qui pilote tout. Basculer de compte
change l'identité + l'offre + la commission, **pas** les données.

| Compte | Ce qu'il prend | Ce qui NOUS revient |
|---|---|---|
| **EAGLEYE CORP** (maître) | **nos offres** : visibilité (sites, growth), **Alpha Sales OS** (VIP ou **à la carte**), **OS personnalisé**, digitalisation **< 40 k**, ex-« ScintIA Lab » | **100 %** |
| **ScintIA** | **Callflow UNIQUEMENT**, vendu comme un PRODUIT | 990 € HT setup → **30 %** + **10 % du mensuel** |
| **Nuwacom** | chantiers **> 40 k** (sinon trop lourd pour nous) | **15 %**, puis **100 %** de la maintenance |

> ⚠ **Deux « 30 % » différents, ne jamais les confondre.**
> · Le taux d'un compte = ce qui NOUS revient. Sur EAGLEYE c'est **100 %** :
>   c'est notre société, il n'y a personne à qui reverser. Il ne descend sous
>   100 % que là où nous sommes **intermédiaires** (ScintIA, Nuwacom).
> · Les **30 % + setup** de l'offre commerciale = ce qu'on **facture au
>   client** sur le CA qu'on lui fait gagner (`lib/pricing` → `REV_SHARE`).
>   C'est un PRIX, pas une commission reversée.

**Règle de routage (négociée, définitive)** : faisable par nous → EAGLEYE ·
Callflow → ScintIA · > 40 k → Nuwacom.

### L'ESCALIER — le check de CHAQUE prospect (`lib/ladder.ts`)
Cascade, pas aiguillage : un prospect peut déclencher plusieurs marches, et
chacune revient à un compte. On monte **une marche à la fois**, jamais tout d'un
coup.
1. **Visibilité** détectée → **EAGLEYE** (100 % — c'est nous).
2. **Volume de demandes très élevé** → **Callflow / ScintIA** (30 % + 10 % mensuel).
3. **Automatisation demandée en plus** → **EAGLEYE** (100 %). *Argument clé* :
   Callflow est le **point d'entrée** — il capte l'info exacte sur chaque
   appelant, donc l'automatisation qui suit coûte **moins de setup** (les données
   sont déjà là, le process est cartographié). Cet argument n'est servi QUE si
   Callflow est effectivement en amont.
4. **Trop gros pour nous (> 40 k)** → **NUWACOM** : le gros devis justifie les
   **15 %**, puis **100 % de toute la maintenance mensuelle**.

**Nuwacom** : sites `nuwacom.fr` / `nuwacom.com/en`. CEO **Christophe** (visio
faite, réglo). Fort en Allemagne + Benelux, **entre sur le marché FR**. Le
contrat se dresse **après le cadrage** → levier de négociation. Doctrine :
**si un open-source GitHub ou nous-mêmes pouvons le faire vite → on le fait
nous** (meilleur levier) ; si trop lourd, ou si on leur a présenté et qu'ils
n'en veulent pas → on passe par leur plateforme.
**ScintIA** : sites `scintia.ai` / `scintiacallflow.ai`. Ils veulent se
concentrer sur Callflow comme produit.

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
- Callflow (ScintIA) : **990 € HT** setup + paliers minutes (59/115/169/219/319).

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
  `callflow`, `visibilite-growth`). La famille décide du compte, de l'aimant
  et de la marche — **pas le nom**. Créer une 4ᵉ mécanique de routage demande
  encore du code.
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
- **Cadence de relance Callflow (exigée par ScintIA)** : après le 1er appel sans
  réponse → **5 rappels sur 2 jours**. Dès qu'il répond : Alpha Voice **arrête**,
  met à jour le pipeline, et **passe la main à l'humain** (closer).
  > ⚠ **Cette cadence fait 6 contacts en 2 jours. Le décret n° 2022-1313
  > plafonne le démarchage à 4 sollicitations par consommateur sur 30 jours
  > glissants.** Il vise le B2C, mais une liste terrain est MÊLÉE et c'est nous
  > qui portons le risque. `plafondRappels` (`lib/call-cadence.ts`) arbitre :
  > **SIREN connu → cadence ScintIA entière ; pas de SIREN → plafond à 4**.
  > Le croisement au registre lève donc le plafond, et c'est le seul moyen.
  > **À arbitrer avec ScintIA** — le code ne tranche pas l'accord, il empêche
  > seulement la cadence longue de partir en silence sur une cible à risque.

## Rituels de closing (par compte) — `Account.closing`
Se tromper de rituel = perdre le deal au dernier mètre.
- **EAGLEYE** → DEVIS EAGLEYE CORP, envoyé depuis `contact@eagleyecorp.fr`.
- **ScintIA** → PROPOSITION COMMERCIALE depuis `z.tazi@scintia.ai` via le panel
  `https://sales.scintiacallflow.ai/`.
- **Nuwacom** → RDV de CADRAGE avec **Christophe (CEO)**, fuseau
  **Europe/Luxembourg**. Le contrat se dresse APRÈS ce cadrage (= le levier).

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

> ⚠ Corollaire de la 4 : **ne jamais recopier de la doctrine dans une fiche.**
> Les notes d'import portaient l'explication de chaque signal — mille copies du
> même paragraphe, 47 % du poids — pendant que la phrase du client, elle, était
> jetée. On garde ce qui ne se recalcule pas ; le reste vit dans le code.

## Sécurité — non négociable
- L'utilisateur a déjà collé des **clés API réelles en clair** (NVIDIA, Fish).
  Elles sont à **rotate**. Ne JAMAIS écrire une clé collée dans un fichier, un
  commit ou un artefact. Scanner chaque commit. Lui redire de ne pas les coller.
- `SITE_PASSWORD`, JWT Supabase, RLS : le cloisonnement des données est la RLS +
  le JWT (`lib/tenant.ts`). Un « compte » du portefeuille est une frontière
  d'**identité commerciale**, pas de sécurité. Ne pas confondre.

## Contraintes d'environnement (sandbox)
Le proxy sortant bloque : github.com, data.grandlyon.com, data.gouv, et les clés
live NVIDIA/Supabase/Stripe. pypi passe. **Je ne peux pas tester un service live
depuis ici** — tout ce qui touche Telnyx/LiveKit/Vercel se vérifie côté Zakaria.
Ne pas prétendre avoir testé ce qui ne l'a pas été.

## Conventions de code
- Commentaires en français, denses, qui expliquent le POURQUOI (le style du repo).
- Modules purs et testables dans `lib/`, testés dans `tests/*.test.ts`.
- Pas de `any`. Pas de dépendance nouvelle. Pas de secret en dur.
- Fin de commit :
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (+ la ligne
  `Claude-Session:` fournie par le harness). Jamais d'identifiant de modèle
  ailleurs que dans le chat.
