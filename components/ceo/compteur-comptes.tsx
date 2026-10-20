"use client";

import { Users } from "lucide-react";
import { affichageComptes, type ComptesCrees, type EtatMur } from "@/lib/comptes-crees";
import { cn } from "@/lib/utils";

/**
 * Le compteur de comptes — `docs/OBJECTIF-10M.md`, objectif 0.
 *
 * Tout ce qui se DÉCIDE (tiret au lieu de zéro, « ≥ » sur une fenêtre pleine,
 * l'état du mur) vit dans `lib/comptes-crees.ts`, où un test l'atteint. Ce
 * composant ne fait que poser des chaînes déjà décidées.
 */
const TON: Record<EtatMur, { classe: string; mot: string }> = {
  inconnu: { classe: "border-paper/20 text-paper/60", mot: "mur : non lu" },
  loin: { classe: "border-signal-green/40 text-signal-green", mot: "loin du mur supposé" },
  proche: { classe: "border-signal-amber/40 text-signal-amber", mot: "proche du mur supposé" },
  atteint: { classe: "border-signal-red/40 text-signal-red", mot: "mur supposé atteint" },
};

export function CompteurComptes({ comptes }: { comptes: ComptesCrees | null }) {
  const a = affichageComptes(comptes);
  const ton = TON[a.etat];
  return (
    <section className="card p-4" aria-label="Comptes créés">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-paper/60" />
        <h2 className="font-display text-sm font-semibold text-paper">Comptes créés</h2>
        <span className={cn("ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]", ton.classe)}>
          {ton.mot}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="panel p-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/50">Au total</dt>
          <dd className="mt-1 font-display text-3xl font-bold text-paper tabular-nums">{a.total}</dd>
        </div>
        <div className="panel p-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/50">Dernière heure</dt>
          <dd className="mt-1 font-display text-3xl font-bold text-paper tabular-nums">{a.heure}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-paper/60">{a.mur}</p>
      {a.reserve && <p className="mt-1 text-xs text-signal-amber">{a.reserve}</p>}
    </section>
  );
}
