import { NextResponse } from "next/server";
import { computeCosts, defaultVolume, FIXED_COSTS, FREE_TIERS, FREE_VERDICT, type CallVolumeInput } from "@/lib/voice-costs";
import { outboundPrice } from "@/lib/bricks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE COÛT USINE — calculé, jamais embarqué.
 *
 * `lib/voice-costs.ts` porte ce que CHAQUE minute nous coûte chez chaque
 * fournisseur : LiveKit, Telnyx, Deepgram, le LLM, Fish. C'est notre modèle
 * de coût, donc notre marge, ligne à ligne.
 *
 * Il était importé par `components/voice/cost-panel.tsx`, un composant
 * client — donc compilé dans un chunk téléchargeable (`_next/static/**` est
 * exclu du middleware). Mesuré sur le build : `usdPerMin` et `eurPerMonth`
 * étaient bien là. Un prospect qui lit ça sait exactement de combien il peut
 * nous serrer ; un concurrent sait où nous attaquer sur le prix.
 *
 * Le panneau ne reçoit donc plus que le RÉSULTAT : des montants en euros
 * déjà agrégés, sans les tarifs unitaires qui les produisent.
 *
 * Le chiffre d'affaires est calculé ici aussi (`outboundPrice`), pour la même
 * raison et pour qu'il n'existe qu'UN prix dans tout le produit.
 *
 * Route INTERNE : porte d'accès + même origine (voir middleware).
 * ─────────────────────────────────────────────────────────────────────
 */

/** Borne les entrées : un volume négatif ou absurde ne doit rien casser. */
function sanitize(input: Partial<CallVolumeInput> | undefined): CallVolumeInput {
  const n = (v: unknown, fallback: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fallback;
  return {
    calls: Math.round(n(input?.calls, defaultVolume.calls, 1_000_000)),
    answerRatePct: n(input?.answerRatePct, defaultVolume.answerRatePct, 100),
    avgMinutesAnswered: n(input?.avgMinutesAnswered, defaultVolume.avgMinutesAnswered, 120),
    avgMinutesUnanswered: n(input?.avgMinutesUnanswered, defaultVolume.avgMinutesUnanswered, 120),
  };
}

export async function POST(req: Request) {
  let body: Partial<CallVolumeInput> | undefined;
  try {
    body = (await req.json()) as Partial<CallVolumeInput>;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const volume = sanitize(body);
  const revenueEur = outboundPrice(volume.calls).monthlyHT;
  const breakdown = computeCosts(volume, revenueEur);

  return NextResponse.json({
    volume,
    breakdown,
    // Les coûts fixes sont renvoyés en euros (pas de tarif unitaire à la
    // minute), parce que le panneau les affiche ligne à ligne.
    fixed: FIXED_COSTS.map((f) => ({ label: f.label, eur: f.eurPerMonth })),
    // Les limites du gratuit viennent des pages publiques des fournisseurs :
    // rien de confidentiel, mais elles voyagent avec le reste plutôt que
    // d'obliger le panneau à réimporter le module.
    freeTiers: FREE_TIERS,
    freeVerdict: FREE_VERDICT,
  });
}
