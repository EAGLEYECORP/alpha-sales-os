"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { mergeAudit, prospectSiteUrl } from "@/lib/audit-apply";
import type { ExtractedAudit } from "@/lib/audit-extract";
import { cn } from "@/lib/utils";

/**
 * Audit auto EN LOT : pour chaque fiche vivante ayant une URL de site, récupère
 * le site et le structure (même route que la fiche). Fusion CONSERVATRICE
 * (ne remplace jamais les saisies manuelles). Séquentiel, avec progression.
 */
export function BulkSiteAudit() {
  const { prospects, patchProspect } = useAlpha();
  const targets = useMemo(
    () => prospects.filter((p) => p.stage !== "perdu" && prospectSiteUrl(p)),
    [prospects]
  );

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<{ company: string; ok: boolean; msg: string }[]>([]);

  if (targets.length === 0) return null; // aucune fiche avec URL → rien à proposer

  const run = async () => {
    setRunning(true);
    setDone(0);
    setResults([]);
    const out: { company: string; ok: boolean; msg: string }[] = [];
    for (const p of targets) {
      const url = prospectSiteUrl(p)!;
      try {
        const res = await fetch("/api/audit/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, company: p.company, city: p.city, sector: p.sector }),
        });
        const data = await res.json();
        if (res.ok && data.data) {
          patchProspect(p.id, mergeAudit(p, data.data as ExtractedAudit, url));
          out.push({ company: p.company, ok: true, msg: `structuré (${data.engine})` });
        } else {
          out.push({ company: p.company, ok: false, msg: data.error ?? `HTTP ${res.status}` });
        }
      } catch (e) {
        out.push({ company: p.company, ok: false, msg: e instanceof Error ? e.message : "réseau" });
      }
      setDone((d) => d + 1);
      setResults([...out]);
    }
    setRunning(false);
  };

  const pct = targets.length ? Math.round((done / targets.length) * 100) : 0;
  const okCount = results.filter((r) => r.ok).length;

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Globe size={15} className="text-bronze-400" /> Audit auto en lot (depuis les sites)
        </h2>
        <button className="btn-bronze px-3 py-1.5 text-[12px]" onClick={run} disabled={running}>
          {running ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {running ? `Analyse… ${done}/${targets.length}` : `Générer ${targets.length} audit${targets.length > 1 ? "s" : ""}`}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-paper-faint">
        {targets.length} fiche{targets.length > 1 ? "s ont" : " a"} une URL de site. Fusion conservatrice — tes saisies
        manuelles ne sont jamais écrasées, la provenance est notée. Sites JS/anti-bot : branche un{" "}
        <code className="code">SCRAPE_ENDPOINT</code>.
      </p>

      {(running || results.length > 0) && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
            <div className="h-full rounded-full bg-signal-green transition-all" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
          {!running && results.length > 0 && (
            <p className="mt-1.5 text-[11.5px] text-paper-dim">
              {okCount}/{results.length} structurés
              {okCount < results.length && <span className="text-signal-amber"> · {results.length - okCount} en échec</span>}
            </p>
          )}
          <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]">
                {r.ok ? (
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-signal-green" />
                ) : (
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-signal-amber" />
                )}
                <span className="min-w-0">
                  <span className="text-paper">{r.company}</span>{" "}
                  <span className={cn(r.ok ? "text-paper-faint" : "text-signal-amber")}>— {r.msg}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
