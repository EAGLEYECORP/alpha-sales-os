import { origineDe } from "@/lib/autoriser-appelant";
import { metadonneesRessource, secretOAuth } from "@/lib/mcp-oauth";
import { jsonOAuth, optionsOAuth } from "@/lib/oauth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 9728 — servi aussi sur `/.well-known/oauth-protected-resource` (réécriture
 * dans `next.config.ts`). C'est la première chose que Claude lit après le 401.
 * Sans secret de signature, on ne l'annonce pas : un serveur d'autorisation qui
 * ne peut rien signer ferait échouer la connexion plus loin, moins lisiblement.
 */
export function GET(req: Request) {
  if (!secretOAuth()) return jsonOAuth({ error: "oauth_indisponible" }, 404);
  return jsonOAuth(metadonneesRessource(origineDe(req)));
}

export const OPTIONS = optionsOAuth;
