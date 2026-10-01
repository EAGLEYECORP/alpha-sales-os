// ─────────────────────────────────────────────────────────────────────
// Vérification serveur d'un JWT Supabase — edge-safe, sans dépendance.
//
// Le middleware ne peut PAS lire le localStorage (où Supabase range la
// session). On mirroir donc le jeton d'accès dans un cookie (AuthSync côté
// client) et on le VÉRIFIE ici, côté serveur, avant de servir quoi que ce
// soit de sensible.
//
// Vérification locale via Web Crypto, disponible en runtime edge :
//  · HS256 (clé legacy) avec le « JWT Secret » du projet ;
//  · ES256 / RS256 (clés de signature asymétriques, défaut des projets
//    Supabase récents) avec la clé PUBLIQUE lue dans le JWKS du projet, mise
//    en cache — aucun secret supplémentaire. Voir l'encadré « panne du
//    01/10/2026 » plus bas.
//
// ⚠ Non vérifié contre un vrai projet Supabase dans l'environnement de build.
// À prouver avec un vrai jeton (docs/PREUVE-RLS.md étend à l'enforcement).
// ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub?: string; // user id
  email?: string;
  exp?: number; // secondes epoch
  role?: string;
}

function base64UrlToBytes(s: string): Uint8Array {
  // base64url → base64, puis atob → octets.
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface OptionsVerif {
  /** URL du JWKS du projet. Par défaut : `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`. */
  jwksUrl?: string;
  /** Injecté par les tests ; `fetch` global sinon. */
  fetchImpl?: typeof fetch;
}

/**
 * ─────────────────────────────────────────────────────────────────────
 * ⚠⚠ LES CLÉS ASYMÉTRIQUES — LA PANNE DU 01/10/2026.
 *
 * Le projet Supabase a basculé sa clé de signature COURANTE sur une clé ECC
 * P-256 (ES256) ; l'ancien secret HS256 est passé « previously used ». Ce
 * vérificateur n'acceptait que HS256 : TOUS les jetons de session étaient
 * rejetés, sans un message. Symptômes mesurés en production : `/moniteur`
 * renvoyé vers `/compte` pour un compte propriétaire, `/api/compte/droits` en
 * 401 (donc un écran qui retombait en « tout ouvert » et ne disait rien), la
 * synchro du pipe « état inconnu ». Une panne, trois symptômes.
 *
 * Les clés asymétriques se vérifient avec la CLÉ PUBLIQUE, publiée par
 * Supabase dans le JWKS du projet : aucun secret de plus à poser. Le JWKS est
 * mis en cache (10 min) et relu une fois, au plus toutes les 60 s, quand un
 * `kid` inconnu arrive — c'est le cas normal juste après une rotation.
 *
 * ⚠ La clé vient EXCLUSIVEMENT du JWKS de NOTRE projet (URL dérivée de
 * l'environnement), jamais de l'en-tête du jeton (`jku`, `jwk`, `x5u` sont
 * ignorés) : un jeton qui apporterait sa propre clé se validerait lui-même.
 * L'algorithme est lié au type de clé : une clé EC n'est utilisée qu'en
 * ES256, une clé RSA qu'en RS256 — pas de confusion d'algorithme possible.
 * ─────────────────────────────────────────────────────────────────────
 */
interface Jwk {
  kid?: string;
  kty?: string;
  crv?: string;
  alg?: string;
  use?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
}

const TTL_JWKS_MS = 10 * 60_000;
const RELECTURE_MIN_MS = 60_000;
const cacheJwks = new Map<string, { cles: Jwk[]; lu: number }>();

function urlJwksParDefaut(): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}/auth/v1/.well-known/jwks.json` : null;
}

async function lireJwks(url: string, f: typeof fetch, forcer: boolean): Promise<Jwk[]> {
  const enCache = cacheJwks.get(url);
  const age = enCache ? Date.now() - enCache.lu : Infinity;
  if (enCache && (age < TTL_JWKS_MS && !forcer)) return enCache.cles;
  if (enCache && forcer && age < RELECTURE_MIN_MS) return enCache.cles;
  try {
    const r = await f(url, { cache: "no-store" });
    if (!r.ok) return enCache?.cles ?? [];
    const j = (await r.json()) as { keys?: Jwk[] };
    const cles = Array.isArray(j.keys) ? j.keys : [];
    cacheJwks.set(url, { cles, lu: Date.now() });
    return cles;
  } catch {
    return enCache?.cles ?? [];
  }
}

async function verifierAsymetrique(
  alg: "ES256" | "RS256",
  kid: string | undefined,
  donnees: Uint8Array,
  signature: Uint8Array,
  opts: OptionsVerif
): Promise<boolean> {
  const url = opts.jwksUrl ?? urlJwksParDefaut();
  if (!url) return false;
  const f = opts.fetchImpl ?? fetch;
  const kty = alg === "ES256" ? "EC" : "RSA";
  const choisir = (cles: Jwk[]) =>
    cles.find((k) => k.kty === kty && (kid ? k.kid === kid : true) && (!k.alg || k.alg === alg) && (!k.use || k.use === "sig"));

  let jwk = choisir(await lireJwks(url, f, false));
  if (!jwk) jwk = choisir(await lireJwks(url, f, true)); // rotation récente
  if (!jwk) return false;

  if (alg === "ES256") {
    if (jwk.crv !== "P-256" || !jwk.x || !jwk.y) return false;
    const cle = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    // JWS ES256 = r||s brut (64 octets), le format qu'attend Web Crypto.
    return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, cle, signature as BufferSource, donnees as BufferSource);
  }
  if (!jwk.n || !jwk.e) return false;
  const cle = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", cle, signature as BufferSource, donnees as BufferSource);
}

/**
 * Vérifie signature (HS256, ES256 ou RS256) + expiration d'un JWT Supabase.
 * Renvoie la charge utile si valide, sinon null. Ne jette jamais.
 */
export async function verifySupabaseJwt(token: string, secret: string, opts: OptionsVerif = {}): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    // En-tête : liste FERMÉE d'algorithmes (garde-fou anti « alg: none »).
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64))) as { alg?: string; kid?: string };
    const enc = new TextEncoder();
    const donnees = enc.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToBytes(sigB64);

    let valid = false;
    if (header.alg === "HS256") {
      // Clé legacy (secret partagé) — toujours acceptée tant qu'elle signe.
      if (!secret) return null;
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secret) as BufferSource,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      valid = await crypto.subtle.verify("HMAC", key, signature as BufferSource, donnees as BufferSource);
    } else if (header.alg === "ES256" || header.alg === "RS256") {
      valid = await verifierAsymetrique(header.alg, header.kid, donnees, signature, opts);
    } else {
      return null;
    }
    if (!valid) return null;

    // Charge utile + expiration (60 s de marge d'horloge).
    //
    // L'expiration est EXIGÉE, pas seulement vérifiée si elle est là. Un jeton
    // sans `exp` valait auparavant pour toujours. La signature couvre bien la
    // charge utile, donc seul l'émetteur légitime peut en produire un — mais
    // le jour où ce secret sert aussi à un autre outil, un jeton sans
    // expiration devient une clé permanente. Fail-closed.
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as JwtPayload;
    if (typeof payload.exp !== "number") return null;
    if (Date.now() / 1000 > payload.exp + 60) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Cookie où AuthSync mirroir le jeton d'accès Supabase (lisible par le middleware). */
export const JWT_COOKIE = "alpha-jwt";

/**
 * L'enforcement serveur est-il demandé ? Opt-in strict via REQUIRE_AUTH, et
 * seulement si le secret de vérification est présent. Sinon : off (le mode
 * local-first / solo n'est jamais impacté).
 */
export function serverAuthEnforced(): boolean {
  const flag = String(process.env.REQUIRE_AUTH ?? "").toLowerCase();
  const on = flag === "1" || flag === "true" || flag === "yes";
  return on && Boolean(process.env.SUPABASE_JWT_SECRET);
}

/** REQUIRE_AUTH demandé mais secret manquant → misconfiguration (fail-closed). */
export function serverAuthMisconfigured(): boolean {
  const flag = String(process.env.REQUIRE_AUTH ?? "").toLowerCase();
  const on = flag === "1" || flag === "true" || flag === "yes";
  return on && !process.env.SUPABASE_JWT_SECRET;
}
