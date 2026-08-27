"use client";

import { useMemo, useState } from "react";
import { ArgentDeDemo } from "@/components/argent-de-demo";
import {
  AlertTriangle, ArrowUpRight, Ban, CalendarClock, Check, ExternalLink, Flag, Gauge, Target, TrendingUp,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import {
  PALIERS, palierFor, palierProgress, leverageScore, daysToTarget, yearlyMultiple, DOUBLING_TRUTH,
  type LeverageInput,
} from "@/lib/paliers";
import { prioritized, urgency, daysLeft, type Opportunity } from "@/lib/opportunites";
import { FrenchTechPanel } from "@/components/mission/french-tech-panel";
import { cn } from "@/lib/utils";
import { DailyBar } from "@/components/standard/daily-bar";

/**
 * TRAJECTOIRE — où on en est, ce qui bloque, et ce qu'on fait aujourd'hui.
 *
 * Trois écrans en un :
 *   1. le PALIER courant, calculé sur le cash réellement encaissé ;
 *   2. la BARRE DU JOUR (ce qui doit être fait) puis le LEVIER (le rendement,
 *      mesuré, avec le goulot nommé) ;
 *   3. les OPPORTUNITÉS qui ferment bientôt (French Tech 2030 en tête).
 *
 * Le CA vient des paiements réels du CRM, jamais d'une saisie déclarative :
 * un tableau de bord qui se nourrit d'estimations ne sert qu'à se rassurer.
 */
export default function TrajectoirePage() {
  const prospects = useAlpha((s) => s.prospects);
  const now = useMemo(() => new Date(), []);

  // CA cumulé = ce qui est ENCAISSÉ. Pas le pipe, pas les promesses.
  const cashed = useMemo(
    () =>
      prospects.reduce(
        (s, p) => s + (p.payments ?? []).filter((x) => x.status === "paye").reduce((a, x) => a + x.amount, 0),
        0
      ),
    [prospects]
  );

  const palier = palierFor(cashed);
  const progress = palierProgress(cashed);
  const opportunities = useMemo(() => prioritized(now), [now]);

  // Le levier — saisie rapide, calcul immédiat.
  const [input, setInput] = useState<LeverageInput>({
    hours: 8,
    touches: 0,
    conversations: 0,
    meetings: 0,
    cashEur: 0,
    automatedTouches: 0,
  });
  const lev = leverageScore(input);
  const set = (k: keyof LeverageInput, v: number) => setInput((p) => ({ ...p, [k]: Math.max(0, v) }));

  const toTen = daysToTarget(Math.max(cashed, 1000), 10_000_000, 1);

  return (
    <div className="space-y-5 p-4">
      {/* Le palier se calcule sur le cash encaissé : si ce cash est fictif, le
          palier l'est aussi, et cet écran sert à décider quoi faire ensuite. */}
      <ArgentDeDemo prospects={prospects} />
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-paper">
        <TrendingUp size={20} className="text-bronze-400" /> Trajectoire
      </h1>

      {/* ── 1. LE PALIER ── */}
      <section className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-paper">{palier.name}</h2>
          <span className="font-mono text-[12px] text-bronze-400">
            {cashed.toLocaleString("fr-FR")} € encaissés
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-bronze-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-paper-faint">
          {progress}% du palier · prochaine borne {palier.toEur.toLocaleString("fr-FR")} €
        </p>

        <div className="mt-3 rounded-xl border border-signal-red/30 bg-signal-red/5 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-signal-red">
            <Target size={13} /> LA contrainte : {palier.constraint}
          </p>
          <p className="mt-1 text-[11.5px] text-paper-dim">{palier.why}</p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-paper-faint">À faire à ce palier</p>
            <ul className="mt-1 space-y-1">
              {palier.checklist.map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-[11.5px] text-paper-dim">
                  <Check size={12} className="mt-0.5 shrink-0 text-signal-green" /> {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-paper-faint">Ce qu&apos;on ne fait PAS encore</p>
            <ul className="mt-1 space-y-1">
              {palier.dontYet.map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-[11.5px] text-paper-dim">
                  <Ban size={12} className="mt-0.5 shrink-0 text-signal-red" /> {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] uppercase tracking-wider text-paper-faint">Portes de sortie</p>
            <ul className="mt-1 space-y-1">
              {palier.gates.map((g) => (
                <li key={g.label} className="flex items-start gap-1.5 text-[11.5px] text-paper-dim">
                  <Flag size={12} className="mt-0.5 shrink-0 text-bronze-400" />
                  <span>
                    <strong className="text-paper">{g.label}</strong> — {g.measure}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* La barre du jour — ce qui doit être vrai avant de fermer la journée */}
      <DailyBar />

      {/* ── 2. LE LEVIER ── */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <Gauge size={15} className="text-bronze-400" /> Le levier du jour
          </h2>
          <span
            className={cn(
              "font-display text-2xl font-bold",
              lev.score >= 70 ? "text-signal-green" : lev.score >= 40 ? "text-signal-amber" : "text-signal-red"
            )}
          >
            {lev.score}/100
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["hours", "Heures"],
              ["touches", "Touches"],
              ["automatedTouches", "dont auto"],
              ["conversations", "Conversations"],
              ["meetings", "RDV"],
              ["cashEur", "€ encaissés"],
            ] as [keyof LeverageInput, string][]
          ).map(([k, label]) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input
                type="number"
                className="input"
                value={input[k]}
                onChange={(e) => set(k, Number(e.target.value))}
              />
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <Metric label="Touches/h" value={lev.touchesPerHour.toFixed(1)} />
          <Metric label="Automatisé" value={`${lev.automationPct}%`} good={lev.automationPct >= 40} />
          <Metric label="Contact" value={`${lev.contactRate}%`} good={lev.contactRate >= 10} />
          <Metric label="→ RDV" value={`${lev.meetingRate}%`} good={lev.meetingRate >= 25} />
          <Metric label="€/heure" value={Math.round(lev.eurPerHour).toLocaleString("fr-FR")} />
        </div>

        <p className="mt-3 rounded-xl border border-bronze-700/40 bg-bronze-900/10 px-3 py-2 text-[12px] text-paper">
          <strong>Ce qui bloque :</strong> {lev.bottleneck}
        </p>

        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wider text-paper-faint">Aujourd&apos;hui, à ce palier</p>
          <ul className="mt-1 space-y-1">
            {palier.daily.map((d) => (
              <li key={d} className="flex items-start gap-1.5 text-[11.5px] text-paper-dim">
                <ArrowUpRight size={12} className="mt-0.5 shrink-0 text-bronze-400" /> {d}
              </li>
            ))}
          </ul>
        </div>

        {/* La vérité arithmétique, affichée là où la promesse serait tentante. */}
        <div className="mt-3 rounded-xl border border-line/50 bg-surface/30 p-3">
          <p className="text-[11.5px] text-paper-dim">{DOUBLING_TRUTH}</p>
          <p className="mt-1.5 text-[11.5px] text-bronze-400">
            À +1 %/jour : ×{yearlyMultiple(1).toFixed(1)} en un an
            {toTen ? ` · ${toTen} jours pour atteindre 10 M€ depuis ton niveau actuel` : ""}. À +2 %/jour : ×
            {Math.round(yearlyMultiple(2)).toLocaleString("fr-FR")}.
          </p>
        </div>
      </section>

      {/* ── 3. LES OPPORTUNITÉS ── */}
      <FrenchTechPanel />

      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <CalendarClock size={15} className="text-bronze-400" /> Opportunités — l&apos;argent hors client
        </h2>
        <ul className="mt-2 space-y-3">
          {opportunities.map((o) => (
            <OpportunityRow key={o.id} o={o} now={now} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg border border-line/40 bg-surface/30 px-2 py-1.5">
      <p className="text-[10.5px] text-paper-faint">{label}</p>
      <p className={cn("font-mono text-[13px]", good === undefined ? "text-paper" : good ? "text-signal-green" : "text-signal-amber")}>
        {value}
      </p>
    </div>
  );
}

function OpportunityRow({ o, now }: { o: Opportunity; now: Date }) {
  const u = urgency(o, now);
  const d = daysLeft(o, now);
  const tone =
    u === "critique" ? "text-signal-red" : u === "urgente" ? "text-signal-amber" : "text-paper-faint";
  const fitTone =
    o.fit === "fort" ? "text-signal-green" : o.fit === "plausible" ? "text-signal-amber" : "text-paper-faint";

  return (
    <li className="rounded-xl border border-line/50 bg-surface/30 p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-[13px] font-semibold text-paper">{o.name}</span>
        <span className={cn("text-[11px]", fitTone)}>adéquation : {o.fit}</span>
        {d !== null && (
          <span className={cn("ml-auto font-mono text-[11.5px]", tone)}>
            {d > 0 ? `J-${d}` : "échéance passée"}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11.5px] text-paper-dim">{o.gain}</p>
      <p className="mt-1 text-[11px] italic text-paper-faint">{o.fitWhy}</p>

      <details className="mt-2">
        <summary className="cursor-pointer text-[11.5px] text-bronze-400">Les étapes du dossier</summary>
        <ol className="mt-1 space-y-0.5 pl-4">
          {o.steps.map((s, i) => (
            <li key={s} className="list-decimal text-[11.5px] text-paper-dim">
              {s}
            </li>
          ))}
        </ol>
        {o.risks?.length ? (
          <ul className="mt-1.5 space-y-0.5">
            {o.risks.map((r) => (
              <li key={r} className="flex items-start gap-1.5 text-[11px] text-signal-amber">
                <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {r}
              </li>
            ))}
          </ul>
        ) : null}
      </details>

      {o.url && (
        <a
          href={o.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-bronze-400 hover:underline"
        >
          Ouvrir <ExternalLink size={11} />
        </a>
      )}
    </li>
  );
}
