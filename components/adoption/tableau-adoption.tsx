"use client";

import { useMemo } from "react";
import { AlertTriangle, LogIn, MailCheck, TrendingUp, Users } from "lucide-react";
import {
  PALIERS_ADOPTION,
  affichageAdoption,
  positionPalier,
  serie30Jours,
  type Adoption,
} from "@/lib/adoption";
import type { EtatMur } from "@/lib/comptes-crees";
import { cn } from "@/lib/utils";

/**
 * Le tableau d'adoption — `lib/adoption.ts` décide, ce composant pose.
 *
 * Tout ce qui se DÉCIDE (tiret au lieu de zéro, « ≥ » sur un plancher, « X
 * sur Y » plutôt qu'un pourcentage, les réserves) vit dans la lib, où un test
 * l'atteint. Un composant client ne s'atteint par rien : c'est dans le rendu
 * que `null` devient « 0 ».
 */
const TON_MUR: Record<EtatMur, { classe: string; mot: string }> = {
  inconnu: { classe: "border-paper/20 text-paper/60", mot: "mur : non lu" },
  loin: { classe: "border-signal-green/40 text-signal-green", mot: "loin du mur supposé" },
  proche: { classe: "border-signal-amber/40 text-signal-amber", mot: "proche du mur supposé" },
  atteint: { classe: "border-signal-red/40 text-signal-red", mot: "mur supposé atteint" },
};

function Chiffre({ label, valeur, note }: { label: string; valeur: string; note?: string }) {
  return (
    <div className="panel p-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/50">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-bold tabular-nums text-paper">{valeur}</dd>
      {note && <p className="mt-1 text-[11px] text-paper/50">{note}</p>}
    </div>
  );
}

export function TableauAdoption({ adoption, maintenant }: { adoption: Adoption | null; maintenant: Date }) {
  const a = affichageAdoption(adoption);
  const serie = useMemo(() => serie30Jours(adoption?.parJour ?? null, maintenant), [adoption, maintenant]);
  const max = Math.max(1, ...(serie ?? []).map((j) => j.n));
  const pos = positionPalier(adoption?.total ?? null);
  const progression = pos?.prochain ? Math.min(100, Math.round(((adoption?.total ?? 0) / pos.prochain) * 100)) : pos ? 100 : 0;
  const mur = TON_MUR[a.etatMur];

  return (
    <div className="space-y-5">
      {a.reserves.length > 0 && (
        <section className="card border-signal-amber/30 p-4" aria-label="Réserves">
          <div className="flex items-center gap-2 text-signal-amber">
            <AlertTriangle size={14} />
            <h2 className="font-display text-sm font-semibold">À lire avant les chiffres</h2>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-paper/70">
            {a.reserves.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-4" aria-label="Comptes">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-paper/60" />
          <h2 className="font-display text-sm font-semibold text-paper">Comptes</h2>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-paper/50">
            {!adoption || adoption.source === "aucune" ? "" : adoption.excluLesNotres ? "hors les nôtres" : "nos comptes inclus"}
          </span>
        </div>
        <p className="mt-2 font-display text-5xl font-bold tabular-nums text-paper">{a.total}</p>
        <p className="mt-1 text-xs text-paper/60">{a.palier}</p>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progression}
          aria-label="Progression vers le palier suivant"
        >
          <div className="h-full rounded-full bg-signal-green" style={{ width: `${progression}%` }} />
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-paper/40">
          {PALIERS_ADOPTION.map((p) => new Intl.NumberFormat("fr-FR").format(p)).join(" · ")}
        </p>
      </section>

      <section className="card p-4" aria-label="Inscriptions">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-paper/60" />
          <h2 className="font-display text-sm font-semibold text-paper">Inscriptions</h2>
          <span className={cn("ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]", mur.classe)}>
            {mur.mot}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Chiffre label="Dernière heure" valeur={a.inscrits.h1} />
          <Chiffre label="24 heures" valeur={a.inscrits.j1} />
          <Chiffre label="7 jours" valeur={a.inscrits.j7} />
          <Chiffre label="30 jours" valeur={a.inscrits.j30} />
        </dl>
        <p className="mt-3 text-xs text-paper/60">{a.mur}</p>

        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/50">30 derniers jours</p>
          {serie ? (
            <div
              className="mt-2 flex h-20 items-end gap-[3px]"
              role="img"
              aria-label={`Inscriptions par jour sur trente jours, maximum ${max} par jour`}
            >
              {serie.map((j) => (
                <div
                  key={j.jour}
                  title={`${j.jour} : ${j.n}`}
                  className={cn("flex-1 rounded-sm", j.n > 0 ? "bg-signal-green/80" : "bg-paper/10")}
                  style={{ height: `${j.n === 0 ? 4 : Math.max(8, Math.round((j.n / max) * 100))}%` }}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-paper/50">— Pas de courbe : la lecture agrégée n&apos;est pas disponible.</p>
          )}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="card p-4" aria-label="Confirmations">
          <div className="flex items-center gap-2">
            <MailCheck size={14} className="text-paper/60" />
            <h2 className="font-display text-sm font-semibold text-paper">Emails de confirmation</h2>
          </div>
          <p className="mt-3 font-display text-lg font-semibold text-paper">{a.confirmation}</p>
          <p className="mt-1 text-xs text-paper/60">
            Un compte sans confirmation n&apos;a pas cliqué son lien — ou ne l&apos;a jamais reçu. C&apos;est le chiffre qui rend le mur visible.
          </p>
        </section>

        <section className="card p-4" aria-label="Connexions">
          <div className="flex items-center gap-2">
            <LogIn size={14} className="text-paper/60" />
            <h2 className="font-display text-sm font-semibold text-paper">Connectés</h2>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <Chiffre label="24 h" valeur={a.connexions.j1} />
            <Chiffre label="7 j" valeur={a.connexions.j7} />
            <Chiffre label="30 j" valeur={a.connexions.j30} />
          </dl>
        </section>
      </div>
    </div>
  );
}
