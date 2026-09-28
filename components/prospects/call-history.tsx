"use client";

import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import {
  durationSec, formatDuration, transcriptText, extractInsights, type CallSession,
} from "@/lib/call-log";
import { cn } from "@/lib/utils";

/**
 * L'historique de conversation d'un prospect — les transcriptions de tous ses
 * appels. C'est cette matière qui est réinjectée dans le brief du prochain
 * appel : l'agent sait ce qui s'est déjà dit et ne le fait pas répéter.
 */
export function CallHistory({ prospectId }: { prospectId: string }) {
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [state, setState] = useState<"chargement" | "ok" | "indisponible">("chargement");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/voice/session?prospectId=${encodeURIComponent(prospectId)}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { sessions?: CallSession[] };
        if (!alive) return;
        setSessions(j.sessions ?? []);
        setState("ok");
      } catch {
        // Journal injoignable : on le dit, on ne fait pas semblant d'être vide.
        if (alive) setState("indisponible");
      }
    })();
    return () => {
      alive = false;
    };
  }, [prospectId]);

  if (state === "chargement") {
    return (
      <section className="card p-4">
        <p className="flex items-center gap-2 text-[12px] text-paper-faint">
          <Loader2 size={13} className="animate-spin" /> Chargement de l&apos;historique d&apos;appels…
        </p>
      </section>
    );
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
        <History size={15} className="text-bronze-400" /> Historique de conversation
        {sessions.length > 0 && (
          <span className="text-[11px] font-normal text-paper-faint">{sessions.length} appel(s)</span>
        )}
      </h2>

      {state === "indisponible" ? (
        <p className="text-[11.5px] text-signal-amber">
          Journal d&apos;appels injoignable — configure <code className="font-mono">ALPHA_SESSION_URL</code> et{" "}
          <code className="font-mono">VOICE_WEBHOOK_SECRET</code> côté agent vocal.
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-[11.5px] text-paper-faint">
          Aucun appel enregistré. Dès qu&apos;Alpha Voice parle à ce prospect, la transcription
          apparaît ici et nourrit le brief du prochain appel.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const insights = extractInsights(s);
            const open = openId === s.id;
            return (
              <li key={s.id} className="rounded-xl border border-line/50 bg-surface/30 p-3">
                <button
                  onClick={() => setOpenId(open ? null : s.id)}
                  className="flex w-full flex-wrap items-center gap-2 text-left"
                >
                  <span className="text-[12px] text-paper">
                    {new Date(s.startedAt).toLocaleString("fr-FR")}
                  </span>
                  <span className="rounded-full bg-bronze-900/25 px-1.5 py-0.5 text-[10.5px] text-bronze-300">
                    {s.direction}
                  </span>
                  <span className="font-mono text-[11px] text-paper-faint">
                    {formatDuration(durationSec(s))}
                  </span>
                  <span className="text-[11px] text-paper-faint">{s.turns.length} tours</span>
                  {s.outcome && (
                    <span
                      className={cn(
                        "text-[10.5px]",
                        s.outcome === "repondu" ? "text-signal-green" : "text-paper-faint"
                      )}
                    >
                      {s.outcome}
                    </span>
                  )}
                </button>

                {insights.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {insights.map((i, n) => (
                      <li key={n} className="text-[11px] text-signal-amber">
                        <strong className="uppercase">{i.kind}</strong> — « {i.quote} »
                      </li>
                    ))}
                  </ul>
                )}

                {open && (
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap border-t border-line/40 pt-2 text-[11px] leading-relaxed text-paper-dim">
                    {transcriptText(s) || "Aucune transcription."}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
