import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { InboundEvent } from "@/lib/types";
import { getTenantId, tenantFromInbound } from "@/lib/tenant";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";

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

/**
 * Lecture/ack des événements : réservé au porteur du secret, ou à une session
 * de l'app réellement authentifiée.
 *
 * ⚠ La version précédente acceptait `Sec-Fetch-Site: same-origin` comme preuve
 * qu'on venait de l'app. Un navigateur interdit bien à du JavaScript de poser
 * cet en-tête — mais `curl -H "Sec-Fetch-Site: same-origin"` le pose sans
 * effort, et cette route est exemptée de SITE_PASSWORD (elle doit rester
 * joignable par les fournisseurs). N'importe qui sur Internet pouvait donc
 * lire les réponses des prospects : noms, emails, contenu des messages.
 *
 * On vérifie maintenant le cookie d'accès du site — le même HMAC que le
 * middleware, impossible à forger sans SITE_PASSWORD. Le POST, lui, reste
 * ouvert cross-origin (fournisseurs, n8n) puisqu'il exige déjà le secret.
 */
async function canReadEvents(request: NextRequest): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET;
  const provided = request.headers.get("x-webhook-secret") ?? request.nextUrl.searchParams.get("secret");
  if (secret && provided && safeEqual(provided, secret)) return true;

  const sitePassword = process.env.SITE_PASSWORD;
  // Pas de porte d'accès configurée (développement local) : on garde la
  // lecture ouverte, sinon l'app ne fonctionne pas sur localhost.
  if (!sitePassword) return true;

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value ?? "";
  if (!cookie) return false;
  return safeEqual(cookie, await accessToken(sitePassword));
}

export async function POST(request: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "WEBHOOK_SECRET non configuré côté serveur — ajoute-le dans .env.local / Vercel." },
      { status: 503 }
    );
  const provided = request.headers.get("x-webhook-secret") ?? request.nextUrl.searchParams.get("secret");
  // Comparaison à temps constant : ce secret est exposé à Internet, autant ne
  // pas offrir d'oracle de timing sur ses premiers caractères.
  if (!provided || !safeEqual(provided, secret)) return NextResponse.json({ error: "secret invalide" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const email = String(body.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "champ email requis" }, { status: 400 });

  // Rattachement au locataire (multi-compte) : déclaratif, fourni par le
  // provider (?t=<user_id> ou body.userId/tenant). Forme UUID validée ; sinon
  // null → pool non attribué (comportement solo). Voir docs/PREUVE-RLS.md.
  const tenantId = tenantFromInbound(
    request.nextUrl.searchParams.get("t") ?? body.userId ?? body.tenant
  );

  const ev: InboundEvent = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    userId: tenantId ?? undefined,
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
      user_id: tenantId,
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

export async function GET(request: NextRequest) {
  if (!(await canReadEvents(request))) {
    return NextResponse.json({ error: "lecture réservée à une session de l'app ou au porteur du secret" }, { status: 401 });
  }
  // Le commercial connecté ne lit QUE ses réponses (multi-compte). Un appelant
  // au secret sans session (n8n/admin) n'a pas de locataire → lecture globale.
  const tenantId = await getTenantId(request);

  const sb = serviceClient();
  if (sb) {
    let q = sb
      .from("inbound_events")
      .select("*")
      .eq("processed", false)
      .order("received_at", { ascending: false })
      .limit(100);
    if (tenantId) q = q.eq("user_id", tenantId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const events: InboundEvent[] = (data ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id ?? undefined,
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
    events: memoryStore
      .filter((e) => !e.processed && (!tenantId || e.userId === tenantId))
      .slice(-100)
      .reverse(),
    store: "memory",
  });
}

export async function PATCH(request: NextRequest) {
  if (!(await canReadEvents(request))) {
    return NextResponse.json({ error: "ack réservé à une session de l'app ou au porteur du secret" }, { status: 401 });
  }
  let ids: string[];
  try {
    const body = await request.json();
    ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  // Un commercial n'acquitte que SES événements (multi-compte). Secret sans
  // session → pas de restriction (n8n/admin).
  const tenantId = await getTenantId(request);

  const sb = serviceClient();
  if (sb) {
    let q = sb.from("inbound_events").update({ processed: true }).in("id", ids);
    if (tenantId) q = q.eq("user_id", tenantId);
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    for (const ev of memoryStore)
      if (ids.includes(ev.id) && (!tenantId || ev.userId === tenantId)) ev.processed = true;
  }
  return NextResponse.json({ ok: true, acked: ids.length });
}
