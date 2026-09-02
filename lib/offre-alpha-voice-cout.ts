import { usdPerConversationMinute } from "./voice-costs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE LA GARANTIE NOUS COÛTE — SERVEUR UNIQUEMENT.
 *
 * ⚠ Ce module lit `lib/voice-costs`, donc NOTRE MARGE. Il ne doit JAMAIS
 * être importé par un composant client : `_next/static/**` est exclu du
 * middleware, et le chunk serait téléchargeable par le prospect à qui on
 * vend. Même règle et même raison que `lib/paliers-campagne-cout.ts`.
 *
 * ── POURQUOI CE CHIFFRE EXISTE ──
 *
 * Une garantie ne se décide pas au feeling. « Le setup ne se paie qu'au
 * premier rendez-vous » sonne audacieux ; la vraie question est combien elle
 * coûte quand le client l'active. La réponse tient en quelques euros, et
 * c'est ÇA qui la rend décidable — pas le courage.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Minutes de conversation brûlées avant un premier rendez-vous, en fourchette. */
const APPELS_AVANT_RDV = { optimiste: 17, pessimiste: 60 } as const;
const MINUTES_PAR_APPEL = { optimiste: 2, pessimiste: 2.5 } as const;

/**
 * Le coût réel de la garantie forte, en euros.
 *
 * ⚠ Les deux bornes reposent sur des HYPOTHÈSES non mesurées (30 % de
 * décroché, 20 % d'intérêt qualifié parmi les décrochés — les mêmes que
 * `lib/paliers-campagne.ts`). C'est pour ça qu'on rend une FOURCHETTE et
 * jamais un chiffre unique : un nombre seul se lirait comme une mesure.
 */
export function coutGarantiePremierRdv(): { basEur: number; hautEur: number; reserve: string } {
  const eurMin = usdPerConversationMinute() * 0.92;
  const bas = APPELS_AVANT_RDV.optimiste * MINUTES_PAR_APPEL.optimiste * eurMin;
  const haut = APPELS_AVANT_RDV.pessimiste * MINUTES_PAR_APPEL.pessimiste * eurMin;
  return {
    basEur: Math.round(bas * 100) / 100,
    hautEur: Math.round(haut * 100) / 100,
    reserve:
      "Fourchette, pas mesure : le nombre d'appels avant un rendez-vous repose sur les taux hypothétiques " +
      "(30 % de décroché, 20 % d'intérêt qualifié) que le palier 10 doit justement mesurer. Seul le coût à " +
      "la minute est relevé.",
  };
}

