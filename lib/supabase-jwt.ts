// ─────────────────────────────────────────────────────────────────────
// Vérification serveur d'un JWT Supabase — edge-safe, sans dépendance.
//
// Le middleware ne peut PAS lire le localStorage (où Supabase range la
// session). On mirroir donc le jeton d'accès dans un cookie (AuthSync côté
// client) et on le VÉRIFIE ici, côté serveur, avant de servir quoi que ce
// soit de sensible.
//
// Vérification HS256 locale via Web Crypto (comme le JWT LiveKit fait main) :
// aucun appel réseau par requête, déterministe, disponible en runtime edge.
// Le secret est le « JWT Secret » du projet (Supabase → Project Settings →
// API → JWT Secret). Si tu as basculé sur les clés de signature asymétriques,
// garde le secret HS256 legacy actif pour cette vérification.
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

/**
 * Vérifie signature (HS256) + expiration d'un JWT Supabase.
 * Renvoie la charge utile si valide, sinon null. Ne jette jamais.
 */
export async function verifySupabaseJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    // En-tête : on n'accepte que HS256 (garde-fou anti « alg: none »).
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64))) as { alg?: string };
    if (header.alg !== "HS256") return null;

    // Signature.
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret) as BufferSource,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(sigB64) as BufferSource,
      enc.encode(`${headerB64}.${payloadB64}`) as BufferSource
    );
    if (!valid) return null;

    // Charge utile + expiration (60 s de marge d'horloge).
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as JwtPayload;
    if (typeof payload.exp === "number" && Date.now() / 1000 > payload.exp + 60) return null;

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
