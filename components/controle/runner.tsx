"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Check, ChevronRight, CircleStop, Loader2, Pause, Phone, Play, RotateCcw, ShieldAlert, SkipForward, Zap,
} from "lucide-react";
import type { CallTask } from "@/lib/campaign-runner";
import { cn } from "@/lib/utils";
import { useAlpha } from "@/lib/store";
import { validerPrompt } from "@/lib/prompts";

/**
 * ─────────────────────────────────────────────────────────────────────
 * LE RUNNER — le bouton qui fait partir les appels.
 *
 * Deux modes, parce qu'ils servent deux moments différents :
 *   · MANUEL  — un appel à la fois, tu vois QUI et POURQUOI avant de lancer.
 *               C'est le mode d'apprentissage et de contrôle. Raccourcis
 *               clavier : Entrée = appeler, S = passer, Échap = arrêter.
 *   · AUTO    — la file s'enchaîne toute seule, avec une pause entre chaque
 *               appel. C'est le mode volume, une fois que tu as vu la file
 *               tourner et que tu lui fais confiance.
 *
 * Principes d'UX, empruntés aux outils qui font bien ça :
 *   1. ARMEMENT EXPLICITE — rien ne part sans un écran qui dit combien
 *      d'appels, vers qui, et à quel coût. Un lancement accidentel de 30
 *      appels ne se rattrape pas.
 *   2. INTERRUPTION INSTANTANÉE — le bouton d'arrêt est toujours visible et
 *      toujours au même endroit. Il stoppe AVANT l'appel suivant, jamais
 *      pendant celui en cours.
 *   3. AUCUN ÉTAT CACHÉ — chaque ligne montre son résultat réel (parti,
 *      refusé + raison, erreur). On ne dit jamais « terminé » sur un échec.
 *   4. LE REFUS EST UNE INFORMATION — un appel bloqué par la conformité
 *      affiche POURQUOI, et ce n'est pas une erreur : c'est le système qui
 *      fait son travail.
 * ─────────────────────────────────────────────────────────────────────
 */

type RunnerState = "repos" | "arme" | "en-cours" | "pause" | "termine";
type CallState = "attente" | "en-cours" | "parti" | "refuse" | "erreur";

interface CallResult {
  state: CallState;
  detail?: string;
  room?: string;
}

/** Pause entre deux appels en mode auto — laisse le temps de couper. */
const AUTO_DELAY_MS = 4000;

export function CampaignRunner({
  queue,
  windowOpen,
  windowWhy,
  accountId,
  agencyName,
}: {
  queue: CallTask[];
  windowOpen: boolean;
  windowWhy: string;
  accountId?: string;
  agencyName: string;
}) {
  /**
   * La trame d'appel à froid éditée dans /prompts.
   *
   * ⚠ On ne l'envoie QUE si elle passe encore ses invariants. Le serveur
   * revérifie et refuse en 422 de toute façon — mais envoyer sciemment une
   * trame invalide ferait échouer l'appel au lieu de retomber proprement sur
   * le texte livré. Absente = le serveur prend `CORPS_APPEL_FROID`.
   */
  const trameFroide = useAlpha((s) => {
    const m = (s.settings.prompts ?? []).find((p) => p.id === "voix-froid");
    if (!m?.texte.trim()) return undefined;
    return validerPrompt("voix-froid", m.texte).ok ? m.texte : undefined;
  });

  const [state, setState] = useState<RunnerState>("repos");
  const [mode, setMode] = useState<"manuel" | "auto">("manuel");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, CallResult>>({});
  const [force, setForce] = useState(false);

  // Refs : la boucle auto lit l'état le plus frais sans se relancer à chaque
  // rendu (sinon on déclenche deux appels pour le même prospect).
  const stopRef = useRef(false);
  const busyRef = useRef(false);

  const current = queue[index];
  const done = index >= queue.length;

  const setResult = (id: string, r: CallResult) => setResults((p) => ({ ...p, [id]: r }));

  /** Lance UN appel. Renvoie true si l'appel est effectivement parti. */
  const fireOne = useCallback(
    async (task: CallTask): Promise<boolean> => {
      setResult(task.prospectId, { state: "en-cours" });
      try {
        const res = await fetch("/api/voice/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "prospection-b2b",
            phone: task.phone,
            company: task.company,
            onBehalfOf: agencyName,
            prospectBrief: task.brief,
            /**
             * La trame éditée dans /prompts, si elle existe ET si elle est
             * encore conforme. `texteEffectif` retombe sur le texte livré
             * quand la version modifiée a perdu un invariant — et le serveur
             * revérifie de toute façon (422).
             */
            corpsFroid: trameFroide,
            prospectId: task.prospectId,
            accountId: task.accountId,
            /**
             * ⚠ SANS CETTE LIGNE, LE BRIEF ET LE RÔLE SE CONTREDISAIENT.
             *
             * `task.brief` porte « Offre pertinente : … » depuis toujours,
             * mais l'offre elle-même ne voyageait pas — et le script sortant
             * annonçait l'angle voix en dur. Sur une fiche routée vers la
             * visibilité, l'agent recevait deux offres différentes dans le
             * même prompt et tranchait tout seul, en direct.
             */
            offre: task.offre,
            isProfessional: true,
            optedOut: false,
            force,
          }),
        });
        const data = (await res.json()) as Record<string, unknown>;

        if (!res.ok) {
          // 422 = conformité, 409 = hors fenêtre. Ce ne sont PAS des bugs :
          // c'est le système qui protège. On l'affiche comme tel.
          const detail =
            (data.error as string) ??
            (Array.isArray(data.blockers) ? (data.blockers as string[]).join(" ") : "refusé");
          setResult(task.prospectId, { state: "refuse", detail });
          return false;
        }
        if (data.dispatched === false) {
          setResult(task.prospectId, { state: "refuse", detail: (data.reason as string) ?? "non déclenché" });
          return false;
        }
        setResult(task.prospectId, { state: "parti", room: data.room as string });
        return true;
      } catch (e) {
        setResult(task.prospectId, { state: "erreur", detail: e instanceof Error ? e.message : "réseau" });
        return false;
      }
    },
    [agencyName, force]
  );

  /** Mode manuel : un appel, puis on avance d'un cran. */
  const callCurrent = async () => {
    if (!current || busyRef.current) return;
    busyRef.current = true;
    await fireOne(current);
    busyRef.current = false;
    setIndex((i) => i + 1);
  };

  const skip = () => setIndex((i) => i + 1);

  const stop = () => {
    stopRef.current = true;
    setState("pause");
  };

  const reset = () => {
    stopRef.current = false;
    setIndex(0);
    setResults({});
    setState("repos");
  };

  // ── Boucle AUTO ──
  useEffect(() => {
    if (state !== "en-cours" || mode !== "auto") return;
    let alive = true;

    (async () => {
      while (alive && !stopRef.current) {
        // On relit la position courante à chaque tour via le setter :
        // impossible de lancer deux fois le même appel.
        let task: CallTask | undefined;
        setIndex((i) => {
          task = queue[i];
          return i;
        });
        await new Promise((r) => setTimeout(r, 0));
        if (!task) break;

        busyRef.current = true;
        await fireOne(task);
        busyRef.current = false;
        if (!alive || stopRef.current) break;

        setIndex((i) => i + 1);
        // Fenêtre d'interruption : c'est ici que l'arrêt est pris en compte.
        await new Promise((r) => setTimeout(r, AUTO_DELAY_MS));
      }
      if (alive) setState((s) => (s === "en-cours" ? "termine" : s));
    })();

    return () => {
      alive = false;
    };
  }, [state, mode, queue, fireOne]);

  useEffect(() => {
    if (state === "en-cours" && mode === "manuel" && done) setState("termine");
  }, [done, state, mode]);

  // ── Raccourcis clavier (mode manuel) ──
  useEffect(() => {
    if (state !== "en-cours" || mode !== "manuel") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Enter") {
        e.preventDefault();
        void callCurrent();
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        skip();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        stop();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, mode, current]);

  const counts = Object.values(results).reduce(
    (acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }),
    {} as Record<CallState, number>
  );

  if (queue.length === 0) {
    return (
      <p className="rounded-xl border border-line/50 bg-surface/30 px-3 py-2 text-[11.5px] text-paper-faint">
        Rien à lancer : la file est vide.
      </p>
    );
  }

  // ── ÉCRAN D'ARMEMENT — rien ne part sans passer par là ──
  if (state === "repos" || state === "arme") {
    return (
      <div className="rounded-xl border border-bronze-700/50 bg-bronze-900/10 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Zap size={15} className="text-bronze-400" />
          <span className="font-display text-[13px] font-semibold text-paper">
            {queue.length} appel(s) prêt(s) à partir
          </span>
        </div>

        <p className="mt-1.5 text-[11.5px] text-paper-dim">
          Vers {queue.slice(0, 3).map((t) => t.company).join(", ")}
          {queue.length > 3 ? ` et ${queue.length - 3} autre(s)` : ""}. Chaque appel part avec SON script,
          construit sur le deep-dive de sa fiche.
        </p>

        {!windowOpen && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-signal-amber/40 bg-signal-amber/5 px-3 py-2">
            <ShieldAlert size={13} className="mt-0.5 shrink-0 text-signal-amber" />
            <div className="text-[11.5px]">
              <p className="text-signal-amber">Fenêtre fermée — {windowWhy}</p>
              <label className="mt-1 flex items-center gap-1.5 text-paper-dim">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
                Forcer quand même (geste explicite, journalisé)
              </label>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-line/60">
            {(["manuel", "auto"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 text-[12px] transition-colors",
                  mode === m ? "bg-bronze-600 text-paper" : "text-paper-faint hover:text-paper"
                )}
              >
                {m === "manuel" ? "Manuel" : "Automatique"}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              stopRef.current = false;
              setState("en-cours");
            }}
            disabled={!windowOpen && !force}
            className="btn-bronze flex items-center gap-1.5 text-[12.5px] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play size={13} />
            {mode === "manuel" ? "Démarrer (un par un)" : `Lancer les ${queue.length} appels`}
          </button>
        </div>

        <p className="mt-2 text-[11px] text-paper-faint">
          {mode === "manuel"
            ? "Tu valides chaque appel. Raccourcis : Entrée = appeler · S = passer · Échap = arrêter."
            : `La file s'enchaîne seule, ${AUTO_DELAY_MS / 1000} s entre chaque appel. Tu peux couper à tout moment.`}
        </p>
      </div>
    );
  }

  // ── EN COURS / PAUSE / TERMINÉ ──
  return (
    <div className="rounded-xl border border-line/60 bg-surface/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {state === "en-cours" ? (
          <Loader2 size={14} className="animate-spin text-bronze-400" />
        ) : state === "pause" ? (
          <Pause size={14} className="text-signal-amber" />
        ) : (
          <Check size={14} className="text-signal-green" />
        )}
        <span className="font-display text-[13px] font-semibold text-paper">
          {state === "termine" ? "File terminée" : state === "pause" ? "En pause" : `Appel ${Math.min(index + 1, queue.length)} / ${queue.length}`}
        </span>
        <span className="ml-auto flex items-center gap-2 text-[11px]">
          {counts.parti ? <span className="text-signal-green">{counts.parti} parti(s)</span> : null}
          {counts.refuse ? <span className="text-signal-amber">{counts.refuse} refusé(s)</span> : null}
          {counts.erreur ? <span className="text-signal-red">{counts.erreur} erreur(s)</span> : null}
        </span>
      </div>

      {/* Progression */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-850">
        <div
          className="h-full rounded-full bg-bronze-500 transition-all"
          style={{ width: `${Math.round((index / queue.length) * 100)}%` }}
        />
      </div>

      {/* La carte de l'appel courant — mode manuel */}
      {state === "en-cours" && mode === "manuel" && current && (
        <div className="mt-3 rounded-xl border border-bronze-700/50 bg-bronze-900/10 p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <Link href={`/prospects/${current.prospectId}`} className="font-display text-[14px] font-semibold text-paper hover:text-bronze-400">
              {current.company}
            </Link>
            <span className="font-mono text-[12px] text-bronze-400">{current.phone}</span>
            {current.recallIndex > 0 && (
              <span className="rounded-full bg-bronze-900/30 px-1.5 py-0.5 text-[10.5px] text-bronze-300">
                rappel {current.recallIndex + 1}/5
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-paper-dim">→ {current.objective}</p>
          {current.mustCapture.length > 0 && (
            <p className="mt-0.5 text-[11px] text-signal-amber">À récolter : {current.mustCapture.join(" · ")}</p>
          )}
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[11px] text-bronze-400">Voir le brief envoyé à l&apos;agent</summary>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-paper-faint">
              {current.brief}
            </pre>
          </details>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={callCurrent} className="btn-bronze flex items-center gap-1.5 text-[12.5px]">
              <Phone size={13} /> Appeler <kbd className="ml-1 opacity-60">↵</kbd>
            </button>
            <button onClick={skip} className="btn-ghost flex items-center gap-1.5 text-[12.5px]">
              <SkipForward size={13} /> Passer <kbd className="ml-1 opacity-60">S</kbd>
            </button>
          </div>
        </div>
      )}

      {/* Barre de contrôle — toujours au même endroit */}
      <div className="mt-3 flex flex-wrap gap-2">
        {state === "en-cours" && (
          <button onClick={stop} className="btn-ghost flex items-center gap-1.5 text-[12.5px] text-signal-red">
            <CircleStop size={13} /> Arrêter {mode === "manuel" && <kbd className="opacity-60">Échap</kbd>}
          </button>
        )}
        {state === "pause" && (
          <button
            onClick={() => {
              stopRef.current = false;
              setState("en-cours");
            }}
            className="btn-bronze flex items-center gap-1.5 text-[12.5px]"
          >
            <Play size={13} /> Reprendre
          </button>
        )}
        {(state === "pause" || state === "termine") && (
          <button onClick={reset} className="btn-ghost flex items-center gap-1.5 text-[12.5px]">
            <RotateCcw size={13} /> Recommencer
          </button>
        )}
      </div>

      {/* Journal — chaque ligne dit ce qui s'est RÉELLEMENT passé */}
      <ul className="mt-3 max-h-56 space-y-1 overflow-auto">
        {queue.slice(0, index + 1).map((t) => {
          const r = results[t.prospectId];
          if (!r) return null;
          return (
            <li key={t.prospectId} className="flex items-start gap-1.5 text-[11.5px]">
              {r.state === "parti" ? (
                <Check size={12} className="mt-0.5 shrink-0 text-signal-green" />
              ) : r.state === "refuse" ? (
                <ShieldAlert size={12} className="mt-0.5 shrink-0 text-signal-amber" />
              ) : r.state === "erreur" ? (
                <AlertTriangle size={12} className="mt-0.5 shrink-0 text-signal-red" />
              ) : (
                <ChevronRight size={12} className="mt-0.5 shrink-0 text-paper-faint" />
              )}
              <span>
                <span className="text-paper-dim">{t.company}</span>
                {r.detail && <span className="text-paper-faint"> — {r.detail}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
