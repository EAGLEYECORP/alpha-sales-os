"use client";

import { useMemo } from "react";
import { Check, CircleAlert, ShieldCheck, Square } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { useAlpha } from "@/lib/store";
import { checkpointsFor } from "@/lib/checkpoints";
import { cn } from "@/lib/utils";

/** Préfixe des tags qui portent les checkpoints déclarés. */
const TAG = "cp:";

/**
 * CHECKPOINTS HUMAINS — les portes que la machine ne franchit pas seule.
 *
 * Les déclarations sont stockées dans les TAGS de la fiche (`cp:<id>`) :
 * elles suivent le prospect à l'export, à la synchronisation et au partage,
 * sans nouveau champ ni migration de schéma.
 */
export function CheckpointsPanel({ p }: { p: Prospect }) {
  const patchProspect = useAlpha((s) => s.patchProspect);

  const declared = useMemo(
    () => (p.tags ?? []).filter((t) => t.startsWith(TAG)).map((t) => t.slice(TAG.length)),
    [p.tags]
  );
  const r = useMemo(() => checkpointsFor(p, declared), [p, declared]);

  const toggle = (id: string) => {
    const tag = `${TAG}${id}`;
    const tags = (p.tags ?? []).includes(tag)
      ? (p.tags ?? []).filter((t) => t !== tag)
      : [...(p.tags ?? []), tag];
    patchProspect(p.id, { tags });
  };

  if (r.items.length === 0) return null;

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <ShieldCheck size={15} className="text-bronze-400" /> Checkpoints — étape « {r.stage} »
        </h2>
        <span className={cn("font-mono text-[12px]", r.canAdvance ? "text-signal-green" : "text-signal-amber")}>
          {r.progress}%
        </span>
      </div>

      <p
        className={cn(
          "rounded-xl border px-3 py-2 text-[12px]",
          r.canAdvance
            ? "border-signal-green/40 bg-signal-green/5 text-signal-green"
            : "border-signal-amber/40 bg-signal-amber/5 text-signal-amber"
        )}
      >
        {r.summary}
      </p>

      <ul className="space-y-2">
        {r.items.map((i) => {
          const done = i.state === "fait";
          return (
            <li key={i.def.id} className="flex items-start gap-2">
              <button
                onClick={() => !i.measured && toggle(i.def.id)}
                disabled={i.measured}
                className={cn("mt-0.5 shrink-0", i.measured ? "cursor-default" : "cursor-pointer")}
                title={i.measured ? "Vérifié automatiquement sur les données" : "Déclaration — c'est toi qui coches"}
              >
                {done ? (
                  <Check size={14} className="text-signal-green" />
                ) : i.def.blocking ? (
                  <CircleAlert size={14} className="text-signal-red" />
                ) : (
                  <Square size={14} className="text-paper-faint" />
                )}
              </button>
              <span className="text-[12px]">
                <span className={cn(done ? "text-paper-faint line-through" : "text-paper")}>{i.def.label}</span>
                {i.def.blocking && !done && (
                  <span className="ml-1.5 rounded-full bg-signal-red/10 px-1.5 py-0.5 text-[10px] text-signal-red">
                    bloquant
                  </span>
                )}
                {!i.measured && (
                  <span className="ml-1.5 text-[10px] text-paper-faint">déclaratif</span>
                )}
                {!done && <span className="block text-[11px] text-paper-faint">{i.def.why}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] text-paper-faint">
        Les points <strong className="text-paper-dim">déclaratifs</strong> ne sont pas vérifiables par
        Alpha : une case cochée vaut ce que vaut ta rigueur. Les autres sont lus sur les données de la
        fiche.
      </p>
    </section>
  );
}
