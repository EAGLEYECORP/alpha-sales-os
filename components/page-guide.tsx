"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { CircleHelp, Lightbulb, X } from "lucide-react";
import { guideFor } from "@/lib/page-guides";
import { useAlpha, useHydrated } from "@/lib/store";

const SEEN_KEY = "alpha_guides_seen";

const readSeen = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
};

/**
 * Guide contextuel par page : carte-coach au premier passage (rôle de
 * l'écran + mode d'emploi + réflexe doctrine), bouton « ? » flottant
 * ensuite. Ne s'ouvre jamais par-dessus l'assistant d'installation ni
 * la visite guidée (il attend que les deux soient passés).
 */
export function PageGuide() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const onboarded = useAlpha((s) => s.settings.onboarded);
  const guide = guideFor(pathname);
  const [open, setOpen] = useState(false);

  // Auto-ouverture au premier passage — une fois l'installation et la
  // visite guidée terminées, pour ne pas empiler trois couches d'aide.
  useEffect(() => {
    setOpen(false);
    if (!hydrated || !onboarded || !guide) return;
    if (localStorage.getItem("alpha_tour_done") !== "1") return;
    if (readSeen()[guide.path]) return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [pathname, hydrated, onboarded, guide]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!guide) return null;

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [guide.path]: true }));
    } catch {
      /* stockage indisponible — le guide se ré-ouvrira, sans gravité */
    }
    setOpen(false);
  };

  return (
    <>
      {/* Bouton « ? » — toujours accessible pour revoir le guide */}
      <button
        onClick={() => setOpen(true)}
        aria-label={`Guide de la page : ${guide.title}`}
        title="Guide de cette page"
        className="fixed bottom-20 right-4 z-[45] grid h-10 w-10 place-items-center rounded-full border border-ink-600 bg-ink-900/90 text-paper-faint shadow-card backdrop-blur transition-colors hover:border-bronze-700 hover:text-bronze-300 md:bottom-6 md:right-6"
      >
        <CircleHelp size={18} />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/70 p-4 backdrop-blur-sm md:items-center"
            onClick={close}
          >
            <div
              className="card w-full max-w-md p-5 animate-fade-up"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={guide.title}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-bronze-400">
                    Guide de la page
                  </p>
                  <h2 className="mt-1 font-display text-lg font-extrabold text-paper">{guide.title}</h2>
                </div>
                <button onClick={close} aria-label="Fermer" className="text-paper-faint hover:text-paper">
                  <X size={18} />
                </button>
              </div>

              <p className="mt-3 text-[13.5px] leading-relaxed text-paper-dim">{guide.role}</p>

              <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.16em] text-paper-faint">
                Comment l&apos;utiliser
              </p>
              <ol className="mt-1.5 space-y-1.5">
                {guide.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-paper-dim">
                    <span className="mt-px shrink-0 font-display text-[12px] font-extrabold text-bronze-400">
                      {i + 1}.
                    </span>
                    {s}
                  </li>
                ))}
              </ol>

              <p className="mt-4 flex gap-2 rounded-xl border border-bronze-700/50 bg-bronze-900/20 px-3.5 py-2.5 text-[12.5px] italic leading-relaxed text-bronze-300">
                <Lightbulb size={14} className="mt-0.5 shrink-0" />
                {guide.tip}
              </p>

              <button className="btn-bronze mt-4 w-full" onClick={close}>
                C&apos;est clair
              </button>
              <p className="mt-2 text-center text-[10.5px] text-paper-faint">
                À revoir quand tu veux via le bouton « ? » en bas à droite.
              </p>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
