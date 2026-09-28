"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, Filter, RefreshCw, Target as TargetIcon, TrendingUp } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { computeCampaignFunnel, pct, type FunnelRecord } from "@/lib/campaign-funnel";
import { REV_SHARE } from "@/lib/pricing";
import { cn, eur } from "@/lib/utils";

/**
 * Rollup KPIs — la vue « d'en haut » :
 *  · funnel GLOBAL agrégé sur toutes les campagnes (tracking réel × pipeline)
 *  · benchmarks vs cibles du RUNBOOK (la ligne dorée : vert = on est dessus)
 *  · comparatif par campagne (où investir l'effort)
 *  · économie EAGLEYE : CA généré, notre part (30 %), MRR, LTV moyenne
 */

/** Cibles du RUNBOOK (§4) — la ligne dorée. */
const TARGETS = [
  { key: "openRate", label: "Taux d'ouverture", good: 40, warn: 25, unit: "%" },
  { key: "replyRate", label: "Taux de réponse", good: 5, warn: 2, unit: "%" },
  { key: "meetingsPer1000", label: "RDV / 1 000 prospects", good: 15, warn: 5, unit: "" },
] as const;

export function KpisRollup() {
  const prospects = useAlpha((s) => s.prospects);
  const campaigns = useAlpha((s) => s.campaigns);
  const commissionPct = useAlpha((s) => s.settings.commissionPct);
  const [records, setRecords] = useState<FunnelRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/track/stats")
      .then((r) => r.json())
      .then((d) => setRecords(Array.isArray(d.records) ? d.records : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const global = useMemo(() => computeCampaignFunnel(records, prospects), [records, prospects]);

  const perCampaign = useMemo(() => {
    const byId = new Map<string, FunnelRecord[]>();
    for (const r of records) {
      if (!r.campaignId) continue;
      const arr = byId.get(r.campaignId) ?? [];
      arr.push(r);
      byId.set(r.campaignId, arr);
    }
    return campaigns
      .map((c) => ({ campaign: c, recs: byId.get(c.id) ?? [] }))
      .filter((x) => x.recs.length > 0)
      .map((x) => ({ name: x.campaign.name, f: computeCampaignFunnel(x.recs, prospects) }))
      .sort((a, b) => b.f.ltv - a.f.ltv);
  }, [records, campaigns, prospects]);

  // Économie : sur les clients signés (source pipeline, indépendante du tracking)
  const signed = prospects.filter((p) => p.stage === "signe");
  const caAn1 = signed.reduce((s, p) => s + p.setupValue + p.monthlyValue * 12, 0);
  // Deux pourcentages DIFFÉRENTS portaient le même nom, et l'un affichait
  // l'autre :
  //  · `commissionPct` = ce qui NOUS revient sur le deal. 100 % sur EAGLEYE
  //    (c'est notre société), 30 % / 15 % là où on est intermédiaire.
  //  · `REV_SHARE`     = la part du CA GÉNÉRÉ qu'on facture à un client dans
  //    l'offre « setup + 30 % ». C'est le prix, pas notre marge.
  // Le texte disait « le client garde 100 − commissionPct % » : sur un deal
  // EAGLEYE à 100 %, ça affichait « garde 0 % », ce qui ne veut rien dire.
  const partPct = commissionPct || Math.round(REV_SHARE * 100);
  const ourCut = caAn1 * (partPct / 100);
  const clientGardePct = 100 - Math.round(REV_SHARE * 100);
  const mrr = signed.reduce((s, p) => s + p.monthlyValue, 0);
  const avgLtv = signed.length ? Math.round(caAn1 / signed.length) : 0;

  // Benchmarks (base = personnes touchées via tracking)
  const b = global.people;
  const metrics: Record<(typeof TARGETS)[number]["key"], number> = {
    openRate: pct(global.opened, b),
    replyRate: pct(global.responded, b),
    meetingsPer1000: b > 0 ? Math.round((global.followThru / b) * 1000) : 0,
  };

  const steps = [
    { label: "Délivré", value: global.people, pctOf: 100 },
    { label: "Ouvert", value: global.opened, pctOf: pct(global.opened, b) },
    { label: "Réponse", value: global.responded, pctOf: pct(global.responded, b) },
    { label: "Follow-thru (démo+)", value: global.followThru, pctOf: pct(global.followThru, b) },
    { label: "Closed", value: global.closed, pctOf: pct(global.closed, b) },
  ];

  return (
    <>
      {/* Funnel global */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <Filter size={15} className="text-bronze-400" /> Funnel global — toutes campagnes
          </h2>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {loading ? "…" : "Rafraîchir"}
          </button>
        </div>
        {b === 0 ? (
          <p className="mt-3 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 text-[12px] text-paper-faint">
            Aucun envoi tracké pour l&apos;instant — lance une campagne (<Link href="/campaigns" className="text-bronze-400 underline">Réviser &amp; envoyer</Link>) et le funnel se remplit tout seul.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-right text-[12px] text-paper-dim">{s.label}</span>
                <div className="h-7 flex-1 overflow-hidden rounded-md bg-ink-800">
                  <div
                    className={cn("flex h-full items-center rounded-md px-2 font-mono text-[11px] text-goldink", i === steps.length - 1 ? "bg-signal-green" : "bg-gold")}
                    style={{ width: `${Math.max(s.pctOf, s.value > 0 ? 6 : 0)}%` }}
                  >
                    {s.value > 0 && s.value}
                  </div>
                </div>
                <span className="w-12 shrink-0 font-mono text-[12px] text-bronze-400">{s.pctOf}%</span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-paper-faint">
              Base = {b} personne(s) touchée(s) (dédupliquées) · {global.sends} envoi(s) · follow-up {pct(global.followUp, b)} % · satisfaction moyenne {global.satisfaction ?? "—"}{global.satisfaction !== null && "/100"}
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* La ligne dorée — benchmarks RUNBOOK */}
        <div className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <TargetIcon size={15} className="text-bronze-400" /> La ligne dorée (cibles RUNBOOK)
          </h2>
          <table className="mt-3 w-full text-[13px]">
            <thead>
              <tr className="text-left font-mono text-[9px] uppercase tracking-[0.14em] text-paper-faint">
                <th className="pb-2 font-medium">Métrique</th>
                <th className="pb-2 font-medium">Réel</th>
                <th className="pb-2 font-medium">Cible</th>
                <th className="pb-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {TARGETS.map((t) => {
                const v = metrics[t.key];
                const status = b === 0 ? "—" : v >= t.good ? "ok" : v >= t.warn ? "warn" : "bad";
                return (
                  <tr key={t.key} className="border-t border-ink-700/60">
                    <td className="py-2 text-paper-dim">{t.label}</td>
                    <td className="py-2 font-mono text-paper">{b === 0 ? "—" : `${v}${t.unit}`}</td>
                    <td className="py-2 font-mono text-paper-faint">≥ {t.good}{t.unit}</td>
                    <td className="py-2">
                      {status === "—" ? <span className="text-paper-faint">—</span>
                        : status === "ok" ? <span className="chip border-signal-green/40 text-signal-green">sur la ligne ✓</span>
                        : status === "warn" ? <span className="chip border-bronze-700 text-bronze-400">à travailler</span>
                        : <span className="chip border-signal-red/40 text-signal-red">alerte</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] italic text-paper-faint">
            Sous la ligne → revois le message, pas le volume. Le volume sans qualité brûle le domaine.
            {b > 0 && b < 30 && (
              <span className="mt-1 block not-italic text-bronze-400">
                ⚠ Échantillon de {b} — les taux ne veulent rien dire avant ~30 personnes touchées.
              </span>
            )}
          </p>
        </div>

        {/* Économie EAGLEYE */}
        <div className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <Banknote size={15} className="text-bronze-400" /> Économie — le no-brainer chiffré
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Eco label="CA généré (an 1, signés)" value={eur(Math.round(caAn1))} accent />
            <Eco label={`Notre part (${partPct} %)`} value={eur(Math.round(ourCut))} accent />
            <Eco label="MRR signé" value={eur(mrr)} />
            <Eco label="LTV moyenne / client" value={signed.length ? eur(avgLtv) : "—"} />
          </div>
          <p className="mt-3 rounded-lg border border-bronze-700/40 bg-bronze-900/20 px-3 py-2 text-[12px] text-paper-dim">
            {signed.length > 0 ? (
              <>Chaque client signé rapporte en moyenne <strong className="text-paper">{eur(avgLtv)}</strong> la première année. En partage de revenu, il garde {clientGardePct} % d&apos;un CA qu&apos;il n&apos;aurait pas eu — c&apos;est l&apos;argument à dérouler en RDV (<Link href="/offre" className="text-bronze-400 underline">calculateur</Link>).</>
            ) : (
              <>Dès la première signature, cette carte devient ton argumentaire : CA généré, ta part, ce que le client garde. <Link href="/offre" className="text-bronze-400 underline">Voir le calculateur</Link>.</>
            )}
          </p>
        </div>
      </section>

      {/* Comparatif par campagne */}
      {perCampaign.length > 0 && (
        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <TrendingUp size={15} className="text-bronze-400" /> Comparatif campagnes — où investir l&apos;effort
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[9px] uppercase tracking-[0.14em] text-paper-faint">
                  <th className="pb-2 font-medium">Campagne</th>
                  <th className="pb-2 text-right font-medium">Délivré</th>
                  <th className="pb-2 text-right font-medium">Ouvert</th>
                  <th className="pb-2 text-right font-medium">Réponse</th>
                  <th className="pb-2 text-right font-medium">Follow-thru</th>
                  <th className="pb-2 text-right font-medium">Closed</th>
                  <th className="pb-2 text-right font-medium">LTV</th>
                </tr>
              </thead>
              <tbody>
                {perCampaign.map(({ name, f }) => (
                  <tr key={name} className="border-t border-ink-700/60">
                    <td className="max-w-56 truncate py-2 text-paper" title={name}>{name}</td>
                    <td className="py-2 text-right font-mono text-paper">{f.people}</td>
                    <td className="py-2 text-right font-mono text-paper-dim">{pct(f.opened, f.people)}%</td>
                    <td className="py-2 text-right font-mono text-paper-dim">{pct(f.responded, f.people)}%</td>
                    <td className="py-2 text-right font-mono text-paper-dim">{pct(f.followThru, f.people)}%</td>
                    <td className="py-2 text-right font-mono text-signal-green">{f.closed}</td>
                    <td className="py-2 text-right font-mono text-bronze-400">{eur(f.ltv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function Eco({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
      <p className={cn("font-mono text-lg", accent ? "text-bronze-400" : "text-paper")}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-paper-faint">{label}</p>
    </div>
  );
}
