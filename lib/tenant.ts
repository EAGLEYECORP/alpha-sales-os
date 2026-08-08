import type { NextRequest } from "next/server";
import { JWT_COOKIE, verifySupabaseJwt } from "./supabase-jwt";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Résolution du LOCATAIRE côté serveur.
 *
 * Les tables écrites par le SERVICE ROLE (tracking_messages, inbound_events,
 * crm_records) contournent la RLS : c'est donc la couche route qui doit
 * cantonner chaque écriture/lecture au bon commercial. L'identité vient du
 * même cookie JWT que l'enforcement (AuthSync → middleware) : on la vérifie
 * ici et on renvoie le `user_id`.
 *
 * Rétro-compatibilité : sans compte (mode solo / SUPABASE_JWT_SECRET absent /
 * cookie absent), renvoie null → les routes retombent sur le comportement
 * mono-locataire d'origine (pool unique). Le multi-locataire s'active dès que
 * les comptes sont en place, l'usage solo n'est jamais impacté.
 *
 * ⚠ Une chaîne UUID valide n'est PAS une preuve d'accès : seul un JWT
 * signé (donc vérifié) fixe le locataire. On ne fait jamais confiance à un
 * user_id fourni par le client sans signature.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Locataire courant d'après le JWT signé, ou null si non authentifié. */
export async function getTenantId(req: NextRequest): Promise<string | null> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  const jwt = req.cookies.get(JWT_COOKIE)?.value;
  if (!jwt) return null;
  const payload = await verifySupabaseJwt(jwt, secret);
  return payload?.sub ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Locataire d'un webhook ENTRANT (fournisseur email/WhatsApp) : ces appels
 * n'ont pas de session, ils portent un secret partagé. Le locataire doit donc
 * être fourni explicitement dans l'URL (`?t=<user_id>`) ou le corps
 * (`userId` / `tenant`). On valide juste la FORME UUID — l'attribution reste
 * déclarative (chaque commercial configure SON provider avec SON identifiant).
 * Renvoie null si absent/mal formé : l'événement tombe dans le pool non attribué
 * (comportement mono-locataire), on n'invente jamais un rattachement.
 */
export function tenantFromInbound(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s && UUID_RE.test(s) ? s : null;
}
