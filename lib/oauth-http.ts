/**
 * En-têtes communs des endpoints OAuth publics.
 *
 * · `no-store` : un jeton ou une métadonnée dérivée de l'hôte ne doit jamais
 *   dormir dans un cache partagé (RFC 6749 §5.1 l'exige pour /token).
 * · CORS ouvert : ces endpoints ne lisent AUCUN cookie — un client public
 *   s'authentifie par PKCE, pas par une session du navigateur. Ouvrir l'origine
 *   n'ouvre donc aucune porte, et permet aux clients MCP qui tournent dans un
 *   navigateur de faire la découverte.
 */
export const ENTETES_OAUTH: Record<string, string> = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
};

export function jsonOAuth(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...ENTETES_OAUTH, "Content-Type": "application/json" },
  });
}

/** Réponse de pré-vol CORS. */
export function optionsOAuth(): Response {
  return new Response(null, { status: 204, headers: ENTETES_OAUTH });
}

/**
 * Lit un corps `application/x-www-form-urlencoded` (exigé par RFC 6749 §4.1.3
 * et envoyé par Claude) — ou JSON, que certains clients envoient quand même.
 */
export async function lireFormulaire(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  const texte = await req.text();
  if (type.includes("application/json")) {
    try {
      const v: unknown = JSON.parse(texte);
      if (!v || typeof v !== "object") return {};
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "string") as [string, string][],
      );
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(texte));
}
