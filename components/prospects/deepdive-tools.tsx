"use client";

import { useState } from "react";
import { Download, ExternalLink, Gift, Import, Loader2, Sparkles, X } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { useAlpha } from "@/lib/store";
import { renderAuditDoc } from "@/lib/audit-doc";
import { uid } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Outils deep-dive de la fiche :
 *
 *  1. IMPORT LIBRE d'une recherche externe (Perplexity, ChatGPT, notes…)
 *     → l'IA locale la structure en champs de fiche → TU relis → tu
 *     appliques. Sans IA : « Joindre en brut » (notes + pièce jointe).
 *     Le texte brut est TOUJOURS conservé en pièce jointe (la source).
 *
 *  2. AUDIT CADEAU (lead magnet) : le deep-dive devient un document
 *     brandé offert au prospect — aperçu navigateur, téléchargement
 *     .html, impression PDF native. À joindre à l'email d'awareness.
 * ─────────────────────────────────────────────────────────────────────
 */

interface Extracted {
  rating?: number;
  reviews?: number;
  websiteState?: string;
  socialState?: string;
  localCompetition?: string;
  currentProcess?: string;
  missedCallsPerWeek?: number;
  avgTicket?: number;
  problems?: string[];
  solution?: string;
  personalizedOffer?: string;
  marketPosition?: string;
  audience?: string;
  summary?: string;
}

const FIELD_LABELS: Record<string, string> = {
  rating: "Note Google",
  reviews: "Nb d'avis",
  websiteState: "Site web",
  socialState: "Réseaux sociaux",
  localCompetition: "Concurrence locale",
  currentProcess: "Process actuel",
  missedCallsPerWeek: "Appels ratés/sem",
  avgTicket: "Panier moyen (€)",
  problems: "Problèmes",
  solution: "Solution",
  personalizedOffer: "Offre personnalisée",
  marketPosition: "Position marché",
  audience: "À qui parle son offre",
  summary: "Résumé",
};

function researchAttachment(research: string): Prospect["attachments"][number] {
  return {
    id: uid(),
    name: `recherche-${new Date().toISOString().slice(0, 10)}.txt`,
    kind: "audit",
    size: research.length,
    addedAt: new Date().toISOString(),
    url: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(research)))}`,
  };
}

export function DeepdiveTools({ p, patch }: { p: Prospect; patch: (id: string, patch: Partial<Prospect>) => void }) {
  const { settings } = useAlpha();
  const [research, setResearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [extracted, setExtracted] = useState<Extracted | null>(null);

  const runExtract = async () => {
    setBusy(true);
    setMsg("");
    setExtracted(null);
    try {
      const res = await fetch("/api/audit/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ research, company: p.company, city: p.city, sector: p.sector }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Extraction impossible.");
      } else {
        setExtracted(data.data as Extracted);
        setMsg(`Structuré par ${data.engine} — relis puis applique (rien n'est écrit sans toi).`);
      }
    } catch (e) {
      setMsg(`Erreur : ${e instanceof Error ? e.message : "réseau"}`);
    } finally {
      setBusy(false);
    }
  };

  const applyExtract = () => {
    if (!extracted) return;
    const x = extracted;
    const d = p.deepAudit;
    const deepAudit: Prospect["deepAudit"] = {
      ...d,
      googleRating: x.rating ?? d.googleRating,
      googleReviews: x.reviews ?? d.googleReviews,
      websiteState: x.websiteState ?? d.websiteState,
      socialState: x.socialState ?? d.socialState,
      localCompetition: x.localCompetition ?? d.localCompetition,
      currentProcess: x.currentProcess ?? d.currentProcess,
      missedCallsPerWeek: x.missedCallsPerWeek ?? d.missedCallsPerWeek,
      avgTicket: x.avgTicket ?? d.avgTicket,
      updatedAt: new Date().toISOString(),
    };
    // Taxe d'Ignorance recalculée si on a la douleur chiffrée (conv 30 % par défaut).
    const tax =
      deepAudit.missedCallsPerWeek && deepAudit.avgTicket
        ? Math.round(deepAudit.missedCallsPerWeek * 4.33 * ((deepAudit.conversionRate ?? 30) / 100) * deepAudit.avgTicket)
        : p.ignoranceTax;
    const mergedProblems = [...p.problems];
    for (const pb of x.problems ?? []) if (!mergedProblems.some((e) => e.toLowerCase() === pb.toLowerCase())) mergedProblems.push(pb);
    const noteLines = [
      x.marketPosition ? `Position marché : ${x.marketPosition}` : "",
      x.audience ? `Son offre parle à : ${x.audience}` : "",
      x.summary ? `Résumé recherche : ${x.summary}` : "",
    ].filter(Boolean);
    patch(p.id, {
      deepAudit,
      ignoranceTax: tax,
      problems: mergedProblems,
      solution: p.solution.trim() ? p.solution : x.solution ?? p.solution,
      personalizedOffer: p.personalizedOffer.trim() ? p.personalizedOffer : x.personalizedOffer ?? p.personalizedOffer,
      notes: noteLines.length ? `${p.notes ? p.notes + "\n" : ""}[${new Date().toISOString().slice(0, 10)} — recherche importée]\n${noteLines.join("\n")}` : p.notes,
      attachments: [...p.attachments, researchAttachment(research)],
    });
    setExtracted(null);
    setResearch("");
    setMsg("✓ Fiche mise à jour — la source est conservée en pièce jointe. Vérifie la Taxe d'Ignorance.");
  };

  const attachRaw = () => {
    patch(p.id, {
      notes: `${p.notes ? p.notes + "\n" : ""}[${new Date().toISOString().slice(0, 10)} — recherche brute]\n${research.slice(0, 1500)}`,
      attachments: [...p.attachments, researchAttachment(research)],
    });
    setResearch("");
    setMsg("✓ Joint en brut (notes + pièce jointe).");
  };

  const openGift = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(renderAuditDoc(p, settings.closerName));
    w.document.close();
  };

  const downloadGift = () => {
    const blob = new Blob([renderAuditDoc(p, settings.closerName)], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${p.company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Import size={15} className="text-bronze-400" /> Importer une recherche
          <span className="text-[11px] font-normal text-paper-faint">(Perplexity, ChatGPT, tes notes — l&apos;IA structure, tu relis, tu appliques)</span>
        </h2>
        <div className="flex gap-2">
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={openGift} title="Ouvrir l'audit cadeau dans un onglet">
            <ExternalLink size={13} /> Aperçu audit cadeau
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={downloadGift} title="Télécharger le lead magnet (.html, imprimable en PDF)">
            <Download size={13} /> <Gift size={13} /> Télécharger
          </button>
        </div>
      </div>

      <textarea
        className="input mt-3 min-h-[110px] font-mono text-[12px]"
        placeholder={`Colle ici ta recherche sur ${p.company} (deep-dive Perplexity, analyse marché, notes terrain…) — puis « Structurer avec l'IA ».`}
        value={research}
        onChange={(e) => setResearch(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="btn-bronze px-3 py-1.5 text-[12px]" onClick={runExtract} disabled={busy || research.trim().length < 40}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {busy ? "Structuration…" : "Structurer avec l'IA"}
        </button>
        <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={attachRaw} disabled={research.trim().length < 40}>
          Joindre en brut (sans IA)
        </button>
        {msg && <span className="text-[12px] text-paper-dim">{msg}</span>}
      </div>

      {extracted && (
        <div className="mt-3 rounded-lg border border-bronze-700/60 bg-bronze-900/10 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-paper">Champs extraits — relecture avant application :</p>
            <button className="grid h-6 w-6 place-items-center rounded-full text-paper-faint hover:bg-ink-800" onClick={() => setExtracted(null)} aria-label="Annuler">
              <X size={13} />
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {Object.entries(extracted)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => (
                <li key={k} className="flex gap-2 text-[12px]">
                  <span className="min-w-[150px] shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-bronze-400">{FIELD_LABELS[k] ?? k}</span>
                  <span className="text-paper-dim">{Array.isArray(v) ? v.join(" · ") : String(v)}</span>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-[10.5px] text-paper-faint">
            Les champs déjà remplis à la main (solution, offre) ne sont jamais écrasés. Les problèmes fusionnent sans doublon.
          </p>
          <button className="btn-bronze mt-2 px-3 py-1.5 text-[12px]" onClick={applyExtract}>
            Appliquer à la fiche
          </button>
        </div>
      )}
    </section>
  );
}
