import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyStripeSignature, planForPriceId } from "@/lib/stripe";
import { ligneEntitlements } from "@/lib/entitlements-provision";
import {
  ligneDepuisAbonnement,
  ligneDepuisSession,
  sansInconnus,
  type ObjetStripe,
} from "@/lib/stripe-webhook";

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

  let event: { type?: string; data?: { object?: ObjetStripe } };
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

  /**
   * Les DÉCISIONS vivent dans `lib/stripe-webhook.ts`, où elles sont testées.
   * Ici on ne fait plus qu'écrire — et `sansInconnus` garantit qu'un
   * événement partiel n'efface jamais ce qu'on sait déjà.
   */
  const ecrire = async (ligne: ReturnType<typeof ligneDepuisSession>) => {
    if (!ligne) return;
    await sb
      .from("subscriptions")
      .upsert({ ...sansInconnus(ligne), updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    /**
     * ⚠ ET LES DROITS — sans quoi tout ce qui précède ne sert à rien.
     *
     * `subscriptions` enregistre le PAIEMENT ; le contrôle d'accès, lui, lit
     * `entitlements` (`resoudreDroits`, appelé par le middleware). Les deux
     * tables ne se parlaient pas, et `entitlements` n'existait même pas dans
     * le schéma. Le chemin normal d'un client payant était donc : il paie, on
     * enregistre son abonnement, et l'application le refuse.
     *
     * On ne provisionne QUE sur encaissement réel : `ligneEntitlements` rend
     * `null` autrement, et une offre inconnue ne provisionne rien non plus —
     * un compte à zéro brique afficherait une application vide au lieu d'un
     * message disant qu'on n'a pas fini.
     */
    const droits = ligneEntitlements({
      tenantId: String(ligne.user_id),
      offreId: typeof ligne.plan === "string" ? ligne.plan : null,
      encaisse: ligne.status === "active",
    });
    if (droits) {
      await sb.from("entitlements").upsert(droits, { onConflict: "tenant_id" });
    }
  };

  try {
    if (type === "checkout.session.completed") {
      await ecrire(ligneDepuisSession(obj));
    } else if (type.startsWith("customer.subscription.")) {
      await ecrire(ligneDepuisAbonnement(type, obj, (id) => planForPriceId(id)));
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "échec d'écriture" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
