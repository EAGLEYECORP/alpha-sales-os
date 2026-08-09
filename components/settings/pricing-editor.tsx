"use client";

import { BadgeEuro, RotateCcw } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { defaultPricing, type PricingConfig, type Tier } from "@/lib/pricing";

/**
 * Éditeur de tarifs — white-label. Chaque compte définit SES prix (setup, part
 * sur CA, paliers). Absent = modèle EAGLEYE. Édite name / prospects / €/mois ;
 * les descriptions restent celles du modèle.
 */
export function PricingEditor() {
  const { settings, patchSettings } = useAlpha();
  const pricing: PricingConfig = settings.pricing ?? defaultPricing;

  // Clone profond avant modification (ne jamais muter le défaut partagé).
  const edit = (mut: (p: PricingConfig) => void) => {
    const next: PricingConfig = {
      setupFee: pricing.setupFee,
      revSharePct: pricing.revSharePct,
      tiers: pricing.tiers.map((t) => ({ ...t, features: [...t.features] })),
    };
    mut(next);
    patchSettings({ pricing: next });
  };

  const setTier = (i: number, patch: Partial<Tier>) => edit((p) => Object.assign(p.tiers[i], patch));

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <BadgeEuro size={15} className="text-bronze-400" /> Tarifs — mon offre (white-label)
        </h2>
        {settings.pricing && (
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => patchSettings({ pricing: undefined })}>
            <RotateCcw size={13} /> Revenir au modèle par défaut
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-paper-faint">
        Ces prix pilotent la page <strong className="text-paper-dim">Offre &amp; Tarifs</strong> et son calculateur. Défaut
        = modèle EAGLEYE ; un revendeur met les siens.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Frais de setup (€)</label>
          <input
            type="number"
            className="input"
            value={pricing.setupFee}
            onChange={(e) => edit((p) => (p.setupFee = Math.max(0, +e.target.value)))}
          />
        </div>
        <div>
          <label className="label">Part sur le CA généré (%)</label>
          <input
            type="number"
            className="input"
            value={pricing.revSharePct}
            onChange={(e) => edit((p) => (p.revSharePct = Math.min(100, Math.max(0, +e.target.value))))}
          />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-ink-700 text-left font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-faint">
              <th className="py-2 pr-2">Palier</th>
              <th className="py-2 pr-2">Prospects/mois inclus</th>
              <th className="py-2">€/mois (vide = sur devis)</th>
            </tr>
          </thead>
          <tbody>
            {pricing.tiers.map((t, i) => (
              <tr key={t.id} className="border-b border-ink-800">
                <td className="py-1.5 pr-2">
                  <input className="input py-1 text-[12px]" value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} />
                </td>
                <td className="py-1.5 pr-2">
                  {Number.isFinite(t.maxProspects) ? (
                    <input
                      type="number"
                      className="input w-28 py-1 text-[12px]"
                      value={t.maxProspects}
                      onChange={(e) => setTier(i, { maxProspects: Math.max(1, +e.target.value) })}
                    />
                  ) : (
                    <span className="text-paper-faint">illimité</span>
                  )}
                </td>
                <td className="py-1.5">
                  <input
                    type="number"
                    className="input w-28 py-1 text-[12px]"
                    placeholder="devis"
                    value={t.monthly ?? ""}
                    onChange={(e) => setTier(i, { monthly: e.target.value.trim() === "" ? null : Math.max(0, +e.target.value) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
