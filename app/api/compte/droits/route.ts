import { NextRequest, NextResponse } from "next/server";
import { resoudreDroits, statutEffectif } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE CE COMPTE POSSÈDE — pour l'INTERFACE, jamais pour la sécurité.
 *
 * L'app a besoin de savoir quoi afficher : masquer une entrée de menu qui
 * mène à une porte fermée évite de promener le client dans des culs-de-sac.
 *
 * ⚠ Cette route ne décide de RIEN. La barrière est le middleware, et elle
 * reste en place même si quelqu'un ment sur ce qu'il possède. Si un jour on
 * se met à faire confiance à cette réponse pour autoriser quoi que ce soit,
 * on aura reconstruit exactement le trou qu'on vient de fermer.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
  const d = await resoudreDroits(req);
  return NextResponse.json({
    bricks: d.bricks,
    statut: statutEffectif(d),
    essaiJusquA: d.essaiJusquA,
    maitre: d.maitre,
    solo: d.solo,
  });
}
