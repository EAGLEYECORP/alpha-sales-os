import { NextRequest, NextResponse } from "next/server";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Garde-fous réseau (défense en profondeur) sur /api/* :
 *
 *  1. Anti-CSRF / anti-abus : les endpoints INTERNES (envoi, IA, agent,
 *     preview, stats) n'acceptent que des requêtes MÊME ORIGINE. Un site
 *     tiers ne peut pas déclencher d'envoi d'email ni consommer l'IA.
 *  2. Rate-limit par IP : borne un pic de requêtes (anti-DoS/scraping).
 *
 * Volontairement laissés OUVERTS (appelés hors navigateur / cross-origin) :
 *   /api/track/open, /api/track/click  → chargés par les clients mail
 *   /api/unsubscribe                   → One-Click RFC 8058 (POST de Gmail)
 *   /api/webhooks/inbound              → fournisseurs (protégé par secret)
 *   /api/health                        → sonde
 *
 * Les en-têtes de sécurité globaux sont posés dans next.config.ts.
 * ─────────────────────────────────────────────────────────────────────
 */

const INTERNAL = [
  "/api/send",
  "/api/ai",
  "/api/agent",
  "/api/sparring", // consomme l'IA — même origine uniquement
  "/api/audit/extract", // consomme l'IA — même origine uniquement
  "/api/email/preview",
  "/api/import/sheet", // fetch sortant (allowlist Google) — pas un proxy public
  "/api/track/stats",
  "/api/track/contacted",
  "/api/crm/patch",
];

function isInternal(path: string): boolean {
  return INTERNAL.some((p) => path === p || path.startsWith(p + "/"));
}

// Rate-limit mémoire (par instance). Fenêtre glissante simple par IP.
const hits = new Map<string, { count: number; start: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 240;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.start > WINDOW_MS) {
    hits.set(ip, { count: 1, start: now });
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
    }
    return false;
  }
  e.count += 1;
  return e.count > MAX_PER_WINDOW;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessaie dans un instant." },
      { status: 429, headers: { "retry-after": "30" } }
    );
  }

  if (isInternal(pathname)) {
    // Sec-Fetch-Site : posé par les navigateurs modernes. On refuse le cross-site.
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
      return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
    }
    // Repli : si un Origin est présent, il doit correspondre à l'hôte.
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== (req.headers.get("host") ?? "")) {
          return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Origine invalide." }, { status: 400 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
