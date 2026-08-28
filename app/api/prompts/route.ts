import { NextResponse, type NextRequest } from "next/server";
import { PROMPTS } from "@/lib/prompts";
import { TEXTES_LIVRES } from "@/lib/prompts-textes";
import { resoudreDroits } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES TEXTES DE PROMPT — servis, jamais embarqués.
 *
 * ⚠ CETTE ROUTE EXISTE PARCE QUE LE GARDE DE FUITE A MORDU.
 *
 * Le registre `lib/prompts.ts` portait d'abord le texte livré de chaque
 * prompt. L'écran `/prompts` étant un composant CLIENT, `vitrine-fuite`
 * a immédiatement signalé que `lib/business-rules` repartait dans un fichier
 * `_next/static/**` — c'est-à-dire téléchargeable par n'importe qui, sans
 * cookie, mot de passe actif ou non.
 *
 * Ce que la doctrine récite : la grille par brique, le prix du pack,
 * l'escalier avec le taux de CHAQUE compte. Exactement la fuite que ce dépôt
 * a déjà fermée trois fois (`lib/accounts`, `lib/knowledge`,
 * `lib/business-rules`). La quatrième serait passée par un écran d'édition.
 *
 * La distinction est celle de `/api/catalogue` : une ROUTE se garde, un CHUNK
 * ne se garde pas.
 *
 * ── POURQUOI RÉSERVÉ AU MAÎTRE ──
 *
 * Une session authentifiée n'est pas nous : dans le portefeuille white-label,
 * un locataire peut être ScintIA ou Nuwacom. Les prompts nomment les taux et
 * le seuil des 40 k — c'est le même raisonnement que pour
 * `ACCOUNTS_COMMERCIAL`, et il s'arrête au même endroit.
 *
 * En solo (aucun système de comptes configuré), `resoudreDroits` rend le droit
 * SOLO, qui est maître : l'usage d'aujourd'hui ne bouge pas.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
  const droits = await resoudreDroits(req);
  if (!droits.maitre) {
    return NextResponse.json(
      { error: "Réservé au compte maître : les prompts récitent l'offre et les taux du portefeuille." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    prompts: PROMPTS.map((p) => ({
      id: p.id,
      // Un identifiant du registre sans texte livré serait inéditable : c'est
      // la seule chose que le navigateur ne peut pas déduire.
      defaut: TEXTES_LIVRES[p.id] ?? "",
    })),
  });
}
