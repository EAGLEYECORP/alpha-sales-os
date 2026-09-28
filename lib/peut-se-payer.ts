import type { Prospect } from "./types";
import { isDemoProspect } from "./seed";
import { offrePourBrique } from "./verrous";

/**
 * ─────────────────────────────────────────────────────────────────────
 * « TU GAGNES ASSEZ POUR TE LE PAYER. » — et seulement quand c'est vrai.
 *
 * L'idée est juste : quelqu'un qui a signé 4 000 €/mois grâce au CRM gratuit
 * peut s'offrir un abonnement à 149 €. Le lui dire au bon moment vaut mieux
 * que dix bandeaux « passez au premium » servis à quelqu'un qui n'a encore
 * rien vendu — ceux-là n'obtiennent rien et abîment le produit.
 *
 * ══ CE QUI REND CE MODULE DANGEREUX, ET LES TROIS RÈGLES QUI S'ENSUIVENT ══
 *
 * Un module qui dit « tu peux te le payer » est un module qui affirme quelque
 * chose sur l'argent de quelqu'un d'autre. Se tromper ici ne produit pas un
 * bug : ça produit une relance déplacée, sur la base d'un chiffre faux, chez
 * une personne qui saura mieux que nous que c'est faux.
 *
 * 1. **ZÉRO DONNÉE → ZÉRO CHIFFRE.** Pas de fiche signée : `source: "aucune"`,
 *    `valeur: null`, et rien ne s'affiche. Surtout pas « 0 € signé », qui se
 *    lit comme un constat d'échec alors que c'est un angle mort — l'inscrit
 *    n'a peut-être simplement rien saisi.
 *
 * 2. **LES FICHES DE DÉMO NE COMPTENT PAS.** Elles portent 0 € (c'est voulu,
 *    voir `lib/demo-icp.ts`), mais on les exclut quand même explicitement :
 *    le jour où quelqu'un leur remettra des montants « pour voir joli », ce
 *    module se mettrait à annoncer un revenu imaginaire, et la seule trace
 *    serait un bandeau qui félicite l'inscrit pour de l'argent qu'il n'a pas.
 *
 * 3. **C'EST SON CHIFFRE, PAS NOTRE MESURE.** Le montant vient de ce que
 *    l'opérateur a TAPÉ dans ses propres fiches. Nous n'avons vérifié aucun
 *    encaissement. Le message doit donc dire « d'après tes fiches », jamais
 *    « tu as gagné » — la nuance est toute la différence entre un rappel
 *    utile et une affirmation qu'on ne peut pas soutenir.
 *
 * ══ ET LE SEUIL ══
 *
 * ⚠ Il est à **dix fois** le prix mensuel, et c'est une DÉCISION, pas une
 * mesure — aucune vente ne l'a validé. Le raisonnement : à 3×, l'abonnement
 * pèse un tiers de ce qui rentre et la proposition est agressive ; à 10 %,
 * elle ne se discute pas. Le premier inscrit qui refuse en disant pourquoi
 * vaudra plus que ce paragraphe.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Combien de fois le prix mensuel il faut avoir signé pour qu'on en parle. */
export const MULTIPLE_SEUIL = 10;

export interface SignalAbonnement {
  /** D'où vient le chiffre. `aucune` = on ne sait pas, et on le dit. */
  source: "fiches-signees" | "aucune";
  /** Le revenu mensuel récurrent signé, d'après SES fiches. `null` si aucune. */
  mrrSigne: number | null;
  /** Combien de fiches signées le composent — un total sans dénominateur ne veut rien dire. */
  fiches: number;
  /** Faut-il proposer quelque chose ? */
  proposer: boolean;
  /** L'offre proposée, si `proposer`. */
  offreId: string | null;
  prixMensuel: number | null;
  /** La phrase à afficher. Vide si `proposer` est faux. */
  message: string;
}

const RIEN: SignalAbonnement = {
  source: "aucune",
  mrrSigne: null,
  fiches: 0,
  proposer: false,
  offreId: null,
  prixMensuel: null,
  message: "",
};

/**
 * Le signal, calculé depuis le pipe de l'opérateur.
 *
 * @param prospects ses fiches
 * @param possedees les briques qu'il a déjà — on ne propose pas ce qu'il a
 * @param brique    la brique qu'on lui proposerait
 */
export function signalAbonnement(
  prospects: readonly Prospect[],
  possedees: readonly string[],
  brique = "alpha-voice"
): SignalAbonnement {
  // Il l'a déjà : il n'y a rien à proposer, et le lui proposer quand même
  // serait le signe le plus sûr qu'on ne regarde pas son compte.
  if (possedees.includes(brique)) return RIEN;

  /**
   * ⚠ « signé » ET « pas une fiche de démo ». Les deux conditions, pas une.
   * Voir la règle 2 en tête de fichier : les fiches inventées portent 0 €
   * aujourd'hui, et rien ne garantit qu'elles le porteront toujours.
   */
  const signees = prospects.filter((p) => p.stage === "signe" && !isDemoProspect(p.id));
  if (!signees.length) return RIEN;

  const mrrSigne = signees.reduce((s, p) => s + (p.monthlyValue || 0), 0);
  // Des fiches signées sans montant, c'est encore un angle mort : on ne sait
  // toujours pas ce qu'il gagne. Zéro donnée, zéro chiffre.
  if (mrrSigne <= 0) return { ...RIEN, fiches: signees.length };

  const offre = offrePourBrique(brique);
  const prix = offre?.prixHT ?? null;
  const base: SignalAbonnement = {
    source: "fiches-signees",
    mrrSigne,
    fiches: signees.length,
    proposer: false,
    offreId: offre?.id ?? null,
    prixMensuel: prix,
    message: "",
  };
  if (!offre || prix === null || prix <= 0) return base;
  if (mrrSigne < prix * MULTIPLE_SEUIL) return base;

  const part = Math.round((prix / mrrSigne) * 100);
  return {
    ...base,
    proposer: true,
    /**
     * ⚠ « D'APRÈS TES FICHES », et la nuance n'est pas de la modestie.
     * Nous n'avons vérifié aucun encaissement : ce montant est ce qu'il a
     * tapé lui-même. Écrire « tu gagnes 4 000 €/mois » à quelqu'un dont deux
     * clients n'ont pas payé, c'est perdre toute crédibilité sur la seule
     * phrase où on lui demande de l'argent.
     */
    message:
      `D'après tes fiches, tu as signé ${mrrSigne.toLocaleString("fr-FR")} €/mois sur ${signees.length} client(s) — ` +
      `avec la partie gratuite. ${offre.nom} coûte ${prix.toLocaleString("fr-FR")} €/mois, soit ${part} % de ce montant.`,
  };
}
