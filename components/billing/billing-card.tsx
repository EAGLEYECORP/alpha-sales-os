"use client";

import { useEffect, useState } from "react";
import { CreditCard, Crown, ExternalLink, Loader2 } from "lucide-react";
import {
  getSubscription,
  startCheckout,
  openBillingPortal,
  isOwnerEmail,
  subActive,
  PLAN_UI,
  type Plan,
  type Subscription,
} from "@/lib/billing";
import { cn } from "@/lib/utils";

/**
 * Carte d'abonnement du compte connecté : statut, choix d'un plan (Checkout
 * Stripe), et accès au portail (gérer / annuler). Le propriétaire (allowlist
 * NEXT_PUBLIC_OWNER_EMAILS) a un accès permanent — jamais bloqué par la facture.
 */
export function BillingCard({ email }: { email: string | null }) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const owner = isOwnerEmail(email);

  useEffect(() => {
    let alive = true;
    getSubscription()
      .then((s) => alive && setSub(s))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const go = async (fn: () => Promise<{ ok: boolean; error?: string }>, key: string) => {
    setBusy(key);
    setError(null);
    const r = await fn();
    if (!r.ok) {
      setError(r.error ?? "Échec.");
      setBusy(null);
    }
    // Succès → redirection Stripe (la page change).
  };

  if (owner) {
    return (
      <section className="card border-bronze-700/50 bg-bronze-900/10 p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-bronze-400">
          <Crown size={15} /> Accès propriétaire
        </p>
        <p className="mt-2 text-[13px] text-paper-dim">
          Ton compte est reconnu comme propriétaire — accès complet et permanent, indépendant de tout abonnement.
        </p>
      </section>
    );
  }

  const active = subActive(sub?.status);
  const fdate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <section className="card p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <CreditCard size={15} className="text-bronze-400" /> Abonnement
      </p>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-paper-faint">
          <Loader2 size={14} className="animate-spin" /> Chargement…
        </p>
      ) : active ? (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-signal-green/50 text-signal-green">
              {sub?.status === "trialing" ? "Essai" : sub?.status === "past_due" ? "Paiement en retard" : "Actif"}
            </span>
            {sub?.plan && <span className="text-sm text-paper">Plan {PLAN_UI[sub.plan]?.name ?? sub.plan}</span>}
          </div>
          <p className="mt-2 text-[12px] text-paper-faint">
            Prochaine échéance : {fdate(sub?.currentPeriodEnd ?? null)}
          </p>
          <button
            className="btn-ghost mt-3"
            onClick={() => go(openBillingPortal, "portal")}
            disabled={busy !== null}
          >
            {busy === "portal" ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Gérer l&apos;abonnement
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[13px] text-paper-dim">
            Aucun abonnement actif. Choisis un plan pour débloquer l&apos;OS en continu.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(Object.keys(PLAN_UI) as Plan[]).map((p) => (
              <div key={p} className={cn("rounded-xl border p-4", p === "pro" ? "border-bronze-700/60 bg-bronze-900/10" : "border-ink-700 bg-ink-850")}>
                <p className="font-display text-sm font-bold text-paper">{PLAN_UI[p].name}</p>
                <p className="font-display text-2xl font-extrabold text-bronze-400">
                  {PLAN_UI[p].monthly} €<span className="text-[11px] font-normal text-paper-faint"> / mois</span>
                </p>
                <p className="mt-0.5 text-[11px] text-paper-faint">{PLAN_UI[p].blurb}</p>
                <ul className="mt-2 space-y-1 text-[11.5px] text-paper-dim">
                  {PLAN_UI[p].features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
                <button
                  className={cn("mt-3 w-full", p === "pro" ? "btn-bronze" : "btn-ghost")}
                  onClick={() => go(() => startCheckout(p), `checkout-${p}`)}
                  disabled={busy !== null}
                >
                  {busy === `checkout-${p}` ? <Loader2 size={14} className="animate-spin" /> : null}
                  S&apos;abonner
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-paper-faint">
            Besoin d&apos;un plan Agence (plusieurs commerciaux) ?{" "}
            <a href="mailto:contact@eagleyecorp.fr" className="text-bronze-400 hover:underline">contact@eagleyecorp.fr</a>.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-[12px] text-signal-red">{error}</p>}
    </section>
  );
}
