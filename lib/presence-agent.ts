/**
 * ─────────────────────────────────────────────────────────────────────
 * Y A-T-IL QUELQU'UN AU BOUT ? — la présence de l'agent vocal.
 *
 * ══ LE TROU QUE CE MODULE FERME ══
 *
 * `voice/agent.py` tourne EN LOCAL (décidé le 09/09/2026 : un VPS ne se monte
 * que pour les clients). Or `/api/voice/call` crée un dispatch LiveKit et rend
 * `dispatched: true` **que l'agent tourne ou non**.
 *
 * Conséquence, le premier soir où le poste est éteint avec l'autopilote armé :
 * le cron compose toutes les dix minutes, la ligne SIP sonne, le prospect
 * décroche — et personne ne parle. C'est PIRE que de ne pas appeler :
 *
 *   · la fiche est brûlée (on ne rappelle pas quelqu'un à qui on a fait ça) ;
 *   · le numéro perd sa réputation, et ça ne se récupère pas ;
 *   · les minutes Telnyx sont facturées ;
 *   · les journaux restent VERTS — `ok: true`, aucune erreur nulle part.
 *
 * ══ POURQUOI UN BATTEMENT, ET PAS UNE INTERROGATION DE LIVEKIT ══
 *
 * L'API Twirp de LiveKit expose les dispatches d'une room, pas la liste des
 * workers enregistrés. Il n'existe pas d'endpoint stable pour demander « un
 * agent `alpha-voice` est-il connecté ? ». On inverse donc la question :
 * l'agent DIT qu'il est là, régulièrement, et son silence vaut absence.
 *
 * ⚠ Un battement prouve qu'un processus tourne. Il ne prouve pas qu'il sait
 * parler — une clé TTS expirée laisserait le battement vert. C'est une garde
 * contre l'ABSENCE, pas contre la panne, et le confondre serait remplacer un
 * angle mort par une fausse assurance.
 *
 * ══ L'ASYMÉTRIE, QUI EST TOUT LE SUJET ══
 *
 * `null` (jamais vu, table absente, base injoignable) NE VAUT PAS « vivant ».
 * Ici, contrairement aux écrans de mesure, l'inconnu ne se contente pas de se
 * dire : il REFUSE. Ne pas appeler coûte un créneau ; appeler dans le vide
 * coûte une fiche, un numéro et de l'argent. On choisit toujours l'erreur la
 * moins chère.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Cadence attendue du battement, côté agent. */
export const BATTEMENT_INTERVALLE_S = 30;

/**
 * Au-delà, l'agent est considéré absent.
 *
 * Quatre intervalles : assez pour absorber un hoquet réseau ou un redémarrage,
 * assez court pour qu'un poste fermé cesse de composer en deux minutes. Le
 * cron passe toutes les dix minutes — une tolérance plus large ne servirait
 * qu'à laisser passer un tick de plus dans le vide.
 */
export const TOLERANCE_S = BATTEMENT_INTERVALLE_S * 4;

export type EtatPresence =
  /** Battement récent : un worker écoute. */
  | "vivant"
  /** Battement trop vieux : le processus s'est arrêté. */
  | "silencieux"
  /** Jamais de battement, ou impossible de le lire. */
  | "inconnu";

export interface Presence {
  etat: EtatPresence;
  /** Secondes depuis le dernier battement. `null` si jamais vu. */
  depuisS: number | null;
  /** Peut-on composer un numéro ? Vrai UNIQUEMENT sur `vivant`. */
  peutAppeler: boolean;
  /** Ce qu'on dit à l'écran, et dans la réponse du tick. */
  phrase: string;
}

/**
 * L'état de présence, à partir du dernier battement connu.
 *
 * @param dernierIso  horodatage ISO du dernier battement, ou `null`
 */
export function presenceAgent(
  dernierIso: string | null | undefined,
  maintenant: Date = new Date(),
  toleranceS: number = TOLERANCE_S
): Presence {
  if (!dernierIso) {
    return {
      etat: "inconnu",
      depuisS: null,
      peutAppeler: false,
      phrase:
        "Aucun agent vocal ne s'est jamais annoncé. On ne compose pas : un appel sans agent sonne dans le vide, " +
        "brûle la fiche et le numéro, et les journaux restent verts. Lance `cd voice && python agent.py dev`.",
    };
  }

  const t = new Date(dernierIso).getTime();
  if (Number.isNaN(t)) {
    // Un horodatage illisible n'est pas une preuve de vie. Même règle.
    return {
      etat: "inconnu",
      depuisS: null,
      peutAppeler: false,
      phrase: "Le dernier battement de l'agent est illisible — on ne compose pas sur une preuve qu'on ne sait pas lire.",
    };
  }

  const depuisS = Math.max(0, Math.round((maintenant.getTime() - t) / 1000));

  if (depuisS <= toleranceS) {
    return {
      etat: "vivant",
      depuisS,
      peutAppeler: true,
      phrase: `Agent vocal présent (battement il y a ${depuisS} s).`,
    };
  }

  return {
    etat: "silencieux",
    depuisS,
    peutAppeler: false,
    phrase:
      `Aucun battement depuis ${Math.round(depuisS / 60)} min — l'agent vocal ne tourne plus. ` +
      "On ne compose pas : le prospect décrocherait sur du silence.",
  };
}
