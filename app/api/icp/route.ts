import { NextRequest, NextResponse } from "next/server";
import { runAIJson } from "@/lib/ai-engine";
import { deriveICP, mergeICP, icpSystemPrompt, icpUserPrompt, type ICP, type OfferInput } from "@/lib/icp";
import { clipDoctrine } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ICP par offre — « le client parfait » déduit de ce que le compte vend.
 * L'IA affine si une clé est là ; sinon repli déterministe (jamais vide).
 * White-label : l'offre vient du compte (settings), pas d'EAGLEYE en dur.
 */
export async function POST(request: NextRequest) {
  let body: { offer?: OfferInput; businessRules?: string; identity?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const offer: OfferInput = body.offer ?? {};

  const system = [body.identity?.trim(), icpSystemPrompt(), body.businessRules?.trim() ? `Doctrine du compte :\n${clipDoctrine(body.businessRules)}` : ""]
    .filter(Boolean)
    .join("\n\n");

  const { data, engine } = await runAIJson<Partial<ICP>>(
    [
      { role: "system", content: system },
      { role: "user", content: icpUserPrompt(offer) },
    ],
    { temperature: 0.4, json: true }
  );

  const icp = data ? mergeICP(offer, data) : deriveICP(offer);
  return NextResponse.json({ icp, engine: data ? engine : "squelette (hors-ligne)" });
}
