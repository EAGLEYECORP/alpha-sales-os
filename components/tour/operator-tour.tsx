"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  ClipboardCheck,
  Gauge,
  Kanban,
  Mail,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlpha } from "@/lib/store";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Visite guidée de l'opérateur — le 3e temps de l'onboarding.
 *
 *   1. L'assistant (setup-wizard) BRANCHE le système.
 *   2. La Recette (/recette) PROUVE que la boucle tourne.
 *   3. Cette visite APPREND à l'opérer : elle navigue de vraie page en
 *      vraie page et enseigne, pour chacune, à quoi elle sert et les
 *      gestes qui comptent — la « journée type » d'INSTALLATION.md,
 *      directement dans l'app. Pensée pour former un employé.
 *
 * S'ouvre une fois (après l'assistant), se relance depuis Réglages.
 * ─────────────────────────────────────────────────────────────────────
 */

export function openOperatorTour() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("alpha:open-tour"));
}

const DONE_KEY = "alpha_tour_done";

interface Stop {
  href: string;
  icon: React.ElementType;
  title: string;
  what: string;
  moves: string[];
}

const STOPS: Stop[] = [
  {
    href: "/",
    icon: BarChart3,
    title: "Dashboard — ton poste de pilotage",
    what: "Tout ce qui compte au réveil : les Routines (ta to-do générée automatiquement), le pipe pondéré, le prochain rendez-vous.",
    moves: [
      "Chaque matin : Routines, du haut vers le bas — urgent d'abord",
      "Chaque ligne est cliquable vers l'action à faire",
      "Bandeau rouge « info critique manquante » = à obtenir aujourd'hui",
    ],
  },
  {
    href: "/pipeline",
    icon: Kanban,
    title: "Pipeline — le cycle de vente",
    what: "Tes prospects avancent par étapes : prospect → contact → audit → démo → offre → redzone → signé. La doctrine verrouille les raccourcis.",
    moves: [
      "Clique une carte = la fiche 360° (historique, fichiers, paiements, next step)",
      "Chaque contact finit par un next step DATÉ — l'app refuse sans",
      "Jamais de prix par écrit avant la démo — c'est la règle",
    ],
  },
  {
    href: "/campaigns",
    icon: Mail,
    title: "Campagnes — envoyer et écouter",
    what: "Préparer une campagne, RELIRE chaque message (rien ne part sans toi), suivre les ouvertures/clics, traiter les réponses.",
    moves: [
      "« Réviser & envoyer » : relis CHAQUE brouillon — l'IA propose, tu disposes",
      "Réponses entrantes : un répondant se rappelle sous 24 h",
      "Tracking par client et par industrie = ce qui marche, où",
    ],
  },
  {
    href: "/templates",
    icon: ScrollText,
    title: "Templates — les scripts par étape",
    what: "Les scripts doctrine pour chaque étape du pipeline, plus « Mes scripts » pour capitaliser tes propres formulations gagnantes.",
    moves: [
      "Un script par étape : le bon message au bon moment",
      "Une formulation qui convertit ? Sauvegarde-la dans « Mes scripts »",
    ],
  },
  {
    href: "/kpis",
    icon: Gauge,
    title: "KPIs — la ligne dorée",
    what: "Tes taux (délivré, ouvert, réponse, RDV, signé) comparés aux cibles du RUNBOOK. C'est ici que le vendredi se passe.",
    moves: [
      "Sous la cible → on revoit le MESSAGE, jamais le volume d'abord",
      "Réponse ≥ 5 % = le feu vert du checkpoint 100",
    ],
  },
  {
    href: "/agent",
    icon: Bot,
    title: "Agent ALPHA — ton coach",
    what: "L'IA locale (ou les templates hors-ligne) : rédiger, recadrer une objection, préparer un audit, résumer une fiche.",
    moves: [
      "Demande : « prépare ma journée », « recadre cette objection »",
      "L'IA ne décide de rien : elle prépare, tu tranches",
    ],
  },
  {
    href: "/recette",
    icon: ClipboardCheck,
    title: "Recette — prouver avant de lancer",
    what: "Le test de la boucle complète en conditions réelles : envoi, ouverture, clic, réponse, STOP — voyant par voyant, jusqu'au GOOD TO GO.",
    moves: [
      "À refaire après tout gros changement (SMTP, n8n, déploiement)",
      "Tout vert = tu peux lancer ; un voyant gris = son diagnostic est affiché",
    ],
  },
  {
    href: "/settings",
    icon: Settings,
    title: "Réglages — la salle des machines",
    what: "État du système (ce qui est configuré), connexion n8n, Supabase, dictionnaire des variables CRM, import/export.",
    moves: [
      "« État du système » : tout doit être vert après installation",
      "L'assistant et cette visite se relancent d'ici",
      "Bonne chasse 🦅 — la valeur vient des répétitions, pas des réglages",
    ],
  },
];

export function OperatorTour() {
  const { settings } = useAlpha();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  // Ouverture auto, UNE fois : après l'assistant (onboarded), jamais pendant.
  useEffect(() => {
    if (!settings.onboarded) return;
    try {
      if (!window.localStorage.getItem(DONE_KEY)) {
        const t = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      /* stockage indisponible → pas d'auto-ouverture */
    }
  }, [settings.onboarded]);

  // Relance manuelle (Réglages).
  useEffect(() => {
    const h = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("alpha:open-tour", h);
    return () => window.removeEventListener("alpha:open-tour", h);
  }, []);

  const finish = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(DONE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
  }, []);

  const go = useCallback(
    (n: number) => {
      const next = Math.min(Math.max(n, 0), STOPS.length - 1);
      setI(next);
      if (pathname !== STOPS[next].href) router.push(STOPS[next].href);
    },
    [pathname, router]
  );

  // À l'ouverture, s'aligner sur la 1re étape.
  useEffect(() => {
    if (open && pathname !== STOPS[i].href) router.push(STOPS[i].href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const stop = STOPS[i];
  const Icon = stop.icon;
  const last = i === STOPS.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-4 md:justify-end md:p-6">
      <div className="card pointer-events-auto w-full max-w-md border-bronze-700/60 p-4 shadow-2xl animate-fade-up">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-bronze-700 bg-bronze-900/20 text-bronze-400">
              <Icon size={17} />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-faint">
                Visite guidée · {i + 1}/{STOPS.length}
              </p>
              <h3 className="font-display text-[14.5px] font-bold text-paper">{stop.title}</h3>
            </div>
          </div>
          <button
            onClick={finish}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-paper-faint hover:bg-ink-800 hover:text-paper"
            aria-label="Fermer la visite"
          >
            <X size={14} />
          </button>
        </div>

        <p className="mt-2.5 text-[12.5px] leading-relaxed text-paper-dim">{stop.what}</p>
        <ul className="mt-2 space-y-1">
          {stop.moves.map((m) => (
            <li key={m} className="flex items-start gap-1.5 text-[12px] text-paper-faint">
              <span className="mt-0.5 text-bronze-400">›</span>
              <span>{m}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3.5 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STOPS.map((s, j) => (
              <button
                key={s.href}
                onClick={() => go(j)}
                aria-label={`Étape ${j + 1}`}
                className={cn("h-1.5 rounded-full transition-all", j === i ? "w-5 bg-gold" : "w-1.5 bg-ink-600 hover:bg-ink-500")}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={() => go(i - 1)}>
                <ArrowLeft size={13} /> Retour
              </button>
            )}
            {last ? (
              <button className="btn-bronze px-3 py-1.5 text-[12px]" onClick={finish}>
                Terminer 🦅
              </button>
            ) : (
              <button className="btn-bronze px-3 py-1.5 text-[12px]" onClick={() => go(i + 1)}>
                Suivant <ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
