import { NextRequest, NextResponse } from "next/server";
import { llmsTxt } from "@/lib/mission-assistant";

/**
 * `/llms.txt` — ce qu'un assistant IA lit en arrivant sur le domaine
 * (`lib/mission-assistant.ts`). Public : les `.txt` échappent au middleware, et
 * le texte ne porte aucune donnée — seulement la façon de travailler dans ALPHA.
 * La base est l'ORIGINE servie : un assistant arrivé sur un déploiement de
 * prévisualisation ne doit pas être renvoyé vers un autre domaine.
 */
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return new NextResponse(llmsTxt(req.nextUrl.origin), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
