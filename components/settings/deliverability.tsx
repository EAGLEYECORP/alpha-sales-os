"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, HelpCircle, MailWarning, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Délivrabilité — l'angle mort le plus coûteux de la prospection email.
 *
 * On peut écrire le meilleur message du monde : sans SPF, DKIM et DMARC
 * publiés sur le domaine d'envoi, il finit en spam. Et le pire, c'est
 * qu'aucun signal ne remonte côté expéditeur — on croit envoyer 40 mails
 * par jour, on en délivre 8, et on conclut que « le cold email ne marche
 * pas ».
 *
 * Ce panneau lit les enregistrements DNS publics du domaine d'envoi et
 * dit, en français, ce qui manque et quoi publier.
 * ─────────────────────────────────────────────────────────────────────
 */

type Level = "ok" | "attention" | "manquant" | "inconnu";

interface Check {
  id: string;
  label: string;
  level: Level;
  value: string;
  why: string;
  fix?: string;
}

interface Report {
  domain: string;
  checkedAt: string;
  verdict: "bloquant" | "non concluant" | "à durcir" | "bon";
  manquants: number;
  attention: number;
  inconnus: number;
  checks: Check[];
}

function Icon({ level }: { level: Level }) {
  if (level === "ok") return <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-signal-green" />;
  if (level === "attention") return <AlertCircle size={15} className="mt-0.5 shrink-0 text-bronze-400" />;
  if (level === "inconnu") return <HelpCircle size={15} className="mt-0.5 shrink-0 text-paper-faint" />;
  return <XCircle size={15} className="mt-0.5 shrink-0 text-signal-red" />;
}

export function Deliverability() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async (d?: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/deliverability/dns${d ? `?domain=${encodeURIComponent(d)}` : ""}`);
      const json = await res.json();
      // « Pas encore configuré » n'est pas une panne : la route rend 200 avec
      // `configure: false`, et l'écran doit dire l'ÉTAPE À FAIRE, pas afficher
      // une erreur rouge qui laisse croire que quelque chose est cassé.
      if (res.ok && json?.configure === false) {
        setReport(null);
        setError(json.quoiFaire ?? "Domaine d'envoi non configuré.");
      } else if (!res.ok) {
        setReport(null);
        setError(json.error ?? "Vérification impossible.");
      } else {
        setReport(json as Report);
        setDomain((json as Report).domain);
      }
    } catch {
      setReport(null);
      setError("Impossible de joindre /api/deliverability/dns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
  };

  const verdictTone =
    report?.verdict === "bon"
      ? "border-signal-green/50 text-signal-green"
      : report?.verdict === "à durcir"
        ? "border-bronze-700 text-bronze-400"
        : report?.verdict === "non concluant"
          ? "border-ink-700 text-paper-faint"
          : "border-signal-red/50 text-signal-red";

  return (
    <section className="card p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <MailWarning size={15} className="text-bronze-400" /> Délivrabilité du domaine
          {report && <span className={cn("chip", verdictTone)}>{report.verdict}</span>}
        </h2>
        <div className="flex gap-2">
          <input
            className="input w-44 px-2 py-1.5 text-[12px]"
            placeholder="eagleye.fr"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(domain.trim() || undefined);
            }}
          />
          <button
            className="btn-ghost px-2.5 py-1.5 text-[12px]"
            onClick={() => void load(domain.trim() || undefined)}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {loading ? "…" : "Vérifier"}
          </button>
        </div>
      </div>

      <p className="mt-1 text-[11px] text-paper-faint">
        Depuis 2024, Gmail et Yahoo exigent SPF + DKIM + DMARC des expéditeurs en volume. Sans eux, les mails partent
        mais n&apos;arrivent pas — et aucune alerte ne remonte. Ces enregistrements se publient chez ton registrar
        (OVH, Gandi, Cloudflare…), pas dans l&apos;app.
      </p>

      {error && <p className="mt-3 text-[12px] text-signal-red">{error}</p>}

      {report && (
        <>
          <ul className="mt-3 space-y-2">
            {report.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded-lg border border-ink-700 bg-ink-850 p-3">
                <Icon level={c.level} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-paper">{c.label}</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-paper-faint">{c.value}</p>
                  <p className="mt-1 text-[11px] text-paper-dim">{c.why}</p>
                  {c.fix && (
                    <div className="mt-1.5 flex items-start gap-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-bronze-400">{c.fix}</p>
                      <button
                        className="btn-ghost shrink-0 px-2 py-1 text-[11px]"
                        onClick={() => copy(c.id, c.fix!)}
                      >
                        <Copy size={11} /> {copied === c.id ? "Copié ✓" : "Copier"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-paper-faint">
            {report.domain} · vérifié {new Date(report.checkedAt).toLocaleTimeString("fr-FR")}
          </p>
        </>
      )}
    </section>
  );
}
