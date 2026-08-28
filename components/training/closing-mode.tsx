"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, ChevronLeft, Dumbbell, Trophy, X } from "lucide-react";
import type { Prospect } from "@/lib/types";
import { OBJECTION_LIBRARY, signingBlockers } from "@/lib/hormozi";
import { useAlpha } from "@/lib/store";
import { fireSignedConfetti } from "@/lib/confetti";
import { Eagle } from "@/components/eagle";
import { ReasonDialog } from "@/components/ui/reason-dialog";
import { cn } from "@/lib/utils";
import { BlocagesSignature } from "@/components/blocages-signature";

/**
 * Mode Closing — plein écran, à dérouler PENDANT le rendez-vous.
 * Le script se construit avec les vraies données du prospect ; les
 * objections connues sont à un tap, avec leur contre.
 */
export function ClosingMode({ p, onClose, onSpar }: { p: Prospect; onClose: () => void; onSpar: () => void }) {
  const { moveStage } = useAlpha();
  const [i, setI] = useState(0);
  const [openObj, setOpenObj] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [reasonAsk, setReasonAsk] = useState<"signe" | "perdu" | null>(null);
  const [blocages, setBlocages] = useState<string[]>([]);

  useEffect(() => {
    // Ne pas fermer tout le mode si c'est le dialog de raison qui est ouvert.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !reasonAsk && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, reasonAsk]);

  const firstName = p.name.split(" ")[0] || "chef";
  const steps = useMemo(() => {
    const s: [string, string][] = [
      [
        "Accroche",
        `« Bonjour ${firstName} — merci de me recevoir. Je vais être direct : je ne suis pas là pour vous vendre un site, je suis là pour une décision. Dans 20 minutes, vous saurez exactement ce que vous perdez et ce que ça coûte de le régler. »`,
      ],
      [
        "Constat",
        p.problems.length
          ? `« Voilà ce qu'on a mesuré chez ${p.company} : ${p.problems.slice(0, 3).join(" ; ")}. »`
          : `« Voilà ce que je constate chez ${p.company} : les clients qui vous cherchent en ligne ne vous trouvent pas — ils trouvent le concurrent qui répond. »`,
      ],
      [
        "Démo mobile",
        `Sortir le téléphone. Ouvrir la maquette de ${p.company}. Se taire 10 secondes.\n\n« Voilà à quoi ressemble ${p.company} quand on le cherche. C'est vous, avec vos couleurs, votre carte, votre réalité. »`,
      ],
      [
        "Le chiffre",
        p.ignoranceTax > 0
          ? `« Chaque mois sans agir, ${p.company} laisse partir environ ${p.ignoranceTax.toLocaleString("fr-FR")} €. Ce n'est pas mon chiffre — c'est le vôtre, on l'a calculé ensemble. La vraie question n'est pas "combien ça coûte", c'est "combien coûte le fait de ne rien faire". »`
          : `« On chiffre ensemble, maintenant : combien d'appels ratés par semaine ? Combien vaut un client ? Multipliez. C'est ça, le coût de l'attente. »`,
      ],
      [
        "L'offre",
        p.personalizedOffer
          ? `« Voilà ce que je vous propose, à vous et personne d'autre : ${p.personalizedOffer} »`
          : `« Mon offre : ${p.setupValue.toLocaleString("fr-FR")} € de mise en place + ${p.monthlyValue.toLocaleString("fr-FR")} €/mois, tout compris. Comparez à ce que vous perdez chaque mois — le calcul se fait tout seul. »`,
      ],
      [
        "La demande",
        `« De 1 à 10, à combien vous croyez que ça marcherait pour ${p.company} ? »\n\n— Sous 10 → « Qu'est-ce qui manque pour un 10 ? » (et on répare CETTE croyance)\n— À 10 → « Alors on démarre. Je vous envoie le contrat ce soir. »`,
      ],
    ];
    return s;
  }, [p, firstName]);

  // Objections du prospect (ouvertes) d'abord, puis la bibliothèque.
  const objections = useMemo(() => {
    const own = p.objections
      .filter((o) => o.status !== "traitee")
      .map((o) => ({ q: o.label, a: o.counter ?? OBJECTION_LIBRARY.find((l) => l.label === o.label)?.counter ?? "Isoler la croyance cassée : le produit ? le soutien ? ou « pour moi » ? Puis réparer avec une preuve." }));
    const lib = OBJECTION_LIBRARY.filter((l) => !own.some((o) => o.q === l.label)).map((l) => ({ q: l.label, a: l.counter }));
    return [...own, ...lib].slice(0, 5);
  }, [p]);

  const last = i >= steps.length - 1;

  const finish = (outcome: "signe" | "redzone" | "perdu") => {
    if (outcome === "signe") {
      const bloc = signingBlockers(p);
      if (bloc.length > 0) {
        // Cet écran est ouvert DEVANT le client : pas de boîte du navigateur.
        setBlocages(bloc);
        return;
      }
      setReasonAsk("signe");
      return;
    }
    if (outcome === "perdu") {
      setReasonAsk("perdu");
      return;
    }
    moveStage(p.id, "redzone");
    onClose();
  };

  // Portal to <body>: any transformed ancestor (fade-up animation) would
  // otherwise trap position:fixed inside the page column.
  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-ink-950 animate-fade-up" style={{ background: "radial-gradient(900px 600px at 50% 0%, #201B15, #0A0807)" }}>
      {/* header */}
      <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-bronze-400"><Eagle size={26} glow /></span>
          <div>
            <p className="font-display text-base font-extrabold text-paper">{p.company}</p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-bronze-400">Mode Closing</p>
          </div>
        </div>
        <button onClick={onClose} className="text-paper-faint hover:text-paper"><X size={24} /></button>
      </div>

      {/* progress */}
      <div className="flex gap-1.5 px-5 py-4">
        {steps.map((_, k) => (
          <div key={k} className={cn("h-1 flex-1 rounded-full transition-colors", k <= i ? "bg-bronze-400" : "bg-ink-700")} />
        ))}
      </div>

      {!done ? (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6">
          <div key={i} className="animate-fade-up">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-bronze-400">
              {steps[i][0]} · {i + 1}/{steps.length}
            </p>
            <p className="whitespace-pre-wrap font-display text-2xl font-bold leading-snug text-paper md:text-3xl">
              {steps[i][1]}
            </p>
          </div>

          <div className="mt-10">
            <p className="mb-2.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-paper-faint">
              S&apos;il objecte — tape pour la réponse
            </p>
            <div className="flex flex-wrap gap-2">
              {objections.map((o, k) => (
                <button
                  key={k}
                  onClick={() => setOpenObj(openObj === k ? null : k)}
                  className={cn("chip py-1.5 text-[12px] transition-colors", openObj === k ? "border-bronze-400 bg-bronze-400/10 text-bronze-300" : "border-ink-600 text-paper hover:border-bronze-700")}
                >
                  {o.q}
                </button>
              ))}
            </div>
            {openObj !== null && (
              <div className="mt-3 rounded-xl border border-bronze-700/60 bg-ink-900 px-4 py-3 text-[15px] leading-relaxed text-paper animate-fade-up">
                <span className="text-bronze-400">→ </span>
                {objections[openObj].a}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Trophy size={44} className="text-bronze-400" />
          <p className="mt-4 font-display text-2xl font-extrabold text-paper">Issue du rendez-vous</p>
          <p className="mt-1 text-sm text-paper-faint">Comment ça s&apos;est terminé avec {firstName} ?</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="btn-bronze px-6 py-3 text-[15px]" onClick={() => finish("signe")}>✍ Signé</button>
            <button className="btn-ghost px-6 py-3 text-[15px] border-signal-amber/60 text-signal-amber" onClick={() => finish("redzone")}>Objections à traiter</button>
            <button className="btn-ghost px-6 py-3 text-[15px] border-signal-red/50 text-signal-red" onClick={() => finish("perdu")}>Pas cette fois</button>
          </div>
        </div>
      )}

      {/* footer nav */}
      {!done && (
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 border-t border-ink-700 px-6 py-4">
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={i === 0} onClick={() => { setI(i - 1); setOpenObj(null); }}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn-ghost" onClick={onSpar}>
              <Dumbbell size={15} /> S&apos;entraîner d&apos;abord
            </button>
          </div>
          {last ? (
            <button className="btn-bronze px-6 py-3" onClick={() => setDone(true)}>
              <Check size={16} /> Conclure
            </button>
          ) : (
            <button className="btn-bronze px-6 py-3" onClick={() => { setI(i + 1); setOpenObj(null); }}>
              Suivant <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      <BlocagesSignature blocages={blocages} onClose={() => setBlocages([])} company={p.company} />

      <ReasonDialog
        open={!!reasonAsk}
        kind={reasonAsk === "signe" ? "won" : "lost"}
        company={p.company}
        onCancel={() => setReasonAsk(null)}
        onSubmit={(reason) => {
          if (reasonAsk === "signe") {
            const res = moveStage(p.id, "signe", { wonReason: reason });
            if (res.ok) fireSignedConfetti();
          } else if (reasonAsk === "perdu") {
            moveStage(p.id, "perdu", { lostReason: reason });
          }
          setReasonAsk(null);
          onClose();
        }}
      />
    </div>,
    document.body
  );
}
