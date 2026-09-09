import { NextResponse } from "next/server";
import { RELEVE_LE, RESERVE_GLOBALE } from "@/lib/marche";
import { PEREMPTION_JOURS, ageDuReleve, positionnerOffres } from "@/lib/positionnement";
import {
  JUSTIFICATION_TJM,
  RESERVE_TAUX,
  TAUX_HORAIRE_BAS_EUR,
  TAUX_HORAIRE_EUR,
  TAUX_HORAIRE_HAUT_EUR,
  TJM_RETENU_EUR,
  capaciteAnnuelle,
} from "@/lib/taux-horaire";
import { auditerCatalogue } from "@/lib/pricing-briques";
import { margeOffre } from "@/lib/offres-marge";
import { OFFRES } from "@/lib/offres-publiques";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * NOTRE PRIX EST-IL DÉFENDABLE ? — calculé ici, jamais embarqué.
 *
 * ⚠ POURQUOI UNE ROUTE, ET PAS UN IMPORT DANS L'ÉCRAN.
 *
 * `lib/pricing-briques.ts` et `lib/offres-marge.ts` importent `voice-costs`,
 * qui porte ce que CHAQUE minute nous coûte chez chaque fournisseur. Un
 * composant client qui les importerait embarquerait notre modèle de coût dans
 * un chunk `_next/static/**` — téléchargeable **sans compte**, le middleware
 * ne couvre pas les fichiers statiques.
 *
 * Ce dépôt a déjà payé exactement ça : `components/voice/cost-panel.tsx`
 * importait `voice-costs`, et `usdPerMin` était mesurable dans le build. Un
 * prospect qui lit ça sait de combien il peut nous serrer.
 *
 * L'écran ne reçoit donc que le RÉSULTAT — des euros déjà agrégés et des
 * verdicts — jamais les tarifs unitaires qui les produisent.
 *
 * Route rattachée à `/offre` (`CHEMIN_PAR_API`), donc réservée au maître :
 * c'est notre économie, pas celle du client.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET() {
  /**
   * ⚠ LE BRANCHEMENT QUI MANQUAIT, ET IL TIENT EN UN ARGUMENT.
   *
   * `verdictBrique` exige `tauxHoraireEur` et n'a AUCUN défaut — le commentaire
   * du module dit « c'est à toi de le poser », précisément pour qu'un taux
   * inventé ne se propage pas dans tous les prix du catalogue.
   *
   * Et `lib/taux-horaire.ts` existe pour le poser : `TAUX_HORAIRE_EUR` s'y
   * décrit comme « le nombre que le reste du code attend ». Les deux modules
   * ont été écrits l'un pour l'autre et n'avaient jamais été présentés.
   */
  const catalogue = auditerCatalogue({ tauxHoraireEur: TAUX_HORAIRE_EUR });
  const capacite = capaciteAnnuelle();
  const jours = ageDuReleve(RELEVE_LE);

  return NextResponse.json({
    marche: {
      releveLe: RELEVE_LE,
      ageJours: jours,
      /**
       * ⚠ On ne cache pas un relevé périmé, on le MARQUE. Le retirer
       * laisserait un écran vide qu'on lirait comme « pas de concurrence » ;
       * le laisser nu le ferait citer en rendez-vous comme une mesure du jour.
       */
      perime: jours > PEREMPTION_JOURS,
      reserve: RESERVE_GLOBALE,
      offres: positionnerOffres(),
    },
    taux: {
      horaireEur: TAUX_HORAIRE_EUR,
      basEur: TAUX_HORAIRE_BAS_EUR,
      hautEur: TAUX_HORAIRE_HAUT_EUR,
      tjmEur: TJM_RETENU_EUR,
      justification: JUSTIFICATION_TJM,
      reserve: RESERVE_TAUX,
      capacite,
    },
    catalogue,
    /**
     * La marge par offre. Aucun tarif unitaire ne sort : `margeOffre` rend des
     * euros agrégés et le volume qui ferait basculer l'offre en perte.
     */
    marges: OFFRES.map(margeOffre),
  });
}
