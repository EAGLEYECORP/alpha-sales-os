# Le cycle face au récit « GTM IA » — ce qui est vrai, ce qui manque, ce qu'on refuse

> Écrit le 21/10/2026, à partir d'une conversation avec Gemini que Zakaria a
> collée (« ce qui rend les systèmes GTM IA si bons », « ce qui manque à Alpha
> pour être le n°1 », « 100 M€ ? »). La question posée : **UX/UI et
> faisabilité du cycle qualification → relances → accompagnement du
> commercial**. Ce document confronte chaque affirmation au CODE, pas au
> discours. Ce qui est mesuré est marqué comme tel.

---

## 0. Ce que Gemini affirme sur Alpha, et qui est faux

Gemini n'a pas lu le dépôt : il a lu la vitrine et a complété. Ces cinq
affirmations reviennent dans ses réponses et ne tiennent pas.

| Affirmation | Réalité |
|---|---|
| « Local-first avec synchronisation Supabase » | Le CRM d'un inscrit vit dans **son navigateur** (`localStorage`). La synchro serveur (`pipeServeur`) est opt-in, pour le volume, et **ne sert pas** à l'autonomie (décision du 21/10, `docs/STATION-AUTONOME.md`). |
| « On a migré tout le système dans le cloud, n'importe qui peut l'utiliser » | L'**application** est en ligne et gratuite. Le **pipe** d'un inscrit reste chez lui, l'autopilote et la voix ne tournent que **chez vous**. « N'importe qui peut s'inscrire » est vrai ; « tout tourne dans le cloud » ne l'est pas. |
| « Voix native, multimodale, prête » | ALPHA VOICE existe (entrant prouvé, art. 50 prononcé par le code). Il tourne **en local chez nous** et s'installe **chez le client**. Il n'est pas en ligne. |
| « Rappel vocal d'un lead en 15 secondes à 23 h » | Refusé par construction : fenêtres d'appel, décret 2022-1313, battement de présence obligatoire avant de composer. |
| Implicite : une base clients, de la traction | **0 affaire gagnée** (`JUILLET_REEL.gagnes`). Aucune vente ne valide un seul prix. |

> ⚠ Un document d'investisseur qui reprendrait ces cinq phrases se ferait
> démonter à la première question technique. Ce dépôt a déjà payé ce coût
> (l'affiliation French Tech, `docs/ANGLES-MORTS.md`).

---

## 1. Qualification — le signal est désormais celui de TOUTE entreprise (22/10/2026)

> ⚠ **Cette section disait « notre ICP en est déjà un : le permis ».** C'était
> vrai jusqu'au 21/10. Depuis la bascule horizontale, un inscrit vend
> n'importe quoi à n'importe qui — et le permis ne dit rien d'un cabinet
> comptable ou d'un garage. **Un inscrit n'avait plus AUCUN signal.**

**Ce qui existe et marche** : `lib/signaux-publics.ts` (annonces légales, toute
entreprise) · `lib/permis-construire.ts` (source optionnelle) ·
`lib/import-triage.ts` · `lib/ladder.ts` · `lib/deep-dive.ts` · `lib/offer-match.ts`.

**Les annonces légales (BODACC), lues par SIREN** — l'équivalent du permis pour
toutes les sociétés françaises : officiel, daté, vérifiable, gratuit, sans clé.
- **Exclusion sèche et nommée** : procédure collective (24 mois), radiation
  (sauf SIREN revenu à la vie), dissolution. La fiche sort de la file humaine
  ET du robot (`dansLaFile`, `buildCampaignRun`) — comptée, jamais tue.
- **Moment** : nouvelle direction, déménagement, rachat ou fusion, création,
  capital, activité, nouveau nom. Frais (< 60 j), il remonte la fiche en tête
  de la file — et **ne se cite pas** au prospect (`phraseDuMoment`).
- **Mesuré sur de vraies annonces le 22/10** (bac à sable, rien de commité) :
  10/10 liquidations exclues, 10/10 radiations, 10/10 transferts lus comme
  déménagements. Trois hypothèses fausses trouvées AVANT d'écrire les tests :
  « immatriculation » = déménagement hors ressort (pas une création),
  « Modification du capital » ne dit pas « augmentation », et une vente /
  fusion range parfois la société ABSORBÉE en tête du registre (3 cédants sur
  10 sortaient « rachat » — c'est la liste des anciens propriétaires qui tranche).
- **La liste des SIREN ne passe pas par notre serveur** : l'API répond
  `access-control-allow-origin: *`, la lecture part du navigateur. La première
  version passait par une route à nous — elle aurait vu le pipe de chaque
  inscrit. Un test refuse son retour.
- **« 000000000 » passe la clé de Luhn ET porte 1 563 annonces** (numéro de
  remplissage) : refusé partout, cadence légale comprise.

**Ce qui manque encore** :
- **Le SIREN sur la fiche.** Une colonne « SIREN » ou « SIRET » est lue à
  l'import, et la fiche a un champ. Mais la plupart des listes n'en ont pas, et
  on ne le devine **jamais** par le nom (un faux rapprochement colle la
  liquidation d'une société sur la fiche d'une autre). Le retrouver par la
  recherche publique, avec confirmation humaine, est le chantier suivant.
- **L'alimentation** : Alpha ne collecte rien (`docs/COLLECTEURS-EXTERIEURS.md`).
  Un inscrit arrive sur un pipe vide + la démo.
- **Les autres signaux publics** (marchés publics attribués, recrutements) : non
  faits. Chacun se mesure sur l'API réelle avant d'être écrit, comme celui-ci.

---

## 2. Relances (« nurturing ») — ⚠⚠ la source des raisons neuves est MORTE depuis le 17/10

**Ce qui existe** : `lib/master-rappel.ts` (vitaux, fatigue, fenêtre, plan de
comms) · `lib/call-cadence.ts` (4 contacts / 30 j, décret 2022-1313) ·
`lib/raison-neuve.ts` · `lib/relance-mail.ts` · `lib/reactivite.ts` ·
`lib/linkedin-sequence.ts`. La discipline est bonne : pas de relance sans fait
daté, jamais « je me permets de relancer ».

**Le constat, mesuré le 21/10/2026** : `raisonNeuve` n'a que deux sources.
- **Le prix honoré** (`PRIX_HONORE_JUSQU_AU = 2026-10-17`) : **expiré**. Le code
  exige `échéance ≥ maintenant` ; depuis le 18/10, aucune fiche ne peut plus
  la produire. Ce n'est pas une estimation, c'est la condition du code.
- **Une ouverture d'email récente** : ne vit que côté serveur (tracking), donc
  seulement pour NOTRE pipe — jamais dans le navigateur d'un inscrit.

Mesuré sur le jeu de démonstration : **0 raison neuve sur 8 fiches**, au 10/10
comme au 21/10. Le pipe réel n'est pas dans ce conteneur (`donnees-privees/`
absent) et n'a pas été mesuré.

**Conséquences** :
- la relance automatique par email (`relanceDue` → `raisonDisponible`) **ne
  part plus jamais**, sauf ouverture tracée ;
- l'écran affiche `AUCUNE_RAISON` (« ne relance pas pour relancer ») — c'est le
  bon comportement, mais c'est un cycle de relance **à l'arrêt**.

**Ce qu'il ne faut PAS faire** : repousser la date de `PRIX_HONORE_JUSQU_AU`
pour « relancer la machine ». Ce serait fabriquer une échéance — une fausse
urgence, exactement ce que le module refuse.

**Ce qui se tranche (Zakaria)** — trois sources honnêtes possibles :
1. **La date de l'arrêté, structurée sur la fiche** (aujourd'hui elle n'existe
   qu'en texte libre dans `notes`). Elle permet de choisir le MOMENT (passage de
   la phase « recours » à « pré-commercialisation »). ⚠ Le délai de recours
   court à partir de l'**affichage**, pas de l'arrêté : la phrase ne doit
   **jamais** affirmer « votre permis est purgé ». Le fait choisit le moment, il
   ne se dit pas.
2. **Un engagement pris par le prospect** (« rappelez-moi en janvier », déjà
   consigné en `nextStep`) : c'est SA date, pas la nôtre.
3. **Rien** : accepter que la relance après le premier contact soit humaine,
   et le dire à l'écran.

> ✅ **22/10/2026 — l'option 2 est branchée** (`raisonNeuve`, source `sa-date`) :
> l'écran d'appels propose « Il a donné une date ? » après « Rappeler », et
> cette date — la SIENNE, consignée comme telle — produit la raison à
> l'échéance. Elle vaut pour n'importe quel métier ; l'option 1 (permis) n'a
> pas été faite, la cible permis ayant été retirée le 21/10.

---

## 3. Accompagnement du commercial — réel, et c'est le point fort

Ce que le commercial a **sous les yeux au moment d'agir** :
- `/aujourdhui` : le plan du matin calculé (`computeRoutines`), plafonné, ce
  qui est replié est compté ;
- la **bande « ALPHA a besoin de toi »** sur chaque écran, le compteur dans
  l'onglet, la notification sur un point urgent (`lib/presence-alpha.ts`) ;
- **« Lancer ALPHA »** : six étapes réelles, brouillons préparés, rien ne part ;
- **`/appels`** : le script de la verticale, ce qu'on ne dit jamais à froid,
  les objections et leurs réponses, l'**angle de chaque prospect**
  (`callAngle` : objection bloquante, prochaine étape dépassée, offre en
  attente…), un geste pour consigner le résultat, qui pose la prochaine étape
  datée et alimente la cadence ;
- le Closer OS (tournée, débrief à la voix), ALPHA LIVE pendant l'appel.

**Les trous, nommés** :
- la fiche de préparation en 30 secondes existe (`briefForScript`,
  `lib/deep-dive.ts`) mais ne sert qu'à l'agent vocal et aux campagnes
  automatiques (`/api/voice/call`, `lib/campaign-runner.ts`), pas à l'humain
  qui va appeler ;
- le **briefing du matin hors de l'app** (téléphone, app fermée) n'existe que
  pour NOTRE pipe et chez vous — un inscrit en ligne ne l'a qu'onglet ouvert,
  et c'est une décision, pas un oubli.

---

## 4. Les recommandations de Gemini, une par une

| Recommandation | Verdict | Pourquoi |
|---|---|---|
| Agents « par objectif » au lieu de séquences linéaires | **En partie là** | La cadence suit la réactivité, pas le calendrier (`master-rappel`). Un agent qui agit seul **en ligne** : refusé le 21/10. |
| Signal / intention « dark funnel » (Reddit, Discord, GitHub, IP) | **Refusé** | Collecte embarquée, RGPD, et notre argument est la conformité. Nos signaux sont PUBLICS et officiels : les annonces légales de toute entreprise (`lib/signaux-publics.ts`, 22/10), le permis en option. |
| Rotation automatique de domaines, réchauffement « auto-réparant » | **Refusé** | C'est contourner les filtres anti-spam. On a un palier d'envoi (5 → 40/j), une boîte, un DMARC strict prouvé (`spf/dkim/dmarc = pass`, 21/10). |
| « Simuler Gmail avant d'envoyer, sinon basculer de canal » | **En partie là** | Le score anti-spam et les mentions obligatoires sont arbitrés par `/api/send`. La bascule automatique de canal : non, un humain décide. |
| Rappel vocal immédiat des leads entrants, la nuit | **Refusé** | Fenêtres d'appel, décret 2022-1313, art. 50. L'entrant (on décroche) existe chez vous. |
| ICP et prompts qui s'auto-ajustent sur les gagnés/perdus | **Refusé** | « Aucun poids ne s'auto-corrige » : sur quarante appels on apprend le bruit. Et à **0 affaire gagnée**, il n'y a rien à apprendre. |
| Télémétrie inter-comptes pour entraîner un modèle | **Se décide** | Ça casserait la promesse « la donnée métier ne passe par aucun tiers ». |
| Modèles propriétaires affinés | **Hors de portée** | Et ce n'est pas notre fossé : on loue l'intelligence, on fabrique ce qui permet de s'en servir sans se mettre hors la loi (`lib/promesse.ts`). |
| « 100 % souverain » comme argument | **Interdit** | Une clé d'IA envoie du texte au fournisseur du modèle. On dit où tournent l'app et sa base. |
| Briefing du matin sur WhatsApp / Slack | **Faisable chez vous** | En ligne, seulement onglet ouvert. |
| Mémoire commune voix ↔ écrit | **En partie là** | Une seule chronologie par fiche ; un résultat d'appel règle la cadence (`RESULTATS_MANUELS`). |
| Installation isolée pour les grands comptes | **« Chez vous » la couvre en partie** | Serveur du client, Ollama possible (`docker-compose.yml`). Jamais testée hors de chez nous. |

---

## 5. 100 M€

Gemini le dit lui-même : un tel montant suppose 10 à 20 M€ de revenu récurrent.
Nous sommes à **0 €**. Aucune page, aucune vidéo et aucune architecture ne
comble cet écart ; un premier client qui paie, si. Le produit est en avance sur
la vente — c'est la vente qui manque, pas une fonctionnalité.

---

## 6. Dans l'ordre

1. **Trancher la source de raison neuve** (§ 2) : sans elle, le cycle de
   relance est à l'arrêt.
2. **Une vraie liste de 20 fiches ICP** dans le pipe, pour faire tourner le
   cycle de bout en bout sur du réel.
3. **Une installation « chez vous »** : c'est là que l'ALPHA qui travaille app
   fermée existe, et c'est ce qui se vend.
