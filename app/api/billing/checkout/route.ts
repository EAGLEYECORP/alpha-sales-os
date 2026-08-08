import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, stripeConfigured, type Plan, PLANS } from "@/lib/stripe";
import { getTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Crée une session Stripe Checkout pour l'abonnement du compte connecté.
 *   POST { plan: "solo" | "pro" } → { url }
 * Le compte vient du JWT (pas d'un paramètre client) : on ne facture jamais au
 * nom d'un autre. Sans Stripe configuré : 503 franc.
 */
export async function POST(req: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Facturation non configurée — ajoute STRIPE_SECRET_KEY et STRIPE_PRICE_* (voir docs/FACTURATION.md)." },
      { status: 503 }
    );
  }

  const tenant = await getTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "Connecte-toi pour t'abonner." }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const plan = String(body.plan ?? "") as Plan;
  if (!(plan in PLANS)) {
    return NextResponse.json({ error: "plan invalide (solo | pro)" }, { status: 400 });
  }

  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  try {
    const url = await createCheckoutSession({
      plan,
      userId: tenant.id,
      email: tenant.email ?? undefined,
      successUrl: `${origin.replace(/\/+$/, "")}/compte?abonnement=ok`,
      cancelUrl: `${origin.replace(/\/+$/, "")}/compte?abonnement=annule`,
    });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec de la création du paiement." },
      { status: 502 }
    );
  }
}
