"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, GripVertical, Smartphone } from "lucide-react";
import type { Prospect, Stage } from "@/lib/types";
import { STAGES, weightedValue, croyancesReady, signingBlockers } from "@/lib/hormozi";
import { cn, eur, isOverdue, relativeFr } from "@/lib/utils";
import { useAlpha } from "@/lib/store";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Modal } from "@/components/ui/modal";
import { fireSignedConfetti } from "@/lib/confetti";

export function KanbanBoard({ prospects }: { prospects: Prospect[] }) {
  const moveStage = useAlpha((s) => s.moveStage);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [blockers, setBlockers] = useState<{ company: string; list: string[] } | null>(null);

  // Shared gated move — used by drag-drop (desktop) AND arrow buttons (touch).
  const requestMove = (p: Prospect, stage: Stage) => {
    let extra: { wonReason?: string; lostReason?: string } | undefined;
    if (stage === "signe") {
      if (signingBlockers(p).length === 0) {
        extra = { wonReason: prompt("Pourquoi OUI ? (raison du win — alimente les KPIs)") || undefined };
      }
    } else if (stage === "perdu") {
      extra = { lostReason: prompt("Pourquoi NON ? (raison de perte — doctrine : toujours documentée)") || undefined };
    }
    const res = moveStage(p.id, stage, extra);
    if (!res.ok) setBlockers({ company: p.company, list: res.blockers });
    if (res.ok && stage === "signe") fireSignedConfetti();
    return res.ok;
  };

  const drop = (stage: Stage) => {
    if (!dragId) return;
    const p = prospects.find((x) => x.id === dragId);
    if (p) requestMove(p, stage);
    setDragId(null);
    setOverStage(null);
  };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {STAGES.map((stage) => {
          const items = prospects.filter((p) => p.stage === stage.id);
          const colValue = items.reduce((s, p) => s + weightedValue(p), 0);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={() => drop(stage.id)}
              className={cn(
                "flex w-64 shrink-0 flex-col rounded-xl border bg-ink-900/50 transition-colors",
                overStage === stage.id ? "border-bronze-500 bg-bronze-900/20" : "border-ink-700",
                stage.id === "redzone" && "border-signal-red/30",
                stage.id === "signe" && "border-signal-green/30"
              )}
            >
              <div className="border-b border-ink-700 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      stage.id === "redzone" ? "text-signal-red" : stage.id === "signe" ? "text-signal-green" : "text-bronze-400"
                    )}
                  >
                    {stage.label}
                  </span>
                  <span className="font-mono text-[11px] text-paper-faint">{items.length}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-paper-faint" title={stage.hint}>
                  {stage.hint}
                </p>
                <p className="font-mono text-[11px] text-bronze-500">{eur(colValue)}</p>
              </div>
              <div className="flex-1 space-y-2 p-2 min-h-24">
                {items.map((p) => (
                  <KanbanCard
                    key={p.id}
                    p={p}
                    dragging={dragId === p.id}
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => setDragId(null)}
                    onMove={(dir) => {
                      const idx = STAGES.findIndex((s) => s.id === p.stage);
                      const target = STAGES[idx + dir];
                      if (target) requestMove(p, target.id);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!blockers} onClose={() => setBlockers(null)} title="⛔ Signature bloquée par la doctrine">
        <p className="mb-3 text-sm text-paper-dim">
          <strong className="text-paper">{blockers?.company}</strong> ne peut pas passer en « Signé » :
        </p>
        <ul className="space-y-2">
          {blockers?.list.map((b, i) => (
            <li key={i} className="flex gap-2 rounded-lg border border-signal-red/30 bg-signal-red/5 px-3 py-2 text-sm text-paper">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-signal-red" />
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12px] italic text-paper-faint">
          La conviction se transfère, elle ne se négocie pas. Répare les croyances, puis reviens signer.
        </p>
      </Modal>
    </>
  );
}

function KanbanCard({
  p,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  p: Prospect;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** touch-friendly: -1 = previous stage, +1 = next stage */
  onMove: (dir: -1 | 1) => void;
}) {
  const overdue = p.nextStep && isOverdue(p.nextStep.date) && !["signe", "perdu"].includes(p.stage);
  const openObjections = p.objections.filter((o) => o.status !== "traitee").length;
  const stageIdx = STAGES.findIndex((s) => s.id === p.stage);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "card card-hover cursor-grab p-3 active:cursor-grabbing",
        dragging && "opacity-40 rotate-1"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/prospects/${p.id}`} className="min-w-0">
          <p className="truncate text-sm font-medium text-paper hover:text-bronze-300">{p.company}</p>
          <p className="truncate text-[11px] text-paper-faint">
            {p.name} · {p.city}
          </p>
        </Link>
        <GripVertical size={14} className="mt-0.5 shrink-0 text-paper-faint" />
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex gap-2">
          <ProgressRing value={p.trust} size={36} stroke={3} label="conf." />
          <ProgressRing value={p.auditScore} size={36} stroke={3} label="audit" tone="dim" />
          <ProgressRing value={p.probability} size={36} stroke={3} label="close" tone="heat" />
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-bronze-400">{eur(weightedValue(p))}</p>
          <p className="font-mono text-[10px] text-paper-faint">{p.monthlyValue} €/m</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {p.demoShownBeforePrice && (
          <span className="chip border-bronze-700 text-bronze-400" title="Démo mobile faite avant le prix">
            <Smartphone size={10} /> démo ✓
          </span>
        )}
        {!croyancesReady(p.croyances) && !["prospect", "contact"].includes(p.stage) && (
          <span className="chip border-ink-600 text-paper-faint" title="Croyances < 10">
            3C {p.croyances.produit}/{p.croyances.soutien}/{p.croyances.pourLui}
          </span>
        )}
        {openObjections > 0 && (
          <span className="chip border-signal-red/50 text-signal-red">{openObjections} objection(s)</span>
        )}
      </div>

      {p.nextStep && (
        <p className={cn("mt-2 truncate text-[11px]", overdue ? "text-signal-red" : "text-paper-faint")}>
          → {p.nextStep.action} · {relativeFr(p.nextStep.date)}
        </p>
      )}
      {!p.nextStep && !["signe", "perdu"].includes(p.stage) && (
        <p className="mt-2 text-[11px] font-medium text-signal-red">⚠ AUCUN NEXT STEP DATÉ</p>
      )}

      {/* Touch controls — drag-drop doesn't exist on mobile */}
      <div className="mt-2 flex items-center justify-between border-t border-ink-700 pt-2">
        <button
          className="rounded-full border border-ink-600 p-1.5 text-paper-faint transition-colors hover:border-bronze-600 hover:text-bronze-400 disabled:opacity-25"
          disabled={stageIdx <= 0}
          title="Étape précédente"
          onClick={(e) => {
            e.stopPropagation();
            onMove(-1);
          }}
        >
          <ChevronLeft size={14} />
        </button>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper-faint">
          {stageIdx + 1}/{STAGES.length}
        </span>
        <button
          className="rounded-full border border-ink-600 p-1.5 text-paper-faint transition-colors hover:border-bronze-600 hover:text-bronze-400 disabled:opacity-25"
          disabled={stageIdx >= STAGES.length - 1}
          title="Étape suivante"
          onClick={(e) => {
            e.stopPropagation();
            onMove(1);
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
