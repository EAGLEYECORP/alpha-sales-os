"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Circle, Download, ExternalLink, FileText, Gift, Info, Ruler } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { renderAuditDoc, renderAuditBundle, brandFromSettings } from "@/lib/audit-doc";
import { withMetierBenchmark, auditReadiness, auditFilename } from "@/lib/audit-batch";
import { stageById } from "@/lib/hormozi";
import type { Prospect } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BulkSiteAudit } from "@/components/audits/bulk-site-audit";
import { PageHeader } from "@/components/ui/page-header";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Audits — le lead magnet, pour une fiche ou tout un lot.
 *
 * Le même document brandé que le deep-dive d'une fiche, mais généré en
 * série : coche les prospects, clique « Générer », obtiens un PDF avec un
 * audit par page — prêts à joindre à tes premiers emails.
 *
 * « Compléter la Taxe » remplit la douleur chiffrée depuis les repères du
 * métier là où la fiche est vide, pour qu'aucun audit ne sorte sans son
 * chiffre. Rien n'est écrit dans le CRM : le complément ne vit que dans le
 * document généré. La doctrine tient — c'est une estimation, le document
 * le dit.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function AuditsPage() {
  const { prospects, settings } = useAlpha();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [benchmark, setBenchmark] = useState(true);

  // Les fiches encore vivantes d'abord — on n'audite pas un perdu/gagné.
  const list = useMemo(
    () =>
      [...prospects]
        .filter((p) => p.stage !== "perdu")
        .sort((a, b) => b.probability - a.probability || b.trust - a.trust),
    [prospects]
  );

  const prep = (p: Prospect): Prospect => (benchmark ? withMetierBenchmark(p) : p);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const selectAll = () => setSelected(new Set(list.map((p) => p.id)));
  const selectNone = () => setSelected(new Set());
  const selectReady = () =>
    setSelected(new Set(list.filter((p) => { const r = auditReadiness(p); return r.hasProblems || r.hasVertical; }).map((p) => p.id)));

  const chosen = list.filter((p) => selected.has(p.id));

  const openDoc = (html: string) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };
  const download = (html: string, filename: string) => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const generateBundle = () => {
    if (chosen.length === 0) return;
    openDoc(renderAuditBundle(chosen.map(prep), settings.closerName, settings.bookingUrl, brandFromSettings(settings)));
  };
  const downloadBundle = () => {
    if (chosen.length === 0) return;
    const name = chosen.length === 1 ? auditFilename(chosen[0]) : `audits-${chosen.length}-fiches.html`;
    download(renderAuditBundle(chosen.map(prep), settings.closerName, settings.bookingUrl, brandFromSettings(settings)), name);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Le cadeau qui ouvre la porte"
        title="Audits"
        actions={
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper-faint">
            Sélection <b className="ml-1 font-display text-base text-paper">{chosen.length}</b>
          </span>
        }
      />

      {/* Audit auto en lot — remplit les données de fiche depuis les sites */}
      <BulkSiteAudit />

      {/* Ce que c'est */}
      <section className="card border-ink-700 p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Info size={15} className="text-bronze-400" /> Un document offert, pas une plaquette de vente
        </h2>
        <p className="mt-1.5 max-w-3xl text-[12px] text-paper-dim">
          L&apos;audit de présence est brandé à ta marque, sans jargon, et se termine sur une invitation douce. Génère-le pour{" "}
          <b className="text-paper">une fiche ou tout un lot</b> : un PDF, un audit par page. À joindre à ton premier
          email, ou à laisser après une visite. La Taxe d&apos;Ignorance affichée est une <b className="text-paper">estimation</b>{" "}
          — le document le dit lui-même.
        </p>
      </section>

      {/* Barre d'action */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-bronze px-3 py-2 text-[13px]" onClick={generateBundle} disabled={chosen.length === 0}>
            <FileText size={14} /> Générer {chosen.length > 0 ? `${chosen.length} ` : ""}audit{chosen.length > 1 ? "s" : ""} (PDF)
          </button>
          <button className="btn-ghost px-3 py-2 text-[13px]" onClick={downloadBundle} disabled={chosen.length === 0}>
            <Download size={13} /> Télécharger le lot
          </button>
          <span className="mx-1 h-5 w-px bg-ink-700" />
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={selectAll}>Tout</button>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={selectReady} title="Les fiches avec un constat ou une verticale reconnue">
            Prêtes
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={selectNone}>Aucune</button>
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12px] text-paper-dim">
            <input type="checkbox" checked={benchmark} onChange={(e) => setBenchmark(e.target.checked)} className="accent-bronze-500" />
            <Ruler size={13} className="text-bronze-400" /> Compléter la Taxe avec les repères du métier
          </label>
        </div>
      </section>

      {list.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-paper-faint">
          Aucune fiche à auditer.{" "}
          <Link href="/settings" className="text-bronze-400 hover:underline">Importe tes prospects →</Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((p) => {
            const r = auditReadiness(p);
            const isSel = selected.has(p.id);
            const prepped = prep(p);
            return (
              <li key={p.id} className={cn("card p-3.5", isSel && "border-bronze-700")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button className="flex min-w-0 items-start gap-2.5 text-left" onClick={() => toggle(p.id)}>
                    {isSel ? (
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-bronze-400" />
                    ) : (
                      <Circle size={17} className="mt-0.5 shrink-0 text-paper-faint" />
                    )}
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-paper">
                        {p.company}
                        <span className="chip border-ink-700 text-[10px] text-paper-faint">{stageById(p.stage).label}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <Chip on={r.hasTax || benchmark} label={r.hasTax ? "Taxe chiffrée" : benchmark ? "Taxe (repères)" : "Sans taxe"} />
                        <Chip on={r.hasProblems} label="Constats" />
                        <Chip on={r.hasMarket} label="Données marché" />
                        <Chip on={r.hasVertical} label="Verticale" />
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <button
                      className="btn-ghost px-2.5 py-1.5 text-[12px]"
                      onClick={() => openDoc(renderAuditDoc(prepped, settings.closerName, settings.bookingUrl, brandFromSettings(settings)))}
                      title="Aperçu de l'audit dans un onglet"
                    >
                      <ExternalLink size={13} /> Aperçu
                    </button>
                    <button
                      className="btn-ghost px-2.5 py-1.5 text-[12px]"
                      onClick={() => download(renderAuditDoc(prepped, settings.closerName, settings.bookingUrl, brandFromSettings(settings)), auditFilename(p))}
                      title="Télécharger l'audit (.html, imprimable en PDF)"
                    >
                      <Download size={13} /> <Gift size={13} />
                    </button>
                    <Link href={`/prospects/${p.id}`} className="btn-ghost px-2.5 py-1.5 text-[12px]">
                      Fiche <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5 font-mono uppercase tracking-wider",
        on ? "border-signal-green/40 text-signal-green" : "border-ink-700 text-paper-faint"
      )}
    >
      {label}
    </span>
  );
}
