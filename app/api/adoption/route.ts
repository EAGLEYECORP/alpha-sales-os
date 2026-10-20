import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTenant } from "@/lib/tenant";
import { estMaitre } from "@/lib/entitlements";
import { lireAdoption } from "@/lib/adoption";
import { lireComptesCrees } from "@/lib/comptes-crees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * L'ADOPTION — des entiers, aux propriétaires d'ALPHA SALES OS seulement.
 *
 * Lecture seule. Combien de comptes (hors les nôtres), combien confirmés,
 * combien nés dans l'heure / la journée / la semaine / le mois, combien
 * connectés, et la courbe de trente jours. C'est le tableau de bord de
 * `/adoption`, et le chiffre qui dit si le mur des emails de confirmation
 * approche (`docs/OBJECTIF-10M.md`).
 *
 * ⚠ RIEN d'autre ne sort — voir `lib/adoption.ts` : aucune adresse, aucun
 * identifiant, aucun contenu. L'agrégat est calculé EN BASE
 * (`supabase/migrations/017-adoption.sql`), qui ne rend que des comptes.
 *
 * ⚠ MAÎTRE UNIQUEMENT, DEUX FOIS : le chemin est dans `MAITRE_SEULEMENT` (garde
 * d'identité du middleware) ET la route refuse elle-même un non-maître. Et elle
 * n'est PAS dans `API_EXPLOITATION` : sur le serveur d'un client, l'exploitant
 * ouvre sa console, pas notre tableau d'acquisition.
 *
 * ⚠ Les adresses des propriétaires (`OWNER_EMAILS`) sont passées à la fonction
 * SQL pour être EXCLUES du compte — le palier « 10 » dit « dix comptes qui ne
 * sont pas les nôtres ». Elles ne sont ni stockées ni renvoyées.
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
  const tenant = await getTenant(req);
  if (!estMaitre(tenant?.email)) {
    return NextResponse.json({ error: "réservé au compte maître" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const db = url && cle ? createClient(url, cle, { auth: { persistSession: false } }) : null;

  const adoption = await lireAdoption({
    rpc: db ? (nom, args) => db.rpc(nom, args) : null,
    repli: () => lireComptesCrees(process.env, (u, init) => fetch(u, { ...init, cache: "no-store" })),
    exclure: (process.env.OWNER_EMAILS ?? "").split(","),
  });

  return NextResponse.json(adoption, { headers: { "Cache-Control": "no-store" } });
}
