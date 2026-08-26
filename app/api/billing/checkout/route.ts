import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe";
import { OFFRES, offreParId } from "@/lib/offres-publiques";
import { getTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Crée une session Stripe Checkout pour une offre de la grille publique.
 *   POST { offre: "essai" | "solo" | "pro" | "voix-1000" } → { url }
 *
 * `plan` reste accepté en second nom pour les anciens appelants — mais la
 * grille est la seule source des offres valides, et c'est elle qui dit si
 * l'achat est un abonnement ou un paiement unique.
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

  let body: { offre?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const offreId = String(body.offre ?? body.plan ?? "");
  const offre = offreParId(offreId);
  const payables = OFFRES.filter((o) => o.cadence !== "devis").map((o) => o.id);

  if (!offre) {
    return NextResponse.json(
      { error: `Offre inconnue. Offres payables : ${payables.join(", ")}.` },
      { status: 400 }
    );
  }
  // Une offre sur devis n'a PAS de bouton payer : la doctrine impose le
  // cadrage avant tout devis, et un paiement en ligne le court-circuiterait.
  if (offre.cadence === "devis") {
    return NextResponse.json(
      { error: `« ${offre.nom} » passe par le cadrage, pas par un paiement en ligne.` },
      { status: 400 }
    );
  }

  const origin = process.env.APP_BASE_URL || req.nextUrl.origin;
  try {
    const base = origin.replace(/\/+$/, "");
    const url = await createCheckoutSession({
      offreId: offre.id,
      offreNom: offre.nom,
      priceEnv: offre.priceEnv!,
      // Le mode se DÉDUIT de la cadence : l'essai est un paiement unique, et
      // le passer en abonnement prélèverait 290 € tous les mois à quelqu'un
      // qui croyait payer une mise en route.
      abonnement: offre.cadence === "mensuel",
      userId: tenant.id,
      email: tenant.email ?? undefined,
      // L'offre voyage dans l'URL de retour : c'est elle qui déclenche le bon
      // parcours d'onboarding au lieu d'un « merci » générique.
      successUrl: `${base}/compte?achat=ok&offre=${encodeURIComponent(offre.id)}`,
      cancelUrl: `${base}/compte?achat=annule&offre=${encodeURIComponent(offre.id)}`,
    });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec de la création du paiement." },
      { status: 502 }
    );
  }
}
