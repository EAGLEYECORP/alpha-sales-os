import { ECHANTILLON_MIN, tauxMesure, type Taux } from "./calibration";

/**
 * ─────────────────────────────────────────────────────────────────────
 * TARIFER CHACUN SUR CE QU'ALPHA LUI A RAPPORTÉ — et pourquoi le socle
 * gratuit est le seul endroit où cette mesure peut naître.
 *
 * L'idée est juste : `SOCLE_PLATEFORME_HT` et `PRIX_SIEGE_HT` sont des
 * DÉCISIONS, faute de vente. Une cohorte d'utilisateurs gratuits qui
 * prospectent pour de vrai est le seul instrument capable de les transformer
 * en mesures — et de dire à CHACUN ce qu'Alpha lui a effectivement rapporté.
 *
 * ══ CE QUI BLOQUE AUJOURD'HUI, ET CE N'EST PAS UN OUBLI ══
 *
 * Mesuré le 13/09/2026 : **le serveur ne voit RIEN d'un utilisateur gratuit.**
 * Aucune télémétrie, aucune table d'usage, et le CRM vit dans le
 * `localStorage` du navigateur (`pipeServeur` est opt-in). Pas une fiche, pas
 * un rendez-vous, pas un euro.
 *
 * C'est la promesse du produit, pas une lacune : « rien de ce qui touche la
 * donnée MÉTIER ne passe par un tiers » est l'argument de souveraineté qui
 * tient la vitrine debout — celui qui a remplacé une affiliation inventée.
 * Le contredire en silence coûterait plus que tout ce qu'on en tirerait.
 *
 * ══ LES DEUX NATURES DE SIGNAL, ET ELLES NE VALENT PAS PAREIL ══
 *
 * ⚠⚠ LE PIÈGE QUI DÉCIDE DE TOUT : **indexer un prix sur un nombre que le
 * client TAPE lui donne une raison d'en taper un plus petit.** Aujourd'hui il
 * n'en a aucune. `lib/part-resultat.ts` le dit déjà pour la part au résultat
 * (« celui qui paie contrôle le dénominateur ») ; ici ce serait pire, parce
 * qu'on fabriquerait l'incitation là où elle n'existait pas.
 *
 * D'où la séparation, portée par le TYPE et pas par une convention :
 *  · `mesure-infra`   — ça passe par NOTRE infrastructure (emails partis de
 *    `/api/send`, minutes de `/api/voice/call`, jetons de `/api/ai`). On le
 *    compte sans rien demander, et le fausser à son avantage suppose de se
 *    priver du service.
 *  · `declare-client` — tapé dans son CRM (montants, stades, rendez-vous).
 *    Invisible pour nous aujourd'hui, et falsifiable à son bénéfice DÈS
 *    QU'ON EN FAIT UN PRIX.
 *
 * **Le prix s'indexe sur l'ACTIVITÉ mesurée, jamais sur le CA déclaré.** Le CA
 * déclaré reste utile — pour lui montrer sa propre performance — mais il
 * n'entre dans aucun calcul de facture.
 *
 * ══ CE QUI SORT D'ICI AUJOURD'HUI : RIEN, ET C'EST LE BON ÉTAT ══
 *
 * Zéro utilisateur gratuit, zéro observation. Le module rend `null` avec son
 * motif, comme `lib/calibration.ts` et `lib/paliers-campagne.ts`. Un `0 €` ou
 * un prix « estimé » se lirait comme un résultat.
 * ─────────────────────────────────────────────────────────────────────
 */

/** D'où vient un signal — et donc ce qu'il vaut dans une décision de prix. */
export type NatureSignal =
  /** Compté chez nous, non falsifiable au bénéfice du client. */
  | "mesure-infra"
  /** Saisi par le client. Jamais une base de facturation. */
  | "declare-client";

export interface DefinitionSignal {
  id: string;
  label: string;
  nature: NatureSignal;
  /** D'où le nombre vient réellement — nommé, pour qu'on puisse le contester. */
  source: string;
  /**
   * Ce signal a-t-il le droit d'entrer dans un calcul de PRIX ?
   *
   * ⚠ Dérivé de `nature`, jamais saisi à la main : deux champs à remplir
   * finissent par se contredire, et c'est celui qu'on ne relit pas qui
   * ouvrirait la porte au CA déclaré.
   */
  readonly facturable?: never;
}

export const SIGNAUX: DefinitionSignal[] = [
  {
    id: "emails-envoyes",
    label: "Emails partis de notre infrastructure",
    nature: "mesure-infra",
    source: "`/api/send` — un compteur serveur, déjà nécessaire au palier d'envoi.",
  },
  {
    id: "minutes-voix",
    label: "Minutes d'agent vocal consommées",
    nature: "mesure-infra",
    source: "`/api/voice/call` + `call_sessions` — déjà facturées, déjà comptées.",
  },
  {
    id: "fiches-travaillees",
    label: "Fiches effectivement travaillées",
    nature: "declare-client",
    source: "Le CRM du navigateur. Invisible pour nous sans partage explicite.",
  },
  {
    id: "rdv-obtenus",
    label: "Rendez-vous obtenus",
    nature: "declare-client",
    source: "Saisi dans la fiche. C'est le seul résultat que juillet ait mesuré (11,8 % sur 78).",
  },
  {
    id: "ca-encaisse",
    label: "Chiffre d'affaires encaissé",
    nature: "declare-client",
    source: "`payments[].amount` au statut `paye`. Même base que `lib/part-resultat.ts`.",
  },
];

/** Un signal a-t-il le droit d'entrer dans un calcul de facture ? */
export function peutFacturerSur(signalId: string): boolean {
  const s = SIGNAUX.find((x) => x.id === signalId);
  return s?.nature === "mesure-infra";
}

/**
 * Ce qu'un utilisateur gratuit accepte de partager.
 *
 * ⚠⚠ DES COMPTES, JAMAIS DU CONTENU. Aucun nom, aucun numéro, aucun corps de
 * message, aucun nom d'entreprise. C'est cette ligne — et elle seule — qui
 * permet de mesurer une cohorte sans démentir la promesse de souveraineté.
 * Le jour où un champ de texte libre entre dans cette structure, l'argument de
 * la vitrine devient faux, et il se vérifie en ouvrant les devtools.
 */
export interface PartageCohorte {
  /** Identifiant de locataire — jamais un email, jamais un nom. */
  tenantId: string;
  /** Le partage est ACCEPTÉ explicitement, et il se retire. */
  consenti: boolean;
  jours: number;
  emailsEnvoyes: number;
  minutesVoix: number;
  fichesTravaillees: number;
  rdvObtenus: number;
}

/** Le nombre de comptes en dessous duquel on ne conclut rien d'une cohorte. */
export const COHORTE_MIN = 20;

export interface LectureCohorte {
  /** Combien de comptes ont effectivement partagé. */
  comptes: number;
  /** Fiches → RDV, avec son intervalle. `null` sous l'échantillon minimum. */
  tauxRdv: Taux;
  /** Ce qu'on n'a pas le droit d'en conclure. Jamais vide quand ça manque. */
  reserves: string[];
  /** Le prix que cette mesure justifierait — `null` tant qu'elle ne tient pas. */
  prixJustifie: null;
}

/**
 * Ce qu'une cohorte d'utilisateurs gratuits permet de dire — et surtout, ce
 * qu'elle ne permet pas.
 *
 * ⚠ `prixJustifie` est typé `null`, littéralement. Ce n'est pas un état
 * transitoire en attendant les données : c'est la règle du dépôt appliquée au
 * type lui-même — **aucun poids ne s'auto-corrige**. Le jour où la cohorte
 * existe, ce module rendra un VERDICT et nommera le fichier ; le prix se
 * changera à la main dans `lib/offres-publiques.ts`, et ça se verra dans un
 * diff. Un module qui ajusterait le prix tout seul apprendrait le bruit de
 * quarante comptes et le graverait dans la facture de tout le monde.
 */
export function lireCohorte(partages: PartageCohorte[]): LectureCohorte {
  const retenus = partages.filter((p) => p.consenti);
  const reserves: string[] = [];

  const refuses = partages.length - retenus.length;
  if (refuses > 0) {
    reserves.push(
      `${refuses} compte(s) n'ont pas consenti au partage et sont exclus. Une cohorte ne se complète pas en supposant.`,
    );
  }

  const fiches = retenus.reduce((s, p) => s + p.fichesTravaillees, 0);
  const rdv = retenus.reduce((s, p) => s + p.rdvObtenus, 0);
  const tauxRdv = tauxMesure(rdv, fiches, "fiches travaillées → rendez-vous");

  if (retenus.length < COHORTE_MIN) {
    reserves.push(
      `${retenus.length} compte(s) partagent, il en faut ${COHORTE_MIN} : en dessous, un seul utilisateur très actif ` +
        `déplace la médiane et on prendrait son cas particulier pour une loi.`,
    );
  }
  if (fiches < ECHANTILLON_MIN) {
    reserves.push(
      `${fiches} fiche(s) travaillées au total, il en faut ${ECHANTILLON_MIN} : sous ce seuil l'intervalle est plus large que l'écart qu'on cherche.`,
    );
  }
  reserves.push(
    "Aucun chiffre d'affaires déclaré n'entre ici, et ce n'est pas un oubli : indexer un prix sur un montant " +
      "que le client saisit lui donne une raison d'en saisir un plus petit. On mesure l'activité, il déclare ses euros.",
  );

  return { comptes: retenus.length, tauxRdv, reserves, prixJustifie: null };
}

/**
 * L'état du dispositif, tel qu'il est aujourd'hui.
 *
 * ⚠ Cette fonction existe pour que l'écran puisse dire « rien ne remonte
 * encore » sans qu'on le déduise d'un tableau vide. Même mode de panne que le
 * moniteur : un zéro parce que personne n'utilise et un zéro parce qu'on ne
 * collecte rien demandent deux gestes opposés.
 */
export function etatDuDispositif(): { collecteActive: boolean; motif: string } {
  return {
    collecteActive: false,
    motif:
      "Aucune collecte n'existe : pas de table d'usage, pas de télémétrie, et le CRM d'un compte gratuit vit " +
      "dans son navigateur. Mesurer une cohorte demande d'abord un partage OPT-IN de compteurs (jamais de contenu), " +
      "et ça se décide — c'est la promesse de souveraineté qui est en jeu, pas une migration.",
  };
}
