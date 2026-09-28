"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { apercuPour, secteursDisponibles } from "@/lib/premier-resultat";

/**
 * LA VALEUR EN 30 SECONDES — la première chose que voit un inscrit.
 *
 * Il choisit son marché ; Alpha montre à l'instant l'angle qui mord, le message
 * qu'il écrit, l'offre qui s'y rattache. Aucune config, aucun envoi. Le but est
 * qu'il VOIE ce qu'Alpha fait avant qu'on lui demande de brancher quoi que ce
 * soit — puis un seul bouton : « fais-le sur MES prospects ».
 *
 * ⚠ Tout vient de `lib/premier-resultat.ts`, qui n'assemble que des verticales
 * réelles : rien n'est inventé à l'écran.
 */

const CLE = "alpha_apercu_secteur";

const NOM_OFFRE: Record<string, string> = {
  "alpha-sales-os": "OS de vente",
  "alpha-voice": "Alpha Voice",
  "visibilite-growth": "Visibilité & Growth",
};

export function ApercuValeur({ onBrancher }: { onBrancher?: () => void }) {
  const secteurs = useMemo(() => secteursDisponibles(), []);
  const [id, setId] = useState<string>(() => {
    try {
      const v = localStorage.getItem(CLE);
      if (v && secteurs.some((s) => s.id === v)) return v;
    } catch {
      /* stockage indisponible : on retombe sur le défaut */
    }
    // Défaut = notre ICP en cours, pour que le premier écran soit pertinent.
    return secteurs.some((s) => s.id === "maitrise-ouvrage") ? "maitrise-ouvrage" : secteurs[0]?.id ?? "";
  });

  const apercu = apercuPour(id);

  const choisir = (v: string) => {
    setId(v);
    try {
      localStorage.setItem(CLE, v);
    } catch {
      /* pas de persistance : sans effet fonctionnel */
    }
  };

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-paper/70">
        <Sparkles className="h-4 w-4" />
        En 30 secondes — ce qu&apos;Alpha écrit pour ton marché
      </div>

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-paper/50">Ton marché</span>
        <select
          value={id}
          onChange={(e) => choisir(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-paper"
        >
          {secteurs.map((s) => (
            <option key={s.id} value={s.id} className="bg-neutral-900">
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {apercu && (
        <div className="space-y-3">
          <div className="panel space-y-1 p-3">
            <div className="text-xs uppercase tracking-wide text-paper/50">Qui on vise</div>
            <div className="text-sm text-paper/90">{apercu.criterion}</div>
          </div>
          <div className="panel space-y-1 p-3">
            <div className="text-xs uppercase tracking-wide text-paper/50">Pourquoi ça mord</div>
            <div className="text-sm text-paper/90">{apercu.angle}</div>
          </div>
          <div className="panel space-y-1 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-paper/50">Le message qu&apos;Alpha écrit</div>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-paper/70">
                {NOM_OFFRE[apercu.offre] ?? apercu.offre}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm text-paper/90">{apercu.message}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onBrancher}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-white/15"
      >
        Maintenant, fais-le sur MES prospects
        <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-center text-[11px] text-paper/40">
        Rien n&apos;est envoyé — c&apos;est un aperçu tiré de la méthode réelle.
      </p>
    </div>
  );
}
