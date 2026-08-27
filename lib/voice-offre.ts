import { OFFRES, type EagleyeOffer } from "./offer-match";
import { getAccount } from "./accounts";

/**
 * ─────────────────────────────────────────────────────────────────────
 * QUELLE OFFRE UN APPEL REPRÉSENTE — et pourquoi on refuse de deviner.
 *
 * ⚠ AVANT, PERSONNE NE POSAIT LA QUESTION. Le script sortant annonçait
 * « proposer un audit de leur accueil téléphonique » — l'angle Callflow —
 * écrit en dur, sur TOUS les appels.
 *
 * Toute la chaîne était pourtant juste : `deepDive` calcule l'offre en la
 * contraignant aux offres autorisées du compte, `briefForScript` l'écrit
 * (« Offre pertinente : … »), et `CallTask` la laissait tomber en route. Sur
 * un prospect routé vers la visibilité, le RÔLE de l'agent disait Callflow
 * pendant que son DOSSIER disait visibilité — deux offres contradictoires
 * dans le même prompt, arbitrées en direct, devant le prospect.
 *
 * ── LES TROIS CAS, DANS CET ORDRE ──
 *
 * 1. L'appelant NOMME l'offre (l'autopilote la tient du deep-dive). On la
 *    vérifie quand même contre les offres autorisées du compte : ScintIA ne
 *    vend QUE Callflow, et un appel passé en son nom ne peut pas proposer
 *    autre chose — même par erreur de l'appelant. La contrainte de compte est
 *    une règle commerciale négociée, pas une préférence d'affichage.
 * 2. Le compte n'en vend qu'UNE. Il n'y a rien à deviner.
 * 3. Sinon → `null`. EAGLEYE porte trois offres ; sans signal, en choisir une
 *    serait inventer.
 *
 * ── POURQUOI `null` PLUTÔT QU'UN REPLI SUR CALLFLOW ──
 *
 * Le repli, c'est exactement ce qui existait, et c'est ce qui a produit le
 * défaut. Proposer la MAUVAISE offre coûte plus cher que de n'en proposer
 * aucune : le prospect vous classe, et c'est la seule des deux erreurs qui ne
 * se rattrape pas au deuxième appel. Sans offre, le script bascule en
 * qualification pure — l'agent comprend, puis passe la main.
 * ─────────────────────────────────────────────────────────────────────
 */
export interface OffreDAppel {
  offre: EagleyeOffer | null;
  /** Ce qu'on répond à l'opérateur qui demande « pourquoi celle-là ? ». */
  pourquoi: string;
}

const connue = (v: string | undefined | null): v is EagleyeOffer =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(OFFRES, v);

export function resoudreOffre(
  demandee: string | undefined | null,
  accountId: string | undefined | null
): OffreDAppel {
  const compte = getAccount(accountId ?? undefined);
  const autorisees = compte.offers;

  if (connue(demandee)) {
    if (autorisees.length && !autorisees.includes(demandee)) {
      return {
        offre: null,
        pourquoi:
          `« ${OFFRES[demandee].label} » n'est pas vendue par ${compte.name}. ` +
          "L'appel qualifie sans rien proposer plutôt que de sortir du périmètre du compte.",
      };
    }
    return { offre: demandee, pourquoi: `Offre retenue pour cette fiche : ${OFFRES[demandee].label}.` };
  }

  if (autorisees.length === 1) {
    return {
      offre: autorisees[0],
      pourquoi: `${compte.name} ne vend que ${OFFRES[autorisees[0]].label} — il n'y a rien à trancher.`,
    };
  }

  return {
    offre: null,
    pourquoi:
      `${compte.name} porte plusieurs offres et l'appel n'en désigne aucune. ` +
      "L'agent qualifie et ne présente rien : proposer la mauvaise offre coûte plus cher que de n'en proposer aucune.",
  };
}
