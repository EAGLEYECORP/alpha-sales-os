"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Check, Coins, Info } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { buildPayoutLedger } from "@/lib/payouts";
import { ArgentDeDemo } from "@/components/donnees-de-demo";
import { eur } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Payouts — ta part, prélevée sur chaque vente, cumulée depuis la première.
 *
 * La source, c'est le CRM : une vente = un paiement encaissé sur une fiche.
 * Ta part = commissionPct (Réglages) du brut. On coche ce qui t'a été versé ;
 * le reste est « en attente ». Aucun revenu inventé — ce qui n'est pas
 * encaissé n'apparaît pas.
 */
export default function PayoutsPage() {
  const { prospects, settings, settledPayouts, togglePayoutSettled } = useAlpha();

  const { rows, summary } = useMemo(
    () => buildPayoutLedger(prospects, settings.commissionPct, new Set(settledPayouts)),
    [prospects, settings.commissionPct, settledPayouts]
  );

  const fdate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

  return (
    <div className="page">
      {/* L'argent de démonstration se nomme : c'est l'écran qu'on ouvre pour
          prouver que l'OS marche. */}
      <ArgentDeDemo prospects={prospects} />
      <PageHeader
        eyebrow="Ta part · prélevée sur chaque vente"
        title="Payouts"
        actions={
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-faint">Ta part cumulée</p>
            <p className="font-display text-3xl font-bold text-bronze-400">{eur(summary.cutTotal)}</p>
            <p className="text-[11px] text-paper-faint">
              {/* Le taux EFFECTIF, pas le barème : dès qu'une fiche porte des
                  termes négociés, les lignes n'ont plus toutes le même taux et
                  afficher le barème donnerait une moyenne fausse. */}
              {summary.tauxEffectifPct}% effectif · depuis {fdate(summary.firstSaleDate)}
            </p>
          </div>
        }
      />

      {/* Les compteurs */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Ventes" value={String(summary.salesCount)} sub="paiements encaissés" />
        <Tile label="Brut encaissé" value={eur(summary.grossTotal)} sub="chiffre d'affaires" />
        <Tile label="Versé" value={eur(summary.settledTotal)} tone="text-signal-green" sub="ta part reçue" />
        <Tile label="En attente" value={eur(summary.pendingTotal)} tone="text-signal-amber" sub="ta part due" />
      </section>

      <p className="flex items-start gap-1.5 px-1 text-[11px] text-paper-faint">
        <Info size={12} className="mt-0.5 shrink-0" />
        Le barème ({summary.commissionPct}%) se règle dans{" "}
        <Link href="/settings" className="text-bronze-400 hover:underline">Réglages</Link>
        {summary.dealCount > 0 && (
          <>
            {" "}— mais {summary.dealCount} vente{summary.dealCount > 1 ? "s" : ""} applique
            {summary.dealCount > 1 ? "nt" : ""} les termes négociés de sa fiche, qui priment.
          </>
        )}
        . Coche « versé » quand ta part t&apos;a été payée — le total « en attente » suit tout seul.
      </p>

      {rows.length === 0 ? (
        <section className="card px-4 py-10 text-center">
          <Coins size={22} className="mx-auto text-paper-faint" />
          <p className="mt-2 text-sm text-paper">Aucune vente encaissée pour l&apos;instant.</p>
          <p className="mt-1 text-[12px] text-paper-faint">
            Ta part apparaîtra ici dès qu&apos;un paiement passe en « payé » sur une fiche.{" "}
            <Link href="/pipeline" className="text-bronze-400 hover:underline">Voir le pipe →</Link>
          </p>
        </section>
      ) : (
        <section className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-700 text-left font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-faint">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Client</th>
                  <th className="px-3 py-2.5 text-right">Brut</th>
                  <th className="px-3 py-2.5 text-right">Ta part</th>
                  <th className="px-3 py-2.5 text-right">Versé ?</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={cn("border-b border-ink-800", r.settled && "opacity-60")}>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] text-paper-dim tabular-nums">{fdate(r.date)}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/prospects/${r.prospectId}`} className="text-paper hover:text-bronze-400">{r.client}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-paper-dim">{eur(r.gross)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-bronze-400">{eur(r.cut)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition",
                          r.settled
                            ? "border-signal-green/40 text-signal-green"
                            : "border-ink-700 text-paper-faint hover:border-bronze-700 hover:text-bronze-400"
                        )}
                        onClick={() => togglePayoutSettled(r.id)}
                      >
                        {r.settled ? <><Check size={12} /> Versé</> : "Marquer versé"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-600 font-semibold">
                  <td className="px-3 py-3 text-paper-faint" colSpan={2}>Total — depuis la 1re vente</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-paper">{eur(summary.grossTotal)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-bronze-400">{eur(summary.cutTotal)}</td>
                  <td className="px-3 py-3 text-right font-mono text-[11px] tabular-nums text-signal-amber">
                    {eur(summary.pendingTotal)} dû
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <Link href="/preuves" className="inline-flex items-center gap-1.5 px-1 text-[12px] text-bronze-400 hover:underline">
        Voir les preuves de résultat <ArrowRight size={13} />
      </Link>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="card p-3.5">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-faint">{label}</p>
      <p className={cn("mt-1 font-display text-xl font-bold", tone ?? "text-paper")}>{value}</p>
      <p className="mt-0.5 text-[10.5px] text-paper-faint">{sub}</p>
    </div>
  );
}
