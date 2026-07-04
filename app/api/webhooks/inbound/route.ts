import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { InboundEvent } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Inbound webhook — point your email tool (Instantly, Smartlead, Lemlist,
 * Resend, Zapier/Make…) or WhatsApp/form provider here.
 *
 *   POST /api/webhooks/inbound
 *   Header: x-webhook-secret: $WEBHOOK_SECRET   (or ?secret=…)
 *   Body: { "type": "email.reply", "email": "marc@bouchon.fr",
 *           "name": "Marc", "campaignId": "c-restos-hiver",
 *           "message": "Ok pour mardi 15h" }
 *
 * Storage: Supabase table `inbound_events` when SUPABASE_SERVICE_ROLE_KEY
 * is configured (survives serverless), else an in-process ring buffer
 * (fine for `next start` on a single machine / dev).
 *
 * The app polls GET (unprocessed events) and PATCH {ids:[…]} to ack.
 */

const memoryStore: InboundEvent[] = [];

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const VALID_TYPES = new Set(["email.reply", "email.open", "whatsapp.reply", "form.submit", "autre"]);

export async function POST(request: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "WEBHOOK_SECRET non configuré côté serveur — ajoute-le dans .env.local / Vercel." },
      { status: 503 }
    );
  const provided = request.headers.get("x-webhook-secret") ?? request.nextUrl.searchParams.get("secret");
  if (provided !== secret) return NextResponse.json({ error: "secret invalide" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "champ email requis" }, { status: 400 });

  const ev: InboundEvent = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    receivedAt: new Date().toISOString(),
    type: VALID_TYPES.has(String(body.type)) ? (String(body.type) as InboundEvent["type"]) : "autre",
    email,
    name: body.name ? String(body.name) : undefined,
    campaignId: body.campaignId ? String(body.campaignId) : undefined,
    message: String(body.message ?? "").slice(0, 4000),
    processed: false,
  };

  const sb = serviceClient();
  if (sb) {
    const { error } = await sb.from("inbound_events").insert({
      id: ev.id,
      received_at: ev.receivedAt,
      type: ev.type,
      email: ev.email,
      name: ev.name ?? null,
      campaign_id: ev.campaignId ?? null,
      message: ev.message,
      processed: false,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    memoryStore.push(ev);
    if (memoryStore.length > 500) memoryStore.splice(0, memoryStore.length - 500);
  }
  return NextResponse.json({ ok: true, id: ev.id });
}

export async function GET() {
  const sb = serviceClient();
  if (sb) {
    const { data, error } = await sb
      .from("inbound_events")
      .select("*")
      .eq("processed", false)
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const events: InboundEvent[] = (data ?? []).map((r) => ({
      id: r.id,
      receivedAt: r.received_at,
      type: r.type,
      email: r.email,
      name: r.name ?? undefined,
      campaignId: r.campaign_id ?? undefined,
      message: r.message,
      processed: r.processed,
    }));
    return NextResponse.json({ events, store: "supabase" });
  }
  return NextResponse.json({
    events: memoryStore.filter((e) => !e.processed).slice(-100).reverse(),
    store: "memory",
  });
}

export async function PATCH(request: NextRequest) {
  let ids: string[];
  try {
    const body = await request.json();
    ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const sb = serviceClient();
  if (sb) {
    const { error } = await sb.from("inbound_events").update({ processed: true }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    for (const ev of memoryStore) if (ids.includes(ev.id)) ev.processed = true;
  }
  return NextResponse.json({ ok: true, acked: ids.length });
}
