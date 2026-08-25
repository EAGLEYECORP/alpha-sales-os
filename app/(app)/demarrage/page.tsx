"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Hand,
  RefreshCw,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { n8nConnected } from "@/lib/n8n";
import { buildPath, type PathStep } from "@/lib/onboarding-path";
import { SurfacePreuve } from "@/components/demarrage/surface-preuve";
import { cn } from "@/lib/utils";

const MANUAL_KEY = "alpha_path_manual";

/**
 * Prise en main — le chemin, pas la documentation.
 *
 * Une seule question à l'écran : « qu'est-ce que je fais maintenant ? ».
 * La réponse est en haut, en gros, avec le bouton qui y mène. Le reste
 * est le contexte : d'où l'on vient, où l'on va, et ce que l'app a
 * réellement constaté — pas ce qu'on a déclaré avoir fait.
 */
export default function DemarragePage() {
  const { prospects, meetings, settings } = useAlpha();
  const [health, setHealth] = useState<Parameters<typeof buildPath>[0]["health"]>(null);
  const [dns, setDns] = useState<{ manquants: number; inconnus: number } | null>(null);
  const [n8n, setN8n] = useState(false);
  const [manual, setManual] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/health")
        .then((r) => r.json())
        .then((j) => setHealth(j.capabilities ?? null))
        .catch(() => setHealth(null)),
      fetch("/api/deliverability/dns")
        .then((r) => (r.ok ? r.json() : null))
        .then(setDns)
        .catch(() => setDns(null)),
    ]).finally(() => setLoading(false));
    setN8n(n8nConnected());
  };

  useEffect(() => {
    load();
    try {
      const raw = localStorage.getItem(MANUAL_KEY);
      if (raw) setManual(JSON.parse(raw));
    } catch {
      /* stockage indisponible — les cases manuelles repartent vides */
    }
  }, []);

  const toggleManual = (id: string) => {
    setManual((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(MANUAL_KEY, JSON.stringify(next));
      } catch {
        /* idem */
      }
      return next;
    });
  };

  const path = useMemo(
    () =>
      buildPath({
        prospects,
        meetings,
        bookingUrl: settings.bookingUrl,
        health,
        dns,
        n8n,
        manual,
      }),
    [prospects, meetings, settings.bookingUrl, health, dns, n8n, manual]
  );

  const pct = Math.round((path.done / path.total) * 100);
  const hours = Math.round((path.minutesLeft / 60) * 10) / 10;

  // La prochaine étape s'ouvre d'elle-même : on ne demande pas un clic
  // pour savoir quoi faire.
  useEffect(() => {
    if (open === null && path.next) setOpen(path.next.id);
  }, [open, path.next]);

  return (
    <div className="space-y-4 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze-400">
            Une étape à la fois · dans l&apos;ordre
          </p>
          <h1 className="font-display text-2xl font-bold text-paper">Prise en main</h1>
        </div>
        <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Réévaluer
        </button>
      </header>

      {/* ── LA PROCHAINE ACTION ── */}
      {path.next ? (
        <section className="card border-bronze-700 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bronze-400">
                Maintenant · étape {path.nextIndex} sur {path.total}
              </p>
              <h2 className="mt-1 font-display text-xl font-extrabold text-paper">{path.next.title}</h2>
              <p className="mt-1 text-[13px] text-paper-dim">{path.next.why}</p>
              <ol className="mt-3 space-y-1.5">
                {path.next.how.map((h, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-paper">
                    <span className="mt-0.5 font-mono text-[11px] text-bronze-400">{i + 1}.</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-paper-faint">
                <Clock size={12} /> environ {path.next.minutes} min ·{" "}
                {path.next.auto ? "ALPHA le vérifie tout seul" : "à cocher toi-même"} · constaté :{" "}
                {path.next.detail}
              </p>
            </div>
            {path.next.href && (
              <Link href={path.next.href} className="btn-bronze shrink-0 px-4 py-2 text-[13px]">
                {path.next.hrefLabel ?? "Y aller"} <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="card flex items-center gap-3 border-signal-green/50 p-5">
          <Trophy size={28} className="shrink-0 text-signal-green" />
          <div>
            <p className="font-display text-lg font-extrabold text-paper">Le chemin est terminé.</p>
            <p className="text-[13px] text-paper-faint">
              La machine est branchée, chargée, lancée, et le rythme est tenu. À partir d&apos;ici il n&apos;y a plus
              d&apos;étapes — il y a des journées. Pilote chaque matin, Preuves chaque semaine.
            </p>
          </div>
        </section>
      )}

      {/* ── L'AVANCEMENT ── */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-paper">
            <span className="font-display text-lg font-bold text-paper">
              {path.done}/{path.total}
            </span>{" "}
            étapes · {pct} %
          </p>
          <p className="text-[12px] text-paper-faint">
            {path.minutesLeft > 0 ? `≈ ${hours} h de travail restant` : "plus rien à installer"}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-bronze-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {/* ── LES PHASES ── */}
      {path.phases.map((ph) => (
        <section key={ph.id} className="card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-paper">
              {ph.title}
              <span
                className={cn(
                  "ml-2 chip",
                  ph.done === ph.total ? "border-signal-green/50 text-signal-green" : "border-ink-700 text-paper-faint"
                )}
              >
                {ph.done}/{ph.total}
              </span>
            </h2>
            <p className="text-[11px] text-paper-faint">{ph.duration}</p>
          </div>
          <p className="mt-0.5 text-[12px] text-paper-dim">{ph.outcome}</p>

          <ul className="mt-3 space-y-1.5">
            {ph.steps.map((s) => (
              <StepRow
                key={s.id}
                step={s}
                open={open === s.id}
                onToggle={() => setOpen(open === s.id ? null : s.id)}
                onCheck={() => toggleManual(s.id)}
              />
            ))}
          </ul>
        </section>
      ))}

      {/* Ce que trouve un prospect qui cherche notre nom. Ça ne se coche pas
          tout seul — l'app n'a accès ni au site ni aux réseaux — mais ça se
          décide ici, avec le reste du démarrage. */}
      <SurfacePreuve />

      <p className="px-1 text-[11px] text-paper-faint">
        Les étapes marquées « vérifiée par ALPHA » se cochent toutes seules à partir de tes données réelles — elles ne
        peuvent pas mentir. Les autres dépendent de ta rigueur. Le détail complet du chemin est dans{" "}
        <code className="font-mono text-bronze-400">docs/DEMARRAGE.md</code>, la doctrine dans{" "}
        <code className="font-mono text-bronze-400">docs/BIBLE.md</code>.
      </p>
    </div>
  );
}

function StepRow({
  step,
  open,
  onToggle,
  onCheck,
}: {
  step: PathStep;
  open: boolean;
  onToggle: () => void;
  onCheck: () => void;
}) {
  return (
    <li className={cn("rounded-lg border bg-ink-850", open ? "border-bronze-700" : "border-ink-700")}>
      <button className="flex w-full items-center gap-2.5 p-3 text-left" onClick={onToggle}>
        {step.done ? (
          <CheckCircle2 size={16} className="shrink-0 text-signal-green" />
        ) : (
          <Circle size={16} className="shrink-0 text-paper-faint" />
        )}
        <span className="min-w-0 flex-1">
          <span className={cn("block text-[13px]", step.done ? "text-paper-faint line-through" : "text-paper")}>
            {step.title}
          </span>
          <span className="block text-[11px] text-paper-faint">
            {step.detail}
            {!step.auto && " · case manuelle"}
          </span>
          {step.progress !== undefined && step.progress < 1 && (
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-ink-800">
              <span
                className="block h-full rounded-full bg-bronze-600"
                style={{ width: `${Math.round(step.progress * 100)}%` }}
              />
            </span>
          )}
        </span>
        <ChevronDown size={14} className={cn("shrink-0 text-paper-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-ink-700 p-3 pt-2.5">
          <p className="text-[12px] text-paper-dim">{step.why}</p>
          <ol className="mt-2 space-y-1">
            {step.how.map((h, i) => (
              <li key={i} className="flex gap-2 text-[12px] text-paper">
                <span className="mt-0.5 font-mono text-[10px] text-bronze-400">{i + 1}.</span>
                <span>{h}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {step.href && (
              <Link href={step.href} className="btn-ghost px-2.5 py-1.5 text-[12px]">
                {step.hrefLabel ?? "Y aller"} <ArrowRight size={12} />
              </Link>
            )}
            {step.auto ? (
              <span className="chip border-ink-700 text-paper-faint">
                <Check size={11} /> vérifiée par ALPHA
              </span>
            ) : (
              <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={onCheck}>
                {step.done ? <RotateCcw size={12} /> : <Hand size={12} />}
                {step.done ? "Décocher" : "Je l'ai fait"}
              </button>
            )}
            <span className="chip border-ink-700 text-paper-faint">
              <Clock size={11} /> {step.minutes} min
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
