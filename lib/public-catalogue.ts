/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CATALOGUE VU DE L'EXTÉRIEUR — module SÉPARÉ, et c'est le sujet.
 *
 * ── POURQUOI CE FICHIER EXISTE ──
 *
 * La page de vente n'affichait plus les prix ligne à ligne. Elle les
 * EXPÉDIAIT quand même : elle importait `publicBricks()` depuis
 * `lib/bricks.ts`, et cette fonction lit `BRICKS`. Impossible de séparer
 * les deux à la compilation — le catalogue entier partait donc dans le
 * bundle JavaScript de la page publique.
 *
 * Résultat mesuré sur le build : le chunk servi à `/vitrine` contenait
 * `setupHT:3500`, `monthlyHT:364`, `perThousandHT:273` et la chaîne
 * « millier est offert » — c'est-à-dire exactement le levier de
 * négociation qu'on venait de retirer de l'écran. Trois secondes de
 * devtools suffisaient. Retirer une donnée de l'AFFICHAGE ne la retire
 * pas du navigateur.
 *
 * Ce module ne contient donc AUCUN montant, à deux exceptions près qui
 * sont publiques par décision commerciale : le prix du pack et le palier
 * d'entrée du sortant. Ce sont les deux seuls chiffres qu'on affiche.
 *
 * ── LA SYNCHRONISATION ──
 *
 * On ne peut pas importer le vrai catalogue ici sans réintroduire la
 * fuite. La cohérence est donc garantie par un TEST
 * (`tests/vitrine-fuite.test.ts`), qui tourne côté serveur et peut, lui,
 * charger les deux. Une divergence casse le build, pas la production.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ordre de grandeur d'une capacité — jamais son prix. */
export type PalierPublic = "socle" | "moteur" | "coeur";

export interface CapacitePublique {
  id: string;
  label: string;
  what: string;
  palier: PalierPublic;
}

export const PALIERS_LABELS: Record<PalierPublic, string> = {
  socle: "Socle",
  moteur: "Moteur",
  coeur: "Cœur",
};

/**
 * Les deux seuls montants affichés publiquement.
 *
 * Le pack est l'ANCRE : sans lui, aucune référence, et chaque conversation
 * repart de zéro. Le palier d'entrée du sortant qualifie : sans lui, on
 * reçoit des demandes de gens hors budget. Tout le reste se dit au cadrage.
 */
export const PRIX_PUBLICS = {
  packSetupHT: 10_000,
  packMensuelHT: 1_000,
  sortantAppels: 1_000,
  sortantMensuelHT: 364,
};

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SOCLE GRATUIT — et pourquoi il n'était NULLE PART sur la vitrine.
 *
 * Les inscriptions sont ouvertes depuis le 02/09/2026 : n'importe qui crée
 * son compte et démarre avec `crm · closer · cerveau · pilotage`, sans limite
 * de durée. C'est écrit dans `lib/entitlements.ts`, appliqué par le serveur,
 * gardé par des tests.
 *
 * ⚠ Et la page publique n'en disait pas un mot. Elle ne proposait qu'une
 * seule porte — « demander un cadrage » — c'est-à-dire un rendez-vous avec un
 * inconnu, à quelqu'un qui n'a encore rien vu du produit. La porte la moins
 * coûteuse pour lui, celle qui ne demande que dix secondes et une adresse
 * email, existait dans le code et pas sur la page.
 *
 * Recopié à la main comme le reste de ce fichier : ce module ne doit importer
 * NI `lib/bricks` NI `lib/entitlements` — l'un porte les prix, l'autre lit
 * l'environnement serveur, et tout ce qu'une page publique importe part dans
 * le navigateur. Un test compare cette liste à `BRIQUES_GRATUITES` : la copie
 * est sûre parce qu'elle est vérifiée, pas parce qu'on fait attention.
 * ─────────────────────────────────────────────────────────────────────
 */
export const SOCLE_GRATUIT: { id: string; label: string; what: string }[] = [
  { id: "crm", label: "Le CRM", what: "Vos fiches, votre pipeline, votre journée. Vos données restent les vôtres." },
  { id: "closer", label: "Le Closer OS", what: "La tournée du jour, le débrief à la voix, les priorités de closing." },
  { id: "cerveau", label: "Le Cerveau", what: "Votre doctrine, vos scripts, vos objections — cherchables en une phrase." },
  { id: "pilotage", label: "Le pilotage", what: "Ce qui tourne, ce qui bloque, et les chiffres qui le disent." },
  /**
   * ⚠ Passée au gratuit le 12/09/2026 : elle n'appelle aucune de nos API et
   * ne consomme rien chez nous. Elle était payante au titre de « la machine
   * agit à ta place » — une famille — alors que le critère est le COÛT.
   */
  { id: "alpha-live", label: "Le copilote d'appel", what: "Pendant que vous parlez, vos objections et vos réponses s'affichent. Rien ne sort de votre navigateur." },
];

/**
 * La frontière, dite en une phrase parce qu'elle se conteste sinon.
 *
 * Ce n'est pas un arbitrage commercial mais une contrainte technique : envoyer
 * un email, passer un appel ou faire écrire un modèle consomme NOS identifiants
 * et NOS crédits, et il n'existe aucun chemin d'identifiants par locataire.
 * Le dire franchement vaut mieux qu'un « premium » sans justification.
 */
export const FRONTIERE_PAYANT =
  "Tout ce qui DÉPENSE chez nous se paie : l'envoi des campagnes, les appels, l'agent qui écrit, les audits automatiques. Tout ce qui tourne chez VOUS est gratuit, y compris le copilote qui vous souffle pendant un appel.";

/**
 * La grille Alpha Voice, décidée le 02/09/2026.
 *
 * ⚠ Publier des prix nets est une DÉCISION, pas une évidence : ça qualifie les
 * demandes entrantes et ça évite les rendez-vous hors budget. Les paliers
 * supérieurs du sortant, eux, restent au cadrage — voir `OUTBOUND_TIERS`,
 * qu'un test interdit d'afficher ici.
 */
export const ALPHA_VOICE_PUBLIC = {
  setupHT: 1490,
  paliers: [
    { nom: "Essentiel", prixHT: 149, ce: "500 minutes, environ 200 appels par mois" },
    { nom: "Intensif", prixHT: 349, ce: "1 500 minutes, environ 600 appels par mois" },
  ],
  minuteSupHT: 0.2,
};

/**
 * ── BUSINESS ET LIFETIME, CÔTÉ PUBLIC ──
 *
 * Recopiés à la main comme le reste de ce fichier ; un test les compare à
 * `lib/offres-publiques.ts`, qui fait foi. Les afficher est une décision : une
 * offre que personne ne peut voir n'existe pas, et les deux répondent à des
 * objections précises — « 10 000 € d'un coup, c'est trop » et « je ne veux pas
 * d'un abonnement de plus ».
 */
export const BUSINESS_PUBLIC = {
  prixHT: 10_000,
  acompteHT: 2_500,
  mensualites: 10,
  mensualiteHT: 800,
  abonnementHT: 1_000,
};

export const LIFETIME_PUBLIC = {
  paliers: [
    { rang: 1, prixHT: 4_900, places: 5 },
    { rang: 2, prixHT: 6_900, places: 7 },
    { rang: 3, prixHT: 8_900, places: 8 },
  ],
  placesTotal: 20,
  appelsInclus: 1_200,
};

/**
 * La garantie, avec ses trois bords.
 *
 * Sans bords écrits, elle s'active au bout de trois jours de ligne coupée. La
 * durée, le périmètre et le critère font partie de la garantie — les taire
 * n'est pas une simplification, c'est un litige à retardement.
 */
export const GARANTIE = {
  promesse: "L'installation ne se paie qu'au premier rendez-vous obtenu.",
  bords: [
    "Sur 30 jours de ligne active.",
    "Elle porte sur l'installation, pas sur l'abonnement déjà consommé.",
    "Un rendez-vous PRIS — qui vient et qui signe ne dépend plus de nous.",
  ],
};

/**
 * Les capacités, telles qu'un prospect les lit.
 *
 * Recopiées à la main DÉLIBÉRÉMENT — c'est le prix à payer pour que le
 * catalogue interne ne parte pas dans le navigateur. Le test de
 * synchronisation rend cette copie sûre : label, description et ordre des
 * paliers doivent correspondre au catalogue réel, sinon le build casse.
 */
export const CAPACITES: CapacitePublique[] = [
  {
    id: "alpha-voice",
    label: "Alpha Voice",
    what: "L'agent vocal IA qui décroche, qualifie, relance et passe la main — entrant et sortant, 24/7.",
    palier: "coeur",
  },
  {
    id: "campagnes",
    label: "Campagnes & outreach",
    what: "Séquences email/LinkedIn personnalisées à grande échelle, avec relances et suivi des réponses.",
    palier: "coeur",
  },
  {
    id: "cerveau",
    label: "Le Cerveau (RAG)",
    what: "La mémoire de l'entreprise : documents, audits, échanges — retrouvés et réinjectés dans chaque message.",
    palier: "coeur",
  },
  {
    id: "crm",
    label: "CRM & Pipeline",
    what: "Le pipeline, les fiches prospects, le master rappel : quoi faire, pour qui, maintenant.",
    palier: "moteur",
  },
  {
    id: "audits",
    label: "Audits automatisés",
    what: "Le deep-dive de chaque prospect à l'import, et l'audit écrit prêt à envoyer.",
    palier: "moteur",
  },
  {
    id: "tracking",
    label: "Tracking & délivrabilité",
    what: "Ouvertures, clics, réponses, et la configuration DNS qui évite le dossier spam.",
    palier: "socle",
  },
  {
    id: "alpha-live",
    label: "Alpha Live",
    what:
      "Le souffleur en direct PENDANT le rendez-vous : il écoute, reconnaît l'objection au moment où elle sort, " +
      "et affiche la réponse et la preuve sur ton écran — sans que l'interlocuteur voie quoi que ce soit.",
    palier: "moteur",
  },
  {
    id: "closer",
    label: "Closer OS & débrief",
    what: "La préparation avant le rendez-vous et le débrief après : tournée, objectif d'étape, ce qui a marché, ce qui a coûté.",
    palier: "socle",
  },
  {
    id: "agent-alpha",
    label: "Agent ALPHA",
    what: "Le copilote conversationnel qui voit tout le pipeline : il prépare la journée, analyse un deal, écrit le message, et dit quoi faire ensuite.",
    palier: "moteur",
  },
  {
    id: "pilotage",
    label: "Salle de contrôle & KPIs",
    what: "Tout ce qui tourne en un écran, et les chiffres qui disent où ça bloque.",
    palier: "socle",
  },
];
