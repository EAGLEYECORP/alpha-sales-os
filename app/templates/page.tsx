"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Lightbulb } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { SendBar } from "@/components/send-bar";
import { CustomScripts } from "@/components/custom-scripts";
import {
  FORMAT_LABELS,
  SECTOR_LABELS,
  STAGE_GROUPS,
  buildTemplates,
  fillTemplate,
  type StageGroup,
  type TemplateFormat,
} from "@/lib/templates";
import type { Sector } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL_TEMPLATES = buildTemplates();

export default function TemplatesPage() {
  const { prospects, settings } = useAlpha();
  const [sector, setSector] = useState<Exclude<Sector, "autre">>("restaurant");
  const [group, setGroup] = useState<StageGroup>("premier-contact");
  const [format, setFormat] = useState<TemplateFormat | "tous">("tous");
  const [prospectId, setProspectId] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  const prospect = prospects.find((p) => p.id === prospectId) ?? null;
  const groupMeta = STAGE_GROUPS.find((g) => g.id === group)!;

  const templates = useMemo(
    () =>
      ALL_TEMPLATES.filter(
        (t) => t.sector === sector && t.group === group && (format === "tous" || t.format === format)
      ),
    [sector, group, format]
  );

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <header>
        <h1 className="font-display text-2xl font-bold text-paper">Templates</h1>
        <p className="text-sm text-paper-faint">
          Le bon message, au bon moment, dans le bon format. Choisis l&apos;industrie, le moment du pipeline, le canal — copie, envoie.
        </p>
      </header>

      {/* Filtres */}
      <div className="card space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">1 · Industrie</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SECTOR_LABELS) as Exclude<Sector, "autre">[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSector(s)}
                  className={cn(
                    "chip transition-colors",
                    s === sector
                      ? "border-gold bg-gold font-semibold text-goldink"
                      : "border-ink-600 text-paper-faint hover:border-bronze-700 hover:text-paper"
                  )}
                >
                  {SECTOR_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">3 · Format</label>
            <div className="flex flex-wrap gap-1.5">
              {(["tous", "email", "dm", "appel"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "chip transition-colors",
                    f === format
                      ? "border-gold bg-gold font-semibold text-goldink"
                      : "border-ink-600 text-paper-faint hover:border-bronze-700 hover:text-paper"
                  )}
                >
                  {f === "tous" ? "Tous" : FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="label">2 · Moment du pipeline</label>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroup(g.id)}
                title={g.goal}
                className={cn(
                  "chip transition-colors",
                  g.id === group
                    ? "border-gold bg-gold font-semibold text-goldink"
                    : "border-ink-600 text-paper-faint hover:border-bronze-700 hover:text-paper"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-700 pt-3">
          <label className="label mb-0">Personnaliser avec un prospect</label>
          <select className="input w-auto min-w-52" value={prospectId} onChange={(e) => setProspectId(e.target.value)}>
            <option value="">— variables visibles —</option>
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.company} ({p.name})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-paper-faint">
            Remplit {"{prenom} {commerce} {ville} {taxe}"} avec ses vraies données.
          </p>
        </div>
      </div>

      {/* Mes scripts — mode manuel / test */}
      <CustomScripts prospect={prospect} />

      {/* Objectif du moment */}
      <div className="rounded-xl border border-bronze-700/50 bg-bronze-900/20 px-4 py-2.5">
        <p className="text-sm text-paper">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bronze-500">Objectif · {groupMeta.label} — </span>
          {groupMeta.goal}
        </p>
      </div>

      {/* Templates */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => {
          const text = fillTemplate(t.body, prospect, settings.closerName);
          // Les templates email embarquent leur ligne « Objet : … » — on la sépare pour l'envoi réel.
          const objetMatch = text.match(/^Objet\s*:\s*(.+)\n+/);
          const subject = objetMatch ? objetMatch[1].trim() : t.title;
          const sendBody = objetMatch ? text.slice(objetMatch[0].length) : text;
          return (
            <div key={t.id} className="card card-hover flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-sm font-bold text-paper">{t.title}</p>
                <span className="chip shrink-0 border-bronze-700 text-bronze-400">{FORMAT_LABELS[t.format]}</span>
              </div>
              <pre className="mt-3 flex-1 whitespace-pre-wrap rounded-xl border border-ink-700 bg-ink-900 p-3.5 font-body text-[12.5px] leading-relaxed text-paper-dim">
                {text}
              </pre>
              <p className="mt-2.5 flex gap-1.5 text-[11.5px] text-bronze-400">
                <Lightbulb size={13} className="mt-0.5 shrink-0" /> {t.tip}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => copy(t.id, text)}>
                  {copied === t.id ? <Check size={13} className="text-signal-green" /> : <Copy size={13} />}
                  {copied === t.id ? "Copié ✓" : "Copier"}
                </button>
                {prospect && t.format !== "appel" && (
                  <SendBar prospect={prospect} subject={subject} body={sendBody} compact />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
