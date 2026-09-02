// Seed data — Lyon terrain. Fictional but realistic prospects, used to make
// the UI legible before the first real import.
//
// ⚠ These 8 records cover the ORIGINAL local-business market only (restaurant,
// pub, ambulance, artisan). They are a demo dataset, not the ICP: the real
// targeting lives in `lib/segments.ts` and now spans field sales teams, call
// centres, B2B agencies, franchise networks and insurance. Do not read the
// product's reach from this file.
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

/** Ids of the demo dataset — used to detect « données de démo » in the UI. */
export const SEED_PROSPECT_IDS = [
  "p-bouchon",
  "p-smoking-dog",
  "p-ambulances-rhone",
  "p-menuiserie",
  "p-brasserie-part-dieu",
  "p-taxi-fourviere",
  "p-paddy",
  "p-boulangerie",
];

const baseProspects = [
  {
    id: "p-bouchon",
    name: "Marc Perrin",
    company: "Le Bouchon des Canuts",
    sector: "restaurant",
    city: "Lyon 4e — Croix-Rousse",
    phone: "04 78 12 34 56",
    email: "contact@bouchondescanuts.fr",
    stage: "redzone",
    trust: 82,
    auditScore: 90,
    conviction: 9,
    monthlyValue: 290,
    setupValue: 1800,
    probability: 78,
    ignoranceTax: 2400,
    croyances: { produit: 10, soutien: 10, pourLui: 7 },
    obstacles: [
      { id: "o1", label: "« Les clients viennent par bouche-à-oreille »", blameLayer: "circonstances", resolved: true, note: "Audit : 62 % des recherches « bouchon croix-rousse » partent chez le concurrent." },
    ],
    objections: [
      { id: "j1", label: "« C'est trop cher pour un resto comme le mien »", type: "argent", croyance: 3, status: "ouverte", counter: "Taxe d'Ignorance 2 400 €/mois vs 290 €/mois. Le calcul sur SON téléphone." },
    ],
    events: [
      { id: "e1", date: daysAgo(21), kind: "visite", summary: "Passage 15h, heure creuse. Marc sceptique mais curieux.", nextStep: { date: daysAgo(14), action: "Revenir avec audit chiffré" } },
      { id: "e2", date: daysAgo(14), kind: "meeting", summary: "Audit sur place : 40+ appels ratés/mois, fiche Google à l'abandon.", nextStep: { date: daysAgo(7), action: "Démo mobile maquette" } },
      { id: "e3", date: daysAgo(7), kind: "demo", summary: "Démo mobile avec SA devanture en photo. Émotion visible — il a montré au chef.", nextStep: { date: daysAgo(2), action: "Présenter l'offre" } },
      { id: "e4", date: daysAgo(2), kind: "offre", summary: "Offre : 1 800 € setup + 290 €/mois. Objection prix immédiate.", nextStep: { date: daysAhead(1), action: "Closing — recadrage Taxe d'Ignorance" } },
    ],
    demoShownBeforePrice: true,
    nextStep: { date: daysAhead(1), action: "Closing — recadrage Taxe d'Ignorance avec calcul sur son téléphone" },
    tags: ["chaud", "croix-rousse"],
    attachments: [
      { id: "a1", name: "audit-bouchon-canuts.pdf", kind: "audit", size: 245000, addedAt: daysAgo(14) },
      { id: "a2", name: "maquette-mobile-v2.png", kind: "maquette", size: 890000, addedAt: daysAgo(7) },
    ],
    notes: "Fait 90 couverts le week-end, 15 en semaine. Le mardi soir est mort. Femme tient la caisse — l'inclure dans la boucle.",
    likeness: 76,
    problems: [
      "40+ appels ratés/mois pendant le coup de feu",
      "Fiche Google à l'abandon (photos 2019, horaires faux)",
      "Zéro réservation possible hors horaires d'ouverture",
      "Mardis soirs à 15 couverts sur 90 places",
    ],
    solution: "Site vitrine premium + module résa 24/7 + overlay IA qui répond aux appels ratés et relance les no-shows par SMS.",
    personalizedOffer: "Setup 1 800 € (maquette déjà validée émotionnellement) + 290 €/mois. Garantie : 30 réservations captées hors horaires le 1er mois ou 2e mois offert.",
    contract: { status: "brouillon" } as ContractInfo,
    createdAt: daysAgo(25),
    updatedAt: daysAgo(2),
  },
  {
    id: "p-smoking-dog",
    name: "Aurélie Vasseur",
    company: "The Smoking Dog Pub",
    sector: "pub",
    city: "Lyon 5e — Vieux Lyon",
    phone: "04 78 98 76 54",
    email: "aurelie@smokingdog.fr",
    stage: "demo",
    trust: 65,
    auditScore: 75,
    conviction: 8,
    monthlyValue: 240,
    setupValue: 1400,
    probability: 50,
    ignoranceTax: 1800,
    croyances: { produit: 8, soutien: 9, pourLui: 6 },
    obstacles: [
      { id: "o1", label: "« Mon barman gère l'Instagram, ça suffit »", blameLayer: "autres", resolved: true, note: "Insta ≠ réservation. Zéro conversion mesurée." },
      { id: "o2", label: "« Les soirées quiz se remplissent toutes seules »", blameLayer: "circonstances", resolved: false },
    ],
    objections: [],
    events: [
      { id: "e1", date: daysAgo(12), kind: "visite", summary: "Contact au comptoir un mardi creux. 8 clients dans la salle.", nextStep: { date: daysAgo(8), action: "Audit express" } },
      { id: "e2", date: daysAgo(8), kind: "meeting", summary: "Audit : mardi/mercredi = 20 % de remplissage. Événements annoncés à la craie.", nextStep: { date: daysAhead(2), action: "Démo mobile agenda IA" } },
    ],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(2), action: "Démo mobile : agenda événements + relances WhatsApp automatiques" },
    tags: ["vieux-lyon", "événementiel"],
    attachments: [],
    notes: "Anglophone, clientèle expat + étudiants. Très sensible à l'esthétique — la démo doit être léchée.",
    likeness: 68,
    problems: [
      "Mardis/mercredis à 20 % de remplissage",
      "Événements annoncés à la craie — invisibles en ligne",
      "Aucune base de contacts d'habitués exploitable",
    ],
    solution: "Site événementiel + agenda auto-publié + relances WhatsApp des habitués avant chaque soirée.",
    createdAt: daysAgo(14),
    updatedAt: daysAgo(8),
  },
  {
    id: "p-ambulances-rhone",
    name: "Karim Benali",
    company: "Ambulances Rhône Assistance",
    sector: "ambulance",
    city: "Villeurbanne",
    phone: "04 72 11 22 33",
    email: "k.benali@ambulances-rhone.fr",
    stage: "audit",
    trust: 55,
    auditScore: 40,
    conviction: 8,
    monthlyValue: 390,
    setupValue: 2400,
    probability: 30,
    ignoranceTax: 3600,
    croyances: { produit: 7, soutien: 8, pourLui: 5 },
    obstacles: [
      { id: "o1", label: "« Le standard gère, on a toujours fait comme ça »", blameLayer: "circonstances", resolved: false },
      { id: "o2", label: "« Mon frère co-gérant doit valider »", blameLayer: "autres", resolved: false },
    ],
    objections: [],
    events: [
      { id: "e1", date: daysAgo(10), kind: "appel", summary: "Appel entrant suite reco du Bouchon des Canuts (même expert-comptable).", nextStep: { date: daysAgo(4), action: "RDV audit au dépôt" } },
      { id: "e2", date: daysAgo(4), kind: "meeting", summary: "Visite dépôt. Standard saturé 8h-10h, demandes de nuit perdues.", nextStep: { date: daysAhead(3), action: "Finaliser audit chiffré + inviter le frère" } },
    ],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(3), action: "Audit chiffré + démo à deux avec le frère co-gérant" },
    tags: ["referral", "b2b"],
    attachments: [{ id: "a1", name: "notes-depot.pdf", kind: "audit", size: 120000, addedAt: daysAgo(4) }],
    notes: "2 co-gérants — TOUJOURS les deux frères présents pour la démo. Karim est le champion interne.",
    createdAt: daysAgo(10),
    updatedAt: daysAgo(4),
  },
  {
    id: "p-menuiserie",
    name: "Sylvie Charbonnier",
    company: "Menuiserie Charbonnier & Fils",
    sector: "artisan",
    city: "Caluire-et-Cuire",
    phone: "06 45 67 89 01",
    email: "contact@menuiserie-charbonnier.fr",
    stage: "signe",
    trust: 95,
    auditScore: 100,
    conviction: 10,
    monthlyValue: 190,
    setupValue: 1200,
    probability: 100,
    ignoranceTax: 1500,
    croyances: { produit: 10, soutien: 10, pourLui: 10 },
    obstacles: [
      { id: "o1", label: "« J'ai déjà payé pour un site qui n'a rien donné »", blameLayer: "soi", resolved: true, note: "Ancien site 2014, jamais référencé. Preuve : artisan plombier Caluire équipé, +9 devis/mois." },
    ],
    objections: [
      { id: "j1", label: "« Je vais réfléchir »", type: "temps", croyance: 3, status: "traitee", counter: "Isolé la vraie peur (re-payer pour rien) → garantie résultat conditionnelle." },
    ],
    events: [
      { id: "e1", date: daysAgo(40), kind: "visite", summary: "Contact atelier via marché des artisans.", nextStep: { date: daysAgo(33), action: "Audit" } },
      { id: "e2", date: daysAgo(33), kind: "meeting", summary: "Audit : 12 appels manqués/semaine pendant les chantiers." },
      { id: "e3", date: daysAgo(26), kind: "demo", summary: "Démo mobile formulaire devis intelligent. Son fils a dit « enfin ! »." },
      { id: "e4", date: daysAgo(20), kind: "offre", summary: "Offre acceptée après traitement « je vais réfléchir »." },
      { id: "e5", date: daysAgo(18), kind: "stage", summary: "SIGNÉ ✓ — 1 200 € setup + 190 €/mois. Conviction 10/10." },
    ],
    demoShownBeforePrice: true,
    nextStep: { date: daysAhead(5), action: "Point onboarding + demander 2 recommandations d'artisans" },
    tags: ["signé", "referral-source"],
    attachments: [{ id: "a1", name: "proposition-signee.pdf", kind: "proposition", size: 310000, addedAt: daysAgo(18) }],
    notes: "Cliente ambassadrice. Le fils (Thomas) gère le téléphone — le former sur l'overlay IA.",
    likeness: 94,
    /**
     * ⚠ L'AUDIT ÉTAIT VIDE SUR TOUTES LES FICHES DE DÉMONSTRATION.
     *
     * Une seule occurrence de `deepAudit` existait dans ce fichier : la valeur
     * NEUTRE de `prospectDefaults`. Chaque fiche de démo retombait donc dessus,
     * et le routeur d'offre, faute de signal, renvoyait « visibilité » sur les
     * huit. Conséquence, constatée en lançant le calcul sur le jeu complet :
     * **0/8 fiches routées Alpha Voice**. Le diagnostic central du produit, le
     * chiffrage de la perte, la marche 2 de l'escalier et la garantie ne
     * s'affichaient nulle part — sur le jeu de données prévu pour MONTRER le
     * produit.
     *
     * Les chiffres ci-dessous ne sont pas inventés : la prose de cette fiche
     * les affirmait déjà (`problems`, événement d'audit « 12 appels
     * manqués/semaine pendant les chantiers »). Ils passent du texte libre au
     * champ STRUCTURÉ, celui que le routeur lit réellement.
     */
    deepAudit: {
      websiteState: "Site de 2014, jamais référencé — invisible sur les recherches locales",
      socialState: "Aucune page active",
      localCompetition: "Trois menuisiers mieux placés sur « menuisier Lyon 4 »",
      currentProcess: "Le gérant décroche lui-même entre deux chantiers, ou pas du tout",
      missedCallsPerWeek: 12,
      avgTicket: 2400,
      conversionRate: 25,
      googleRating: 4.6,
      googleReviews: 31,
    },
    problems: ["12 appels manqués/semaine pendant les chantiers", "Ancien site 2014 jamais référencé — traumatisme « payé pour rien »"],
    solution: "Site premium + formulaire devis intelligent (budget, délai, photos) + notifications SMS instantanées.",
    personalizedOffer: "Setup 1 200 € + 190 €/mois, garantie résultat conditionnelle (résiliable si < 5 demandes qualifiées/mois après M2).",
    payments: [
      { id: "pay1", label: "Setup", amount: 1200, dueDate: daysAgo(16), status: "paye" },
      { id: "pay2", label: "Abonnement M1", amount: 190, dueDate: daysAgo(10), status: "paye" },
      { id: "pay3", label: "Abonnement M2", amount: 190, dueDate: daysAhead(20), status: "en-attente" },
    ] as Payment[],
    contract: { status: "signe", signedAt: daysAgo(18) } as ContractInfo,
    delivery: "en-cours" as DeliveryStatus,
    wonReason: "Garantie résultat conditionnelle + preuve locale (plombier Caluire) — la croyance n°3 a basculé.",
    createdAt: daysAgo(40),
    updatedAt: daysAgo(18),
  },
  {
    id: "p-brasserie-part-dieu",
    name: "Olivier Roux",
    company: "Brasserie du Lac",
    sector: "restaurant",
    city: "Lyon 3e — Part-Dieu",
    phone: "04 72 33 44 55",
    stage: "contact",
    trust: 35,
    auditScore: 10,
    conviction: 7,
    monthlyValue: 290,
    setupValue: 1800,
    probability: 15,
    ignoranceTax: 2000,
    croyances: { produit: 5, soutien: 6, pourLui: 3 },
    obstacles: [
      { id: "o1", label: "« Pas le moment, c'est la haute saison »", blameLayer: "circonstances", resolved: false },
      { id: "o2", label: "« Mon neveu s'occupe déjà du site »", blameLayer: "autres", resolved: false },
    ],
    objections: [],
    events: [
      { id: "e1", date: daysAgo(6), kind: "visite", summary: "Premier passage. Poli mais pressé. Deux couches d'oignon posées d'entrée.", nextStep: { date: daysAhead(4), action: "Repasser avec le comparatif site du neveu vs démo" } },
    ],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(4), action: "Repasser à 15h avec comparatif : site actuel vs maquette EAGLEYE" },
    tags: ["part-dieu"],
    attachments: [],
    notes: "Terrasse 60 places sous-exploitée. Le site du neveu : dernière mise à jour il y a 2 ans.",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  },
  {
    id: "p-taxi-fourviere",
    name: "Nadia Slimani",
    company: "Ambulances Fourvière Santé",
    sector: "ambulance",
    city: "Lyon 9e — Vaise",
    stage: "prospect",
    trust: 10,
    auditScore: 0,
    conviction: 7,
    monthlyValue: 390,
    setupValue: 2400,
    probability: 5,
    ignoranceTax: 3000,
    croyances: { produit: 3, soutien: 3, pourLui: 2 },
    obstacles: [],
    objections: [],
    events: [],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(2), action: "Premier contact : appeler avant 8h (avant les tournées)" },
    tags: ["à-contacter"],
    attachments: [],
    notes: "Repérée via annuaire ARS. Flotte de 6 véhicules. Site inexistant.",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: "p-paddy",
    name: "Sean Murphy",
    company: "Paddy's Corner",
    sector: "pub",
    city: "Lyon 2e — Cordeliers",
    stage: "perdu",
    trust: 40,
    auditScore: 55,
    conviction: 6,
    monthlyValue: 240,
    setupValue: 1400,
    probability: 0,
    ignoranceTax: 1600,
    croyances: { produit: 6, soutien: 4, pourLui: 3 },
    obstacles: [
      { id: "o1", label: "« La conjoncture est mauvaise »", blameLayer: "circonstances", resolved: false },
    ],
    objections: [
      { id: "j1", label: "« Un concurrent me propose moins cher »", type: "concurrent", croyance: 1, status: "bloquante", counter: "Parti chez WebLyon Express à 49 €/mois. Rendez-vous dans 6 mois quand le site low-cost n'aura rien produit." },
    ],
    events: [
      { id: "e1", date: daysAgo(30), kind: "visite", summary: "Bon premier contact." },
      { id: "e2", date: daysAgo(15), kind: "offre", summary: "Offre présentée — AVANT la démo mobile (erreur doctrine)." },
      { id: "e3", date: daysAgo(9), kind: "stage", summary: "Perdu vs WebLyon Express. Cause racine : prix annoncé sans émotion préalable." },
    ],
    demoShownBeforePrice: false,
    nextStep: { date: daysAhead(90), action: "Nurture : reprendre contact quand le site low-cost aura montré ses limites" },
    tags: ["nurture", "leçon"],
    attachments: [],
    notes: "LEÇON : offre présentée sans démo mobile. La doctrine existe pour une raison. Recontact planifié J+90.",
    lostReason: "Concurrent low-cost — offre présentée avant la démo (violation doctrine)",
    createdAt: daysAgo(30),
    updatedAt: daysAgo(9),
  },
  {
    id: "p-boulangerie",
    name: "Étienne Fabre",
    company: "Plomberie Fabre",
    sector: "artisan",
    city: "Lyon 7e — Gerland",
    phone: "06 12 98 76 54",
    stage: "offre",
    trust: 70,
    auditScore: 85,
    conviction: 9,
    monthlyValue: 190,
    setupValue: 1200,
    probability: 65,
    ignoranceTax: 2200,
    croyances: { produit: 9, soutien: 9, pourLui: 8 },
    obstacles: [
      { id: "o1", label: "« Je suis nul avec la technologie »", blameLayer: "soi", resolved: true, note: "« Vous n'avez rien à toucher. Tout arrive par SMS. »" },
    ],
    objections: [],
    events: [
      { id: "e1", date: daysAgo(18), kind: "appel", summary: "Reco de Sylvie Charbonnier (Menuiserie).", nextStep: { date: daysAgo(12), action: "Audit" } },
      { id: "e2", date: daysAgo(12), kind: "meeting", summary: "Audit : 12 appels manqués/semaine sur chantier. Urgences plomberie = or perdu." },
      { id: "e3", date: daysAgo(5), kind: "demo", summary: "Démo mobile : demande d'urgence qualifiée en 40 s. Il a testé lui-même, trois fois." },
      { id: "e4", date: daysAgo(1), kind: "offre", summary: "Offre posée après démo (doctrine respectée). Réponse attendue.", nextStep: { date: daysAhead(1), action: "Appel décision" } },
    ],
    demoShownBeforePrice: true,
    nextStep: { date: daysAhead(1), action: "Appel décision 9h (avant ses chantiers)" },
    tags: ["referral", "chaud"],
    attachments: [{ id: "a1", name: "proposition-fabre.pdf", kind: "proposition", size: 298000, addedAt: daysAgo(1) }],
    notes: "Referral chain : Charbonnier → Fabre. La preuve « pour lui » est déjà faite par Sylvie.",
    likeness: 82,
    /**
     * Même correction que sur la fiche Charbonnier, et mêmes sources : la
     * prose de cette fiche affirmait déjà « 12 appels manqués/semaine sur
     * chantier » et « interventions à 300 €+ ». On les met là où le routeur
     * les lit.
     */
    deepAudit: {
      websiteState: "Page Google Business seule, aucun site",
      socialState: "Aucune",
      localCompetition: "Deux plombiers en tête sur les urgences Lyon 7",
      currentProcess: "Sous un évier ou en intervention : le téléphone sonne dans le vide",
      missedCallsPerWeek: 12,
      avgTicket: 300,
      conversionRate: 35,
      googleRating: 4.8,
      googleReviews: 19,
    },
    problems: ["12 appels manqués/semaine sur chantier", "Urgences plomberie perdues = interventions à 300 €+ chez le concurrent"],
    solution: "Site + capture d'urgence qualifiée en 40 s (adresse, photo, urgence) routée par SMS.",
    personalizedOffer: "Même formule que Charbonnier (preuve sociale directe) : 1 200 € + 190 €/mois.",
    contract: { status: "envoye" } as ContractInfo,
    createdAt: daysAgo(18),
    updatedAt: daysAgo(1),
  },
];

export const seedProspects: Prospect[] = baseProspects.map((p) => ({
  ...prospectDefaults,
  ...p,
})) as unknown as Prospect[];

export const seedCampaigns: Campaign[] = [
  {
    id: "c-restos-hiver",
    name: "Restos Lyon — Remplir les soirs creux",
    sector: "restaurant",
    status: "active",
    offerInfo: "Site premium + résa 24/7 + overlay IA anti no-show. Setup 1 800 € + 290 €/mois. Garantie : 30 résas captées hors horaires le 1er mois.",
    cible: "Restaurateurs indépendants Lyon intra-muros, 30–90 couverts, sans module de réservation en ligne, fiche Google mal tenue.",
    industries: ["Restauration traditionnelle", "Bouchons lyonnais", "Bistronomie"],
    marketInfo: "~4 200 restaurants dans le Grand Lyon ; 62 % des recherches « restaurant + quartier » se font après 19h, quand personne ne décroche. TheFork prélève 2–4 €/couvert : l'argument « récupérez vos habitués en direct » porte.",
    leadMagnet: "Audit gratuit : « Combien vous coûtent vos mardis soirs ? » (calculateur couverts perdus × ticket moyen)",
    steps: [
      { id: "s1", kind: "email", role: "premiere-impression", delayDays: 0, subject: "Vos mardis soirs, M. {prenom}", body: "Bonjour {prenom},\n\nJ'ai compté : {concurrents} restaurants dans votre rue prennent des réservations à 23h. Pas vous.\n\nChaque mardi soir vide vous coûte environ {taxe} €. Je passe 10 minutes vous montrer, sur mon téléphone, à quoi ressemblerait {commerce} en ligne — sans engagement, sans prix, juste pour voir.\n\n{closer} — EAGLEYE, Lyon" },
      { id: "s2", kind: "whatsapp", role: "relance", delayDays: 3, subject: "Relance douce", body: "Bonjour {prenom}, c'est {closer} (EAGLEYE Lyon). Je vous ai envoyé un mot sur vos soirées creuses — je passe mardi à 15h dans le quartier, je vous montre 2 minutes ?" },
      { id: "s3", kind: "appel", role: "relance", delayDays: 6, subject: "Appel heure creuse", body: "Appeler entre 14h30 et 17h. Objectif unique : décrocher 20 min d'audit terrain daté. Zéro pitch produit au téléphone." },
      { id: "s4", kind: "email", role: "reponse", delayDays: 0, subject: "Réponse à un intéressé", body: "Bonjour {prenom},\n\nParfait — je passe {jour} à 15h (heure creuse) avec deux choses : la maquette de {commerce} sur mon téléphone, et le calcul exact de ce que vous perdez chaque mois. 20 minutes, montre en main.\n\nÀ {jour} !\n{closer}" },
    ],
    stats: { sent: 42, opened: 28, replied: 9, booked: 4 },
    createdAt: daysAgo(20),
  },
  {
    id: "c-ambulances",
    name: "Ambulanciers Rhône — Standard 24/7",
    sector: "ambulance",
    status: "active",
    offerInfo: "Standard IA 24/7 qui qualifie et route les demandes de transport. Setup 2 400 € + 390 €/mois.",
    cible: "Sociétés d'ambulances 3–15 véhicules du Rhône, standard humain uniquement en journée, co-gérants familiaux.",
    industries: ["Transport sanitaire", "Ambulances privées", "VSL"],
    marketInfo: "~180 sociétés de transport sanitaire dans le Rhône. 31 % des demandes de transport programmé arrivent entre 20h et 7h. Décideurs joignables avant 8h (avant les tournées). Cycle de décision : 2 co-gérants → toujours les deux à la démo.",
    leadMagnet: "Rapport : « Les demandes de transport que votre standard ne voit jamais » (grille d'auto-diagnostic)",
    steps: [
      { id: "s1", kind: "email", role: "premiere-impression", delayDays: 0, subject: "Les demandes de nuit que vous ne voyez jamais", body: "Bonjour {prenom},\n\nEntre 20h et 7h, votre standard dort. Les demandes de transport programmé, elles, continuent d'arriver — chez ceux qui répondent.\n\nIl existe un standard IA qui qualifie et route ces demandes 24/7 — je vous montre lesquelles vous ne voyez pas. Audit gratuit de vos flux : 20 minutes au dépôt.\n\n{closer} — EAGLEYE" },
      { id: "s2", kind: "appel", role: "relance", delayDays: 4, subject: "Appel avant tournées", body: "Appeler avant 8h. Partir de SON créneau de nuit relevé à l'audit, pas des confrères. Objectif : RDV dépôt daté." },
    ],
    stats: { sent: 18, opened: 12, replied: 5, booked: 2 },
    createdAt: daysAgo(12),
  },
  {
    id: "c-artisans",
    name: "Artisans — Devis pendant le chantier",
    sector: "artisan",
    status: "brouillon",
    offerInfo: "Site + formulaire devis intelligent (budget, délai, photos) + SMS instantané. Setup 1 200 € + 190 €/mois, garantie résultat conditionnelle.",
    cible: "Artisans du bâtiment (plomberie, menuiserie, élec) Lyon + périphérie, 1–5 salariés, sur chantier la journée, sans site ou site mort.",
    industries: ["Plomberie", "Menuiserie", "Électricité", "Chauffage"],
    marketInfo: "~11 000 artisans du bâtiment dans la métropole. Un artisan sur chantier rate ~12 appels/semaine ; 70 % des appelants ne rappellent pas et prennent le devis suivant. Meilleur canal d'entrée : referral d'artisan équipé (chaîne Charbonnier → Fabre).",
    leadMagnet: "Checklist : « 12 appels manqués par semaine = combien de devis perdus ? » (calculateur)",
    steps: [
      { id: "s1", kind: "email", role: "premiere-impression", delayDays: 0, subject: "12 appels manqués par semaine", body: "Bonjour {prenom},\n\nUn artisan sur chantier rate en moyenne 12 appels par semaine. Chaque appel raté = un devis chez le concurrent.\n\nNos artisans reçoivent des demandes pré-qualifiées (budget, délai, photos) par SMS, sans décrocher. {preuve}\n\nJe vous montre sur votre téléphone ? 10 minutes, quand vous voulez.\n\n{closer} — EAGLEYE" },
    ],
    stats: { sent: 0, opened: 0, replied: 0, booked: 0 },
    createdAt: daysAgo(5),
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
  { id: "m1", prospectId: "p-bouchon", title: "Closing — Le Bouchon des Canuts", date: daysAheadAt(1, 10, 30), durationMin: 45, kind: "closing", channel: "physique", location: "Sur place — Croix-Rousse", calLink: "https://cal.com/eagleye/closing-bouchon", reminded: true, done: false },
  { id: "m2", prospectId: "p-smoking-dog", title: "Démo mobile — Smoking Dog", date: daysAheadAt(2, 14, 0), durationMin: 30, kind: "demo", channel: "physique", location: "Sur place — Vieux Lyon", calLink: "https://cal.com/eagleye/demo-smokingdog", reminded: false, done: false },
  { id: "m3", prospectId: "p-ambulances-rhone", title: "Audit + démo (les 2 frères)", date: daysAheadAt(3, 9, 30), durationMin: 60, kind: "audit", channel: "physique", location: "Dépôt Villeurbanne", calLink: "https://cal.com/eagleye/audit-rhone", reminded: false, done: false },
  { id: "m4", prospectId: "p-boulangerie", title: "Appel décision — Plomberie Fabre", date: daysAheadAt(1, 16, 0), durationMin: 15, kind: "closing", channel: "appel", location: "Téléphone", reminded: true, done: false },
  { id: "m5", prospectId: "p-menuiserie", title: "Onboarding + referrals — Charbonnier", date: daysAheadAt(5, 11, 0), durationMin: 45, kind: "suivi", channel: "visio", location: "Google Meet", calLink: "https://cal.com/eagleye/onboarding-charbonnier", reminded: false, done: false },
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
    id: "comp-weblyon",
    name: "WebLyon Express",
    sector: "tous",
    pricing: "49–89 €/mois, template, sans setup",
    strengths: "Prix d'appel très bas, promesse « en ligne en 48h »",
    weaknesses: "Templates identiques, zéro IA, zéro accompagnement, support ticket only, aucun résultat mesuré",
    counter: "Ne jamais se battre sur le prix. Montrer deux sites WebLyon identiques côte à côte, puis NOTRE overlay IA en action. « Moins cher et invisible, ou rentable et vivant ? » Preuve : Paddy's Corner nous recontactera.",
    updatedAt: daysAgo(9),
  },
  {
    id: "comp-freelance",
    name: "Freelances / neveux",
    sector: "tous",
    pricing: "300–800 € one-shot, pas de récurrent",
    strengths: "Relation de confiance existante (famille, ami)",
    weaknesses: "Pas de maintenance, pas de suivi, site mort en 6 mois, aucune obligation de résultat",
    counter: "Jamais attaquer le neveu (couche « Les Autres » de l'oignon). Proposer un comparatif factuel : dernière mise à jour, vitesse, mobile, conversions. Les chiffres critiquent, pas nous.",
    updatedAt: daysAgo(6),
  },
  {
    id: "comp-resa-platforms",
    name: "Plateformes de résa (TheFork etc.)",
    sector: "restaurant",
    pricing: "Commission 2–4 €/couvert + abonnement",
    strengths: "Apport de trafic immédiat, notoriété",
    weaknesses: "Le resto loue SES clients : commissions à vie, data captive, dépendance aux promos -50 %",
    counter: "Pas un remplacement, un rééquilibrage : « Gardez TheFork pour les nouveaux, récupérez vos habitués en direct. Chaque habitué migré = commission économisée à vie. »",
    updatedAt: daysAgo(15),
  },
];

export const seedActivities: Activity[] = [
  { id: "ac1", date: daysAgo(1), kind: "stage", message: "Le Bouchon des Canuts → Red Zone (objection prix ouverte)", prospectId: "p-bouchon" },
  { id: "ac2", date: daysAgo(1), kind: "campagne", message: "Campagne « Restos Lyon » : 3 nouvelles réponses, 1 RDV réservé" },
  { id: "ac3", date: daysAgo(2), kind: "meeting", message: "Audit dépôt réalisé — Ambulances Rhône Assistance", prospectId: "p-ambulances-rhone" },
  { id: "ac4", date: daysAgo(5), kind: "ia", message: "Script généré pour Plomberie Fabre (démo urgences)", prospectId: "p-boulangerie" },
  { id: "ac5", date: daysAgo(9), kind: "perdu", message: "Paddy's Corner perdu vs WebLyon Express — leçon : démo avant prix, toujours", prospectId: "p-paddy" },
  { id: "ac6", date: daysAgo(18), kind: "signe", message: "SIGNÉ ✓ Menuiserie Charbonnier & Fils — 1 200 € + 190 €/mois", prospectId: "p-menuiserie" },
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

export const isDemoProspect = (id: string): boolean => DEMO_PROSPECT_IDS.has(id);

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
