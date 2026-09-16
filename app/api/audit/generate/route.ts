import { NextRequest, NextResponse } from "next/server";
import { moteurIADeLaRequete } from "@/lib/credentials-secret";
import { fetchSiteText, safePublicUrl } from "@/lib/site-fetch";
import { extractAudit } from "@/lib/audit-extract";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Génère un audit COMPLET automatiquement depuis le site du prospect :
 * récupère la page (fetch direct, ou SCRAPE_ENDPOINT pour les sites durs),
 * puis structure via l'IA (même moteur que /api/audit/extract).
 *
 *   POST { url, company?, city?, sector? }
 *   → { data: ExtractedAudit, engine, source } | 400/422/501/502
 *
 * On ne récupère que le site PUBLIC d'un prospect connu (légitime). Garde-fou
 * SSRF dans safePublicUrl. Camoufox/Crawl4AI/Firecrawl se branchent via
 * SCRAPE_ENDPOINT (ils ont besoin d'un navigateur → pas dans l'app).
 */
export async function POST(req: NextRequest) {
  let body: { url?: string; company?: string; city?: string; sector?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const safe = safePublicUrl(body.url ?? "");
  if (!safe) {
    return NextResponse.json({ error: "Donne l'URL du site du prospect (ex. https://…)." }, { status: 400 });
  }

  let site: { text: string; source: string };
  try {
    site = await fetchSiteText(safe);
  } catch (e) {
    return NextResponse.json(
      { error: `Récupération du site impossible : ${e instanceof Error ? e.message : "réseau"}` },
      { status: 502 }
    );
  }
  if (site.text.trim().length < 80) {
    return NextResponse.json(
      { error: "Le site n'a presque pas de texte exploitable (site JS/anti-bot ?). Branche un SCRAPE_ENDPOINT ou colle la recherche à la main." },
      { status: 422 }
    );
  }

  try {
    const { data, engine } = await extractAudit(site.text, body, await moteurIADeLaRequete(req));
    if (data) return NextResponse.json({ data, engine, source: site.source });
    return NextResponse.json({ error: "L'IA n'a pas pu structurer le contenu du site." }, { status: 422 });
  } catch {
    return NextResponse.json(
      { error: "Aucune IA disponible pour structurer — configure un moteur (Ollama/NVIDIA/Anthropic)." },
      { status: 501 }
    );
  }
}
