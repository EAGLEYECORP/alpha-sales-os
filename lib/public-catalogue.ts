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
