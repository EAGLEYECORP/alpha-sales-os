"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Coins,
  Flame,
  Target,
  TrendingUp,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { SEED_PROSPECT_IDS } from "@/lib/seed";
import { STAGES, BLAME_LAYERS, weightedValue, ignoranceTaxTotal, nextBestAction } from "@/lib/hormozi";
import type { BlameLayer, Sector } from "@/lib/types";
import { eur, isOverdue, relativeFr } from "@/lib/utils";
import { useCountUp } from "@/lib/use-count-up";
import { FunnelChart, ForecastChart, SectorChart } from "@/components/charts";
import { StageBadge } from "@/components/ui/stage-badge";

const SECTORS: Sector[] = ["restaurant", "pub", "ambulance", "artisan"];
const SECTOR_LABELS: Record<string, string> = {
  restaurant: "Restos",
  pub: "Pubs",
  ambulance: "Ambulances",
  artisan: "Artisans",
  autre: "Autres",
};

export default function DashboardPage() {
  const { prospects, meetings, settings } = useAlpha();

  const active = prospects.filter((p) => !["signe", "perdu"].includes(p.stage));
  const signed = prospects.filter((p) => p.stage === "signe");
  const mrrSigned = signed.reduce((s, p) => s + p.monthlyValue, 0);
  const pipeWeighted = prospects.reduce((s, p) => s + weightedValue(p), 0);
  const taxTotal = active.reduce((s, p) => s + p.ignoranceTax, 0);
  const commission = mrrSigned * 12 * (settings.commissionPct / 100);

  const funnelData = STAGES.filter((s) => !["perdu"].includes(s.id)).map((s) => ({
    name: s.label,
    value: prospects.filter((p) => p.stage === s.id).length,
  }));

  // 6-month forecast: signed MRR flat + weighted pipe converting linearly.
  const monthlyWeighted = active.reduce((s, p) => s + (p.monthlyValue * p.probability) / 100, 0);
  const months = ["M0", "M+1", "M+2", "M+3", "M+4", "M+5"];
  const forecastData = months.map((name, i) => ({
    name,
    signe: mrrSigned,
    pondere: mrrSigned + monthlyWeighted * (i / 5),
  }));

  const sectorData = SECTORS.map((sec) => ({
    name: SECTOR_LABELS[sec],
    value: prospects.filter((p) => p.sector === sec).reduce((s, p) => s + weightedValue(p), 0),
  }));

  // Blocker heatmap: open obstacles by blame layer × sector.
  const layers = Object.keys(BLAME_LAYERS) as BlameLayer[];
  const heat = layers.map((layer) => ({
    layer,
    cells: SECTORS.map((sec) => {
      const n = prospects
        .filter((p) => p.sector === sec)
        .flatMap((p) => p.obstacles)
        .filter((o) => !o.resolved && o.blameLayer === layer).length;
      return { sec, n };
    }),
  }));
  const maxHeat = Math.max(1, ...heat.flatMap((h) => h.cells.map((c) => c.n)));

  const lostReasons = prospects.filter((p) => p.lostReason).map((p) => p.lostReason!);

  const overdue = active.filter((p) => p.nextStep && isOverdue(p.nextStep.date));
  const noStep = active.filter((p) => !p.nextStep);
  const upcoming = meetings
    .filter((m) => !m.done && new Date(m.date) > new Date(Date.now() - 864e5))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const hottest = [...active].sort((a, b) => weightedValue(b) - weightedValue(a)).slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-paper">Dashboard</h1>
          <p className="text-sm text-paper-faint">
            Émotion d&apos;abord, logique ensuite. Chaque contact se termine par un next step daté.
          </p>
        </div>
        <Link href="/pipeline" className="btn-bronze">
          Pipeline <ArrowRight size={15} />
        </Link>
      </header>

      {/* KPI tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<TrendingUp size={16} />} label="MRR signé" value={mrrSigned} sub={`${signed.length} client(s)`} />
        <Kpi icon={<Target size={16} />} label="Pipe pondéré (annuel)" value={pipeWeighted} sub={`${active.length} deals actifs`} accent />
        <Kpi icon={<Flame size={16} />} label="Taxe d'Ignorance du pipe" value={taxTotal} suffix="/mois" sub="ce que les prospects perdent" tone="red" />
        <Kpi icon={<Coins size={16} />} label={`Commission ${settings.commissionPct}% (CA an)`} value={commission} sub="sur MRR signé" />
      </section>

      {/* Demo-data banner — push toward real data */}
      {prospects.some((p) => SEED_PROSPECT_IDS.includes(p.id)) && (
        <section className="card border-bronze-700/60 bg-bronze-900/20 px-4 py-3">
          <p className="text-sm text-paper">
            <strong className="text-bronze-300">Données de démo actives.</strong>{" "}
            <span className="text-paper-dim">
              Pour passer en réel :{" "}
              <Link href="/settings" className="text-bronze-400 underline hover:text-bronze-300">
                Réglages → Tout vider
              </Link>{" "}
              puis importe ton Google Sheet / CSV (prospects + deep audit).
            </span>
          </p>
        </section>
      )}

      {/* Doctrine alerts */}
      {(overdue.length > 0 || noStep.length > 0) && (
        <section className="card border-signal-red/40 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-signal-red">
            <AlertTriangle size={15} /> Violations doctrine — à corriger aujourd&apos;hui
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {overdue.map((p) => (
              <li key={p.id}>
                <Link href={`/prospects/${p.id}`} className="text-paper hover:text-bronze-300">
                  {p.company}
                </Link>{" "}
                <span className="text-paper-faint">
                  — next step en retard ({relativeFr(p.nextStep!.date)}) : {p.nextStep!.action}
                </span>
              </li>
            ))}
            {noStep.map((p) => (
              <li key={p.id}>
                <Link href={`/prospects/${p.id}`} className="text-paper hover:text-bronze-300">
                  {p.company}
                </Link>{" "}
                <span className="text-paper-faint">— AUCUN next step daté. Interdit par la doctrine.</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Charts row */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-2 font-display text-sm font-semibold text-paper">Funnel de conversion</h2>
          <FunnelChart data={funnelData} />
        </div>
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-paper">Prévision MRR — 6 mois</h2>
            <span className="text-[11px] text-paper-faint">
              clair = signé · foncé = pondéré · objectif {eur(settings.targetMRR)}
            </span>
          </div>
          <ForecastChart data={forecastData} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h2 className="mb-2 font-display text-sm font-semibold text-paper">Pipe par secteur</h2>
          <SectorChart data={sectorData} />
        </div>

        {/* Blocker heatmap */}
        <div className="card p-4">
          <h2 className="mb-1 font-display text-sm font-semibold text-paper">Oignon du Blâme — obstacles ouverts</h2>
          <p className="mb-3 text-[11px] text-paper-faint">couche × secteur (nombre d&apos;obstacles)</p>
          <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-1 text-[11px]">
            <span />
            {SECTORS.map((s) => (
              <span key={s} className="text-center text-paper-faint">{SECTOR_LABELS[s]}</span>
            ))}
            {heat.map(({ layer, cells }) => (
              <FragmentRow key={layer} label={BLAME_LAYERS[layer].label} cells={cells} maxHeat={maxHeat} />
            ))}
          </div>
          <p className="mt-3 text-[11px] italic text-paper-faint">
            « On épluche, on n&apos;argumente pas. »
          </p>
        </div>

        {/* Win/loss reasons */}
        <div className="card p-4">
          <h2 className="mb-2 font-display text-sm font-semibold text-paper">Raisons de perte</h2>
          {lostReasons.length === 0 ? (
            <p className="text-sm text-paper-faint">Aucune perte documentée. Continue.</p>
          ) : (
            <ul className="space-y-2">
              {lostReasons.map((r, i) => (
                <li key={i} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-paper-dim">
                  {r}
                </li>
              ))}
            </ul>
          )}
          <h2 className="mb-2 mt-4 font-display text-sm font-semibold text-paper">Deals les plus chauds</h2>
          <ul className="space-y-2">
            {hottest.map((p) => (
              <li key={p.id}>
                <Link href={`/prospects/${p.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm hover:border-bronze-700">
                  <span className="truncate text-paper">{p.company}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <StageBadge stage={p.stage} />
                    <span className="font-mono text-bronze-400">{eur(weightedValue(p))}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Next best actions + meetings */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-display text-sm font-semibold text-paper">Prochaines meilleures actions</h2>
          <ul className="space-y-2.5">
            {active.slice(0, 5).map((p) => {
              const nba = nextBestAction(p);
              return (
                <li key={p.id} className="flex gap-3">
                  <span
                    className={
                      nba.urgency === "haute"
                        ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-signal-red animate-pulse-ring"
                        : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-bronze-500"
                    }
                  />
                  <div className="min-w-0">
                    <Link href={`/prospects/${p.id}`} className="text-sm font-medium text-paper hover:text-bronze-300">
                      {p.company}
                    </Link>
                    <p className="text-sm text-paper-dim">{nba.action}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <CalendarClock size={15} className="text-bronze-400" /> Rendez-vous à venir
          </h2>
          <ul className="space-y-2">
            {upcoming.map((m) => {
              const p = prospects.find((x) => x.id === m.prospectId);
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-paper">{m.title}</p>
                    <p className="text-[11px] text-paper-faint">{m.location} · {p?.city ?? ""}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-bronze-400">{relativeFr(m.date)}</span>
                </li>
              );
            })}
            {upcoming.length === 0 && <p className="text-sm text-paper-faint">Aucun RDV planifié — le terrain n&apos;attend pas.</p>}
          </ul>
        </div>
      </section>

      {/* Ignorance tax cumulative */}
      <section className="card p-4">
        <h2 className="mb-2 font-display text-sm font-semibold text-paper">Compteur Taxe d&apos;Ignorance cumulée</h2>
        <p className="text-[11px] text-paper-faint mb-3">
          Ce que chaque prospect actif a déjà perdu depuis qu&apos;on le connaît — l&apos;argument massue au closing.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {active.slice(0, 8).map((p) => (
            <Link key={p.id} href={`/prospects/${p.id}`} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 hover:border-bronze-700">
              <p className="truncate text-xs text-paper-dim">{p.company}</p>
              <p className="font-mono text-base text-signal-red">−{eur(ignoranceTaxTotal(p))}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function FragmentRow({
  label,
  cells,
  maxHeat,
}: {
  label: string;
  cells: { sec: string; n: number }[];
  maxHeat: number;
}) {
  return (
    <>
      <span className="pr-2 py-1.5 text-paper-dim">{label}</span>
      {cells.map((c) => (
        <span
          key={c.sec}
          title={`${c.n} obstacle(s)`}
          className="grid h-8 place-items-center rounded font-mono text-paper"
          style={{ background: `rgba(176,141,87,${c.n === 0 ? 0.06 : 0.15 + 0.65 * (c.n / maxHeat)})` }}
        >
          {c.n || ""}
        </span>
      ))}
    </>
  );
}

function Kpi({
  icon,
  label,
  value,
  suffix,
  sub,
  tone,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  sub: string;
  tone?: "red";
  accent?: boolean;
}) {
  const animated = useCountUp(value);
  return (
    <div className="card card-hover p-4">
      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-faint">
        <span className="text-bronze-400">{icon}</span> {label}
      </p>
      <p
        className={`mt-1.5 font-display text-2xl font-extrabold md:text-[28px] ${
          tone === "red" ? "text-signal-red" : accent ? "text-bronze-400" : "text-paper"
        }`}
      >
        {eur(Math.round(animated))}
        {suffix && <span className="text-sm font-semibold text-paper-faint">{suffix}</span>}
      </p>
      <p className="text-[11px] text-paper-faint">{sub}</p>
    </div>
  );
}
