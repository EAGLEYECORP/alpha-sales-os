"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ear, Radio, ShieldAlert, Square, X } from "lucide-react";
import { matchAlarms, matchObjections, verticalById, type AssistMatch, type DoctrineAlarm } from "@/lib/live-assist";
import { useSpeech } from "@/components/voice/use-speech";
import { cn } from "@/lib/utils";

/**
 * ─────────────────────────────────────────────────────────────────────
 * Assistant d'appel en direct — tu parles, l'IA souffle.
 *
 * Pendant l'appel, l'assistant écoute et affiche la réponse du playbook
 * dès qu'une objection est prononcée. Aucun appel réseau, aucun modèle :
 * l'appariement est local et instantané. Une réponse qui arrive deux
 * secondes trop tard n'est pas une réponse.
 *
 * Il souffle aussi les alertes doctrine — le prix avant la démo, les €
 * perdus à froid, la note Google — parce que c'est là qu'on se tire une
 * balle dans le pied sans s'en rendre compte.
 *
 * Il n'adresse jamais la parole à l'interlocuteur : il ne relève donc
 * pas de l'obligation de divulgation de l'article 50 du règlement IA.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Fenêtre glissante analysée : les dernières secondes, pas tout l'appel. */
const WINDOW_CHARS = 260;

export function LiveAssist({
  verticalId,
  onClose,
}: {
  verticalId?: string | null;
  onClose?: () => void;
}) {
  const speech = useSpeech({ lang: "fr-FR", continuous: true });
  const [matches, setMatches] = useState<AssistMatch[]>([]);
  const [alarms, setAlarms] = useState<DoctrineAlarm[]>([]);
  // Ce qui a déjà été soufflé : on ne re-affiche pas la même chose en boucle.
  const seen = useRef<Set<string>>(new Set());

  const vertical = useMemo(() => verticalById(verticalId), [verticalId]);

  const heard = `${speech.transcript} ${speech.interim}`.slice(-WINDOW_CHARS);

  useEffect(() => {
    if (!heard.trim()) return;
    const found = matchObjections(heard, vertical);
    if (found.length) {
      setMatches((prev) => {
        const fresh = found.filter((f) => !prev.some((p) => p.id === f.id));
        return fresh.length ? [...fresh, ...prev].slice(0, 4) : prev;
      });
    }
    const al = matchAlarms(heard).filter((a) => !seen.current.has(a.id));
    if (al.length) {
      for (const a of al) seen.current.add(a.id);
      setAlarms((prev) => [...al, ...prev].slice(0, 3));
    }
  }, [heard, vertical]);

  const clear = () => {
    setMatches([]);
    setAlarms([]);
    seen.current.clear();
    speech.reset();
  };

  return (
    <section className="card border-bronze-700 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Ear size={15} className="text-bronze-400" /> Assistant d&apos;appel
          {speech.listening && (
            <span className="chip border-signal-red/50 text-signal-red">
              <Radio size={11} className="animate-pulse" /> à l&apos;écoute
            </span>
          )}
          {vertical && <span className="chip border-ink-700 text-paper-faint">{vertical.label}</span>}
        </h2>
        <div className="flex gap-2">
          <button
            className={cn("px-3 py-1.5 text-[12px]", speech.listening ? "btn-danger" : "btn-bronze")}
            onClick={speech.listening ? speech.stop : speech.start}
          >
            {speech.listening ? <Square size={13} /> : <Ear size={13} />}
            {speech.listening ? "Arrêter" : "Écouter"}
          </button>
          <button className="btn-ghost px-2.5 py-1.5 text-[12px]" onClick={clear}>
            Vider
          </button>
          {onClose && (
            <button className="btn-ghost px-2 py-1.5 text-[12px]" onClick={onClose} aria-label="Fermer">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {speech.supported === false && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-signal-amber">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Ce navigateur ne sait pas transcrire. Chrome ou Edge le savent — sinon, le script complet reste au-dessus.
        </p>
      )}
      {speech.error && <p className="mt-2 text-[12px] text-signal-red">{speech.error}</p>}

      {!speech.listening && matches.length === 0 && alarms.length === 0 && (
        <p className="mt-2 text-[12px] text-paper-faint">
          Lance l&apos;écoute avant de composer. Dès qu&apos;une objection est prononcée — la sienne ou la tienne —
          la réponse du playbook s&apos;affiche ici. L&apos;assistant n&apos;émet aucun son : il ne parle qu&apos;à
          toi.
        </p>
      )}

      {alarms.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {alarms.map((a) => (
            <li key={a.id} className="flex items-start gap-2 rounded-lg border border-signal-red/40 bg-ink-850 p-2.5">
              <ShieldAlert size={14} className="mt-0.5 shrink-0 text-signal-red" />
              <div>
                <p className="text-[13px] font-medium text-signal-red">{a.label}</p>
                <p className="text-[12px] text-paper">{a.fix}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {matches.length > 0 && (
        <ul className="mt-3 space-y-2">
          {matches.map((m) => (
            <li key={m.id} className="rounded-lg border border-ink-700 bg-ink-850 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[12px] font-medium text-bronze-300">{m.label}</p>
                <span className="chip border-ink-700 text-[10px] text-paper-faint">{m.source}</span>
                {m.belief && (
                  <span className="chip border-ink-700 text-[10px] text-paper-faint">croyance {m.belief}</span>
                )}
              </div>
              <p className="mt-1 text-[14px] leading-snug text-paper">{m.answer}</p>
            </li>
          ))}
        </ul>
      )}

      {speech.listening && (
        <p className="mt-3 line-clamp-2 border-t border-ink-700 pt-2 font-mono text-[11px] text-paper-faint">
          {heard.trim() || "…"}
        </p>
      )}
    </section>
  );
}
