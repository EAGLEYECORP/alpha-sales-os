import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getTenant } from "@/lib/tenant";
import { estMaitre } from "@/lib/entitlements";
import { etatAutopilote, ecrireDrapeauAutopilote } from "@/lib/autopilote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE BOUTON AUTOPILOTE — « Alpha se gère tout seul », en un geste.
 *
 * GET  → l'état (armé ? drapeau opérateur, disjoncteur d'env, SMTP prêt ?).
 * POST → bascule le drapeau en base (ON/OFF). Les ticks serveur le lisent.
 *
 * ⚠ MAÎTRE UNIQUEMENT. Armer l'autopilote fait partir de VRAIS emails depuis
 * notre domaine — c'est notre économie, pas celle d'un locataire. La route
 * refuse tout non-maître (403), en plus du chemin maître côté middleware.
 *
 * ⚠ Le bouton ARME ; il ne contourne aucune garde (palier, mentions, DKIM,
 * présence agent) et n'installe pas le cron. Ce que le drapeau change, c'est
 * `dryRun` → exécution dans les ticks, rien d'autre.
 * ─────────────────────────────────────────────────────────────────────
 */

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const smtpPret = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

async function emailMaitre(req: NextRequest): Promise<string | null> {
  const tenant = await getTenant(req);
  return estMaitre(tenant?.email) ? (tenant?.email ?? "maitre") : null;
}

export async function GET(req: NextRequest) {
  if (!(await emailMaitre(req))) {
    return NextResponse.json({ error: "réservé au compte maître" }, { status: 403 });
  }
  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      { arme: false, drapeau: null, env: false, smtpPret: smtpPret(), why: "Supabase non configuré — l'interrupteur vit en base." },
      { status: 412 },
    );
  }
  const etat = await etatAutopilote(db);
  return NextResponse.json({ ...etat, smtpPret: smtpPret() });
}

export async function POST(req: NextRequest) {
  const qui = await emailMaitre(req);
  if (!qui) return NextResponse.json({ error: "réservé au compte maître" }, { status: 403 });

  let body: { actif?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (typeof body.actif !== "boolean") {
    return NextResponse.json({ error: "champ `actif` (booléen) requis" }, { status: 400 });
  }

  const db = serviceClient();
  if (!db) {
    return NextResponse.json(
      { error: "Supabase non configuré — l'interrupteur vit en base, impossible de l'écrire.", code: "no_db" },
      { status: 412 },
    );
  }

  const ok = await ecrireDrapeauAutopilote(db, body.actif, qui);
  if (!ok) return NextResponse.json({ error: "écriture du drapeau échouée" }, { status: 500 });

  const etat = await etatAutopilote(db);
  return NextResponse.json({
    ok: true,
    ...etat,
    smtpPret: smtpPret(),
    // Honnête à l'allumage : dire ce qui reste requis pour que ça PARTE vraiment.
    rappel: body.actif
      ? "Armé. Rien ne part sans : cron posé (migrations 004/014), fiches synchronisées avec email, palier/DKIM OK. Le bouton arme, il ne contourne rien."
      : "Éteint. Les ticks repassent en simulation (dryRun) : ils calculent, ils n'envoient plus.",
  });
}
