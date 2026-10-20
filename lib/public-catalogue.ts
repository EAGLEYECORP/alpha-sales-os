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
  /**
   * Le mensuel À LA TAILLE DE RÉFÉRENCE (5 utilisateurs), pas un forfait.
   *
   * ⚠⚠ LA VITRINE L'AFFICHAIT COMME UN FORFAIT, et c'était vrai mais
   * INCOMPLET — le pire état pour un prix. Un prospect à vingt commerciaux
   * lisait « 1 000 €/mois » et découvrait 2 200 € au devis : exactement
   * l'écart qui tue une signature au dernier mètre. Les deux termes sont
   * désormais annoncés, et le visiteur peut faire le calcul lui-même.
   */
  packMensuelHT: 1_000,
  packSocleHT: 600,
  packSiegeHT: 80,
  packSiegesReference: 5,
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
  /**
   * ⚠⚠ CE QUE « LE CRM » COUVRE A CHANGÉ LE 12/09/2026, ET C'EST LE POINT DE
   * VENTE LE PLUS FORT DU PRODUIT. Trois écrans l'ont rejoint — écrire ses
   * messages, la file LinkedIn, la liste d'appels du matin — parce qu'aucun
   * des trois ne nous coûte quoi que ce soit. Le parcours de prospection
   * ENTIER, jusqu'au rendez-vous signé, tient désormais dans le gratuit.
   */
  { id: "crm", label: "Le CRM et la prospection", what: "Vos fiches, votre pipeline, votre journée — et de quoi prospecter pour de vrai : écrire vos messages, votre file LinkedIn, votre liste d'appels du matin. Vos données restent les vôtres." },
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
 * un email, passer un appel ou faire écrire un modèle consomme des
 * identifiants et des crédits — les NÔTRES, sauf si le client apporte les
 * siens.
 *
 * ⚠ Réécrite le 20/10/2026 (deux formes, voir `DEUX_FORMES`). L'ancienne
 * phrase affirmait « il n'existe aucun chemin d'identifiants par locataire »
 * — faux depuis le BYOK, qui ouvre l'IA et l'email (`lib/capacites-cle.ts`).
 * Elle ne nomme QUE ces deux-là : la téléphonie n'a pas de clé par locataire,
 * et `tests/deux-formes.test.ts` refuse qu'on promette une clé qui n'existe
 * pas.
 */
export const FRONTIERE_PAYANT =
  "En ligne, Alpha est gratuit et le reste : cibler, écrire, approcher sur LinkedIn, appeler depuis votre téléphone, décrocher vos rendez-vous. Ce qui consomme — l'IA, l'envoi d'emails — s'ouvre avec vos propres comptes : vous payez votre fournisseur, pas nous. Et si vous voulez tout Alpha, téléphonie comprise, on l'installe chez vous, sur votre serveur.";

/**
 * ─────────────────────────────────────────────────────────────────────
 * DEUX FORMES D'ALPHA — décidé par Zakaria le 20/10/2026.
 *
 * · **En ligne** : gratuit, sans durée. Il ne nous coûte rien à servir —
 *   ce qui dépense chez un tiers (IA, email) s'ouvre avec les comptes du
 *   client (BYOK), jamais avec les nôtres.
 * · **Chez vous** : tout Alpha, installé à la main sur LE serveur du client.
 *   C'est l'offre qui se vend, au prix de la grille complète
 *   (`PRIX_PUBLICS.pack*`) — aucun montant n'est recopié ici.
 *
 * ⚠ Ce qui n'est PAS promis, exprès : « vos données ne quittent jamais votre
 * serveur ». Une clé d'IA branchée envoie du texte au fournisseur du modèle ;
 * la phrase juste dit où tournent l'application et sa base, et à qui sont les
 * comptes.
 * ─────────────────────────────────────────────────────────────────────
 */
export const DEUX_FORMES = {
  enLigne: {
    nom: "Alpha en ligne",
    prix: "Gratuit",
    promesse:
      "Sans durée, sans carte bancaire. L'IA et l'envoi d'emails s'ouvrent avec vos propres comptes : vous payez votre fournisseur, pas nous.",
  },
  chezVous: {
    nom: "Alpha chez vous",
    sousTitre: "Installé sur votre serveur",
    promesse:
      "Tout Alpha, téléphonie comprise, installé à la main sur votre serveur et à votre nom. L'application et sa base tournent chez vous ; les comptes d'IA, d'emails et de téléphonie sont les vôtres.",
  },
} as const;

/**
 * ⚠ RETIRÉS LE 20/10/2026 : `ALPHA_VOICE_PUBLIC` (accueil 149/349 €),
 * `LIFETIME_PUBLIC` et `GARANTIE` (le setup Alpha Voice payé au premier RDV).
 * Les offres qu'ils affichaient ne sont plus en vente (`OFFRES_RETIREES`), et
 * ce module part dans le navigateur : une grille retirée qui y reste se lit
 * en trois secondes de devtools, comme le catalogue l'a déjà été.
 */

/**
 * ── BUSINESS (« ALPHA CHEZ VOUS »), CÔTÉ PUBLIC ──
 *
 * Recopié à la main comme le reste de ce fichier ; un test le compare à
 * `lib/offres-publiques.ts`, qui fait foi. L'étalement répond à l'objection
 * « 10 000 € d'un coup, c'est trop ».
 */
export const BUSINESS_PUBLIC = {
  prixHT: 10_000,
  acompteHT: 2_500,
  mensualites: 10,
  mensualiteHT: 800,
  abonnementHT: 1_000,
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
    // ⚠ Le nom porte le PÉRIMÈTRE : trois offres publiques commencent par
    // « Alpha Voice », et celle-ci est la plus chère des trois. Un nom nu
    // faisait lire 3 500 € là où la vitrine annonce 1 490 €.
    label: "Alpha Voice — volume sortant",
    what: "L'agent vocal IA qui décroche, qualifie, relance et passe la main — entrant ET sortant, 24/7. Installé chez vous, avec votre propre ligne : le volume se fixe au cadrage.",
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
