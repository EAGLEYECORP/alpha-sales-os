import { NextRequest, NextResponse } from "next/server";
import { resoudreDroits } from "@/lib/entitlements";
import { domaineDe, presetPourAdresse, presetPourMx } from "@/lib/identifiants-assistes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * OÙ EST HÉBERGÉE CETTE ADRESSE ? — pour ne demander ni serveur ni port.
 *
 * Un domaine personnel (`contact@monentreprise.fr`) ne dit rien de son
 * hébergeur ; c'est son enregistrement MX qui le dit. Cette route le lit et
 * rend l'IDENTIFIANT d'un hébergeur connu — jamais les noms d'hôtes MX bruts,
 * qui n'ont aucune raison de sortir.
 *
 * ⚠ Elle ne prouve RIEN : elle PROPOSE. Ce qui fait foi est la connexion
 * authentifiée de `POST /api/credentials` (`verifierBoite`).
 *
 * ⚠ SESSION EXIGÉE. Sans elle, c'est un résolveur DNS ouvert au monde, servi
 * depuis notre serveur. Et le domaine est validé AVANT toute requête : une
 * adresse mal formée ne déclenche aucune résolution.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
  const droits = await resoudreDroits(req);
  if (!droits.tenantId) return NextResponse.json({ error: "Connecte-toi." }, { status: 401 });

  const adresse = (req.nextUrl.searchParams.get("adresse") ?? "").trim();
  const domaine = domaineDe(adresse);
  if (!domaine) return NextResponse.json({ presetId: null, source: null });

  const connu = presetPourAdresse(adresse);
  if (connu) return NextResponse.json({ presetId: connu.id, source: "adresse" });

  try {
    const dns = await import("node:dns/promises");
    const mx = await Promise.race([
      dns.resolveMx(domaine),
      new Promise<never>((_, rejette) => setTimeout(() => rejette(new Error("DNS trop lent")), 4_000)),
    ]);
    const p = presetPourMx(mx.sort((a, b) => a.priority - b.priority).map((m) => m.exchange));
    return NextResponse.json({ presetId: p?.id ?? null, source: p ? "mx" : null });
  } catch {
    // Un DNS muet n'est pas une faute de l'inscrit : on ne sait pas, et l'écran demandera le serveur.
    return NextResponse.json({ presetId: null, source: null });
  }
}
