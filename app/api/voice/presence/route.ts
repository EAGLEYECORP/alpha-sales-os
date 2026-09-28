import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { safeEqual } from "@/lib/access";
import { BATTEMENT_INTERVALLE_S, TOLERANCE_S, presenceAgent } from "@/lib/presence-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE BATTEMENT DE L'AGENT VOCAL.
 *
 * `POST` — l'agent dit qu'il est là. `GET` — le tick et le moniteur demandent
 * s'il l'est.
 *
 * ⚠ LE POST EXIGE `CRON_SECRET`, ET CE N'EST PAS DU ZÈLE. Un battement
 * falsifiable est pire qu'aucun battement : n'importe qui pourrait faire
 * croire qu'un agent écoute, et l'autopilote se remettrait à composer dans le
 * vide en toute confiance. La garde qu'on ajoute doit être au moins aussi
 * dure que ce qu'elle autorise.
 *
 * ⚠⚠ Le secret est le MÊME que celui du cron, délibérément : l'agent et
 * l'ordonnanceur sont les deux organes de confiance de la machine, et un
 * second secret à gérer serait un second secret à oublier de faire tourner.
 * ─────────────────────────────────────────────────────────────────────
 */

const CLE = "agent-vocal";

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

function autorise(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false; // pas de secret configuré = la route n'existe pas
  const header = req.headers.get("authorization") ?? "";
  const fourni = (header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "").trim();
  return fourni.length > 0 && safeEqual(fourni, secret);
}

/** L'agent s'annonce. */
export async function POST(req: NextRequest) {
  if (!autorise(req)) {
    return NextResponse.json(
      { error: "non autorisé", why: "CRON_SECRET absent ou invalide. Un battement falsifiable ne vaut rien." },
      { status: 401 }
    );
  }

  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      { error: "Supabase non configuré", why: "Le battement a besoin d'un endroit où être écrit." },
      { status: 412 }
    );
  }

  const { error } = await db
    .from("agent_presence")
    .upsert({ cle: CLE, vu_le: new Date().toISOString() }, { onConflict: "cle" });

  if (error) return NextResponse.json({ error: "écriture impossible", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, intervalleS: BATTEMENT_INTERVALLE_S, toleranceS: TOLERANCE_S });
}

/**
 * Lit la présence. Pas de secret exigé : la réponse ne contient aucune donnée
 * sensible, et le moniteur (déjà derrière sa brique) doit pouvoir l'afficher.
 */
export async function GET() {
  const db = serviceClient();
  if (!db) return NextResponse.json(presenceAgent(null));

  const { data, error } = await db.from("agent_presence").select("vu_le").eq("cle", CLE).maybeSingle();

  /**
   * ⚠ UNE LECTURE EN ÉCHEC NE VAUT PAS « VIVANT ». Table absente, base
   * injoignable, migration non passée : dans tous ces cas on rend `inconnu`,
   * donc on ne compose pas. C'est l'asymétrie voulue — ne pas appeler coûte un
   * créneau, appeler dans le vide coûte une fiche et un numéro.
   */
  if (error) return NextResponse.json(presenceAgent(null));

  return NextResponse.json(presenceAgent((data as { vu_le?: string } | null)?.vu_le ?? null));
}
