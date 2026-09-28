"use client";

import { useMemo, useState } from "react";
import { Rocket, Check } from "lucide-react";
import { parcours, type Cote } from "@/lib/client-onboarding";
import { useAlpha } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Prospect } from "@/lib/types";

const COTE_LABEL: Record<Cote, string> = { nous: "Nous", client: "Lui" };

/**
 * La mise en route d'un client qui vient de signer.
 *
 * N'apparaît qu'à l'étape « signé » : avant, c'est du bruit ; après une
 * résiliation, c'est cruel. La signature n'est pas la fin de la vente,
 * c'est le début du moment où on peut la perdre — un client qui n'a rien
 * vu tourner en dix jours doute, et un client qui doute ne recommande pas.
 *
 * Les étapes cochées vivent dans les TAGS de la fiche, pas dans le
 * navigateur : c'est un engagement pris envers quelqu'un, il doit suivre la
 * fiche et survivre à un changement de poste.
 */
export function OnboardingPanel({ p }: { p: Prospect }) {
  const patchProspect = useAlpha((s) => s.patchProspect);
  const [essai, setEssai] = useState(false);

  // Les briques achetées se déduisent de ce qui a été vendu ; à défaut, on
  // affiche tout le parcours plutôt que d'en cacher arbitrairement.
  const briques = useMemo(() => (p.tags ?? []).filter((t) => t.startsWith("brique:")).map((t) => t.slice(7)), [p.tags]);

  const faits = useMemo(() => (p.tags ?? []).filter((t) => t.startsWith("onb:")).map((t) => t.slice(4)), [p.tags]);

  // La date de signature : le dernier changement d'étape enregistré, à défaut
  // la dernière modification de la fiche. Le parcours entier se date dessus,
  // donc mieux vaut une approximation explicite qu'une date d'aujourd'hui qui
  // effacerait tout retard.
  const signeLe = useMemo(() => {
    const ev = [...(p.events ?? [])].reverse().find((e) => e.kind === "stage");
    return ev?.date ?? p.updatedAt ?? new Date().toISOString();
  }, [p.events, p.updatedAt]);

  const plan = useMemo(() => parcours(signeLe, briques, faits, { essai }), [signeLe, briques, faits, essai]);

  const bascule = (id: string) => {
    const tag = `onb:${id}`;
    const tags = p.tags ?? [];
    patchProspect(p.id, { tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag] });
  };

  if (p.stage !== "signe") return null;

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Rocket size={15} className="text-bronze-400" /> Mise en route
        </h2>
        <label className="flex items-center gap-1.5 text-[11px] text-paper-faint">
          <input type="checkbox" checked={essai} onChange={(e) => setEssai(e.target.checked)} />
          Période d&apos;essai
        </label>
      </div>

      <p
        className={cn(
          "mt-2 rounded-lg border p-3 text-[12px]",
          plan.bloque?.retard ? "border-signal-red/40 bg-signal-red/10 text-paper" : "border-ink-700 bg-ink-900 text-paper-dim"
        )}
      >
        {plan.message}
      </p>

      <ul className="mt-3 space-y-1">
        {plan.etapes.map((e) => {
          const fait = faits.includes(e.id);
          return (
            <li key={e.id}>
              <button
                onClick={() => bascule(e.id)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                  fait ? "border-ink-700 bg-ink-850 opacity-60" : e.retard > 0 ? "border-signal-red/40" : "border-ink-600 hover:border-bronze-700"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border",
                    fait ? "border-signal-green bg-signal-green/20" : "border-ink-600"
                  )}
                >
                  {fait && <Check size={11} className="text-signal-green" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className={cn("text-[12.5px] text-paper", fait && "line-through")}>
                      J+{e.jour} — {e.titre}
                    </span>
                    <span className="chip border-ink-600 text-[10px] text-paper-faint">{COTE_LABEL[e.cote]}</span>
                    {e.bloquant && !fait && <span className="chip border-bronze-700 text-[10px] text-bronze-400">bloquant</span>}
                    {e.retard > 0 && <span className="text-[10px] text-signal-red">{e.retard} j de retard</span>}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-paper-faint">{e.quoi}</span>
                  {!fait && (
                    <>
                      {/* La preuve distingue « coché » de « fait ». */}
                      <span className="mt-1 block text-[11px] text-paper-dim">Preuve : {e.preuve}</span>
                      {e.piege && <span className="mt-0.5 block text-[11px] text-signal-amber">⚠ {e.piege}</span>}
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
