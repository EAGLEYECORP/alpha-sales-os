"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, Info, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { Prospect } from "@/lib/types";
import { recovery } from "@/lib/recovery";
import { renderRecoveryDoc, brandFromSettings } from "@/lib/audit-doc";
import { useAlpha } from "@/lib/store";
import { eur } from "@/lib/utils";

/**
 * « Projette-toi » — projection de récupération sur LES chiffres du prospect.
 * À montrer en RDV : le client voit, sur ses propres données, ce qu'il laisse
 * sur la table et ce qu'il récupère. C'est une ESTIMATION, pas une garantie
 * (legal/GARANTIES.md) — dit à l'écran.
 */
export function RecoveryProjection({ p }: { p: Prospect }) {
  const { settings } = useAlpha();
  const d = p.deepAudit;
  const [missed, setMissed] = useState(d.missedCallsPerWeek ?? 10);
  const [ticket, setTicket] = useState(d.avgTicket ?? 200);
  const [conv, setConv] = useState(d.conversionRate ?? 30);

  const input = { missedPerWeek: missed, avgTicket: ticket, conversionPct: conv };
  const r = useMemo(() => recovery(input), [missed, ticket, conv]);

  const doc = () => renderRecoveryDoc(p, input, settings.closerName, settings.bookingUrl, brandFromSettings(settings));
  const openDoc = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(doc());
    w.document.close();
  };
  const downloadDoc = () => {
    const blob = new Blob([doc()], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `projection-${(p.company || "prospect").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-bronze-400" />
          <h2 className="font-display text-sm font-semibold text-paper">
            Projette-toi — ce que {p.company || "cette entreprise"} récupère
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={openDoc} title="Ouvrir la projection brandée (imprimable en PDF) — à laisser au prospect">
            <ExternalLink size={13} /> Imprimer / laisser
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={downloadDoc} title="Télécharger la projection (.html, imprimable en PDF)">
            <Download size={13} /> Télécharger
          </button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-paper-faint">
        Sur ses propres chiffres. À montrer en RDV : la décision devient une évidence chiffrée. Le document reprend les
        valeurs des curseurs — ajuste avant d&apos;imprimer.
      </p>

      <div className="mt-3 grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <Slider label="Contacts / appels manqués par semaine" value={missed} min={0} max={100} step={1} onChange={setMissed} fmt={(v) => String(v)} />
          <Slider label="Panier moyen d'une vente" value={ticket} min={0} max={10000} step={50} onChange={setTicket} fmt={eur} />
          <Slider label="% qui aurait converti" value={conv} min={0} max={100} step={1} onChange={setConv} fmt={(v) => `${v} %`} />
        </div>

        <div className="flex flex-col justify-center gap-3">
          <div className="rounded-xl border border-signal-red/30 bg-signal-red/5 p-4 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">Perdu aujourd&apos;hui / mois</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-signal-red">{eur(r.perMonth)}</p>
            <p className="mt-0.5 text-[11px] text-paper-faint">≈ {eur(r.perYear)} / an · {r.salesPerMonth.toFixed(1)} ventes/mois</p>
          </div>
          <div className="rounded-xl border border-signal-green/30 bg-signal-green/5 p-3 text-center">
            <p className="text-[12px] text-paper-dim">
              Avec la machine qui rappelle et relance 24/7, c&apos;est ce que tu vises à{" "}
              <strong className="text-signal-green">récupérer</strong> — sans embaucher.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[10.5px] text-paper-faint">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          <strong>Estimation</strong>, pas une garantie : elle dépend de tes chiffres réels. On garantit le procédé (zéro
          lead perdu, 24/7), jamais un montant.{" "}
          <Link href="/offre" className="text-bronze-400 hover:underline">Voir le calculateur d&apos;offre →</Link>
        </span>
      </p>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-paper-dim">{label}</span>
        <span className="font-mono font-semibold text-bronze-400">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="mt-1 w-full accent-bronze-500"
      />
    </div>
  );
}
