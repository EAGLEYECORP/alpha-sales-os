import { CALL_DAILY_SAFE } from "./daily-plan";

/**
 * ─────────────────────────────────────────────────────────────────────
 * COMBIEN D'APPELS LA MACHINE PEUT LANCER — et ce qui la borne vraiment.
 *
 * ⚠ LE DÉFAUT : UN PLAFOND DE FATIGUE HUMAINE APPLIQUÉ À UN AGENT VOCAL.
 *
 * `CALL_DAILY_SAFE = 30` est défini dans `lib/daily-plan.ts` avec sa raison
 * écrite à côté : « au-delà, la qualité de conversation décroche ». C'est
 * juste, et c'est une contrainte de FATIGUE — celle d'un closer qui enchaîne
 * les appels.
 *
 * `campaign-runner`, qui pilote la file d'Alpha Voice, prenait ce même 30 en
 * plafond par défaut. Et rien, nulle part dans l'app, ne passait autre chose.
 * Résultat : l'autopilote tournait en permanence au rythme d'un humain, alors
 * qu'un agent vocal ne fatigue pas au 31ᵉ appel.
 *
 * Une constante, deux sens, câblée aux deux. Le motif habituel de ce dépôt.
 *
 * ── CE QUI BORNE RÉELLEMENT LA MACHINE ──
 *
 * Pas sa fatigue : la nôtre. La règle ScintIA, encodée dans `cadenceFor`, dit
 * que dès qu'il RÉPOND, Alpha Voice arrête et PASSE LA MAIN au closer. Chaque
 * appel décroché devient donc le travail d'un humain.
 *
 *     appels/jour × taux de décroché = conversations à absorber
 *
 * À 30 % de décroché, 500 appels par jour produisent 150 conversations. C'est
 * le chiffre que personne ne calcule avant de demander du volume — et c'est
 * lui qui décide, pas la capacité d'appel.
 *
 * ⚠⚠ CE MODULE NE LÈVE AUCUN PLAFOND LÉGAL. La fréquence PAR PROSPECT reste
 * gouvernée par `plafondRappels` (décret n° 2022-1313 : 4 sollicitations sur
 * 30 jours glissants sans SIREN). Monter le volume quotidien ne change rien à
 * ça — ça exige seulement une liste plus large, ce que `fichesNecessaires`
 * calcule.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface CapaciteEntree {
  /** Combien d'humains prennent les conversations transmises. */
  closers: number;
  /**
   * Conversations qu'un closer absorbe dans une journée.
   *
   * Le défaut est `CALL_DAILY_SAFE`. C'est ICI que le 30 a du sens : il
   * décrit un humain, pas une machine.
   */
  conversationsParCloser?: number;
  /** Taux de décroché observé, en %. */
  tauxDecrochePct: number;
  /**
   * Plafond dur imposé par la téléphonie (canaux simultanés × fenêtre).
   * Absent = non mesuré, et on le DIT plutôt que de supposer.
   */
  plafondTelephonie?: number;
}

export interface Capacite {
  /** Appels/jour que la machine peut lancer sans noyer les humains. */
  appelsParJour: number;
  /** Conversations que ça produit, à absorber le jour même. */
  conversationsAttendues: number;
  /** Ce qui borne réellement. */
  bornePar: "humains" | "telephonie";
  /** La phrase à lire avant de monter le volume. */
  pourquoi: string;
}

/**
 * Le plafond machine, dérivé de la capacité de closing.
 *
 * ⚠ Un taux de décroché à 0 ne rend pas « l'infini » : il rend un plafond
 * inconnu. Zéro donnée → zéro chiffre — on retombe sur le plafond humain et
 * on dit pourquoi, plutôt que d'autoriser un volume sur une division par zéro.
 */
export function capaciteAppels(e: CapaciteEntree): Capacite {
  const parCloser = Math.max(1, e.conversationsParCloser ?? CALL_DAILY_SAFE);
  const closers = Math.max(0, Math.floor(e.closers));
  const taux = e.tauxDecrochePct;

  if (closers === 0) {
    return {
      appelsParJour: 0,
      conversationsAttendues: 0,
      bornePar: "humains",
      pourquoi:
        "Aucun closer déclaré. Alpha Voice passe la main dès qu'un prospect répond : sans personne pour " +
        "prendre la conversation, chaque décroché est un contact brûlé.",
    };
  }

  if (!(taux > 0)) {
    return {
      appelsParJour: parCloser * closers,
      conversationsAttendues: 0,
      bornePar: "humains",
      pourquoi:
        "Taux de décroché non mesuré : le plafond reste celui d'un humain. On ne monte pas le volume sur " +
        "une hypothèse — passe une première série, mesure, puis reviens.",
    };
  }

  const absorbables = parCloser * closers;
  const parHumains = Math.floor(absorbables / (taux / 100));
  const borneTel = e.plafondTelephonie;

  if (typeof borneTel === "number" && borneTel < parHumains) {
    return {
      appelsParJour: borneTel,
      conversationsAttendues: Math.round((borneTel * taux) / 100),
      bornePar: "telephonie",
      pourquoi:
        `La téléphonie plafonne à ${borneTel} appels/jour, sous les ${parHumains} que ${closers} closer(s) ` +
        `pourraient absorber. C'est la ligne qu'il faut élargir, pas l'équipe.`,
    };
  }

  return {
    appelsParJour: parHumains,
    conversationsAttendues: absorbables,
    bornePar: "humains",
    pourquoi:
      `${closers} closer(s) × ${parCloser} conversations = ${absorbables} décrochés absorbables. ` +
      `À ${taux} % de décroché, ça autorise ${parHumains} appels/jour. Au-delà, la machine produit des ` +
      `conversations que personne ne prend — et un prospect qui a parlé puis qu'on ne rappelle pas est perdu ` +
      `plus sûrement qu'un prospect jamais appelé.`,
  };
}

/** Ce qu'il faut d'humains pour soutenir un volume visé. */
export function closersRequis(appelsParJour: number, tauxDecrochePct: number, conversationsParCloser = CALL_DAILY_SAFE): number {
  if (!(tauxDecrochePct > 0) || appelsParJour <= 0) return 0;
  return Math.ceil((appelsParJour * (tauxDecrochePct / 100)) / Math.max(1, conversationsParCloser));
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * COMBIEN DE FICHES IL FAUT POUR TENIR UN VOLUME — la contrainte qu'on oublie.
 *
 * Un volume quotidien ne se tient pas avec une petite liste : la fréquence par
 * prospect est plafonnée (décret n° 2022-1313 sans SIREN, cadence ScintIA
 * avec). Demander 500 touches/jour à 300 fiches, c'est demander 50 touches par
 * personne en un mois — illégal, et commercialement suicidaire.
 *
 * C'est ce calcul-là qui dit si un objectif de volume est atteignable ou s'il
 * n'est qu'un chiffre.
 * ─────────────────────────────────────────────────────────────────────
 */
export function fichesNecessaires(touchesParJour: number, joursOuvres: number, plafondParProspect: number): number {
  if (touchesParJour <= 0 || joursOuvres <= 0) return 0;
  return Math.ceil((touchesParJour * joursOuvres) / Math.max(1, plafondParProspect));
}
