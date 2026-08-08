import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";
import {
  JWT_COOKIE,
  serverAuthEnforced,
  serverAuthMisconfigured,
  verifySupabaseJwt,
} from "@/lib/supabase-jwt";

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
  // Endpoints sensibles ajoutés (envoi/dépôt/appel/transcription) : même
  // origine exigée, en plus de la porte d'accès.
  "/api/digest",
  "/api/gmail/draft",
  "/api/transcribe",
  "/api/voice/call",
  "/api/debrief",
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

/**
 * Rate-limit mémoire (par instance), fenêtre glissante par IP.
 *
 * Deux budgets, parce qu'une navigation et une tentative de mot de passe
 * ne se défendent pas de la même façon :
 *
 *  · GÉNÉRAL — une seule page de l'app déclenche ~17 requêtes qui
 *    traversent ce middleware (documents RSC, routes API du tableau de
 *    bord). Avec un budget de 240, un utilisateur légitime était bloqué
 *    dès la 14ᵉ navigation en une minute — ce qui arrive en explorant
 *    avec ⌘K. Mesuré, puis relevé à 1200 (≈ 70 pages/minute).
 *
 *  · PORTE D'ACCÈS — /api/gate est la seule surface de force brute :
 *    budget volontairement bas, indépendant du général.
 */
const hits = new Map<string, { count: number; start: number }>();
const gateHits = new Map<string, { count: number; start: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 1200;
const MAX_GATE_PER_WINDOW = 20;

function bump(map: Map<string, { count: number; start: number }>, ip: string, max: number): boolean {
  const now = Date.now();
  const e = map.get(ip);
  if (!e || now - e.start > WINDOW_MS) {
    map.set(ip, { count: 1, start: now });
    if (map.size > 10_000) {
      for (const [k, v] of map) if (now - v.start > WINDOW_MS) map.delete(k);
    }
    return false;
  }
  e.count += 1;
  return e.count > max;
}

function rateLimited(ip: string, pathname: string): boolean {
  // La porte d'accès porte SON budget en plus du budget général.
  if (pathname === "/api/gate" && bump(gateHits, ip, MAX_GATE_PER_WINDOW)) return true;
  return bump(hits, ip, MAX_PER_WINDOW);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip, pathname)) {
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

  // ── 0bis. Enforcement JWT PAR COMPTE (opt-in REQUIRE_AUTH) ──────────
  // Vérifie côté serveur, sur les API sensibles, que l'appelant a une session
  // Supabase valide (cookie miroir posé par AuthSync). C'est la frontière
  // serveur du multi-locataire : même en contournant le gate client, aucune
  // API de données ne répond sans jeton signé valide. Pages : laissées à
  // SITE_PASSWORD + AuthGate (le formulaire de connexion doit rester joignable).
  const isGatedApi = pathname.startsWith("/api/") && !startsWithAny(pathname, PUBLIC_PREFIXES);
  if (isGatedApi) {
    if (serverAuthMisconfigured()) {
      // REQUIRE_AUTH demandé sans secret de vérification → on refuse plutôt que
      // de servir des données sans pouvoir prouver l'identité (fail-closed).
      return NextResponse.json(
        { error: "Authentification serveur mal configurée (SUPABASE_JWT_SECRET manquant)." },
        { status: 503 }
      );
    }
    if (serverAuthEnforced()) {
      const jwt = req.cookies.get(JWT_COOKIE)?.value ?? "";
      const payload = jwt ? await verifySupabaseJwt(jwt, process.env.SUPABASE_JWT_SECRET as string) : null;
      if (!payload?.sub) {
        return NextResponse.json({ error: "Compte requis — connecte-toi." }, { status: 401 });
      }
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
