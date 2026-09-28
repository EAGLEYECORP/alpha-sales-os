import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPortalSession, stripeConfigured } from "@/lib/stripe";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Ouvre le portail client Stripe (gérer / annuler l'abonnement) pour le compte
 * connecté. On récupère SON stripe_customer_id (jamais fourni par le client).
 *   POST → { url }
 */
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Facturation non configurée." }, { status: 503 });
  }
  const tenantId = await getTenantId(req);
  if (!tenantId) return NextResponse.json({ error: "Connecte-toi." }, { status: 401 });

  const sb = serviceClient();
  if (!sb) return NextResponse.json({ error: "Supabase (service role) requis pour la facturation." }, { status: 503 });

  const { data } = await sb
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", tenantId)
    .maybeSingle();
  const customerId = data?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "Aucun abonnement à gérer pour ce compte." }, { status: 404 });
  }

  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  try {
    const url = await createPortalSession(customerId, `${origin.replace(/\/+$/, "")}/compte`);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec de l'ouverture du portail." },
      { status: 502 }
    );
  }
}
