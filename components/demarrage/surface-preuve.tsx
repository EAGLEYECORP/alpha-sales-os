"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Search, Square, SquareCheck } from "lucide-react";
import {
  ICP_PAR_CANAL, PUBLICATIONS_MIN_30J, evaluerSurface, recouvrement,
  type EtatSurface, type Priorite,
} from "@/lib/icp-canal";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LA SURFACE DE PREUVE — ce qu'on trouve en cherchant notre nom.
 *
 * ── LE MOMENT QUE PERSONNE NE PILOTE ──
 *
 * Le gérant appelé mardi ne lit pas LinkedIn. Mais s'il est intéressé, il tape
 * « EAGLEYE CORP » dans Google mercredi matin AVANT de rappeler. Ce qu'il
 * trouve à cet instant décide s'il rappelle — et s'il ne trouve rien, personne
 * chez nous ne saura jamais pourquoi il n'a pas donné suite.
 *
 * C'est le moment le plus décisif du cycle et le seul qu'aucun tableau de bord
 * ne mesure.
 *
 * ── POURQUOI CES CASES SONT MANUELLES, ET POURQUOI C'EST ASSUMÉ ──
 *
 * L'app ne peut pas savoir si un site est en ligne, ni compter des
 * publications LinkedIn : elle n'a accès ni à l'un ni à l'autre. La doctrine
 * du parcours de démarrage le dit déjà — « une case qu'on coche soi-même vaut
 * ce que vaut ta rigueur ». On garde donc des cases honnêtes plutôt qu'un
 * indicateur inventé.
 *
 * Ce qui n'est PAS manuel, en revanche, c'est le verdict : un site absent est
 * classé BLOQUANT, pas « à améliorer ». C'est la seule chose qui empêche de
 * repousser indéfiniment.
 * ─────────────────────────────────────────────────────────────────────
 */

const CLE = "alpha_surface_preuve";

const TON: Record<Priorite, string> = {
  bloquant: "border-signal-red/50 text-signal-red",
  important: "border-signal-amber/50 text-signal-amber",
  confort: "border-ink-600 text-paper-faint",
};

export function SurfacePreuve() {
  const [etat, setEtat] = useState<EtatSurface>({});
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE);
      if (brut) setEtat(JSON.parse(brut) as EtatSurface);
    } catch {
      /* stockage indisponible : on repart d'un état vide, ce qui est correct */
    }
    setCharge(true);
  }, []);

  const basculer = (id: string) => {
    const suivant: EtatSurface = { ...etat };
    // « activite » n'est pas un booléen : c'est un compteur de publications.
    // Le cocher revient à déclarer qu'on tient le rythme minimum.
    if (id === "activite") {
      suivant.publications30j = (etat.publications30j ?? 0) >= PUBLICATIONS_MIN_30J ? 0 : PUBLICATIONS_MIN_30J;
    } else if (id === "cas") {
      suivant.etudesDeCas = (etat.etudesDeCas ?? 0) > 0 ? 0 : 1;
    } else {
      const cle = { site: "siteEnLigne", legal: "legalPublie", visage: "visageVisible", linkedin: "pageLinkedin", google: "ficheGoogle" }[id];
      if (cle) (suivant as Record<string, unknown>)[cle] = !(etat as Record<string, unknown>)[cle];
    }
    setEtat(suivant);
    try {
      window.localStorage.setItem(CLE, JSON.stringify(suivant));
    } catch {
      /* rien à faire : la case restera cochée pour cette session seulement */
    }
  };

  const { elements, manquants, verdict } = evaluerSurface(etat);
  const bloquants = manquants.filter((m) => m.priorite === "bloquant").length;
  const r = recouvrement();

  if (!charge) return null;

  return (
    <section className="card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <Search size={15} className="text-bronze-400" /> Quand ils cherchent ton nom
      </h2>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-faint">
        Le gérant que tu appelles mardi tape ton nom mercredi matin avant de rappeler. Ce qu&apos;il trouve à cet
        instant décide s&apos;il rappelle — et s&apos;il ne trouve rien, tu ne sauras jamais pourquoi il n&apos;a pas
        donné suite. Ces cases se cochent à la main : l&apos;app ne peut pas les vérifier, et un indicateur inventé
        vaudrait moins que ta rigueur.
      </p>

      <p
        className={cn(
          "mt-2 flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[12px] leading-relaxed",
          bloquants ? "border-signal-red/50 bg-signal-red/5 text-signal-red" : "border-ink-700 text-paper-dim"
        )}
      >
        {bloquants ? <AlertTriangle size={13} className="mt-0.5 shrink-0" /> : <Check size={13} className="mt-0.5 shrink-0 text-signal-green" />}
        {verdict}
      </p>

      <ul className="mt-2.5 space-y-1.5">
        {elements.map((e) => (
          <li key={e.id}>
            <button
              className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-ink-850"
              onClick={() => basculer(e.id)}
            >
              {e.present ? (
                <SquareCheck size={15} className="mt-0.5 shrink-0 text-signal-green" />
              ) : (
                <Square size={15} className="mt-0.5 shrink-0 text-paper-faint" />
              )}
              <span className="min-w-0">
                <span className={cn("text-[12.5px]", e.present ? "text-paper-dim line-through opacity-60" : "text-paper")}>
                  {e.quoi}
                </span>
                {!e.present && <span className={cn("chip ml-1.5", TON[e.priorite])}>{e.priorite}</span>}
                {!e.present && <span className="mt-0.5 block text-[11px] leading-relaxed text-paper-faint">{e.pourquoi}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Les deux ICP, rappelés ici parce que c'est le seul écran où l'on
          réfléchit à « pour qui j'écris » plutôt qu'à « qui j'appelle ». */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11.5px] text-bronze-400">
          Pour qui écrire — et pourquoi ce n&apos;est pas qui tu appelles
        </summary>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-signal-amber">{r.verdict}</p>
        <ul className="mt-2 space-y-2">
          {ICP_PAR_CANAL.map((c) => (
            <li key={c.id} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
              <p className="text-[12.5px] font-medium text-paper">{c.label}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-dim">{c.qui}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-signal-amber">Pas eux : {c.hors}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">Angle : {c.angle}</p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
