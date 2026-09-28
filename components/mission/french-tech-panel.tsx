"use client";

import { useMemo, useState } from "react";
import { Flag, Check } from "lucide-react";
import { SOUS_AGENTS, missionEtat, MISSION_CIBLE, type Porteur } from "@/lib/mission-french-tech";
import { cn } from "@/lib/utils";

const CLE = "alpha_mission_ft";

const PORTEUR_LABEL: Record<Porteur, string> = {
  alpha: "ALPHA prépare",
  zakaria: "Toi seul",
  duo: "À deux",
};

const TON: Record<string, string> = {
  confortable: "text-signal-green",
  tendu: "text-signal-amber",
  intenable: "text-signal-red",
  depasse: "text-signal-red",
};

/**
 * La mission French Tech — le dossier, découpé, avec le compte à rebours.
 *
 * L'écran est volontairement inconfortable quand c'est justifié : un verdict
 * « intenable » s'affiche en rouge et propose de réduire le périmètre, parce
 * qu'un dossier bâclé grille la candidature pour l'année suivante. Un tableau
 * de bord qui rassure sur un dossier en retard ne sert personne.
 *
 * Les lots faits sont mémorisés localement : ce n'est pas une donnée
 * d'entreprise, c'est une case à cocher personnelle.
 */
export function FrenchTechPanel() {
  const [faits, setFaits] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(CLE) ?? "[]") as string[];
    } catch {
      return [];
    }
  });

  const etat = useMemo(() => missionEtat(faits), [faits]);

  const bascule = (id: string) =>
    setFaits((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      try {
        localStorage.setItem(CLE, JSON.stringify(next));
      } catch {
        /* navigation privée — la coche reste éphémère, ce n'est pas grave */
      }
      return next;
    });

  const avancement = Math.round((faits.length / SOUS_AGENTS.length) * 100);

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Flag size={15} className="text-bronze-400" /> Mission French Tech 2030
        </h2>
        <span className={cn("font-mono text-[12px]", TON[etat.verdict])}>
          {etat.joursRestants >= 0 ? `J-${etat.joursRestants}` : `${Math.abs(etat.joursRestants)} j de retard`}
        </span>
      </div>

      {/* La barre dit l'avancement ET la contrainte de temps : l'un sans
          l'autre laisse croire qu'on a le temps parce qu'on a bien avancé. */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full bg-bronze-500 transition-[width] duration-700 ease-out"
          style={{ width: `${avancement}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[11px] text-paper-faint">
        <span>
          {faits.length} / {SOUS_AGENTS.length} lots · {etat.heuresRestantes} h restantes
        </span>
        <span>{etat.heuresDisponibles} h disponibles d&apos;ici la date limite</span>
      </div>

      <p className={cn("mt-3 rounded-lg border p-3 text-[12px]", etat.verdict === "intenable" || etat.verdict === "depasse" ? "border-signal-red/40 bg-signal-red/10 text-paper" : "border-ink-700 bg-ink-900 text-paper-dim")}>
        {etat.message}
      </p>

      <ul className="mt-3 space-y-1">
        {SOUS_AGENTS.map((a) => {
          const fait = faits.includes(a.id);
          const dispo = etat.prochains.some((p) => p.id === a.id);
          const goulot = etat.goulot?.id === a.id;
          return (
            <li key={a.id}>
              <button
                onClick={() => bascule(a.id)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                  fait
                    ? "border-ink-700 bg-ink-850 opacity-60"
                    : goulot
                      ? "border-bronze-700 bg-bronze-900/20"
                      : dispo
                        ? "border-ink-600 hover:border-bronze-700"
                        : "border-ink-700 opacity-50"
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
                    <span className={cn("text-[12.5px] text-paper", fait && "line-through")}>{a.role}</span>
                    <span className="chip border-ink-600 text-[10px] text-paper-faint">{PORTEUR_LABEL[a.porteur]}</span>
                    <span className="font-mono text-[10px] text-paper-faint">{a.heures} h</span>
                    {goulot && !fait && <span className="chip border-bronze-700 text-[10px] text-bronze-400">commence par là</span>}
                    {/* Un lot dont les dépendances ne sont pas satisfaites ne
                        peut pas être commencé : le dire évite de s'y user. */}
                    {!dispo && !fait && <span className="text-[10px] text-paper-faint">en attente</span>}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-paper-faint">{a.livrable}</span>
                  {!fait && <span className="mt-1 block text-[11px] text-signal-amber">⚠ {a.piege}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] text-paper-faint">{MISSION_CIBLE.apport}</p>
    </section>
  );
}
