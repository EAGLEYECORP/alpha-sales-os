"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dumbbell, Flame, Send, Sparkles, Trophy, X } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { useAlpha } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Msg {
  role: "closer" | "prospect";
  text: string;
  coach?: string;
}

/**
 * Sparring — le prospect est joué par l'IA. Tu t'entraînes à décrocher
 * l'audit AVANT le vrai rendez-vous. Un coach commente chaque réponse.
 */
export function Sparring({ p, onClose }: { p: Prospect; onClose: () => void }) {
  const { settings, logActivity } = useAlpha();
  const opener = p.objections.find((o) => o.status !== "traitee")?.label ?? "Bof, j'ai pas vraiment le temps là.";
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "prospect", text: `*${p.name || "Le gérant"}, regard méfiant* « ${opener} »` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<"gagne" | "perdu" | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    if (!input.trim() || busy || verdict) return;
    const text = input.trim();
    setInput("");
    const next: Msg[] = [...msgs, { role: "closer", text }];
    setMsgs(next);
    setBusy(true);
    try {
      const res = await fetch("/api/sparring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect: {
            company: p.company,
            name: p.name,
            sector: p.sector,
            pitch: [p.notes, ...p.problems].filter(Boolean).join(" · ").slice(0, 500),
            objections: p.objections.map((o) => o.label),
          },
          history: next.map((m) => ({ role: m.role, text: m.text.replace(/\*/g, "") })),
          businessRules: settings.businessRules,
          agencyName: settings.agencyName,
          offerLine: settings.offer?.whatYouSell,
        }),
      });
      const data = await res.json();
      setEngine(data.engine ?? null);
      setMsgs((cur) => [...cur, { role: "prospect", text: `« ${data.prospect} »`, coach: data.coach }]);
      if (data.status === "gagne" || data.status === "perdu") {
        setVerdict(data.status);
        logActivity({
          kind: "ia",
          message: `Sparring ${data.status === "gagne" ? "gagné 🏆" : "perdu"} contre ${p.company}`,
          prospectId: p.id,
        });
      }
    } catch {
      setMsgs((cur) => [...cur, { role: "prospect", text: "« … » (erreur réseau, réessaie)" }]);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex flex-col bg-ink-950 animate-fade-up">
      <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
        <div className="flex items-center gap-3">
          <Dumbbell size={20} className="text-bronze-400" />
          <div>
            <p className="font-display text-base font-extrabold text-paper">Sparring — {p.company}</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">
              Le prospect est joué par l&apos;IA{engine === "local" ? " (moteur local)" : ""} · Objectif : décrocher l&apos;audit
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-paper-faint hover:text-paper"><X size={24} /></button>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-5 py-6">
        {msgs.map((m, i) => (
          <div key={i} className={cn("mb-4 flex flex-col", m.role === "closer" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] px-4 py-2.5 text-[14.5px] leading-relaxed",
                m.role === "closer"
                  ? "rounded-2xl rounded-br-md bg-paper text-ink-950"
                  : "rounded-2xl rounded-bl-md border border-ink-600 bg-ink-900 text-paper"
              )}
            >
              {m.text}
            </div>
            {m.coach && (
              <p className="mt-1.5 flex max-w-[85%] gap-1.5 font-mono text-[11px] text-bronze-400">
                <Sparkles size={12} className="mt-0.5 shrink-0" /> {m.coach}
              </p>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex gap-1.5 px-1 py-2">
            {[0, 1, 2].map((k) => (
              <span key={k} className="h-2 w-2 animate-pulse-ring rounded-full bg-paper-faint" style={{ animationDelay: `${k * 0.2}s` }} />
            ))}
          </div>
        )}
        {verdict && (
          <div className="py-8 text-center animate-fade-up">
            {verdict === "gagne" ? (
              <>
                <Trophy size={40} className="mx-auto text-bronze-400" />
                <p className="mt-3 font-display text-xl font-extrabold text-bronze-400">RDV décroché. Bien joué.</p>
                <p className="mt-1 text-sm text-paper-faint">Maintenant va le faire en vrai — le Mode Closing t&apos;attend.</p>
              </>
            ) : (
              <>
                <Flame size={40} className="mx-auto text-signal-red" />
                <p className="mt-3 font-display text-xl font-extrabold text-signal-red">Raté cette fois.</p>
                <p className="mt-1 text-sm text-paper-faint">Relis les conseils du coach et recommence — c&apos;est fait pour ça.</p>
              </>
            )}
            <button className="btn-ghost mt-5" onClick={onClose}>Terminer</button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!verdict && (
        <div className="mx-auto flex w-full max-w-2xl gap-2 border-t border-ink-700 px-5 py-4">
          <input
            className="input flex-1 rounded-full px-5"
            placeholder="Ta réponse au prospect…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={busy}
            autoFocus
          />
          <button
            className="btn-bronze h-11 w-11 rounded-full p-0"
            onClick={send}
            disabled={busy || !input.trim()}
          >
            <Send size={17} />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
