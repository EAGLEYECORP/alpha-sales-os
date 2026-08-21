"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bot, Check, Clock, Gauge, PhoneCall, RadioTower, RefreshCw, User, Zap,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { masterRappelAll, type MasterPlan } from "@/lib/master-rappel";
import { durationSec, formatDuration, transcriptText, extractInsights, type CallSession } from "@/lib/call-log";
import { cn } from "@/lib/utils";

/**
 * SALLE DE CONTRÔLE — tout ce qui tourne, en un écran.
 *
 * Trois strates, de la plus urgente à la plus froide :
 *   1. les APPELS EN COURS (temps réel, avec la transcription qui défile) ;
 *   2. ce qui ATTEND UNE ACTION HUMAINE — c'est là que l'argent se perd ;
 *   3. ce qu'ALPHA exécute tout seul, et les fiches dont le tracking est muet.
 *
 * Chaque ligne est cliquable : elle ouvre la fiche pour intervenir.
 */
export default function ControlePage() {
  const prospects = useAlpha((s) => s.prospects);
  const accountId = useAlpha((s) => s.settings.accountId);

  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Les plans sont calculés localement : instantané, hors ligne, sans clé.
  const now = useMemo(() => new Date(), []);
  const plans = useMemo(
    () => masterRappelAll(prospects, { now, accountId }),
    [prospects, now, accountId]
  );

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/voice/session", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 401 ? "non autorisé (VOICE_WEBHOOK_SECRET)" : `HTTP ${r.status}`);
      const j = (await r.json()) as { sessions?: CallSession[] };
      setSessions(j.sessions ?? []);
      setErr(null);
    } catch (e) {
      // Le journal indisponible ne doit pas vider l'écran : le reste marche.
      setErr(e instanceof Error ? e.message : "journal injoignable");
    } finally {
      setLoading(false);
    }
  }

  // Rafraîchissement court : un appel en cours n'a de valeur que s'il est vu vivant.
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const live = sessions.filter((s) => s.state === "en-cours");
  const finished = sessions.filter((s) => s.state !== "en-cours").slice(0, 12);

  // Ce qui attend UN HUMAIN, le plus prêt à signer d'abord.
  const humanQueue = plans.filter((p) => p.human.length > 0 && p.stage !== "signe" && p.stage !== "perdu").slice(0, 15);
  const alphaQueue = plans.filter((p) => p.alpha.some((a) => a.channel !== "systeme")).slice(0, 10);
  const mute = plans.filter((p) => p.checks.some((c) => c.id === "retour-donnee" && c.state === "absent")).slice(0, 10);
  const ready = plans.filter((p) => p.closing);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-paper">
          <RadioTower size={20} className="text-bronze-400" /> Salle de contrôle
        </h1>
        <button onClick={load} className="btn-ghost flex items-center gap-1.5 text-[12px]">
          <RefreshCw size={13} className={cn(loading && "animate-spin")} /> Rafraîchir
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="Appels en cours" value={live.length} tone={live.length ? "green" : "muted"} icon={<PhoneCall size={13} />} />
        <Stat label="Attendent TOI" value={humanQueue.length} tone={humanQueue.length ? "amber" : "muted"} icon={<User size={13} />} />
        <Stat label="Prêts à signer" value={ready.length} tone={ready.length ? "green" : "muted"} icon={<Gauge size={13} />} />
        <Stat label="Tracking muet" value={mute.length} tone={mute.length ? "red" : "muted"} icon={<AlertTriangle size={13} />} />
      </div>

      {err && (
        <p className="rounded-xl border border-signal-amber/40 bg-signal-amber/5 px-3 py-2 text-[11.5px] text-signal-amber">
          Journal d&apos;appels : {err}. Le reste de l&apos;écran reste exact — seules les sessions vocales manquent.
        </p>
      )}

      {/* ── 1. Appels en cours ── */}
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <PhoneCall size={15} className="text-bronze-400" /> Appels en cours
          {live.length > 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-signal-green" />}
        </h2>
        {live.length === 0 ? (
          <p className="mt-2 text-[11.5px] text-paper-faint">
            Aucun appel en cours. Les sessions apparaissent ici dès qu&apos;Alpha Voice décroche.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {live.map((s) => (
              <SessionRow key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
            ))}
          </ul>
        )}
      </section>

      {/* ── 2. Ce qui attend une action HUMAINE ── */}
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <User size={15} className="text-bronze-400" /> Ça attend TOI
          <span className="text-[11px] font-normal text-paper-faint">— c&apos;est ici que l&apos;argent se perd</span>
        </h2>
        {humanQueue.length === 0 ? (
          <p className="mt-2 text-[11.5px] text-paper-faint">Rien en attente de ton côté.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line/40">
            {humanQueue.map((plan) => (
              <PlanRow key={plan.prospectId} plan={plan} prospects={prospects} />
            ))}
          </ul>
        )}
      </section>

      {/* ── 3. Ce qu'Alpha exécute ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <Bot size={15} className="text-bronze-400" /> Alpha exécute
          </h2>
          {alphaQueue.length === 0 ? (
            <p className="mt-2 text-[11.5px] text-paper-faint">Aucun automatisme en cours.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {alphaQueue.map((plan) => {
                const a = plan.alpha.find((x) => x.channel !== "systeme")!;
                const name = prospects.find((p) => p.id === plan.prospectId)?.company ?? plan.prospectId;
                return (
                  <li key={plan.prospectId} className="text-[11.5px]">
                    <Link href={`/prospects/${plan.prospectId}`} className="text-paper hover:text-bronze-400">
                      {name}
                    </Link>
                    <p className="text-paper-faint">
                      {a.do} <span className="text-[10.5px]">· {new Date(a.when).toLocaleDateString("fr-FR")}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Les fiches dont Alpha ne reçoit RIEN — angle mort le plus coûteux. */}
        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <AlertTriangle size={15} className="text-signal-red" /> Alpha ne reçoit rien
          </h2>
          <p className="mt-1 text-[11px] text-paper-faint">
            Aucune donnée ne remonte : impossible d&apos;analyser ces prospects ni de personnaliser quoi que ce soit.
          </p>
          {mute.length === 0 ? (
            <p className="mt-2 text-[11.5px] text-signal-green">Toutes les fiches actives remontent de la donnée.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {mute.map((plan) => {
                const p = prospects.find((x) => x.id === plan.prospectId);
                const why = plan.checks.find((c) => c.id === "retour-donnee")?.detail ?? "";
                return (
                  <li key={plan.prospectId} className="text-[11.5px]">
                    <Link href={`/prospects/${plan.prospectId}`} className="text-paper hover:text-bronze-400">
                      {p?.company ?? plan.prospectId}
                    </Link>
                    <span className="text-paper-faint"> — {why}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* ── Appels terminés : la matière à relire ── */}
      {finished.length > 0 && (
        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            <Clock size={15} className="text-bronze-400" /> Appels terminés
          </h2>
          <ul className="mt-2 space-y-2">
            {finished.map((s) => (
              <SessionRow key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SessionRow({ s, open, onToggle }: { s: CallSession; open: boolean; onToggle: () => void }) {
  const insights = useMemo(() => extractInsights(s), [s]);
  const dur = durationSec(s);
  return (
    <li className="rounded-xl border border-line/50 bg-surface/30 p-3">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 text-left">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            s.state === "en-cours" ? "animate-pulse bg-signal-green" : s.state === "echec" ? "bg-signal-red" : "bg-paper-faint"
          )}
        />
        <span className="text-[12px] text-paper">{s.peer ?? s.room}</span>
        <span className="rounded-full bg-bronze-900/25 px-1.5 py-0.5 text-[10.5px] text-bronze-300">{s.direction}</span>
        <span className="font-mono text-[11px] text-paper-faint">{formatDuration(dur)}</span>
        <span className="text-[11px] text-paper-faint">{s.turns.length} tours</span>
        {s.prospectId && (
          <Link
            href={`/prospects/${s.prospectId}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-[11px] text-bronze-400 hover:underline"
          >
            ouvrir la fiche ↗
          </Link>
        )}
      </button>

      {open && (
        <div className="mt-2 border-t border-line/40 pt-2">
          {insights.length > 0 && (
            <ul className="mb-2 space-y-0.5">
              {insights.map((i, n) => (
                <li key={n} className="text-[11px] text-signal-amber">
                  <strong className="uppercase">{i.kind}</strong> — « {i.quote} »
                </li>
              ))}
            </ul>
          )}
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-paper-dim">
            {transcriptText(s) || "Aucune transcription."}
          </pre>
          {s.error && <p className="mt-1 text-[11px] text-signal-red">Erreur : {s.error}</p>}
        </div>
      )}
    </li>
  );
}

function PlanRow({ plan, prospects }: { plan: MasterPlan; prospects: { id: string; company: string }[] }) {
  const name = prospects.find((p) => p.id === plan.prospectId)?.company ?? plan.prospectId;
  const a = plan.human[0];
  const s = plan.signs;
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <Link href={`/prospects/${plan.prospectId}`} className="text-[12.5px] font-medium text-paper hover:text-bronze-400">
          {name}
        </Link>
        <span
          className={cn(
            "font-mono text-[11px]",
            s.readiness >= 70 ? "text-signal-green" : s.readiness >= 45 ? "text-bronze-400" : "text-paper-faint"
          )}
        >
          {s.readiness}/100
        </span>
        {plan.closing && (
          <span className="flex items-center gap-1 rounded-full bg-signal-green/10 px-1.5 py-0.5 text-[10.5px] text-signal-green">
            <Check size={10} /> prêt à signer
          </span>
        )}
        {s.fatigueLevel === "sature" && (
          <span className="rounded-full bg-signal-red/10 px-1.5 py-0.5 text-[10.5px] text-signal-red">saturé</span>
        )}
        <span className="ml-auto text-[10.5px] text-paper-faint">
          {a ? new Date(a.when).toLocaleDateString("fr-FR") : ""}
        </span>
      </div>
      <p className="mt-0.5 text-[11.5px] text-paper-dim">{plan.headline}</p>
      {a?.mustCapture?.length ? (
        <p className="mt-0.5 text-[11px] text-signal-amber">À récolter : {a.mustCapture.join(" · ")}</p>
      ) : null}
    </li>
  );
}

function Stat({
  label, value, tone, icon,
}: { label: string; value: number; tone: "green" | "amber" | "red" | "muted"; icon: React.ReactNode }) {
  const t = {
    green: "text-signal-green",
    amber: "text-signal-amber",
    red: "text-signal-red",
    muted: "text-paper-faint",
  }[tone];
  return (
    <div className="card p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-paper-faint">
        {icon} {label}
      </p>
      <p className={cn("mt-0.5 font-display text-xl font-bold", t)}>{value}</p>
    </div>
  );
}
