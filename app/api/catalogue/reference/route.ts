import { NextResponse, type NextRequest } from "next/server";
import { commissionFor } from "@/lib/accounts-commercial";
import { resoudreDroits } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA RÉFÉRENCE D'UN DEAL — servie, jamais embarquée.
 *
 * Le calculateur a besoin du taux de référence, du plancher éventuel et des
 * LEVIERS qui permettent de le remonter. Tout ça vit dans
 * `lib/accounts-commercial.ts`, qui ne descend pas dans le navigateur : ces
 * leviers décrivent notre rapport de force avec un partenaire, en clair.
 *
 * ⚠ « INTERNE » NE VOULAIT DIRE QUE « PAS DANS LE BUNDLE ». MESURÉ EN RÉEL :
 * avec les comptes actifs et un jeton d'un email non-maître, un POST
 * `{"accountId":"nuwacom","amountHT":60000}` rendait 200 et, mot pour mot :
 *
 *   « PLANCHER 15 % : on passe la main sur la technique juste après la
 *     vision. On n'a plus de prise, on prend le minimum. »
 *   « Le contrat se dresse APRÈS le cadrage […]. Ne rien signer avant. »
 *
 * L'en-tête ci-dessus disait déjà que ces leviers « décrivent notre rapport
 * de force avec un partenaire, en clair » — et la route les servait à tout
 * locataire, Nuwacom compris s'il en est un. C'est notre main retournée sur
 * la table, avant le cadrage qui est censé être le levier.
 *
 * Le calculateur de deal est un outil OPÉRATEUR : le refus ne casse rien,
 * `useReference` retombe sur `null` et l'écran affiche le deal sans
 * comparaison — ce qu'il fait déjà quand le réseau tombe.
 *
 * Route INTERNE : porte d'accès + même origine (voir middleware, /api/catalogue).
 * ─────────────────────────────────────────────────────────────────────
 */
export async function POST(req: NextRequest) {
  // En mode solo (aucun système de comptes configuré), le droit rendu est
  // maître : l'usage d'aujourd'hui ne change pas.
  const droits = await resoudreDroits(req);
  if (!droits.maitre) {
    return NextResponse.json({ error: "Réservé au compte propriétaire.", code: "maitre_requis" }, { status: 403 });
  }

  let body: { accountId?: string; amountHT?: number; offeringKey?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const reference = commissionFor(body.accountId?.trim() || "eagleye", {
    amountHT: typeof body.amountHT === "number" ? body.amountHT : 0,
    offeringKey: body.offeringKey,
  });

  return NextResponse.json({ reference });
}
