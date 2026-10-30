import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resoudreDroits } from "@/lib/entitlements";
import { autopiloteArmeEnv, estArme, lireDrapeauAutopilote } from "@/lib/autopilote";
import { expediteurServeur, reglagesServeur } from "@/lib/pilote-serveur";
import { ETAT_AUTOPILOTE_VIDE, type EtatAutopilote } from "@/lib/autopilote-inscrit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * L'INTERRUPTEUR DU PILOTE SERVEUR — « ALPHA vend ALPHA » onglet fermé
 * (30/10/2026). MAÎTRE SEUL, verdict du serveur (`resoudreDroits`).
 *
 * GET : l'état (actif, journal, ce qui manque pour tourner) — sans aucun secret,
 * seulement des booléens « posé / pas posé ».
 * POST `{ actif, reglages?, closerName?, bookingUrl? }` : lancer ou arrêter.
 * Les réglages et le nom sont ceux que le maître a TAPÉS dans `/autopilote` ;
 * le serveur les trie clé par clé (`reglagesServeur`), il ne les croit pas.
 *
 * ⚠ Lancer ici est un GESTE, jamais une configuration : `actif` n'est dans
 * aucun module de réglages d'usine.
 */

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Ce qui manque pour qu'un passage serveur serve à quelque chose — dit, jamais supposé. */
function manques(): string[] {
  const m: string[] = [];
  if (!process.env.CRON_SECRET?.trim()) m.push("CRON_SECRET (Vercel) : sans lui, le tick n'existe pas.");
  if (!process.env.SMTP_HOST?.trim()) m.push("SMTP_* (Vercel) : sans boîte, ALPHA lit et cherche mais n'écrit pas.");
  if (!process.env.DROPCONTACT_API_KEY?.trim()) m.push("DROPCONTACT_API_KEY (Vercel) : sans elle, les entreprises trouvées restent sans email.");
  if (!process.env.AGENDA_ICS_URL?.trim()) m.push("AGENDA_ICS_URL (Vercel, facultatif) : sans elle, les créneaux n'évitent que les RDV d'ALPHA.");
  return m;
}

async function lire(db: SupabaseClient) {
  const { data, error } = await db
    .from("pilote_serveur")
    .select("actif, reglages, expediteur, etat, dernier_passage, verrou_jusqua")
    .eq("id", "maitre")
    .maybeSingle();
  if (error) return { erreur: error.message } as const;
  const etat: EtatAutopilote = { ...ETAT_AUTOPILOTE_VIDE, ...((data?.etat as Partial<EtatAutopilote> | null) ?? {}) };
  const ancienArme = estArme({ env: autopiloteArmeEnv(), dbActif: await lireDrapeauAutopilote(db) });
  return {
    actif: Boolean(data?.actif),
    reglages: reglagesServeur(Boolean(data?.actif), data?.reglages),
    expediteur: expediteurServeur(data?.expediteur),
    journal: etat.journal.slice(0, 30),
    dernierPassage: (data?.dernier_passage as string | null) ?? null,
    envoisSuspendusJusqua: etat.envoisSuspendusJusqua ?? null,
    ancienPiloteArme: ancienArme,
    manques: manques(),
  };
}

export async function GET(req: NextRequest) {
  const droits = await resoudreDroits(req);
  if (!droits.maitre) return NextResponse.json({ error: "réservé au compte maître" }, { status: 403 });
  const db = serviceClient();
  if (!db) return NextResponse.json({ error: "Supabase non configuré (service role)." }, { status: 412 });
  const r = await lire(db);
  if ("erreur" in r) return NextResponse.json({ error: "table pilote_serveur illisible — migration 019 non appliquée ?", detail: r.erreur }, { status: 500 });
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const droits = await resoudreDroits(req);
  if (!droits.maitre) return NextResponse.json({ error: "réservé au compte maître" }, { status: 403 });
  const db = serviceClient();
  if (!db) return NextResponse.json({ error: "Supabase non configuré (service role)." }, { status: 412 });

  let body: { actif?: unknown; reglages?: unknown; closerName?: unknown; bookingUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (typeof body.actif !== "boolean") return NextResponse.json({ error: "`actif` (booléen) est requis." }, { status: 400 });

  if (body.actif && estArme({ env: autopiloteArmeEnv(), dbActif: await lireDrapeauAutopilote(db) })) {
    return NextResponse.json(
      { error: "L'ancien autopilote d'envoi (gabarits de l'escalier) est armé sur le même pipe : coupe-le d'abord." },
      { status: 409 },
    );
  }

  const { actif: _ignore, ...reglages } = reglagesServeur(body.actif, body.reglages);
  const { error } = await db
    .from("pilote_serveur")
    .upsert(
      {
        id: "maitre",
        actif: body.actif,
        reglages,
        expediteur: expediteurServeur({ closerName: body.closerName, bookingUrl: body.bookingUrl }),
        modifie_le: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) return NextResponse.json({ error: "écriture impossible — migration 019 non appliquée ?", detail: error.message }, { status: 500 });
  const r = await lire(db);
  return NextResponse.json("erreur" in r ? { actif: body.actif } : r);
}
