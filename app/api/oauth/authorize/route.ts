import { estMaitre } from "@/lib/entitlements";
import { emettreCode, estBoucleLocale, secretOAuth, urlDeRetour, validerDemande } from "@/lib/mcp-oauth";
import { verifySupabaseJwt } from "@/lib/supabase-jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CONSENTEMENT, CÔTÉ SERVEUR.
 *
 * La page `/oauth/authorize` est l'écran ; cette route est la décision.
 *  · GET  : valide la demande AVANT d'afficher quoi que ce soit — on ne montre
 *           pas « Autoriser Claude » pour un client altéré.
 *  · POST : approuve ou refuse. L'approbation exige la session Supabase EN
 *           EN-TÊTE (`Authorization: Bearer`), vérifiée par le même
 *           vérificateur HS256 que tout le reste (`verifySupabaseJwt`).
 *
 * ⚠ Session en EN-TÊTE, pas en cookie : un site tiers ne peut pas forger un
 * en-tête, il peut faire envoyer un cookie. Pas de CSRF possible ici.
 * ⚠ Seul un compte MAÎTRE approuve : les outils lisent le pipe de l'opérateur.
 * ─────────────────────────────────────────────────────────────────────
 */

const nonStocke = { "Cache-Control": "no-store" };
const json = (corps: unknown, statut = 200) => Response.json(corps, { status: statut, headers: nonStocke });

function params(source: URLSearchParams | Record<string, unknown>): Record<string, string | undefined> {
  const cles = ["response_type", "client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope", "resource"];
  const out: Record<string, string | undefined> = {};
  for (const k of cles) {
    const v = source instanceof URLSearchParams ? source.get(k) : source[k];
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function GET(req: Request) {
  const secret = secretOAuth();
  if (!secret) return json({ erreur: "OAuth n'est pas configuré sur ce serveur." }, 503);

  const v = validerDemande(params(new URL(req.url).searchParams), secret);
  if (!v.ok) {
    if (v.redirigeable) {
      return json({ redirect: urlDeRetour(v.redirect_uri, { error: v.erreur, error_description: v.description, state: v.state }) });
    }
    return json({ erreur: v.description }, 400);
  }
  return json({
    client: v.demande.client_name,
    retour: new URL(v.demande.redirect_uri).host,
    boucleLocale: estBoucleLocale(v.demande.redirect_uri),
  });
}

export async function POST(req: Request) {
  const secret = secretOAuth();
  const secretJwt = process.env.SUPABASE_JWT_SECRET;
  if (!secret || !secretJwt) return json({ erreur: "OAuth n'est pas configuré sur ce serveur." }, 503);

  let corps: { params?: Record<string, unknown>; decision?: unknown };
  try {
    corps = await req.json();
  } catch {
    return json({ erreur: "JSON invalide." }, 400);
  }

  const v = validerDemande(params(corps.params ?? {}), secret);
  if (!v.ok) {
    if (v.redirigeable) {
      return json({ redirect: urlDeRetour(v.redirect_uri, { error: v.erreur, error_description: v.description, state: v.state }) });
    }
    return json({ erreur: v.description }, 400);
  }

  // Refuser n'exige aucune session : tout le monde peut dire non.
  if (corps.decision === "deny") {
    return json({ redirect: urlDeRetour(v.demande.redirect_uri, { error: "access_denied", state: v.demande.state }) });
  }
  if (corps.decision !== "approve") return json({ erreur: "decision : approve ou deny." }, 400);

  const brut = (req.headers.get("authorization") ?? "").trim();
  const jeton = brut.toLowerCase().startsWith("bearer ") ? brut.slice(7).trim() : "";
  const session = jeton ? await verifySupabaseJwt(jeton, secretJwt) : null;
  const email = session?.email?.trim().toLowerCase();
  if (!email) return json({ erreur: "Session absente ou expirée — reconnecte-toi." }, 401);
  if (!estMaitre(email)) {
    return json({ erreur: "Seul le compte propriétaire peut brancher un agent sur Alpha pour l'instant." }, 403);
  }

  const code = emettreCode(v.demande, email, secret, new Date());
  return json({ redirect: urlDeRetour(v.demande.redirect_uri, { code, state: v.demande.state }) });
}
