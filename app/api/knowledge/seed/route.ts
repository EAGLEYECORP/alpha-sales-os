import { NextResponse } from "next/server";
import { SEED_NOTES, DATES_SOCLE_ANTERIEURES } from "@/lib/knowledge-seed";
import { DEFAULT_BUSINESS_RULES } from "@/lib/business-rules";

export const runtime = "nodejs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE SOCLE DU CERVEAU — servi, jamais embarqué.
 *
 * Le playbook (rituels de closing avec les adresses partenaires, prix de
 * setup, taux par offre, seuil de routage) était compilé dans le bundle de
 * chaque page, parce que `lib/store.ts` l'importait pour initialiser le
 * Cerveau. Il descend maintenant par cette route, donc seulement pour une
 * session authentifiée.
 *
 * Route INTERNE : porte d'accès + même origine (voir middleware).
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET() {
  return NextResponse.json({ notes: SEED_NOTES, datesAnterieures: DATES_SOCLE_ANTERIEURES, businessRules: DEFAULT_BUSINESS_RULES });
}
