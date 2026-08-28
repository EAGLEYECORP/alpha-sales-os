/**
 * ─────────────────────────────────────────────────────────────────────
 * Cadence de rappel — la règle EXIGÉE par ScintIA pour Callflow.
 *
 * « Après le premier appel sans réponse : 5 rappels sur 2 jours. Dès qu'il
 *   répond, Alpha Voice ARRÊTE d'appeler, met à jour le pipeline, et passe
 *   la main à l'humain (closer). »
 *
 * Deux points non négociables, et c'est le cœur du module :
 *  1. Le compteur s'arrête à la RÉPONSE, pas au nombre d'essais. Un agent qui
 *     continue d'appeler quelqu'un qui a décroché détruit la relation — et
 *     nous ferait perdre le compte ScintIA.
 *  2. Une opposition (« ne me rappelez plus ») coupe TOUT, définitivement,
 *     immédiatement. Elle prime sur la cadence, sur le quota, sur tout.
 *
 * Module pur : il calcule QUAND rappeler et QUAND s'arrêter. Il ne passe
 * aucun appel — c'est l'orchestrateur qui exécute.
 * ─────────────────────────────────────────────────────────────────────
 */

/** 5 rappels après le 1er appel, étalés sur 2 jours (heures depuis le 1er appel). */
export const CALLFLOW_RECALL_OFFSETS_H = [3, 8, 24, 32, 48];
export const CALLFLOW_MAX_RECALLS = CALLFLOW_RECALL_OFFSETS_H.length;

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠ LE CONFLIT ENTRE LA CADENCE ScintIA ET LE DROIT FRANÇAIS.
 *
 * La cadence exigée par ScintIA fait **6 contacts en 2 jours** (le premier
 * appel plus cinq rappels). Le décret n° 2022-1313 plafonne le démarchage
 * téléphonique à **4 sollicitations par consommateur sur 30 jours glissants**.
 *
 * Il vise le B2C. Or une liste de prospection terrain est MÊLÉE : un artisan
 * en nom propre sur sa ligne mobile est exactement la zone grise, et c'est
 * nous qui portons le risque.
 *
 * ── CE QUE CE CODE FAIT, ET CE QU'IL NE FAIT PAS ──
 *
 * Il ne tranche PAS l'accord commercial : sur une cible clairement
 * professionnelle, la cadence ScintIA s'applique entière. Il empêche
 * seulement la cadence longue de partir en silence sur une cible à risque.
 *
 * Le discriminant est le SIREN. Une fiche croisée avec le registre des
 * entreprises est une entreprise inscrite — donc B2B. Une fiche sans SIREN,
 * sur un mobile, ne prouve rien : elle est plafonnée jusqu'à ce que quelqu'un
 * la qualifie.
 *
 * Avant, l'app AVERTISSAIT à l'import (`planifierAppels` alerte au-delà de 4)
 * et EXÉCUTAIT six contacts ici. Un avertissement qui ne pilote rien est un
 * avertissement qu'on apprend à ignorer.
 * ─────────────────────────────────────────────────────────────────────
 */
export const PLAFOND_SOLLICITATIONS_B2C = 4;

export interface RisqueCible {
  /** SIREN connu = entreprise inscrite au registre = B2B établi. */
  siren?: string;
  /** Numéro appelé, en E.164 ou en national. */
  telephone?: string;
}

/** Un mobile français : 06 / 07, ou +336 / +337. */
const MOBILE_FR = /^(?:\+33|0)\s*[67]/;

/**
 * Le SIREN, tel que l'import terrain l'écrit dans les notes après croisement
 * au registre. Un seul motif, partagé — deux relectures différentes du même
 * champ finissent par donner deux plafonds différents pour la même fiche.
 */
const SIREN_DANS_NOTES = /\bSIREN\s*:?\s*(\d{9})\b/i;

/**
 * La cible de risque d'un prospect — LE point d'entrée unique.
 *
 * ⚠ Appeler `cadenceFor` sans cible retombe sur la cadence Callflow complète
 * (5 rappels), c'est-à-dire au-dessus du plafond légal quand la fiche n'a pas
 * de SIREN. C'était le cas de `masterRappel` : le plan affiché à l'humain
 * annonçait « rappel 3/5 » pendant que l'autopilote, lui, s'arrêtait à 4.
 * Deux réponses pour la même fiche, et celle montrée était la mauvaise.
 */
export function cibleDepuisProspect(p: { phone?: string; notes?: string }): RisqueCible {
  return {
    telephone: p.phone,
    siren: (p.notes ?? "").match(SIREN_DANS_NOTES)?.[1],
  };
}

/**
 * Le nombre de rappels réellement autorisés sur cette cible.
 *
 * Rend AUSSI la raison : un plafond appliqué sans motif se contourne au
 * premier agacement, et celui-ci a une justification juridique qu'il faut
 * pouvoir relire.
 */
export function plafondRappels(cible: RisqueCible = {}): { max: number; plafonne: boolean; pourquoi: string } {
  const siren = (cible.siren ?? "").replace(/\D/g, "");
  if (siren.length >= 9) {
    return {
      max: CALLFLOW_MAX_RECALLS,
      plafonne: false,
      pourquoi: `SIREN ${siren} — entreprise inscrite au registre, la cadence Callflow complète s'applique.`,
    };
  }

  const mobile = MOBILE_FR.test((cible.telephone ?? "").replace(/[\s.-]/g, ""));
  // Le premier appel compte dans les sollicitations : 4 au total = 3 rappels.
  const max = PLAFOND_SOLLICITATIONS_B2C - 1;
  return {
    max: Math.min(max, CALLFLOW_MAX_RECALLS),
    plafonne: true,
    pourquoi: mobile
      ? "Mobile sans SIREN : la cible peut être un particulier ou un artisan en nom propre. Plafonné à 4 sollicitations sur 30 jours (décret n° 2022-1313) — croise la fiche avec le registre pour lever le plafond."
      : "Aucun SIREN : rien ne prouve que la cible est une entreprise inscrite. Plafonné à 4 sollicitations sur 30 jours (décret n° 2022-1313) — croise la fiche avec le registre pour lever le plafond.",
  };
}

export type CallOutcome =
  /** Personne n'a décroché (sonnerie, répondeur). */
  | "sans-reponse"
  /** Il a décroché et parlé — la cadence s'arrête ici. */
  | "repondu"
  /** Il a demandé à ne plus être appelé — arrêt définitif. */
  | "opposition"
  /** Numéro invalide / injoignable — inutile d'insister. */
  | "invalide";

export interface CallAttempt {
  /** ISO. */
  at: string;
  outcome: CallOutcome;
}

export type CadenceState =
  | "a-appeler"
  | "en-cadence"
  | "attente"
  | "epuisee"
  | "repondu-passer-humain"
  | "stop-definitif";

export interface CadenceDecision {
  state: CadenceState;
  /** Faut-il appeler MAINTENANT ? */
  callNow: boolean;
  /** Prochain rappel prévu (ISO), si la cadence continue. */
  nextCallAt: string | null;
  /** Rappels déjà consommés (hors 1er appel). */
  recallsUsed: number;
  recallsLeft: number;
  /** L'humain doit-il reprendre la main ? */
  handoffToHuman: boolean;
  /** Explication lisible — s'affiche dans la salle de contrôle. */
  reason: string;
}

const H = 3600_000;

/**
 * L'état de la cadence pour UN prospect, d'après ses tentatives.
 * `now` injectable pour les tests (et pour rejouer un historique).
 */
export function cadenceFor(
  attempts: CallAttempt[],
  now: Date = new Date(),
  cible: RisqueCible = {}
): CadenceDecision {
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  const plafond = plafondRappels(cible);

  // ── Arrêts définitifs : ils priment sur tout le reste ──
  const opposed = sorted.find((a) => a.outcome === "opposition");
  if (opposed) {
    return {
      state: "stop-definitif",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: false,
      reason: "Opposition exprimée — plus aucun appel, définitivement.",
    };
  }
  const invalid = sorted.find((a) => a.outcome === "invalide");
  if (invalid) {
    return {
      state: "stop-definitif",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: false,
      reason: "Numéro invalide ou injoignable — on arrête d'appeler.",
    };
  }

  // ── Il a répondu : Alpha Voice s'arrête et passe la main ──
  const answered = sorted.find((a) => a.outcome === "repondu");
  if (answered) {
    return {
      state: "repondu-passer-humain",
      callNow: false,
      nextCallAt: null,
      recallsUsed: Math.max(0, sorted.length - 1),
      recallsLeft: 0,
      handoffToHuman: true,
      reason: "Il a répondu — Alpha Voice arrête, pipeline mis à jour, la main passe au closer.",
    };
  }

  // ── Aucun appel encore passé ──
  const first = sorted[0];
  if (!first) {
    return {
      state: "a-appeler",
      callNow: true,
      nextCallAt: now.toISOString(),
      recallsUsed: 0,
      recallsLeft: CALLFLOW_MAX_RECALLS,
      handoffToHuman: false,
      reason: "Premier appel à passer.",
    };
  }

  // ── En cadence : 5 rappels calés sur le PREMIER appel ──
  const t0 = new Date(first.at).getTime();
  const recallsUsed = sorted.length - 1;
  const recallsLeft = plafond.max - recallsUsed;

  if (recallsLeft <= 0) {
    return {
      state: "epuisee",
      callNow: false,
      nextCallAt: null,
      recallsUsed,
      recallsLeft: 0,
      handoffToHuman: true,
      reason: plafond.plafonne
        ? `Plafond atteint (${plafond.max} rappels). ${plafond.pourquoi}`
        : `${plafond.max} rappels sur 2 jours sans réponse — on arrête d'appeler et on repasse à l'humain (autre canal).`,
    };
  }

  const nextAt = new Date(t0 + CALLFLOW_RECALL_OFFSETS_H[recallsUsed] * H);
  const due = nextAt.getTime() <= now.getTime();
  return {
    state: due ? "en-cadence" : "attente",
    callNow: due,
    nextCallAt: nextAt.toISOString(),
    recallsUsed,
    recallsLeft,
    handoffToHuman: false,
    reason: due
      ? `Rappel ${recallsUsed + 1}/${plafond.max} dû.`
      : `Rappel ${recallsUsed + 1}/${plafond.max} prévu à ${nextAt.toLocaleString("fr-FR")}.`,
  };
}

/** Le planning complet des rappels à partir d'un premier appel (prévisualisation). */
export function plannedRecalls(firstCallAt: string): string[] {
  const t0 = new Date(firstCallAt).getTime();
  return CALLFLOW_RECALL_OFFSETS_H.map((h) => new Date(t0 + h * H).toISOString());
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * UN HUMAIN A-T-IL DÉJÀ EU UN ÉCHANGE AVEC LUI ?
 *
 * ⚠ TROUVÉ EN SE SERVANT DU PRODUIT, PAS EN LE TESTANT.
 *
 * Sur `/controle`, le bloc « Alpha exécute » proposait
 * « Passer le rappel 1/3 (cadence Callflow) » sur LES HUIT fiches — dont
 * Plomberie Fabre, affichée deux blocs plus haut comme « PRÊT À SIGNER —
 * Envoyer le DEVIS », et Paddy's Corner, qui est perdue et en nurture.
 *
 * ── POURQUOI ──
 *
 * La règle ScintIA est écrite en haut de ce module : « dès qu'il répond,
 * Alpha Voice ARRÊTE et passe la main au closer ». `cadenceFor` l'applique
 * correctement — mais sur le seul journal d'APPELS. Or `attemptsFromEvents`
 * ne retient que `kind === "appel"` : une fiche qui a avancé par visite,
 * rendez-vous, démo et remise d'offre n'a AUCUNE tentative enregistrée. Pour
 * la cadence, elle est donc froide, et le plan annonce un premier contact
 * téléphonique à quelqu'un qu'on a vu quatre fois.
 *
 * Ce n'est pas une erreur de `cadenceFor` : c'est la question posée à un seul
 * canal. Le passage de main ne se produit pas « au téléphone », il se produit
 * quand un humain est entré dans la conversation — par n'importe quelle
 * porte. Même structure que `aRefuseTouteRelance` : une seule fonction pour
 * une question qui se posait à plusieurs endroits et recevait des réponses
 * différentes.
 *
 * ── CE QUI COMPTE COMME ÉCHANGE, ET CE QUI NE COMPTE PAS ──
 *
 * Un échange à DEUX SENS : visite, rendez-vous, démo, remise d'offre, ou un
 * appel auquel il a répondu. Un email envoyé, un message LinkedIn, un
 * WhatsApp, une note interne ne comptent pas : ce sont des touches sortantes,
 * elles ne prouvent aucune réponse. C'est exactement la prudence de
 * `attemptsFromEvents` (« en cas de doute, sans-reponse ») appliquée ici :
 * se tromper dans ce sens fait dormir un dossier, se tromper dans l'autre
 * fait rappeler quelqu'un qui nous a déjà reçus.
 * ─────────────────────────────────────────────────────────────────────
 */
/**
 * « Il a décroché / répondu », lu dans le résumé écrit à la main.
 *
 * ⚠ Ce motif vivait dans `lib/master-rappel.ts`. Il descend ici parce que
 * « a-t-il répondu ? » est une question de CADENCE — c'est elle qui s'arrête
 * dessus. Deux définitions du même test finissent toujours par diverger, et
 * ici diverger veut dire : rappeler quelqu'un qui a déjà décroché.
 */
export const REPONSE_DANS_LE_RESUME =
  /r[ée]pond|a rappel[ée]|rappelle|d[ée]croch|[ée]chang|discut|vu (?:à|a) \d|visite|rdv obtenu|accord/i;

const ECHANGE_DEUX_SENS = new Set(["visite", "meeting", "demo", "offre"]);

export function humainDejaEnLigne(p: {
  events?: { kind: string; summary?: string }[];
}): boolean {
  return (p.events ?? []).some(
    (e) => ECHANGE_DEUX_SENS.has(e.kind) || (e.kind === "appel" && REPONSE_DANS_LE_RESUME.test(e.summary ?? ""))
  );
}
