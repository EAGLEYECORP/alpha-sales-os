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
 * Pas sa fatigue : la nôtre. Mais PLUS sur chaque décroché.
 *
 * ⚠ DOCTRINE DU 28/08/2026 — ALPHA VOICE MÈNE L'APPEL À FROID ENTIER.
 *
 * Avant, il ne faisait que composer : dès qu'on décrochait il se retirait, et
 * un closer prenait la conversation. Le calcul était alors
 * `appels × décroché`, et il donnait des chiffres décourageants : 500 appels
 * à 30 % = 150 conversations = cinq closers.
 *
 * Désormais l'agent conduit l'appel, qualifie, et ne passe la main que sur
 * INTÉRÊT QUALIFIÉ (`outcome: "interesse"`). Un refus ou un « rappelez-moi »
 * se traite et se consigne sans personne. Le calcul devient :
 *
 *     appels × taux de décroché × taux d'intérêt = closings à absorber
 *
 * À 30 % de décroché et 20 % d'intérêt parmi eux, 500 appels par jour
 * produisent 30 rendez-vous — UN closer. C'est ce facteur-là qui rend le
 * volume tenable, et c'est lui qu'on oublie de mesurer.
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
   * Part des décrochés qui donnent un INTÉRÊT QUALIFIÉ, en %.
   *
   * ⚠ Absent = on ne sait pas, et on retombe sur l'ancienne hypothèse
   * (100 % : tout décroché mobilise un humain). C'est le repli PRUDENT : il
   * sous-estime la capacité, donc il ne fait pas promettre un volume qu'on ne
   * tiendrait pas. Zéro donnée → zéro chiffre optimiste.
   */
  tauxInteretPct?: number;
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
  // Sans mesure d'intérêt, on suppose que tout décroché mobilise un humain —
  // l'ancien monde. Prudent, donc jamais surpromettant.
  const interet = e.tauxInteretPct != null && e.tauxInteretPct > 0 ? e.tauxInteretPct : 100;
  const partQuiMobilise = (taux / 100) * (interet / 100);
  const parHumains = Math.floor(absorbables / partQuiMobilise);
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
      `${closers} closer(s) × ${parCloser} = ${absorbables} closings absorbables par jour. ` +
      `À ${taux} % de décroché` +
      (interet < 100 ? ` et ${interet} % d'intérêt qualifié` : ` (intérêt non mesuré : on suppose que TOUT décroché mobilise un humain)`) +
      `, ça autorise ${parHumains} appels/jour. Au-delà, la machine produit des rendez-vous que personne ne ` +
      `prend — et un prospect qui a dit oui puis qu'on ne rappelle pas est perdu plus sûrement qu'un prospect ` +
      `jamais appelé.`,
  };
}

/**
 * Ce qu'il faut d'humains pour soutenir un volume visé.
 *
 * `tauxInteretPct` absent = repli prudent à 100 % (tout décroché mobilise),
 * cohérent avec `capaciteAppels`.
 */
export function closersRequis(
  appelsParJour: number,
  tauxDecrochePct: number,
  opts: { tauxInteretPct?: number; conversationsParCloser?: number } = {}
): number {
  if (!(tauxDecrochePct > 0) || appelsParJour <= 0) return 0;
  const interet = opts.tauxInteretPct != null && opts.tauxInteretPct > 0 ? opts.tauxInteretPct : 100;
  const parCloser = Math.max(1, opts.conversationsParCloser ?? CALL_DAILY_SAFE);
  return Math.ceil((appelsParJour * (tauxDecrochePct / 100) * (interet / 100)) / parCloser);
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * COMBIEN DE FICHES IL FAUT POUR TENIR UN VOLUME — la contrainte qu'on oublie.
 *
 * Un volume quotidien ne se tient pas avec une petite liste : la fréquence par
 * prospect est plafonnée (décret n° 2022-1313 sans SIREN, cadence complète
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
