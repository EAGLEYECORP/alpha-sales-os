import { NextResponse } from "next/server";
import { BRICKS, OUTBOUND_TIERS, PACK_SETUP_HT, PACK_MONTHLY_HT, quoteBricks, quoteText, outboundPrice } from "@/lib/bricks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CATALOGUE ET SES PRIX — servis, jamais embarqués.
 *
 * ── LE PROBLÈME QUE CETTE ROUTE RÉSOUT ──
 *
 * `lib/bricks.ts` était importé par des composants CLIENT. Or tout ce
 * qu'un composant client importe est compilé dans un fichier JavaScript
 * que le navigateur télécharge — et `_next/static/**` est explicitement
 * exclu du middleware, donc ces fichiers sont récupérables par n'importe
 * qui, sur n'importe quel déploiement, mot de passe ou pas.
 *
 * Autrement dit : la grille tarifaire complète, le palier remisé et la
 * mention « le 4e millier est offert » étaient publics. Les retirer de
 * l'affichage n'y changeait rien — c'est la mesure du build qui l'a
 * montré, pas une intuition.
 *
 * Depuis cette route, les prix ne quittent le serveur que pour une
 * session authentifiée. `lib/bricks.ts` n'est plus importé par aucun
 * composant client : c'est vérifié par un test, parce qu'un seul import
 * distrait suffirait à tout remettre dans le navigateur.
 *
 * Route INTERNE : porte d'accès + même origine (voir middleware).
 * ─────────────────────────────────────────────────────────────────────
 */

export async function GET() {
  return NextResponse.json({
    bricks: BRICKS,
    outboundTiers: OUTBOUND_TIERS,
    pack: { setupHT: PACK_SETUP_HT, monthlyHT: PACK_MONTHLY_HT },
  });
}

interface DevisRequete {
  /** Ids de briques à chiffrer. */
  bricks?: string[];
  /** Nom du client, pour le texte du devis. */
  client?: string;
  /** Émetteur (white-label) — jamais figé côté serveur. */
  issuer?: string;
  /** Volume d'appels sortants à chiffrer, indépendamment des briques. */
  calls?: number;
}

/**
 * Le chiffrage. Il se fait ICI plutôt que dans le navigateur pour la même
 * raison : calculer côté client suppose d'y avoir la grille.
 */
export async function POST(req: Request) {
  let body: DevisRequete;
  try {
    body = (await req.json()) as DevisRequete;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const ids = Array.isArray(body.bricks) ? body.bricks : [];
  const quote = quoteBricks(ids);
  const texte = ids.length ? quoteText(quote, body.client?.trim() || "(client)", { issuer: body.issuer }) : "";

  return NextResponse.json({
    quote,
    texte,
    ...(typeof body.calls === "number" ? { sortant: outboundPrice(body.calls) } : {}),
  });
}
