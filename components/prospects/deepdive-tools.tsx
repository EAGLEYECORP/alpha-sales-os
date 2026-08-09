"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Download, ExternalLink, Gift, Globe, GraduationCap, Import, Loader2, Ruler, Sparkles, X } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { useAlpha } from "@/lib/store";
import { renderAuditDoc } from "@/lib/audit-doc";
import { mergeAudit, prospectSiteUrl } from "@/lib/audit-apply";
import { verticalForProspect } from "@/lib/playbook";
import { cn, uid } from "@/lib/utils";

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

const COACH_KEY = "alpha_deepdive_coached";

export function DeepdiveTools({ p, patch }: { p: Prospect; patch: (id: string, patch: Partial<Prospect>) => void }) {
  const { settings } = useAlpha();
  const [research, setResearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [coach, setCoach] = useState(false);
  const [appliedOnce, setAppliedOnce] = useState(false);
  const [giftOpened, setGiftOpened] = useState(false);
  // Audit automatique depuis le site : URL pré-remplie si websiteState en contient une.
  const [siteUrl, setSiteUrl] = useState(() => prospectSiteUrl(p) ?? "");
  const [genBusy, setGenBusy] = useState(false);
  const [auditSource, setAuditSource] = useState<string | null>(null);

  // La visite du deep-dive s'ouvre UNE fois (premier prospect travaillé).
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(COACH_KEY)) setCoach(true);
    } catch {
      /* stockage indispo → pas d'auto-ouverture */
    }
  }, []);

  const closeCoach = () => {
    setCoach(false);
    try {
      window.localStorage.setItem(COACH_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
  };

  /** Audit complet auto : récupère le site du prospect et le structure. */
  const generateFromSite = async () => {
    if (!siteUrl.trim()) {
      setMsg("Donne l'URL du site du prospect (ex. https://…).");
      return;
    }
    setGenBusy(true);
    setMsg("");
    setExtracted(null);
    try {
      const res = await fetch("/api/audit/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: siteUrl, company: p.company, city: p.city, sector: p.sector }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Génération impossible.");
      } else {
        setExtracted(data.data as Extracted);
        setAuditSource(siteUrl);
        setMsg(`Audit généré depuis le site (${data.source}) par ${data.engine} — relis puis applique.`);
      }
    } catch (e) {
      setMsg(`Erreur : ${e instanceof Error ? e.message : "réseau"}`);
    } finally {
      setGenBusy(false);
    }
  };

  const runExtract = async () => {
    setBusy(true);
    setMsg("");
    setExtracted(null);
    setAuditSource(null);
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
    // Fusion conservatrice centralisée (partagée avec la génération en lot).
    // La pièce jointe reste spécifique à une recherche COLLÉE.
    patch(p.id, {
      ...mergeAudit(p, extracted, auditSource),
      attachments: research.trim().length >= 40 ? [...p.attachments, researchAttachment(research)] : p.attachments,
    });
    setExtracted(null);
    setResearch("");
    setAuditSource(null);
    setAppliedOnce(true);
    setMsg("✓ Fiche mise à jour. Vérifie la Taxe d'Ignorance.");
  };

  /**
   * Repères du métier — pré-remplit la douleur chiffrée avec les
   * paramètres de la verticale du playbook, UNIQUEMENT là où la fiche
   * est vide. Doctrine : ce sont des ordres de grandeur diagnostiques,
   * jamais des chiffres audités — à valider avec ses vrais nombres.
   */
  const applyBenchmark = () => {
    const v = verticalForProspect(p);
    if (!v) {
      setMsg("Aucune verticale rattachée à cette fiche.");
      return;
    }
    const d = p.deepAudit;
    const deepAudit: Prospect["deepAudit"] = {
      ...d,
      missedCallsPerWeek: d.missedCallsPerWeek ?? Math.round((v.leak.callsPerMonth * v.leak.missRate) / 4.33),
      avgTicket: d.avgTicket ?? v.leak.avgTicket,
      conversionRate: d.conversionRate ?? Math.round(v.leak.convertRate * 100),
      updatedAt: new Date().toISOString(),
    };
    const tax =
      deepAudit.missedCallsPerWeek && deepAudit.avgTicket
        ? Math.round(deepAudit.missedCallsPerWeek * 4.33 * ((deepAudit.conversionRate ?? 30) / 100) * deepAudit.avgTicket)
        : p.ignoranceTax;
    patch(p.id, { deepAudit, ignoranceTax: tax });
    setMsg(`✓ Repères « ${v.label} » appliqués aux champs vides — estimation à valider avec ses vrais chiffres.`);
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
    w.document.write(renderAuditDoc(p, settings.closerName, settings.bookingUrl));
    w.document.close();
    setGiftOpened(true);
  };

  const downloadGift = () => {
    const blob = new Blob([renderAuditDoc(p, settings.closerName, settings.bookingUrl)], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${p.company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    setGiftOpened(true);
  };

  // Progression de la visite (dérivée de l'état réel).
  const steps: { label: string; done: boolean; hint: string }[] = [
    { label: "Coller la recherche", done: research.trim().length >= 40 || appliedOnce || extracted !== null, hint: "Perplexity, ChatGPT ou tes notes — dans la zone ci-dessous." },
    { label: "Structurer avec l'IA", done: extracted !== null || appliedOnce, hint: "L'IA transforme le texte en champs de fiche." },
    { label: "Relire les champs", done: appliedOnce, hint: "Rien ne s'écrit sans ton clic — vérifie avant d'appliquer." },
    { label: "Appliquer à la fiche", done: appliedOnce, hint: "Taxe recalculée, source jointe, saisies manuelles préservées." },
    { label: "Générer l'audit cadeau", done: giftOpened, hint: "« Aperçu » ou « Télécharger » — le document brandé à offrir." },
    { label: "Joindre au 1er email", done: false, hint: "Onglet Templates → 1er email → coche « Audit cadeau »." },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="card p-4 lg:col-span-2">
      {/* Visite guidée du deep-dive (premier prospect) */}
      {coach ? (
        <div className="mb-4 rounded-xl border border-bronze-700/60 bg-bronze-900/10 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <GraduationCap size={16} className="text-bronze-400" />
              <div>
                <p className="font-display text-[13px] font-bold text-paper">Ton premier deep-dive — le guide</p>
                <p className="text-[11px] text-paper-faint">Le ciblage commence par la connaissance. Suis les 6 étapes, {doneCount}/6 faites.</p>
              </div>
            </div>
            <button className="grid h-6 w-6 place-items-center rounded-full text-paper-faint hover:bg-ink-800 hover:text-paper" onClick={closeCoach} aria-label="Fermer le guide">
              <X size={13} />
            </button>
          </div>
          <ol className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-start gap-2">
                {s.done ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-signal-green" />
                ) : (
                  <Circle size={15} className="mt-0.5 shrink-0 text-paper-faint" />
                )}
                <div className="min-w-0">
                  <p className={cn("text-[12.5px]", s.done ? "text-paper-dim line-through" : "text-paper")}>
                    {i + 1}. {s.label}
                  </p>
                  {!s.done && <p className="text-[10.5px] text-paper-faint">{s.hint}</p>}
                </div>
              </li>
            ))}
          </ol>
          {doneCount >= 5 && (
            <p className="mt-2.5 rounded-lg border border-signal-green/40 bg-signal-green/5 px-2.5 py-1.5 text-[11.5px] text-signal-green">
              Bravo — tu tiens la méthode. Dernier réflexe : joins l&apos;audit cadeau à ton 1er email (onglet Templates), puis
              <button className="ml-1 underline underline-offset-2" onClick={closeCoach}>termine le guide</button>.
            </p>
          )}
        </div>
      ) : (
        <button
          className="mb-3 flex items-center gap-1.5 text-[11px] text-paper-faint underline-offset-2 hover:text-bronze-400 hover:underline"
          onClick={() => setCoach(true)}
        >
          <GraduationCap size={12} /> Revoir le guide du deep-dive
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Import size={15} className="text-bronze-400" /> Importer une recherche
          <span className="text-[11px] font-normal text-paper-faint">(Perplexity, ChatGPT, tes notes — l&apos;IA structure, tu relis, tu appliques)</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost px-2.5 py-1.5 text-[12px]"
            onClick={applyBenchmark}
            title="Pré-remplit la douleur chiffrée avec les repères de son métier (playbook terrain) — uniquement les champs vides, à valider ensuite avec ses vrais chiffres"
          >
            <Ruler size={13} /> Repères du métier
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={openGift} title="Ouvrir l'audit cadeau dans un onglet">
            <ExternalLink size={13} /> Aperçu audit cadeau
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={downloadGift} title="Télécharger le lead magnet (.html, imprimable en PDF)">
            <Download size={13} /> <Gift size={13} /> Télécharger
          </button>
        </div>
      </div>

      {/* Audit COMPLET automatique — depuis le site du prospect (sans copier-coller) */}
      <div className="mt-3 rounded-lg border border-bronze-700/50 bg-bronze-900/10 p-2.5">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-paper">
          <Globe size={13} className="text-bronze-400" /> Générer l&apos;audit complet depuis le site
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            className="input flex-1 min-w-[180px] font-mono text-[12px]"
            placeholder="https://site-du-prospect.fr"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !genBusy && generateFromSite()}
          />
          <button className="btn-bronze px-3 py-1.5 text-[12px]" onClick={generateFromSite} disabled={genBusy || !siteUrl.trim()}>
            {genBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {genBusy ? "Analyse du site…" : "Générer l'audit"}
          </button>
        </div>
        <p className="mt-1 text-[10.5px] text-paper-faint">
          Récupère la page du prospect et la structure automatiquement. Sites JS/anti-bot : branche un{" "}
          <code className="code">SCRAPE_ENDPOINT</code> (Firecrawl/Crawl4AI/Camoufox). Tu relis avant d&apos;appliquer.
        </p>
      </div>

      <textarea
        className="input mt-3 min-h-[110px] font-mono text-[12px]"
        placeholder={`… ou colle ta recherche sur ${p.company} (deep-dive Perplexity, analyse marché, notes terrain…) — puis « Structurer avec l'IA ».`}
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
