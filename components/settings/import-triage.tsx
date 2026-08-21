"use client";

import Link from "next/link";
import { AlertTriangle, Flame, PhoneOff, Snowflake, Thermometer } from "lucide-react";
import type { ImportTriage } from "@/lib/import-triage";
import { cn } from "@/lib/utils";

/**
 * Le verdict d'un import — ce que vaut RÉELLEMENT le fichier chargé.
 * Un gros fichier vide n'est pas une réussite : on le dit ici, tout de suite,
 * avant que le pipe se remplisse de fiches inexploitables.
 */
export function ImportTriagePanel({ t }: { t: ImportTriage }) {
  if (t.total === 0) return null;
  const usable = t.byFit.chaud + t.byFit.tiede;

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-bronze-700/40 bg-bronze-900/10 p-3">
      <p className={cn("text-[12px]", usable === 0 ? "text-signal-red" : "text-paper")}>{t.verdict}</p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fit icon={<Flame size={12} />} label="Chaudes" n={t.byFit.chaud} tone="text-signal-green" />
        <Fit icon={<Thermometer size={12} />} label="Tièdes" n={t.byFit.tiede} tone="text-signal-amber" />
        <Fit icon={<Snowflake size={12} />} label="Froides" n={t.byFit.froid} tone="text-paper-faint" />
        <Fit icon={<PhoneOff size={12} />} label="Injoignables" n={t.unusable} tone="text-signal-red" />
      </div>

      {/* Où part le lot : l'escalier de routage, en chiffres. */}
      {t.accounts.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-paper-faint">Répartition par compte</p>
          <ul className="mt-1 space-y-0.5">
            {t.accounts.map((a) => (
              <li key={a.accountId} className="text-[11.5px] text-paper-dim">
                <strong className="text-paper">{a.accountName}</strong> — {a.count} fiche(s)
                {a.estimatedHT > 0 && (
                  <span className="text-paper-faint"> · {a.estimatedHT.toLocaleString("fr-FR")} € estimés</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ce qui manque le plus souvent : souvent UNE colonne à réclamer. */}
      {t.topGaps.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-paper-faint">
            <AlertTriangle size={11} /> Ce qui manque le plus souvent
          </p>
          <ul className="mt-1 space-y-0.5">
            {t.topGaps.map((g) => (
              <li key={g.gap} className="text-[11.5px] text-paper-dim">
                <span className="font-mono text-signal-amber">{g.pct}%</span> — {g.gap}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] italic text-paper-faint">
            Un trou à plus de 50 % vient presque toujours d&apos;une colonne absente du fichier source :
            va la chercher là-bas plutôt qu&apos;à la main, fiche par fiche.
          </p>
        </div>
      )}

      {/* Par qui commencer — la file d'appel du jour. */}
      {t.callFirst.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-paper-faint">Commence par</p>
          <ul className="mt-1 space-y-0.5">
            {t.callFirst.slice(0, 8).map((d) => (
              <li key={d.prospectId} className="text-[11.5px]">
                <Link href={`/prospects/${d.prospectId}`} className="text-bronze-400 hover:underline">
                  {d.prospectId}
                </Link>
                <span className="text-paper-faint">
                  {" "}
                  — {d.score}/100 · {d.offerLabel.split(" — ")[0]} → {d.accountName}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Fit({ icon, label, n, tone }: { icon: React.ReactNode; label: string; n: number; tone: string }) {
  return (
    <div className="rounded-lg border border-line/40 bg-surface/30 px-2 py-1.5">
      <p className="flex items-center gap-1 text-[10.5px] text-paper-faint">
        {icon} {label}
      </p>
      <p className={cn("font-display text-base font-bold", tone)}>{n}</p>
    </div>
  );
}
