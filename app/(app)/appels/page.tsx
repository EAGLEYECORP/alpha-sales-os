"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarCheck,
  ChevronDown,
  Ban,
  Ear,
  PhoneCall,
  PhoneOff,
  RotateCcw,
  ScrollText,
  ShieldBan,
  Target,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { RESULTATS_MANUELS, type ResultatManuel } from "@/lib/call-outcome";
import type { Prospect } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HEAT_HEX, heatTone } from "@/lib/closer";
import { SourcingTerrainPanel } from "@/components/appels/sourcing-terrain-panel";
import { CalibrationPanel } from "@/components/appels/calibration-panel";
import { buildCallSession, verticalsWithTargets } from "@/lib/call-session";
import { LiveAssist } from "@/components/voice/live-assist";

/**
 * Session d'appels — la « liste du matin ». Une verticale, son script
 * terrain, et les prospects à appeler avec l'angle de chacun.
 *
 * Différence avec une liste sur papier : chaque statut consigne une
 * touche réelle dans le CRM et pose le next step daté. Rien ne se perd
 * au rechargement, et la Salle des Preuves se remplit toute seule.
 */

type Outcome = ResultatManuel;

const OUTCOME_META: Record<Outcome, { label: string; icon: typeof PhoneCall; tone: string }> = {
  rdv: { label: "RDV posé", icon: CalendarCheck, tone: "border-signal-green/60 text-signal-green" },
  rappeler: { label: "À rappeler", icon: RotateCcw, tone: "border-signal-amber/60 text-signal-amber" },
  messagerie: { label: "Messagerie", icon: PhoneOff, tone: "border-ink-600 text-paper-faint" },
  non: { label: "Pas intéressé", icon: Ban, tone: "border-signal-red/50 text-signal-red" },
  opposition: { label: "Ne plus appeler", icon: ShieldBan, tone: "border-signal-red/70 text-signal-red" },
};

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

export default function AppelsPage() {
  const { prospects, addEvent, setNextStep, moveStage, patchProspect, logActivity } = useAlpha();
  const verticals = useMemo(() => verticalsWithTargets(prospects), [prospects]);
  const [activeId, setActiveId] = useState<string>("");
  const [scriptOpen, setScriptOpen] = useState(true);
  const [assistOpen, setAssistOpen] = useState(false);
  const [done, setDone] = useState<Record<string, Outcome>>({});

  const verticalId = activeId || verticals[0]?.vertical.id || "";
  const { vertical, targets } = useMemo(
    () => buildCallSession(prospects, verticalId),
    [prospects, verticalId]
  );

  const counts = {
    rdv: Object.values(done).filter((o) => o === "rdv").length,
    rappeler: Object.values(done).filter((o) => o === "rappeler").length,
    traites: Object.keys(done).length,
    restants: targets.length - Object.keys(done).length,
  };

  /** Consigne l'appel : touche réelle + next step daté. Doctrine. */
  const record = (p: Prospect, outcome: Outcome) => {
    setDone((d) => ({ ...d, [p.id]: outcome }));

    /**
     * Le texte NE S'ÉCRIT PAS ici. `RESULTATS_MANUELS` est la seule source, et
     * chaque phrase y est testée en aller-retour contre `attemptsFromEvents` :
     * ce que le vendeur clique doit être ce que la cadence relit. Deux phrases
     * écrites à la main ici étaient relues « sans réponse », et le robot
     * rappelait des gens qui avaient déjà décroché.
     */
    const r = RESULTATS_MANUELS[outcome];
    const step = { date: inDays(r.dansJours), action: r.action };

    addEvent(p.id, { date: new Date().toISOString(), kind: "appel", summary: r.summary, nextStep: step });
    setNextStep(p.id, step);
    if (outcome === "rdv" && (p.stage === "prospect" || p.stage === "contact")) {
      moveStage(p.id, "audit");
    }
    // Une opposition doit sortir des campagnes, pas seulement de cette liste.
    if (outcome === "opposition" && !p.tags.includes("ne-pas-appeler")) {
      patchProspect(p.id, { tags: [...p.tags, "ne-pas-appeler"] });
    }
    logActivity({ kind: "prospect", message: `${r.summary} — ${p.company}`, prospectId: p.id });
  };

  const undo = (id: string) =>
    setDone((d) => {
      const { [id]: _drop, ...rest } = d;
      return rest;
    });

  if (verticals.length === 0) {
    return (
      <div className="space-y-4 animate-fade-up">
        <header>
          <h1 className="font-display text-2xl font-bold text-paper">Session d&apos;appels</h1>
          <p className="text-sm text-paper-faint">La liste du matin : une verticale, son script, l&apos;angle de chaque prospect.</p>
        </header>
        {/* La file vide n'est pas une erreur, c'est l'étape d'avant : on
            source. Renvoyer vers le pipeline laissait l'opérateur chercher
            tout seul par où commencer. */}
        <p className="card px-4 py-6 text-center text-sm text-paper-faint">
          Aucun prospect actif rattaché à une verticale du playbook — la file d&apos;appels part d&apos;une liste, et
          la liste se source ci-dessous.{" "}
          <Link href="/pipeline" className="text-bronze-400 hover:underline">
            Voir le pipeline →
          </Link>
        </p>
        <SourcingTerrainPanel />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">Terrain · une verticale à la fois</p>
          <h1 className="font-display text-2xl font-bold text-paper">Session d&apos;appels</h1>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.14em]">
          <span className="text-paper-faint">
            Restants <b className="ml-1 font-display text-base text-paper">{counts.restants}</b>
          </span>
          <span className="text-paper-faint">
            RDV <b className="ml-1 font-display text-base text-signal-green">{counts.rdv}</b>
          </span>
          <span className="text-paper-faint">
            Rappels <b className="ml-1 font-display text-base text-signal-amber">{counts.rappeler}</b>
          </span>
        </div>
      </header>

      {/* Alimenter la file. Replié : quand il y a du monde à appeler, on
          appelle — le sourcing est le geste d'AVANT, pas celui du matin. */}
      <details className="card px-4 py-3">
        <summary className="cursor-pointer text-[12.5px] text-bronze-400">
          Alimenter la file — sourcer de nouveaux numéros
        </summary>
        <div className="mt-3">
          <SourcingTerrainPanel />
        </div>
      </details>

      {/* L'arc de retour. Replié lui aussi : on ne calibre pas en composant,
          on calibre APRÈS la session — mais il vit ici, à côté de la file
          qu'il juge, pas dans un tableau de bord qu'on n'ouvre jamais. */}
      <details className="card px-4 py-3">
        <summary className="cursor-pointer text-[12.5px] text-bronze-400">
          Ce que le terrain dit du tri — confronter les poids aux appels passés
        </summary>
        <div className="mt-3">
          <CalibrationPanel />
        </div>
      </details>

      {/* Verticales */}
      <div className="flex flex-wrap gap-1.5">
        {verticals.map(({ vertical: v, count }) => (
          <button
            key={v.id}
            onClick={() => {
              setActiveId(v.id);
              setDone({});
            }}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              v.id === verticalId
                ? "border-bronze-400/60 bg-bronze-900/60 font-medium text-bronze-300"
                : "border-ink-600 text-paper-faint hover:text-paper"
            )}
          >
            <Target size={14} /> {v.label}
            <span className="rounded-full bg-bronze-400/20 px-1.5 font-mono text-[10px] text-bronze-300">{count}</span>
          </button>
        ))}
      </div>

      {/* Assistant d'appel en direct — il écoute POUR toi, il ne parle qu'à toi */}
      <div>
        {assistOpen ? (
          <LiveAssist verticalId={verticalId} onClose={() => setAssistOpen(false)} />
        ) : (
          <button className="btn-ghost px-3 py-2 text-[13px]" onClick={() => setAssistOpen(true)}>
            <Ear size={14} /> Assistant d&apos;appel — l&apos;IA souffle la réponse du playbook
          </button>
        )}
      </div>

      {/* Le script de la verticale */}
      {vertical && (
        <section className="card overflow-hidden">
          <button
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setScriptOpen((o) => !o)}
          >
            <span className="flex items-center gap-2 font-display text-sm font-bold text-paper">
              <ScrollText size={15} className="text-bronze-400" /> Le script — {vertical.label}
            </span>
            <ChevronDown size={16} className={cn("shrink-0 text-paper-faint transition-transform", scriptOpen && "rotate-180")} />
          </button>

          {scriptOpen && (
            <div className="space-y-4 border-t border-ink-700 px-4 py-4 animate-fade-up">
              <p className="text-[13px] leading-relaxed text-paper-dim">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-bronze-400">Critère · </span>
                {vertical.criterion}
              </p>

              <ol className="space-y-2.5 border-l border-ink-700 pl-4">
                {vertical.opener.map((s, i) => (
                  <li key={i}>
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-bronze-400">
                      {i + 1} · {s.label}
                    </p>
                    <p className="text-[13.5px] leading-relaxed text-paper">« {s.line} »</p>
                    {s.note && <p className="mt-0.5 text-[11.5px] italic text-paper-faint">{s.note}</p>}
                  </li>
                ))}
              </ol>

              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-paper-faint">Diagnostic — poser, puis se taire</p>
                <ul className="mt-1 space-y-1">
                  {vertical.diagnostic.map((q, i) => (
                    <li key={i} className="text-[13.5px] text-paper-dim">« {q} »</li>
                  ))}
                </ul>
              </div>

              <p className="rounded-xl border border-bronze-700/50 bg-bronze-900/20 px-3.5 py-2.5 text-[13px] leading-relaxed text-bronze-300">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.16em]">Le miroir · </span>
                « {vertical.mirror} »
              </p>

              <div className="rounded-xl border border-signal-red/40 bg-signal-red/5 px-3.5 py-2.5">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-signal-red">Ce qu&apos;on ne dit jamais à froid</p>
                <ul className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-paper-dim">
                  <li>Les euros perdus, la note Google, la liste des fonctionnalités.</li>
                  <li>« J&apos;appelle toutes les entreprises du secteur » — le critère, jamais le volume.</li>
                  {vertical.forbidden.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-paper-faint">Red Zone — ce qu&apos;ils vont dire</p>
                <ul className="mt-1.5 space-y-2">
                  {vertical.objections.map((o, i) => (
                    <li key={i} className="border-l-2 border-ink-600 pl-3">
                      <p className="text-[13px] font-medium italic text-paper">« {o.q} »</p>
                      <p className="text-[13px] leading-relaxed text-paper-dim">→ {o.a}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      {/* La liste */}
      <section className="space-y-2">
        {targets.map(({ prospect: p, heat: h, angle, hot, daysSinceContact }) => {
          const outcome = done[p.id];
          return (
            <div
              key={p.id}
              className={cn(
                "card p-4 transition-opacity",
                outcome && "opacity-50",
                outcome === "rdv" && "border-signal-green/50 opacity-100"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-[12px] font-extrabold text-ink-950"
                    style={{ background: HEAT_HEX[heatTone(h)] }}
                    title={`Chaleur ${h}/100`}
                  >
                    {h}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-[15px] font-bold text-paper">
                      {p.company}
                      {hot && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-signal-red">prioritaire</span>}
                    </p>
                    <p className="truncate text-[12px] text-paper-faint">
                      {p.name || "contact inconnu"} · {p.city}
                      {daysSinceContact !== null && ` · dernier contact il y a ${daysSinceContact} j`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.phone?.trim() ? (
                    <a className="btn-bronze px-3.5 py-1.5 text-[12px]" href={`tel:${p.phone}`}>
                      <PhoneCall size={13} /> Appeler
                    </a>
                  ) : (
                    <span className="chip border-signal-amber/50 text-signal-amber">numéro manquant</span>
                  )}
                  <Link className="btn-ghost px-3 py-1.5 text-[12px]" href={`/prospects/${p.id}`}>
                    Fiche <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>

              <p className="mt-2.5 border-l-2 border-bronze-700 pl-3 text-[13px] leading-relaxed text-paper-dim">{angle}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {outcome ? (
                  <>
                    <span className={cn("chip", OUTCOME_META[outcome].tone)}>{OUTCOME_META[outcome].label} · consigné ✓</span>
                    <button className="btn-ghost px-2.5 py-1.5 text-[11.5px]" onClick={() => undo(p.id)}>
                      Masquer
                    </button>
                  </>
                ) : (
                  (Object.keys(OUTCOME_META) as Outcome[]).map((o) => {
                    const { label, icon: Icon, tone } = OUTCOME_META[o];
                    return (
                      <button key={o} className={cn("chip transition-colors hover:bg-ink-800", tone)} onClick={() => record(p, o)}>
                        <Icon size={12} className="mr-1 inline -translate-y-px" />
                        {label}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        {targets.length === 0 && (
          <p className="card px-4 py-8 text-center text-sm text-paper-faint">
            Aucun prospect actif dans cette verticale.
          </p>
        )}
      </section>

      <p className="text-center text-[11px] text-paper-faint">
        Chaque statut consigne une touche réelle et pose le next step daté — la liste ne se perd pas au rechargement.
      </p>
    </div>
  );
}
