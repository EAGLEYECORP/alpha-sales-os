import { FIXED_COSTS, computeCosts } from "./voice-costs";
import { OFFRES, type OffrePublique } from "./offres-publiques";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA MARGE D'UNE OFFRE — module SERVEUR, volontairement séparé.
 *
 * `lib/offres-publiques.ts` porte les prix ; ce fichier porte ce qu'ils nous
 * laissent. La séparation n'est pas cosmétique : la grille de prix s'affiche
 * dans le navigateur, le coût de revient JAMAIS. Les deux vivaient dans le
 * même module et un test de fuite l'a attrapé avant la mise en ligne.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface MargeOffre {
  offreId: string;
  prixHT: number | null;
  /** Coût des appels inclus, fixe mutualisé COMPRIS. */
  coutCompletEur: number;
  /** Coût du client SUPPLÉMENTAIRE : le fixe est déjà payé par les autres. */
  coutMarginalEur: number;
  margeMarginaleEur: number | null;
  margeMarginalePct: number | null;
  /** Le volume d'appels à partir duquel l'offre devient déficitaire. */
  seuilPerteAppels: number | null;
  phrase: string;
}

/**
 * La marge d'une offre au plafond annoncé — et le volume qui la ferait basculer.
 *
 * Deux coûts, et la distinction n'est pas cosmétique :
 *  · le coût COMPLET inclut les 57 €/mois d'hébergement. C'est le bon chiffre
 *    pour juger le PREMIER client, celui qui paie l'infra à lui seul ;
 *  · le coût MARGINAL les exclut, parce qu'ils sont déjà payés. C'est le bon
 *    chiffre pour juger le client suivant — et c'est celui qui décide si on
 *    peut vendre l'offre en volume.
 */
export function margeOffre(o: OffrePublique): MargeOffre {
  const fixe = FIXED_COSTS.reduce((s, f) => s + f.eurPerMonth, 0);

  if (!o.voixIncluse || !o.appelsInclus) {
    const marginal = 0;
    return {
      offreId: o.id,
      prixHT: o.prixHT,
      coutCompletEur: fixe,
      coutMarginalEur: marginal,
      margeMarginaleEur: o.prixHT,
      margeMarginalePct: o.prixHT ? 100 : null,
      seuilPerteAppels: null,
      phrase:
        `${o.nom} — sans appels composés, le coût marginal est nul (hébergement mutualisé). ` +
        `Le prix ne se déduit d'aucun coût : il vient de la valeur.`,
    };
  }

  const cout = (appels: number) =>
    computeCosts(
      { calls: appels, answerRatePct: 30, avgMinutesAnswered: 2.85, avgMinutesUnanswered: 0.4 },
      0
    ).totalEur;

  const coutCompletEur = Math.round(cout(o.appelsInclus) * 100) / 100;
  const coutMarginalEur = Math.round((coutCompletEur - fixe) * 100) / 100;

  const margeMarginaleEur = o.prixHT === null ? null : Math.round((o.prixHT - coutMarginalEur) * 100) / 100;
  const margeMarginalePct =
    o.prixHT && margeMarginaleEur !== null ? Math.round((margeMarginaleEur / o.prixHT) * 100) : null;

  // À partir de combien d'appels le prix ne couvre plus le coût complet ?
  let seuilPerteAppels: number | null = null;
  if (o.prixHT !== null) {
    for (let n = o.appelsInclus; n <= 50_000; n += 100) {
      if (cout(n) > o.prixHT) {
        seuilPerteAppels = n;
        break;
      }
    }
  }

  const phrase =
    o.prixHT === null
      ? `${o.nom} — sur devis : le volume se fixe au cadrage, la marge aussi.`
      : `${o.nom} — ${o.appelsInclus} appels inclus coûtent ${coutMarginalEur} € en marginal ` +
        `(${coutCompletEur} € fixe compris). À ${o.prixHT} €, marge marginale ${margeMarginaleEur} € ` +
        `(${margeMarginalePct} %).` +
        (seuilPerteAppels
          ? ` ⚠ L'offre devient déficitaire vers ${seuilPerteAppels} appels — d'où le plafond écrit.`
          : " Aucun volume testé jusqu'à 50 000 appels ne la rend déficitaire.");

  return {
    offreId: o.id,
    prixHT: o.prixHT,
    coutCompletEur,
    coutMarginalEur,
    margeMarginaleEur,
    margeMarginalePct,
    seuilPerteAppels,
    phrase,
  };
}

