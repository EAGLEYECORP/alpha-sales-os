"use client";
import { useState } from "react";
import { ExternalLink, Landmark, Loader2 } from "lucide-react";
import type { Prospect } from "@/lib/types";
import type { FicheEcartee } from "@/lib/call-session";
import { sirenDeLaFiche } from "@/lib/siren";
import { lectureAFaire, lireLot } from "@/lib/signaux-publics";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES ANNONCES LÉGALES DE LA FILE — lire d'un geste, compter ce qui sort.
 *
 * Sur une file de cent fiches, ouvrir chacune pour lire ses annonces n'a pas
 * lieu. Ce bloc lit d'un clic celles qui ont un SIREN (jamais lues, ou lues
 * il y a plus de trente jours) et DIT ce qui en sort.
 *
 * ⚠ CE QUI EST ÉCARTÉ SE COMPTE ET SE NOMME — jamais tu. Une liquidation qui
 * fait disparaître une fiche de la file sans un mot ressemble à un bug, et un
 * bug se contourne.
 * ⚠ CE QUI N'A PAS PU ÊTRE LU SE COMPTE À PART. « Non lu » n'est pas « sain ».
 * ⚠ La lecture part du NAVIGATEUR vers l'API de l'État (`lib/signaux-publics.ts`).
 * ─────────────────────────────────────────────────────────────────────
 */

/** Par clic. Au-delà, le bouton reste et lit les suivantes. Décision : une matinée d'appels. */
const PAR_CLIC = 100;

export function AnnoncesDeLaFile({
  fiches,
  ecartees,
  patch,
}: {
  fiches: Prospect[];
  ecartees: FicheEcartee[];
  patch: (id: string, patch: Partial<Prospect>) => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [bilan, setBilan] = useState<{ lues: number; nonLues: string[]; invalides: number } | null>(null);

  const aLire = fiches.filter((p) => sirenDeLaFiche(p) && lectureAFaire(p));
  const sansSiren = fiches.filter((p) => !sirenDeLaFiche(p)).length;

  async function lire() {
    setEnCours(true);
    const lot = aLire.slice(0, PAR_CLIC);
    const r = await lireLot(lot.map((p) => sirenDeLaFiche(p) as string), (url, init) => fetch(url, init));
    const nonLues: string[] = [];
    let lues = 0;
    let invalides = 0;
    r.forEach((x, i) => {
      if (x.etat === "lu") {
        lues++;
        patch(lot[i].id, { siren: x.siren, signauxPublics: x.lecture });
      } else if (x.etat === "invalide") invalides++;
      else nonLues.push(x.raison);
    });
    setBilan({ lues, nonLues, invalides });
    setEnCours(false);
  }

  if (aLire.length === 0 && ecartees.length === 0 && !bilan && sansSiren === 0) return null;

  return (
    <section className="card px-4 py-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-paper-dim">
        <Landmark size={14} className="text-bronze-400" />
        <span className="font-medium text-paper">Annonces légales</span>
        {aLire.length > 0 && (
          <span>
            · {aLire.length} fiche{aLire.length > 1 ? "s" : ""} avec SIREN à lire
          </span>
        )}
        {sansSiren > 0 && (
          <span className="text-paper-faint">
            · {sansSiren} sans SIREN (à saisir sur la fiche, ou colonne « SIREN » à l&apos;import)
          </span>
        )}
      </p>

      {aLire.length > 0 && (
        <button className="btn-ghost mt-2 px-3 py-1.5 text-[12px]" disabled={enCours} onClick={lire}>
          {enCours ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin motion-reduce:animate-none" /> Interrogation du BODACC…
            </span>
          ) : (
            `Lire ${Math.min(aLire.length, PAR_CLIC)} fiche${aLire.length > 1 ? "s" : ""} au BODACC`
          )}
        </button>
      )}

      {bilan && (
        <p className="mt-2 text-[12px] text-paper-dim">
          {bilan.lues} lue{bilan.lues > 1 ? "s" : ""}
          {bilan.invalides > 0 && ` · ${bilan.invalides} SIREN refusé${bilan.invalides > 1 ? "s" : ""} (clé de contrôle fausse)`}
          {bilan.nonLues.length > 0 && (
            <span className="text-signal-amber">
              {" "}
              · {bilan.nonLues.length} non lue{bilan.nonLues.length > 1 ? "s" : ""} ({bilan.nonLues[0]}) — ce n&apos;est
              pas « rien à signaler »
            </span>
          )}
        </p>
      )}

      {ecartees.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[12px] text-signal-red">
            {ecartees.length} fiche{ecartees.length > 1 ? "s" : ""} sortie{ecartees.length > 1 ? "s" : ""} de la file par
            une annonce légale
          </summary>
          <ul className="mt-1.5 space-y-1 text-[12px] text-paper-dim">
            {ecartees.map(({ prospect, exclusion }) => (
              <li key={prospect.id}>
                <strong className="text-paper">{prospect.company}</strong> — {exclusion.libelle}
                {exclusion.source && (
                  <a
                    href={exclusion.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 inline-flex items-center gap-0.5 text-bronze-400 hover:underline"
                  >
                    annonce <ExternalLink size={10} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
