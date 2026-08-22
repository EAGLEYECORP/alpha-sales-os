"use client";

import { useMemo, useState } from "react";
import { computeCosts, defaultVolume, FIXED_COSTS, FREE_TIERS, FREE_VERDICT, type CallVolumeInput } from "@/lib/voice-costs";
import { outboundPrice } from "@/lib/bricks";
import { cn } from "@/lib/utils";

/**
 * Le coût usine d'Alpha Voice — ce que chaque appel nous coûte VRAIMENT, et ce
 * qu'il reste après.
 *
 * Ce module existait, testé, et n'était affiché nulle part : impossible de
 * savoir si un palier était rentable sans relire le code. Une offre dont on ne
 * voit pas la marge finit toujours par être vendue à perte.
 *
 * Le chiffre d'affaires n'est PAS saisi ici : il vient de la grille publique
 * (`outboundPrice`), pour qu'il n'existe qu'un seul prix dans tout le produit.
 */
export function CostPanel() {
  const [v, setV] = useState<CallVolumeInput>(defaultVolume);
  const revenue = useMemo(() => outboundPrice(v.calls).monthlyHT, [v.calls]);
  const c = useMemo(() => computeCosts(v, revenue), [v, revenue]);

  const eur2 = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const set = (patch: Partial<CallVolumeInput>) => setV((s) => ({ ...s, ...patch }));

  return (
    <section className="card p-4">
      <h2 className="font-display text-sm font-semibold text-paper">Coût usine — ce qu&apos;il reste par palier</h2>
      <p className="mt-0.5 text-[11px] text-paper-faint">
        Hypothèses volontairement prudentes : mieux vaut sous-estimer la marge que la découvrir en fin de mois.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="text-[11px] text-paper-faint">
          Appels composés / mois
          <input type="number" className="input mt-1" value={v.calls || ""} onChange={(e) => set({ calls: Math.max(0, +e.target.value) })} />
        </label>
        <label className="text-[11px] text-paper-faint">
          Taux de décroché (%)
          <input type="number" className="input mt-1" value={v.answerRatePct} onChange={(e) => set({ answerRatePct: +e.target.value })} />
        </label>
        <label className="text-[11px] text-paper-faint">
          Minutes / appel décroché
          <input type="number" step="0.1" className="input mt-1" value={v.avgMinutesAnswered} onChange={(e) => set({ avgMinutesAnswered: +e.target.value })} />
        </label>
        <label className="text-[11px] text-paper-faint">
          Minutes de sonnerie
          <input type="number" step="0.1" className="input mt-1" value={v.avgMinutesUnanswered} onChange={(e) => set({ avgMinutesUnanswered: +e.target.value })} />
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Tarif public" value={`${c.revenueEur.toLocaleString("fr-FR")} €`} hint="grille des paliers" />
        <Stat label="Coût total" value={eur2(c.totalEur)} hint={`dont ${eur2(c.fixedEur)} de fixe`} />
        <Stat
          label="Marge"
          value={`${eur2(c.marginEur)} · ${c.marginPct} %`}
          hint={c.marginEur < 0 ? "⚠ vendu à perte" : "après fournisseurs"}
          tone={c.marginEur < 0 ? "bad" : "good"}
        />
        <Stat label="Coût d'un appel" value={eur2(c.costPerCallEur)} hint={`${c.answeredCalls} décrochés`} />
      </div>

      <table className="mt-4 w-full text-[12px]">
        <tbody>
          {c.lines
            .filter((l) => l.eur > 0)
            .map((l) => (
              <tr key={l.id} className="border-t border-ink-700">
                <td className="py-1.5 text-paper">{l.label}</td>
                <td className="py-1.5 text-right font-mono text-paper-faint">{eur2(l.eur)}</td>
                <td className="w-12 py-1.5 text-right font-mono text-paper-faint">{l.pctOfCost} %</td>
              </tr>
            ))}
          {FIXED_COSTS.map((f) => (
            <tr key={f.label} className="border-t border-ink-700">
              <td className="py-1.5 text-paper-faint">{f.label} (fixe)</td>
              <td className="py-1.5 text-right font-mono text-paper-faint">{eur2(f.eurPerMonth)}</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-5 font-display text-sm font-semibold text-paper">Jusqu&apos;où va le gratuit</h3>
      <p className="mt-1 rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-[12px] text-paper">{FREE_VERDICT}</p>
      <ul className="mt-2 space-y-1.5">
        {FREE_TIERS.map((t) => (
          <li key={t.provider} className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[12px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-paper">{t.provider}</span>
              <span className={cn("chip", t.commercialOk ? "border-signal-green/50 text-signal-green" : "border-signal-red/50 text-signal-red")}>
                {t.commercialOk ? "OK en commercial" : "interdit en commercial"}
              </span>
            </div>
            <p className="mt-0.5 text-paper-faint">{t.limit} — {t.realWorld}</p>
            {t.warning && <p className="mt-0.5 text-signal-red">{t.warning}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-paper-faint">{label}</p>
      <p className={cn("font-mono text-sm", tone === "bad" ? "text-signal-red" : tone === "good" ? "text-signal-green" : "text-paper")}>{value}</p>
      {hint && <p className="text-[10px] text-paper-faint">{hint}</p>}
    </div>
  );
}
