"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { FLUX_VENTE } from "@/lib/flux-vente";

/**
 * LE FIL DE VENTE — le mode guidé de bout en bout, en un coup d'œil.
 *
 * Les 7 étapes qu'Alpha enchaîne : cible → sourcing → audit → liste du jour →
 * campagne → devis → suivi. Chaque étape mène à SON écran réel. Ce n'est pas
 * une nouvelle capacité, c'est le fil qui relie celles qui existent.
 *
 * Repliable : déplié on voit le fil complet, replié il tient en une ligne pour
 * ne pas voler l'écran à la salle de contrôle en dessous.
 */

const CLE = "alpha_fil_ouvert";

export function FilVente() {
  const [ouvert, setOuvert] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLE) !== "0";
    } catch {
      return true;
    }
  });

  const basculer = () => {
    setOuvert((v) => {
      const n = !v;
      try {
        localStorage.setItem(CLE, n ? "1" : "0");
      } catch {
        /* sans persistance : sans effet */
      }
      return n;
    });
  };

  return (
    <div className="card p-4">
      <button
        type="button"
        onClick={basculer}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={ouvert}
      >
        <span className="text-sm font-medium text-paper">
          Le fil de vente — de la cible à l&apos;encaissement
        </span>
        <ChevronDown className={`h-4 w-4 text-paper/50 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <ol className="mt-4 space-y-2">
          {FLUX_VENTE.map((e) => (
            <li key={e.id} className="panel p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-paper">
                  {e.ordre}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-paper">{e.titre}</span>
                    <Link
                      href={e.route}
                      className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-xs text-paper transition hover:bg-white/15"
                    >
                      {e.routeLabel}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-paper/70">{e.produit}</p>
                  {e.note && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-paper/45">
                      <Check className="mt-0.5 h-3 w-3 shrink-0" />
                      {e.note}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
