"use client";

import { ShieldCheck } from "lucide-react";
import type { GardeArmee } from "@/lib/circuit-alpha";
import { Revele } from "./mouvement";

/**
 * Ce qu'ALPHA surveille EN CE MOMENT, avec la valeur du moment. Pas une liste de
 * principes : chaque ligne porte l'état lu sur tes fiches et la règle qui le
 * tient (fichier + nom, vérifiés par un test).
 */
export function GardesAlpha({ gardes }: { gardes: GardeArmee[] }) {
  return (
    <section className="card p-4" aria-label="Ce qu'ALPHA surveille">
      <h2 className="font-display text-base font-semibold text-paper">Ce qu&apos;ALPHA surveille</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
        Les garde-fous armés, avec leur état à cet instant.
      </p>
      <ul className="mt-3 space-y-2">
        {gardes.map((g, i) => (
          <li key={g.id}>
            <Revele delai={i * 70} className="panel flex items-start gap-2.5 p-3">
              <ShieldCheck size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-signal-green" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-paper">{g.titre}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-paper-dim">{g.etat}</p>
                <p
                  className="mt-1 break-all font-mono text-[10.5px] text-paper-faint"
                  title="Le fichier du dépôt qui applique cette règle, et le nom qui la porte"
                >
                  {g.regle.fichier} · {g.regle.symbole}
                </p>
              </div>
            </Revele>
          </li>
        ))}
      </ul>
    </section>
  );
}
