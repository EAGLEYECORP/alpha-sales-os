"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Bot,
  CalendarPlus,
  ClipboardList,
  FileSignature,
  FileText,
  Layers,
  Mail,
  MessageSquare,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { EventKind, Objection, Obstacle, Prospect } from "@/lib/types";
import {
  BLAME_LAYERS,
  CROYANCES_META,
  OBJECTION_LIBRARY,
  OBSTACLE_LIBRARY,
  ignoranceTaxTotal,
  nextBestAction,
  signingBlockers,
  weightedValue,
} from "@/lib/hormozi";
import { cn, dateTimeFr, daysAhead, eur, relativeFr, uid } from "@/lib/utils";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StageBadge } from "@/components/ui/stage-badge";
import { Markdown } from "@/components/ui/markdown";
import { ProspectFormModal } from "@/components/pipeline/prospect-form";
import { fireSignedConfetti } from "@/lib/confetti";

type Tab = "doctrine" | "audit" | "timeline" | "commercial" | "coach" | "templates" | "fichiers";

const EVENT_ICONS: Record<EventKind, React.ReactNode> = {
  appel: <Phone size={13} />,
  visite: <ArrowLeft size={13} className="rotate-45" />,
  email: <Mail size={13} />,
  whatsapp: <MessageSquare size={13} />,
  demo: <Smartphone size={13} />,
  meeting: <CalendarPlus size={13} />,
  note: <FileText size={13} />,
  stage: <Layers size={13} />,
  offre: <Sparkles size={13} />,
};

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { prospects, settings, patchProspect, moveStage, addEvent, deleteProspect } = useAlpha();
  const p = prospects.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("doctrine");
  const [editing, setEditing] = useState(false);

  if (!p) {
    return (
      <div className="py-20 text-center">
        <p className="text-paper-faint">Prospect introuvable.</p>
        <Link href="/pipeline" className="btn-ghost mt-4">← Retour au pipeline</Link>
      </div>
    );
  }

  const blockers = signingBlockers(p);
  const nba = nextBestAction(p);

  const trySign = () => {
    if (signingBlockers(p).length > 0) {
      alert(`⛔ Doctrine :\n\n${signingBlockers(p).join("\n")}`);
      return;
    }
    const wonReason = prompt("Pourquoi OUI ? (raison du win — alimente les KPIs)") || undefined;
    const res = moveStage(p.id, "signe", { wonReason });
    if (res.ok) fireSignedConfetti();
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center gap-2 text-sm text-paper-faint">
        <Link href="/pipeline" className="flex items-center gap-1 hover:text-paper">
          <ArrowLeft size={14} /> Pipeline
        </Link>
        <span>/</span>
        <span className="text-paper">{p.company}</span>
      </div>

      {/* Header card */}
      <header className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-paper">{p.company}</h1>
              <StageBadge stage={p.stage} />
            </div>
            <p className="mt-1 text-sm text-paper-dim">
              {p.name} · <span className="capitalize">{p.sector}</span> · {p.city}
              {p.phone && <> · <a href={`tel:${p.phone}`} className="text-bronze-400 hover:underline">{p.phone}</a></>}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 font-mono text-sm">
              <span className="text-paper">
                {eur(p.setupValue)} <span className="text-paper-faint">setup</span> + {eur(p.monthlyValue)}
                <span className="text-paper-faint">/mois</span>
              </span>
              <span className="text-bronze-400">{eur(weightedValue(p))} <span className="text-paper-faint">pondéré</span></span>
              <span className="text-signal-red">
                −{eur(ignoranceTaxTotal(p))} <span className="text-paper-faint">taxe d&apos;ignorance cumulée</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <ProgressRing value={p.trust} size={52} label="confiance" />
            <ProgressRing value={p.likeness} size={52} label="affinité" tone="dim" />
            <ProgressRing value={p.auditScore} size={52} label="audit" tone="dim" />
            <ProgressRing value={p.probability} size={52} label="close %" tone={p.probability >= 65 ? "green" : "bronze"} />
            <ProgressRing value={p.conviction} max={10} size={52} label="conviction" tone={p.conviction >= 10 ? "green" : "red"} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
          {p.stage !== "signe" && p.stage !== "perdu" && (
            <button
              className={cn(blockers.length ? "btn-ghost opacity-70" : "btn-bronze")}
              onClick={trySign}
              title={blockers.length ? blockers.join(" · ") : "Toutes les conditions doctrine sont réunies"}
            >
              ✍ Signer {blockers.length > 0 && `(${blockers.length} blocage${blockers.length > 1 ? "s" : ""})`}
            </button>
          )}
          <button className="btn-ghost" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Modifier
          </button>
          <button
            className="btn-danger ml-auto"
            onClick={() => {
              if (confirm(`Supprimer ${p.company} ?`)) {
                deleteProspect(p.id);
                router.push("/pipeline");
              }
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Next best action banner */}
        <div className="mt-4 rounded-lg border border-bronze-700/60 bg-bronze-900/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-bronze-500">
            Prochaine meilleure action · urgence {nba.urgency}
          </p>
          <p className="mt-0.5 text-sm font-medium text-paper">{nba.action}</p>
          <p className="text-[12px] text-paper-dim">{nba.why}</p>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-ink-700 bg-ink-900/60 p-1">
        {(
          [
            ["doctrine", "Doctrine", <Layers key="i" size={14} />],
            ["audit", "Audit & Offre", <ClipboardList key="i" size={14} />],
            ["timeline", "Timeline", <CalendarPlus key="i" size={14} />],
            ["commercial", "Commercial", <Banknote key="i" size={14} />],
            ["coach", "AI Coach", <Bot key="i" size={14} />],
            ["templates", "Templates", <Mail key="i" size={14} />],
            ["fichiers", "Fichiers", <Paperclip key="i" size={14} />],
          ] as [Tab, string, React.ReactNode][]
        ).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm transition-colors",
              tab === key ? "bg-bronze-900/70 text-bronze-300 font-medium" : "text-paper-faint hover:text-paper"
            )}
          >
            {icon} {label}
          </button>
        ))}
      </nav>

      {tab === "doctrine" && <DoctrineTab p={p} patch={patchProspect} />}
      {tab === "audit" && <AuditTab p={p} patch={patchProspect} />}
      {tab === "timeline" && <TimelineTab p={p} addEvent={addEvent} />}
      {tab === "commercial" && <CommercialTab p={p} patch={patchProspect} />}
      {tab === "coach" && <CoachTab p={p} rules={settings.businessRules} />}
      {tab === "templates" && <TemplatesTab p={p} closer={settings.closerName} />}
      {tab === "fichiers" && <FilesTab p={p} patch={patchProspect} />}

      <ProspectFormModal open={editing} onClose={() => setEditing(false)} initial={p} />
    </div>
  );
}

/* ── Doctrine tab: croyances, obstacles, objections ─────────────────── */

function DoctrineTab({
  p,
  patch,
}: {
  p: Prospect;
  patch: (id: string, patch: Partial<Prospect>) => void;
}) {
  const [newObstacle, setNewObstacle] = useState("");
  const [newObjection, setNewObjection] = useState("");

  const addObstacle = (label: string, layer: Obstacle["blameLayer"] = "circonstances") => {
    if (!label.trim()) return;
    patch(p.id, {
      obstacles: [...p.obstacles, { id: uid(), label, blameLayer: layer, resolved: false }],
    });
    setNewObstacle("");
  };

  const addObjection = (label: string) => {
    if (!label.trim()) return;
    const known = OBJECTION_LIBRARY.find((o) => o.label === label);
    patch(p.id, {
      objections: [
        ...p.objections,
        {
          id: uid(),
          label,
          type: known?.type ?? "confiance",
          croyance: known?.croyance ?? 3,
          status: "ouverte",
          counter: known?.counter,
        },
      ],
    });
    setNewObjection("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* 3 Croyances */}
      <section className="card p-4 lg:col-span-2">
        <h2 className="font-display text-sm font-semibold text-paper">Les 3 Croyances — toutes à 10 pour signer</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {CROYANCES_META.map((c) => {
            const value = p.croyances[c.key];
            return (
              <div key={c.key} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
                <p className="text-sm font-medium text-paper">
                  {c.num}. {c.label}{" "}
                  <span className={cn("font-mono", value >= 10 ? "text-signal-green" : "text-bronze-400")}>
                    {value}/10
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-paper-faint">{c.description}</p>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={value}
                  onChange={(e) =>
                    patch(p.id, { croyances: { ...p.croyances, [c.key]: +e.target.value } })
                  }
                  className="mt-2 w-full accent-bronze-500"
                />
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-paper-dim">
            <input
              type="checkbox"
              className="accent-bronze-500"
              checked={p.demoShownBeforePrice}
              onChange={(e) => patch(p.id, { demoShownBeforePrice: e.target.checked })}
            />
            Démo mobile montrée AVANT le prix
          </label>
          <label className="flex items-center gap-2 text-paper-dim">
            Ma conviction :
            <input
              type="range"
              min={0}
              max={10}
              value={p.conviction}
              onChange={(e) => patch(p.id, { conviction: +e.target.value })}
              className="w-28 accent-bronze-500"
            />
            <span className={cn("font-mono", p.conviction >= 10 ? "text-signal-green" : "text-signal-red")}>
              {p.conviction}/10
            </span>
          </label>
          <label className="flex items-center gap-2 text-paper-dim">
            Affinité (il nous apprécie) :
            <input
              type="range"
              min={0}
              max={100}
              value={p.likeness}
              onChange={(e) => patch(p.id, { likeness: +e.target.value })}
              className="w-28 accent-bronze-500"
            />
            <span className="font-mono text-bronze-400">{p.likeness}/100</span>
          </label>
        </div>
      </section>

      {/* Obstacles (pre-offer) */}
      <section className="card p-4">
        <h2 className="font-display text-sm font-semibold text-paper">
          Obstacles <span className="text-[11px] font-normal text-paper-faint">(pré-offre — Oignon du Blâme)</span>
        </h2>
        <ul className="mt-3 space-y-2">
          {p.obstacles.map((o) => (
            <li key={o.id} className={cn("rounded-lg border px-3 py-2", o.resolved ? "border-ink-700 opacity-50" : "border-ink-600 bg-ink-850")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={cn("text-sm", o.resolved && "line-through")}>{o.label}</p>
                  <p className="mt-0.5 text-[11px] text-bronze-500">
                    Couche « {BLAME_LAYERS[o.blameLayer].label} » — {BLAME_LAYERS[o.blameLayer].peel}
                  </p>
                  {o.note && <p className="mt-1 text-[11px] text-paper-faint">↳ {o.note}</p>}
                </div>
                <input
                  type="checkbox"
                  className="mt-1 accent-bronze-500"
                  checked={o.resolved}
                  title="Épluché"
                  onChange={(e) =>
                    patch(p.id, {
                      obstacles: p.obstacles.map((x) => (x.id === o.id ? { ...x, resolved: e.target.checked } : x)),
                    })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Nouvel obstacle entendu…"
            value={newObstacle}
            onChange={(e) => setNewObstacle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addObstacle(newObstacle)}
          />
          <button className="btn-ghost" onClick={() => addObstacle(newObstacle)}>
            <Plus size={14} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {OBSTACLE_LIBRARY.filter((o) => !p.obstacles.some((x) => x.label === o.label)).slice(0, 4).map((o) => (
            <button
              key={o.label}
              onClick={() => addObstacle(o.label, o.blameLayer)}
              className="chip border-ink-600 text-paper-faint hover:border-bronze-700 hover:text-bronze-400"
            >
              + {o.label.slice(0, 34)}…
            </button>
          ))}
        </div>
      </section>

      {/* Objections (Red Zone) */}
      <section className={cn("card p-4", p.stage === "redzone" && "border-signal-red/40")}>
        <h2 className="font-display text-sm font-semibold text-paper">
          Objections <span className="text-[11px] font-normal text-signal-red">(post-offre — Red Zone uniquement)</span>
        </h2>
        {!["offre", "redzone", "signe"].includes(p.stage) && (
          <p className="mt-2 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[12px] text-paper-faint">
            Pas d&apos;offre présentée = pas d&apos;objection possible. Ce que tu entends maintenant, ce sont des <strong className="text-paper">obstacles</strong>.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {p.objections.map((o) => (
            <li key={o.id} className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-paper">{o.label}</p>
                  <p className="mt-0.5 text-[11px] text-bronze-500">
                    Croyance cassée n°{o.croyance} · type {o.type}
                  </p>
                  {o.counter && <p className="mt-1 text-[11px] text-paper-dim">💡 {o.counter}</p>}
                </div>
                <select
                  className="input w-28 py-1 text-[11px]"
                  value={o.status}
                  onChange={(e) =>
                    patch(p.id, {
                      objections: p.objections.map((x) =>
                        x.id === o.id ? { ...x, status: e.target.value as Objection["status"] } : x
                      ),
                    })
                  }
                >
                  <option value="ouverte">Ouverte</option>
                  <option value="traitee">Traitée ✓</option>
                  <option value="bloquante">Bloquante</option>
                </select>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Objection entendue après l'offre…"
            value={newObjection}
            onChange={(e) => setNewObjection(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addObjection(newObjection)}
          />
          <button className="btn-ghost" onClick={() => addObjection(newObjection)}>
            <Plus size={14} />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {OBJECTION_LIBRARY.filter((o) => !p.objections.some((x) => x.label === o.label)).slice(0, 3).map((o) => (
            <button
              key={o.label}
              onClick={() => addObjection(o.label)}
              className="chip border-ink-600 text-paper-faint hover:border-signal-red/50 hover:text-signal-red"
            >
              + {o.label}
            </button>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="card p-4 lg:col-span-2">
        <h2 className="mb-2 font-display text-sm font-semibold text-paper">Notes terrain</h2>
        <textarea
          className="input min-h-24"
          value={p.notes}
          onChange={(e) => patch(p.id, { notes: e.target.value })}
        />
      </section>
    </div>
  );
}

/* ── Audit & Offre tab: problems → solution → personalized offer ────── */

function AuditTab({
  p,
  patch,
}: {
  p: Prospect;
  patch: (id: string, patch: Partial<Prospect>) => void;
}) {
  const [newProblem, setNewProblem] = useState("");
  const audit = p.deepAudit;

  const patchAudit = (partial: Partial<Prospect["deepAudit"]>) =>
    patch(p.id, { deepAudit: { ...audit, ...partial, updatedAt: new Date().toISOString() } });

  const addProblem = () => {
    if (!newProblem.trim()) return;
    patch(p.id, { problems: [...p.problems, newProblem.trim()] });
    setNewProblem("");
  };

  // Taxe d'Ignorance = appels ratés/sem × 4,33 sem × taux conv × panier moyen
  const computedTax =
    audit.missedCallsPerWeek && audit.avgTicket
      ? Math.round(audit.missedCallsPerWeek * 4.33 * ((audit.conversionRate ?? 30) / 100) * audit.avgTicket)
      : null;

  const auditFields = [
    audit.googleRating,
    audit.googleReviews,
    audit.websiteState,
    audit.socialState,
    audit.missedCallsPerWeek,
    audit.avgTicket,
    audit.localCompetition,
    audit.currentProcess,
  ];
  const completeness = Math.round((auditFields.filter((f) => f !== undefined && f !== "").length / auditFields.length) * 100);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Structured deep audit — real, measured data */}
      <section className="card p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-paper">
            Deep audit terrain <span className="text-[11px] font-normal text-paper-faint">(données réelles mesurées — importables CSV/Sheet)</span>
          </h2>
          <span className="chip border-bronze-700 text-bronze-400">complétude {completeness} %</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Note Google (/5)</label>
            <input type="number" step="0.1" min="0" max="5" className="input" value={audit.googleRating ?? ""} onChange={(e) => patchAudit({ googleRating: e.target.value === "" ? undefined : +e.target.value })} />
          </div>
          <div>
            <label className="label">Nb d&apos;avis Google</label>
            <input type="number" className="input" value={audit.googleReviews ?? ""} onChange={(e) => patchAudit({ googleReviews: e.target.value === "" ? undefined : +e.target.value })} />
          </div>
          <div>
            <label className="label">Appels ratés / semaine</label>
            <input type="number" className="input" value={audit.missedCallsPerWeek ?? ""} onChange={(e) => patchAudit({ missedCallsPerWeek: e.target.value === "" ? undefined : +e.target.value })} />
          </div>
          <div>
            <label className="label">Panier moyen (€)</label>
            <input type="number" className="input" value={audit.avgTicket ?? ""} onChange={(e) => patchAudit({ avgTicket: e.target.value === "" ? undefined : +e.target.value })} />
          </div>
          <div>
            <label className="label">Taux de conversion estimé (%)</label>
            <input type="number" className="input" value={audit.conversionRate ?? ""} placeholder="30" onChange={(e) => patchAudit({ conversionRate: e.target.value === "" ? undefined : +e.target.value })} />
          </div>
          <div>
            <label className="label">État du site web</label>
            <input className="input" value={audit.websiteState} placeholder="aucun / obsolète 2014 / url…" onChange={(e) => patchAudit({ websiteState: e.target.value })} />
          </div>
          <div>
            <label className="label">Réseaux sociaux</label>
            <input className="input" value={audit.socialState} placeholder="Insta 200 abonnés, inactif…" onChange={(e) => patchAudit({ socialState: e.target.value })} />
          </div>
          <div>
            <label className="label">Concurrence locale (500 m)</label>
            <input className="input" value={audit.localCompetition} placeholder="3 concurrents mieux notés…" onChange={(e) => patchAudit({ localCompetition: e.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="label">Process actuel (qui répond, quand, comment ?)</label>
            <input className="input" value={audit.currentProcess} placeholder="Le patron décroche entre deux services ; rien en dehors des horaires…" onChange={(e) => patchAudit({ currentProcess: e.target.value })} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-bronze-700/50 bg-bronze-900/20 px-3 py-2.5">
          <p className="text-[12px] text-paper-dim">
            Taxe d&apos;Ignorance calculée :{" "}
            {computedTax !== null ? (
              <strong className="font-mono text-signal-red">{computedTax.toLocaleString("fr-FR")} €/mois</strong>
            ) : (
              <span className="text-paper-faint">renseigne appels ratés + panier moyen</span>
            )}
            {computedTax !== null && (
              <span className="text-paper-faint"> ({audit.missedCallsPerWeek} appels × 4,33 sem × {audit.conversionRate ?? 30} % × {audit.avgTicket} €)</span>
            )}
          </p>
          {computedTax !== null && computedTax !== p.ignoranceTax && (
            <button className="btn-bronze py-1 text-[12px]" onClick={() => patch(p.id, { ignoranceTax: computedTax, auditScore: Math.max(p.auditScore, completeness) })}>
              Appliquer au deal ({computedTax.toLocaleString("fr-FR")} €/mois)
            </button>
          )}
        </div>
      </section>
      <section className="card p-4">
        <h2 className="font-display text-sm font-semibold text-paper">
          Problèmes identifiés <span className="text-[11px] font-normal text-paper-faint">(audit profond terrain)</span>
        </h2>
        <p className="mt-1 text-[11px] text-paper-faint">
          Chaque problème chiffrable nourrit la Taxe d&apos;Ignorance. Score audit : profondeur du diagnostic.
        </p>
        <ul className="mt-3 space-y-2">
          {p.problems.map((prob, i) => (
            <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-paper">
              <span>• {prob}</span>
              <button
                className="text-paper-faint hover:text-signal-red"
                onClick={() => patch(p.id, { problems: p.problems.filter((_, j) => j !== i) })}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
          {p.problems.length === 0 && <p className="text-sm text-paper-faint">Aucun problème documenté — l&apos;audit n&apos;a pas commencé.</p>}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Problème constaté sur place…"
            value={newProblem}
            onChange={(e) => setNewProblem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProblem()}
          />
          <button className="btn-ghost" onClick={addProblem}><Plus size={14} /></button>
        </div>
        <label className="label mt-4">Score audit (complétude du diagnostic)</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={p.auditScore}
            onChange={(e) => patch(p.id, { auditScore: +e.target.value })}
            className="flex-1 accent-bronze-500"
          />
          <span className="font-mono text-sm text-bronze-400">{p.auditScore}/100</span>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-display text-sm font-semibold text-paper">Solution conçue</h2>
        <p className="mt-1 text-[11px] text-paper-faint">Le pont entre SES problèmes et NOTRE offre. Spécifique, pas générique.</p>
        <textarea
          className="input mt-3 min-h-24"
          value={p.solution}
          onChange={(e) => patch(p.id, { solution: e.target.value })}
          placeholder="Site premium + module résa 24/7 + overlay IA qui…"
        />
        <h2 className="mt-4 font-display text-sm font-semibold text-paper">Offre personnalisée</h2>
        <p className="mt-1 text-[11px] text-paper-faint">
          Prix, garantie, conditions — formulée pour LUI. C&apos;est ce que le contrat reprendra mot pour mot.
        </p>
        <textarea
          className="input mt-3 min-h-24"
          value={p.personalizedOffer}
          onChange={(e) => patch(p.id, { personalizedOffer: e.target.value })}
          placeholder="Setup X € + Y €/mois. Garantie : …"
        />
        <div className="mt-3 rounded-lg border border-bronze-700/50 bg-bronze-900/20 px-3 py-2 text-[12px] text-paper-dim">
          Taxe d&apos;Ignorance : <strong className="text-signal-red">{eur(p.ignoranceTax)}/mois</strong> — l&apos;offre doit toujours coûter moins que l&apos;inaction.
        </div>
      </section>
    </div>
  );
}

/* ── Commercial tab: payments, contract, delivery ────────────────────── */

const DELIVERY_LABELS: Record<Prospect["delivery"], string> = {
  "non-demarre": "Non démarré",
  "en-cours": "En cours",
  livre: "Livré",
  maintenance: "Maintenance",
};

function CommercialTab({
  p,
  patch,
}: {
  p: Prospect;
  patch: (id: string, patch: Partial<Prospect>) => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState(0);

  const totalPaid = p.payments.filter((x) => x.status === "paye").reduce((s, x) => s + x.amount, 0);
  const totalDue = p.payments.filter((x) => x.status !== "paye").reduce((s, x) => s + x.amount, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Payments */}
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Banknote size={15} className="text-bronze-400" /> Paiements
        </h2>
        <div className="mt-2 flex gap-4 font-mono text-sm">
          <span className="text-signal-green">{eur(totalPaid)} encaissé</span>
          <span className="text-bronze-400">{eur(totalDue)} attendu</span>
        </div>
        <ul className="mt-3 space-y-2">
          {p.payments.map((pay) => (
            <li key={pay.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm">
              <div>
                <p className="text-paper">{pay.label}</p>
                <p className="text-[11px] text-paper-faint">échéance {relativeFr(pay.dueDate)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-paper">{eur(pay.amount)}</span>
                <select
                  className="input w-28 py-1 text-[11px]"
                  value={pay.status}
                  onChange={(e) =>
                    patch(p.id, {
                      payments: p.payments.map((x) =>
                        x.id === pay.id ? { ...x, status: e.target.value as typeof pay.status } : x
                      ),
                    })
                  }
                >
                  <option value="en-attente">En attente</option>
                  <option value="paye">Payé ✓</option>
                  <option value="retard">En retard ⚠</option>
                </select>
              </div>
            </li>
          ))}
          {p.payments.length === 0 && <p className="text-sm text-paper-faint">Aucun paiement planifié.</p>}
        </ul>
        <div className="mt-3 flex gap-2">
          <input className="input flex-1" placeholder="Libellé (Setup, M1…)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input type="number" className="input w-28" placeholder="€" value={amount || ""} onChange={(e) => setAmount(+e.target.value)} />
          <button
            className="btn-ghost"
            onClick={() => {
              if (!label.trim() || !amount) return;
              patch(p.id, {
                payments: [...p.payments, { id: uid(), label, amount, dueDate: daysAhead(14), status: "en-attente" }],
              });
              setLabel("");
              setAmount(0);
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </section>

      {/* Contract + delivery */}
      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <FileSignature size={15} className="text-bronze-400" /> Contrat & livraison
        </h2>
        <label className="label mt-3">Statut du contrat</label>
        <select
          className="input"
          value={p.contract.status}
          onChange={(e) =>
            patch(p.id, {
              contract: {
                ...p.contract,
                status: e.target.value as Prospect["contract"]["status"],
                signedAt: e.target.value === "signe" ? (p.contract.signedAt ?? new Date().toISOString()) : p.contract.signedAt,
              },
            })
          }
        >
          <option value="aucun">Aucun</option>
          <option value="brouillon">Brouillon</option>
          <option value="envoye">Envoyé</option>
          <option value="signe">Signé ✓</option>
        </select>
        {p.contract.signedAt && (
          <p className="mt-1 text-[11px] text-signal-green">Signé le {dateTimeFr(p.contract.signedAt)}</p>
        )}
        <label className="label mt-3">Lien du contrat (Drive, DocuSign…)</label>
        <input
          className="input"
          placeholder="https://…"
          value={p.contract.url ?? ""}
          onChange={(e) => patch(p.id, { contract: { ...p.contract, url: e.target.value } })}
        />

        <label className="label mt-4">Statut de livraison</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DELIVERY_LABELS) as Prospect["delivery"][]).map((d) => (
            <button
              key={d}
              className={p.delivery === d ? "btn-bronze" : "btn-ghost"}
              onClick={() => patch(p.id, { delivery: d })}
            >
              {DELIVERY_LABELS[d]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] italic text-paper-faint">
          Croyance n°2 (« tu le soutiens ») se prouve ici : livraison rapide + suivi visible = referrals.
        </p>
      </section>
    </div>
  );
}

/* ── Timeline tab ────────────────────────────────────────────────────── */

const CHANNEL_ICON = {
  appel: <Phone size={12} />,
  visio: <Video size={12} />,
  physique: <ArrowLeft size={12} className="rotate-45" />,
};

function TimelineTab({
  p,
  addEvent,
}: {
  p: Prospect;
  addEvent: (id: string, ev: Omit<Prospect["events"][number], "id">) => void;
}) {
  const { meetings, upsertMeeting } = useAlpha();
  const myMeetings = meetings
    .filter((m) => m.prospectId === p.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const [kind, setKind] = useState<EventKind>("appel");
  const [summary, setSummary] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextDate, setNextDate] = useState(daysAhead(2).slice(0, 10));

  const submit = () => {
    if (!summary.trim()) return;
    if (!nextAction.trim()) {
      alert("Doctrine : chaque contact se termine par un next step DATÉ.");
      return;
    }
    addEvent(p.id, {
      date: new Date().toISOString(),
      kind,
      summary,
      nextStep: { date: new Date(nextDate).toISOString(), action: nextAction },
    });
    setSummary("");
    setNextAction("");
  };

  const sorted = [...p.events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="card p-4">
        <h2 className="mb-4 font-display text-sm font-semibold text-paper">Historique des contacts</h2>
        <ol className="relative space-y-4 border-l border-ink-700 pl-5">
          {sorted.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[27px] grid h-5 w-5 place-items-center rounded-full border border-bronze-700 bg-ink-900 text-bronze-400">
                {EVENT_ICONS[e.kind]}
              </span>
              <p className="text-[11px] uppercase tracking-wider text-paper-faint">
                {e.kind} · {dateTimeFr(e.date)}
              </p>
              <p className="mt-0.5 text-sm text-paper">{e.summary}</p>
              {e.nextStep && (
                <p className="mt-1 text-[12px] text-bronze-400">
                  → {e.nextStep.action} <span className="text-paper-faint">({relativeFr(e.nextStep.date)})</span>
                </p>
              )}
            </li>
          ))}
          {sorted.length === 0 && <p className="text-sm text-paper-faint">Aucun contact enregistré.</p>}
        </ol>
      </section>

      <section className="card h-fit p-4">
        <h2 className="mb-3 font-display text-sm font-semibold text-paper">Nouveau contact</h2>
        <label className="label">Type</label>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
          <option value="appel">Appel</option>
          <option value="visite">Visite terrain</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="demo">Démo mobile</option>
          <option value="meeting">Rendez-vous</option>
          <option value="offre">Présentation d&apos;offre</option>
          <option value="note">Note</option>
        </select>
        <label className="label mt-3">Résumé</label>
        <textarea className="input min-h-20" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <label className="label mt-3">Next step (obligatoire)</label>
        <input className="input" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Action précise" />
        <input type="date" className="input mt-2" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        <button className="btn-bronze mt-4 w-full" onClick={submit}>
          Enregistrer le contact
        </button>

        {/* Meetings history + feedback */}
        <h2 className="mb-2 mt-6 border-t border-ink-700 pt-4 font-display text-sm font-semibold text-paper">
          Rendez-vous ({myMeetings.length})
        </h2>
        <ul className="space-y-2">
          {myMeetings.map((m) => (
            <li key={m.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <p className="flex items-center gap-1.5 text-sm text-paper">
                <span className="text-bronze-400">{CHANNEL_ICON[m.channel]}</span>
                {m.title}
              </p>
              <p className="text-[11px] text-paper-faint">
                {m.channel} · {dateTimeFr(m.date)} {m.done ? "· fait ✓" : `· ${relativeFr(m.date)}`}
              </p>
              {m.done && (
                <textarea
                  className="input mt-2 min-h-14 text-[12px]"
                  placeholder="Feedback du RDV (alimente l'IA et l'historique)…"
                  value={m.feedback ?? m.outcome ?? ""}
                  onChange={(e) => upsertMeeting({ ...m, feedback: e.target.value })}
                />
              )}
            </li>
          ))}
          {myMeetings.length === 0 && <p className="text-[12px] text-paper-faint">Aucun RDV pour ce prospect.</p>}
        </ul>
      </section>
    </div>
  );
}

/* ── AI Coach tab ────────────────────────────────────────────────────── */

const COACH_TASKS = [
  { task: "script", label: "Script de vente terrain", icon: <FileText size={14} /> },
  { task: "audit", label: "Notes d'audit auto", icon: <Layers size={14} /> },
  { task: "summary", label: "Résumé intelligent", icon: <Sparkles size={14} /> },
  { task: "next-action", label: "Next best action", icon: <Bot size={14} /> },
] as const;

function CoachTab({ p, rules }: { p: Prospect; rules: string }) {
  const [output, setOutput] = useState("");
  const [engine, setEngine] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [objection, setObjection] = useState("");

  const run = async (task: string, extra?: Record<string, string>) => {
    setLoading(task);
    setOutput("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, prospect: p, businessRules: rules, ...extra }),
      });
      const data = await res.json();
      setOutput(data.text ?? data.error ?? "Erreur");
      setEngine(data.engine ?? null);
    } catch {
      setOutput("Erreur réseau — réessaie.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <section className="card h-fit space-y-2 p-4">
        <h2 className="mb-1 font-display text-sm font-semibold text-paper">AI Coach</h2>
        <p className="mb-3 text-[11px] text-paper-faint">
          Contexte complet injecté : doctrine, règles business, état des croyances.
        </p>
        {COACH_TASKS.map(({ task, label, icon }) => (
          <button
            key={task}
            className="btn-ghost w-full justify-start"
            disabled={loading !== null}
            onClick={() => run(task)}
          >
            {icon} {loading === task ? "Génération…" : label}
          </button>
        ))}
        <div className="border-t border-ink-700 pt-3">
          <label className="label">Traiter une objection</label>
          <input
            className="input"
            value={objection}
            onChange={(e) => setObjection(e.target.value)}
            placeholder="« C'est trop cher »"
          />
          <button
            className="btn-bronze mt-2 w-full"
            disabled={loading !== null || !objection.trim()}
            onClick={() => run("objection", { objection })}
          >
            {loading === "objection" ? "Analyse…" : "Recadrer"}
          </button>
        </div>
      </section>

      <section className="card min-h-64 p-5">
        {output ? (
          <>
            <p className="mb-3 text-[10px] uppercase tracking-wider text-paper-faint">
              moteur : {engine === "claude" ? "Claude (Anthropic)" : "templates Hormozi (hors-ligne)"}
            </p>
            <Markdown>{output}</Markdown>
          </>
        ) : (
          <div className="grid h-full min-h-52 place-items-center text-center">
            <div>
              <Bot size={32} className="mx-auto text-bronze-700" />
              <p className="mt-3 text-sm text-paper-faint">
                Choisis une action à gauche.<br />
                Sans clé API, le moteur de templates Hormozi prend le relais.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ── Templates tab ───────────────────────────────────────────────────── */

function TemplatesTab({ p, closer }: { p: Prospect; closer: string }) {
  const firstName = p.name.split(" ")[0];
  const templates = [
    {
      channel: "Email",
      subject: `Vos clients de 23h, ${firstName}`,
      body: `Bonjour ${firstName},\n\nPendant que ${p.company} est fermé, vos futurs clients cherchent — et trouvent le concurrent qui répond.\n\nChaque mois sans présence sérieuse en ligne vous coûte environ ${p.ignoranceTax.toLocaleString("fr-FR")} €. Ce n'est pas un argument de vente, c'est un calcul qu'on fera ensemble, sur place, en 20 minutes.\n\nJe passe dans le quartier mardi. Je vous montre 2 minutes sur mon téléphone à quoi ressemblerait ${p.company} en ligne — sans prix, sans engagement, juste pour voir.\n\n${closer} — EAGLEYE, Lyon`,
    },
    {
      channel: "WhatsApp",
      subject: "Relance douce",
      body: `Bonjour ${firstName}, ${closer} d'EAGLEYE (Lyon). J'ai préparé une maquette de ${p.company} sur mobile — ça prend 2 minutes à regarder et ça vaut mille discours. Je passe mardi 15h ou jeudi 10h ?`,
    },
    {
      channel: "Email",
      subject: "Après notre échange — les chiffres",
      body: `Bonjour ${firstName},\n\nComme convenu, le résumé de l'audit :\n\n• Manque à gagner estimé : ${p.ignoranceTax.toLocaleString("fr-FR")} €/mois\n• Soit ${(p.ignoranceTax * 12).toLocaleString("fr-FR")} €/an de Taxe d'Ignorance\n• Notre solution : ${p.setupValue.toLocaleString("fr-FR")} € + ${p.monthlyValue.toLocaleString("fr-FR")} €/mois\n\nLa question n'est pas « est-ce que ça coûte cher » — c'est « combien coûte le fait de ne rien faire ».\n\nOn se voit ${p.nextStep ? relativeFr(p.nextStep.date) : "cette semaine"} pour décider avec les vrais chiffres.\n\n${closer} — EAGLEYE`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((t, i) => (
        <div key={i} className="card flex flex-col p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-bronze-500">
            {t.channel === "Email" ? <Mail size={12} /> : <MessageSquare size={12} />} {t.channel}
          </p>
          <p className="mt-1 text-sm font-medium text-paper">{t.subject}</p>
          <pre className="mt-2 flex-1 whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-850 p-3 font-body text-[12px] leading-relaxed text-paper-dim">
            {t.body}
          </pre>
          <button
            className="btn-ghost mt-3"
            onClick={() => navigator.clipboard.writeText(t.body)}
          >
            Copier
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Files tab ───────────────────────────────────────────────────────── */

function FilesTab({
  p,
  patch,
}: {
  p: Prospect;
  patch: (id: string, patch: Partial<Prospect>) => void;
}) {
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const additions = files.map((f) => ({
      id: uid(),
      name: f.name,
      kind: (f.name.includes("audit") ? "audit" : f.name.includes("prop") ? "proposition" : "autre") as
        | "audit"
        | "proposition"
        | "autre",
      size: f.size,
      addedAt: new Date().toISOString(),
    }));
    patch(p.id, { attachments: [...p.attachments, ...additions] });
  };

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-paper">Pièces jointes</h2>
        <label className="btn-bronze cursor-pointer">
          <Plus size={14} /> Ajouter
          <input type="file" multiple className="hidden" onChange={onUpload} />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-paper-faint">
        Métadonnées stockées en local — connecte Supabase Storage pour l&apos;upload réel (voir README).
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {p.attachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Paperclip size={14} className="shrink-0 text-bronze-500" />
              <div className="min-w-0">
                <p className="truncate text-sm text-paper">{a.name}</p>
                <p className="text-[11px] text-paper-faint">
                  {a.kind} · {(a.size / 1024).toFixed(0)} Ko
                </p>
              </div>
            </div>
            <button
              className="text-paper-faint hover:text-signal-red"
              onClick={() => patch(p.id, { attachments: p.attachments.filter((x) => x.id !== a.id) })}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {p.attachments.length === 0 && <p className="text-sm text-paper-faint">Aucun fichier.</p>}
      </ul>
    </section>
  );
}
