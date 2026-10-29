import { NextRequest, NextResponse } from "next/server";
import { resoudreDroits } from "@/lib/entitlements";
import { CONFIGURATION_ALPHA_VEND_ALPHA } from "@/lib/alpha-vend-alpha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La configuration « ALPHA vend ALPHA », au MAÎTRE seul (`lib/alpha-vend-alpha.ts`).
 *
 * ⚠ Le verdict vient de `resoudreDroits` (serveur), jamais d'un paramètre : un
 * inscrit qui l'appelle reçoit 403 et ne lit ni notre cible ni notre offre. Et
 * la réponse ne porte aucun secret — il n'y en a aucun dans le module.
 */
export async function GET(req: NextRequest) {
  const droits = await resoudreDroits(req);
  if (!droits.maitre) {
    return NextResponse.json({ error: "réservé au compte maître" }, { status: 403 });
  }
  // Le lien de signature = la création de compte, sur le domaine qui a SERVI la
  // requête (jamais une variable : un déploiement de prévisualisation aurait
  // envoyé des prospects vers une adresse jetable).
  const lienSignature = new URL("/compte", req.nextUrl.origin).toString();
  return NextResponse.json(
    { ...CONFIGURATION_ALPHA_VEND_ALPHA, closing: { ...CONFIGURATION_ALPHA_VEND_ALPHA.closing, lienSignature } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
