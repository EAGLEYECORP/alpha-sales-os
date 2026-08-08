"use client";

import { getSupabase } from "./supabase";

/**
 * Facturation — côté client.
 *
 * Lit le statut d'abonnement du compte connecté (table `subscriptions`, RLS
 * self-select), lance le Checkout Stripe et ouvre le portail. Ne touche jamais
 * de secret : les clés Stripe restent côté serveur (routes /api/billing/*).
 */

export type Plan = "solo" | "pro";

/** Métadonnées d'affichage (miroir client de lib/stripe PLANS — à garder alignées). */
export const PLAN_UI: Record<Plan, { name: string; monthly: number; blurb: string; features: string[] }> = {
  solo: {
    name: "Solo",
    monthly: 79,
    blurb: "Un commercial, tout l'OS",
    features: ["CRM + pipeline complet", "Emails HTML trackés", "Agent IA + doctrine de closing", "Voix & débrief terrain"],
  },
  pro: {
    name: "Pro",
    monthly: 149,
    blurb: "Plus de volume, plus d'automatisation",
    features: ["Tout Solo", "Volume d'envoi supérieur", "Sourcing & séquences avancées", "Support prioritaire"],
  },
};

export interface Subscription {
  userId: string;
  email: string | null;
  plan: Plan | null;
  status: string;
  currentPeriodEnd: string | null;
}

const ACTIVE = new Set(["active", "trialing", "past_due"]);
export function subActive(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE.has(status));
}

/** Emails « propriétaires » — accès permanent, indépendant de tout abonnement. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.NEXT_PUBLIC_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** Lit l'abonnement du compte connecté (ou null si non lié / non abonné). */
export async function getSubscription(): Promise<Subscription | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: u } = await sb.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return null;
  const { data } = await sb.from("subscriptions").select("*").eq("user_id", uid).maybeSingle();
  if (!data) return null;
  return {
    userId: data.user_id,
    email: data.email ?? null,
    plan: (data.plan as Plan) ?? null,
    status: data.status ?? "inactive",
    currentPeriodEnd: data.current_period_end ?? null,
  };
}

/** Lance le Checkout Stripe pour un plan ; redirige vers la page de paiement. */
export async function startCheckout(plan: Plan): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) return { ok: false, error: json.error ?? "Échec du paiement." };
  window.location.href = json.url as string;
  return { ok: true };
}

/** Ouvre le portail client Stripe (gérer / annuler). */
export async function openBillingPortal(): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/billing/portal", { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url) return { ok: false, error: json.error ?? "Portail indisponible." };
  window.location.href = json.url as string;
  return { ok: true };
}
