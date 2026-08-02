"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Dumbbell,
  Ear,
  Flame,
  MapPin,
  Navigation,
  Phone,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Prospect } from "@/lib/types";
import { cn, eur } from "@/lib/utils";
import { stageById, weightedValue } from "@/lib/hormozi";
import {
  HEAT_HEX,
  buildTour,
  fallbackBriefing,
  heat,
  heatTone,
  mapsRouteUrl,
  mapsUrl,
  suggestedStops,
  tourPotential,
  tourSummary,
} from "@/lib/closer";
import { useCountUp } from "@/lib/use-count-up";
import { ClosingMode } from "@/components/training/closing-mode";
import { Sparring } from "@/components/training/sparring";
import { LiveAssist } from "@/components/voice/live-assist";
import { verticalForProspect } from "@/lib/playbook";

/**
 * ALPHA CLOSER OS — le compagnon de tournée. Pensé pour le téléphone,
 * dans la rue, entre deux portes : la feuille de route du jour, le brief
 * tactique, et à un tap : navigation Maps, Mode Closing, Sparring.
 */

const KIND_LABEL: Record<string, string> = {
  audit: "Audit terrain",
  demo: "Démo mobile",
  closing: "Closing",
  suivi: "Suivi client",
};

/** Anneau de chaleur (SVG animé) — vert ≥80, ambre ≥65, rouge sinon. */
function HeatRing({ value, size = 44 }: { value: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const [off, setOff] = useState(c);
  const color = HEAT_HEX[heatTone(value)];
  useEffect(() => {
    const t = setTimeout(() => setOff(c * (1 - value / 100)), 80);
    return () => clearTimeout(t);
  }, [c, value]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className="stroke-ink-700" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.16,1,.3,1)", filter: `drop-shadow(0 0 5px ${color}66)` }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-[13px] font-extrabold text-paper">
        {value}
      </span>
    </div>
  );
}

export default function CloserPage() {
  const { prospects, meetings, settings } = useAlpha();
  const [view, setView] = useState<"tournee" | "priorites">("tournee");
  const [closing, setClosing] = useState<Prospect | null>(null);
  const [sparring, setSparring] = useState<Prospect | null>(null);
  const [openStop, setOpenStop] = useState<string | null>(null);
  /** Fiche pour laquelle l'assistant d'appel écoute — le playbook suit sa verticale. */
  const [assistFor, setAssistFor] = useState<Prospect | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [brief, setBrief] = useState<string | null>(null);
  const [briefEngine, setBriefEngine] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const tour = useMemo(() => buildTour(meetings, prospects), [meetings, prospects]);
  const suggestions = useMemo(
    () => (tour.length === 0 ? suggestedStops(prospects) : []),
    [tour.length, prospects]
  );
  const priorities = useMemo(
    () =>
      prospects
        .filter((p) => p.stage !== "signe" && p.stage !== "perdu")
        .map((p) => ({ p, h: heat(p) }))
        .sort((a, b) => b.h - a.h || weightedValue(b.p) - weightedValue(a.p)),
    [prospects]
  );

  const potential = tourPotential(tour.length ? tour : suggestions);
  const potentialAnim = useCountUp(potential);
  const nextStop = tour.find((s) => new Date(s.meeting.date) > new Date(Date.now() - 36e5));
  const localBrief = useMemo(() => fallbackBriefing(tour), [tour]);

  const refineBrief = async () => {
    setBriefLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "briefing", tourSummary: tourSummary(tour), businessRules: settings.businessRules }),
      });
      const data = await res.json();
      if (data.text) {
        setBrief(data.text);
        setBriefEngine(data.engine ?? null);
      }
    } catch {
      // le brief déterministe reste affiché
    } finally {
      setBriefLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-up">
      {/* En-tête — l'essentiel de la journée, lisible d'un coup d'œil dans la rue */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">
            Terrain · {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <h1 className="font-display text-2xl font-bold text-paper">
            ALPHA <span className="text-bronze-400">CLOSER OS</span>
          </h1>
        </div>
        <div className="flex items-center gap-5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Prochain RDV</p>
            <p className="font-display text-sm font-bold text-paper">
              {nextStop
                ? `${new Date(nextStop.meeting.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${nextStop.prospect.company}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Potentiel du jour</p>
            <p className="font-display text-sm font-extrabold text-bronze-400">
              <Flame size={13} className="mr-1 inline -translate-y-px" />
              {eur(Math.round(potentialAnim))}
            </p>
          </div>
        </div>
      </header>

      {/* Onglets */}
      <div className="flex gap-1.5">
        {(
          [
            ["tournee", "Tournée", Navigation],
            ["priorites", "Priorités", Target],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              view === k
                ? "border-bronze-400/60 bg-bronze-900/60 font-medium text-bronze-300"
                : "border-ink-600 text-paper-faint hover:text-paper"
            )}
          >
            <Icon size={14} /> {label}
            {k === "tournee" && tour.length > 0 && (
              <span className="rounded-full bg-bronze-400/20 px-1.5 font-mono text-[10px] text-bronze-300">{tour.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Assistant d'appel en direct — playbook de la verticale de la fiche */}
      {assistFor && (
        <LiveAssist
          verticalId={verticalForProspect(assistFor)?.id ?? null}
          onClose={() => setAssistFor(null)}
        />
      )}

      {view === "tournee" && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* Feuille de route */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 px-4 py-3">
              <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
                <Navigation size={15} className="text-bronze-400" />
                {tour.length > 0 ? "Feuille de route du jour" : "Tournée suggérée (par chaleur)"}
              </p>
              {(tour.length > 0 || suggestions.length > 0) && (
                <a
                  className="btn-ghost px-3 py-1.5 text-[12px]"
                  href={mapsRouteUrl((tour.length ? tour : suggestions).map((s) => s.place))}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={13} /> Itinéraire Maps
                </a>
              )}
            </div>

            {tour.length === 0 && suggestions.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-paper-faint">
                Aucun prospect actif. Importe ta liste ou ajoute une fiche — la tournée se construit toute seule.
              </p>
            )}

            {(tour.length ? tour : null)?.map((s, i, arr) => {
              const p = s.prospect;
              const open = openStop === s.meeting.id;
              const time = new Date(s.meeting.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={s.meeting.id} className={cn("px-4", i < arr.length - 1 && "border-b border-ink-700")}>
                  <button
                    className="flex w-full items-center gap-3 py-3.5 text-left"
                    onClick={() => setOpenStop(open ? null : s.meeting.id)}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-[12px] font-extrabold text-ink-950"
                      style={{ background: HEAT_HEX[heatTone(s.heat)] }}
                    >
                      {s.order}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-display text-[15px] font-bold text-paper">{p.company}</span>
                        <span className="font-mono text-[12px] text-bronze-400">{time}</span>
                      </span>
                      <span className="block truncate text-[12px] text-paper-faint">
                        {KIND_LABEL[s.meeting.kind]} · {s.place}
                      </span>
                    </span>
                    <ChevronDown size={15} className={cn("shrink-0 text-paper-faint transition-transform", open && "rotate-180")} />
                  </button>

                  {open && (
                    <div className="space-y-3 pb-4 pl-10 animate-fade-up">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="chip border-ink-600 text-paper-dim">{stageById(p.stage).label}</span>
                        <span className="chip border-ink-600 text-paper-dim">♦ heat {s.heat}</span>
                        <span className="chip border-bronze-700 text-bronze-300">{eur(Math.round(weightedValue(p)))} pondérés</span>
                        {p.ignoranceTax > 0 && (
                          <span className="chip border-signal-red/50 text-signal-red">taxe {eur(p.ignoranceTax)}/mois</span>
                        )}
                      </div>
                      {p.problems.length > 0 && (
                        <p className="text-[13px] leading-relaxed text-paper-dim">
                          {p.problems.slice(0, 2).join(" · ")}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-bronze px-4 py-2 text-[13px]" onClick={() => setClosing(p)}>
                          <Play size={14} /> Mode Closing
                        </button>
                        <button className="btn-ghost px-4 py-2 text-[13px]" onClick={() => setSparring(p)}>
                          <Dumbbell size={14} /> Sparring
                        </button>
                        <button className="btn-ghost px-4 py-2 text-[13px]" onClick={() => setAssistFor(p)}>
                          <Ear size={14} /> Assistant
                        </button>
                        <a className="btn-ghost px-3 py-2 text-[13px]" href={mapsUrl(s.place)} target="_blank" rel="noreferrer">
                          <MapPin size={14} /> Y aller
                        </a>
                        {p.phone && (
                          <a className="btn-ghost px-3 py-2 text-[13px]" href={`tel:${p.phone}`}>
                            <Phone size={14} />
                          </a>
                        )}
                        <Link className="btn-ghost px-3 py-2 text-[13px]" href={`/prospects/${p.id}`}>
                          Fiche <ArrowUpRight size={13} />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pas de RDV posé : les fiches les plus chaudes à aller voir */}
            {tour.length === 0 &&
              suggestions.map((s, i) => {
                const p = s.prospect;
                return (
                  <div
                    key={p.id}
                    className={cn("flex items-center gap-3 px-4 py-3.5", i < suggestions.length - 1 && "border-b border-ink-700")}
                  >
                    <HeatRing value={s.heat} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[15px] font-bold text-paper">{p.company}</p>
                      <p className="truncate text-[12px] text-paper-faint">
                        {stageById(p.stage).label} · {p.city} · {eur(Math.round(weightedValue(p)))} pondérés
                      </p>
                    </div>
                    <a className="btn-ghost px-3 py-1.5 text-[12px]" href={mapsUrl(s.place)} target="_blank" rel="noreferrer">
                      <MapPin size={13} />
                    </a>
                    <button className="btn-bronze px-3 py-1.5 text-[12px]" onClick={() => setClosing(p)}>
                      <Play size={13} />
                    </button>
                  </div>
                );
              })}

            {tour.length === 0 && suggestions.length > 0 && (
              <p className="border-t border-ink-700 px-4 py-3 text-[12px] text-paper-faint">
                Aucun RDV posé aujourd&apos;hui — voici où ta chaleur est la plus haute.{" "}
                <Link href="/meetings" className="text-bronze-400 hover:underline">
                  Poser des RDV →
                </Link>
              </p>
            )}
          </section>

          {/* Brief tactique */}
          <aside className="card h-fit space-y-3 border-bronze-700/50 p-4" style={{ background: "linear-gradient(180deg, rgba(232,201,138,.06), transparent)" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-display text-sm font-bold text-paper">
                <Sparkles size={15} className="text-bronze-400" /> Brief tactique
              </p>
              <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={refineBrief} disabled={briefLoading || tour.length === 0}>
                {briefLoading ? "Analyse…" : brief ? "↻ Relancer" : "Affiner avec l'IA"}
              </button>
            </div>
            <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-paper-dim">{brief ?? localBrief}</div>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper-faint">
              {brief ? `Moteur : ${briefEngine ?? "IA"}` : "Brief doctrine instantané — l'IA peut l'affiner."}
            </p>
          </aside>
        </div>
      )}

      {view === "priorites" && (
        <section className="space-y-2">
          {priorities.length === 0 && (
            <p className="card px-4 py-8 text-center text-sm text-paper-faint">Pipeline vide — importe ta liste de prospects.</p>
          )}
          {priorities.map(({ p, h }, i) => (
            <div
              key={p.id}
              className="card card-hover flex items-center gap-3.5 p-3.5"
              style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
            >
              <HeatRing value={h} />
              <Link href={`/prospects/${p.id}`} className="min-w-0 flex-1">
                <p className="truncate font-display text-[15px] font-bold text-paper">{p.company}</p>
                <p className="truncate text-[12px] text-paper-faint">
                  {stageById(p.stage).label} · {p.city} · {eur(Math.round(weightedValue(p)))} pondérés
                </p>
              </Link>
              <button className="btn-ghost hidden px-3 py-1.5 text-[12px] sm:flex" onClick={() => setAssistFor(p)}>
                <Ear size={13} /> Assistant
              </button>
              <button className="btn-ghost hidden px-3 py-1.5 text-[12px] sm:flex" onClick={() => setSparring(p)}>
                <Dumbbell size={13} /> Sparring
              </button>
              <button className="btn-bronze px-3.5 py-1.5 text-[12px]" onClick={() => setClosing(p)}>
                <Play size={13} /> Closing
              </button>
            </div>
          ))}
        </section>
      )}

      {closing && (
        <ClosingMode
          p={closing}
          onClose={() => setClosing(null)}
          onSpar={() => {
            setSparring(closing);
            setClosing(null);
          }}
        />
      )}
      {sparring && <Sparring p={sparring} onClose={() => setSparring(null)} />}
    </div>
  );
}
