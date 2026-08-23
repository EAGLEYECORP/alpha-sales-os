"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Bot,
  CalendarPlus,
  ClipboardList,
  Crosshair,
  FileSignature,
  FileText,
  Layers,
  Linkedin,
  Mail,
  MessageSquare,
  MousePointerClick,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { buildIdentity } from "@/lib/identity";
import { matchOffer, OFFER_LABELS, type EagleyeOffer } from "@/lib/offer-match";
import { getAccount } from "@/lib/accounts";
import { guessSegmentForProspect } from "@/lib/segments";
// ⚠ Aucun import de `lib/bricks` : la grille tarifaire ne doit pas partir dans
// le bundle du navigateur (voir app/api/catalogue). On demande le catalogue et
// le chiffrage au serveur.
import type { Brick } from "@/lib/bricks";
import { CAPACITES } from "@/lib/public-catalogue";
import { buildDeck, renderDeck } from "@/lib/deck";
import { useQuote } from "@/lib/client-catalogue";
import { leconDePerte, leconDObjection } from "@/lib/apprentissage";
import { MasterPanel } from "@/components/prospects/master-panel";
import { FundingEditor } from "@/components/prospects/funding-editor";
import { DealCalculator } from "@/components/prospects/deal-calculator";
import { CallHistory } from "@/components/prospects/call-history";
import { CheckpointsPanel } from "@/components/prospects/checkpoints-panel";
import { LeadMagnetPanel } from "@/components/prospects/lead-magnet-panel";
import { OnboardingPanel } from "@/components/prospects/onboarding-panel";
import { search, contextFromNotes } from "@/lib/knowledge";
import { AlphaLiveButton } from "@/components/live/alpha-live";
import type { EventKind, Objection, Obstacle, Prospect, Stage } from "@/lib/types";
import {
  BLAME_LAYERS,
  CROYANCES_META,
  OBJECTION_LIBRARY,
  OBSTACLE_LIBRARY,
  STAGES,
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
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { SendBar } from "@/components/send-bar";
import { syncProspectToCrm } from "@/lib/n8n";
import { criticalGaps } from "@/lib/missing-info";
import { ClientTrackingStats } from "@/components/tracking/tracking-stats";
import { ClosingMode } from "@/components/training/closing-mode";
import { DeepdiveTools } from "@/components/prospects/deepdive-tools";
import { RecoveryProjection } from "@/components/prospects/recovery-projection";
import { Sparring } from "@/components/training/sparring";
import { fireSignedConfetti } from "@/lib/confetti";

type Tab = "doctrine" | "audit" | "timeline" | "commercial" | "coach" | "templates" | "tracking" | "fichiers";

const EVENT_ICONS: Record<EventKind, React.ReactNode> = {
  appel: <Phone size={13} />,
  visite: <ArrowLeft size={13} className="rotate-45" />,
  email: <Mail size={13} />,
  whatsapp: <MessageSquare size={13} />,
  linkedin: <Linkedin size={13} />,
  demo: <Smartphone size={13} />,
  meeting: <CalendarPlus size={13} />,
  note: <FileText size={13} />,
  stage: <Layers size={13} />,
  offre: <Sparkles size={13} />,
};

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { prospects, settings, patchProspect, moveStage, addEvent, deleteProspect, apprendre } = useAlpha();
  const p = prospects.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("doctrine");
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sparring, setSparring] = useState(false);
  const [reasonAsk, setReasonAsk] = useState<{ kind: "won" | "lost"; stage: Stage } | null>(null);
  const [crmSync, setCrmSync] = useState("");

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
    setReasonAsk({ kind: "won", stage: "signe" });
  };

  /** Stage stepper — works on touch, same doctrine gates as the Kanban. */
  const changeStage = (stageId: (typeof STAGES)[number]["id"]) => {
    if (stageId === p.stage) return;
    if (stageId === "signe") {
      trySign();
      return;
    }
    if (stageId === "perdu") {
      setReasonAsk({ kind: "lost", stage: "perdu" });
      return;
    }
    moveStage(p.id, stageId);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between gap-2 text-sm text-paper-faint">
        <div className="flex items-center gap-2">
          <Link href="/pipeline" className="flex items-center gap-1 hover:text-paper">
            <ArrowLeft size={14} /> Pipeline
          </Link>
          <span>/</span>
          <span className="text-paper">{p.company}</span>
        </div>
        <AlphaLiveButton prospect={p} />
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
            <ProgressRing value={p.probability} size={52} label="close %" tone="heat" />
            <ProgressRing value={p.conviction} max={10} size={52} label="conviction" tone={p.conviction >= 10 ? "green" : "red"} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
          {p.stage !== "signe" && p.stage !== "perdu" && (
            <button className="btn-bronze" onClick={() => setClosing(true)}>
              ▶ Mode Closing
            </button>
          )}
          <button className="btn-ghost" onClick={() => setSparring(true)} title="Le prospect est joué par l'IA — entraîne-toi avant le vrai RDV">
            🥊 Sparring
          </button>
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
            className="btn-ghost"
            title="Repousser la fiche vers le CRM centralisé (Supabase → Google Sheets via n8n)"
            onClick={async () => {
              setCrmSync("Synchronisation…");
              const r = await syncProspectToCrm(p);
              setCrmSync(r.ok ? `✓ ${r.via.join(" + ") || "aucune cible"}` : `Échec : ${r.error ?? "n8n/Supabase non configurés"}`);
              setTimeout(() => setCrmSync(""), 4000);
            }}
          >
            <UploadCloud size={14} /> {crmSync || "Synchroniser CRM"}
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

        {/* Stage stepper — tap to move (mobile-first, doctrine-gated) */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-faint">Étape :</span>
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => changeStage(s.id)}
              title={s.hint}
              className={cn(
                "chip transition-colors",
                s.id === p.stage
                  ? "border-gold bg-gold font-semibold text-goldink"
                  : i < STAGES.findIndex((x) => x.id === p.stage)
                    ? "border-bronze-700/60 text-bronze-600 hover:text-bronze-400"
                    : "border-ink-600 text-paper-faint hover:border-bronze-700 hover:text-paper"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Current next step + quick log */}
        {p.nextStep && !["signe", "perdu"].includes(p.stage) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-2.5">
            <p className="text-sm text-paper-dim">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper-faint">Next step · </span>
              {p.nextStep.action}{" "}
              <span className={cn("font-mono text-[11px]", new Date(p.nextStep.date) < new Date() ? "text-signal-red" : "text-bronze-400")}>
                ({relativeFr(p.nextStep.date)})
              </span>
            </p>
            <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={() => setTab("timeline")}>
              ✓ Consigner le contact
            </button>
          </div>
        )}

        {/* Next best action banner */}
        <div className="mt-4 rounded-lg border border-bronze-700/60 bg-bronze-900/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-bronze-500">
            Prochaine meilleure action · urgence {nba.urgency}
          </p>
          <p className="mt-0.5 text-sm font-medium text-paper">{nba.action}</p>
          <p className="text-[12px] text-paper-dim">{nba.why}</p>
        </div>

        {/* Infos critiques manquantes — à obtenir puis remonter vers le CRM */}
        {criticalGaps(p).length > 0 && (
          <div className="mt-3 rounded-lg border border-signal-red/40 bg-signal-red/5 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-signal-red">Infos critiques manquantes</p>
            <ul className="mt-1 space-y-0.5 text-[13px] text-paper-dim">
              {criticalGaps(p).map((g) => (
                <li key={g.field}>
                  • <strong className="text-paper">{g.label}</strong> <span className="text-paper-faint">— {g.why}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-paper-faint">
              Renseigne-les (Modifier / onglets Audit &amp; Commercial), puis « Synchroniser CRM » : elles remontent jusqu&apos;à Supabase → Google Sheets.
            </p>
          </div>
        )}
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
            ["tracking", "Tracking", <MousePointerClick key="i" size={14} />],
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
      {tab === "templates" && (
        <div className="space-y-4">
          <LeadMagnetPanel p={p} />
          <TemplatesTab p={p} closer={settings.closerName} />
        </div>
      )}
      {tab === "tracking" && <ClientTrackingStats prospectId={p.id} />}
      {tab === "fichiers" && <FilesTab p={p} patch={patchProspect} />}

      <ProspectFormModal open={editing} onClose={() => setEditing(false)} initial={p} />
      {closing && (
        <ClosingMode
          p={p}
          onClose={() => setClosing(false)}
          onSpar={() => {
            setClosing(false);
            setSparring(true);
          }}
        />
      )}
      {sparring && <Sparring p={p} onClose={() => setSparring(false)} />}
      <ReasonDialog
        open={!!reasonAsk}
        kind={reasonAsk?.kind ?? "won"}
        company={p.company}
        onCancel={() => setReasonAsk(null)}
        onSubmit={(reason) => {
          if (reasonAsk) {
            const res = moveStage(
              p.id,
              reasonAsk.stage,
              reasonAsk.kind === "won" ? { wonReason: reason } : { lostReason: reason }
            );
            if (res.ok && reasonAsk.stage === "signe") fireSignedConfetti();
            // La raison d'un refus est l'information la plus chère du pipe et
            // la plus vite oubliée — parce qu'on n'a pas envie de la relire.
            // Elle entre donc dans le Cerveau toute seule, avec le secteur et
            // le segment, pour ressortir au prochain prospect du même métier.
            if (res.ok && reasonAsk.kind === "lost") {
              // `reason` est optionnel : sans raison saisie, `leconDePerte`
              // renvoie null et rien n'est écrit. Une note « perdu, on ne sait
              // pas pourquoi » n'apprend rien et pollue la recherche.
              apprendre(leconDePerte({ prospect: p, raison: reason ?? "", accountId: settings.accountId }));
            }
          }
          setReasonAsk(null);
        }}
      />
    </div>
  );
}

/* ── Doctrine tab: croyances, obstacles, objections ─────────────────── */

/**
 * Le segment détecté — qui il est AVANT quoi lui dire.
 *
 * Sans ça, l'opérateur sert le même angle à un bouchon lyonnais et à un plateau
 * de 60 positions. Le module renvoie `null` quand il ne sait pas : on affiche
 * alors ce qu'il faut écrire pour qu'il sache, plutôt qu'un segment inventé.
 */
function SegmentCard({ p }: { p: Prospect }) {
  const seg = guessSegmentForProspect({ sector: p.sector, company: p.company, notes: p.notes, problems: p.problems });

  if (!seg) {
    return (
      <section className="card p-4 lg:col-span-2">
        <h2 className="font-display text-sm font-semibold text-paper">Segment — non identifié</h2>
        <p className="mt-1 text-[12px] text-paper-faint">
          Rien dans la fiche ne dit à qui on parle. Écris le métier réel dans les <strong className="text-paper">notes</strong> (ex. « Métier :
          centre d&apos;appels, 60 positions » ou « couverture, 12 commerciaux en porte-à-porte ») — l&apos;angle, les briques d&apos;entrée et
          les disqualifiants s&apos;affichent ensuite tout seuls. Tant que c&apos;est vide, aucun segment n&apos;est deviné : un angle adressé au
          mauvais profil coûte plus cher qu&apos;un angle générique.
        </p>
      </section>
    );
  }

  // Les LIBELLÉS ne sont pas secrets (ils sont sur la page publique) : on les
  // prend dans le catalogue public, qui ne porte aucun prix.
  const bricks = seg.entryBricks.map((id) => CAPACITES.find((c) => c.id === id)?.label ?? id);

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-semibold text-paper">Segment — {seg.who}</h2>
        <span className="text-[11px] text-paper-faint">{seg.teamSize} · décideur : {seg.buyer}</span>
      </div>

      <p className="mt-2 text-[12px] text-paper">{seg.corePain}</p>
      <p className="mt-2 rounded-lg border border-ink-700 bg-ink-900 p-3 text-[12px] italic text-paper">{seg.angle}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-paper-faint">Brique d&apos;entrée</h3>
          <p className="mt-1 text-[12px] text-paper">{bricks.join(" + ")}</p>
          <p className="mt-1 text-[11px] text-paper-faint">{seg.dealRange}</p>
        </div>
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-paper-faint">Quand l&apos;approcher</h3>
          <ul className="mt-1 space-y-0.5 text-[12px] text-paper">
            {seg.triggers.slice(0, 3).map((t) => (
              <li key={t}>· {t}</li>
            ))}
          </ul>
        </div>
        <div>
          {/* Dire non vite vaut mieux que traîner un dossier qui ne signera pas. */}
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-paper-faint">Ne pas insister si</h3>
          <ul className="mt-1 space-y-0.5 text-[12px] text-paper-faint">
            {seg.disqualifiers.slice(0, 3).map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function DoctrineTab({
  p,
  patch,
}: {
  p: Prospect;
  patch: (id: string, patch: Partial<Prospect>) => void;
}) {
  const apprendre = useAlpha((s) => s.apprendre);
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
      <SegmentCard p={p} />

      {/* 3 Croyances */}
      <section className="card p-4 lg:col-span-2">
        <h2 className="font-display text-sm font-semibold text-paper">Les 3 Croyances — toutes à 10 pour signer</h2>
        <p className="mt-0.5 text-[11px] text-paper-faint">
          En clair : s&apos;il hésite encore, c&apos;est qu&apos;une de ces trois convictions n&apos;est pas installée. Trouve laquelle, répare-la.
        </p>
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
          Obstacles <span className="text-[11px] font-normal text-paper-faint">(AVANT l&apos;offre — les excuses pour ne pas écouter)</span>
        </h2>
        <p className="mt-0.5 text-[11px] text-paper-faint">
          Il se cache derrière 3 couches : les circonstances (« pas le moment »), les autres (« mon associé »), lui-même (« je suis nul en informatique »). On épluche, on n&apos;argumente pas.
        </p>
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
          Objections <span className="text-[11px] font-normal text-signal-red">(APRÈS l&apos;offre — les vraies raisons de ne pas signer)</span>
        </h2>
        <p className="mt-0.5 text-[11px] text-paper-faint">
          Chaque objection pointe une des 3 Croyances cassée. On répare la croyance, pas l&apos;argument.
        </p>
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
                  onChange={(e) => {
                    const status = e.target.value as Objection["status"];
                    patch(p.id, {
                      objections: p.objections.map((x) => (x.id === o.id ? { ...x, status } : x)),
                    });
                    // Les objections se répètent par métier, presque mot pour
                    // mot. Une réponse qui a débloqué un garagiste débloquera
                    // le suivant — à condition qu'on l'ait écrite. C'est la
                    // mémoire la plus rentable du système, et personne ne la
                    // remplirait à la main.
                    if (o.counter && (status === "traitee" || status === "bloquante")) {
                      apprendre(
                        leconDObjection({
                          prospect: p,
                          objection: o.label,
                          reponse: o.counter,
                          aDebloque: status === "traitee",
                        })
                      );
                    }
                  }}
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

/* ── Routage d'offre : quelle offre EAGLEYE pour ce prospect ────────── */

const OFFER_BAR: Record<EagleyeOffer, string> = {
  "alpha-sales-os": "bg-bronze-500",
  callflow: "bg-signal-green",
  "visibilite-growth": "bg-signal-amber",
};

function OfferRecommendation({ p }: { p: Prospect }) {
  const a = p.deepAudit;
  // Le compte actif contraint l'offre : un compte mono-offre (ScintIA =
  // callflow seul) ne recommande jamais une offre qu'il ne vend pas.
  const accountId = useAlpha((s) => s.settings.accountId);
  const m = matchOffer(
    {
      sector: String(p.sector),
      missedCallsPerWeek: a.missedCallsPerWeek,
      googleRating: a.googleRating,
      googleReviews: a.googleReviews,
      websiteState: a.websiteState,
      socialState: a.socialState,
      monthlyValue: p.monthlyValue,
      avgTicket: a.avgTicket,
    },
    getAccount(accountId).offers
  );
  const maxScore = Math.max(1, ...Object.values(m.scores));
  const noSignal = Math.max(...Object.values(m.scores)) <= 0;
  const order: EagleyeOffer[] = ["alpha-sales-os", "callflow", "visibilite-growth"];
  const reasons = m.reasons[m.primary];

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Crosshair size={15} className="text-bronze-400" /> Offre recommandée
        </h2>
        {!noSignal && <span className="chip border-gold/50 bg-gold/10 text-bronze-400">{OFFER_LABELS[m.primary].split(" — ")[0]}</span>}
      </div>

      {noSignal ? (
        <p className="mt-2 text-[12px] text-paper-faint">
          Renseigne l&apos;audit ci-dessus (appels ratés, site, avis, secteur) — l&apos;app route alors ce prospect vers Callflow, Alpha Sales OS ou une offre Visibilité/Growth.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-bronze-400">{m.pitch}</p>
          <div className="mt-3 space-y-2">
            {order.map((o) => (
              <div key={o} className="flex items-center gap-3">
                <span className={cn("w-40 shrink-0 text-[11px]", o === m.primary ? "font-medium text-paper" : "text-paper-faint")}>
                  {OFFER_LABELS[o].split(" — ")[0]}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                  <div className={cn("h-full rounded-full", OFFER_BAR[o], o !== m.primary && "opacity-40")} style={{ width: `${(m.scores[o] / maxScore) * 100}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right font-mono text-[11px] text-paper-faint">{m.scores[o]}</span>
              </div>
            ))}
          </div>
          {reasons.length > 0 && (
            <p className="mt-3 text-[11.5px] text-paper-dim">
              <span className="text-paper-faint">Pourquoi :</span> {reasons.join(" · ")}.
            </p>
          )}
        </>
      )}
    </section>
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
      {/* Import de recherche externe + audit cadeau (lead magnet) */}
      <DeepdiveTools p={p} patch={patch} />

      {/* Projette-toi — projection de récupération sur ses propres chiffres (RDV) */}
      <RecoveryProjection p={p} />

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

      {/* MASTER RAPPEL — quoi faire maintenant, qui le fait, est-ce que ça tourne */}
      <MasterPanel p={p} />

      {/* Checkpoints humains — les portes que la machine ne franchit pas seule */}
      <CheckpointsPanel p={p} />

      {/* Historique de conversation — les transcriptions réinjectées au prochain appel */}
      <CallHistory prospectId={p.id} />

      {/* Déblocage des fonds — ce qui transforme un « oui » en virement */}
      {/* Structurer CETTE affaire : le barème dit ce qu'on vise, ici on
          négocie, et on voit en euros ce que coûte chaque point lâché. */}
      <DealCalculator p={p} />
      <FundingEditor p={p} />

      {/* Routage d'offre — quelle offre EAGLEYE pour ce prospect (lib/offer-match) */}
      <OfferRecommendation p={p} />

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
          placeholder="Ce qu'on installe chez LUI, et ce que ça règle — ex. « Alpha Live sur les 12 tournées : chaque visite laisse une trace datée, chaque devis a sa relance »"
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

/**
 * Le devis à la carte, depuis la fiche.
 *
 * `quoteBricks`/`quoteText` existaient depuis le début et n'étaient appelés
 * que par les tests : pour envoyer un devis, il fallait recopier les prix à la
 * main. C'est exactement là qu'on se trompe de montant au dernier mètre.
 * L'ancrage sur le pack est calculé, pas plaidé : la recommandation vient du
 * module, elle change quand l'addition change.
 */
function QuoteBuilder({ p }: { p: Prospect }) {
  const settings = useAlpha((s) => s.settings);
  const [picked, setPicked] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [bricks, setBricks] = useState<Brick[]>([]);
  const [devis, setDevis] = useState<{ setupHT: number; monthlyHT: number; firstYearHT: number; recommendation: string } | null>(null);
  const [texte, setTexte] = useState("");

  // Le catalogue vient du serveur : c'est ce qui garde les prix hors des
  // fichiers JavaScript téléchargeables par n'importe qui.
  useEffect(() => {
    let vivant = true;
    fetch("/api/catalogue")
      .then((r) => r.json())
      .then((d: { bricks?: Brick[] }) => {
        if (vivant) setBricks(d.bricks ?? []);
      })
      .catch(() => {
        /* hors ligne : la liste reste vide, et le bloc le montre */
      });
    return () => {
      vivant = false;
    };
  }, []);

  const issuer = settings.agencyName?.trim()
    ? [settings.agencyName.trim(), settings.offer?.city?.trim()].filter(Boolean).join(" · ")
    : undefined;

  // Le chiffrage aussi : calculer dans le navigateur supposerait d'y avoir la
  // grille, ce qui annulerait tout l'intérêt.
  useEffect(() => {
    if (picked.length === 0) {
      setDevis(null);
      setTexte("");
      return;
    }
    let vivant = true;
    fetch("/api/catalogue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bricks: picked, client: p.company, issuer }),
    })
      .then((r) => r.json())
      .then((d: { quote?: typeof devis; texte?: string }) => {
        if (!vivant) return;
        setDevis(d.quote ?? null);
        setTexte(d.texte ?? "");
      })
      .catch(() => {
        /* le devis reste vide plutôt que faux */
      });
    return () => {
      vivant = false;
    };
  }, [picked, p.company, issuer]);

  const toggle = (id: string) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <section className="card p-4 lg:col-span-2">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <FileText size={15} className="text-bronze-400" /> Devis à la carte
      </h2>
      <p className="mt-0.5 text-[11px] text-paper-faint">
        Coche ce qu&apos;il prend. Les prix viennent du catalogue, côté serveur — jamais recopiés à la main.
      </p>

      {bricks.length === 0 ? (
        <p className="mt-3 text-[12px] text-paper-faint">Catalogue indisponible — vérifie la connexion.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {bricks.map((b) => (
            <button
              key={b.id}
              onClick={() => toggle(b.id)}
              title={b.what}
              className={cn(
                "chip transition-colors",
                picked.includes(b.id)
                  ? "border-gold bg-gold font-semibold text-goldink"
                  : "border-ink-600 text-paper-faint hover:border-bronze-700 hover:text-paper"
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {devis && (
        <>
          <div className="mt-3 flex flex-wrap gap-4 font-mono text-sm">
            <span className="text-paper">{eur(devis.setupHT)} HT d&apos;installation</span>
            <span className="text-bronze-400">{eur(devis.monthlyHT)} HT/mois</span>
            <span className="text-paper-faint">1re année : {eur(devis.firstYearHT)} HT</span>
          </div>
          <p className="mt-2 rounded-lg border border-bronze-700/50 bg-bronze-900/20 px-3 py-2 text-[12px] text-paper">
            {devis.recommendation}
          </p>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-ink-600 bg-ink-850 p-3 text-[12px] text-paper">
            {texte}
          </pre>
          <button
            className="btn-ghost mt-2 px-3 py-1.5 text-[12px]"
            onClick={() => {
              navigator.clipboard.writeText(texte);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copié ✓" : "Copier le devis"}
          </button>
          {/* Le rituel de closing dépend du compte : se tromper de rituel perd
              le deal au dernier mètre. Il est rappelé dans le panneau maître. */}
          <p className="mt-2 text-[11px] text-paper-faint">
            Vérifie le rituel de closing du compte avant d&apos;envoyer — devis EAGLEYE, proposition ScintIA depuis le panel, ou RDV de cadrage Nuwacom.
          </p>
        </>
      )}
    </section>
  );
}

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
      <OnboardingPanel p={p} />
      <QuoteBuilder p={p} />
      <DeckButton p={p} />

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

      {/* Suivi & fidélisation : canal, satisfaction, témoignage, upsell */}
      <section className="card p-4 lg:col-span-2">
        <h2 className="font-display text-sm font-semibold text-paper">Suivi & fidélisation</h2>
        <p className="mt-1 text-[11px] text-paper-faint">
          Après la livraison : mesurer la satisfaction, récolter un témoignage, ouvrir un upsell. C&apos;est là que le client devient une machine à referrals.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Plateforme d&apos;échange privilégiée</label>
            <select
              className="input"
              value={p.preferredChannel ?? ""}
              onChange={(e) => patch(p.id, { preferredChannel: e.target.value || undefined })}
            >
              <option value="">— non défini —</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="tel">Téléphone</option>
              <option value="linkedin">LinkedIn</option>
              <option value="sms">SMS</option>
              <option value="autre">Autre</option>
            </select>

            <label className="label mt-4 flex items-center justify-between">
              <span>Satisfaction</span>
              <label className="flex items-center gap-1.5 text-[10px] normal-case tracking-normal text-paper-faint">
                <input
                  type="checkbox"
                  className="accent-bronze-500"
                  checked={p.satisfaction !== undefined}
                  onChange={(e) => patch(p.id, { satisfaction: e.target.checked ? 70 : undefined })}
                />
                mesurée
              </label>
            </label>
            {p.satisfaction !== undefined ? (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={p.satisfaction}
                  onChange={(e) => patch(p.id, { satisfaction: +e.target.value })}
                  className="flex-1 accent-bronze-500"
                />
                <span className={cn("font-mono text-sm", p.satisfaction >= 70 ? "text-signal-green" : p.satisfaction >= 40 ? "text-bronze-400" : "text-signal-red")}>
                  {p.satisfaction}/100
                </span>
              </div>
            ) : (
              <p className="text-[12px] text-paper-faint">Coche « mesurée » après le point J+30.</p>
            )}
          </div>

          <div>
            <label className="label">Témoignage / avis</label>
            <textarea
              className="input min-h-20"
              value={p.testimonial ?? ""}
              placeholder="Ce que le client dit de nous — mot pour mot (futur argument de vente)…"
              onChange={(e) => patch(p.id, { testimonial: e.target.value || undefined, testimonialAt: e.target.value ? new Date().toISOString() : undefined })}
            />
            {p.testimonialAt && <p className="mt-1 text-[11px] text-signal-green">Recueilli le {dateTimeFr(p.testimonialAt)}</p>}
          </div>
        </div>

        {/* Upsell */}
        <div className="mt-4 rounded-lg border border-bronze-700/40 bg-bronze-900/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-paper">Opportunité d&apos;upsell</p>
            <select
              className="input w-40 py-1 text-[12px]"
              value={p.upsell?.status ?? "aucun"}
              onChange={(e) =>
                patch(p.id, {
                  upsell: {
                    note: p.upsell?.note ?? "",
                    value: p.upsell?.value,
                    status: e.target.value as NonNullable<Prospect["upsell"]>["status"],
                  },
                })
              }
            >
              <option value="aucun">Aucune</option>
              <option value="identifie">Identifiée</option>
              <option value="propose">Proposée</option>
              <option value="gagne">Gagnée ✓</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="input flex-1 min-w-48"
              placeholder="Quelle suite ? (module IA, seconde régie, maintenance premium…)"
              value={p.upsell?.note ?? ""}
              onChange={(e) => patch(p.id, { upsell: { note: e.target.value, value: p.upsell?.value, status: p.upsell?.status ?? "identifie" } })}
            />
            <input
              type="number"
              className="input w-32"
              placeholder="€/mois"
              value={p.upsell?.value ?? ""}
              onChange={(e) => patch(p.id, { upsell: { note: p.upsell?.note ?? "", value: e.target.value === "" ? undefined : +e.target.value, status: p.upsell?.status ?? "identifie" } })}
            />
            {p.upsell && (p.upsell.note || p.upsell.value) && (
              <button
                className="btn-ghost px-2.5 py-1.5 text-[12px]"
                onClick={() => patch(p.id, { upsell: undefined })}
                title="Retirer l'upsell"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
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
  const settings = useAlpha((s) => s.settings);
  const notes = useAlpha((s) => s.notes);
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
        body: JSON.stringify({
          task,
          prospect: p,
          businessRules: rules,
          accountId: settings.accountId,
          identity: buildIdentity(settings),
          brainContext: contextFromNotes(search(`${p.company} ${p.sector} ${p.problems.join(" ")} ${p.solution ?? ""} ${objection}`, notes)),
          ...extra,
        }),
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
  // 3 messages prêts pour CE prospect — la bibliothèque complète est dans /templates
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
      channel: "LinkedIn",
      subject: "Invitation (≤ 300 car.)",
      body: `Bonjour ${firstName} — j'ai étudié la présence en ligne de ${p.company} (note, avis, réactivité) et j'ai 2-3 constats chiffrés qui devraient vous intéresser. Je suis lyonnais, je travaille avec des ${p.sector === "autre" ? "entreprises" : p.sector + "s"} du coin. Partant pour échanger ? — ${closer}, EAGLEYE`,
    },
    {
      channel: "Email",
      subject: "Après notre échange — les chiffres",
      body: `Bonjour ${firstName},\n\nComme convenu, le résumé de l'audit :\n\n• Manque à gagner estimé : ${p.ignoranceTax.toLocaleString("fr-FR")} €/mois\n• Soit ${(p.ignoranceTax * 12).toLocaleString("fr-FR")} €/an de Taxe d'Ignorance\n• Notre solution : ${p.setupValue.toLocaleString("fr-FR")} € + ${p.monthlyValue.toLocaleString("fr-FR")} €/mois\n\nLa question n'est pas « est-ce que ça coûte cher » — c'est « combien coûte le fait de ne rien faire ».\n\nOn se voit ${p.nextStep ? relativeFr(p.nextStep.date) : "cette semaine"} pour décider avec les vrais chiffres.\n\n${closer} — EAGLEYE`,
    },
  ];

  return (
    <div className="space-y-4">
    <div className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5">
      <p className="text-[12px] text-paper-faint">4 messages prêts pour <strong className="text-paper">{p.company}</strong> (email, WhatsApp, LinkedIn) — besoin d&apos;un autre moment ou format ?</p>
      <Link href="/templates" className="btn-ghost px-3 py-1.5 text-[12px]">Toute la bibliothèque →</Link>
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((t, i) => (
        <div key={i} className="card flex flex-col p-4">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-bronze-500">
            {t.channel === "Email" ? <Mail size={12} /> : t.channel === "LinkedIn" ? <Linkedin size={12} /> : <MessageSquare size={12} />} {t.channel}
          </p>
          <p className="mt-1 text-sm font-medium text-paper">{t.subject}</p>
          <pre className="mt-2 flex-1 whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-850 p-3 font-body text-[12px] leading-relaxed text-paper-dim">
            {t.body}
          </pre>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => navigator.clipboard.writeText(t.body)}>
              Copier
            </button>
            <SendBar prospect={p} subject={t.subject} body={t.body} compact offerAudit={i === 0} />
          </div>
        </div>
      ))}
    </div>
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

/**
 * La présentation de CE prospect, à SON étape.
 *
 * Ouverte dans un onglet plutôt que téléchargée : on la montre en rendez-vous,
 * on ne la classe pas. Les « omissions » sont affichées à l'opérateur et
 * JAMAIS dans le document — ce sont des notes de préparation, pas du contenu
 * client. C'est là qu'on lit « aucun prix, il n'a pas vu la démo ».
 */
function DeckButton({ p }: { p: Prospect }) {
  const settings = useAlpha((s) => s.settings);
  // Les briques d'entrée viennent du segment (calcul local, sans montant) ;
  // leur PRIX se calcule côté serveur. Tant qu'il n'est pas revenu, la
  // présentation se construit sans diapositive de prix et l'omission est
  // affichée à l'opérateur — jamais un montant approximatif.
  const briques = useMemo(() => {
    const seg = guessSegmentForProspect({ sector: p.sector, company: p.company, notes: p.notes, problems: p.problems });
    return seg?.entryBricks ?? [];
  }, [p.sector, p.company, p.notes, p.problems]);
  const prix = useQuote(briques);
  const deck = useMemo(() => buildDeck(p, settings.accountId ?? "eagleye", new Date(), prix ?? undefined), [p, settings.accountId, prix]);

  const ouvrir = () => {
    const html = renderDeck(deck, settings.agencyName || "EAGLEYE CORP");
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <FileText size={15} className="text-bronze-400" /> Présentation — {deck.stageLabel}
        </h2>
        <span className="text-[11px] text-paper-faint">{deck.slides.length} diapositives · {deck.objective}</span>
      </div>

      <ul className="mt-2 space-y-0.5 text-[12px] text-paper">
        {deck.slides.map((s, i) => (
          <li key={i}>
            <span className="font-mono text-[10px] text-paper-faint">{i + 1}.</span> {s.title}
          </li>
        ))}
      </ul>

      {deck.omissions.length > 0 && (
        <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-paper-faint">Ce que la présentation NE dit pas</p>
          <ul className="mt-1 space-y-0.5 text-[11.5px] text-paper-dim">
            {deck.omissions.map((o) => (
              <li key={o}>· {o}</li>
            ))}
          </ul>
        </div>
      )}

      <button className="btn-ghost mt-3 px-3 py-1.5 text-[12px]" onClick={ouvrir}>
        Ouvrir la présentation
      </button>
    </section>
  );
}
