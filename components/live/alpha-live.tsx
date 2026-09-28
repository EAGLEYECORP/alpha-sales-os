"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PictureInPicture2, Mic, MicOff, X, Crosshair, ShieldAlert, Brain } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { matchObjections, matchAlarms, verticalById } from "@/lib/live-assist";
import { verticalForProspect } from "@/lib/playbook";
import { matchOffer, OFFER_LABELS } from "@/lib/offer-match";
import { getAccount } from "@/lib/accounts";
import { search } from "@/lib/knowledge";
import type { Prospect } from "@/lib/types";

/**
 * Alpha Live — copilote détachable pour les RDV visio. S'ouvre dans une VRAIE
 * fenêtre flottante always-on-top (Document Picture-in-Picture, Chrome/Edge),
 * qui reste au-dessus de Zoom/Meet. Tu tapes (ou dictes) ce que dit le prospect ;
 * Alpha souffle la réponse à l'objection, alarme sur les fautes de doctrine,
 * rappelle l'offre à pousser et remonte tes notes du Cerveau. En direct.
 *
 * Vraie transparence traversable par-dessus n'importe quelle app = habillage
 * desktop (voir desktop/ · Electron). Le PiP fait le reste, sans rien installer.
 */
type PiPWindow = Window & { documentPictureInPicture?: unknown };

function pipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
      const style = document.createElement("style");
      style.textContent = css;
      target.document.head.appendChild(style);
    } catch {
      // Feuille cross-origin (Google Fonts) : on recopie le <link>.
      if (sheet.href) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
}

export function AlphaLiveButton({ prospect }: { prospect?: Prospect }) {
  const [pip, setPip] = useState<Window | null>(null);
  const supported = pipSupported();

  const open = async () => {
    try {
      // @ts-expect-error — Document PiP pas encore dans la lib TS DOM.
      const w: Window = await (window as PiPWindow).documentPictureInPicture!.requestWindow({ width: 400, height: 600 });
      copyStyles(w);
      w.document.documentElement.setAttribute("data-theme", "dark");
      w.document.title = "Alpha Live";
      w.document.body.style.margin = "0";
      w.document.body.style.background = "rgba(14,14,13,0.9)";
      w.addEventListener("pagehide", () => setPip(null));
      setPip(w);
    } catch {
      setPip(null);
    }
  };

  return (
    <>
      <button
        className="btn-ghost"
        onClick={open}
        disabled={!supported || Boolean(pip)}
        title={supported ? "Fenêtre flottante au-dessus de ta visio" : "Chrome ou Edge requis pour la fenêtre flottante"}
      >
        <PictureInPicture2 size={14} /> Alpha Live
      </button>
      {pip && createPortal(<LiveCopilot prospect={prospect} onClose={() => { pip.close(); setPip(null); }} />, pip.document.body)}
    </>
  );
}

/** Le copilote live — réutilisé par le PiP (app web) ET la fenêtre transparente (Electron, route /overlay). */
export function LiveCopilot({ prospect, onClose }: { prospect?: Prospect; onClose?: () => void }) {
  const notes = useAlpha((s) => s.notes);
  const accountId = useAlpha((s) => s.settings.accountId);
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const vertical = useMemo(
    () => (prospect ? verticalForProspect(prospect) : null) ?? verticalById(undefined),
    [prospect]
  );

  const objections = useMemo(() => (heard.trim() ? matchObjections(heard, vertical).slice(0, 2) : []), [heard, vertical]);
  const alarms = useMemo(() => (heard.trim() ? matchAlarms(heard).slice(0, 2) : []), [heard]);
  const brain = useMemo(() => (heard.trim() ? search(heard, notes, 2).map((s) => s.note) : []), [heard, notes]);
  const offer = useMemo(() => {
    if (!prospect) return null;
    const a = prospect.deepAudit;
    return matchOffer(
      {
        sector: String(prospect.sector),
        missedCallsPerWeek: a?.missedCallsPerWeek,
        googleRating: a?.googleRating,
        googleReviews: a?.googleReviews,
        websiteState: a?.websiteState,
        socialState: a?.socialState,
        monthlyValue: prospect.monthlyValue,
        avgTicket: a?.avgTicket,
      },
      getAccount(accountId).offers
    );
  }, [prospect, accountId]);

  // Dictée (Web Speech API) — feature-detect, sinon on tape.
  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    if (!SR) return;
    // @ts-expect-error — constructeur dynamique.
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript + " ";
      setHeard(txt.trim().slice(-400));
    };
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  useEffect(() => () => recRef.current?.stop(), []);

  return (
    <div className="flex h-screen flex-col gap-2 overflow-y-auto p-3 text-paper" style={{ fontFamily: "Inter Tight, system-ui, sans-serif" }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-display text-sm font-bold text-bronze-400">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-red opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-signal-red" /></span>
          ALPHA LIVE
        </span>
        {onClose && <button className="text-paper-faint hover:text-paper" onClick={onClose}><X size={15} /></button>}
      </div>

      {prospect && (
        <div className="rounded-lg border border-ink-700 bg-ink-900/70 px-2.5 py-1.5">
          <p className="truncate text-[12px] font-medium text-paper">{prospect.company}</p>
          {offer && <p className="truncate text-[11px] text-bronze-400">→ {OFFER_LABELS[offer.primary].split(" — ")[0]}</p>}
          {prospect.nextStep?.action && <p className="mt-0.5 truncate text-[10.5px] text-paper-faint">Objectif : {prospect.nextStep.action}</p>}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <textarea
          className="input min-h-[46px] flex-1 py-1.5 text-[12px]"
          placeholder="Ce que dit le prospect…"
          value={heard}
          onChange={(e) => setHeard(e.target.value)}
        />
        <button
          className={listening ? "btn-bronze px-2" : "btn-ghost px-2"}
          onClick={toggleMic}
          title="Dicter (Chrome/Edge/Safari)"
        >
          {listening ? <MicOff size={14} /> : <Mic size={14} />}
        </button>
      </div>

      {objections.map((o) => (
        <div key={o.id} className="rounded-lg border border-signal-green/40 bg-signal-green/5 p-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-signal-green"><Crosshair size={11} /> {o.label} · {o.source}</p>
          <p className="mt-1 text-[12px] leading-snug text-paper-dim">{o.answer}</p>
        </div>
      ))}

      {alarms.map((a) => (
        <div key={a.id} className="rounded-lg border border-signal-amber/40 bg-signal-amber/10 p-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-signal-amber"><ShieldAlert size={11} /> {a.label}</p>
          <p className="mt-1 text-[12px] leading-snug text-paper-dim">{a.fix}</p>
        </div>
      ))}

      {brain.map((n) => (
        <div key={n.id} className="rounded-lg border border-ink-700 bg-ink-900/60 p-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-bronze-400"><Brain size={11} /> {n.title}</p>
          <p className="mt-1 line-clamp-3 text-[11.5px] leading-snug text-paper-faint">{n.body.replace(/[#*[\]]/g, "").slice(0, 160)}</p>
        </div>
      ))}

      {!heard.trim() && (
        <p className="mt-1 text-center text-[11px] text-paper-faint">Tape ou dicte ce que tu entends — Alpha souffle la réponse, alarme sur la doctrine, remonte tes notes.</p>
      )}
    </div>
  );
}
