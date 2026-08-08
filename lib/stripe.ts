import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Facturation Stripe — abonnements SaaS (revente d'ALPHA SALES OS).
 *
 * Zéro dépendance : on parle à l'API REST Stripe en `fetch` (form-urlencoded)
 * et on vérifie la signature des webhooks à la main (HMAC-SHA256, node:crypto),
 * comme le JWT LiveKit / Supabase. Le SDK `stripe` n'est pas nécessaire.
 *
 * Plans (site eagleyecorp.fr) : Solo 79 €/mois, Pro 149 €/mois, Agence = devis.
 * Les identifiants de prix viennent de l'environnement (jamais en dur).
 *
 * ⚠ Non vérifié contre un vrai compte Stripe dans l'environnement de build.
 * La vérif de signature est prouvée par tests unitaires ; l'intégration
 * (checkout + webhook réels) reste à valider côté utilisateur (docs/FACTURATION.md).
 * ─────────────────────────────────────────────────────────────────────
 */

export type Plan = "solo" | "pro";

export interface PlanInfo {
  id: Plan;
  name: string;
  monthly: number; // €
  priceEnv: string; // variable d'env portant l'ID de prix Stripe
}

export const PLANS: Record<Plan, PlanInfo> = {
  solo: { id: "solo", name: "Solo", monthly: 79, priceEnv: "STRIPE_PRICE_SOLO" },
  pro: { id: "pro", name: "Pro", monthly: 149, priceEnv: "STRIPE_PRICE_PRO" },
};

/** Statuts d'abonnement Stripe considérés comme donnant accès. */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
export function statusGrantsAccess(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_STATUSES.has(status));
}

export function stripeSecret(): string | null {
  return process.env.STRIPE_SECRET_KEY || null;
}
export function stripeConfigured(): boolean {
  return Boolean(stripeSecret());
}

/** ID de prix Stripe pour un plan (depuis l'env). */
export function priceIdFor(plan: Plan): string | null {
  return process.env[PLANS[plan].priceEnv] || null;
}

/** Faut-il exiger un abonnement actif pour les actions payantes (opt-in) ? */
export function subscriptionEnforced(): boolean {
  return /^(1|true|yes)$/i.test(String(process.env.REQUIRE_SUBSCRIPTION ?? ""));
}

/** Email propriétaire (côté serveur) — accès permanent, hors facturation. */
export function isOwnerServer(email: string | null | undefined): boolean {
  return matchesOwnerList(email, process.env.OWNER_EMAILS);
}

/**
 * Un email est-il « propriétaire » d'après une liste ? Deux formes acceptées :
 *  · adresse exacte  : `zak@eagleyecorp.fr`
 *  · domaine entier  : `@eagleyecorp.fr` → toute adresse de ce domaine.
 * Insensible à la casse. « EAGLEYECORP ET MOI » = mets `@eagleyecorp.fr` + ton
 * adresse perso.
 */
export function matchesOwnerList(email: string | null | undefined, raw: string | null | undefined): boolean {
  if (!email) return false;
  const addr = email.trim().toLowerCase();
  const entries = (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return entries.some((e) => (e.startsWith("@") ? addr.endsWith(e) : addr === e));
}

/** Statut d'abonnement d'un compte (service role), donne-t-il accès ? */
async function accountSubscriptionActive(userId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await sb.from("subscriptions").select("status").eq("user_id", userId).maybeSingle();
  return statusGrantsAccess((data?.status as string | undefined) ?? null);
}

/**
 * Le compte a-t-il le droit d'effectuer une action payante ?
 * - facturation non exigée (défaut) → toujours oui (mode solo/local inchangé) ;
 * - propriétaire (OWNER_EMAILS) → toujours oui ;
 * - sinon : abonnement actif requis.
 */
export async function accountHasAccess(userId: string | null, email: string | null): Promise<boolean> {
  if (!subscriptionEnforced()) return true;
  if (isOwnerServer(email)) return true;
  if (!userId) return false;
  return accountSubscriptionActive(userId);
}

/** Plan correspondant à un ID de prix Stripe (résolution inverse, pour le webhook). */
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  for (const p of Object.values(PLANS)) {
    if (process.env[p.priceEnv] && process.env[p.priceEnv] === priceId) return p.id;
  }
  return null;
}

/**
 * Vérifie la signature d'un webhook Stripe (en-tête `Stripe-Signature`).
 * Format : `t=<timestamp>,v1=<hmac_hex>[,v1=<autre>]`. On recalcule
 * HMAC-SHA256(`<t>.<payloadBrut>`) et on compare en temps constant. Rejette
 * un horodatage hors tolérance (anti-rejeu). Ne jette jamais.
 */
export function verifyStripeSignature(
  payload: string,
  sigHeader: string | null,
  secret: string,
  toleranceSec = 300,
  nowSec: number = Math.floor(Date.now() / 1000)
): boolean {
  try {
    if (!sigHeader || !secret) return false;
    let t: number | null = null;
    const v1: string[] = [];
    for (const part of sigHeader.split(",")) {
      const [k, v] = part.split("=");
      if (k?.trim() === "t") t = Number(v);
      else if (k?.trim() === "v1" && v) v1.push(v.trim());
    }
    if (t === null || Number.isNaN(t) || v1.length === 0) return false;
    if (Math.abs(nowSec - t) > toleranceSec) return false;

    const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    const exp = Buffer.from(expected, "utf8");
    // Un match parmi les signatures fournies (Stripe peut en envoyer plusieurs).
    return v1.some((sig) => {
      const got = Buffer.from(sig, "utf8");
      return got.length === exp.length && timingSafeEqual(got, exp);
    });
  } catch {
    return false;
  }
}

// ── Appels API Stripe (fetch, form-urlencoded) ─────────────────────────
function form(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.append(k, v);
  return sp.toString();
}

async function stripePost(path: string, body: string): Promise<Record<string, unknown>> {
  const key = stripeSecret();
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error as { message?: string })?.message ?? `Stripe ${res.status}`;
    throw new Error(err);
  }
  return json;
}

/** Crée une session Checkout d'abonnement. Renvoie l'URL de paiement. */
export async function createCheckoutSession(opts: {
  plan: Plan;
  userId: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const price = priceIdFor(opts.plan);
  if (!price) throw new Error(`Prix non configuré pour le plan ${opts.plan} (${PLANS[opts.plan].priceEnv}).`);
  const json = await stripePost(
    "checkout/sessions",
    form({
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      client_reference_id: opts.userId,
      customer_email: opts.email,
      // Rattache l'abonnement au compte — relu par le webhook.
      "subscription_data[metadata][user_id]": opts.userId,
      "subscription_data[metadata][plan]": opts.plan,
      allow_promotion_codes: "true",
    })
  );
  const url = json.url as string | undefined;
  if (!url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return url;
}

/** Crée une session du portail client (gérer / annuler l'abonnement). */
export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const json = await stripePost("billing_portal/sessions", form({ customer: customerId, return_url: returnUrl }));
  const url = json.url as string | undefined;
  if (!url) throw new Error("Stripe n'a pas renvoyé d'URL de portail.");
  return url;
}
