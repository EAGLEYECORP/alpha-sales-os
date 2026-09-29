import { estMaitre } from "@/lib/entitlements";
import { CodesUtilises, echangerJeton, secretOAuth } from "@/lib/mcp-oauth";
import { jsonOAuth, lireFormulaire, optionsOAuth } from "@/lib/oauth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refus de réutilisation des codes, PAR INSTANCE. Entre deux instances
 * serverless, ce n'est pas garanti — limite écrite dans `lib/mcp-oauth.ts`.
 * Ce qui tient quand même : 60 s de vie et le vérificateur PKCE.
 */
const CODES = new CodesUtilises();

/**
 * RFC 6749 §3.2. Échange d'un code (PKCE) ou rafraîchissement. Les erreurs
 * suivent les codes de la RFC — `invalid_grant` en particulier : Claude s'en
 * sert pour savoir qu'il doit recommencer la connexion au lieu de réessayer.
 */
export async function POST(req: Request) {
  const secret = secretOAuth();
  if (!secret) return jsonOAuth({ error: "temporarily_unavailable", error_description: "OAuth non configuré." }, 503);

  const f = await lireFormulaire(req);
  const r = echangerJeton(f, { secret, maintenant: new Date(), estMaitre, codes: CODES });
  if (!r.ok) return jsonOAuth({ error: r.erreur, error_description: r.description }, r.erreur === "invalid_client" ? 401 : 400);
  return jsonOAuth(r.valeur);
}

export const OPTIONS = optionsOAuth;
