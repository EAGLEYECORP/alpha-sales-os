import { OFFRES } from "./offres-publiques";
import { TOUS_RELEVES, comparer, type Comparaison, type RelevePrix } from "./marche";

/**
 * ─────────────────────────────────────────────────────────────────────
 * OÙ SE SITUE CHACUNE DE NOS OFFRES — le rapprochement, écrit une fois.
 *
 * ⚠ CE MODULE N'INVENTE AUCUN CALCUL. `comparer()` existe depuis toujours dans
 * `lib/marche.ts`, et il fait le travail. Ce qui manquait était plus bête et
 * plus coûteux : personne ne disait QUELLE offre se compare à QUEL relevé.
 * Sans ce rapprochement, le module de marché est une liste de prix de
 * concurrents que rien ne confronte aux nôtres — donc de la documentation.
 *
 * ══ LE PIÈGE : COMPARER CE QUI N'EST PAS COMPARABLE ══
 *
 * La tentation est de tout rapprocher pour remplir le tableau. Ce serait pire
 * que de laisser des trous : une comparaison bancale se cite en rendez-vous,
 * et se fait démonter par un prospect qui connaît le concurrent mieux que
 * nous.
 *
 * Trois de nos offres N'ONT PAS de référence honnête, et le module le dit au
 * lieu de bricoler :
 *  · `os-complet` est sur devis — il n'a pas de prix à comparer ;
 *  · `business` est un déploiement complet échelonné, pas un abonnement ;
 *  · `lifetime` est un paiement unique — le marché relevé n'en propose aucun,
 *    et le rapprocher d'un mensuel comparerait un capital à un loyer.
 *
 * ⚠⚠ ET LA RÉSERVE VOYAGE AVEC LE CHIFFRE. Le relevé est SECONDAIRE (articles
 * de comparaison, pas les pages de tarifs des éditeurs) et daté. Un écart
 * affiché sans sa réserve devient « le marché est à X » dans la bouche de
 * celui qui l'a lu trois semaines plus tôt.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * L'offre, et le relevé auquel elle se compare honnêtement.
 *
 * ⚠ `null` = aucune comparaison défendable. C'est une réponse, pas un trou :
 * elle empêche la session suivante de « compléter » le tableau.
 */
export const REFERENCE_PAR_OFFRE: Record<string, string | null> = {
  // Un abonnement mensuel d'assistant vocal, en France : la comparaison la
  // plus directe qui existe pour nos deux paliers de voix.
  "voix-essentiel": "agent-vocal-fr-basique",
  "voix-intensif": "secretaire-ia-fr",
  // L'omnicanale répond aussi hors téléphone : le télésecrétariat humain est
  // le seul relevé qui couvre « quelqu'un répond à ta place », tous canaux.
  omnicanal: "telesecretariat-humain",
  // 1 000 appels SORTANTS. Aucun relevé français ne vend ça : les acteurs
  // français font de l'ENTRANT. On se compare donc au marché des agents
  // vocaux à la minute, en sachant que l'unité diffère — d'où la réserve.
  "voix-1000": "secretaire-ia-fr",
  "os-complet": null,
  business: null,
  lifetime: null,
};

export interface PositionOffre {
  offreId: string;
  nom: string;
  /** `null` quand aucune comparaison n'est défendable. */
  comparaison: Comparaison | null;
  /** Pourquoi il n'y en a pas. Vide quand il y en a une. */
  pourquoiPas: string;
}

const POURQUOI_PAS: Record<string, string> = {
  "os-complet": "Sur devis : il n'y a pas de prix à comparer tant que le cadrage n'a pas eu lieu.",
  business:
    "Déploiement complet, encaissé en acompte puis mensualités. Le marché relevé vend des abonnements — comparer les deux mettrait un capital en face d'un loyer.",
  lifetime:
    "Paiement unique. Aucun relevé du marché n'en propose : le rapprocher d'un mensuel ne dirait rien de vrai.",
};

/**
 * Nos offres, situées face au marché.
 *
 * On compare le prix MENSUEL, jamais le setup : les relevés d'abonnement et
 * ceux de mise en service sont deux familles distinctes dans `lib/marche.ts`,
 * et les mélanger produirait un ratio qui ne veut rien dire.
 */
export function positionnerOffres(releves: RelevePrix[] = TOUS_RELEVES): PositionOffre[] {
  return OFFRES.map((o) => {
    const refId = REFERENCE_PAR_OFFRE[o.id];
    const reference = refId ? releves.find((r) => r.id === refId) : undefined;

    if (!reference || o.prixHT === null) {
      return {
        offreId: o.id,
        nom: o.nom,
        comparaison: null,
        pourquoiPas:
          POURQUOI_PAS[o.id] ??
          "Aucune référence de marché rapprochée pour cette offre — mieux vaut un trou qu'une comparaison bancale.",
      };
    }

    return { offreId: o.id, nom: o.nom, comparaison: comparer(o.nom, o.prixHT, reference), pourquoiPas: "" };
  });
}

/**
 * L'ÂGE du relevé, en jours.
 *
 * ⚠ Un relevé de prix ne vieillit pas comme une doctrine : les concurrents
 * changent leurs tarifs sans prévenir. Afficher la comparaison sans son âge
 * laisse citer en rendez-vous un chiffre de l'an dernier — devant quelqu'un
 * qui a la page de tarifs ouverte.
 */
export function ageDuReleve(releveLe: string, maintenant = new Date()): number {
  const d = new Date(releveLe);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((maintenant.getTime() - d.getTime()) / 86_400_000));
}

/** Au-delà, on ne cite plus le relevé sans l'avoir rouvert. */
export const PEREMPTION_JOURS = 90;
