"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { computeRoutines, CATEGORY_META, type Routine } from "@/lib/routines";
import { cn } from "@/lib/utils";

const TONE_CLS: Record<"red" | "bronze" | "green", string> = {
  red: "border-signal-red/40 text-signal-red",
  bronze: "border-bronze-700 text-bronze-400",
  green: "border-signal-green/40 text-signal-green",
};

interface InboundEvent {
  id: string;
  email: string;
  name?: string;
  message: string;
}

/**
 * Routines — le fil des actions humaines à faire MAINTENANT pour avancer.
 * Dérivé du pipeline + RDV + brouillons + suivi client, augmenté des réponses
 * entrantes à traiter.
 */
export function RoutinesPanel() {
  const prospects = useAlpha((s) => s.prospects);
  const meetings = useAlpha((s) => s.meetings);
  const campaigns = useAlpha((s) => s.campaigns);
  const drafts = useAlpha((s) => s.drafts);
  const [inbound, setInbound] = useState<InboundEvent[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/webhooks/inbound")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.events)) setInbound(d.events);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const routines = useMemo(() => {
    const base = computeRoutines({ prospects, meetings, campaigns, drafts });
    const replies: Routine[] = inbound.map((e) => ({
      id: `reply-${e.id}`,
      category: "reply" as const,
      priority: "haute" as const,
      title: `Répondre à ${e.name || e.email}`,
      detail: e.message ? `« ${e.message.slice(0, 90)} »` : "Réponse entrante à traiter.",
      href: "/campaigns",
    }));
    return [...replies, ...base];
  }, [prospects, meetings, campaigns, drafts, inbound]);

  const counts = useMemo(
    () => ({
      haute: routines.filter((r) => r.priority === "haute").length,
      moyenne: routines.filter((r) => r.priority === "moyenne").length,
      basse: routines.filter((r) => r.priority === "basse").length,
    }),
    [routines]
  );

  const shown = showAll ? routines : routines.slice(0, 8);

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <ListChecks size={16} className="text-bronze-400" /> Routines — à faire pour avancer
        </h2>
        <div className="flex items-center gap-1.5">
          {counts.haute > 0 && <span className="chip border-signal-red/40 text-signal-red">{counts.haute} urgent</span>}
          {counts.moyenne > 0 && <span className="chip border-bronze-700 text-bronze-400">{counts.moyenne} à faire</span>}
          {counts.basse > 0 && <span className="chip border-ink-600 text-paper-faint">{counts.basse} plus tard</span>}
        </div>
      </div>

      {routines.length === 0 ? (
        <p className="mt-3 rounded-lg border border-signal-green/30 bg-signal-green/5 px-3 py-2.5 text-[13px] text-signal-green">
          ✓ Rien en attente — tout est à jour. Alimente le pipeline.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-1.5">
            {shown.map((r) => {
              const meta = CATEGORY_META[r.category];
              return (
                <li key={r.id}>
                  <Link
                    href={r.href}
                    className="group flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 transition-colors hover:border-bronze-700"
                  >
                    <span className={cn("chip shrink-0", TONE_CLS[meta.tone])}>{meta.label}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-paper">{r.title}</p>
                      <p className="truncate text-[11px] text-paper-faint">{r.detail}</p>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-paper-faint transition-transform group-hover:translate-x-0.5 group-hover:text-bronze-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {routines.length > 8 && (
            <button className="btn-ghost mt-2 w-full text-[12px]" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Réduire" : `Voir les ${routines.length - 8} autres`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
