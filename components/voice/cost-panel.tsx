"use client";

import { useEffect, useState } from "react";
// ⚠ Aucun import de `lib/voice-costs` ni de `lib/bricks` : ces modules portent
// notre modèle de coût et notre grille tarifaire, et tout ce qu'un composant
// client importe part dans un fichier JavaScript que n'importe qui peut
// télécharger. Les chiffres viennent du serveur, déjà agrégés.
import { cn } from "@/lib/utils";

/** Ce que la route renvoie — le RÉSULTAT, jamais les tarifs unitaires. */
interface Volume {
  calls: number;
  answerRatePct: number;
  avgMinutesAnswered: number;
  avgMinutesUnanswered: number;
}
interface Reponse {
  volume: Volume;
  breakdown: {
    answeredCalls: number;
    fixedEur: number;
    totalEur: number;
    revenueEur: number;
    marginEur: number;
    marginPct: number;
    costPerCallEur: number;
    lines: { id: string; label: string; eur: number; pctOfCost: number }[];
  };
  fixed: { label: string; eur: number }[];
  freeTiers: { provider: string; limit: string; realWorld: string; commercialOk: boolean; warning?: string }[];
  freeVerdict: string;
}

/**
 * Le coût usine d'Alpha Voice — ce que chaque appel nous coûte VRAIMENT, et ce
 * qu'il reste après.
 *
 * Ce module existait, testé, et n'était affiché nulle part : impossible de
 * savoir si un palier était rentable sans relire le code. Une offre dont on ne
 * voit pas la marge finit toujours par être vendue à perte.
 *
 * Le calcul se fait côté SERVEUR (`/api/voice-costs`) : le chiffre d'affaires
 * vient de la grille publique et les coûts fournisseurs de notre modèle — deux
 * choses qui n'ont rien à faire dans le navigateur. Le panneau n'est plus
 * qu'un afficheur.
 */
export function CostPanel() {
  // Les hypothèses par défaut sont RÉPÉTÉES ici plutôt qu'importées : elles ne
  // sont pas confidentielles (30 % de décroché en B2B froid, 2 min de
  // conversation), et le serveur les réapplique de toute façon si l'entrée est
  // absurde. C'est le prix à payer pour que le module de coût reste serveur.
  const [v, setV] = useState<Volume>({ calls: 1000, answerRatePct: 30, avgMinutesAnswered: 2, avgMinutesUnanswered: 0.4 });
  const [data, setData] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let vivant = true;
    setErreur(false);
    fetch("/api/voice-costs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(v),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Reponse) => {
        if (vivant) setData(d);
      })
      .catch(() => {
        // Pas de chiffre inventé : on le dit. Une marge affichée à zéro parce
        // que le réseau a lâché ressemble à une marge à zéro.
        if (vivant) setErreur(true);
      });
    return () => {
      vivant = false;
    };
  }, [v]);

  const eur2 = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const set = (patch: Partial<Volume>) => setV((s) => ({ ...s, ...patch }));
  const c = data?.breakdown;

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

      {erreur && (
        <p className="mt-3 rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-[12px] text-signal-red">
          Le calcul n&apos;a pas répondu — aucun chiffre affiché plutôt qu&apos;un chiffre faux. Recharge la page.
        </p>
      )}

      {c && (
        <>
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
              {data.fixed.map((f) => (
                <tr key={f.label} className="border-t border-ink-700">
                  <td className="py-1.5 text-paper-faint">{f.label} (fixe)</td>
                  <td className="py-1.5 text-right font-mono text-paper-faint">{eur2(f.eur)}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mt-5 font-display text-sm font-semibold text-paper">Jusqu&apos;où va le gratuit</h3>
          <p className="mt-1 rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-[12px] text-paper">{data.freeVerdict}</p>
          <ul className="mt-2 space-y-1.5">
            {data.freeTiers.map((t) => (
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
        </>
      )}
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
