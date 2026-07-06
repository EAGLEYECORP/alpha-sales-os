import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Écrit une info critique dans le CRM centralisé (Supabase, table crm_records)
 * côté serveur avec le SERVICE ROLE. C'est l'étape « on passe par Supabase » :
 * l'app y dépose la donnée, puis le n8n de l'utilisateur lit crm_records et la
 * pousse dans Google Sheets. Sans service role configuré, no-op (persisted:none)
 * — l'app retombe alors sur l'écriture directe n8n → Sheets.
 *
 *   POST { id, company?, data } → { ok, persisted: "supabase" | "none" }
 */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 200_000) return NextResponse.json({ error: "trop volumineux" }, { status: 413 });

  let body: { id?: string; company?: string; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const id = String(body.id ?? "").trim();
  if (!id || !body.data) return NextResponse.json({ error: "id et data requis" }, { status: 400 });

  const sb = serviceClient();
  if (!sb) return NextResponse.json({ ok: true, persisted: "none" });

  const { error } = await sb.from("crm_records").upsert({
    id,
    company: body.company ?? id,
    data: body.data,
    updated_at: new Date().toISOString(),
    synced_to_sheet: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: "supabase" });
}
