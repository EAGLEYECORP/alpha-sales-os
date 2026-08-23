"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Check, Info, TrendingDown, TrendingUp } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { useAlpha } from "@/lib/store";
import { calcDeal, ecartVsReference } from "@/lib/deal-calc";
import { useReference } from "@/lib/client-catalogue";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE CALCULATEUR DE DEAL — pour structurer CETTE affaire, pas un barème.
 *
 * Chaque affaire se monte différemment. Le portefeuille dit ce qu'on prend
 * D'HABITUDE ; cet écran dit ce que celle-ci rapporte RÉELLEMENT, et ce que
 * coûte chaque point qu'on lâche.
 *
 * Trois partis pris :
 *
 *  · LE TAUX NE SE CALCULE PAS. Il se négocie. Les leviers sont affichés
 *    comme des munitions, jamais comme une formule : cocher « j'ai construit
 *    les démos » ne donne pas mathématiquement 25 %. Un calculateur qui
 *    prétendrait le contraire mentirait sur la seule chose qui compte.
 *  · L'ÉCART EST EN EUROS. « 20 % », c'est bien ou mal ? La seule lecture
 *    utile est la différence avec ce qu'on prend d'habitude, en argent.
 *  · RIEN N'EST ENREGISTRÉ TANT QU'ON N'A PAS VALIDÉ. On simule à voix haute
 *    pendant un rendez-vous ; on ne veut pas que chaque curseur déplacé
 *    réécrive la fiche.
 * ─────────────────────────────────────────────────────────────────────
 */
export function DealCalculator({ p }: { p: Prospect }) {
  const patchProspect = useAlpha((s) => s.patchProspect);
  const accountId = useAlpha((s) => s.settings.accountId) ?? "eagleye";

  // Le montant qui sert à choisir l'offre de référence : la valeur ANNUELLE
  // du deal, comme dans le routage (lib/ladder.ts). Un setup de 5 k avec
  // 3 k/mois n'est pas un petit chantier.
  const valeurAnnuelle = p.setupValue + p.monthlyValue * 12;
  const reference = useReference(accountId, valeurAnnuelle);

  const [pctSetup, setPctSetup] = useState(p.dealTerms?.commissionPct ?? 0);
  const [pctRec, setPctRec] = useState(p.dealTerms?.recurringPct ?? 0);
  const [horizon, setHorizon] = useState(12);
  const [structure, setStructure] = useState(p.dealTerms?.structure ?? "");
  const [enregistre, setEnregistre] = useState(false);

  // Tant que l'opérateur n'a rien négocié, on part de la référence : c'est le
  // point de départ honnête d'une discussion, pas zéro.
  useEffect(() => {
    if (!reference) return;
    if (p.dealTerms?.commissionPct == null) setPctSetup(reference.pct);
    if (p.dealTerms?.recurringPct == null) setPctRec(reference.offering.recurringPct ?? reference.pct);
  }, [reference, p.dealTerms?.commissionPct, p.dealTerms?.recurringPct]);

  const entree = useMemo(
    () => ({
      setupHT: p.setupValue,
      monthlyHT: p.monthlyValue,
      commissionPct: pctSetup,
      recurringPct: pctRec,
      horizonMois: horizon,
    }),
    [p.setupValue, p.monthlyValue, pctSetup, pctRec, horizon]
  );

  const r = useMemo(() => calcDeal(entree), [entree]);
  const ecart = useMemo(
    () =>
      reference
        ? ecartVsReference(entree, {
            commissionPct: reference.pct,
            recurringPct: reference.offering.recurringPct ?? reference.pct,
          })
        : null,
    [entree, reference]
  );

  const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
  const plancher = reference?.offering.pctEstPlancher ? reference.pct : null;
  const sousPlancher = plancher != null && pctSetup < plancher;

  const enregistrer = () => {
    patchProspect(p.id, {
      dealTerms: {
        commissionPct: pctSetup,
        recurringPct: pctRec,
        structure: structure.trim() || undefined,
        agreedAt: new Date().toISOString(),
      },
    });
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 2200);
  };

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Calculator size={15} className="text-bronze-400" /> Structure du deal
        </h2>
        <span className="text-[11px] text-paper-faint">
          {reference ? `Référence : ${reference.offering.label}` : "Référence en cours de chargement…"}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-paper-faint">
        Aucune affaire ne ressemble à la précédente. Le barème dit ce qu&apos;on vise ; ici on structure celle-ci.
      </p>

      {/* ── Les curseurs ── */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-[11px] text-paper-faint">
          Notre part sur l&apos;installation (%)
          <input
            type="number"
            min={0}
            max={100}
            className={cn("input mt-1", sousPlancher && "border-signal-red/60")}
            value={pctSetup}
            onChange={(e) => setPctSetup(Math.min(100, Math.max(0, +e.target.value)))}
          />
        </label>
        <label className="text-[11px] text-paper-faint">
          Notre part sur le mensuel (%)
          <input
            type="number"
            min={0}
            max={100}
            className="input mt-1"
            value={pctRec}
            onChange={(e) => setPctRec(Math.min(100, Math.max(0, +e.target.value)))}
          />
        </label>
        <label className="text-[11px] text-paper-faint">
          Horizon (mois)
          <input
            type="number"
            min={1}
            max={60}
            className="input mt-1"
            value={horizon}
            onChange={(e) => setHorizon(Math.max(1, Math.min(60, +e.target.value)))}
          />
          <span className="mt-0.5 block text-[10px] text-paper-faint">
            12 par défaut : la seule durée défendable sans supposer qu&apos;il reste.
          </span>
        </label>
      </div>

      {/* ── Ce que ça donne ── */}
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Chiffre label="Ce que le client paie" value={eur(r.brutTotal)} hint={`sur ${horizon} mois`} />
        <Chiffre label="Ce qui nous revient" value={eur(r.partTotale)} accent />
        <Chiffre label="Par mois (après setup)" value={eur(r.partMensuelle)} />
        <Chiffre label="Taux effectif du deal" value={`${r.tauxEffectifPct} %`} hint="setup + mensuel mélangés" />
      </div>

      <table className="mt-3 w-full text-[12px]">
        <tbody>
          {r.lignes
            .filter((l) => l.brut > 0)
            .map((l) => (
              <tr key={l.label} className="border-t border-ink-700">
                <td className="py-1.5 text-paper">{l.label}</td>
                <td className="py-1.5 text-right font-mono text-paper-faint">{eur(l.brut)}</td>
                <td className="w-14 py-1.5 text-right font-mono text-paper-faint">{l.pct} %</td>
                <td className="w-24 py-1.5 text-right font-mono text-bronze-400">{eur(l.part)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* ── Ce que coûte un point : le chiffre qui rend la négo concrète ── */}
      <p className="mt-3 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[11.5px] text-paper-dim">
        <strong className="text-paper">Un point de plus vaut</strong> {eur(r.valeurDUnPointSetup)} sur l&apos;installation
        et {eur(r.valeurDUnPointRecurrent)} sur le mensuel ({horizon} mois). C&apos;est ce que coûte chaque point lâché
        pour finir l&apos;entretien plus vite.
      </p>

      {/* ── L'écart à la référence, en euros ── */}
      {ecart && (
        <p
          className={cn(
            "mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]",
            ecart.deltaEur < 0
              ? "border-signal-red/40 bg-signal-red/10 text-paper"
              : ecart.deltaEur > 0
                ? "border-signal-green/40 bg-signal-green/10 text-paper"
                : "border-ink-600 bg-ink-850 text-paper-dim"
          )}
        >
          {ecart.deltaEur < 0 ? <TrendingDown size={14} className="mt-0.5 shrink-0" /> : <TrendingUp size={14} className="mt-0.5 shrink-0" />}
          <span>{ecart.verdict}</span>
        </p>
      )}

      {/* ── Le plancher et ses leviers : des munitions, pas une formule ── */}
      {reference?.alerte && (
        <p
          className={cn(
            "mt-2 rounded-lg border px-3 py-2 text-[12px]",
            sousPlancher ? "border-signal-red/40 bg-signal-red/10 text-paper" : "border-bronze-700/40 bg-bronze-900/20 text-paper-dim"
          )}
        >
          {sousPlancher ? `⚠ ${pctSetup} % : sous le plancher de ${plancher} %. C'est ton choix, mais il se compte.` : reference.alerte}
        </p>
      )}
      {reference?.offering.leviers?.length ? (
        <details className="mt-2 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2">
          <summary className="cursor-pointer text-[11.5px] text-paper-dim">
            <Info size={12} className="mr-1 inline text-bronze-400" />
            Ce qui fait monter le taux ({reference.offering.leviers.length})
          </summary>
          <ul className="mt-1.5 space-y-1 text-[11.5px] text-paper-dim">
            {reference.offering.leviers.map((l) => (
              <li key={l}>· {l}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-paper-faint">
            Ce sont des arguments, pas un calcul : aucun d&apos;eux ne « donne » un pourcentage. Ça se négocie.
          </p>
        </details>
      ) : null}

      {/* ── Ce qui justifie ce taux, en une ligne ── */}
      <label className="label mt-3">Comment ce deal est monté (le levier qui justifie le taux)</label>
      <input
        className="input"
        placeholder="ex. démos construites par nous avant transmission — on reste le point d'entrée technique"
        value={structure}
        onChange={(e) => setStructure(e.target.value)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="btn-bronze px-3 py-1.5 text-[12px]" onClick={enregistrer}>
          {enregistre ? <Check size={14} /> : null}
          {enregistre ? "Enregistré" : "Enregistrer les termes de ce deal"}
        </button>
        {p.dealTerms?.agreedAt && (
          <span className="text-[11px] text-paper-faint">
            Convenus le {new Date(p.dealTerms.agreedAt).toLocaleDateString("fr-FR")}
          </span>
        )}
        {!p.dealTerms && <span className="text-[11px] text-paper-faint">Rien d&apos;enregistré : la référence s&apos;applique.</span>}
      </div>
    </section>
  );
}

function Chiffre({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-paper-faint">{label}</p>
      <p className={cn("font-mono text-sm", accent ? "text-bronze-400" : "text-paper")}>{value}</p>
      {hint && <p className="text-[10px] text-paper-faint">{hint}</p>}
    </div>
  );
}
