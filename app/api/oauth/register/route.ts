import { enregistrerClient, secretOAuth } from "@/lib/mcp-oauth";
import { jsonOAuth, optionsOAuth } from "@/lib/oauth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 7591 — enregistrement dynamique. Claude s'enregistre seul à la première
 * connexion. Rien n'est stocké : l'identifiant rendu porte ses adresses de
 * retour, signées. Seuls les retours de Claude sont acceptés
 * (`redirectAutorise`) : un inconnu peut s'enregistrer, il ne peut pas se
 * faire renvoyer un code ailleurs que chez Claude.
 */
export async function POST(req: Request) {
  const secret = secretOAuth();
  if (!secret) return jsonOAuth({ error: "temporarily_unavailable", error_description: "OAuth non configuré." }, 503);

  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return jsonOAuth({ error: "invalid_client_metadata", error_description: "JSON invalide." }, 400);
  }
  const r = enregistrerClient(corps, secret, new Date());
  if (!r.ok) return jsonOAuth({ error: r.erreur, error_description: r.description }, 400);
  return jsonOAuth(r.valeur, 201);
}

export const OPTIONS = optionsOAuth;
