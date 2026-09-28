import { NextRequest, NextResponse } from "next/server";
import { chercheurConfigure, trouverEmail } from "@/lib/email-finder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CHERCHER L'EMAIL D'UN PROSPECT — BYOK, sans crédit Explorium.
 *
 * L'app a le NOM + le DOMAINE (gratuits) ; cette route rend l'email vérifié via
 * la clé Hunter de l'OPÉRATEUR. Coût pour nous : 0 (c'est sa clé, son palier).
 * Elle NE dépense donc PAS chez nous — elle n'entre pas dans `API_QUI_DEPENSENT`.
 *
 * ⚠ Sans clé configurée : 503 explicite, jamais un email inventé. Fail-closed.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
  if (!chercheurConfigure()) {
    return NextResponse.json(
      {
        error: "Chercheur d'emails non configuré.",
        quoiFaire: "Crée une clé gratuite sur hunter.io, pose-la en variable HUNTER_API_KEY, puis relance.",
        code: "finder_absent",
      },
      { status: 503 },
    );
  }
  const p = req.nextUrl.searchParams;
  const first = (p.get("first") ?? "").trim();
  const last = (p.get("last") ?? "").trim();
  const domain = (p.get("domain") ?? "").trim();
  if (!domain || (!first && !last)) {
    return NextResponse.json({ error: "Paramètres requis : domain, et first ou last." }, { status: 400 });
  }
  try {
    const trouve = await trouverEmail({ firstName: first, lastName: last, domain });
    if (!trouve) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, ...trouve });
  } catch (e) {
    return NextResponse.json(
      { error: `Recherche échouée : ${e instanceof Error ? e.message : "inconnu"}` },
      { status: 502 },
    );
  }
}
