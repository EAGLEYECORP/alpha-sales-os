import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { attribuer, type CodeApporteur } from "@/lib/apporteur-attribution";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

/**
 * ─────────────────────────────────────────────────────────────────────
 * ENREGISTRER QUI A AMENÉ CE CLIENT — le serveur arbitre, le client transmet.
 *
 * ⚠ LE COMPTE ATTRIBUÉ EST CELUI DU JETON, JAMAIS UN PARAMÈTRE.
 * Accepter un `tenantId` du corps de requête laisserait n'importe qui
 * attribuer n'importe quel compte à n'importe quel apporteur — y compris le
 * sien. C'est la même règle que `estMaitre()` : l'identité se lit dans la
 * session, pas dans ce qu'on nous envoie.
 *
 * Le client n'envoie qu'UNE chose : le code qu'il a vu passer. Tout le reste
 * — le compte, l'existence du code, l'auto-attribution, l'immuabilité — se
 * décide ici, avec `lib/apporteur-attribution.ts` comme seul juge.
 *
 * ⚠⚠ ET L'ATTRIBUTION N'OUVRE RIEN. Cette route n'écrit jamais `bricks` ni
 * `statut` : elle pose deux colonnes qui ne gouvernent aucun accès. Un code
 * d'apport est une chaîne de huit caractères qui se dicte au téléphone ; s'il
 * pouvait ouvrir quoi que ce soit, il serait une clé.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      {
        error: "Supabase n'est pas configuré côté serveur.",
        why: "Sans base, aucune attribution ne peut être enregistrée — et une attribution perdue ne se rattrape pas après coup.",
      },
      { status: 503 }
    );
  }

  const tenant = await getTenantId(req);
  if (!tenant) {
    /**
     * ⚠ 401 ET PAS UN ENREGISTREMENT EN ATTENTE. L'attribution se pose sur un
     * compte ; sans session il n'y a pas de compte, et stocker le code « pour
     * plus tard » côté serveur créerait une file que rien ne viderait. Le
     * navigateur garde déjà le code (`components/capture-parrainage.tsx`) et
     * le renverra une fois la session ouverte — c'est le bon endroit pour
     * l'attente.
     */
    return NextResponse.json(
      { error: "session requise", why: "L'attribution se pose sur un compte connecté, jamais sur un identifiant fourni." },
      { status: 401 }
    );
  }

  let corps: { code?: string };
  try {
    corps = (await req.json()) as { code?: string };
  } catch {
    return NextResponse.json({ error: "corps JSON invalide" }, { status: 400 });
  }

  // L'attribution déjà posée, s'il y en a une. C'est elle qui rend la règle
  // « première attribution gagne » applicable.
  const { data: existant, error: errLecture } = await db
    .from("entitlements")
    .select("apporteur_code")
    .eq("tenant_id", tenant)
    .maybeSingle();

  if (errLecture) {
    return NextResponse.json({ error: "lecture impossible", detail: errLecture.message }, { status: 500 });
  }

  const { data: codes, error: errCodes } = await db
    .from("apporteur_codes")
    .select("code, apporteur_id, actif")
    .eq("actif", true);

  if (errCodes) {
    return NextResponse.json({ error: "registre illisible", detail: errCodes.message }, { status: 500 });
  }

  const registre: CodeApporteur[] = (codes ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return { code: String(row.code), apporteurId: String(row.apporteur_id), actif: Boolean(row.actif) };
  });

  const verdict = attribuer({
    codeBrut: corps.code,
    nouveauCompteId: tenant,
    attributionExistante: (existant as { apporteur_code?: string } | null)?.apporteur_code ?? null,
    registre,
  });

  /**
   * ⚠ ON N'ÉCRIT QUE SUR UNE ATTRIBUTION RÉELLE. Un refus — code inconnu,
   * auto-attribution, compte déjà attribué — ne touche pas la base. Écrire
   * une valeur vide « pour marquer le passage » consommerait l'unique
   * écriture autorisée par le trigger d'immuabilité, et le vrai apporteur ne
   * pourrait plus jamais être enregistré.
   */
  if (!verdict.apporteurId || !verdict.code) {
    return NextResponse.json({ ok: false, refus: verdict.refus, message: verdict.message });
  }

  const { error: errEcriture } = await db
    .from("entitlements")
    .update({ apporteur_code: verdict.code, apporteur_depuis: new Date().toISOString() })
    .eq("tenant_id", tenant);

  if (errEcriture) {
    return NextResponse.json({ error: "écriture impossible", detail: errEcriture.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, code: verdict.code, message: verdict.message });
}
