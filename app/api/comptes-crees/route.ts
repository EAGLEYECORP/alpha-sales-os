import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant";
import { estMaitre } from "@/lib/entitlements";
import { lireComptesCrees } from "@/lib/comptes-crees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * COMBIEN DE COMPTES — deux entiers, au maître seul.
 *
 * Lecture seule. Le total des comptes et les inscrits de la dernière heure :
 * c'est le chiffre qui dit si le mur des emails de confirmation approche
 * (`docs/OBJECTIF-10M.md`, § 2). Rien d'autre ne sort — voir `lib/comptes-crees`.
 *
 * ⚠ MAÎTRE UNIQUEMENT, DEUX FOIS : le chemin est dans `MAITRE_SEULEMENT` (garde
 * d'identité du middleware) ET la route refuse elle-même un non-maître. Le
 * compteur d'inscrits est notre tableau de bord d'acquisition, pas celui d'un
 * locataire — même famille que `/payouts` et l'enveloppe d'ouverture.
 *
 * ⚠ Une base qui ne répond pas rend `null`, jamais 0 (200 avec `raison`) : le
 * moniteur a déjà payé « zéro parce que rien ne tourne » ≠ « zéro parce que tout
 * va bien ».
 * ─────────────────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
  const tenant = await getTenant(req);
  if (!estMaitre(tenant?.email)) {
    return NextResponse.json({ error: "réservé au compte maître" }, { status: 403 });
  }
  const comptes = await lireComptesCrees(process.env, (url, init) => fetch(url, { ...init, cache: "no-store" }));
  return NextResponse.json(comptes, { headers: { "Cache-Control": "no-store" } });
}
