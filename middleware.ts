import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";
import {
  JWT_COOKIE,
  serverAuthEnforced,
  serverAuthMisconfigured,
  verifySupabaseJwt,
} from "@/lib/supabase-jwt";
import { autorise, comptesActifs, resoudreDroits } from "@/lib/entitlements";
import { CHEMIN_PAR_API } from "@/lib/api-access";

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
  // Génération d'ICP : elle consomme un jeton LLM par appel et reçoit la
  // doctrine du compte. Même origine exigée, comme les autres surfaces IA.
  "/api/icp",
  "/api/audit/extract",
  "/api/audit/generate",
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
  // Facturation : création de session Checkout / portail par le compte connecté.
  "/api/billing",
  // Studio contenu (posts sociaux) + rendu vidéo : même origine.
  "/api/social",
  "/api/video",
  // Notion : appelée par l'app avec les fiches du store local. Même origine
  // exigée — le jeton Notion donne accès en écriture à un espace de travail.
  "/api/notion",
  // Catalogue et chiffrage : la grille tarifaire ne sort que pour une session
  // authentifiée. C'est ce qui la garde hors des bundles du navigateur.
  "/api/catalogue",
  // Coût usine d'Alpha Voice : c'est notre marge ligne à ligne. Même
  // traitement que le catalogue — elle ne se calcule que côté serveur, pour
  // une session authentifiée.
  "/api/voice-costs",
  // Socle du Cerveau : c'est le playbook maison en clair (rituels de closing,
  // adresses partenaires, taux par offre). Il ne s'initialise plus depuis le
  // bundle, il se télécharge — pour une session authentifiée seulement.
  "/api/knowledge",
  // Jeux de données RÉELS (pipeline juillet, prospects ICP) : noms, adresses
  // et téléphones d'entreprises tierces. C'est ce qui partait dans le bundle ;
  // ça ne doit pas se contenter de la porte d'accès.
  "/api/pipeline",
  // File de propositions : lue et tranchée par l'opérateur connecté.
  "/api/propositions",
];

// Chemins servis même sans cookie d'accès (fonctionnent pour des tiers
// anonymes : clients mail, n8n, sondes) + l'écran de la porte.
const PUBLIC_PREFIXES = [
  "/api/track/open",
  "/api/track/click",
  "/api/webhooks/inbound",
  // Webhook Stripe : appelé par Stripe (aucune session), protégé par signature.
  "/api/webhooks/stripe",
  "/api/health",
  "/gate",
  "/api/gate",
  // Vitrine publique : c'est une page de VENTE, elle doit être lisible sans
  // mot de passe. Aucune donnée client n'y transite (pas de store, pas d'API).
  "/vitrine",
  // API publique v1 : appelée par des tiers (n8n, CRM client) qui n'ont pas
  // le cookie SITE_PASSWORD. Elle porte sa PROPRE authentification par clé
  // (ALPHA_API_KEYS) et refuse tout si aucune clé n'est configurée — ce n'est
  // donc pas un trou, c'est une porte différente.
  "/api/v1",
  // Serveur MCP : un agent externe (Cowork, Claude Code) s'y branche sans
  // navigateur, donc sans cookie. Il porte sa PROPRE authentification par clé
  // avec PORTÉES (ALPHA_API_KEYS) et refuse tout sans clé configurée — même
  // porte que /api/v1, pas un trou.
  //
  // ⚠ Ses outils sont en LECTURE et PROPOSITION uniquement : aucun n'envoie,
  // n'appelle ni ne modifie. C'est ce qui rend acceptable de l'exposer.
  "/api/mcp",
  // Service worker : il DOIT être servi comme du JavaScript, à la racine.
  // Derrière la porte d'accès, le navigateur recevrait la redirection vers
  // /gate — donc du HTML — et l'enregistrement échouerait avec une erreur de
  // type MIME que rien ne relie au mot de passe. Le fichier ne contient
  // aucune donnée : il écoute les notifications, c'est tout.
  "/sw.js",
  // Manifeste PWA : lu avant toute session, et nécessaire pour « ajouter à
  // l'écran d'accueil » — le seul chemin vers les notifications sur iPhone.
  "/manifest.webmanifest",
  // Routes de CRON, appelées par n8n : aucun navigateur, donc aucun cookie
  // d'accès. Elles portent leur PROPRE authentification (CRON_SECRET) et
  // REFUSENT tout si le secret n'est pas configuré — ce n'est pas un trou,
  // c'est une porte différente, comme /api/v1.
  //
  // ⚠ Sans cette entrée, l'ordonnanceur reçoit « Accès non autorisé » dès que
  // SITE_PASSWORD est posé : l'autopilote d'appels et les notifications ne
  // partent jamais, et rien dans la réponse ne relie ça au mot de passe.
  "/api/campaign/tick",
  "/api/push/tick",
  // Flux calendrier : lu par les serveurs de Google/Apple/Microsoft, jamais
  // par un navigateur connecté — donc aucun cookie possible. Il porte son
  // jeton dans l'URL (CALENDAR_TOKEN) et refuse tout sans lui.
  "/api/calendar",
];

/**
 * Le chemin MÉTIER que sert une route API.
 *
 * Sans cette traduction, il faudrait recopier la carte des briques une
 * deuxième fois pour les API — et deux cartes finissent toujours par
 * diverger. Une API non listée retombe sur son propre chemin, donc sur
 * « non classé », donc REFUSÉE : c'est voulu.
 */
function cheminMetierDeLApi(pathname: string): string {
  for (const [prefixe, chemin] of Object.entries(CHEMIN_PAR_API)) {
    if (pathname === prefixe || pathname.startsWith(prefixe + "/")) return chemin;
  }
  return pathname;
}

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

/**
 * Le jeton attendu, dérivé une seule fois par instance.
 *
 * `accessToken` fait un HMAC-SHA256 (importKey + sign). Le middleware tourne
 * sur CHAQUE requête, et une seule page de l'app en déclenche une quinzaine :
 * on recalculait donc le même HMAC quinze fois pour afficher un écran. Le
 * mot de passe ne change pas pendant la vie du processus — on le mémorise,
 * indexé par mot de passe pour rester correct si l'environnement change.
 */
let tokenCache: { password: string; token: string } | null = null;
async function expectedToken(password: string): Promise<string> {
  if (tokenCache?.password === password) return tokenCache.token;
  const token = await accessToken(password);
  tokenCache = { password, token };
  return token;
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
    const expected = await expectedToken(sitePassword);
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

  // ── 0ter. DROITS PAR BRIQUE (vente à la carte) ─────────────────────
  //
  // C'est ici que « il ne voit QUE sa brique » devient vrai. Filtrer la
  // navigation côté client est un confort : le client tape l'URL, ou lit le
  // JavaScript, qui est téléchargeable. La seule barrière est celle-ci.
  //
  // Les API sont gardées AUSSI, et par la même règle : une page bloquée dont
  // l'API répond ne protège rien du tout.
  //
  // En mode solo (aucun système de comptes configuré), `resoudreDroits`
  // renvoie le droit SOLO et rien ne change — l'usage d'aujourd'hui reste
  // intact.
  if (comptesActifs() && !startsWithAny(pathname, PUBLIC_PREFIXES)) {
    const droits = await resoudreDroits(req);
    // Une route API est jugée sur le chemin de la FONCTIONNALITÉ qu'elle sert,
    // pas sur son propre chemin : /api/voice/call appartient à Alpha Voice.
    const chemin = pathname.startsWith("/api/") ? cheminMetierDeLApi(pathname) : pathname;
    if (!autorise(droits, chemin)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Cette fonctionnalité n'est pas incluse dans ton offre.", code: "brique_absente" },
          { status: 403 }
        );
      }
      const url = req.nextUrl.clone();
      url.pathname = "/compte";
      url.search = `?bloque=${encodeURIComponent(pathname)}`;
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
