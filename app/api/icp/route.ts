import { doctrineOrDefault } from "@/lib/business-rules";
import { NextRequest, NextResponse } from "next/server";
import { runAIJson } from "@/lib/ai-engine";
import { moteurIADeLaRequete } from "@/lib/credentials-secret";
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

  const system = [body.identity?.trim(), icpSystemPrompt(), `Doctrine du compte :\n${clipDoctrine(doctrineOrDefault(body.businessRules))}`]
    .filter(Boolean)
    .join("\n\n");

  /**
   * ⚠ LE REPLI DÉTERMINISTE N'EXISTAIT QUE DANS LE COMMENTAIRE.
   *
   * Mesuré au navigateur en cliquant les boutons des Réglages : `/api/icp`
   * rendait **500**, avec `Aucun moteur IA configuré` dans les logs. Or
   * `runAIJson` ne rend pas `data: null` quand il n'y a pas de moteur — il
   * LÈVE. Sans `try`, l'exception traversait la route.
   *
   * Ça touche exactement l'état d'une installation neuve : pas encore de clé
   * IA. Le client qui vient d'installer voit une erreur serveur là où l'app
   * promet de marcher hors ligne. Les quatre autres routes IA du dépôt
   * (`/ai`, `/brain`, `/debrief`, `/social/draft`) enveloppent toutes leur
   * appel — celle-ci était la seule oubliée.
   *
   * `deriveICP` n'a besoin d'aucun réseau : le squelette part de l'offre du
   * compte. L'IA affine, elle ne conditionne rien.
   */
  try {
    const { data, engine } = await runAIJson<Partial<ICP>>(
      [
        { role: "system", content: system },
        { role: "user", content: icpUserPrompt(offer) },
      ],
      await moteurIADeLaRequete(request),
      { temperature: 0.4, json: true }
    );
    if (data) return NextResponse.json({ icp: mergeICP(offer, data), engine });
  } catch {
    /* pas de moteur, ou moteur muet → squelette ci-dessous */
  }

  return NextResponse.json({ icp: deriveICP(offer), engine: "squelette (hors-ligne)" });
}
