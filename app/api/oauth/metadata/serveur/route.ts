import { origineDe } from "@/lib/autoriser-appelant";
import { metadonneesServeur, secretOAuth } from "@/lib/mcp-oauth";
import { jsonOAuth, optionsOAuth } from "@/lib/oauth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RFC 8414 — servi aussi sur `/.well-known/oauth-authorization-server`. */
export function GET(req: Request) {
  if (!secretOAuth()) return jsonOAuth({ error: "oauth_indisponible" }, 404);
  return jsonOAuth(metadonneesServeur(origineDe(req)));
}

export const OPTIONS = optionsOAuth;
