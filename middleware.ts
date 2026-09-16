import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";
import {
  JWT_COOKIE,
  serverAuthEnforced,
  serverAuthMisconfigured,
  verifySupabaseJwt,
} from "@/lib/supabase-jwt";
import { cleOuvreLeChemin } from "@/lib/credentials";
import {
  autorise,
  comptesActifs,
  deploiementSansSerrure,
  resoudreDroits,
  verrouDeComptesActif,
} from "@/lib/entitlements";
import { CHEMIN_PAR_API } from "@/lib/api-access";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Garde-fous réseau (défense en profondeur) sur TOUTE l'app :
 *
 *  0. PORTE D'ACCÈS : SITE_PASSWORD n'est plus un mur sur TOUTE l'app —
 *     il murait aussi les clients payants, qui n'auront jamais le mot de
 *     passe de notre outil interne. Il garde désormais les surfaces
 *     d'ADMINISTRATION (voir ADMIN_PREFIXES), et le reste tant que la
 *     serrure de remplacement — comptes Supabase + REQUIRE_AUTH — n'est
 *     pas réellement en place. En local (variable absente), porte OFF.
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
  /**
   * Positionnement tarifaire : elle sert le relevé du marché, notre taux
   * horaire et le COÛT de chaque brique (`pricing-briques` et `offres-marge`
   * remontent jusqu'à `voice-costs`). C'est notre marge, agrégée mais
   * lisible — même origine exigée, comme `/api/voice-costs`.
   */
  "/api/positionnement",
  // Studio contenu (posts sociaux) + rendu vidéo : même origine.
  "/api/social",
  "/api/video",
  // Notion : appelée par l'app avec les fiches du store local. Même origine
  // exigée — le jeton Notion donne accès en écriture à un espace de travail.
  "/api/notion",
  // Catalogue et chiffrage : la grille tarifaire ne sort que pour une session
  // authentifiée. C'est ce qui la garde hors des bundles du navigateur.
  "/api/catalogue",
  /**
   * Les TEXTES de prompt. Ils récitent la doctrine — donc l'offre, la grille
   * par brique et le taux de chaque compte. La route les réserve déjà au
   * compte maître ; INTERNE ajoute l'exigence de même origine, comme pour
   * `/api/catalogue` dont elle est le jumeau.
   */
  "/api/prompts",
  // Coût usine d'Alpha Voice : c'est notre marge ligne à ligne. Même
  // traitement que le catalogue — elle ne se calcule que côté serveur, pour
  // une session authentifiée.
  "/api/voice-costs",
  // Socle du Cerveau : c'est le playbook maison en clair (rituels de closing,
  // adresses partenaires, taux par offre). Il ne s'initialise plus depuis le
  // bundle, il se télécharge — pour une session authentifiée seulement.
  "/api/knowledge",
  "/api/sync",
  "/api/references",
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
  /**
   * ⚠ LA PAGE OÙ ON ACHÈTE — et sans elle, personne ne pouvait acheter.
   *
   * Constaté en démarrant le serveur AVEC `SITE_PASSWORD` (le seul cas où ce
   * mur s'active, donc invisible en local) : les boutons d'offre pointaient
   * tous vers `/compte?offre=…`, qui rendait `307 → /gate`. La grille, la
   * route Stripe et l'écran de retour existaient — il manquait la porte.
   *
   * `/souscrire` vit HORS de `(app)` : pas de coquille opérateur, pas de
   * store, aucune donnée client. Elle ne fait qu'afficher des prix déjà
   * publics et poster vers le checkout.
   */
  "/souscrire",
  /**
   * Le checkout : public par NÉCESSITÉ, protégé par sa propre porte.
   *
   * Il exige `getTenant(req)` — donc un JWT Supabase valide — et rend 401
   * sans lui. Le laisser derrière `SITE_PASSWORD` reviendrait à demander à un
   * acheteur le mot de passe de NOTRE application interne pour nous payer.
   * Même raisonnement que `/api/v1` et `/api/mcp` : ce n'est pas un trou,
   * c'est une porte différente, et elle est fermée à clé.
   */
  "/api/billing/checkout",
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

function startsWithAny(path: string, prefixes: readonly string[]): boolean {
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
/**
 * ─────────────────────────────────────────────────────────────────────
 * LES SURFACES D'ADMINISTRATION — celles qui restent derrière le mot de passe.
 *
 * `SITE_PASSWORD` cesse d'être un mur sur TOUTE l'application : il murait
 * aussi les clients payants, qui n'auront jamais le mot de passe de notre
 * outil interne. Il ne garde plus que ce qu'aucun client ne doit voir.
 *
 * Le critère n'est pas « c'est sensible » — presque tout l'est — mais
 * « ça parle de NOTRE économie, pas de la sienne » :
 *   · /payouts : commissions et reversements du portefeuille ;
 *   · /offre   : notre calculateur de marge ;
 *   · /api/sync : la synchro du pipe de l'opérateur.
 * Ces trois-là sont déjà réservés au compte MAÎTRE côté droits
 * (`ACCES_PAR_CHEMIN` leur donne zéro brique) : le mot de passe est la
 * seconde serrure, pas la seule.
 * ─────────────────────────────────────────────────────────────────────
 */
const ADMIN_PREFIXES = ["/payouts", "/offre", "/api/sync"];

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES ROUTES QUI SERVENT NOTRE PATRIMOINE — compte MAÎTRE uniquement.
 *
 * Distinct d'`ADMIN_PREFIXES` : celles-là ne sont pas derrière le mot de
 * passe (un client CONNECTÉ peut y arriver, c'est le problème), elles sont
 * derrière l'identité. Aucune brique ne les achète, parce qu'elles ne
 * contiennent pas le produit — elles contiennent NOUS :
 *
 *   /api/pipeline    → nos fiches réelles (RGPD : données de tiers)
 *   /api/voice-costs → notre modèle de coût, donc notre marge
 *   /api/knowledge   → le playbook maison, les partenaires, les taux
 *   /api/references  → notre bibliothèque de doctrine
 *
 * ⚠ Ne JAMAIS y ajouter une route du produit vendu : le client la paierait
 * et se la verrait refuser. Un test le vérifie dans les deux sens.
 * ─────────────────────────────────────────────────────────────────────
 */
// La liste vit dans lib/api-access.ts : le BYOK la lit aussi.
import { MAITRE_SEULEMENT } from "@/lib/api-access";

/**
 * ⚠ LA GARDE QUI EMPÊCHE D'OUVRIR L'APP PAR INADVERTANCE.
 *
 * Retirer le mur global n'est sûr que s'il existe une autre serrure. Elle
 * existe : comptes Supabase + enforcement serveur du JWT. Mais les deux sont
 * OPT-IN — `comptesActifs()` et `serverAuthEnforced()` sont faux tant que
 * l'environnement n'est pas configuré.
 *
 * Si on levait le mur sans regarder, un déploiement sans comptes se
 * retrouverait ENTIÈREMENT public : `/api/send` envoie de vrais emails,
 * `/api/voice/call` compose de vrais numéros, `/api/ai` brûle des jetons.
 * Le mur ne se lève donc QUE lorsque la serrure de remplacement est
 * réellement en place. Tant qu'elle ne l'est pas, tout reste protégé —
 * exactement comme avant.
 */
// `verrouDeComptesActif` vit dans `lib/entitlements.ts` : l'écran de
// connexion pose la MÊME question, et deux définitions finiraient par donner
// deux réponses — dont une qui ouvre tout.

function exigeMotDePasse(pathname: string): boolean {
  if (startsWithAny(pathname, ADMIN_PREFIXES)) return true;
  return !verrouDeComptesActif();
}

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

  // ── 0. Porte d'accès ────────────────────────────────────────────────
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && !startsWithAny(pathname, PUBLIC_PREFIXES) && exigeMotDePasse(pathname)) {
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
  //
  // ⚠⚠ LE SECOND CAS N'EST PAS UN CONFORT, IL REFERME UN FAIL-OPEN.
  //
  // `deploiementSansSerrure()` — production ET aucun compte ET aucun
  // `SITE_PASSWORD` — fait déjà retomber `resoudreDroits` au socle GRATUIT.
  // C'était juste, calculé, testé… et **le middleware ne le lisait pas** :
  // toute cette garde était derrière `comptesActifs()` seul, donc dans cet
  // état précis AUCUN contrôle de brique ne s'exécutait. Le défaut récurrent
  // du dépôt, sur la porte la plus chère qui existe ici.
  //
  // Mesuré sur un `next start` de production, pas déduit :
  //   · sans comptes et sans mot de passe → `/api/send` et `/api/voice/call`
  //     répondaient 400 (validation du corps), c'est-à-dire qu'ils
  //     ACCEPTAIENT la requête d'un inconnu et ne s'arrêtaient que sur la
  //     forme du payload ;
  //   · avec `SITE_PASSWORD` posé → 401 sur les deux. Le mur tenait, et c'est
  //     lui SEUL qui tenait.
  // La fenêtre dangereuse est donc réelle et datée : le jour où `SMTP_*` est
  // posé sur Vercel mais où les comptes ne le sont pas encore. `/api/send`
  // enverrait de vrais emails depuis notre domaine, pour n'importe qui —
  // et ça ne se voit que sur la réputation du domaine, des semaines plus tard.
  //
  // ⚠ On ne coupe PAS le site pour autant, exactement comme le dit la
  // doctrine du socle : les écrans gratuits restent ouverts, seules les
  // briques qui DÉPENSENT chez nous répondent 403. Une page blanche sur une
  // prod en ligne serait une panne, et on n'en crée pas une pour fermer une
  // faille.
  if ((comptesActifs() || deploiementSansSerrure()) && !startsWithAny(pathname, PUBLIC_PREFIXES)) {
    const droits = await resoudreDroits(req);

    /**
     * ⚠ CE QUI EST À NOUS, ET QU'AUCUNE BRIQUE N'ACHÈTE.
     *
     * Trouvé en séparant les réglages client des réglages opérateur : trois
     * routes servaient NOTRE patrimoine à n'importe quel client qui possédait
     * la brique correspondante.
     *
     *  · `/api/pipeline` → brique « crm ». Sert `pipeline-juillet` et
     *    `prospects-icp` : noms, téléphones et adresses d'entreprises
     *    lyonnaises RÉELLES. Un client Solo pouvait charger notre fichier de
     *    prospection. C'est notre actif commercial, et ce sont des données
     *    personnelles de tiers — donc un sujet RGPD, pas seulement un vol.
     *
     *  · `/api/voice-costs` → brique « alpha-voice ». C'est notre modèle de
     *    coût, notre marge ligne à ligne. Un client Alpha Voice pouvait lire
     *    exactement ce que son abonnement nous rapporte.
     *
     *  · `/api/knowledge` → brique « cerveau ». Le playbook maison : rituels
     *    de closing, adresses des partenaires, taux par offre.
     *
     * Ces trois modules sont précisément ceux que `tests/vitrine-fuite.test.ts`
     * tient hors du bundle du navigateur. On verrouillait la fenêtre en
     * laissant la porte ouverte.
     *
     * `estMaitre()` lit l'email du JETON, jamais un paramètre client.
     */
    if (startsWithAny(pathname, MAITRE_SEULEMENT) && !droits.maitre) {
      return NextResponse.json(
        { error: "Réservé au compte propriétaire.", code: "maitre_requis" },
        { status: 403 }
      );
    }
    // Une route API est jugée sur le chemin de la FONCTIONNALITÉ qu'elle sert,
    // pas sur son propre chemin : /api/voice/call appartient à Alpha Voice.
    const chemin = pathname.startsWith("/api/") ? cheminMetierDeLApi(pathname) : pathname;
    /**
     * ─────────────────────────────────────────────────────────────────
     * ⚠⚠ BYOK — LA SECONDE PORTE, ET ELLE EST DE LA BONNE FORME.
     *
     * Deux chemins ACCORDENT l'accès : la brique achetée, ou la clé que le
     * locataire apporte et paie lui-même. Le refus exige donc que les DEUX
     * échouent.
     *
     * ⚠ Ne jamais transformer ce `||` en `&&` : l'écran de connexion a déjà
     * payé exactement l'inverse — un `&&` là où il fallait un `||` avait
     * rendu la serrure dépendante du trousseau de celui qui entre.
     *
     * ⚠ `cleOuvreLeChemin` rend `false` sur TOUTE panne (base injoignable,
     * clé maître absente, capacité non vérifiée). Une panne ne doit jamais
     * accorder : ce qui est en jeu ici est notre facture.
     * ─────────────────────────────────────────────────────────────────
     */
    const ouvert = autorise(droits, chemin) || (await cleOuvreLeChemin(droits, chemin));
    if (!ouvert) {
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
