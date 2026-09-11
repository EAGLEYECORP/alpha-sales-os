/**
 * ─────────────────────────────────────────────────────────────────────
 * LE JEU DE DÉMONSTRATION EAGLEYE — REMIS À ZÉRO LE 09/09/2026.
 *
 * ── CE QUI ÉTAIT LÀ AVANT, ET POURQUOI ÇA NE POUVAIT PAS RESTER ──
 *
 * Huit fiches de commerces lyonnais : un bouchon, un pub irlandais, deux
 * sociétés d'ambulances, un menuisier, un plombier. C'était le marché
 * d'ORIGINE — celui d'avant l'avatar. Le premier bouton de l'app est
 * « Explorer la démo » : la première chose qu'un prospect voyait de l'OS
 * décrivait donc une cible que nous ne prospectons plus.
 *
 * ── CE QUI LES REMPLACE ──
 *
 * L'avatar décidé : le **maître d'ouvrage PROFESSIONNEL** dont le permis de
 * construire est **actif**, sur **Lyon et Villeurbanne**. C'est un ICP à
 * DÉCLENCHEUR, pas à secteur : un permis dit non seulement QUI, mais OÙ EN EST
 * l'affaire, au mois près — donc QUAND appeler.
 *
 * ⚠ CES FICHES NE SONT PAS DÉCORATIVES : ELLES DESCENDENT DE PERMIS.
 * Chaque fiche déclare son arrêté dans `PERMIS_DEMO`, et
 * `tests/seed-moa.test.ts` rejoue chacun d'eux dans le VRAI trieur
 * (`lirePermis`, lib/permis-construire.ts) pour vérifier qu'il serait retenu.
 * Un jeu de démonstration qui contredirait le module de ciblage montrerait au
 * prospect exactement ce que le produit refuse de faire.
 *
 * ⚠⚠ Ce n'est PAS l'ICP complet du produit. Alpha Sales OS se vend aussi
 * ailleurs (`lib/segments.ts`) ; ce fichier porte la campagne EN COURS, pas la
 * portée de l'outil. Ne pas lire l'une dans l'autre.
 *
 * ── LES QUATRE GARANTIES, IDENTIQUES À CELLES DU JEU ENGENDRÉ ──
 *
 * Elles étaient tenues par `lib/demo-icp.ts` et PAS par ce fichier-ci, qui est
 * pourtant celui qu'on voit en premier. Elles le sont maintenant des deux
 * côtés :
 *  · identifiant préfixé `demo-` → `isDemoProspect` répond sur la FORME ;
 *  · téléphone dans les plages ARCEP réservées à la fiction (2018-0881) ;
 *  · adresse sur `example.com`, réservé à jamais par la RFC 2606 — les
 *    anciennes fiches portaient des domaines INVENTÉS en `.fr`, qui peuvent
 *    être déposés par n'importe qui demain ;
 *  · « (démo) » DANS le nom de société, donc dans les exports et les captures.
 *
 * ⚠ LA QUATRIÈME S'EST RÉVÉLÉE TENUE À UN SEUL ENDROIT, le 11/09/2026, en
 * préparant une vidéo de captures d'écran. Le marqueur vivait dans `company`
 * — que l'écran du matin n'affiche JAMAIS — et manquait dans les dix chaînes
 * qu'il affiche vraiment : `seedMeetings[].title` et `seedActivities[].message`.
 * Dont « SIGNÉ ✓ <fiche> », c'est-à-dire un client signé inventé sur une image
 * sortie de son contexte, alors que `JUILLET_REEL.gagnes` vaut 0.
 * La règle est désormais STRUCTURELLE : tout enregistrement rattaché à une
 * fiche de démo porte le marqueur, qu'il la nomme ou non. Reconnaître par
 * l'identifiant, jamais par le nom — un motif lexical ratait « Terrasses des
 * Canuts » face à « **Les** Terrasses des Canuts », et c'est la mutation qui
 * l'a dit, pas la relecture.
 * ─────────────────────────────────────────────────────────────────────
 */
import type {
  Activity,
  Attachment,
  Campaign,
  Competitor,
  ContractInfo,
  Croyances,
  DeepAudit,
  DeliveryStatus,
  Meeting,
  NextStep,
  NurtureSequence,
  Objection,
  Obstacle,
  Payment,
  Prospect,
  TimelineEvent,
} from "./types";
import { daysAgo, daysAhead, daysAheadAt } from "./utils";
import { ALPHA_VOICE_PALIERS, ALPHA_VOICE_SETUP_HT, PACK_SETUP_HT } from "./offres-publiques";
/**
 * ⚠ IMPORT DE TYPE UNIQUEMENT, ET C'EST OBLIGATOIRE.
 *
 * `lib/permis-construire.ts` importe `prospectDefaults` d'ici. Un import de
 * VALEUR dans l'autre sens fermerait le cycle, et un cycle rend `undefined`
 * au module qui s'initialise en premier — c'est-à-dire un plantage à
 * l'ouverture de l'app, pas une erreur de compilation. Un `import type`
 * s'efface à la compilation : il n'y a aucun cycle à l'exécution.
 */
import type { PermisConstruire } from "./permis-construire";

/**
 * Defaults for fields added over time — applied to every seed prospect.
 *
 * ⚠ CE SOCLE EST AUSSI CELUI DE TOUS LES IMPORTS, pas seulement des données de
 * démo : `normalizeProspect` (lib/store.ts), `ficheVersProspect` (terrain) et
 * `profilVersProspect` (LinkedIn) le déversent tous avant d'ajouter leurs
 * champs. Une clé absente ICI est donc absente de CHAQUE fiche importée.
 *
 * Il manquait les cinq TABLEAUX : `events`, `objections`, `obstacles`,
 * `attachments` — plus `croyances`. Conséquence mesurée : après un import
 * terrain, `construireJournee` plantait sur `p.events[0]` et la page
 * « Aujourd'hui » — l'écran d'entrée du matin — tombait en écran blanc.
 * Les modules qui écrivaient `p.events ?? []` survivaient ; les autres non.
 *
 * Un tableau vide et un tableau absent doivent se comporter pareil. La règle :
 * TOUT champ de `Prospect` qui n'est pas optionnel dans le type a sa valeur
 * neutre ici.
 *
 * ⚠⚠ CETTE LIGNE DISAIT « ET `tests/store.test.ts` LE VÉRIFIE CHAMP PAR
 * CHAMP ». CE TEST N'EXISTAIT PAS — zéro occurrence de `prospectDefaults`
 * dans ce fichier. La phrase rassurait exactement là où il fallait vérifier.
 *
 * Ce que ça cachait, mesuré en appelant le vrai point d'entrée
 * `importerProfils()` : une fiche importée depuis LinkedIn sortait avec
 * `trust`, `auditScore`, `conviction`, `probability`, `ignoranceTax`,
 * `monthlyValue` et `setupValue` TOUS `undefined`. Le `as Prospect` en fin de
 * `profilVersProspect` (et celui de `normalizeProspect`) empêche le
 * compilateur de le voir ; les écrans, eux, font de l'arithmétique et des
 * `toLocaleString()` dessus. C'est le même écran blanc que les cinq tableaux,
 * sur un autre importeur.
 *
 * Les valeurs ci-dessous ne sont pas inventées : ce sont celles que `csv.ts`
 * et `n8n.ts` posaient déjà, à l'identique, chacun de son côté. Les remonter
 * ici supprime la copie en même temps que le trou. La garde vit maintenant
 * dans `tests/prospect-defaults.test.ts`, et elle DÉRIVE la liste du type.
 */
export const prospectDefaults = {
  likeness: 55,
  /**
   * Les curseurs 0–100 d'une fiche dont on ne sait encore rien.
   * `trust: 10` / `conviction: 8` : un inconnu n'est pas à zéro (on a une
   * raison de l'avoir importé) mais il est très bas. `auditScore: 0` : rien
   * n'a été audité, et c'est exact.
   */
  trust: 10,
  auditScore: 0,
  conviction: 8,
  /**
   * Le stade réel écrase cette valeur à l'import (`STAGES[stage].probability`).
   * 5 % est le plancher : une fiche sans stade connu est en entrée de
   * pipeline, pas à la moitié du chemin.
   */
  probability: 5,
  /** Les montants : zéro, jamais une estimation. On ne devine pas un chiffre d'affaires. */
  monthlyValue: 0,
  setupValue: 0,
  ignoranceTax: 0,
  notes: "",
  problems: [] as string[],
  solution: "",
  personalizedOffer: "",
  payments: [] as Payment[],
  contract: { status: "aucun" } as ContractInfo,
  delivery: "non-demarre" as DeliveryStatus,
  // ── Les tableaux. Leur absence est un plantage, pas une valeur manquante. ──
  events: [] as TimelineEvent[],
  objections: [] as Objection[],
  obstacles: [] as Obstacle[],
  attachments: [] as Attachment[],
  tags: [] as string[],
  croyances: { produit: 0, soutien: 0, pourLui: 0 } as Croyances,
  nextStep: null as NextStep | null,
  demoShownBeforePrice: false,
  deepAudit: {
    websiteState: "",
    socialState: "",
    localCompetition: "",
    currentProcess: "",
  } as DeepAudit,
};

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES ARRÊTÉS DONT DESCENDENT LES FICHES DE DÉMONSTRATION.
 *
 * Onze lignes telles qu'un export d'open data les livre — huit qui passent le
 * trieur, trois qui sortent, chacune pour une raison DIFFÉRENTE : un
 * particulier, une commune hors zone, un permis périmé. Les trois écartées
 * comptent autant que les huit autres : elles montrent, sur l'écran d'import,
 * que le filtre travaille.
 *
 * ⚠ Les dates sont RELATIVES (`daysAgo`), sinon le jeu de démonstration
 * périmerait tout seul : au bout de trois ans, tous les permis deviendraient
 * « perime » et les huit fiches disparaîtraient du tri sans que personne
 * touche à rien.
 *
 * ⚠⚠ `tests/seed-moa.test.ts` rejoue chacune de ces lignes dans `lirePermis`.
 * Changer une commune, un demandeur ou une date ici fait tomber le test —
 * c'est exactement le but : la démo ne peut pas dériver de la doctrine de
 * ciblage sans que ça se voie.
 */
export const PERMIS_DEMO: readonly PermisConstruire[] = [
  // ── LES HUIT RETENUS ──
  { numero: "PC 069 384 26 A0117", demandeur: "SCCV LES TERRASSES DES CANUTS (démo)", dateDecision: daysAgo(240), logements: 68, surfacePlancher: 4210, commune: "Lyon 4e" },
  { numero: "PC 069 266 25 A0043", demandeur: "GRATTE-CIEL PROMOTION SAS (démo)", dateDecision: daysAgo(600), logements: 94, surfacePlancher: 6180, commune: "Villeurbanne" },
  { numero: "PC 069 388 26 A0201", demandeur: "SCCV CARRÉ MONPLAISIR (démo)", dateDecision: daysAgo(150), logements: 34, surfacePlancher: 2240, commune: "Lyon 8e" },
  { numero: "PC 069 386 25 A0090", demandeur: "FONCIÈRE DU RHÔNE NORD — PROMOTION IMMOBILIÈRE (démo)", dateDecision: daysAgo(420), logements: 22, surfacePlancher: 1610, commune: "Lyon 6e" },
  { numero: "PC 069 389 26 A0064", demandeur: "MAISONS INDIVIDUELLES DU VAL D'OUEST (démo)", dateDecision: daysAgo(95), logements: 12, surfacePlancher: 1080, commune: "Lyon 9e" },
  { numero: "PC 069 382 24 A0288", demandeur: "SCCV QUAI DE LA CONFLUENCE (démo)", dateDecision: daysAgo(880), dateOuvertureChantier: daysAgo(300), logements: 51, surfacePlancher: 3390, commune: "Lyon 2e" },
  { numero: "PC 069 266 26 A0112", demandeur: "SAS RÉSIDENCES DES GRATTE-CIEL (démo)", dateDecision: daysAgo(120), logements: 9, surfacePlancher: 640, commune: "Villeurbanne" },
  { numero: "PC 069 383 26 A0305", demandeur: "PART-DIEU AMÉNAGEUR SAS (démo)", dateDecision: daysAgo(40), logements: 120, surfacePlancher: 8900, commune: "Lyon 3e" },

  /**
   * ── LES TROIS ÉCARTÉS, ET CHACUN PAR UNE RÈGLE DIFFÉRENTE ──
   *
   * Ils ne produisent AUCUNE fiche : `trierPermis` les sort, et c'est tout ce
   * qu'on veut montrer. Les garder dans le lot est ce qui rend l'écran
   * d'import honnête — « 8 retenus sur 11 » se comprend, « 8 fiches » ne dit
   * rien du travail fait.
   */
  // Personne physique : elle construit une fois, elle ne vend rien — et c'est
  // un consommateur, donc le décret n° 2022-1313 s'applique.
  { numero: "PC 069 381 26 A0019", demandeur: "M. et Mme DUVAL (démo)", dateDecision: daysAgo(60), logements: 1, surfacePlancher: 140, commune: "Lyon 1er" },
  // Hors zone : un bon permis, au mauvais endroit.
  { numero: "PC 069 029 26 A0071", demandeur: "BÂTIR BRON SAS (démo)", dateDecision: daysAgo(130), logements: 40, surfacePlancher: 2800, commune: "Bron" },
  // Périmé : plus de trois ans sans chantier déclaré. « Je vous appelle pour
  // votre programme » sur une opération morte coûte l'appel entier.
  { numero: "PC 069 385 22 A0154", demandeur: "SCCV LES JARDINS DE SAINT-JUST (démo)", dateDecision: daysAgo(1400), logements: 18, surfacePlancher: 1250, commune: "Lyon 5e" },
];

/**
 * Quel arrêté a fait entrer quelle fiche.
 *
 * ⚠ Une table séparée, et pas un champ sur `Prospect` : le type est partagé
 * avec tous les imports (CSV, LinkedIn, terrain, API) et n'a aucune raison de
 * porter un numéro de permis. Ce lien-là n'existe que pour la démonstration et
 * pour le test qui la garde honnête.
 */
export const PERMIS_PAR_FICHE: Readonly<Record<string, string>> = {
  "demo-sccv-canuts": "PC 069 384 26 A0117",
  "demo-gratteciel-promotion": "PC 069 266 25 A0043",
  "demo-sccv-monplaisir": "PC 069 388 26 A0201",
  "demo-fonciere-rhone-nord": "PC 069 386 25 A0090",
  "demo-maisons-val-ouest": "PC 069 389 26 A0064",
  "demo-sccv-confluence": "PC 069 382 24 A0288",
  "demo-residences-gratteciel": "PC 069 266 26 A0112",
  "demo-partdieu-amenageur": "PC 069 383 26 A0305",
};

/**
 * Les deux paliers Alpha Voice, nommés une fois.
 *
 * ⚠ AUCUN MONTANT N'EST RECOPIÉ ICI. La grille vit dans
 * `lib/offres-publiques.ts` et elle a déjà changé deux fois (990 + cinq
 * paliers hérités d'un revendeur, puis 990 + 149/349). Une démo qui affiche
 * un prix périmé est pire qu'une démo vide : c'est le prix qu'un prospect
 * retient.
 */
const VOIX_ESSENTIEL = ALPHA_VOICE_PALIERS[0].prixHT;
const VOIX_INTENSIF = ALPHA_VOICE_PALIERS[1].prixHT;

const baseProspects = [
  {
    id: "demo-sccv-canuts",
    name: "Camille Ferrand",
    company: "SCCV Les Terrasses des Canuts (démo)",
    sector: "autre",
    city: "Lyon 4e",
    phone: "04 65 71 30 12",
    email: "contact1@example.com",
    stage: "redzone",
    trust: 78,
    auditScore: 85,
    conviction: 9,
    monthlyValue: VOIX_INTENSIF,
    setupValue: ALPHA_VOICE_SETUP_HT,
    probability: 70,
    ignoranceTax: 4200,
    croyances: { produit: 10, soutien: 10, pourLui: 7 },
    obstacles: [
      { id: "o1", label: "« On a une assistante commerciale, elle décroche »", blameLayer: "circonstances", resolved: true, note: "Audit : 31 appels non aboutis par semaine sur la ligne du bureau de vente, dont 12 entre 12h et 14h." },
    ],
    objections: [
      { id: "j1", label: "« Un robot au téléphone, sur un achat à 320 000 €, ça ne passera pas »", type: "confiance", croyance: 1, status: "ouverte", counter: "Il ne vend pas : il prend le nom, le budget, le type de lot, et cale le rendez-vous avec l'humain. La démo se fait EN DIRECT pendant l'entretien — l'agent appelle son propre portable." },
    ],
    events: [
      { id: "e1", date: daysAgo(24), kind: "appel", summary: "Premier contact sur l'angle du permis : 68 lots, arrêté purgé, bureau de vente ouvert.", nextStep: { date: daysAgo(17), action: "Relever le volume d'appels perdus" } },
      { id: "e2", date: daysAgo(17), kind: "meeting", summary: "Audit du bureau de vente : 31 appels non aboutis/semaine, aucune trace de qui a appelé.", nextStep: { date: daysAgo(9), action: "Démo Alpha Voice en direct" } },
      { id: "e3", date: daysAgo(9), kind: "demo", summary: "Démo en direct : l'agent l'a rappelée pendant le rendez-vous et a qualifié un acquéreur fictif en 50 s.", nextStep: { date: daysAgo(3), action: "Poser l'offre" } },
      { id: "e4", date: daysAgo(3), kind: "offre", summary: "Offre posée après la démo (doctrine respectée). Objection « robot » immédiate.", nextStep: { date: daysAhead(1), action: "Traiter l'objection de confiance" } },
    ],
    demoShownBeforePrice: true,
    nextStep: { date: daysAhead(1), action: "Traiter l'objection « un robot ne passera pas » — recadrer sur la QUALIFICATION, pas la vente" },
    tags: ["permis-construire", "maitrise-ouvrage", "commercialisation", "chaud"],
    attachments: [
      { id: "a1", name: "audit-appels-bureau-de-vente.pdf", kind: "audit", size: 218000, addedAt: daysAgo(17) },
    ],
    preferredChannel: "tel",
    notes: "Permis PC 069 384 26 A0117 — 68 logements, arrêté il y a 8 mois, chantier non ouvert. Le numéro du bureau de vente a été relevé à la main sur le panneau de chantier : l'open data n'en porte aucun.",
    likeness: 76,
    deepAudit: {
      websiteState: "Site programme dédié, correct",
      socialState: "Page entreprise LinkedIn active",
      localCompetition: "Deux programmes concurrents à moins de 400 m, livrables la même année",
      currentProcess: "Une assistante commerciale à mi-temps ; hors de sa présence, la ligne sonne dans le vide",
      missedCallsPerWeek: 31,
      avgTicket: 320000,
      googleRating: 4.1,
      googleReviews: 12,
    },
    problems: [
      "31 appels non aboutis par semaine au bureau de vente",
      "Aucune trace de l'appelant : impossible de rappeler",
      "Deux programmes concurrents livrables la même année à 400 m",
    ],
    solution: "Alpha Voice sur la ligne du bureau de vente : qualifie (budget, typologie, délai), consigne, et cale le rendez-vous dans l'agenda du commercial.",
    personalizedOffer: "Setup " + String(ALPHA_VOICE_SETUP_HT) + " € + palier Intensif " + String(VOIX_INTENSIF) + " €/mois. Garantie : le setup ne se paie qu'au premier rendez-vous pris.",
    contract: { status: "brouillon" } as ContractInfo,
    createdAt: daysAgo(26),
    updatedAt: daysAgo(3),
  },
  {
    id: "demo-gratteciel-promotion",
    name: "Samir Amrani",
    company: "Gratte-Ciel Promotion SAS (démo)",
    sector: "autre",
    city: "Villeurbanne",
    phone: "04 65 71 44 08",
    email: "contact2@example.com",
    stage: "offre",
    trust: 62,
    auditScore: 78,
    conviction: 8,
    monthlyValue: 0,
    setupValue: PACK_SETUP_HT,
    probability: 45,
    ignoranceTax: 0,
    croyances: { produit: 9, soutien: 8, pourLui: 6 },
    obstacles: [
      { id: "o1", label: "« Le marché est bloqué, ce n'est pas nous »", blameLayer: "circonstances", resolved: false, note: "Vrai en partie. Reste que deux programmes voisins ont ouvert leur chantier cette année, pas celui-ci." },
    ],
    objections: [],
    events: [
      { id: "e1", date: daysAgo(31), kind: "appel", summary: "Angle : permis obtenu il y a 20 mois, aucun chantier déclaré. Il a confirmé — la pré-commercialisation ne passe pas le seuil de financement.", nextStep: { date: daysAgo(20), action: "Cadrage : combien de réservations, sur combien de contacts ?" } },
      { id: "e2", date: daysAgo(20), kind: "meeting", summary: "Cadrage : 94 lots, 21 réservés en 20 mois. Le suivi des contacts tient dans un classeur partagé.", nextStep: { date: daysAgo(8), action: "Démo du pipe + relances" } },
      { id: "e3", date: daysAgo(8), kind: "demo", summary: "Démo : reprise de son classeur dans le pipe, relances datées, prévision par étape.", nextStep: { date: daysAhead(2), action: "Décision" } },
      { id: "e4", date: daysAgo(2), kind: "offre", summary: "Offre VIP posée. Il compare avec un CRM immobilier du marché." },
    ],
    demoShownBeforePrice: true,
    nextStep: { date: daysAhead(2), action: "Rappel décision — comparer sur ce qui SORT (relances tenues), pas sur la liste de fonctions" },
    tags: ["permis-construire", "maitrise-ouvrage", "lancement-bloque"],
    attachments: [],
    preferredChannel: "tel",
    notes: "Permis PC 069 266 25 A0043 — 94 logements, arrêté il y a 20 mois, chantier non ouvert. ⚠ Ce signal est le plus fort du lot ET le plus ambigu : opération qui traîne ou opération abandonnée. Vérifié à l'appel — elle est vivante.",
    likeness: 68,
    deepAudit: {
      websiteState: "Site corporate, pas de page programme",
      socialState: "LinkedIn dormant depuis 14 mois",
      localCompetition: "Deux programmes voisins ont ouvert leur chantier cette année",
      currentProcess: "Un classeur partagé, relances au fil de l'eau, aucune date d'échéance",
      avgTicket: 295000,
      conversionRate: 8,
    },
    problems: [
      "21 lots réservés sur 94 en 20 mois — le seuil de financement n'est pas atteint",
      "Le suivi des contacts tient dans un classeur partagé, sans relance datée",
    ],
    solution: "Alpha Sales OS : pipe par lot, relances datées et tenues, prévision par étape, et l'historique de chaque contact au même endroit.",
    personalizedOffer: "Offre VIP " + String(PACK_SETUP_HT) + " €. Alternative si le comptant bloque : l'étalement (acompte + mensualités), à cadrer.",
    contract: { status: "envoye" } as ContractInfo,
    createdAt: daysAgo(33),
    updatedAt: daysAgo(2),
  },
  {
    id: "demo-sccv-monplaisir",
    name: "Léa Delcourt",
    company: "SCCV Carré Monplaisir (démo)",
    sector: "autre",
    city: "Lyon 8e",
    phone: "04 65 71 52 77",
    email: "contact3@example.com",
    stage: "demo",
    trust: 48,
    auditScore: 66,
    conviction: 7,
    monthlyValue: VOIX_ESSENTIEL,
    setupValue: ALPHA_VOICE_SETUP_HT,
    probability: 30,
    ignoranceTax: 2600,
    croyances: { produit: 8, soutien: 7, pourLui: 5 },
    obstacles: [
      { id: "o1", label: "« On lance la commercialisation le mois prochain, rappelez-moi après »", blameLayer: "circonstances", resolved: false, note: "C'est l'inverse : le standard doit être en place AVANT le lancement, pas après la première semaine ratée." },
    ],
    objections: [],
    events: [
      { id: "e1", date: daysAgo(14), kind: "appel", summary: "Angle : permis purgé depuis 5 mois, 34 lots, lancement imminent.", nextStep: { date: daysAgo(6), action: "Audit du dispositif d'accueil" } },
      { id: "e2", date: daysAgo(6), kind: "meeting", summary: "Audit : une ligne mobile unique, renvoyée sur messagerie dès qu'elle est en visite.", nextStep: { date: daysAhead(2), action: "Démo Alpha Voice en direct" } },
    ],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(2), action: "Démo en direct : faire sonner l'agent sur SON portable pendant le rendez-vous" },
    tags: ["permis-construire", "maitrise-ouvrage", "commercialisation"],
    attachments: [],
    preferredChannel: "tel",
    notes: "Permis PC 069 388 26 A0201 — 34 logements, arrêté il y a 5 mois. Fenêtre : pré-commercialisation, c'est là que le nombre de réservations conditionne le financement.",
    likeness: 61,
    deepAudit: {
      websiteState: "Landing programme en cours de fabrication",
      socialState: "Aucune page dédiée",
      localCompetition: "Marché tendu sur Monplaisir, peu d'offre neuve",
      currentProcess: "Une ligne mobile unique, renvoyée sur messagerie dès qu'elle est en visite",
      missedCallsPerWeek: 18,
      avgTicket: 268000,
    },
    problems: [
      "18 appels sur messagerie par semaine, aucun rappel systématique",
      "Le lancement commercial arrive et le dispositif d'accueil n'existe pas",
    ],
    solution: "Alpha Voice branché AVANT le lancement : chaque appelant est qualifié et consigné, même pendant les visites.",
    personalizedOffer: "",
    createdAt: daysAgo(16),
    updatedAt: daysAgo(6),
  },
  {
    id: "demo-fonciere-rhone-nord",
    name: "Thomas Rousset",
    company: "Foncière du Rhône Nord — Promotion immobilière (démo)",
    sector: "autre",
    city: "Lyon 6e",
    phone: "04 65 71 61 30",
    email: "contact4@example.com",
    stage: "audit",
    trust: 30,
    auditScore: 42,
    conviction: 6,
    monthlyValue: 0,
    setupValue: 0,
    probability: 20,
    ignoranceTax: 0,
    croyances: { produit: 6, soutien: 5, pourLui: 3 },
    obstacles: [
      { id: "o1", label: "« On est trois, on se parle, on n'a pas besoin d'un outil »", blameLayer: "soi", resolved: false },
    ],
    objections: [],
    events: [
      { id: "e1", date: daysAgo(11), kind: "appel", summary: "Angle : permis de 14 mois, 22 lots, chantier non ouvert. Accepte un audit de 20 min.", nextStep: { date: daysAhead(3), action: "Audit — combien de contacts entrants, et où ils atterrissent" } },
    ],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(3), action: "Compléter l'audit (42/100) : volume de contacts entrants et devenir de chacun" },
    tags: ["permis-construire", "maitrise-ouvrage", "lancement-bloque"],
    attachments: [],
    preferredChannel: "tel",
    notes: "Permis PC 069 386 25 A0090 — 22 logements, arrêté il y a 14 mois. Structure de trois personnes : l'offre VIP peut être disproportionnée, la version à la carte est le bon angle.",
    likeness: 52,
    deepAudit: {
      websiteState: "Site vitrine à jour",
      socialState: "Aucune",
      currentProcess: "Les contacts arrivent sur une boîte partagée, personne n'en est propriétaire",
      avgTicket: 310000,
    },
    problems: ["Boîte partagée sans propriétaire : un contact sur deux n'est jamais rappelé"],
    solution: "",
    personalizedOffer: "",
    createdAt: daysAgo(11),
    updatedAt: daysAgo(11),
  },
  {
    id: "demo-maisons-val-ouest",
    name: "Nadia Vasseur",
    company: "Maisons individuelles du Val d'Ouest (démo)",
    sector: "autre",
    city: "Lyon 9e",
    phone: "04 65 71 79 44",
    email: "contact5@example.com",
    stage: "contact",
    trust: 22,
    auditScore: 18,
    conviction: 4,
    monthlyValue: 0,
    setupValue: 0,
    probability: 10,
    ignoranceTax: 0,
    croyances: { produit: 4, soutien: 4, pourLui: 2 },
    obstacles: [
      { id: "o1", label: "« Les gens nous trouvent par le bouche-à-oreille »", blameLayer: "circonstances", resolved: false, note: "Audit : introuvable sur « constructeur maison Lyon 9 ». Le bouche-à-oreille n'est pas une stratégie, c'est ce qui reste quand il n'y en a pas." },
    ],
    objections: [],
    events: [
      { id: "e1", date: daysAgo(5), kind: "appel", summary: "Angle : permis purgé, 12 maisons. Curieuse, pas convaincue. Audit accepté.", nextStep: { date: daysAhead(4), action: "Audit visibilité chiffré" } },
    ],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(4), action: "Audit visibilité : lui montrer sa propre position sur « constructeur maison Lyon 9 »" },
    tags: ["permis-construire", "maitrise-ouvrage", "commercialisation"],
    attachments: [],
    preferredChannel: "tel",
    notes: "Permis PC 069 389 26 A0064 — 12 maisons, arrêté il y a 3 mois. Constructeur de maisons individuelles : il vend, lui aussi — c'est ce qui le distingue d'un particulier qui bâtit la sienne.",
    likeness: 44,
    deepAudit: {
      websiteState: "Aucun",
      socialState: "Aucune",
      localCompetition: "Quatre constructeurs mieux placés sur les recherches locales",
      currentProcess: "Un numéro de portable sur un panneau, rien d'autre",
      googleRating: 3.4,
      googleReviews: 4,
    },
    problems: ["Aucun site : invisible sur toutes les recherches locales", "4 avis Google, note 3,4"],
    solution: "",
    personalizedOffer: "",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  {
    id: "demo-sccv-confluence",
    name: "Hugo Bonnet",
    company: "SCCV Quai de la Confluence (démo)",
    sector: "autre",
    city: "Lyon 2e",
    phone: "04 65 71 20 65",
    email: "contact6@example.com",
    stage: "perdu",
    trust: 35,
    auditScore: 50,
    conviction: 5,
    monthlyValue: 0,
    setupValue: 0,
    probability: 0,
    ignoranceTax: 0,
    croyances: { produit: 6, soutien: 4, pourLui: 2 },
    obstacles: [],
    objections: [
      { id: "j1", label: "« Vous m'avez donné un prix avant de m'avoir montré quoi que ce soit »", type: "confiance", croyance: 1, status: "bloquante", counter: "Il a raison, et c'est la faute. Le prix est sorti au premier appel, sur sa question directe. Il n'y a pas eu de deuxième rendez-vous." },
    ],
    events: [
      { id: "e1", date: daysAgo(45), kind: "appel", summary: "Angle : chantier ouvert, queue de programme sur 51 lots." },
      { id: "e2", date: daysAgo(44), kind: "offre", summary: "⚠ Prix annoncé au téléphone, AVANT toute démonstration — sur sa question directe." },
      { id: "e3", date: daysAgo(30), kind: "stage", summary: "Perdu. Cause racine : le prix a été donné avant que la valeur existe." },
    ],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(75), action: "Nurture : revenir avec une RAISON NEUVE — la livraison du programme, pas une relance" },
    tags: ["permis-construire", "maitrise-ouvrage", "chantier", "leçon"],
    attachments: [],
    preferredChannel: "email",
    notes: "Permis PC 069 382 24 A0288 — chantier ouvert, il reste la queue de programme. LEÇON : « jamais de prix avant la démo » n'est pas une préférence de style. Une question directe au téléphone est exactement le moment où on la casse.",
    likeness: 40,
    deepAudit: {
      websiteState: "Site programme complet",
      socialState: "Active",
      currentProcess: "Deux commerciaux dédiés, outillés",
      avgTicket: 340000,
    },
    problems: ["Queue de programme : les derniers lots sont les plus longs à écouler"],
    solution: "",
    personalizedOffer: "",
    lostReason: "Prix annoncé au téléphone avant toute démonstration (violation doctrine)",
    createdAt: daysAgo(45),
    updatedAt: daysAgo(30),
  },
  {
    id: "demo-residences-gratteciel",
    name: "Inès Mahé",
    company: "SAS Résidences des Gratte-Ciel (démo)",
    sector: "autre",
    city: "Villeurbanne",
    phone: "04 65 71 48 19",
    email: "contact7@example.com",
    stage: "signe",
    trust: 95,
    auditScore: 92,
    conviction: 10,
    monthlyValue: VOIX_INTENSIF,
    setupValue: ALPHA_VOICE_SETUP_HT,
    probability: 100,
    ignoranceTax: 0,
    croyances: { produit: 10, soutien: 10, pourLui: 10 },
    obstacles: [
      { id: "o1", label: "« J'ai déjà payé pour un outil que personne n'a jamais installé »", blameLayer: "soi", resolved: true, note: "Traité par la garantie : le setup ne se paie qu'au premier rendez-vous pris. Elle a une durée (30 j de ligne active) et un critère (un RDV PRIS, pas honoré)." },
    ],
    objections: [
      { id: "j1", label: "« Je vais y réfléchir »", type: "temps", croyance: 3, status: "traitee", counter: "La vraie peur était de repayer pour rien. La garantie l'a levée en une phrase — c'est elle qui a fait basculer, pas un argument." },
    ],
    events: [
      { id: "e1", date: daysAgo(52), kind: "appel", summary: "Angle : surélévation de 9 logements, arrêté récent." },
      { id: "e2", date: daysAgo(44), kind: "meeting", summary: "Audit : 14 appels perdus/semaine, elle est seule et sur site tous les matins." },
      { id: "e3", date: daysAgo(36), kind: "demo", summary: "Démo en direct : l'agent l'a rappelée pendant le rendez-vous. Elle a rappelé deux fois pour tester." },
      { id: "e4", date: daysAgo(30), kind: "offre", summary: "Offre + garantie. Acceptée le jour même." },
      { id: "e5", date: daysAgo(28), kind: "stage", summary: "SIGNÉ — setup + palier Intensif." },
    ],
    demoShownBeforePrice: true,
    nextStep: { date: daysAhead(5), action: "Point à J+30 : lui montrer les appels captés, et lui demander ce qui manque" },
    tags: ["permis-construire", "maitrise-ouvrage", "commercialisation", "signé"],
    attachments: [{ id: "a1", name: "proposition-signee.pdf", kind: "proposition", size: 296000, addedAt: daysAgo(28) }],
    preferredChannel: "tel",
    notes: "Permis PC 069 266 26 A0112 — surélévation, 9 logements. ⚠ Sous le seuil de proportion de l'offre VIP : c'est Alpha Voice qui est vendu ici, pas l'OS complet. Le trieur le disait, et il avait raison.",
    likeness: 90,
    deepAudit: {
      websiteState: "Page programme simple",
      socialState: "Aucune",
      localCompetition: "Peu d'offre neuve sur ce périmètre de Villeurbanne",
      currentProcess: "Seule à la structure, sur site tous les matins",
      missedCallsPerWeek: 14,
      avgTicket: 245000,
      googleRating: 4.7,
      googleReviews: 8,
    },
    problems: ["14 appels perdus par semaine", "Seule à la structure, sur site tous les matins"],
    solution: "Alpha Voice sur la ligne unique : qualifie, consigne, et cale le rendez-vous quand elle est sur site.",
    personalizedOffer: "Setup " + String(ALPHA_VOICE_SETUP_HT) + " € + palier Intensif " + String(VOIX_INTENSIF) + " €/mois, setup payable au premier rendez-vous pris.",
    payments: [
      { id: "pay1", label: "Setup Alpha Voice", amount: ALPHA_VOICE_SETUP_HT, dueDate: daysAgo(26), status: "paye" },
      { id: "pay2", label: "Abonnement M1 (Intensif)", amount: VOIX_INTENSIF, dueDate: daysAgo(12), status: "paye" },
      { id: "pay3", label: "Abonnement M2 (Intensif)", amount: VOIX_INTENSIF, dueDate: daysAhead(18), status: "en-attente" },
    ] as Payment[],
    contract: { status: "signe", signedAt: daysAgo(28) } as ContractInfo,
    delivery: "en-cours" as DeliveryStatus,
    wonReason: "La garantie « le setup ne se paie qu'au premier RDV » a levé la peur de repayer pour rien. Zéro preuve sociale citée — il n'y en avait pas à citer.",
    createdAt: daysAgo(52),
    updatedAt: daysAgo(28),
  },
  {
    id: "demo-partdieu-amenageur",
    name: "Marc Leclerc",
    company: "Part-Dieu Aménageur SAS (démo)",
    sector: "autre",
    city: "Lyon 3e",
    email: "contact8@example.com",
    stage: "prospect",
    trust: 10,
    auditScore: 0,
    conviction: 3,
    monthlyValue: 0,
    setupValue: 0,
    probability: 5,
    ignoranceTax: 0,
    croyances: { produit: 2, soutien: 2, pourLui: 1 },
    obstacles: [],
    objections: [],
    events: [],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(1), action: "Premier contact sur LinkedIn — l'export de permis ne porte aucun numéro" },
    tags: ["permis-construire", "maitrise-ouvrage", "recours"],
    attachments: [],
    /**
     * ⚠ CANAL LINKEDIN, ET PAS TÉLÉPHONE — c'est le défaut par défaut de
     * `permisVersProspect`, et il est reproduit ici exprès. Un export de
     * permis ne porte AUCUN numéro : mettre « tel » ferait entrer la fiche
     * dans la file d'appels, où elle resterait sans numéro jusqu'à ce que
     * quelqu'un s'en aperçoive. Les autres fiches de ce jeu ont un téléphone
     * parce qu'un humain est allé le chercher — la troisième colonne.
     */
    preferredChannel: "linkedin",
    notes: "Permis PC 069 383 26 A0305 — 120 logements, arrêté il y a 40 jours. ⚠ Le délai de recours des tiers court encore : trop tôt pour parler commercialisation à plein régime, juste à l'heure pour se faire connaître avant le lancement.",
    likeness: 55,
    problems: [],
    solution: "",
    personalizedOffer: "",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
];

/**
 * Ids du jeu de démonstration — DÉRIVÉS, jamais recopiés.
 *
 * ⚠ C'ÉTAIT UNE LISTE TENUE À LA MAIN, ET ELLE ÉTAIT DÉCLARÉE AU-DESSUS DES
 * FICHES. Ajouter une fiche sans penser à la lister la sortait du périmètre de
 * `isDemoProspect` — c'est-à-dire qu'elle devenait un VRAI prospect pour
 * `/api/send`, qui acceptait alors de lui écrire.
 *
 * Le préfixe `demo-` rend d'ailleurs cette liste presque redondante
 * (`isDemoProspect` répond déjà sur la forme). On la garde parce que des
 * écrans l'importent, mais elle ne peut plus diverger.
 */
export const SEED_PROSPECT_IDS: string[] = baseProspects.map((p) => p.id);

export const seedProspects: Prospect[] = baseProspects.map((p) => ({
  ...prospectDefaults,
  ...p,
})) as unknown as Prospect[];

export const seedCampaigns: Campaign[] = [
  {
    id: "c-permis-lyon-commercialisation",
    name: "Permis Lyon/Villeurbanne — pré-commercialisation",
    sector: "autre",
    status: "active",
    offerInfo: "Alpha Voice sur la ligne du bureau de vente : qualifie l'appelant (budget, typologie, délai), consigne, cale le rendez-vous. Setup + palier mensuel, setup payable au premier RDV pris.",
    cible: "Maîtres d'ouvrage professionnels — promoteurs, SCCV, sociétés de promotion — dont le permis est purgé et le chantier non ouvert, sur Lyon et Villeurbanne. Opérations de 6 lots et plus.",
    industries: ["Promotion immobilière", "SCCV", "Construction de maisons individuelles"],
    marketInfo: "La fenêtre utile est la PRÉ-COMMERCIALISATION : entre l'arrêté purgé et l'ouverture du chantier, le nombre de réservations conditionne le financement de l'opération. C'est là que le sujet est le plus vif, et la date est publique — elle est sur l'arrêté.",
    leadMagnet: "Audit d'accueil téléphonique du bureau de vente : combien d'appels n'aboutissent pas, à quelles heures, et ce qu'ils devenaient.",
    /**
     * ⚠ LE PREMIER PAS SE FAIT À LA MAIN, ET CE N'EST PAS UN OUBLI.
     *
     * `CampaignStepKind` ne connaît que email / whatsapp / appel. Or un export
     * de permis ne porte AUCUN moyen de contact : `permisVersProspect` met
     * donc « linkedin » par défaut, et le moteur de campagne ne sait pas
     * poster sur LinkedIn. L'étape s1 est marquée « email » parce que le type
     * l'exige — le message, lui, part à la main tant que le canal n'existe pas.
     *
     * On le NOMME au lieu de le masquer : c'est la troisième colonne de la
     * doctrine (ce qu'Alpha ne sait pas faire, on le fait à la main et on le
     * dit). Une étape qui prétend partir toute seule et ne part jamais est
     * exactement le genre de silence vert que ce dépôt paie cher.
     */
    steps: [
      { id: "s1", kind: "email", role: "premiere-impression", delayDays: 0, subject: "Votre programme {commerce}", body: "Bonjour {prenom},\n\nVotre permis pour {commerce} est purgé depuis {mois} mois et le chantier n'est pas ouvert : vous êtes en pré-commercialisation.\n\nUne question, une seule : sur les gens qui appellent votre bureau de vente pendant que l'équipe est en visite, vous savez lesquels n'ont jamais été rappelés ?\n\n{closer} — EAGLEYE, Lyon" },
      { id: "s2", kind: "appel", role: "relance", delayDays: 3, subject: "Appel — angle permis", body: "Appeler entre 9h et 11h30 ou 14h et 17h. Ouvrir sur SON permis et SA date, jamais sur nous. Objectif unique : 20 minutes d'audit daté. Aucun prix au téléphone." },
      { id: "s3", kind: "email", role: "reponse", delayDays: 0, subject: "Réponse à un intéressé", body: "Bonjour {prenom},\n\nParfait. Je passe {jour} avec deux choses : le relevé de ce qui n'aboutit pas sur votre ligne, et une démonstration en direct — je fais sonner l'agent sur votre portable pendant le rendez-vous, vous jugez vous-même.\n\n20 minutes, montre en main.\n\n{closer}" },
    ],
    stats: { sent: 34, opened: 21, replied: 7, booked: 3 },
    createdAt: daysAgo(26),
  },
  {
    id: "c-permis-lancement-bloque",
    name: "Permis > 1 an sans chantier — le lancement qui traîne",
    sector: "autre",
    status: "active",
    offerInfo: "Alpha Sales OS : pipe par lot, relances datées et tenues, prévision par étape, historique de chaque contact au même endroit.",
    cible: "Maîtres d'ouvrage dont l'arrêté a plus d'un an SANS ouverture de chantier déclarée, Lyon + Villeurbanne, 20 lots et plus.",
    industries: ["Promotion immobilière", "SCCV", "Aménagement"],
    marketInfo: "⚠ C'est le signal le plus fort du fichier ET le plus ambigu : un permis d'un an sans chantier veut dire soit que la pré-commercialisation ne passe pas le seuil de financement — notre sujet exactement — soit que l'opération est abandonnée. Ça se vérifie AU PREMIER APPEL, ça ne se devine pas, et écrire à une opération morte brûle la relation avec le promoteur pour ses suivantes.",
    leadMagnet: "Relevé de la file : combien de contacts entrants sur les douze derniers mois, combien ont eu une relance datée, combien n'ont jamais été rappelés.",
    steps: [
      { id: "s1", kind: "appel", role: "premiere-impression", delayDays: 0, subject: "Appel — vérifier que l'opération est vivante", body: "Objectif de CET appel : savoir si l'opération existe encore. Rien d'autre. On ne propose rien à quelqu'un dont on ignore s'il a abandonné." },
      { id: "s2", kind: "email", role: "relance", delayDays: 4, subject: "Suite à notre échange", body: "Bonjour {prenom},\n\nVous m'avez dit {reservations} réservations sur {lots} lots. Je vous propose 30 minutes pour regarder où les contacts se perdent — pas pour vous montrer un outil, pour compter.\n\n{closer}" },
    ],
    stats: { sent: 12, opened: 9, replied: 4, booked: 2 },
    createdAt: daysAgo(18),
  },
  {
    id: "c-permis-recours",
    name: "Arrêtés du mois — se faire connaître avant le lancement",
    sector: "autre",
    status: "brouillon",
    offerInfo: "Prise de contact seule. Aucune offre, aucun prix : le but est d'exister avant que le lancement commercial commence.",
    cible: "Permis délivrés il y a moins de deux mois sur Lyon + Villeurbanne — le délai de recours des tiers court encore.",
    industries: ["Promotion immobilière", "Aménagement"],
    marketInfo: "Pendant le recours, un maître d'ouvrage sérieux ne lance pas sa commercialisation à plein régime. Le contacter n'est pas une erreur, mais l'angle n'est pas le même : on se fait connaître, on ne vend pas. Vouloir closer ici, c'est arriver deux mois trop tôt et griller la fiche pour le moment où elle vaudra quelque chose.",
    leadMagnet: "Rien. C'est le sujet : à ce stade on n'a rien à donner qui ne soit prématuré.",
    steps: [
      { id: "s1", kind: "email", role: "premiere-impression", delayDays: 0, subject: "Félicitations pour l'arrêté", body: "Bonjour {prenom},\n\nJ'ai vu passer l'arrêté sur {commerce}. Je ne vous propose rien aujourd'hui — le recours court encore.\n\nJe reprends contact quand vous ouvrirez la commercialisation, si ça vous va.\n\n{closer} — EAGLEYE, Lyon" },
    ],
    stats: { sent: 0, opened: 0, replied: 0, booked: 0 },
    createdAt: daysAgo(4),
  },
];

/**
 * ⚠ LES HEURES SONT FIXÉES, ELLES NE SUIVENT PLUS L'HORLOGE.
 *
 * `daysAhead` garde l'heure courante : une démo ouverte à 23 h produisait
 * cinq rendez-vous à 23 h, pendant que `/aujourdhui` affichait juste au-dessus
 * « après 18h, on ne joint pas un dirigeant de TPE ». Le premier bouton de
 * l'app est « Explorer la démo » — c'est exactement cet écran qu'un prospect
 * regarde en premier.
 *
 * Les créneaux ci-dessous sont choisis dans la fenêtre professionnelle, et
 * variés : un closing en fin de matinée, une démo l'après-midi, un audit tôt.
 * Un jeu de démonstration où tout tombe à la même heure ne ressemble pas à une
 * semaine de travail.
 */
export const seedMeetings: Meeting[] = [
  { id: "m1", prospectId: "demo-sccv-canuts", title: "Closing — Terrasses des Canuts (démo)", date: daysAheadAt(1, 10, 30), durationMin: 45, kind: "closing", channel: "visio", location: "Visioconférence", calLink: "https://cal.com/eagleye/closing-canuts", reminded: true, done: false },
  { id: "m2", prospectId: "demo-sccv-monplaisir", title: "Démo en direct — Carré Monplaisir (démo)", date: daysAheadAt(2, 14, 0), durationMin: 30, kind: "demo", channel: "physique", location: "Bureau de vente — Lyon 8e", calLink: "https://cal.com/eagleye/demo-monplaisir", reminded: false, done: false },
  { id: "m3", prospectId: "demo-gratteciel-promotion", title: "Rappel décision — Gratte-Ciel Promotion (démo)", date: daysAheadAt(2, 16, 30), durationMin: 20, kind: "closing", channel: "appel", location: "Téléphone", reminded: true, done: false },
  { id: "m4", prospectId: "demo-fonciere-rhone-nord", title: "Audit — Foncière du Rhône Nord (démo)", date: daysAheadAt(3, 9, 30), durationMin: 45, kind: "audit", channel: "physique", location: "Sur place — Lyon 6e", calLink: "https://cal.com/eagleye/audit-rhone-nord", reminded: false, done: false },
  { id: "m5", prospectId: "demo-residences-gratteciel", title: "Point J+30 — Résidences des Gratte-Ciel (démo)", date: daysAheadAt(5, 11, 0), durationMin: 45, kind: "suivi", channel: "visio", location: "Visioconférence", calLink: "https://cal.com/eagleye/suivi-gratteciel", reminded: false, done: false },
];

export const seedNurture: NurtureSequence[] = [
  {
    id: "n-perdus-90j",
    name: "Perdus — Reconquête 90 jours",
    audience: "Prospects perdus (surtout vs low-cost)",
    active: true,
    steps: [
      { id: "ns1", day: 30, channel: "email", content: "Article utile secteur (zéro vente) : « 3 choses que les meilleurs {secteur}s de Lyon font en ligne »." },
      /**
       * ⚠ CETTE ÉTAPE DISAIT : « une preuve fraîche même secteur (on vient
       * d'équiper X, +N clients/mois) ».
       *
       * C'est une consigne à l'opérateur, lue au moment d'écrire — donc une
       * instruction à FABRIQUER une référence. Zéro vente à ce jour : « on
       * vient d'équiper X » se vérifie en une question, et la relation ne
       * s'en remet pas. Troisième endroit du dépôt où cette tentation était
       * écrite, après `hormozi` et la carte de preuves.
       */
      { id: "ns2", day: 60, channel: "whatsapp", content: "Message personnel : un constat frais sur SON secteur — ce qu'on voit passer, ce qui a bougé depuis. ⚠ Aucune référence client tant qu'il n'y en a pas de vraie." },
      { id: "ns3", day: 90, channel: "appel", content: "Appel direct : « Où en êtes-vous avec votre site ? » — si le low-cost n'a rien produit, ré-audit gratuit." },
    ],
  },
  {
    id: "n-signes-referral",
    name: "Signés — Machine à referrals",
    audience: "Clients signés, semaine 1 à 8",
    active: true,
    steps: [
      { id: "ns1", day: 7, channel: "appel", content: "Point onboarding + demander : « Qui, dans votre entourage pro, perd des clients comme vous en perdiez ? » (2 noms datés)." },
      { id: "ns2", day: 30, channel: "email", content: "Premier rapport de résultats chiffré + rappel programme parrainage." },
      { id: "ns3", day: 60, channel: "whatsapp", content: "Partager le win : « Votre site a généré N demandes ce mois-ci » + demander un avis Google." },
    ],
  },
];

export const seedCompetitors: Competitor[] = [
  {
    id: "comp-crm-immobilier",
    name: "CRM immobiliers du marché",
    sector: "tous",
    pricing: "Licence par utilisateur, engagement annuel, paramétrage facturé",
    strengths: "Métier maîtrisé, connecteurs notaires et VEFA, éditeur installé depuis longtemps",
    weaknesses: "Outil de GESTION, pas de vente : il enregistre ce qui s'est passé, il ne fait pas passer le coup de fil. Le paramétrage prend des semaines et se paie.",
    counter: "Ne jamais opposer les listes de fonctions — la sienne sera plus longue, c'est un éditeur installé. Poser une seule question : « sur les trente derniers contacts entrants, combien ont eu une relance datée ? » La réponse est dans SON outil, et elle est presque toujours mauvaise.",
    updatedAt: daysAgo(9),
  },
  {
    id: "comp-standard-telephonique",
    name: "Standards téléphoniques / permanences externalisées",
    sector: "tous",
    pricing: "Forfait mensuel + à l'appel, souvent avec un minimum",
    strengths: "Une voix humaine au bout du fil, mise en place rapide",
    weaknesses: "L'opérateur ne connaît ni le programme, ni les typologies, ni les prix : il prend un message. Le rappel reste à faire, et il se fait tard ou pas.",
    counter: "Ne pas attaquer l'humain — c'est un vrai avantage et le dire renforce notre crédibilité. Déplacer la question sur ce qui SORT de l'appel : un message, ou un rendez-vous calé dans l'agenda avec le budget et la typologie déjà notés ?",
    updatedAt: daysAgo(6),
  },
  {
    id: "comp-statu-quo",
    name: "Le statu quo — « on s'en sort comme ça »",
    sector: "tous",
    pricing: "Gratuit, en apparence",
    strengths: "Aucun effort, aucun risque, aucune décision à prendre. C'est le concurrent qui gagne le plus souvent.",
    weaknesses: "Le coût est réel mais invisible : il ne figure sur aucune facture. Personne ne compte les appels qui n'ont pas abouti, donc personne ne les manque.",
    counter: "Le rendre VISIBLE avec SES chiffres à lui, relevés pendant l'audit — jamais avec une moyenne de marché. Un nombre qu'il a donné lui-même ne se conteste pas.",
    updatedAt: daysAgo(15),
  },
];

export const seedActivities: Activity[] = [
  { id: "ac1", date: daysAgo(3), kind: "stage", message: "Terrasses des Canuts (démo) → Red Zone (objection de confiance ouverte)", prospectId: "demo-sccv-canuts" },
  { id: "ac2", date: daysAgo(4), kind: "campagne", message: "Import permis Lyon + Villeurbanne : 11 arrêtés examinés, 8 retenus, 3 écartés (1 particulier, 1 hors zone, 1 périmé)" },
  { id: "ac3", date: daysAgo(6), kind: "meeting", message: "Audit du dispositif d'accueil — Carré Monplaisir (démo)", prospectId: "demo-sccv-monplaisir" },
  { id: "ac4", date: daysAgo(11), kind: "ia", message: "Brief d'appel généré — Foncière du Rhône Nord (démo) (angle : permis de 14 mois sans chantier)", prospectId: "demo-fonciere-rhone-nord" },
  { id: "ac5", date: daysAgo(30), kind: "perdu", message: "Quai de la Confluence (démo) perdu — prix donné au téléphone avant toute démonstration", prospectId: "demo-sccv-confluence" },
  { id: "ac6", date: daysAgo(28), kind: "signe", message: "SIGNÉ ✓ Résidences des Gratte-Ciel (démo) — Alpha Voice, setup payable au premier RDV pris", prospectId: "demo-residences-gratteciel" },
];

// La doctrine par défaut (DEFAULT_BUSINESS_RULES) a déménagé dans
// `lib/business-rules.ts` : elle récitait la grille tarifaire complète et
// l'escalier des commissions en prose, et ce fichier est importé par le store,
// donc par toutes les pages client. Une prose qui répète un secret le publie
// aussi sûrement qu'une constante.

/**
 * Identifiants des fiches de démonstration.
 *
 * Elles portent des adresses email INVENTÉES. Écrire à l'une d'elles
 * produit un rebond dur — et les rebonds comptent contre le domaine
 * pendant longtemps. Sur une boîte qui démarre son historique de
 * sortant, c'est la pire première journée possible.
 *
 * Toute surface qui envoie doit s'en servir pour REFUSER, pas pour
 * avertir : le coût est trop asymétrique pour être laissé au jugement
 * d'un opérateur pressé.
 */
// DÉRIVÉ de la liste unique — surtout pas recopié. Une seconde liste tenue à
// la main finit toujours par diverger, et ici diverger veut dire : une fiche
// de démo qui passe le garde-fou et part en emailing vers une adresse
// inventée.
export const DEMO_PROSPECT_IDS: ReadonlySet<string> = new Set(SEED_PROSPECT_IDS);

/**
 * ── LE PRÉFIXE DES FICHES DE DÉMO ENGENDRÉES ──
 *
 * ⚠ CE VERROU ÉTAIT UNE LISTE, ET UNE LISTE NE PEUT PAS COUVRIR CE QU'ON
 * FABRIQUE À L'EXÉCUTION.
 *
 * `isDemoProspect` répondait par appartenance à un ensemble figé de huit
 * identifiants. Tant que le jeu de démonstration était écrit à la main, ça
 * suffisait. Dès qu'il se GÉNÈRE — depuis l'ICP de l'inscrit — les fiches
 * produites n'y sont plus, donc `isDemoProspect` rend `false`, donc
 * `/api/send` les considère comme de VRAIS prospects et accepte de leur
 * écrire. Le garde-fou ne casse pas : il s'ouvre, en silence, sur exactement
 * ce qu'il existe pour empêcher.
 *
 * La question « est-ce une fiche de démo ? » doit donc se répondre sur la
 * STRUCTURE de l'identifiant, pas sur une liste que quelqu'un doit penser à
 * tenir à jour. Toute fiche engendrée porte ce préfixe, et il est réservé :
 * aucun import ne le produit (les fiches terrain sont préfixées par leur
 * source, les fiches manuelles par un identifiant aléatoire).
 */
export const PREFIXE_DEMO = "demo-";

export const isDemoProspect = (id: string): boolean =>
  DEMO_PROSPECT_IDS.has(id) || id.startsWith(PREFIXE_DEMO);

/**
 * Les domaines qu'aucune adresse réelle ne peut porter.
 *
 * ⚠ Deuxième clé du même verrou, et elle est STRUCTURELLE elle aussi.
 * `EMAILS_DE_DEMO` est une liste dérivée du jeu écrit à la main : elle ne
 * connaît pas les adresses engendrées. Or ces adresses sont posées sur des
 * domaines réservés par la RFC 2606 — `example.com`, `.invalid`, `.test` —
 * dont l'IETF garantit qu'ils ne seront JAMAIS attribués. Un domaine réservé
 * est une preuve, pas une convention : il ne peut pas devenir vrai un jour.
 *
 * C'est ce qui protège le cas où l'identifiant n'arrive pas jusqu'au serveur.
 */
export const DOMAINES_RESERVES = ["example.com", "example.org", "example.net", ".invalid", ".test", ".example"];

export function estAdresseDeDemo(email: string): boolean {
  const a = email.trim().toLowerCase();
  if (!a) return false;
  if (EMAILS_DE_DEMO.has(a)) return true;
  return DOMAINES_RESERVES.some((d) => a.endsWith(d));
}

/**
 * Même mécanique pour les CAMPAGNES, et pour la même raison.
 *
 * Dérivée de `seedCampaigns` elle aussi : la liste des identifiants ne se
 * recopie pas. Ajouter une campagne de démo demain la marque comme démo sans
 * que personne pense à revenir ici — c'est tout l'intérêt.
 *
 * ⚠ Ce qu'elle garde n'est pas une adresse mais un TAUX. `stats` du seed
 * affiche « 67 % d'ouverture » sur `/campaigns`, à deux centimètres du
 * panneau de tracking qui compte le réel et affiche 0 %. Un taux se cite en
 * rendez-vous ; celui-là n'a jamais été mesuré.
 */
export const DEMO_CAMPAIGN_IDS: ReadonlySet<string> = new Set(seedCampaigns.map((c) => c.id));

export const isDemoCampaign = (id: string): boolean => DEMO_CAMPAIGN_IDS.has(id);

/**
 * Les ADRESSES du jeu de démonstration, en minuscules.
 *
 * ⚠ Dérivée elle aussi, jamais recopiée. Elle sert de seconde clé au verrou
 * d'envoi (`/api/send`) : un appelant qui ne transmet pas `prospectId` — ou
 * qui le transmet mal — serait sinon libre d'écrire à
 * `contact@bouchondescanuts.fr`, domaine inventé, rebond dur garanti.
 *
 * Deux clés pour la même règle, ce n'est pas de la redondance décorative :
 * l'identifiant est l'autorité, l'adresse est le filet quand l'identifiant
 * n'arrive pas.
 */
export const EMAILS_DE_DEMO: ReadonlySet<string> = new Set(
  seedProspects.map((p) => (p.email ?? "").trim().toLowerCase()).filter(Boolean)
);
