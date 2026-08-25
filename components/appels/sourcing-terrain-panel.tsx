"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardPaste, Info, MapPin, PhoneOff, Star, X } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { ENTETE_TERRAIN, SOURCES_TERRAIN, planifierAppels } from "@/lib/sourcing-terrain";
import { importerFiches } from "@/lib/sourcing-terrain-import";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * SOURCER DU TERRAIN — remplir la file d'appels, et savoir par quoi commencer.
 *
 * Trois choix qui viennent de la doctrine, pas du goût :
 *
 *  · CE QUI REMONTE EN TÊTE, C'EST LA PLAINTE PUBLIQUE. Un client qui a écrit
 *    « impossible de les joindre » a rédigé l'ouverture à notre place. C'est
 *    le seul signal qui vaille d'être lu avant de composer.
 *  · LES ÉCARTÉS SONT MONTRÉS AVEC LEUR RAISON — c'est là qu'on découvre que
 *    la colonne « téléphone » s'appelait « phone » dans l'export.
 *  · LE PLAN D'APPELS S'AFFICHE AVANT LE BOUTON, avec son alerte juridique.
 *    1 000 numéros, ce n'est pas une liste : c'est plusieurs semaines et un
 *    plafond de sollicitations à respecter.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Le nombre de tentatives par prospect. 4 est le plafond légal côté B2C. */
const TENTATIVES = 4;

export function SourcingTerrainPanel() {
  const { importProspects, logActivity } = useAlpha();
  const [texte, setTexte] = useState("");
  const [fait, setFait] = useState<string | null>(null);

  const res = useMemo(() => (texte.trim() ? importerFiches(texte) : null), [texte]);
  const plan = useMemo(
    () => (res?.retenus.length ? planifierAppels(res.retenus.length, TENTATIVES) : null),
    [res]
  );

  const ajouter = () => {
    if (!res?.retenus.length) return;
    const { added, updated } = importProspects(res.retenus.map((r) => r.prospect));
    setFait(`${added} fiche(s) créée(s), ${updated} fusionnée(s) sur le numéro.`);
    logActivity({
      kind: "campagne",
      message: `Sourcing terrain — ${added} entrée(s), ${updated} fusion(s), ${res.ecartes.length} écartée(s)`,
    });
    setTexte("");
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <MapPin size={15} className="text-bronze-400" /> Sourcer du terrain
        </h2>
        <span className="text-[11px] text-paper-faint">annuaire, carte, tableur</span>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-faint">
        On ne cherche pas un métier, on cherche un <strong className="text-paper-dim">volume de demandes qui se perd</strong>.
        Le signal le plus fort est gratuit et public : un avis Google où un client écrit qu&apos;il n&apos;a pas réussi à
        les joindre. Relève-en un par fiche, ça change tout le tri.
      </p>

      <textarea
        className="input mt-2.5 h-32 font-mono text-[11.5px]"
        placeholder={`${ENTETE_TERRAIN}\nCarrosserie des Lilas;carrosserie;Lyon 3e;04 78 12 34 56;;142;4,6;fermé samedi dimanche;"impossible de les joindre"`}
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          setFait(null);
        }}
      />

      {fait && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-signal-green/40 bg-signal-green/10 px-3 py-2 text-[12px] text-signal-green">
          <Check size={13} /> {fait}
        </p>
      )}

      {!res && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11.5px] text-bronze-400">Où trouver les numéros</summary>
          <ul className="mt-1.5 space-y-1.5">
            {SOURCES_TERRAIN.map((s) => (
              <li key={s.nom} className="text-[11.5px]">
                <span className={cn("font-medium", s.avisDisponibles ? "text-signal-green" : "text-paper-dim")}>
                  {s.nom}
                </span>
                {s.avisDisponibles && <span className="chip ml-1.5 border-signal-green/50 text-signal-green">avis</span>}
                <span className="text-paper-faint"> — {s.rendement}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {res && (
        <>
          <ul className="mt-3 space-y-1">
            {res.resume.map((l) => (
              <li key={l} className="flex items-start gap-1.5 text-[12px] text-paper-dim">
                <Info size={12} className="mt-0.5 shrink-0 text-bronze-400" />
                {l}
              </li>
            ))}
            {res.parse.avertissements.map((a) => (
              <li key={a} className="flex items-start gap-1.5 text-[12px] text-signal-amber">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {a}
              </li>
            ))}
          </ul>

          {plan && (
            <div className="mt-3 rounded-xl border border-bronze-700/50 bg-bronze-900/20 px-3 py-2.5">
              <p className="text-[12px] font-medium text-bronze-300">
                {plan.cibles} numéro(s) × jusqu&apos;à {TENTATIVES} tentatives = {plan.tentatives} appels composés
              </p>
              <p className="mt-0.5 text-[11.5px] text-bronze-300/85">
                {plan.tours.map((t) => `T${t.tour} : ${t.composes}`).join(" · ")} — hypothèse de décroché à 20 %,{" "}
                <strong>jamais mesurée ici</strong>. Le premier taux réel viendra de cette campagne.
              </p>
              {plan.alertes.map((a) => (
                <p key={a} className="mt-1.5 text-[11.5px] leading-relaxed text-signal-amber">
                  ⚠ {a}
                </p>
              ))}
            </div>
          )}

          {res.retenus.length > 0 && (
            <>
              <h3 className="mt-3 text-[11px] uppercase tracking-wide text-paper-faint">
                Appelables ({res.retenus.length}) — dans l&apos;ordre
              </h3>
              <ul className="mt-1.5 space-y-1.5">
                {res.retenus.slice(0, 25).map(({ prospect, ciblage }) => {
                  const plainte = ciblage.signaux.find((s) => s.id === "plainte-injoignable");
                  return (
                    <li
                      key={prospect.id}
                      className={cn(
                        "rounded-lg border px-3 py-2",
                        plainte ? "border-signal-green/40 bg-signal-green/5" : "border-ink-700 bg-ink-850"
                      )}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[12.5px] font-medium text-paper">
                          {prospect.company}
                          <span className="ml-1.5 font-mono text-[11px] text-paper-faint">{prospect.phone}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          {plainte && (
                            <span className="chip border-signal-green/50 text-signal-green">
                              <PhoneOff size={10} /> injoignable
                            </span>
                          )}
                          <span className="chip border-bronze-700/50 text-bronze-400">{ciblage.score}/100</span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-paper-faint">
                        {ciblage.signaux.map((s) => s.label).join(" · ")}
                      </p>
                      {plainte && (
                        <p className="mt-1 flex items-start gap-1.5 text-[11.5px] text-signal-green">
                          <Star size={11} className="mt-0.5 shrink-0" />
                          {plainte.fait}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              {res.retenus.length > 25 && (
                <p className="mt-1 text-[11px] text-paper-faint">… et {res.retenus.length - 25} autre(s).</p>
              )}

              <button className="btn-bronze mt-3 px-3.5 py-1.5 text-[12px]" onClick={ajouter}>
                <ClipboardPaste size={13} /> Ajouter {res.retenus.length} fiche(s) au pipe
              </button>
            </>
          )}

          {res.ecartes.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-paper-faint">
                Écartées ({res.ecartes.length}) — et pourquoi
              </summary>
              <ul className="mt-1.5 space-y-1">
                {res.ecartes.slice(0, 40).map(({ fiche, ciblage }, i) => (
                  <li key={`${fiche.entreprise ?? i}-${i}`} className="flex items-start gap-1.5 text-[11.5px]">
                    <X size={12} className="mt-0.5 shrink-0 text-signal-red" />
                    <span className="text-paper-dim">
                      {fiche.entreprise || "sans nom"}
                      <span className="text-paper-faint">
                        {" — "}
                        {ciblage.exclusions[0] ?? ciblage.manque[0] ?? `score ${ciblage.score}/100 insuffisant`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
