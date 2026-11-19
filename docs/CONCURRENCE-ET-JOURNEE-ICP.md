# Concurrence, la journée idéale de notre client, et le plan (19/11/2026)

> Suite de `docs/VALORISATION.md` et `docs/ETUDE-MARCHE-BTP.md`. Notre client :
> une entreprise du BTP de 10 à 50 personnes dont les commerciaux sont sur le
> terrain tous les jours (constructeurs de maisons, menuiserie, chauffage / pompes à
> chaleur, toiture). Les sources sont surtout des comparatifs et des blogs
> d'éditeurs : prix et fonctions **à vérifier** sur les sites officiels.

## 1. La concurrence, par ce que le client a déjà

| Famille | Exemples | Prix relevé | Ce qu'ils font bien | Ce qu'ils ne font pas | Menace |
|---|---|---|---|---|---|
| **Logiciels de devis BTP** | Obat, Batappli, Costructor, Extrabat, Quotix | Obat dès 25 €/mois · Batappli 39 à 119 € HT/mois · Costructor 15 €/mois | Ils **possèdent le devis**. Obat relance déjà par email **ou SMS** | Lire la réponse, poser le RDV dans l'agenda du commercial, préparer sa journée, relancer avec une raison | **La plus forte** : ajouter « lire la réponse et poser un RDV » leur est facile |
| **CRM pour petites équipes** | noCRM.io (français), Pipedrive, HubSpot | noCRM 12 à 27 €/utilisateur/mois | La discipline de la « prochaine action » | Rien de propre au BTP, ni réponses lues, ni RDV posés seuls | Moyenne |
| **Agents IA de prospection (« SDR IA »)** | La Growth Machine, lemlist, Salestools, un agent français à 99 $/mois, 11x | 99 $/mois à 25 000 €/mois | Prospection à froid d'entreprises, en volume | **Notre client vend surtout à des particuliers** qui ont DEMANDÉ un devis : ce n'est pas du démarchage à froid | Faible sur ce client |
| **Bricolage n8n par un indépendant** | « relance de devis avec n8n » | quelques centaines d'euros une fois | Pas cher | Fragile, personne ne le maintient, aucune règle de conformité | Faible |
| **Ne rien faire** | le commercial relance le soir… ou pas | 0 € | Rien à acheter | Les devis meurent en silence | **Le vrai concurrent** |

**Ce que ça veut dire :**
- **On ne se bat pas contre leur logiciel de devis, on se branche dessus.** Il coûte
  15 à 120 € par mois, et ils ne le quitteront pas. ALPHA prend leurs devis (un
  export suffit) et fait **tout ce qui se passe après l'envoi**.
- **Notre différence tient en une combinaison**, pas en une fonction : relancer
  seulement avec une raison, lire la réponse, poser le rendez-vous dans l'agenda du
  bon commercial, lui préparer sa journée, et appliquer la loi dans le code (STOP,
  limite de sollicitations, heures). Personne dans le tableau ne fait les cinq.
- **Notre faiblesse** : zéro client, et aucun branchement direct avec ces logiciels
  aujourd'hui. La première se règle par l'offre client fondateur, la seconde par
  un import de fichier, avant tout connecteur.

## 2. La journée idéale de notre client — ce qui serait un miracle pour lui

**Aujourd'hui** (d'après `docs/ETUDE-MARCHE-BTP.md`) : les commerciaux vendent
30 à 40 % de leur temps ; les devis partent et beaucoup restent sans nouvelles ;
une demande reçue le matin est rappelée le soir ; le dirigeant ne sait pas, chiffres
à l'appui, combien de devis sont « en train de mourir ».

**Avec ALPHA, la journée qu'on vise :**

| Moment | Ce qui se passe | Ce qui existe déjà | Ce qui manque |
|---|---|---|---|
| **7 h 30** | Sur son téléphone, chaque commercial a sa journée : ses rendez-vous, les devis à relancer aujourd'hui et pourquoi, les appels à passer | Closer OS, session d'appels, « Aujourd'hui » | les devis comme vrais objets (montant, date, statut, commercial) |
| **Dans la journée** | Chaque devis envoyé est suivi. À J+2 : « bien reçu ? une question ? » ; ensuite, une relance seulement avec une raison (aide qui change, créneau de pose qui se libère, sa propre date) ; arrêt dès qu'il répond | relance avec raison, lecture des réponses, arrêt au refus | **l'import des devis** et une séquence propre au devis ; **le SMS** (un particulier lit ses SMS) |
| **Une demande arrive** | Formulaire du site, salon : réponse en quelques minutes, avec des créneaux du commercial libre | créneaux depuis l'agenda, invitation | **la capture des demandes entrantes** et la réponse immédiate |
| **« Oui »** | Le rendez-vous est posé dans l'agenda du bon commercial, l'invitation part | oui, pour une personne | **l'agenda par commercial** (plusieurs agendas) |
| **« Trop cher », « on verra »** | Ça remonte au commercial avec tout l'échange ; ALPHA ne négocie jamais | oui (« À décider », notifications) | — |
| **Le soir** | Plus d'administratif : un débrief vocal d'une minute met la fiche à jour | Débrief terrain | — |
| **Le vendredi, le dirigeant** | Un tableau : devis relancés, réponses, RDV, **signatures récupérées**, par commercial | notifications, pipeline | **le tableau de mesure** (c'est aussi notre preuve pour lever) |

**La valeur de ce miracle, pour une entreprise de 3 commerciaux (hypothèses de
`docs/ETUDE-MARCHE-BTP.md`, à remplacer par la mesure du premier client) :**
- **1 point de taux de signature en plus** sur ~900 devis par an à ~10 000 € :
  9 chantiers, **~90 000 € de chiffre d'affaires**.
- **1 heure d'administratif rendue par jour** et par commercial : ~**23 000 €** de
  salaires qui redeviennent du temps de vente.
- **Une demande traitée en minutes au lieu d'heures** : pas de chiffre honnête
  aujourd'hui, mais c'est le moment où le client compare.
- En face : ALPHA à 4 utilisateurs, ~11 000 € par an, plus l'installation. Avec
  l'offre fondateur, 2 500 €, payés seulement après un premier rendez-vous.

## 3. L'offre client fondateur (décidée le 19/11/2026)

Dans le code : `OFFRE_CLIENT_FONDATEUR` (`lib/offres-publiques.ts`), dite par le
pilote quand on lui demande le prix tant qu'il reste des places.
- **3 places.** La rareté est un fait : l'installation se fait à la main, par une
  seule personne. `placesPrises` se met à jour à chaque signature.
- **Installation à 2 500 € HT au lieu de 10 000 €**, payable **seulement après un
  premier rendez-vous obtenu par ALPHA** dans les 30 jours de mise en service.
- **Abonnement à la grille normale** (600 € + 80 € par utilisateur et par mois),
  **prix bloqué 12 mois**, engagement de **3 mois**.
- **En échange** : l'accès aux chiffres (devis relancés, réponses, RDV,
  signatures), le droit de citer le nom et les résultats **après relecture du
  client**, 30 minutes de retour par mois pendant 3 mois.

## 4. Le plan — 12 semaines

**L'indicateur de la semaine : le nombre de rendez-vous commerciaux obtenus.**

| Semaines | Vendre (Zakaria) | Construire (ALPHA) | Ce qui prouve que c'est fait |
|---|---|---|---|
| **1 – 2** | 100 invitations LinkedIn, 20 appels par jour sur la liste des 100, l'offre fondateur dite à chaque appel | **Relance de devis, version 1** : import d'un fichier de devis (client, email, téléphone, montant, date, commercial), séquence de relance avec raison, réponses lues, créneaux, sur la mécanique du pilote existant | 5 rendez-vous ; un fichier de devis importé et relancé en démo |
| **3 – 4** | Démonstrations sur LEURS devis ; **premier client fondateur signé** | Installation à la main chez lui ; ses devis importés ; relances en route | une facture d'installation émise après son premier RDV |
| **5 – 8** | Clients fondateurs 2 et 3 | **SMS** (avec le compte d'envoi du client, mention STOP) ; **capture des demandes entrantes** (formulaire → réponse en minutes) ; **agenda par commercial** | les SMS partent, une demande reçoit des créneaux en moins de 5 minutes |
| **9 – 12** | Premier témoignage chiffré (relu par le client) ; 10 rendez-vous par semaine | **Tableau de mesure** pour le dirigeant : devis relancés → réponses → RDV → signatures récupérées, en euros | le premier chiffre réel : « X devis relancés, Y signatures récupérées, Z € » |

**Ce qu'on ne construit pas pendant ces 12 semaines** : un connecteur direct avec
Obat ou Batappli (l'export de fichier suffit jusqu'au 10ᵉ client), de nouveaux
agents, de nouveaux métiers, un autre film qu'un par semaine.

## Sources
- Relance de devis dans les logiciels BTP : https://www.obat.fr/blog/suivi-client-btp/ · https://www.obat.fr/blog/mail-de-relance-devis/
- Prix des logiciels BTP : https://www.appvizer.fr/magazine/construction/btp/logiciel-artisan · https://www.blogdumoderateur.com/tools/obat/ · https://tool-advisor.fr/logiciel-facturation/comparatif/logiciel-btp/
- Relance n8n faite par des indépendants : https://comeup.com/fr/service/546611/relancer-automatiquement-vos-devis-sans-reponse-avec-n8n
- noCRM : https://tool-advisor.fr/logiciel-crm/nocrm/ · https://www.lafabriquedunet.fr/logiciels/alternatives/alternative-nocrm-io
- Agents IA de prospection : https://www.knowlee.ai/fr/blog/meilleurs-outils-sdr-ia-2026 · https://hackceleration.com/fr/labs/a-suivre/agents-ia-prospection · https://lagrowthmachine.com/fr/meilleurs-agents-ia-automatisation-ventes-2026/
