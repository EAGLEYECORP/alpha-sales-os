"use client";

import { useMemo } from "react";
import { Check, ChevronRight, CircleDashed, Lock } from "lucide-react";
import { useAlpha } from "@/lib/store";
import {
  PALIERS_CAMPAGNE,
  evaluerProgression,
  type EtatPalierCampagne,
  type IdPalierCampagne,
} from "@/lib/paliers-campagne";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LES PALIERS, VUS PAR CELUI QUI APPELLE.
 *
 * Un seul palier est ouvert à la fois, et il n'y a jamais qu'UNE chose à
 * faire : `prochainGeste`. Le reste est repliable — un rep qui ouvre cet
 * écran entre deux appels n'a pas trois minutes pour lire un tableau de bord.
 *
 * ⚠ CE QUI SE COCHE ET CE QUI NE SE COCHE PAS. Les points de mesure n'ont pas
 * de case : ils se constatent depuis la base. Seuls les points DÉCLARATIFS —
 * ceux que la machine ne peut pas observer — sont cliquables, et ils sont
 * désactivés tant que leur condition préalable n'existe pas. Cocher « j'ai
 * entendu la phrase d'ouverture » avant qu'un seul appel n'ait été décroché
 * fabriquerait la preuve du seul point qui soit une obligation légale.
 * ─────────────────────────────────────────────────────────────────────
 */

const TON: Record<EtatPalierCampagne["etat"], string> = {
  valide: "border-signal-green/40",
  pret: "border-bronze-400/60",
  "en-cours": "border-ink-600",
  verrouille: "border-ink-700 opacity-55",
};

export function PaliersPanel() {
  const prospects = useAlpha((s) => s.prospects);
  const settings = useAlpha((s) => s.settings);
  const patchSettings = useAlpha((s) => s.patchSettings);

  const etat = settings.paliersCampagne ?? { valides: [], coches: [] };

  const progression = useMemo(
    () =>
      evaluerProgression(prospects, {
        valides: etat.valides,
        coches: etat.coches,
        // Le rep est un closer. `role: "team"` ne dit pas combien ils sont —
        // on reste donc sur 1, et le point de capacité du palier 1 000 le dira
        // en clair plutôt que de supposer une équipe qui n'existe pas.
        closers: 1,
      }),
    [prospects, etat.valides, etat.coches]
  );

  const basculerCoche = (id: string) => {
    const coches = etat.coches.includes(id) ? etat.coches.filter((x) => x !== id) : [...etat.coches, id];
    patchSettings({ paliersCampagne: { ...etat, coches } });
  };

  const validerPalier = (id: IdPalierCampagne) => {
    if (etat.valides.includes(id)) return;
    patchSettings({ paliersCampagne: { ...etat, valides: [...etat.valides, id] } });
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <ChevronRight size={15} className="text-bronze-400" /> Montée en charge — 10 · 100 · 1 000
        </h2>
        <span className="font-mono text-[11px] text-paper-faint">
          {progression.vecu.composes} appels composés
          {progression.plafond !== null && ` / ${progression.plafond} autorisés`}
        </span>
      </div>

      <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">
        Trois chiffres décident de tout et aucun n&apos;est encore mesuré : le décroché, la part de décrochés qui
        donnent un intérêt qualifié, et le tarif Telnyx à la minute. Lancer 1 000 appels avant de les connaître,
        c&apos;est brûler 1 000 fiches pour apprendre ce que 10 auraient dit.{" "}
        <strong className="text-paper-dim">Le plafond du palier borne réellement la file d&apos;appels.</strong>
      </p>

      {/* Ce qui est mesuré aujourd'hui — jamais un taux nu. */}
      <div className="mt-3 space-y-1 rounded-lg border border-ink-700 px-3 py-2">
        {[progression.tauxDecroche, progression.tauxInteret, progression.tauxOpposition].map((t, i) => (
          <p key={i} className={cn("text-[11.5px]", t.source === "mesure" && !t.fragile ? "text-paper-dim" : "text-paper-faint")}>
            {t.phrase}
          </p>
        ))}
      </div>

      <div className="mt-3 space-y-2.5">
        {progression.paliers.map((ep) => {
          const ouvert = ep.etat === "en-cours" || ep.etat === "pret";

          return (
            <div key={ep.palier.id} className={cn("rounded-lg border px-3 py-2.5", TON[ep.etat])}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-paper">
                  {ep.etat === "valide" ? (
                    <Check size={13} className="text-signal-green" />
                  ) : ep.etat === "verrouille" ? (
                    <Lock size={13} className="text-paper-faint" />
                  ) : (
                    <CircleDashed size={13} className="text-bronze-400" />
                  )}
                  {ep.palier.titre}
                </p>
                <span className="font-mono text-[10.5px] text-paper-faint">
                  {ep.palier.appels} appels
                </span>
              </div>

              {ouvert && (
                <>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-paper-faint">{ep.palier.objet}</p>

                  <ul className="mt-2 space-y-1.5">
                    {ep.points.map((pt) => {
                      const bloque = Boolean(pt.bloquePar);
                      return (
                        <li key={pt.id} className="flex items-start gap-2 text-[11.5px]">
                          {pt.genre === "declaratif" ? (
                            <button
                              onClick={() => !bloque && basculerCoche(pt.id)}
                              disabled={bloque}
                              aria-label={pt.question}
                              className={cn(
                                "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border",
                                pt.satisfait
                                  ? "border-signal-green/60 bg-signal-green/20 text-signal-green"
                                  : bloque
                                    ? "cursor-not-allowed border-ink-700 text-ink-600"
                                    : "cursor-pointer border-ink-600 hover:border-bronze-400"
                              )}
                            >
                              {pt.satisfait && <Check size={11} />}
                            </button>
                          ) : (
                            <span
                              className={cn(
                                "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                                pt.satisfait ? "border-signal-green/60 text-signal-green" : "border-ink-600 text-ink-600"
                              )}
                              title="Mesuré depuis la base — ne se coche pas"
                            >
                              {pt.satisfait ? <Check size={10} /> : null}
                            </span>
                          )}
                          <span className="flex-1">
                            <span className={pt.satisfait ? "text-paper-dim" : "text-paper"}>{pt.question}</span>
                            <span className="block text-[11px] text-paper-faint">
                              {bloque ? pt.bloquePar : pt.constat}
                            </span>
                            {/* Un point déclaratif dit POURQUOI la machine ne peut pas y répondre.
                                Sans ça, il ressemble à de la paperasse et se coche sans être fait. */}
                            {pt.genre === "declaratif" && !pt.satisfait && pt.pourquoi && (
                              <span className="block text-[11px] italic text-paper-faint">{pt.pourquoi}</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <p className="mt-2 rounded border border-ink-700 px-2.5 py-1.5 text-[11.5px] text-paper-dim">
                    {ep.prochainGeste}
                  </p>

                  {ep.etat === "pret" && (
                    <button className="btn-bronze mt-2 px-3 py-1.5 text-[12px]" onClick={() => validerPalier(ep.palier.id)}>
                      Valider ce palier et ouvrir le suivant
                    </button>
                  )}
                </>
              )}

              {ep.etat === "verrouille" && (
                <p className="mt-1 text-[11.5px] text-paper-faint">{ep.prochainGeste}</p>
              )}
            </div>
          );
        })}
      </div>

      {progression.plafond === null && (
        <p className="mt-2 text-[11.5px] text-signal-green">
          Les trois paliers sont validés. Le plafond quotidien habituel reprend seul — les paliers ne bornent plus rien.
        </p>
      )}

      {/* ⚠ Le plafond côté SERVEUR ne se lit pas d'ici : les réglages du
          navigateur n'atteignent pas le cron. Le dire évite de croire que
          valider un palier suffit à débrider l'autopilote. */}
      <p className="mt-2 text-[11px] leading-relaxed text-paper-faint">
        Valider un palier lève le plafond de <strong className="text-paper-dim">cet écran</strong>. L&apos;autopilote
        serveur, lui, suit sa propre variable <code className="font-mono">CAMPAIGN_PALIER</code> (
        {PALIERS_CAMPAGNE.map((p) => p.appels).join(" · ")} ou <code className="font-mono">aucun</code>) — non définie,
        il reste au plafond le plus bas. Deux gestes, délibérément : un cron ne se débride pas depuis un navigateur.
      </p>
    </section>
  );
}
