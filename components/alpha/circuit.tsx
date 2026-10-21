"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Ban, Check, ChevronDown, Hand } from "lucide-react";
import type { Stage } from "@/lib/types";
import type { Circuit, LigneCircuit } from "@/lib/circuit-alpha";
import { cn } from "@/lib/utils";
import { Compteur, useRevele } from "./mouvement";

/**
 * Le circuit : les huit étapes d'une vente, ce qu'ALPHA y fait, ce qu'il y
 * refuse de faire, et combien de fiches y sont. Les cartes arrivent l'une
 * après l'autre, le filet qui les relie se trace, les nombres montent — des
 * faits qui entrent à l'écran, jamais un travail mimé (voir `mouvement.tsx`).
 *
 * Tout ce qui se décide vit dans `lib/circuit-alpha.ts`.
 */

const TON: Record<Stage, string> = {
  prospect: "text-bronze-400",
  contact: "text-bronze-400",
  audit: "text-bronze-400",
  demo: "text-bronze-400",
  offre: "text-bronze-400",
  redzone: "text-signal-amber",
  signe: "text-signal-green",
  perdu: "text-paper-faint",
};

function Etape({
  ligne,
  numero,
  derniere,
  ouvert,
  surBascule,
}: {
  ligne: LigneCircuit;
  numero: number;
  derniere: boolean;
  ouvert: boolean;
  surBascule: () => void;
}) {
  const [ref, vu] = useRevele<HTMLLIElement>();
  const idCorps = `etape-${ligne.stage}`;

  return (
    <li
      ref={ref}
      className={cn(
        "relative pb-3 pl-9 transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(.16,1,.3,1)]",
        vu ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-ink-700 font-display text-[11px]",
          TON[ligne.stage]
        )}
      >
        {numero}
      </span>
      {!derniere && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute bottom-0 left-3 top-9 w-px origin-top bg-ink-700 transition-transform duration-700 ease-out",
            vu ? "scale-y-100 delay-300" : "scale-y-0"
          )}
        />
      )}

      <div className="panel p-3">
        <button
          type="button"
          className="flex w-full items-start gap-2 text-left"
          aria-expanded={ouvert}
          aria-controls={idCorps}
          onClick={surBascule}
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-display text-[14px] font-semibold text-paper">{ligne.label}</span>
              <span className="text-[12px] text-paper-dim">
                <Compteur valeur={ligne.fiches} className="font-display text-paper" /> {ligne.fiches > 1 ? "fiches" : "fiche"}
              </span>
              {ligne.attendent > 0 && (
                <span className="chip border-signal-amber/40 text-[10.5px] text-signal-amber">
                  <Hand size={11} aria-hidden="true" />
                  <Compteur valeur={ligne.attendent} className="font-display" /> à toi
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-paper-dim">{ligne.hint}</span>
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn("mt-1 shrink-0 text-paper-faint transition-transform duration-300", ouvert && "rotate-180")}
          />
        </button>

        {ouvert && (
          <div id={idCorps} className="mt-3 space-y-3 border-t border-ink-700 pt-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper-faint">Ce qu&apos;ALPHA fait ici</p>
            <ul className="space-y-2.5">
              {ligne.fait.map((r, i) => (
                <li
                  key={`${r.fichier}-${r.symbole}-${i}`}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
                >
                  <p className="flex gap-2 text-[12.5px] leading-snug text-paper">
                    <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-signal-green" />
                    {r.quoi}
                  </p>
                  <p
                    className="ml-6 mt-0.5 break-all font-mono text-[10.5px] text-paper-faint"
                    title="Le fichier du dépôt qui applique cette règle, et le nom qui la porte"
                  >
                    {r.fichier} · {r.symbole}
                  </p>
                </li>
              ))}
            </ul>
            <p
              className="animate-fade-up flex gap-2 text-[12px] leading-snug text-paper-dim"
              style={{ animationDelay: `${ligne.fait.length * 80}ms`, animationFillMode: "backwards" }}
            >
              <Ban size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-paper-faint" />
              {ligne.nePasFaire}
            </p>
            <Link href={ligne.lien.href} className="btn-ghost px-3 py-1.5 text-[12px]">
              {ligne.lien.libelle} <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </li>
  );
}

export function CircuitAlpha({ circuit }: { circuit: Circuit }) {
  /**
   * Quelle carte est ouverte ? Une seule par défaut — la première où quelque
   * chose t'attend, sinon la première qui porte des fiches — et ELLE SE DÉDUIT
   * à chaque rendu : au premier rendu le CRM du navigateur n'est pas encore
   * rechargé, et une carte « ouverte au montage » serait restée fermée pour
   * toujours. Les clics de l'utilisateur INVERSENT ce défaut.
   */
  const defaut = (circuit.lignes.find((l) => l.attendent > 0) ?? circuit.lignes.find((l) => l.fiches > 0))?.stage;
  const [inverses, setInverses] = useState<ReadonlySet<Stage>>(new Set());
  const estOuvert = (s: Stage) => (s === defaut) !== inverses.has(s);
  const toutesOuvertes = circuit.lignes.every((l) => estOuvert(l.stage));

  const basculer = (s: Stage) =>
    setInverses((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(s)) suivant.delete(s);
      else suivant.add(s);
      return suivant;
    });

  const toutBasculer = () =>
    setInverses(() => {
      // Tout ouvrir : on inverse exactement les cartes que le défaut laisse fermées.
      // Tout fermer : on inverse exactement celle qu'il ouvre.
      const suivant = new Set<Stage>();
      for (const l of circuit.lignes) {
        const veutOuvert = !toutesOuvertes;
        if ((l.stage === defaut) !== veutOuvert) suivant.add(l.stage);
      }
      return suivant;
    });

  return (
    <section className="card p-4" aria-label="Le circuit d'une vente">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-paper">Le circuit, étape par étape</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
            Où en sont tes fiches, ce qu&apos;ALPHA fait à chaque étape — et ce qu&apos;il refuse de faire. Chaque règle
            nomme le fichier qui l&apos;applique.
          </p>
        </div>
        <button type="button" className="btn-ghost px-3 py-1.5 text-[12px]" onClick={toutBasculer}>
          {toutesOuvertes ? "Tout replier" : "Tout déplier"}
        </button>
      </div>

      <ol className="mt-4">
        {circuit.lignes.map((l, i) => (
          <Etape
            key={l.stage}
            ligne={l}
            numero={i + 1}
            derniere={i === circuit.lignes.length - 1}
            ouvert={estOuvert(l.stage)}
            surBascule={() => basculer(l.stage)}
          />
        ))}
      </ol>

      {circuit.attendentHorsFiche > 0 && (
        <p className="mt-1 text-[12px] leading-snug text-paper-dim">
          Et <b className="text-paper">{circuit.attendentHorsFiche}</b>{" "}
          {circuit.attendentHorsFiche > 1 ? "choses qui attendent" : "chose qui attend"} sans être rattachée
          {circuit.attendentHorsFiche > 1 ? "s" : ""} à une fiche (relire une campagne, confirmer un rendez-vous) —{" "}
          <Link href="/decisions" className="text-bronze-400 hover:underline">
            voir À décider
          </Link>
          .
        </p>
      )}
    </section>
  );
}
