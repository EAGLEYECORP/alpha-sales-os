import { FUEL_TARGET, RHYTHM_DAYS, RHYTHM_MIN_TOUCHES } from "./onboarding-path";
import { tauxMesure, type Taux } from "./calibration";
import type { Canal } from "./conformite";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE PLAN DE TRACTION — ce qu'il faut faire, et où on en est.
 *
 * Décidé le 13/09/2026. Zakaria : « c'est juste une question de volume
 * d'action. Si on arrive à cocher chacune, à ce moment-là on a le résultat. »
 * C'est vrai, et juillet en donne le ratio exact. Ce module le rend lisible à
 * tout moment de la journée.
 *
 * ══ CE QUI EXISTAIT, ET POURQUOI ÇA NE SUFFISAIT PAS ══
 *
 * `FUEL_TARGET`, `RHYTHM_DAYS` et `RHYTHM_MIN_TOUCHES` existent depuis
 * longtemps — enfermés dans `lib/onboarding-path.ts`, le parcours
 * d'INSTALLATION. Ils répondent à « as-tu fini de brancher l'outil ? », jamais
 * à « es-tu sur la trajectoire ? ». On pouvait faire une excellente journée
 * sans jamais savoir si elle comptait.
 *
 * ⚠ Ils sont donc IMPORTÉS, jamais redéfinis. Une seconde cible de 300 fiches
 * écrite ici ferait dire « objectif atteint » à un écran pendant que l'autre
 * afficherait « il en manque cent ».
 *
 * ══ ⚠⚠ CE MODULE NE PROJETTE JAMAIS D'EUROS ══
 *
 * `JUILLET_REEL.gagnes` vaut 0. Le taux RDV → signature n'a JAMAIS été observé
 * chez nous. Un plan qui affiche « 23 RDV donc X € » invente le seul maillon
 * manquant et le présente au même rang que les mesures. Le module rend le
 * nombre de RDV attendus, avec son intervalle, et `euros: null` avec son motif.
 *
 * ══ LE TAUX ENTRE EN PARAMÈTRE ══
 *
 * `JUILLET_REEL` vit dans `lib/pipeline-juillet.ts`, module SERVEUR (il sait
 * charger de vraies fiches). Ce plan-ci doit s'afficher sur un TÉLÉPHONE. Il
 * reçoit donc le taux mesuré au lieu de l'importer — exactement ce que
 * `positionnerBriques(briques, releves)` fait déjà pour le catalogue de prix.
 * Un import direct aurait fait descendre un module serveur dans le bundle.
 *
 * ══ AUCUN NOM D'ENTREPRISE, JAMAIS ══
 *
 * Les segments se décrivent par des CRITÈRES. Une liste de quinze marques ne
 * se reproduit pas ; les critères qui l'ont produite, si. Et le dépôt est
 * public : `tests/noms-reels.ts` garde les noms à la même échelle que les
 * numéros, et une liste de cibles nommées serait notre travail de ciblage,
 * publié.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Ce qui rend l'effet IMMÉDIAT — le seul critère qui compte pour une 1re vente. */
export interface SegmentCible {
  id: string;
  label: string;
  /** Ce qui fait qu'on l'appelle LUI. Des critères, jamais des noms. */
  critere: string;
  /** Pourquoi le premier geste produit un résultat visible en jours. */
  pourquoiImmediat: string;
  /** Effectif commercial visé — la borne haute est un plafond, pas un idéal. */
  commerciaux: { bas: number; haut: number };
  /** Cycle de vente attendu, en jours. */
  cycleJours: { bas: number; haut: number };
  /**
   * D'où vient le cycle.
   *
   * ⚠ `"secondaire"` partout, et c'est important : les sources publiques sur
   * les cycles B2B français sont des blogs d'AGENCES qui vendent de la
   * prospection — la source la plus utile et la plus intéressée à la fois.
   * Même réserve que les guides de prix de l'agent vocal. Notre propre cycle
   * se mesurera au troisième deal, pas avant.
   */
  preuveCycle: "secondaire" | "mesure-maison";
  canal: Canal;
}

/**
 * L'avatar retenu le 13/09/2026, et ses deux voisins immédiats.
 *
 * ⚠ UN SEUL est en tête, et ce n'est pas de la modestie : « une offre, un
 * canal, un avatar » est la consigne, et trois avatars simultanés ont déjà
 * coûté trois tours de travail à ce projet. Les deux autres sont là parce
 * qu'ils partagent le MÊME geste de vente — pas pour être travaillés en
 * parallèle.
 */
export const SEGMENTS: SegmentCible[] = [
  {
    id: "interim-recrutement",
    label: "Intérim & recrutement",
    critere:
      "Agence d'emploi ou cabinet de recrutement, 10 à 50 personnes au commerce, qui reçoit plus de candidatures et de demandes de mission qu'elle n'en traite.",
    pourquoiImmediat:
      "Le métier se joue à la VITESSE de rappel : le premier qui répond place le candidat. Le retard existe déjà, il est comptable, et le premier rappel produit un résultat dans la journée — il n'y a rien à créer, seulement à rattraper.",
    commerciaux: { bas: 10, haut: 50 },
    cycleJours: { bas: 30, haut: 90 },
    preuveCycle: "secondaire",
    canal: "linkedin",
  },
  {
    id: "maintenance-b2b",
    label: "Maintenance & dépannage sous contrat B2B",
    critere:
      "Prestataire technique en contrat récurrent avec des entreprises (pas de particuliers), 10 à 50 commerciaux, qui reçoit des demandes d'intervention et de devis en continu.",
    pourquoiImmediat:
      "Les demandes entrantes arrivent déjà ; ce qui manque est le rappel et la relance de devis. Le contrat est récurrent, donc une seule signature rattrapée paie l'outil.",
    commerciaux: { bas: 10, haut: 50 },
    cycleJours: { bas: 30, haut: 90 },
    preuveCycle: "secondaire",
    canal: "linkedin",
  },
  {
    id: "proprete-securite",
    label: "Propreté & sécurité (services aux entreprises)",
    critere:
      "Société de services aux entreprises répondant à des appels d'offres ET recevant des demandes directes, 10 à 50 commerciaux.",
    pourquoiImmediat:
      "Deux flux à traiter avec les mêmes bras. La partie appel d'offres a ses délais propres, mais les demandes directes se rappellent le jour même.",
    commerciaux: { bas: 10, haut: 50 },
    cycleJours: { bas: 45, haut: 120 },
    preuveCycle: "secondaire",
    canal: "linkedin",
  },
];

/** Le segment en tête — celui sur lequel on exécute. */
export const SEGMENT_PRINCIPAL = SEGMENTS[0];

/** Une action dont le volume produit le résultat. */
export interface ActionSuivie {
  id: string;
  label: string;
  /** La cible. IMPORTÉE quand elle existe déjà ailleurs. */
  cible: number;
  /** D'où vient la cible — nommée, pour qu'on puisse la contester. */
  source: string;
  unite: string;
  /**
   * Cette action a-t-elle un effet MESURÉ, ou seulement supposé ?
   *
   * ⚠ Une seule est mesurée : l'audit écrit. Juillet le dit sans ambiguïté —
   * 26 appels en plomberie sans une pièce écrite : zéro opportunité ; là où un
   * audit est parti, le taux monte. Marquer les autres « mesurées » ferait
   * croire qu'on sait, alors qu'on suit une intuition raisonnable.
   */
  effet: "mesure" | "suppose";
}

export const ACTIONS: ActionSuivie[] = [
  {
    id: "fiches",
    label: "Fiches de l'ICP chargées",
    cible: FUEL_TARGET,
    source: "`FUEL_TARGET` (lib/onboarding-path). C'est le dénominateur : un taux ne se négocie pas, un dénominateur si.",
    unite: "fiches",
    effet: "suppose",
  },
  {
    id: "rythme",
    label: `Journées à ${RHYTHM_MIN_TOUCHES} touches ou plus`,
    cible: RHYTHM_DAYS,
    source: "`RHYTHM_DAYS` × `RHYTHM_MIN_TOUCHES` (lib/onboarding-path). Le taux de juillet a été constaté sur un mois TRAVAILLÉ, pas sur trois jours.",
    unite: "jours sur 14",
    effet: "suppose",
  },
  {
    id: "audits",
    label: "Audits écrits envoyés",
    cible: 20,
    source: "Juillet : 18 audits sur 78 fiches. La cible reprend ce rythme — c'est la SEULE action dont l'effet ait été constaté.",
    unite: "audits",
    effet: "mesure",
  },
  {
    id: "resultats-consignes",
    label: "Résultats d'appel consignés",
    cible: 100,
    source: "Sans consignation, l'appel n'existe nulle part : il ne corrige pas le tri, ne nourrit pas le Cerveau, ne compte pas dans le taux.",
    unite: "% des appels passés",
    effet: "suppose",
  },
];

/** Ce qui a été fait — les compteurs bruts, tels que l'app les connaît. */
export interface FaitsTraction {
  fiches: number;
  joursAuRythme: number;
  audits: number;
  appelsPasses: number;
  appelsConsignes: number;
  rdvObtenus: number;
}

export interface LigneTraction {
  action: ActionSuivie;
  fait: number;
  /** Reste à faire. Jamais négatif : dépasser une cible n'est pas une dette. */
  reste: number;
  atteinte: boolean;
}

export interface EtatTraction {
  segment: SegmentCible;
  lignes: LigneTraction[];
  /** RDV attendus si les cibles sont tenues — avec son intervalle. */
  rdvAttendus: Taux;
  /** Fourchette basse / haute sur la cible de fiches. */
  rdvFourchette: { bas: number; haut: number } | null;
  rdvObtenus: number;
  /**
   * ⚠ TOUJOURS `null`, et c'est le TYPE qui le dit.
   *
   * Le taux RDV → signature n'a jamais été observé (`gagnes: 0`). Rendre un
   * euro ici demanderait d'inventer le seul maillon manquant — et un chiffre
   * inventé au milieu de chiffres mesurés se lit comme une mesure.
   */
  eurosProjetes: null;
  motifSansEuros: string;
}

/**
 * L'état de la traction, à l'instant T.
 *
 * @param tauxBrut Le taux mesuré fiches travaillées → RDV. Passé en
 * PARAMÈTRE : il vit dans un module serveur, et cet écran s'affiche sur un
 * téléphone.
 */
export function etatTraction(
  faits: FaitsTraction,
  tauxBrut: { succes: number; n: number },
  segment: SegmentCible = SEGMENT_PRINCIPAL,
): EtatTraction {
  const valeurs: Record<string, number> = {
    fiches: faits.fiches,
    rythme: faits.joursAuRythme,
    audits: faits.audits,
    "resultats-consignes":
      faits.appelsPasses === 0 ? 0 : Math.round((faits.appelsConsignes / faits.appelsPasses) * 100),
  };

  const lignes = ACTIONS.map((action) => {
    const fait = valeurs[action.id] ?? 0;
    return { action, fait, reste: Math.max(0, action.cible - fait), atteinte: fait >= action.cible };
  });

  const rdvAttendus = tauxMesure(tauxBrut.succes, tauxBrut.n, "fiches travaillées → RDV");
  const rdvFourchette =
    rdvAttendus.bas === null || rdvAttendus.haut === null
      ? null
      : { bas: Math.round(FUEL_TARGET * rdvAttendus.bas), haut: Math.round(FUEL_TARGET * rdvAttendus.haut) };

  return {
    segment,
    lignes,
    rdvAttendus,
    rdvFourchette,
    rdvObtenus: faits.rdvObtenus,
    eurosProjetes: null,
    motifSansEuros:
      "Aucun euro projeté : le taux rendez-vous → signature n'a jamais été mesuré chez nous (0 affaire gagnée). " +
      "C'est le seul maillon entre le RDV et l'argent, et aucun raisonnement ne le remplace — il faut une signature.",
  };
}

/**
 * La prochaine action à faire, une seule.
 *
 * ⚠ UNE SEULE, et c'est délibéré. Un tableau de bord qui affiche quatre
 * retards à la fois se lit comme un reproche et se referme. On sert celle qui
 * DÉBLOQUE les autres : sans fiches, le rythme ne veut rien dire ; sans
 * rythme, le taux mesuré ne s'applique pas.
 */
export function prochaineAction(etat: EtatTraction): LigneTraction | null {
  return etat.lignes.find((l) => !l.atteinte) ?? null;
}
