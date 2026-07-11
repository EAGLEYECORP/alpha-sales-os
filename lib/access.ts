/**
 * ─────────────────────────────────────────────────────────────────────
 * Porte d'accès serveur — protège TOUTE l'UI sur un déploiement public.
 *
 * Quand `SITE_PASSWORD` est défini (typiquement sur Vercel), l'app exige
 * le mot de passe avant de servir la moindre page ou route interne. En
 * local (variable absente), la porte est désactivée : tu travailles
 * librement sur `localhost`.
 *
 * Le cookie ne contient PAS le mot de passe : il porte un HMAC-SHA256 du
 * mot de passe (clé) sur une constante. Impossible à forger sans connaître
 * `SITE_PASSWORD`. Web Crypto → fonctionne à la fois en Edge (middleware)
 * et en Node (route API).
 * ─────────────────────────────────────────────────────────────────────
 */

export const ACCESS_COOKIE = "alpha_access";
const TOKEN_MESSAGE = "alpha-access-v1";

function toBase64Url(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Jeton déterministe dérivé du mot de passe — posé en cookie httpOnly. */
export async function accessToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(TOKEN_MESSAGE));
  return toBase64Url(sig);
}

/** Comparaison à temps constant (anti-timing). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
