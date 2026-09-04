import type { Prospect } from "./types";
import { verticalForProspect } from "./playbook";
import { pickMagnet } from "./lead-magnet";
import { OFFRES } from "./offer-match";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QU'ON ÉCRIT À UN PROSPECT — une seule fois, pour les deux canaux.
 *
 * ⚠ DEUX DÉFAUTS EN UN, ET C'EST LE MÊME QUE CÔTÉ VOIX.
 *
 * 1. L'ANGLE ÉTAIT FIGÉ SUR CALLFLOW. `mail-compose` et `linkedin-sequence`
 *    annonçaient tous les deux :
 *
 *      « je travaille avec les métiers où le téléphone est le premier point
 *        de contact »
 *      « il m'arrive de préparer […] un audit de son accueil téléphonique »
 *
 *    Quel que soit le routage. Un prospect classé « invisible en ligne »
 *    recevait donc une proposition d'audit téléphonique — et l'aimant qu'on
 *    lui aurait réellement envoyé (`pickMagnet`) s'appelle « Audit de votre
 *    visibilité locale ». Le mail vendait une chose, la pièce jointe une
 *    autre.
 *
 * 2. LES TROIS PHRASES ÉTAIENT DUPLIQUÉES MOT POUR MOT dans les deux
 *    fichiers. Corriger l'une laissait l'autre mentir.
 *
 * ── POURQUOI ÇA NE RÉINVENTE RIEN ──
 *
 * `pickMagnet` existe, suit déjà `deepDive` et se contraint déjà aux offres
 * autorisées du compte. Son commentaire le dit : « même logique de routage,
 * donc jamais de contradiction entre ce qu'on envoie et ce qu'on proposera
 * ensuite ». La contradiction existait quand même — parce que le corps du
 * message ne le consultait pas.
 *
 * On lit donc l'aimant, et rien d'autre : son TITRE est le nom réel du
 * document, son CIBLAGE est la phrase de critère. Aucune copie nouvelle à
 * maintenir, aucune à faire diverger.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ApprocheEcrite {
  /** « je travaille avec les … » — le critère, sans la liste de secteurs. */
  critere: string;
  /**
   * L'observation de MÉTIER du playbook, ou `null` si elle ne colle pas à
   * l'offre routée.
   *
   * ⚠ ELLE ÉTAIT AJOUTÉE SANS CONDITION, ET ELLE RAMENAIT LE TÉLÉPHONE.
   * Constaté sur le rendu réel, après la première correction : une fiche
   * routée « visibilité » recevait « je travaille avec les commerces et
   * artisans invisibles en ligne. **Les métiers où l'artisan est sur le
   * chantier toute la journée — donc jamais près du téléphone.** » Le bon
   * critère, immédiatement contredit par le suivant.
   *
   * Ce n'est pas un jugement de goût : les onze critères de `lib/playbook.ts`
   * parlent TOUS du téléphone (c'est vérifiable, et un test le vérifie). Ils
   * appartiennent à l'angle Alpha Voice et n'ont de sens que là.
   */
  critereMetier: string | null;
  /** La seule question posée. Verticale si elle colle à l'offre, sinon celle de l'offre. */
  question: string;
  /**
   * La phrase qui SIGNALE l'audit sans le proposer (posture pull), ou `null`
   * si aucun aimant ne convient à ce compte — auquel cas on n'annonce rien
   * plutôt que d'annoncer le mauvais document.
   */
  signal: string | null;
  /** Fin d'objet d'email, calée sur le sujet réel. */
  objet: string;
}

/**
 * Le ciblage de l'aimant, ramené à ce qui se dit à un prospect.
 *
 * `targets` est une note interne : « Métiers où le téléphone EST le canal
 * d'entrée : garages, artisans, santé, auto-écoles, immobilier. » Réciter la
 * liste des secteurs à un garage donne l'impression d'un publipostage — on
 * coupe donc au deux-points, ce qui laisse le critère seul. Transformation
 * mécanique : rien n'est réécrit à la main, donc rien ne peut diverger.
 */
function critereDepuisCiblage(targets: string): string {
  const avantListe = targets.split(":")[0].trim().replace(/\.$/, "");
  return avantListe.charAt(0).toLowerCase() + avantListe.slice(1);
}

export function approcheEcrite(p: Prospect, accountId = "eagleye"): ApprocheEcrite {
  const v = verticalForProspect(p);
  const pick = pickMagnet(p, accountId);
  const offre = pick?.magnet.offer ?? null;

  /**
   * La verticale n'enrichit le message que si elle sert la MÊME offre que
   * l'aimant routé.
   *
   * ⚠ CETTE LIGNE TESTAIT `offre === "alpha-voice"`, ET C'ÉTAIT JUSTE — tant
   * que les neuf verticales du playbook parlaient toutes du téléphone qui
   * tombe dans le vide. « Le playbook parle téléphone » n'était pas une règle,
   * c'était un CONSTAT, et il servait de raccourci à la vraie question.
   *
   * La maîtrise d'ouvrage l'a rendu faux : elle sert l'OS de vente. Avec
   * l'ancien test, son critère (« le rythme des réservations conditionne le
   * lancement de l'opération ») aurait été jeté sur un routage alpha-sales-os
   * — où il est pourtant exactement à sa place — et servi sur un routage
   * alpha-voice, où il n'a rien à faire. Les deux erreurs en une ligne.
   *
   * On compare donc les offres, et l'ancien constat devient un DÉFAUT
   * documenté : une verticale sans `offre` sert Alpha Voice. Un test refuse
   * une verticale sans `offre` dont le critère ne parle pas du téléphone —
   * c'est ce qui empêche le défaut de mentir la prochaine fois.
   */
  const offreVerticale = v?.offre ?? "alpha-voice";
  const verticaleColle = offre !== null && offre === offreVerticale;

  return {
    critere: pick
      ? `les ${critereDepuisCiblage(pick.magnet.targets)}`
      : // Sans aimant, on ne prétend pas travailler avec un type de métier
        // précis : on dit le vrai, qui est déjà un critère.
        "les entreprises de votre taille, sur un sujet précis",

    critereMetier: verticaleColle ? v?.criterion ?? null : null,

    // La question de la VERTICALE prime QUAND elle parle du même sujet : elle
    // est écrite dans son métier, et c'est ce qui fait ouvrir. Sinon celle de
    // l'offre — la même que l'agent vocal pose au téléphone, pour qu'un
    // prospect touché deux fois n'entende pas deux sujets.
    question:
      (verticaleColle ? v?.diagnostic[0] : undefined) ??
      (offre
        ? OFFRES[offre].question
        : "Aujourd'hui, comment les nouvelles demandes vous arrivent — et qu'est-ce qui se passe ensuite ?"),

    /**
     * ⚠ La phrase reste à la DEUXIÈME personne d'un bout à l'autre.
     *
     * Le texte d'origine disait « un audit de SON accueil téléphonique — ce
     * qu'ELLE capte ». En y injectant le titre réel de l'aimant, qui est écrit
     * « Audit de VOTRE accueil téléphonique », on obtenait un mélange des deux
     * (« un audit de votre accueil — ce qu'elle capte ») qui se remarque
     * immédiatement à la lecture. Vu sur le rendu réel, pas déduit.
     */
    signal: pick
      ? `Il m'arrive de préparer, pour une entreprise en particulier, un ${pick.magnet.title.toLowerCase()} — ce que vous captez, ce qui vous échappe, ce que ça représente. Je ne vous le propose pas : je vous dis juste que ça existe, au cas où ce soit utile à ${p.company} un jour.`
      : null,

    objet: pick ? pick.magnet.title.toLowerCase() : "une question",
  };
}
