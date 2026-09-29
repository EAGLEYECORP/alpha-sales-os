import { autoriserApi, type Portee, type Verdict } from "./api-keys";
import { estMaitre } from "./entitlements";
import { PORTEES_OAUTH, PREFIXE_ACCES, secretOAuth, verifierJetonAcces } from "./mcp-oauth";

/**
 * ─────────────────────────────────────────────────────────────────────
 * QUI APPELLE, AVEC QUELS DROITS — clé d'API OU jeton OAuth.
 *
 * La SEULE fonction que les routes du serveur MCP et de /api/v1 consultent.
 * Deux façons d'entrer, une seule réponse :
 *  · un jeton `amo_…` → le chemin OAuth (connecteur Claude / Cowork) ;
 *  · tout le reste → `autoriserApi`, inchangé (clés `ALPHA_API_KEYS`).
 *
 * ⚠ Le préfixe AIGUILLE, il n'accorde rien : un faux `amo_…` échoue à la
 * signature. Et une clé d'API n'est jamais envoyée au vérificateur OAuth, ni
 * l'inverse — deux secrets qui ne se croisent pas.
 *
 * ⚠ Un jeton OAuth ne porte QUE `PORTEES_OAUTH` (lecture + proposition). Une
 * route qui exige `prospects.write` le refuse en 403, même pour le maître :
 * l'ingestion garde sa propre clé, révocable seule.
 * ─────────────────────────────────────────────────────────────────────
 */
export function autoriserAppelant(
  header: string | null,
  requise: Portee,
  env: Record<string, string | undefined> = process.env,
  maintenant: Date = new Date(),
): Verdict {
  const brut = (header ?? "").trim();
  const jeton = brut.toLowerCase().startsWith("bearer ") ? brut.slice(7).trim() : brut;

  if (!jeton.startsWith(PREFIXE_ACCES)) return autoriserApi(header, requise);

  const secret = secretOAuth(env);
  if (!secret) {
    return { ok: false, statut: 401, erreur: "OAuth fermé.", pourquoi: "Aucun secret de signature côté serveur (OAUTH_SECRET ou SUPABASE_JWT_SECRET)." };
  }
  const v = verifierJetonAcces(jeton, { secret, maintenant, estMaitre });
  if (!v.ok) return { ok: false, statut: 401, erreur: "Jeton refusé.", pourquoi: v.raison };
  if (!PORTEES_OAUTH.includes(requise)) {
    return {
      ok: false,
      statut: 403,
      erreur: "Portée absente.",
      pourquoi: `Un jeton OAuth ne donne que ${PORTEES_OAUTH.join(", ")} — pas ${requise}.`,
    };
  }
  return { ok: true, appelant: { nom: `oauth:${v.email}`, proprietaire: "operateur", portees: [...PORTEES_OAUTH] } };
}

/**
 * L'origine publique vue par le CLIENT — celle qu'il a saisie. Derrière
 * l'hébergeur, l'hôte réel arrive par `x-forwarded-host`.
 */
export function origineDe(req: { url: string; headers: { get(n: string): string | null } }): string {
  const u = new URL(req.url);
  const hote = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || u.host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || u.protocol.replace(":", "");
  return `${proto}://${hote}`;
}
