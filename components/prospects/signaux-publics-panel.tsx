"use client";
import { useState } from "react";
import { ExternalLink, Landmark, Loader2, OctagonX, Sparkles } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { normaliserSiren, sirenDeLaFiche } from "@/lib/siren";
import { lireAnnonces, momentFrais, type ResultatLecture } from "@/lib/signaux-publics";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES ANNONCES LÉGALES D'UNE FICHE — saisir le SIREN, lire, voir.
 *
 * ⚠ LA LECTURE PART DU NAVIGATEUR, vers l'API de l'État — pas par nous. Le
 * SIREN d'un prospect ne touche pas notre serveur (`lib/signaux-publics.ts`).
 * L'écran le dit, parce que c'est vrai et que ça se vérifie.
 *
 * ⚠ UNE PANNE NE S'AFFICHE JAMAIS COMME « RIEN À SIGNALER ». Une lecture
 * ratée garde la précédente et dit pourquoi ; zéro annonce se dit avec sa
 * date de lecture.
 *
 * ⚠ LE MOMENT NE SE CITE PAS. Il dit pourquoi appeler maintenant ; il
 * n'entre dans aucune phrase pour le prospect (même interdit que citer son
 * permis à froid).
 * ─────────────────────────────────────────────────────────────────────
 */
const jjmmaaaa = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function SignauxPublicsPanel({ p, patch }: { p: Prospect; patch: (id: string, patch: Partial<Prospect>) => void }) {
  const connu = sirenDeLaFiche(p) ?? "";
  const [saisie, setSaisie] = useState(connu);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<Exclude<ResultatLecture, { etat: "lu" }> | null>(null);
  const l = p.signauxPublics;
  const moment = momentFrais(p);

  async function lire() {
    setEnCours(true);
    setEchec(null);
    const r = await lireAnnonces(saisie, (url, init) => fetch(url, init));
    setEnCours(false);
    if (r.etat !== "lu") {
      setEchec(r);
      return;
    }
    patch(p.id, { siren: r.siren, signauxPublics: r.lecture });
    setSaisie(r.siren);
  }

  return (
    <section className="card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-paper">
        <Landmark size={15} className="text-bronze-400" /> Annonces légales
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-paper-dim">
        Liquidation, radiation, nouveau dirigeant, déménagement, rachat : lus au BODACC par le SIREN, jamais devinés
        par le nom. La lecture va de ton navigateur à l&apos;API de l&apos;État — ta liste ne passe pas par nos serveurs.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="input w-44 font-mono text-[13px]"
          inputMode="numeric"
          placeholder="SIREN ou SIRET"
          aria-label="SIREN ou SIRET de l'entreprise"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
        />
        <button className="btn-ghost px-3 py-1.5 text-[12px]" disabled={enCours || !normaliserSiren(saisie)} onClick={lire}>
          {enCours ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin motion-reduce:animate-none" /> Interrogation du BODACC…
            </span>
          ) : l ? (
            "Relire"
          ) : (
            "Lire les annonces"
          )}
        </button>
      </div>

      {echec && (
        <p className="panel mt-3 p-3 text-[12px] leading-snug text-signal-amber">
          {echec.etat === "invalide" ? "Numéro refusé" : "Pas lu"} : {echec.raison}.
          {echec.etat === "non-lu" && " Ce n'est PAS « rien à signaler » — réessaie plus tard."}
          {l && ` La lecture du ${jjmmaaaa(l.luLe)} reste affichée.`}
        </p>
      )}

      {l && (
        <div className="mt-3 space-y-2">
          {l.exclusion ? (
            <div className="rounded-lg border border-signal-red/50 bg-signal-red/5 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-signal-red">
                <OctagonX size={14} /> À ne pas démarcher
              </p>
              <p className="mt-0.5 text-[12.5px] text-paper">{l.exclusion.libelle}</p>
              <p className="mt-1 text-[11.5px] text-paper-faint">
                Elle sort de la file d&apos;appels et du robot. Vérifie l&apos;annonce : c&apos;est elle qui fait foi.
              </p>
              {l.exclusion.source && <LienAnnonce href={l.exclusion.source} />}
            </div>
          ) : l.signaux.length > 0 ? (
            <ul className="space-y-1.5">
              {l.signaux.map((s) => (
                <li key={s.type} className={cn("panel px-3 py-2 text-[12.5px]", moment?.type === s.type && "border-bronze-600/70")}>
                  <span className="flex flex-wrap items-center gap-x-2">
                    {moment?.type === s.type && <Sparkles size={13} className="text-bronze-400" />}
                    <strong className="text-paper">{s.libelle}</strong>
                    <span className="font-mono text-[11px] text-paper-faint">{jjmmaaaa(s.date)}</span>
                    {s.source && <LienAnnonce href={s.source} />}
                  </span>
                  {moment?.type === s.type && (
                    <span className="mt-0.5 block text-[11.5px] text-bronze-300">
                      Moment frais : c&apos;est pour ça qu&apos;on l&apos;appelle maintenant. Ne le cite pas à froid.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-paper-dim">
              {l.annonces === 0
                ? "Aucune annonce publiée pour ce SIREN (hors dépôts de comptes)."
                : `${l.annonces} annonce${l.annonces > 1 ? "s" : ""} lue${l.annonces > 1 ? "s" : ""}, aucune récente qui change quelque chose.`}
            </p>
          )}
          <p className="font-mono text-[10.5px] text-paper-faint">
            SIREN {l.siren} · lu le {jjmmaaaa(l.luLe)}
          </p>
        </div>
      )}
    </section>
  );
}

function LienAnnonce({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-bronze-400 underline-offset-2 hover:underline"
    >
      voir l&apos;annonce <ExternalLink size={11} />
    </a>
  );
}
