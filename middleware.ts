import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Garde-fous réseau (défense en profondeur) sur TOUTE l'app :
 *
 *  0. PORTE D'ACCÈS : si SITE_PASSWORD est défini (déploiement public),
 *     rien n'est servi sans le cookie d'accès signé — sauf le strict
 *     nécessaire anonyme (pixel/clic de tracking, webhooks entrants,
 *     sonde, l'écran /gate et son API). En local (variable absente), la
 *     porte est OFF.
 *  1. Anti-CSRF / anti-abus : les endpoints INTERNES n'acceptent que des
 *     requêtes MÊME ORIGINE.
 *  2. Rate-limit par IP : borne un pic de requêtes.
 *
 * Publics par conception (jamais gatés) :
 *   /api/track/open, /api/track/click  → chargés par les clients mail
 *   /api/webhooks/inbound              → fournisseurs (protégé par secret)
 *   /api/health                        → sonde
 *   /gate, /api/gate                   → l'écran d'accès lui-même
 *
 * Les en-têtes de sécurité globaux sont posés dans next.config.ts.
 * ─────────────────────────────────────────────────────────────────────
 */

const INTERNAL = [
  "/api/send",
  "/api/ai",
  "/api/agent",
  "/api/sparring",
  "/api/audit/extract",
  "/api/email/preview",
  "/api/import/sheet",
  "/api/track/stats",
  "/api/track/contacted",
  "/api/crm/patch",
];

// Chemins servis même sans cookie d'accès (fonctionnent pour des tiers
// anonymes : clients mail, n8n, sondes) + l'écran de la porte.
const PUBLIC_PREFIXES = [
  "/api/track/open",
  "/api/track/click",
  "/api/webhooks/inbound",
  "/api/health",
  "/gate",
  "/api/gate",
];

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

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

export async function middleware(req: NextRequest) {
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

  // ── 0. Porte d'accès (déploiement public) ──────────────────────────
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && !startsWithAny(pathname, PUBLIC_PREFIXES)) {
    const cookie = req.cookies.get(ACCESS_COOKIE)?.value ?? "";
    const expected = await accessToken(sitePassword);
    if (!cookie || !safeEqual(cookie, expected)) {
      // API → 401 JSON ; page → redirection vers l'écran d'accès.
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Accès non autorisé." }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/gate";
      url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
  }

  // ── 1. Anti-CSRF même-origine sur les endpoints internes ───────────
  if (isInternal(pathname)) {
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
      return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
    }
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
  // Tout SAUF les assets statiques Next et les fichiers publics à extension.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|txt)$).*)"],
};
