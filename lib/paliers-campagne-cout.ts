import { PALIERS_CAMPAGNE, type PalierCampagne } from "./paliers-campagne";
import {
  COST_LINES,
  TELNYX_BORNE_HAUTE_USD_MIN,
  computeCosts,
  defaultVolume,
} from "./voice-costs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE COÛTE UN PALIER — module SERVEUR, jamais importé par un écran.
 *
 * ⚠ CE FICHIER EST SÉPARÉ POUR UNE SEULE RAISON, ET ELLE A DÉJÀ COÛTÉ UN BUG.
 *
 * `lib/voice-costs.ts` porte ce que chaque minute nous coûte chez chaque
 * fournisseur — donc notre marge, ligne à ligne. `_next/static/**` est exclu
 * du middleware : tout ce qu'un composant client importe est téléchargeable
 * par n'importe qui. La garde `tests/vitrine-fuite.test.ts` a attrapé cette
 * fuite au moment où le panneau des paliers a voulu afficher un budget.
 *
 * Le calcul reste donc ici, du côté serveur, et ne voyage qu'en RÉSULTAT
 * (des euros agrégés) via `/api/voice-costs` — exactement le motif déjà en
 * place pour `components/voice/cost-panel.tsx`.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface CoutPalierCampagne {
  bas: number;
  haut: number;
  /** Vrai tant que le tarif Telnyx n'est pas mesuré. */
  fourchetteOuverte: boolean;
  phrase: string;
}

export function coutPalierCampagne(palier: PalierCampagne): CoutPalierCampagne {
  const volume = { ...defaultVolume, calls: palier.appels };
  const b = computeCosts(volume, 0);
  const bas = b.variableEur;

  const telnyx = COST_LINES.find((l) => l.id === "telnyx");
  const ligne = b.lines.find((l) => l.id === "telnyx");
  const facteur = telnyx && telnyx.usdPerMin > 0 ? TELNYX_BORNE_HAUTE_USD_MIN / telnyx.usdPerMin : 1;
  const haut = bas + (ligne ? ligne.eur * (facteur - 1) : 0);

  const eur = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: n < 10 ? 2 : 0 })} €`;

  return {
    bas,
    haut,
    fourchetteOuverte: facteur > 1,
    phrase:
      facteur > 1
        ? `${eur(bas)} à ${eur(haut)} de coût fournisseurs. L'écart vient de Telnyx seul, dont le tarif ` +
          `à la minute n'est pas mesuré — c'est ce que l'export CDR ferme.`
        : `${eur(bas)} de coût fournisseurs.`,
  };
}

/**
 * Le budget des trois paliers, prêt à afficher.
 *
 * ⚠ Seul le RÉSULTAT en euros sort d'ici. Les tarifs unitaires qui le
 * produisent (`COST_LINES`) restent côté serveur : ce sont nos marges, et
 * `_next/static/**` est téléchargeable par n'importe qui.
 */
export function budgetPaliers(): { id: string; titre: string; appels: number; cout: CoutPalierCampagne }[] {
  return PALIERS_CAMPAGNE.map((p) => ({
    id: p.id,
    titre: p.titre,
    appels: p.appels,
    cout: coutPalierCampagne(p),
  }));
}
