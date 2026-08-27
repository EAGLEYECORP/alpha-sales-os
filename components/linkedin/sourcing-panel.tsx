"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Check, ClipboardPaste, Info, UserPlus, X } from "lucide-react";
import { ENTETE_MODELE, importerProfils } from "@/lib/linkedin-import";
import { planifierCampagne } from "@/lib/linkedin-plan";
import { projeterImport, readStorageHealth } from "@/lib/storage-health";
import { useAlpha } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * SOURCER — faire entrer les profils, et voir ce que le lot vaut.
 *
 * Le chaînon qui manquait entre « j'ai relevé 200 profils » et « la file
 * LinkedIn tourne ». Trois choix d'interface qui viennent de la doctrine :
 *
 *  · LES ÉCARTÉS SONT MONTRÉS, avec leur raison. Un tri dont on ne voit pas
 *    les refus ne se corrige jamais — et c'est là qu'on découvre que la
 *    colonne « titre » était mal nommée dans l'export.
 *  · LE CALENDRIER S'AFFICHE AVANT LE BOUTON. Tant que « 200 » est un nombre,
 *    ça paraît faisable en une matinée. Vu comme des dates, ça se décide
 *    autrement.
 *  · RIEN N'ENTRE SANS UN CLIC. L'app prépare, l'humain valide — même sur un
 *    import, parce que 200 fiches fausses coûtent plus cher à sortir qu'à ne
 *    pas faire entrer.
 * ─────────────────────────────────────────────────────────────────────
 */
export function SourcingPanel() {
  const { importProspects, logActivity } = useAlpha();
  const [texte, setTexte] = useState("");
  const [fait, setFait] = useState<string | null>(null);

  const resultat = useMemo(() => (texte.trim() ? importerProfils(texte) : null), [texte]);
  const plan = useMemo(
    () => (resultat?.retenus.length ? planifierCampagne(resultat.retenus.length) : null),
    [resultat]
  );

  /**
   * ── LE MUR DE STOCKAGE SE VOIT AVANT DE COLLER, PAS APRÈS ──
   *
   * ⚠ Cette projection existait, était testée, et n'était branchée que sur UNE
   * des deux surfaces de collage en masse : le sourcing terrain. Ici, un lot de
   * profils LinkedIn — c'est-à-dire des centaines de fiches en un clic —
   * entrait sans le moindre avertissement.
   *
   * Ce que ça coûte : une écriture localStorage qui échoue ne ressemble pas à
   * une panne. L'écran affiche les fiches normalement, et elles disparaissent
   * en fermant l'onglet. `StorageAlert` finit par le dire, mais APRÈS — or la
   * règle est de le montrer avant, quand ça se répare encore.
   *
   * Le poids par fiche est MESURÉ sur le lot réel, pas supposé : c'est la même
   * mécanique que le panneau terrain, et une fiche LinkedIn ne pèse pas comme
   * une fiche d'annuaire.
   */
  const stockage = useMemo(
    () =>
      resultat?.retenus.length
        ? projeterImport(
            readStorageHealth(),
            resultat.retenus,
            Math.round(
              JSON.stringify(resultat.retenus.map((r) => r.prospect)).length /
                Math.max(1, resultat.retenus.length)
            )
          )
        : null,
    [resultat]
  );

  const ajouter = () => {
    if (!resultat?.retenus.length) return;
    const { added, updated } = importProspects(resultat.retenus.map((r) => r.prospect));
    setFait(`${added} fiche(s) créée(s), ${updated} mise(s) à jour.`);
    logActivity({
      kind: "campagne",
      message: `Sourcing LinkedIn — ${added} entrée(s), ${updated} fusion(s), ${resultat.ecartes.length} écarté(s)`,
    });
    setTexte("");
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <ClipboardPaste size={15} className="text-bronze-400" /> Sourcer des profils
        </h2>
        <span className="text-[11px] text-paper-faint">CSV, TSV, JSON ou JSONL</span>
      </div>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-paper-faint">
        Colle ce que tu as relevé dehors. Alpha ne va rien chercher : il ne détient aucun identifiant LinkedIn et
        n&apos;ouvre aucun navigateur — c&apos;est ce qui garantit que ton profil ne se fait pas restreindre.
      </p>

      <textarea
        className="input mt-2.5 h-32 font-mono text-[11.5px]"
        placeholder={`${ENTETE_MODELE}\nClaire Berthier;Gérante;Régie Berthier;Lyon 6e;linkedin.com/in/claire;immobilier;11-50`}
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

      {resultat && (
        <>
          {/* Le verdict sur le lot, à lire AVANT de cliquer. */}
          <ul className="mt-3 space-y-1">
            {resultat.resume.map((l) => (
              <li key={l} className="flex items-start gap-1.5 text-[12px] text-paper-dim">
                <Info size={12} className="mt-0.5 shrink-0 text-bronze-400" />
                {l}
              </li>
            ))}
            {resultat.parse.avertissements.map((a) => (
              <li key={a} className="flex items-start gap-1.5 text-[12px] text-signal-amber">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {a}
              </li>
            ))}
          </ul>

          {/* Le calendrier : « 200 » n'est pas une matinée. */}
          {plan && (
            <div className="mt-3 rounded-xl border border-bronze-700/50 bg-bronze-900/20 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-bronze-300">
                <CalendarClock size={13} /> {resultat.retenus.length} invitation(s) ={" "}
                {plan.joursOuvres} jour(s) ouvré(s) sur {plan.semaines} semaine(s)
                {plan.finLe && ` — dernière le ${new Date(`${plan.finLe}T12:00:00Z`).toLocaleDateString("fr-FR")}`}
              </p>
              {plan.alertes.map((a) => (
                <p key={a} className="mt-1 text-[11.5px] leading-relaxed text-bronze-300/85">
                  {a}
                </p>
              ))}
            </div>
          )}

          {resultat.parse.rejets.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] text-signal-red">
                {resultat.parse.rejets.length} ligne(s) illisible(s)
              </summary>
              <ul className="mt-1 space-y-0.5">
                {resultat.parse.rejets.slice(0, 12).map((r) => (
                  <li key={`${r.ligne}-${r.extrait}`} className="font-mono text-[11px] text-paper-faint">
                    L{r.ligne} — {r.raison} : {r.extrait}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {resultat.retenus.length > 0 && (
            <>
              <h3 className="mt-3 text-[11px] uppercase tracking-wide text-paper-faint">
                Retenus ({resultat.retenus.length})
              </h3>
              <ul className="mt-1.5 space-y-1.5">
                {resultat.retenus.slice(0, 20).map(({ prospect, ciblage }) => (
                  <li key={prospect.id} className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-paper">
                        {prospect.company}
                        {prospect.name && <span className="text-paper-faint"> · {prospect.name}</span>}
                      </span>
                      <span
                        className={cn(
                          "chip",
                          ciblage.score >= 80 ? "border-signal-green/50 text-signal-green" : "border-bronze-700/50 text-bronze-400"
                        )}
                      >
                        {ciblage.score}/100
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-paper-faint">{ciblage.pourquoi.join(" · ")}</p>
                    {ciblage.risques.map((r) => (
                      <p key={r} className="mt-0.5 text-[11px] text-signal-amber">{r}</p>
                    ))}
                  </li>
                ))}
              </ul>
              {resultat.retenus.length > 20 && (
                <p className="mt-1 text-[11px] text-paper-faint">
                  … et {resultat.retenus.length - 20} autre(s).
                </p>
              )}

              {/* Avant le bouton, jamais après : c'est tout l'intérêt. */}
              {stockage && (
                <p
                  className={cn(
                    "mt-2 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed",
                    stockage.alerte
                      ? "border-signal-red/50 bg-signal-red/5 text-signal-red"
                      : "border-ink-700 text-paper-faint"
                  )}
                >
                  {stockage.phrase}
                </p>
              )}

              <button className="btn-bronze mt-3 px-3.5 py-1.5 text-[12px]" onClick={ajouter}>
                <UserPlus size={13} /> Ajouter {resultat.retenus.length} fiche(s) au pipe
              </button>
            </>
          )}

          {/* Les écartés, avec leur raison : c'est ce qui rend le tri corrigible. */}
          {resultat.ecartes.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-paper-faint">
                Écartés ({resultat.ecartes.length}) — et pourquoi
              </summary>
              <ul className="mt-1.5 space-y-1">
                {resultat.ecartes.slice(0, 30).map(({ profil, ciblage }, i) => (
                  <li key={`${profil.url ?? profil.nom ?? i}`} className="flex items-start gap-1.5 text-[11.5px]">
                    <X size={12} className="mt-0.5 shrink-0 text-signal-red" />
                    <span className="text-paper-dim">
                      {profil.entreprise || profil.nom || "sans nom"}
                      <span className="text-paper-faint">
                        {" — "}
                        {[...ciblage.risques, ...ciblage.manque][0] ?? `score ${ciblage.score}/100 insuffisant`}
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
