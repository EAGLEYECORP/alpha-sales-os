import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyStripeSignature, planForPriceId } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Stripe — source de vérité de l'état d'abonnement.
 *
 *   Stripe → POST /api/webhooks/stripe  (en-tête Stripe-Signature)
 *
 * Signature vérifiée à la main (lib/stripe.ts) avec STRIPE_WEBHOOK_SECRET :
 * aucune écriture sans preuve que l'appel vient bien de Stripe. Chaque
 * abonnement est rattaché au compte via metadata.user_id (posé au checkout).
 * Écriture dans `subscriptions` avec le SERVICE ROLE.
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

interface StripeObject {
  id?: string;
  object?: string;
  customer?: string;
  subscription?: string;
  status?: string;
  client_reference_id?: string;
  customer_email?: string;
  current_period_end?: number;
  metadata?: Record<string, string>;
  customer_details?: { email?: string };
  items?: { data?: { price?: { id?: string } }[] };
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET non configuré." }, { status: 503 });
  }

  // Corps BRUT obligatoire pour la vérification de signature.
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!verifyStripeSignature(payload, sig, secret)) {
    return NextResponse.json({ error: "signature invalide" }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: StripeObject } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const type = event.type ?? "";
  const obj = event.data?.object ?? {};

  const sb = serviceClient();
  if (!sb) {
    // On accuse réception (200) pour éviter les rejeux inutiles, mais rien à écrire.
    return NextResponse.json({ received: true, persisted: false });
  }

  const upsert = async (row: Record<string, unknown>) => {
    await sb.from("subscriptions").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  };

  try {
    if (type === "checkout.session.completed") {
      const userId = obj.client_reference_id || obj.metadata?.user_id;
      if (userId) {
        await upsert({
          user_id: userId,
          email: obj.customer_email ?? obj.customer_details?.email ?? null,
          stripe_customer_id: obj.customer ?? null,
          stripe_subscription_id: obj.subscription ?? null,
          plan: obj.metadata?.plan ?? null,
          status: "active",
        });
      }
    } else if (type.startsWith("customer.subscription.")) {
      const userId = obj.metadata?.user_id;
      if (userId) {
        const priceId = obj.items?.data?.[0]?.price?.id;
        await upsert({
          user_id: userId,
          stripe_customer_id: obj.customer ?? null,
          stripe_subscription_id: obj.id ?? null,
          plan: obj.metadata?.plan ?? planForPriceId(priceId) ?? null,
          status: type.endsWith("deleted") ? "canceled" : obj.status ?? "inactive",
          current_period_end: obj.current_period_end
            ? new Date(obj.current_period_end * 1000).toISOString()
            : null,
        });
      }
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "échec d'écriture" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
