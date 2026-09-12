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
  Laptop,
  Hand,
  RefreshCw,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { useDroits } from "@/lib/use-droits";
import { n8nConnected } from "@/lib/n8n";
import { buildPath, repartirParSurface, type PathStep } from "@/lib/onboarding-path";
import { lireRapportDns, type EtatDns } from "@/lib/deliverability-dns";
import { SurfacePreuve } from "@/components/demarrage/surface-preuve";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

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
  const [dns, setDns] = useState<EtatDns | null>(null);
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
        // `r.json()` rend `any` : c'est par là que `undefined` est arrivé à
        // l'écran. On passe par le lecteur typé, au bord.
        .then((j) => setDns(j === null ? null : lireRapportDns(j)))
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

  const droits = useDroits();

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
        /**
         * ⚠ Le parcours déroulait les seize étapes à tout le monde. Un compte
         * gratuit (`crm · closer · cerveau · pilotage`) commençait donc par
         * « brancher le SMTP », « publier SPF/DKIM », « connecter n8n » — des
         * variables d'environnement du SERVEUR qu'il ne peut pas poser, pour
         * des briques qu'il n'a pas. Sa première impression du produit était
         * une liste de portes fermées.
         */
        bricks: droits.bricks,
        maitre: droits.maitre,
        // Sans lui, la toute première étape ne peut pas se vérifier.
        agencyName: settings.agencyName,
      }),
    [prospects, meetings, settings.bookingUrl, settings.agencyName, health, dns, n8n, manual, droits.bricks, droits.maitre]
  );

  // Ce qui se fait d'ici, et ce qui attend une machine. Le calcul est pur
  // et vit dans `lib/` : l'écran ne décide rien, il rend.
  const mobile = repartirParSurface(path);
  const pct = Math.round((path.done / path.total) * 100);
  const hours = Math.round((path.minutesLeft / 60) * 10) / 10;

  // La prochaine étape s'ouvre d'elle-même : on ne demande pas un clic
  // pour savoir quoi faire.
  useEffect(() => {
    if (open === null && path.next) setOpen(path.next.id);
  }, [open, path.next]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Une étape à la fois · dans l'ordre"
        title="Prise en main"
        actions={
          <button className="btn-ghost px-3 py-1.5 text-[12px]" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Réévaluer
          </button>
        }
      />

      {/* ──────────────────────────────────────────────────────────────
          DEPUIS CE TÉLÉPHONE — le bloc qui manquait, et il passe AVANT
          la prochaine action générale.

          ⚠⚠ POURQUOI AVANT, et pas plus bas. La « prochaine action » est
          la première étape non faite du parcours, dans l'ordre. Sur un
          compte neuf, c'est « Brancher l'envoi email » — dont le premier
          geste est « colle-le dans .env.local ». Sur un téléphone, ce
          geste n'existe pas. Le grand encadré bronze en haut de l'écran
          servait donc un mur à quiconque s'inscrivait depuis son mobile,
          et rien ne lui apprenait que treize étapes sur dix-huit se font
          très bien au pouce.

          ⚠ Il est `md:hidden` : sur un ordinateur, toutes les étapes sont
          faisables et ce bloc n'aurait rien à dire. Une section qui
          répète l'évidence use la confiance du lecteur sur celles qui
          disent quelque chose.
          ────────────────────────────────────────────────────────────── */}
      <section className="card p-4 md:hidden">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bronze-400">
          Depuis ce téléphone
        </p>
        {mobile.prochaineAuPouce ? (
          <>
            <h2 className="mt-1 font-display text-lg font-extrabold text-paper">
              {mobile.prochaineAuPouce.title}
            </h2>
            <p className="mt-1 text-[13px] text-paper-dim">{mobile.prochaineAuPouce.why}</p>
            <ol className="mt-3 space-y-1.5">
              {mobile.prochaineAuPouce.how.map((h, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-paper">
                  <span className="mt-0.5 font-mono text-[11px] text-bronze-400">{i + 1}.</span>
                  <span>{h}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {mobile.prochaineAuPouce.href && (
                <Link href={mobile.prochaineAuPouce.href} className="btn-bronze px-4 py-2 text-[13px]">
                  {mobile.prochaineAuPouce.hrefLabel ?? "Y aller"} <ArrowRight size={14} />
                </Link>
              )}
              <span className="text-[11px] text-paper-faint">
                {mobile.auPouce.length} étape{mobile.auPouce.length > 1 ? "s" : ""} faisable
                {mobile.auPouce.length > 1 ? "s" : ""} d&apos;ici
              </span>
            </div>
          </>
        ) : (
          /* ⚠⚠ « RIEN À FAIRE ICI » ET « TU AS FINI » NE SE DISENT PAS PAREIL.
             Un écran vide se lirait « terminé » — le même mode de panne que le
             moniteur qui affiche du calme quand la base est injoignable. */
          <p className="mt-1 text-[13px] text-paper-dim">
            {mobile.bloqueSurMobile
              ? "Tout ce qui se fait au pouce est fait. Ce qui reste demande un ordinateur — la liste est juste en dessous, avec la raison de chacune."
              : "Plus rien à installer, ni ici ni ailleurs."}
          </p>
        )}

        {mobile.surOrdinateur.length > 0 && (
          <div className="panel mt-4 p-3">
            <p className="text-[11px] font-semibold text-paper-dim">
              <Laptop size={12} className="mr-1 inline" />
              {mobile.surOrdinateur.length} étape{mobile.surOrdinateur.length > 1 ? "s" : ""} t&apos;attend
              {mobile.surOrdinateur.length > 1 ? "ent" : ""} devant un ordinateur
            </p>
            {/* ⚠ ON LES LISTE, ON NE LES CACHE PAS. Filtrer donnerait un écran
                propre et un parcours qui se termine en croyant avoir tout
                installé — alors que les emails ne peuvent pas partir. */}
            <ul className="mt-2 space-y-2">
              {mobile.surOrdinateur.map((s) => (
                <li key={s.id} className="text-[12px]">
                  <span className="text-paper">{s.title}</span>
                  <span className="block text-[11px] leading-snug text-paper-faint">{s.motifSurface}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── LA PROCHAINE ACTION ──
          ⚠ `hidden md:block` — VU AU RENDU, JAMAIS DÉDUIT. Sur un téléphone,
          cet encadré et le bloc « Depuis ce téléphone » ci-dessus affichaient
          LA MÊME ÉTAPE l'un sous l'autre dès que la prochaine action était
          faisable au pouce, c'est-à-dire la plupart du temps. Deux cartes
          identiques ne se lisent pas comme une redite : elles se lisent comme
          un bug, et on cherche ce qui les distingue. Le bloc mobile couvre
          déjà les deux cas — une action à faire, ou plus rien. */}
      {path.next ? (
        <section className="card hidden border-bronze-700 p-5 md:block">
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
        <section className="card hidden items-center gap-3 border-signal-green/50 p-5 md:flex">
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
        {/*
          On COMPTE ce qui est masqué au lieu de le faire disparaître : un
          parcours raccourci sans explication donne l'impression d'un produit
          minuscule, et personne ne sait qu'il existe une suite. Même doctrine
          que /controle, qui montre la porte fermée.
        */}
        {path.verrouillees > 0 && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-paper-faint">
            {path.verrouillees} étape(s) d&apos;installation ne sont pas affichées : elles servent des briques que ce
            compte n&apos;a pas encore (envoi de campagnes, agent vocal, tracking).{" "}
            <Link href="/compte" className="text-bronze-400 hover:underline">
              Voir ce qui est ouvert
            </Link>
          </p>
        )}
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
