"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Infinity as InfinityIcon, Lock, OctagonX, Search, Trophy } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { computeCampaignFunnel, type CampaignFunnel, type FunnelRecord } from "@/lib/campaign-funnel";
import { auditDepth, computeCycle, computeMilestones, conversationEfficiency } from "@/lib/milestones";
import { cn } from "@/lib/utils";

/**
 * Jalons — 10 → 100 → 1 000 → 10 000 → 100 000.
 * La croissance mesurée sur la CONVERSATION (pas la tech) : profondeur du
 * deep-dive, efficacité de chaque transition du cycle infini, portes de
 * passage du RUNBOOK calculées sur les vraies données.
 */

function Bar({ value, target }: { value: number | null; target: number | null }) {
  if (value === null) return <div className="h-1.5 w-full rounded-full bg-ink-700" />;
  const p = target ? Math.min(100, (value / target) * 100) : Math.min(100, value);
  const good = target !== null && value >= target;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div className={cn("h-full rounded-full transition-all", good ? "bg-signal-green" : "bg-gold")} style={{ width: `${Math.max(p, 4)}%` }} />
    </div>
  );
}

export default function MilestonesPage() {
  const { prospects } = useAlpha();
  const [funnel, setFunnel] = useState<CampaignFunnel | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/track/stats");
        if (!res.ok) return;
        const s = await res.json();
        const records: FunnelRecord[] = (s.records ?? []).map((r: { id: string; campaignId?: string; prospectId?: string; opens: number; clicks: number }) => ({
          id: r.id, campaignId: r.campaignId, prospectId: r.prospectId, opens: r.opens, clicks: r.clicks,
        }));
        if (alive) setFunnel(computeCampaignFunnel(records, prospects));
      } catch {
        /* pas de stats → le funnel reste null, les jauges affichent « à mesurer » */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycle = useMemo(() => computeCycle(prospects, funnel), [prospects, funnel]);
  const eff = useMemo(() => conversationEfficiency(cycle), [cycle]);
  const { milestones, engaged, current } = useMemo(() => computeMilestones(prospects, funnel), [prospects, funnel]);

  const stops = prospects.filter((p) => p.stage === "perdu").length;
  const shallow = useMemo(
    () =>
      prospects
        .filter((p) => p.stage !== "perdu" && p.stage !== "signe")
        .map((p) => ({ p, d: auditDepth(p) }))
        .sort((a, b) => a.d.score - b.d.score)
        .slice(0, 5),
    [prospects]
  );

  const progressToNext = Math.min(100, Math.round((engaged / current.n) * 100));

  return (
    <div className="space-y-5 animate-fade-up">
      <header>
        <h1 className="font-display text-2xl font-bold text-paper">Jalons — le cycle infini</h1>
        <p className="text-sm text-paper-faint">
          On ne monte pas en volume, on monte en niveau : la conversation d&apos;abord, l&apos;échelle ensuite.
        </p>
      </header>

      {/* Où j'en suis */}
      <section className="card border-bronze-700/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper-faint">Jalon en cours</p>
            <h2 className="mt-0.5 font-display text-xl font-extrabold text-paper">
              {current.n.toLocaleString("fr-FR")} — {current.title}
            </h2>
            <p className="mt-1 text-[13px] italic text-bronze-400">« {current.motto} »</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-extrabold text-paper">{engaged.toLocaleString("fr-FR")}</p>
            <p className="text-[11px] text-paper-faint">prospects engagés / {current.n.toLocaleString("fr-FR")}</p>
          </div>
        </div>
        <div className="mt-3"><Bar value={progressToNext} target={100} /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
            <p className="text-[11px] text-paper-faint">Efficacité de conversation (vs ligne dorée)</p>
            <p className="mt-1 font-display text-2xl font-bold text-paper">{eff === null ? "—" : `${eff} %`}</p>
            <div className="mt-2"><Bar value={eff} target={100} /></div>
            <p className="mt-1.5 text-[10.5px] text-paper-faint">
              Moyenne des étapes mesurées du cycle, chacune rapportée à sa cible. 100 % = chaque conversation au niveau des meilleurs.
            </p>
          </div>
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-paper-faint"><InfinityIcon size={12} /> Le pipeline ne rétrécit jamais</p>
            <p className="mt-1 text-[13px] text-paper-dim">
              <strong className="text-paper">{stops}</strong> perdu(s)/STOP — chacun se remplace par une cible de
              <strong className="text-paper"> niveau supérieur</strong> (formulaire sourcing n8n), et chaque client livré
              <strong className="text-paper"> redevient un prospect</strong> via l&apos;analyse d&apos;upsell. Croissance nette, réputation intacte.
            </p>
          </div>
        </div>
      </section>

      {/* Le cycle infini */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <InfinityIcon size={15} className="text-bronze-400" /> Le cycle — chaque transition est une conversation à optimiser
        </h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {cycle.map((s, i) => {
            const good = s.value !== null && s.target !== null && s.value >= s.target;
            return (
              <div key={s.key} className={cn("rounded-lg border p-3", good ? "border-signal-green/40 bg-signal-green/5" : "border-ink-700 bg-ink-850")}>
                <p className="font-mono text-[9.5px] uppercase tracking-wider text-paper-faint">{i + 1} · {s.label}</p>
                <p className="mt-1 font-display text-lg font-bold text-paper">
                  {s.value === null ? "à mesurer" : `${s.value}${s.unit === "/100" ? "" : " %"}`}
                  {s.target !== null && <span className="ml-1 text-[10px] font-normal text-paper-faint">/ {s.target}{s.unit === "/100" ? "" : " %"}</span>}
                </p>
                <div className="mt-1.5"><Bar value={s.value} target={s.target} /></div>
                <p className="mt-1.5 text-[10.5px] leading-snug text-paper-faint">{s.desc}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-bronze-400">
          <InfinityIcon size={13} /> …et l&apos;étape 10 renvoie à l&apos;étape 1 : l&apos;upsell scoré ré-entre dans le pipeline comme un prospect chaud. C&apos;est la boucle qui rend la croissance infinie.
        </p>
      </section>

      {/* Profondeur d'audit — le levier n°1 */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Search size={15} className="text-bronze-400" /> Le ciblage commence par la connaissance — audits les moins profonds
        </h2>
        <p className="mt-1 text-[12px] text-paper-faint">
          10 dimensions par prospect : sa position marché, à qui parle son offre, sa douleur chiffrée, quoi lui proposer.
          Plus l&apos;audit est profond, plus le message est irrésistible — travaille ceux-ci en premier.
        </p>
        {shallow.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-paper-dim">Aucun prospect actif — importe ou source pour commencer.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-700/50">
            {shallow.map(({ p, d }) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link href={`/prospects/${p.id}`} className="min-w-[140px] text-[13px] font-medium text-paper underline-offset-2 hover:text-bronze-400 hover:underline">
                  {p.company}
                </Link>
                <span className={cn("chip", d.score >= 70 ? "border-signal-green/50 text-signal-green" : "border-bronze-700 text-bronze-400")}>{d.score} %</span>
                <span className="flex flex-wrap gap-1">
                  {d.dims.filter((x) => !x.filled).slice(0, 4).map((x) => (
                    <span key={x.key} className="chip border-ink-600 text-paper-faint">{x.label}</span>
                  ))}
                  {d.dims.filter((x) => !x.filled).length > 4 && (
                    <span className="text-[10px] text-paper-faint">+{d.dims.filter((x) => !x.filled).length - 4}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* L'échelle des jalons */}
      <section className="space-y-3">
        {milestones.map((m) => (
          <div
            key={m.n}
            className={cn(
              "card p-4 transition-opacity",
              m.status === "done" && "border-signal-green/50",
              m.status === "current" && "border-bronze-600",
              m.status === "locked" && "opacity-55"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-display text-[15px] font-bold text-paper">
                {m.status === "done" ? (
                  <Trophy size={16} className="text-signal-green" />
                ) : m.status === "current" ? (
                  <Trophy size={16} className="text-bronze-400" />
                ) : (
                  <Lock size={15} className="text-paper-faint" />
                )}
                {m.n.toLocaleString("fr-FR")} · {m.title}
                {m.status === "done" && <span className="chip border-signal-green/50 text-signal-green">passé ✓</span>}
                {m.status === "current" && <span className="chip border-bronze-700 text-bronze-400">en cours</span>}
              </h3>
              <p className="text-[12px] italic text-paper-faint">« {m.motto} »</p>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-wider text-paper-faint">Portes de passage (mesurées en direct)</p>
                <ul className="mt-1.5 space-y-1.5">
                  {m.gates.map((g) => (
                    <li key={g.label} className="flex items-start gap-2">
                      {g.pass === true ? (
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-signal-green" />
                      ) : g.pass === false ? (
                        <OctagonX size={14} className="mt-0.5 shrink-0 text-bronze-400" />
                      ) : (
                        <Circle size={14} className="mt-0.5 shrink-0 text-paper-faint" />
                      )}
                      <span className="text-[12.5px] text-paper-dim">
                        {g.label} <span className="text-[11px] text-paper-faint">— {g.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-wider text-paper-faint">Le focus à ce niveau</p>
                <ul className="mt-1.5 space-y-1">
                  {m.focus.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[12px] text-paper-faint">
                      <span className="mt-0.5 text-bronze-400">›</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </section>

      <p className="pb-2 text-center text-[11.5px] text-paper-faint">
        La règle qui gouverne l&apos;échelle : <strong className="text-paper-dim">on ne débloque pas le volume, on le mérite</strong> —
        en passant chaque porte de conversation. Le MOAT, c&apos;est le cycle maîtrisé, pas le nombre d&apos;emails partis.
      </p>
    </div>
  );
}
