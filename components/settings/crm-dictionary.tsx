"use client";

import { useState } from "react";
import { BookText, Check, ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import schema from "@/integrations/schema/crm-schema.json";

/**
 * Dictionnaire CRM — rend `integrations/schema/crm-schema.json` : toutes les
 * variables suivies par Google Sheets, qui les écrit, ce qui les utilise.
 * Bouton « Copier les en-têtes » = colle-les dans la 1re ligne d'une feuille.
 */
interface Field {
  key: string;
  header: string;
  type: string;
  source: string;
  critical?: boolean;
  description?: string;
}
interface Group {
  id: string;
  label: string;
  fields: Field[];
}

const SOURCE_CLS: Record<string, string> = {
  human: "border-signal-red/40 text-signal-red",
  app: "border-bronze-700 text-bronze-400",
  n8n: "border-signal-blue/40 text-signal-blue",
  computed: "border-ink-600 text-paper-faint",
  provider: "border-signal-green/40 text-signal-green",
};

export function CrmDictionary() {
  const groups = schema.groups as Group[];
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const headers = groups.flatMap((g) => g.fields.map((f) => f.header));
  const total = headers.length;

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="flex items-center gap-2 font-display text-sm font-semibold text-paper" onClick={() => setOpen((v) => !v)}>
          <BookText size={15} className="text-bronze-400" /> Dictionnaire CRM
          <span className="chip border-ink-600 text-paper-faint">{total} variables</span>
          <ChevronDown size={15} className={cn("text-paper-faint transition-transform", open && "rotate-180")} />
        </button>
        <button
          className="btn-ghost px-2.5 py-1.5 text-[12px]"
          onClick={() => {
            navigator.clipboard.writeText(headers.join("\t"));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check size={13} className="text-signal-green" /> : <Copy size={13} />}
          {copied ? "Copié ✓" : "Copier les en-têtes Sheets"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-paper-faint">
        Toutes les variables que Google Sheets suit. <span className="text-signal-red">Rouge = à saisir (humain)</span> ·
        bronze = app · bleu = n8n · vert = fournisseur · gris = calculé. Source :{" "}
        <code className="font-mono text-bronze-400">integrations/schema/crm-schema.json</code>.
      </p>

      {open && (
        <div className="mt-3 space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">{g.label}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <tbody>
                    {g.fields.map((f) => (
                      <tr key={f.key} className="border-t border-ink-700/60 first:border-t-0">
                        <td className="py-1.5 pr-3 align-top">
                          <span className="text-paper">{f.header}</span>
                          {f.critical && <span className="ml-1.5 chip border-signal-red/40 text-signal-red">critique</span>}
                          <div className="font-mono text-[10px] text-paper-faint">{f.key} · {f.type}</div>
                        </td>
                        <td className="py-1.5 pr-3 align-top">
                          <span className={cn("chip", SOURCE_CLS[f.source] ?? "border-ink-600 text-paper-faint")}>{f.source}</span>
                        </td>
                        <td className="py-1.5 align-top text-[11px] text-paper-dim">{f.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
