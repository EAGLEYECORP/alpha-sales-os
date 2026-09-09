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
    /**
     * ⚠ « PAS DE SESSION » ET « COMPTE SUSPENDU » SONT LE MÊME `statut`, ET
     * CE N'EST PAS UN BUG CÔTÉ SERVEUR.
     *
     * `DROIT_REFUSE` porte `statut: "suspendu"` DÉLIBÉRÉMENT : c'est le
     * discriminant qui empêche une requête sans session d'hériter du socle
     * gratuit (« pas de tenantId = pas de session = pas de plancher »). Cet
     * invariant est juste et ne doit pas bouger.
     *
     * Mais l'écran, lui, lisait ce discriminant comme une PHRASE ADRESSÉE À
     * UN HUMAIN, et affichait « Compte suspendu — l'accès revient dès la
     * régularisation » à quelqu'un qui venait d'arriver et n'avait jamais eu
     * de compte. Constaté en production, sur le premier écran d'un lancement :
     * on annonçait un impayé à un prospect.
     *
     * Une valeur, deux sens. Le serveur garde le sien ; on descend en plus
     * celui dont l'écran a besoin. `session` ne dit rien de secret — il dit
     * seulement si un jeton valide a été présenté.
     */
    session: Boolean(d.tenantId),
    bricks: d.bricks,
    statut: statutEffectif(d),
    essaiJusquA: d.essaiJusquA,
    maitre: d.maitre,
    solo: d.solo,
  });
}
