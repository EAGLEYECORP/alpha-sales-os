# ALPHA SALES OS® — EAGLEYE CORP

**L'OS de vente qui sort le savoir commercial de la tête des gens pour le mettre dans un système.**

Alpha Sales OS trouve les prospects, les audite, les appelle, les relance, tient
l'historique de chaque conversation et dit à l'humain quoi faire — pour lui,
maintenant. Next.js 15 · React 19 · TypeScript strict. **Les briques qui
capteraient de la donnée métier — RAG, extraction PDF/DOCX, CSV, crypto — sont
écrites à la main et ne sortent rien.**

> La décision EST le produit. Émotion d'abord (démo avant le prix), logique ensuite.

---

## LE BUT

**Qu'un bon vendeur arrête de passer sa journée à ne pas vendre.**

Un commercial passe l'essentiel de son temps sur ce qui entoure la vente :
qualifier, relancer, mettre à jour une fiche, préparer un rendez-vous, écrire
le compte-rendu, relancer encore. Alpha Sales OS prend **tout ce qui est avant
et autour**, et laisse à l'humain les deux choses qu'une machine ne fait pas.

| | Qui |
|---|---|
| Prospection, qualification, relances, scripts, suivi, pipeline, mesure | **Alpha Sales OS** |
| **La livraison** de la prestation vendue | **le client** |
| **La réassurance humaine** — la présence, la voix, la poignée de main | **le client** |

**Les humains closent. Alpha fait tourner la machine.**

### Les trois règles qui en découlent

**1. Écrire est gratuit ; envoyer depuis notre infrastructure se paie.**
Le socle gratuit n'est pas un aperçu : c'est de quoi prospecter *pour de vrai*
— cibler, écrire, approcher, appeler, décrocher des rendez-vous — sans limite
de durée. Un gratuit qui s'arrête avant le premier rendez-vous ne convertit
personne, il fabrique des comptes morts. Ce qui se paie, c'est ce qui **dépense
chez nous** : nos minutes, notre SMTP, nos jetons.

**2. Aucun chiffre inventé.** Zéro donnée rend `null`, jamais `0`. Un taux ne
sort jamais sans son dénominateur ni son intervalle. Et tant qu'aucune affaire
n'est gagnée, le produit **refuse de projeter un euro** — c'est écrit dans les
types, pas dans une intention.

**3. La conformité est dans le code, pas dans une note.** La phrase de l'article
50 est prononcée par le code, le plafond du décret n° 2022-1313 est exécutable,
et les secteurs où le démarchage est interdit font refuser le script. Une règle
écrite en prose n'est pas une règle.

### Où on en est, sans arrondir

**Zéro vente à ce jour.** La seule mesure maison : juillet 2026, 78 prospects
travaillés → 6 rendez-vous (**7,7 %**, fourchette réelle 3,6 %–15,8 %) → **0
gagné**. Le taux rendez-vous → signature n'a jamais été observé : aucune
projection de chiffre d'affaires n'est défendable, et le produit le dit au lieu
de le combler.

Le seul levier dont l'effet soit **constaté** : l'**audit écrit**. Là où une
pièce écrite est partie, le taux monte ; 26 appels sans audit n'ont rien
produit.

---

## À qui ça s'adresse

### 🎯 Qui EAGLEYE prospecte en ce moment (décidé le 13/09/2026)

**Les sociétés de services B2B lyonnaises de 10 à 50 commerciaux qui reçoivent
plus de demandes qu'elles n'en traitent** — intérim et recrutement d'abord,
puis maintenance sous contrat B2B, propreté et sécurité.

L'effet doit être **immédiat** : le retard existe déjà, il est comptable, et le
premier rappel produit un résultat dans la journée. On ne crée pas un marché,
on rattrape ce qui arrive déjà. Critères exécutables : `lib/plan-traction.ts`.

> ⚠ **La maîtrise d'ouvrage reste le jeu de DÉMONSTRATION** (`lib/seed.ts`,
> `lib/permis-construire.ts`) : un ICP à déclencheur, daté et vérifiable, qui
> montre exactement ce que le tri sait faire. Ce n'est plus la cible
> commerciale — son marché ne démarche pas au téléphone, et l'actif le plus
> défendable du produit (le moteur de conformité) n'y vaut rien.

<details>
<summary>L'ancien ICP, gardé pour la démo — maître d'ouvrage à permis actif</summary>

**Le maître d'ouvrage professionnel dont le permis de construire est actif, sur
Lyon et Villeurbanne.** Promoteurs, SCCV, sociétés d'aménagement, constructeurs
de maisons individuelles — ceux qui construisent **pour vendre**.

C'est un ICP à **déclencheur**, pas à secteur : « les promoteurs » dit QUI, un
permis dit QUI *et* **où en est l'affaire au mois près**, donc **quand**
appeler. L'arrêté est public, daté, vérifiable.

> ⚠ « Maître d'ouvrage » est un rôle **juridique**, pas un métier. Le même
> export contient le bailleur social qui construit pour *attribuer*, la commune
> qui bâtit une école, et le couple qui fait construire sa maison — ce dernier
> étant le gros du volume. Aucun des trois n'a rien à vendre, et démarcher le
> couple relève du B2C (décret n° 2022-1313). Le tri les sort par **exclusion
> sèche** : [`lib/permis-construire.ts`](./lib/permis-construire.ts).

Play opérationnel complet : [`docs/PERMIS-LYON.md`](./docs/PERMIS-LYON.md).
**Zéro permis converti à ce jour** — les seuils sont des décisions, pas des
mesures.

</details>

### Ce que le PRODUIT sait servir

À ne pas confondre avec la ligne ci-dessus : celle-ci décrit la portée de
l'outil, celle-là notre campagne en cours. L'OS a démarré pour le commerce de
proximité lyonnais ; ce n'est plus le marché. Catalogue complet dans
[`lib/segments.ts`](./lib/segments.ts) et les playbooks d'appel dans
[`lib/playbook.ts`](./lib/playbook.ts) (dont la verticale
**maîtrise d'ouvrage**).

| Segment | Ce qui fait mal | Brique d'entrée |
|---|---|---|
| **Équipe terrain** — toiture, isolation, photovoltaïque, porte-à-porte (3 à 50 commerciaux) | L'écart entre le meilleur vendeur et les autres est énorme, et son savoir reste dans sa tête | **Alpha Live** + CRM |
| **Centre d'appels** — plateaux, qualification, relation client (5 à 200 postes) | Les équipes brûlent leur énergie sur des appels qui ne décrochent pas | **Alpha Voice** |
| **Agence & services B2B** (1 à 30 personnes) | Le closing dépend du fondateur : le chiffre plafonne à ses heures | CRM + Campagnes + Cerveau |
| **Réseau, franchise, groupement** (10 à 500 points de vente) | Le discours se dilue en s'éloignant du siège | CRM + Alpha Live + Pilotage |
| **Commerce local** — garages, artisans, santé (1 à 10 personnes) | Chaque appel manqué part chez le concurrent, sans qu'on le sache | **Alpha Voice** |
| **Assurance en transformation** (25 à 2 000 salariés) | Parcours fragmentés, frictions non chiffrables | CRM + Cerveau + Pilotage |

Chaque segment porte ses **déclencheurs** (quand approcher), son **angle** (qui
nomme SA douleur, pas notre produit) et ses **disqualifiants** — dire non vite
vaut mieux que traîner un dossier qui ne signera pas.

## Doctrine encodée dans le logiciel

Ce n'est pas un CRM avec des citations Hormozi — les règles sont **exécutées** :

- **Obstacles ≠ Objections** : les obstacles vivent pré-offre (Oignon du Blâme : Circonstances → Les Autres → Soi), les objections n'existent qu'en **Red Zone** (post-offre) et pointent chacune une des 3 Croyances cassées.
- **Gate de signature** : impossible de glisser une carte en « Signé » si conviction < 10/10, démo mobile non faite avant le prix, croyances < 10 ou objections ouvertes. Le Kanban refuse et explique pourquoi.
- **Next step daté obligatoire** : le dashboard affiche les violations en rouge ; la timeline refuse un contact sans prochaine étape datée.
- **Taxe d'Ignorance** : chiffrée par prospect, cumulée dans le temps, injectée dans les scripts et les templates d'emails.
- **Confettis bronze** sur « Signé ». Évidemment.


## Trajectoire — 0 → 10 M€

> Écran vivant : **`/trajectoire`**. Modules : `lib/paliers.ts` (blueprint),
> `lib/opportunites.ts` (argent hors client), `lib/voice-costs.ts` (coût usine).

### ⚫ French Tech 2030 — porte FERMÉE, et ce n'est plus une tâche

> **NON ÉLIGIBLE — vérifié le 3 septembre 2026.** Le critère d'entrée est
> **3 M€ de financements et/ou de CA cumulés depuis le 1ᵉʳ janvier 2024** (plus
> TRL 6). EAGLEYE CORP est à 0 €. Le seuil est **éliminatoire** : la qualité du
> dossier ne le rattrape pas, et **la promotion suivante appliquera le même
> seuil**. L'échéance du 4 septembre est par ailleurs passée sans dépôt.
>
> ⚠⚠ **Ce constat a vécu six jours dans ce README pendant que le code disait
> autre chose.** `lib/opportunites.ts` ne listait pas le seuil et annonçait
> « adéquation : plausible » ; `/trajectoire` l'affichait en ambre — une
> couleur qui encourage — et `lib/mission-french-tech.ts` découpait neuf lots
> de travail pour un dossier rejeté à la première page. La **vitrine
> publique**, elle, affirmait « c'est aussi ce qui nous vaut de candidater à
> French Tech 2030 ». Corrigé le 10/09 : le blocage est porté par le code
> (`Opportunity.bloquant`), et un test refuse toute affiliation
> institutionnelle sur une page publique.
>
> Ce qui reste utile : le dossier écrit — souveraineté, conformité,
> différenciation — resservira pour Bpifrance ou une page de vente.
> [`docs/DOSSIER-FRENCH-TECH-2030.md`](./docs/DOSSIER-FRENCH-TECH-2030.md).

### Les 4 paliers — une seule contrainte à la fois

| Palier | La contrainte unique | Porte de sortie mesurable |
|---|---|---|
| **0 → 100 k€** | Trouver des clients qui **paient**, à la main | 10 paiements encaissés · un canal ≥ 30 % · CAC < 25 % du panier |
| **100 k → 1 M€** | Sortir la vente **de ta tête** | 3 deals fermés sans le fondateur · 50 % des RDV automatiques · MRR ≥ 20 % |
| **1 M → 3,5 M€** | Livrer sans se noyer | 80 % des livraisons sans toi · churn < 3 %/mois · satisfaction ≥ 80 |
| **3,5 M → 10 M€** | Croître **par les autres** | 50 % du CA via comptes/partenaires · 30 jours sans toi, chiffres à l'appui |

Chaque palier porte aussi son **« ce qu'on ne fait PAS encore »** — le piège
classique de l'étape (recruter trop tôt, refondre le produit, lever des fonds
pour masquer un problème de livraison).

### La barre du jour — ce qui se double vraiment

> **Doubler le chiffre d'affaires chaque jour est arithmétiquement impossible :
> 2³⁰ = 1 073 741 824.** Partir de 1 € et doubler quotidiennement donnerait un
> milliard en un mois. Vendre cette idée fait abandonner au jour 6, quand la
> courbe casse.

Ce qui se double, c'est le **levier** : le rendement d'une même heure de travail.
`/trajectoire` mesure quatre ratios chaque jour et **nomme le goulot** :

| Ratio | Seuil | Ce que ça dit |
|---|---|---|
| **% automatisé** | ≥ 40 % | En dessous, tu es la machine |
| **Taux de contact** | ≥ 10 % | En dessous, c'est le ciblage ou l'accroche |
| **Conversation → RDV** | ≥ 25 % | En dessous, c'est le script |
| **Touches/heure** | ≥ 10 | En dessous, la file est trop courte |

La réalité compensée : **+1 %/jour composé = ×37,8 en un an. +2 %/jour = ×1 377.**
C'est spectaculaire *et* tenable — contrairement au doublement quotidien.

## Stack

| Couche | Choix |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript strict |
| UI | Tailwind CSS, composants maison style shadcn, lucide-react, Bricolage Grotesque / Inter / JetBrains Mono |
| État | Zustand + persistance localStorage (local-first, zéro backend requis) |
| Souveraineté | Cascade IA **Ollama (local) → NVIDIA → Anthropic**, puis moteur de gabarits fait main : le produit tourne sans aucun appel sortant (`lib/ai-engine.ts`) |
| Data | TanStack Table (vue liste), Recharts (funnel, forecast MRR, secteurs) |
| IA (texte) | Endpoint compatible OpenAI (NVIDIA NIM / Groq / Ollama) avec **fallback moteur de templates hors-ligne** |
| **Alpha Voice** | LiveKit Agents (Python) · Deepgram STT · LLM compatible OpenAI · Fish Audio TTS · Silero VAD · SIP Telnyx |
| RAG | BM25 lexical fait main (`lib/knowledge.ts`) — pas de base vectorielle, pas de clé |
| Cloud (optionnel) | Supabase : auth lien magique, Postgres + RLS, Storage, Realtime |

## Structure du projet

`npm test` pour le compte exact — un chiffre recopié ici périme au prochain commit.

```
alpha-sales-os/
├── app/
│   ├── page.tsx                 # Dashboard : KPIs, funnel, forecast, taxe cumulée
│   ├── vitrine/                 # ⭐ Page de VENTE publique (hors mot de passe)
│   ├── controle/                # ⭐ Salle de contrôle : appels en cours, file, blocages
│   ├── trajectoire/             # ⭐ Palier 0→10 M, barre du jour, opportunités
│   ├── pipeline/ · prospects/   # Kanban, fiche complète (master rappel, checkpoints)
│   ├── cerveau/                 # RAG lexical + import de fichiers (PDF/DOCX/HTML)
│   ├── voice/ · appels/         # Alpha Voice : scripts, conformité, sessions
│   ├── campaigns/ · outbox/     # Séquences, relecture avant envoi
│   └── api/
│       ├── v1/prospects         # ⭐ API publique (clé) — ingestion + triage
│       ├── campaign/tick        # ⭐ Autopilote (cron n8n, triple verrou)
│       ├── voice/{call,session} # Dispatch + journal de sessions/transcriptions
│       └── track/ · webhooks/   # Ouvertures, clics, réponses entrantes
├── lib/                         # Modules PURS et testés
│   ├── entitlements             # ⭐ LA serrure : qui a droit à quoi, côté serveur
│   ├── bricks-access · api-access # Quelle brique ouvre quelle page / quelle API
│   ├── offres-publiques         # ⭐ Les prix PUBLICS — la source unique
│   ├── accounts · ladder        # Portefeuille white-label + l'ESCALIER de routage
│   ├── accounts-commercial      # 🔒 SERVEUR : identités partenaires + commissions
│   ├── segments · icp           # ⭐ À qui on vend, et pourquoi
│   ├── deep-dive · import-triage# Audit à l'import, verdict d'un lot
│   ├── vital-signs · master-rappel · checkpoints
│   ├── argumentaire · lead-magnet · templates · playbook
│   ├── call-cadence · campaign-runner · campaign-tick · call-outcome
│   ├── call-log · file-extract  # Transcriptions ; PDF/DOCX sans dépendance
│   ├── bricks · pricing · voice-costs · paliers · opportunites
│   ├── webpush · push-digest · ics · notion  # ⭐ notifications, agenda, CRM
│   ├── deck · client-onboarding             # ⭐ présentation par étape, mise en route
│   ├── token-budget · mission-french-tech   # ⭐ coût des prompts, dossier FT2030
│   ├── wizard-progress          # L'assistant ET la visite : une seule règle d'ouverture
│   └── knowledge · store · types
├── components/ui/page-header    # Le SEUL endroit où s'écrit un titre d'écran
├── voice/                       # Agent Python (LiveKit) + guides SIP
├── tests/                       # node:test — `npm test` pour le compte
└── docs/                        # Déploiement, API v1, autopilote, roadmap
```

### Les briques vendables

Chaque brique se vend seule (`lib/bricks.ts`) ; l'addition des dix dépasse
largement le pack — c'est l'ancrage.

| Brique | Installation | Mensuel |
|---|---|---|
| **Alpha Voice** — agent vocal entrant/sortant, 24/7 | 3 500 € | 364 € (1 000 appels) |
| **Campagnes & outreach** | 2 500 € | 290 € |
| **Le Cerveau (RAG)** | 2 500 € | 240 € |
| **Agent ALPHA** — le copilote qui lit le pipeline à ta place | 2 200 € | 490 € |
| **CRM & Pipeline** | 2 000 € | 190 € |
| **Audits automatisés** | 1 800 € | 150 € |
| **Tracking & délivrabilité** | 1 500 € | 120 € |
| **Alpha Live** — le souffleur pendant le rendez-vous | 1 800 € | 180 € |
| **Closer OS & débrief** | 1 500 € | 190 € |
| **Salle de contrôle & KPIs** | 1 200 € | 120 € |
| **PACK COMPLET** | **10 000 €** | **1 000 €** pour 5 utilisateurs |

> ⚠ **Le pack se facture au SIÈGE depuis le 13/09/2026**, et les 1 000 € sont
> le prix à la taille d'équipe de référence — pas un forfait.
> `600 € de socle + 80 € par utilisateur` (`abonnementMensuel()`,
> `lib/offres-publiques.ts`) : 680 € à une personne, 1 400 € à dix, 2 200 € à
> vingt. Le socle couvre ce qui ne dépend pas du nombre de têtes — moteur de
> conformité, Cerveau, autopilote. **Alpha Voice reste hors formule** : on ne
> facture pas au siège ce qui remplace un siège. Détail : `docs/PRICING.md` §0.

**Essai 30 jours, pleine capacité**, borné par DEUX limites : la durée *et*
30 € de consommation réelle chez nous — la première atteinte ferme l'essai. À
la fin, retour au socle gratuit, jamais au néant.

Ou **30 % + frais d'installation** sur devis. **Cadrage obligatoire** avant
tout chiffrage. Alpha Voice sortant se paie au volume, sans engagement :
1 000 appels 364 € · 4 000 appels 1 092 € (le 4ᵉ millier offert). Les jetons
du modèle utilisés par l'Agent ALPHA sont refacturés au réel, comptés et
plafonnés par route (`lib/token-budget.ts`) — on ne cache pas un coût variable
dans un forfait.

⚠ **Cette grille est INTERNE.** La page publique montre ce que chaque capacité
fait et un ordre de grandeur, jamais le prix ligne à ligne : l'ancrage par
l'addition ne fonctionne que dans une conversation — sur une page, le prospect
fait l'addition seul et choisit la brique la moins chère. `publicBricks()`
dérive la vue publique du catalogue pour que les deux ne divergent jamais, et
`tests/vitrine-fuite.test.ts` verrouille ce qui ne doit pas sortir.

### Qui entre, et ce qu'il obtient — le socle gratuit

**L'inscription est libre.** N'importe qui crée son compte quand il veut, et
démarre à zéro + le jeu de démonstration, avec ses propres identifiants.

| | |
|---|---|
| **GRATUIT**, sans limite de durée | CRM & pipeline · Closer OS & débrief · le Cerveau · KPIs et pilotage · le copilote d'appel · **écrire ses messages, sa file LinkedIn, sa liste d'appels du matin** |
| **PAYANT** | Campagnes · Alpha Voice · Agent ALPHA · Audits · Tracking |

**Écrire est gratuit ; envoyer depuis notre infrastructure se paie.** Le
parcours de prospection ENTIER tient dans le gratuit : cibler, écrire,
approcher sur LinkedIn, appeler depuis son propre téléphone, débriefer, poser
le rendez-vous, relancer, mesurer. Ce qui se paie, c'est le jour où la machine
envoie à sa place — notre serveur d'emails, nos minutes d'appel, nos jetons.

> Ce n'est pas de la générosité, c'est le modèle : un gratuit qui s'arrête
> avant le premier rendez-vous ne convertit personne, il fabrique des comptes
> morts. `tests/entitlements.test.ts` parcourt la chaîne entière et refuse
> qu'elle soit coupée — et un audit interroge **tous** les écrans : celui qui
> n'atteint aucune route coûteuse doit être gratuit, ou porter son motif.

> ⚠ **Cette ligne n'est pas un arbitrage commercial : elle est imposée par un
> fait technique.** `/api/send` lit `SMTP_*` dans l'environnement du serveur,
> `/api/voice/call` lit `LIVEKIT_*`, `/api/ai` brûle les jetons du déploiement.
> Il n'existe aujourd'hui **aucun chemin d'identifiants par locataire**. Ouvrir
> une de ces briques au gratuit revient à donner sa carte de crédit et son nom
> de domaine à des inconnus — et ça ne se voit que sur la facture, un mois plus
> tard. Le jour où les identifiants deviennent par locataire, la ligne se
> rediscute.

L'invariant, dans `lib/entitlements.ts` : **on ne descend jamais sous le
gratuit, on ne monte jamais au-dessus sans une ligne prouvée en base.** Pas de
ligne, base injoignable, service role absent → gratuit. Une panne dégrade donc
un payant en gratuit — visible ; l'inverse serait invisible et cher. Un impayé
retombe au gratuit, pas au néant : ses données lui appartiennent, et le mettre
dehors ne récupère aucun impayé.

`tests/entitlements.test.ts` liste les routes qui dépensent, avec pour chacune
l'identifiant qu'elle consomme, et vérifie qu'aucune n'est atteignable par le
gratuit. Trois y échappaient en écrivant la garde — `/api/ai`, `/api/sparring`
et `/api/digest` pointaient vers des chemins devenus gratuits le même jour.

### Deux façons de s'en servir — et le produit ne les traite pas pareil

Le même logiciel sert deux personnes qui n'ont pas le même problème. Ça se voit
dans les écrans, dans les droits, et dans ce qu'on facture.

#### 1. Le commercial seul

Il vend pour lui. Prospection, qualification, relances, closing : tout passe par
lui, et son problème est le **temps** — un bon vendeur passe sa journée à ne
pas vendre. Il s'inscrit, décrit sa cible, et l'outil se remplit de fiches qui
ressemblent à SON marché. Un compte, pas de hiérarchie, rien à administrer.

C'est le socle gratuit, et il va jusqu'au bout : CRM, Closer OS, Cerveau,
pilotage, plus de quoi ÉCRIRE ses messages, tenir sa file LinkedIn et sa liste
d'appels du matin. Il n'a rien à payer tant qu'il fait le travail lui-même — il
paie le jour où il veut que la machine agisse à sa place (appels automatiques,
campagnes envoyées, agent autonome).

#### 2. Le responsable d'équipe commerciale

Il ne vend pas — ou pas seulement. Il pilote trois à quinze commerciaux, et son
problème n'est pas le temps, c'est l'**écart** : la différence entre son
meilleur vendeur et les autres est énorme, et le savoir du meilleur reste dans
sa tête. Il lui faut voir ce que font ses vendeurs, reprendre un portefeuille
quand quelqu'un part, et comparer.

Il crée des **sous-comptes** — un par commercial. Chacun a ses identifiants,
son pipe, ses fiches. Le responsable voit le contenu de chacun ; un commercial
ne voit ni son responsable, ni ses collègues.

> ⚠ **Le sens de la hiérarchie n'est pas symétrique, et c'est délibéré.** Un
> commercial qui lit le pipe de son collègue peut lui prendre ses affaires ; un
> commercial qui lit le compte de son responsable voit la marge faite sur son
> propre travail. Le rattachement donne une visibilité **descendante**, jamais
> latérale ni montante.

> ⚠ **Les prospects appartiennent à l'entreprise, pas au vendeur qui les a
> saisis.** C'est ce qui justifie que le responsable voie tout : un directeur
> commercial qui ne peut pas reprendre le portefeuille d'un vendeur parti n'a
> pas un CRM, il a un carnet privé par personne. Ça se dit au commercial le
> jour où on lui crée son compte — pas le jour où il s'en aperçoit.

Règles pures et testées : [`lib/organisation.ts`](./lib/organisation.ts),
[`tests/organisation.test.ts`](./tests/organisation.test.ts). Structure et
politiques : [`supabase/migrations/003-organisation.sql`](./supabase/migrations/003-organisation.sql).

#### Et nous, au-dessus — ce qu'on voit et ce qu'on ne voit pas

Le compte maître (EAGLEYE) est le socle des opérations et du succès client. Il
voit **l'exploitation** de chaque compte : combien de fiches, quelles briques
ouvertes, quel statut d'abonnement, quelle dernière activité. Des compteurs et
des états.

Il ne voit **pas le contenu** : aucun nom de prospect, aucun téléphone, aucun
email, aucun montant de deal.

> ⚠ **Ce refus n'est pas de la prudence décorative, et il tient en deux
> raisons.**
>
> La première est juridique : lire le CRM d'un client, c'est lire les nom,
> téléphone et email de gens qui ne nous connaissent pas. Ça fait de nous un
> **sous-traitant** au sens de l'art. 28 du RGPD — il faudrait un contrat écrit,
> une finalité déclarée, une durée, et le client devrait pouvoir dire non.
>
> La seconde est plus simple : **l'exploitation suffit à faire le travail.** Le
> support, le succès client et le suivi de la facturation ont besoin de savoir
> si le compte tourne, s'il consomme et s'il paie. Aucun des trois n'a besoin du
> numéro de téléphone d'un prospect. Et encaisser avant le client se règle par
> Stripe Connect (`application_fee_amount`), qui ne touche à aucune donnée
> métier.

Une porte de support existe pour le contenu, et elle est **fermée par défaut**.
Elle s'ouvre sur quatre conditions cumulatives : consentement du client depuis
SON compte, date de fin, journalisation, et contrat de sous-traitance signé. La
quatrième ne se code pas — elle est prise en paramètre justement pour qu'on ne
puisse pas l'oublier en croyant que le code s'en occupe.

> ⚠ **Nous ne créons PAS de sous-comptes chez un client**, alors que nous le
> pourrions techniquement. Un compte créé par nous sous le nom d'un client est
> un compte dont le client ignore l'existence : c'est la forme exacte qu'aurait
> une porte dérobée, et elle serait indiscernable d'une vraie. Si un client veut
> un commercial de plus pendant un accompagnement, ça se fait depuis SON compte,
> avec lui.

### Mettre un client en route

`lib/client-onboarding.ts` — dix étapes datées depuis la signature, chacune
avec son porteur (nous / lui), ce qui bloque la suite, et la **preuve** qu'elle
est finie plutôt que cochée. Visible sur la fiche dès l'étape « signé ».

La signature n'est pas la fin de la vente : c'est le début du moment où on
peut la perdre. Un client qui n'a rien vu tourner en dix jours doute, et un
client qui doute ne recommande pas. Le parcours vise donc **un résultat
visible au jour 7** — petit, mais réel : c'est lui qui achète les trois
semaines suivantes.

Un client d'essai suit le même parcours. Ce n'est pas un client au rabais,
c'est un client qui n'a pas encore payé.

Un compte **gratuit**, lui, ne suit pas ce parcours du tout : il s'installe
seul, sans nous. Ce parcours-ci commence à la signature — c'est-à-dire au
moment où quelqu'un a payé pour que nous fassions le travail à sa place.

### Ce que le système REFUSE de faire

La doctrine n'est pas dans des commentaires, elle est **exécutée** :

- **Article 50 (EU AI Act)** — la divulgation IA est prononcée par le code,
  non interruptible. `audit_script` refuse un script non conforme : l'appel
  n'a pas lieu.
- **Anti-harcèlement** — l'autopilote écrit la tentative **avant** d'appeler.
  Si l'écriture échoue, l'appel ne part pas. On préfère perdre un appel que
  d'en répéter un.
- **Dès qu'il répond**, Alpha Voice s'arrête et passe la main à l'humain.
- **Opposition** (« ne me rappelez plus ») → arrêt définitif, prioritaire sur
  tout le reste.
- **Jamais de prix avant la démo**, jamais de closing sur un signal vital au
  rouge, jamais de relance sur un prospect saturé.
- **Aucun chiffre inventé** : sans données, l'argumentaire dit « je ne vous
  annonce pas de chiffre » au lieu d'estimer.

## Données réelles (pas de mock)

- **Tout vider** : Réglages → « Tout vider — mode données réelles » efface la démo.
- **Import Google Sheets** : colle un lien de partage (« tous ceux qui ont le lien ») ou de publication CSV — le serveur convertit et fusionne (matching par email/commerce, jamais de doublon). Import fichier CSV identique.
- **Colonnes reconnues** (FR/EN, accents ignorés) : commerce, nom, secteur, ville, téléphone, email, étape, abonnement, setup, taxe, **note Google, avis, appels ratés/sem, panier moyen, % conversion, site, réseaux, concurrence, process**, problèmes (séparés par `|`), notes. Bouton « Copier le modèle de colonnes » dans Réglages.
- **Deep audit par prospect** : onglet Audit & Offre → grille structurée (Google rating/avis, appels ratés, panier, conversion, site, réseaux, concurrence locale, process actuel) avec **calcul automatique de la Taxe d'Ignorance** (appels ratés × 4,33 × conversion × panier) applicable au deal en un clic.

## Webhooks — réponses entrantes

```
POST /api/webhooks/inbound
Header : x-webhook-secret: $WEBHOOK_SECRET
Body   : { "type": "email.reply", "email": "…", "name": "…", "campaignId": "…", "message": "…" }
```

Branche Instantly / Smartlead / Lemlist / Zapier / Make dessus. Les événements apparaissent dans **Campagnes → Réponses entrantes** : attache-les au prospect (timeline + stats campagne + trust), ou crée le prospect à la volée, et génère un **brouillon de réponse IA** (objectif unique : un créneau daté, jamais de prix par écrit avant la démo). Stockage : mémoire process en local, table `inbound_events` Supabase (clé `SUPABASE_SERVICE_ROLE_KEY`) en serverless.

## Envoi réel (open-source, zéro vendor lock-in)

- **Email** : [Nodemailer](https://github.com/nodemailer/nodemailer) (MIT) sur n'importe quel SMTP — `SMTP_HOST/PORT/USER/PASS/FROM` dans `.env.local` (Gmail app-password, OVH, Brevo, ton Postfix…).
- **SMS** : API compatible [Textbelt](https://github.com/typpo/textbelt) (open-source, auto-hébergeable) — `TEXTBELT_KEY` (+ `TEXTBELT_URL` si self-host).
- **WhatsApp** : lien `wa.me` pré-rempli — le message part de TON téléphone, dans TA conversation.

Boutons d'envoi partout où il y a un message : bibliothèque Templates (prospect sélectionné), onglet Templates d'une fiche, brouillons IA de l'inbox. Chaque envoi est consigné dans la timeline du prospect.

## KPIs — rollup global

La page **KPIs** ouvre sur le rollup (`components/kpis/rollup.tsx`) :
**funnel global** agrégé sur toutes les campagnes (délivré → ouvert → réponse →
follow-thru → closed, barres visuelles), **la ligne dorée** (réel vs cibles du
RUNBOOK avec statut vert/ambre/rouge + garde-fou petit échantillon),
**l'économie chiffrée** (CA généré an 1, notre part, MRR, LTV moyenne — le
no-brainer à dérouler en RDV) et le **comparatif par campagne** (où investir
l'effort, trié par LTV).

## Offre & Tarifs

Les prix PUBLICS vivent dans **`lib/offres-publiques.ts`** — une seule source.
`lib/bricks.ts` les réimporte, la vitrine et le devis les lisent : ils ne
peuvent pas diverger. Voir la grille des briques plus haut.

> ⚠ Cette section disait « les prix vivent dans `lib/bricks.ts` ». C'était vrai
> avant que `bricks` devienne un module SERVEUR — il porte le catalogue complet
> et nos marges, et `tests/vitrine-fuite.test.ts` lui interdit de descendre
> dans le navigateur. Un fichier que la moitié du produit ne peut plus importer
> n'est pas une source unique : les prix publics ont donc remonté d'un cran, et
> `bricks` est devenu un consommateur comme les autres.

**Le coût usine est chiffré** (`lib/voice-costs.ts`), tarifs fournisseurs
relevés en août 2026, chaque ligne portant sa source. À 1 000 appels/mois :
≈ 88 € de coût pour 364 € encaissés. Le poste dominant n'est pas la
téléphonie, c'est le **fixe** (57 €/mois) — d'où l'effet d'échelle : le premier
client porte tout, le dixième est quasi gratuit.

> ⚠ **NVIDIA NIM gratuit est interdit en production** (licence : développement,
> test, recherche et évaluation uniquement). Le modèle de coût retient donc un
> LLM payant — c'est le seul chiffrage honnête. Migrer coûte moins de 3 € pour
> 1 000 appels.

## Le matériau et le rythme

Trois classes, **une seule définition de chacune**, gardées par
`tests/mise-en-page.test.ts` :

- **`.page`** — le rythme d'un écran. Le padding appartient à la coquille,
  jamais à la page : deux écrans l'ajoutaient par-dessus et avaient un cadre
  plus épais que tous les autres. Les exceptions (plein écran, centrage,
  fenêtre Electron) sont listées **avec leur motif** dans le test.
- **`.card`** — la plaque de verre. Une plaque translucide, ce sont quatre
  choses ensemble : transparence, flou, **saturation**, et une arête haute
  éclairée + une arête basse dans l'ombre. Retirer la saturation suffit à la
  faire rendre grise et sale — c'est celle qu'on oublie.
- **`.panel`** — la sous-surface creusée dans une plaque, teintée avec la
  couleur du TEXTE : elle s'éclaircit sur fond sombre et s'assombrit sur crème
  sans une seule règle par thème.

**Pas de verre dans le verre** : un `backdrop-filter` imbriqué ne floute pas la
page, il floute le rendu **déjà flouté** de son parent — de la boue grise, et
une couche de composition par niveau.

Une carte sans flou doit devenir **opaque**, sinon son texte se pose sur le
dégradé de la page. Deux cas réels et gérés : le navigateur qui ne sait pas
flouter, et l'utilisateur qui a demandé moins de transparence dans son système
(`prefers-reduced-transparency` — un réglage d'accessibilité, au même titre que
`reduced-motion`).

`PageHeader` est le seul endroit où s'écrit un titre d'écran ; la chaîne était
recopiée à la main dans la quasi-totalité des pages.

### Thème clair / sombre

Bascule clair/sombre (icône soleil/lune dans la sidebar et le header mobile),
persistée, appliquée avant le premier paint (aucun flash). Sombre = défaut
marque. **Le clair ne redéfinit pas le matériau, il reteinte les jetons
`--glass-*`** : il a existé une seconde définition de `.card` par thème, et le
sombre avait reçu le flou et la saturation que le clair n'a jamais eus. Deux
définitions du même matériau = deux vérités, et les deux « marchaient ».
Implémentation : `app/globals.css`, `tailwind.config`, `lib/theme.ts`.

## Sécurité

Posture complète dans [`SECURITY.md`](./SECURITY.md) : middleware anti-CSRF
(même origine sur les endpoints internes) + rate-limit, en-têtes durcis (HSTS,
COOP/CORP, CSP…), lint anti-spam, désinscription STOP, RLS Supabase, checklist
opérateur (HTTPS, SPF/DKIM/DMARC, secrets).

**Deux serrures, à ne pas confondre.** Le cloisonnement des DONNÉES est la RLS
+ le JWT (`lib/tenant.ts`). Un « compte » du portefeuille white-label est une
frontière d'**identité commerciale** — au nom de qui on parle, quoi on vend —
jamais une frontière de sécurité.

**Ce qui descend dans le navigateur descend pour tout le monde.**
`_next/static/**` est exclu du middleware : n'importe qui télécharge ces
fichiers, avec ou sans compte. `tests/vitrine-fuite.test.ts` tient donc une
liste de modules SERVEUR qu'aucun composant client ne peut importer — le
catalogue et ses marges, le modèle de coût, le socle du Cerveau, le volet
commercial du portefeuille. La règle a été payée plusieurs fois : la grille
tarifaire complète, puis les taux de commission par compte, puis le dossier de
ciblage d'un partenaire (ses domaines et son ICP complet) se sont retrouvés
publics — à chaque fois mesuré sur le build, jamais deviné.

## Mode test / manuel (sans n8n)

La boucle complète se fait à la main — parfait pour tester le message avant
d'automatiser :

1. **Prospects** : import CSV / Google Sheets (Réglages) ou saisie manuelle
   (Pipeline → + Prospect).
2. **Scripts** : Templates → **Mes scripts** — écris tes propres emails/DM
   (variables `{prenom} {commerce} {taxe}…`), édite, supprime.
3. **Envoi** : sélectionne un prospect → variables remplies → bouton Email
   (HTML + tracking automatiques).
4. **Réponses** : elles arrivent par webhook (n8n) OU tu les **colles à la
   main** (Campagnes → Réponses entrantes → « Coller une réponse ») depuis ta
   boîte mail.
5. **Suggestion à chaque étape** : bouton « Réponse IA » sur chaque réponse
   (fonctionne même sans clé API — moteur doctrine hors-ligne), édite, envoie.
6. **Taux de réponse** : affiché en tête de l'inbox (répondants / contactés),
   ouvertures/clics dans Tracking et KPIs.

Quand le message convertit → branche l'agent conversationnel n8n
(`integrations/n8n/PROMPTS.md`) et la même boucle devient automatique, avec
les mêmes garde-fous de relecture.

## Relecture avant envoi (campagnes)

**Rien ne part tant que l'humain n'a pas validé.** Sur une campagne →
**Réviser & envoyer** : l'app génère un brouillon par prospect ciblé (premier
palier de la séquence, variables remplies avec ses vrais chiffres), puis
`components/campaigns/campaign-review.tsx` affiche chaque texte/email pour
relecture :

- **aperçu HTML fidèle** de chaque email (iframe) + **lint anti-spam** ;
- édition libre de l'objet / du corps ; alerte si des **variables `{…}` non
  remplies** subsistent ; les fiches sans coordonnée sont écartées ;
- **Approuver / Ignorer** par message ; **l'envoi est bloqué** tant qu'il reste
  un message « à valider » (garde-fou) ;
- « Envoyer les N emails approuvés » → passe par `/api/send` (HTML soigné +
  tracking + délivrabilité), consigne dans la timeline et notifie n8n
  (`campaign.sent`). Les DM WhatsApp approuvés s'ouvrent depuis ton téléphone.

## Emails, tracking & délivrabilité

**Que de beaux emails HTML.** Tout email part **rendu en HTML soigné**
(gabarit bronze EAGLEYE, table-based, responsive, lisible en clair sombre
comme clair, bouton « bulletproof » Outlook), **en multipart html + texte**.
Le corps texte des scripts est mis en forme automatiquement (`lib/email-html.ts`).
Aperçu avant envoi : `POST /api/email/preview` → `{ html, text, lint }`.

**Tracking (le « nombre de clics »).** Avant l'envoi, chaque email est
réécrit (`lib/tracking.ts`) :

- chaque lien passe par `GET /api/track/click/<id>?l=<n>` (compte le clic puis
  redirige vers l'URL d'origine — **aucun open-redirect**) ;
- un pixel 1×1 `GET /api/track/open/<id>` compte les ouvertures.

Stats : `GET /api/track/stats?prospectId=…` (ou `campaignId`, `messageId`) →
`{ messages, opens, clicks, openRate, clickRate, records }`. Stockage :
mémoire de process en local, table `tracking_messages` Supabase (clé
`SUPABASE_SERVICE_ROLE_KEY`) en serverless. Chaque ouverture/clic peut être
renvoyée à un webhook n8n (`TRACKING_WEBHOOK_URL`) pour alimenter le History
du CRM.

**Ne PAS finir dans les spams** (`lib/deliverability.ts`) :

- **Désinscription = réponse « STOP »** : le pied de chaque email invite à
  répondre STOP ; le webhook entrant remonte la réponse et **n8n** retire le
  prospect de la feuille puis en enfile un nouveau. L'en-tête
  `List-Unsubscribe: <mailto:…>` fait que le bouton natif Gmail/Apple envoie
  lui aussi un email STOP — même flux, zéro page à héberger.
- **Lint anti-spam** : mots déclencheurs, MAJUSCULES, prix dans l'objet, ratio
  texte/lien, alternative texte manquante… Score `risque` → envoi bloqué (422)
  sauf `force:true`.
- **Rate-limit anti-pic** : `MAX_SENDS_PER_HOUR` (défaut 40) — un volume
  régulier protège la réputation.
- **Infra DNS/SMTP** : configure **SPF + DKIM + DMARC** sur ton domaine
  d'envoi (voir `integrations/README.md`) — c'est 80 % de la délivrabilité.

## Tableau de bord branché sur n8n (assistant de configuration)

L'app peut fonctionner en **thin client** : la mémoire et les automatisations
vivent dans **n8n**, l'app **récupère** les données, fait les calculs et
affiche les métriques.

- **Assistant de configuration** (`components/setup-wizard.tsx`) — s'ouvre au
  premier lancement et se relance depuis **Réglages → Connexion n8n → Relancer
  l'assistant**. En 4 étapes en français simple (non-technique) : préparer n8n
  → coller l'URL du webhook → tester → importer ses prospects.
- **Connecteur** (`lib/n8n.ts`) — un seul webhook, contrat `POST { action }` :
  `ping` / `list` (→ prospects) / `event`. Le lien reste dans le navigateur ;
  le mapping des lignes est défensif (plusieurs alias de colonnes).
- **Webhook prêt à l'emploi** : [`integrations/n8n/alpha-dashboard-api.workflow.json`](./integrations/n8n).
- Les liens du navigateur vers ton n8n sont autorisés par la CSP
  (`connect-src` élargi aux domaines HTTPS + localhost). Pense à activer le
  **CORS** dans le nœud Webhook (`Allowed Origins = *`).

**Réglages → État du système** montre en un coup d'œil ce qui est configuré
(IA, SMTP, tracking, Supabase…) : une fois les identifiants en place, tout
passe au vert.

## CRM « mémoire » (Google Sheets) + backend n8n

Le CRM **est** un Google Sheets piloté par Apps Script ; le backend est un
**n8n local** dont l'agent conversationnel **remplit la mémoire à chaque
étape**. Tout est dans [`integrations/`](./integrations/README.md) :

- [`integrations/google-apps-script/`](./integrations/google-apps-script) — schéma CRM (colonnes de la liste régies Lyon), **génération de scripts selon le statut du prospect**, Web App `doGet/doPost` (token) pour n8n, seed des ~32 régies.
- [`integrations/n8n/`](./integrations/n8n) — workflow importable : agent Claude + outils `CRM_List/Get/Script/Upsert/History/Stage/Due`, mémoire de conversation.

La boucle : **n8n remplit le Sheets → l'app importe & envoie des emails HTML trackés → clics renvoyés dans le History → l'agent voit tout.**

## Training — Mode Closing & Sparring

- **▶ Mode Closing** (fiche prospect) : plein écran à dérouler PENDANT le rendez-vous. Script en 6 étapes construit avec les données réelles du deal (ses problèmes, sa taxe, son offre personnalisée), objections connues à un tap avec leur contre, écran de fin qui fait avancer le pipeline (Signé gaté par la doctrine + confettis / Red Zone / Perdu).
- **🥊 Sparring** : le prospect est joué par l'IA (méfiant mais juste — il s'adoucit si tu vends bien, durcit si tu pitches ou parles prix trop tôt). Un coach commente chaque réponse. Verdict : RDV décroché ou raté. Fonctionne aussi sans clé API (moteur local basé sur la doctrine).

## Agent conversationnel ALPHA

Page **Agent ALPHA** : chat en streaming branché sur l'état réel complet (deals, croyances, audits, RDV, campagnes, règles business). « Prépare ma journée », « quels deals sont en danger ? », rédaction de relances… Sans clé API, il répond quand même avec un briefing chiffré hors-ligne.

## Installer & former

📖 **[`docs/BIBLE.md`](./docs/BIBLE.md) — la Bible de la bonne utilisation.**
Le seul document à relire quand on ne sait plus quoi faire de sa journée :
les dix commandements, le premier mois dans l'ordre, la journée type, les
règles d'efficacité, **ce que l'OS ne fera jamais** (la part humaine, qui
ne se délègue pas), les sept péchés, et quand changer quelque chose.
**À lire en premier** — les guides ci-dessous traitent de l'installation et
de l'architecture, celui-là traite de l'usage.

**Guide pas à pas complet** (pour installer, vérifier chaque phase, et former
un employé à l'opérer) : [`docs/INSTALLATION.md`](./docs/INSTALLATION.md).
Faire tourner en continu et tenir le volume : [`docs/AUTOPILOTE.md`](./docs/AUTOPILOTE.md).
Capacités réelles et modèle de conversion : [`docs/CHIFFRES.md`](./docs/CHIFFRES.md).
Enrichir la méthode terrain : [`docs/TERRAIN.md`](./docs/TERRAIN.md).
Montée en volume : [`docs/RUNBOOK.md`](./docs/RUNBOOK.md).
Prospection multi-plateformes (email + LinkedIn + WhatsApp + SMS, quotas
anti-spam par canal) : [`docs/MULTICANAL.md`](./docs/MULTICANAL.md).
Ouvrir une conversation sans mendier (LinkedIn + lettre + audit à la demande,
les seuils et les garde-fous) : [`docs/APPROCHE-PULL.md`](./docs/APPROCHE-PULL.md).
Contrat-type (setup + 30 % à vie, clauses anti-contournement & audit) :
[`docs/CONTRAT-PRESTATION.md`](./docs/CONTRAT-PRESTATION.md) — à faire valider
par un avocat.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
```

C'est tout. L'app démarre **sans aucune configuration** : données de démo lyonnaises, persistance localStorage, IA en mode templates Hormozi.

**Ou toute la pile (app + n8n + Ollama) en une commande** avec Docker :

```bash
docker compose up -d --build
docker compose exec ollama ollama pull qwen2.5:3b   # une fois — l'IA locale
```

Détails (credentials n8n, variables, mises à jour) :
[`docs/INSTALLATION.md`](./docs/INSTALLATION.md) § Docker.

### Activer l'IA (locale gratuite, ou Claude)

```bash
cp .env.example .env.local
# Option 1 — 100 % local, zéro coût (recommandé) :
#   ollama pull qwen2.5:3b
#   OLLAMA_MODEL=qwen2.5:3b        (OLLAMA_URL=http://localhost:11434 par défaut)
# Option 2 — cloud : ANTHROPIC_API_KEY=sk-ant-…  (Ollama prioritaire si les deux)
npm run dev
```

L'onglet **AI Coach** passe automatiquement du moteur de templates à Claude (scripts terrain, notes d'audit, recadrage d'objections, résumés). Modèle par défaut : `claude-opus-4-8` (surchargeable via `AI_MODEL`).

### Activer Supabase (production)

1. Crée un projet sur [supabase.com](https://supabase.com).
2. SQL Editor → colle `supabase/schema.sql` → Run (tables + RLS + bucket attachments + audit log).
3. Authentication → Providers → Email → active **Magic Link**.
4. Renseigne dans `.env.local` :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
   ```
5. Connecte-toi via `/login`, puis Réglages → Supabase → **Pousser** pour envoyer ton état local. RLS isole chaque utilisateur ; Realtime activable table par table pour la synchro d'équipe.

## Déploiement (Vercel + Supabase)

```bash
npm i -g vercel
vercel            # lie le repo
```

Dans Vercel → Project → Settings → Environment Variables :

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | IA (server-only, jamais exposée au client) |
| `AI_MODEL` | optionnel, défaut `claude-opus-4-8` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sync + auth |

Puis `vercel --prod`. Le manifest PWA est servi ; l'app s'installe sur mobile (bottom nav dédiée).

### Ouvrir les comptes — l'ordre compte

Tant que ces variables ne sont pas posées, l'app tourne en mode **solo** :
une seule identité, tout ouvert, données dans le navigateur. C'est l'usage
d'un opérateur seul, et il ne change pas.

Pour accueillir d'autres comptes, dans **cet ordre** :

| # | Variable | Ce que ça fait |
|---|---|---|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_JWT_SECRET` | l'app sait VÉRIFIER un jeton |
| 2 | `SUPABASE_SERVICE_ROLE_KEY` | l'app sait LIRE les droits payants (sans elle : tout le monde est gratuit, jamais plus) |
| 3 | `OWNER_EMAILS` + `NEXT_PUBLIC_OWNER_EMAILS` (**même liste**) | ton compte maître |
| 4 | `REQUIRE_AUTH=1` | **EN DERNIER** — c'est lui qui ferme la porte |

> ⚠ Les trois premières ne changent RIEN tant que la quatrième n'est pas là :
> vérifié sur serveur réel. Et la misconfiguration n'ouvre jamais —
> `REQUIRE_AUTH=1` sans `SUPABASE_JWT_SECRET` fait répondre **503** aux API de
> données plutôt que de laisser passer.

**Avant et après**, lis `GET /api/health` **une fois connecté** : il rend
`auth.serverEnv`, `auth.serverEnforced`, `auth.misconfigured`, `auth.verrou` et
`proprietaire.coherent` (les deux listes `OWNER_EMAILS` concordent-elles). Il
LIT ces états, il ne les recalcule pas — il les a redéduits avec sa propre
expression régulière, et une divergence n'aurait pas planté : elle aurait
menti, dans l'outil même qui sert à vérifier la bascule.

`SITE_PASSWORD` ne garde ensuite plus que `/payouts`, `/offre` et `/api/sync` —
ce qui parle de NOTRE économie, jamais de celle du client.

## Vérifications

```bash
npm test            # la suite complète (node:test) — le compte exact s'affiche
npm run typecheck   # TypeScript strict
npm run build       # build production Next.js
```

Les trois doivent être verts avant de pousser. `npm test` couvre aussi ce qui
ne se voit pas à l'écran : les fuites de bundle, la frontière gratuit/payant,
les sources uniques de prix, et la mise en page.

## Données

- **Export** : Réglages → JSON complet (prospects, campagnes, RDV, réglages) ou CSV prospects.
- **Import** : JSON au même format (le seed est un exemple valide).
- **Reset** : Réglages → « Reset seed » restaure la démo Lyon.

---

*« Chaque contact se termine par un next step daté. Sans exception. »*
