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

/**
 * ⚠ « solo » ET « pro » ONT ÉTÉ RETIRÉS LE 04/09/2026.
 *
 * Ce n'était pas un ménage : `solo` facturait 79 €/mois un périmètre devenu
 * GRATUIT le 02/09 (crm, closer, pilotage), et `pro` chevauchait Alpha Voice
 * au même prix sans être la même chose. Les deux plans Stripe existaient et
 * étaient encaissables — un client qui cliquait payait pour ce qu'on donne.
 *
 * ⚠⚠ CE QUI RESTE À FAIRE CÔTÉ STRIPE, ET QUE LE CODE NE PEUT PAS FAIRE :
 * archiver les prix `STRIPE_PRICE_SOLO` et `STRIPE_PRICE_PRO` dans le tableau
 * de bord. Les retirer d'ici les rend inatteignables depuis l'app ; ça
 * n'annule pas un abonnement déjà en cours, et ça ne ferme pas un lien de
 * paiement partagé ailleurs.
 */
export type Plan = "voix-essentiel" | "voix-intensif" | "omnicanal";

export interface PlanInfo {
  id: Plan;
  name: string;
  monthly: number; // €
  priceEnv: string; // variable d'env portant l'ID de prix Stripe
}

export const PLANS: Record<Plan, PlanInfo> = {
  "voix-essentiel": { id: "voix-essentiel", name: "Alpha Voice — Essentiel", monthly: 149, priceEnv: "STRIPE_PRICE_VOIX_ESSENTIEL" },
  "voix-intensif": { id: "voix-intensif", name: "Alpha Voice — Intensif", monthly: 349, priceEnv: "STRIPE_PRICE_VOIX_INTENSIF" },
  omnicanal: { id: "omnicanal", name: "Réponse omnicanale", monthly: 590, priceEnv: "STRIPE_PRICE_OMNICANAL" },
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
  const t = await accountTier(userId, email);
  return t !== "anon"; // free autorisé sous quota, géré par l'appelant
}

/**
 * Palier effectif du compte, pour appliquer le freemium :
 *  - "unmetered" : facturation non exigée (solo/local) → aucun quota ;
 *  - "owner"     : propriétaire (OWNER_EMAILS) → illimité ;
 *  - "active"    : abonnement actif → illimité (usage loyal) ;
 *  - "free"      : compte sans abonnement → bornes du gratuit (quota mensuel) ;
 *  - "anon"      : facturation exigée mais aucun compte identifié → bloqué.
 */
export type AccountTier = "unmetered" | "owner" | "active" | "free" | "anon";
export async function accountTier(userId: string | null, email: string | null): Promise<AccountTier> {
  if (!subscriptionEnforced()) return "unmetered";
  if (isOwnerServer(email)) return "owner";
  if (!userId) return "anon";
  return (await accountSubscriptionActive(userId)) ? "active" : "free";
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
    signal: AbortSignal.timeout(20_000),
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

/**
 * Crée une session Checkout pour N'IMPORTE QUELLE offre de la grille publique.
 *
 * ⚠ ELLE NE CONNAÎT PAS LE CATALOGUE, ET C'EST VOULU.
 *
 * L'appelant résout l'offre et passe la plomberie (variable de prix, mode).
 * La première version importait `lib/offres-publiques` ici — ce qui tirait la
 * grille de COÛTS jusque dans `/api/webhooks/stripe`, une route appelée par
 * Stripe et donc hors du garde même-origine. Un test de fuite l'a vu. Corriger
 * en ajoutant le webhook aux routes internes l'aurait CASSÉ (Stripe n'est pas
 * de même origine) : c'est la dépendance qu'il fallait couper, pas le garde.
 *
 * ⚠ CETTE FONCTION NE CONNAISSAIT QUE « solo » ET « pro ».
 *
 * La grille en compte quatre encaissables — l'essai, Solo, Pro et le palier
 * voix. Les deux autres n'avaient aucun chemin de paiement : le parcours
 * « démo gratuite → essai payant → mensualité » s'arrêtait donc net à
 * l'essai, c'est-à-dire à l'étape qui transforme un intéressé en client.
 *
 * ⚠ ET L'ESSAI N'EST PAS UN ABONNEMENT. C'est un paiement UNIQUE. Le passer
 * en `mode: subscription` aurait prélevé 290 € tous les mois à un client qui
 * croyait payer une mise en route — le genre d'erreur qu'on ne rattrape pas
 * commercialement. Le mode se déduit de la cadence déclarée dans la grille,
 * jamais d'un paramètre que l'appelant pourrait se tromper à passer.
 */
export async function createCheckoutSession(opts: {
  /** Identifiant d'offre, pour les métadonnées et les messages d'erreur. */
  offreId: string;
  /** Nom lisible de l'offre. */
  offreNom: string;
  /** Nom de la variable d'env portant l'ID de prix Stripe. */
  priceEnv: string;
  /** Abonnement mensuel, ou paiement unique. */
  abonnement: boolean;
  userId: string;
  email?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const price = process.env[opts.priceEnv] || null;
  if (!price) {
    throw new Error(
      `Prix Stripe non configuré pour « ${opts.offreNom} » : renseigne ${opts.priceEnv} (voir .env.example).`
    );
  }

  const abonnement = opts.abonnement;

  const json = await stripePost(
    "checkout/sessions",
    form({
      mode: abonnement ? "subscription" : "payment",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      client_reference_id: opts.userId,
      customer_email: opts.email,
      /**
       * ⚠ LE CONTRAT AVEC LE WEBHOOK — il était cassé des DEUX côtés.
       *
       *  1. Le paiement unique posait `metadata[offre]`, le webhook lisait
       *     `metadata.plan`. Résultat : l'essai à 290 € était encaissé et la
       *     ligne d'abonnement s'écrivait avec `plan: null`. Le client payait
       *     et n'obtenait droit à rien — sans la moindre erreur nulle part.
       *
       *  2. L'abonnement ne posait de métadonnées QUE sur l'abonnement, donc
       *     l'événement `checkout.session.completed` arrivait sans plan et
       *     écrivait `null` lui aussi. Ça se rattrapait au coup d'après —
       *     SI l'ordre des événements coopérait, ce que Stripe ne garantit
       *     pas. Dans l'autre ordre, la session ÉCRASAIT le bon plan.
       *
       * Le nom de la clé est `plan` partout, et la session porte toujours ses
       * métadonnées, abonnement ou pas.
       */
      "metadata[user_id]": opts.userId,
      "metadata[plan]": opts.offreId,
      ...(abonnement
        ? {
            "subscription_data[metadata][user_id]": opts.userId,
            "subscription_data[metadata][plan]": opts.offreId,
          }
        : {}),
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
