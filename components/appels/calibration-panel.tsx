"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Gauge, HelpCircle, Minus, X } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { calibrer, type AxeSucces, type Verdict } from "@/lib/calibration";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * CE QUE LA RÉALITÉ DIT DU TRI — l'arc de retour, à l'écran.
 *
 * Ce panneau n'est PAS un tableau de bord de performance. Il ne répond qu'à
 * une question : « les poids qui ordonnent la file d'appels sont-ils vrais ? »
 *
 * Deux choix d'affichage qui viennent de la doctrine :
 *
 *  · TANT QU'IL N'Y A RIEN, IL AFFICHE CE QUI MANQUE, pas des zéros. Un
 *    tableau plein de « 0 % » se lit comme un résultat, et un résultat inventé
 *    fait prendre de mauvaises décisions plus vite qu'une page vide.
 *  · AUCUN POIDS NE SE CORRIGE TOUT SEUL. Le panneau dit ce que la mesure
 *    montre et nomme le fichier à modifier. Un ajustement automatique sur
 *    quarante appels apprendrait le bruit et le graverait dans le tri.
 * ─────────────────────────────────────────────────────────────────────
 */

const VERDICT_META: Record<Verdict, { icon: typeof Check; tone: string; label: string }> = {
  confirme: { icon: Check, tone: "border-signal-green/50 text-signal-green", label: "confirmé" },
  infirme: { icon: X, tone: "border-signal-red/50 text-signal-red", label: "infirmé" },
  indecis: { icon: Minus, tone: "border-ink-600 text-paper-faint", label: "indécis" },
  insuffisant: { icon: HelpCircle, tone: "border-ink-600 text-paper-faint", label: "pas assez d'appels" },
};

export function CalibrationPanel() {
  const { prospects } = useAlpha();
  const [axe, setAxe] = useState<AxeSucces>("decroche");
  const cal = useMemo(() => calibrer(prospects, axe), [prospects, axe]);

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Gauge size={15} className="text-bronze-400" /> Ce que le terrain dit du tri
        </h2>
        <div className="flex gap-1">
          {(["decroche", "rdv"] as AxeSucces[]).map((a) => (
            <button
              key={a}
              onClick={() => setAxe(a)}
              className={cn(
                "chip transition-colors",
                a === axe ? "border-bronze-400/60 text-bronze-300" : "border-ink-600 text-paper-faint hover:text-paper"
              )}
            >
              {a === "decroche" ? "décroché" : "RDV"}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-faint">
        Les poids qui ordonnent la file d&apos;appels sont des <strong className="text-paper-dim">hypothèses</strong>{" "}
        posées à la main. Ici, on les confronte aux appels réellement passés — et on n&apos;en corrige aucun tout seul.
      </p>

      {cal.appeles > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "Appelés", v: cal.appeles },
            { k: "Composés", v: cal.composes },
            { k: "Joints", v: cal.joints },
            { k: "RDV", v: cal.rdv },
          ].map(({ k, v }) => (
            <div key={k} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">{k}</p>
              <p className="font-display text-lg text-paper">{v}</p>
            </div>
          ))}
        </div>
      )}

      {cal.lecture.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {cal.lecture.map((l) => (
            <li key={l} className="text-[12px] leading-relaxed text-paper-dim">
              {l}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-3.5 text-[11px] uppercase tracking-wide text-paper-faint">
        Les signaux du score, mis à l&apos;épreuve
      </h3>
      <ul className="mt-1.5 space-y-1.5">
        {cal.ecarts.map((e) => {
          const { icon: Icon, tone, label } = VERDICT_META[e.verdict];
          return (
            <li key={e.critere.id} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-paper">{e.critere.label}</span>
                <span className="flex items-center gap-1.5">
                  <span className="chip border-bronze-700/50 text-bronze-400">poids {e.critere.poidsActuel}</span>
                  <span className={cn("chip", tone)}>
                    <Icon size={10} className="mr-1 inline -translate-y-px" />
                    {label}
                  </span>
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-faint">{e.phrase}</p>
            </li>
          );
        })}
      </ul>

      {cal.manque.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {cal.manque.map((m) => (
            <li key={m} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-signal-amber">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {m}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
