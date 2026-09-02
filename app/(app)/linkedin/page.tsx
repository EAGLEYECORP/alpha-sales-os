"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Clock, Copy, ExternalLink, Gauge, Linkedin, Send } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Prospect } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  LINKEDIN_INVITE_LIMIT, linkedinTouchesSemaine, linkedinTouchesToday, linkedinUrl, semaineCampagne,
} from "@/lib/linkedin";
import { STEP_LABEL, buildLinkedinQueue, type LinkedinStep } from "@/lib/linkedin-sequence";
import { LINKEDIN_WEEKLY_LIMIT, plafondSemaine, quotaDuJour } from "@/lib/linkedin-plan";
import { SourcingPanel } from "@/components/linkedin/sourcing-panel";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Machine LinkedIn — le canal à quota.
 *
 * Assisté, jamais automatisé : l'app prépare le message calibré et
 * ouvre LinkedIn au bon endroit, l'humain colle et envoie. Chaque
 * envoi consigne une touche `linkedin` : la séquence avance toute
 * seule (invitation → J+2 message → J+4 relance) et le quota du jour
 * protège le profil.
 */

const STEP_TONE: Record<LinkedinStep, string> = {
  invitation: "border-signal-blue/50 text-signal-blue",
  message: "border-bronze-700 text-bronze-300",
  relance: "border-signal-amber/60 text-signal-amber",
  termine: "border-ink-600 text-paper-faint",
};

export default function LinkedinPage() {
  const { prospects, addEvent, logActivity, settings } = useAlpha();
  const [city, setCity] = useState("Lyon 6");
  const [copied, setCopied] = useState<string | null>(null);

  const queue = useMemo(
    // Le compte actif décide des aimants disponibles, donc de l'angle du
    // message. Sans lui, chaque fiche recevait la proposition voix.
    () => buildLinkedinQueue(prospects, { city, bookingUrl: settings.bookingUrl, accountId: settings.accountId }),
    [prospects, city, settings.bookingUrl, settings.accountId]
  );
  /**
   * ⚠ Le quota ne se lit plus à la journée seule.
   *
   * LinkedIn compte les invitations à la SEMAINE : 25 par jour tenus cinq
   * jours font 125, au-dessus du plafond. L'écran affichait « quota OK »
   * pendant que la plateforme bloquait déjà. `quotaDuJour` croise les trois
   * plafonds (jour, semaine, montée en charge) et nomme celui qui mord.
   */
  const today = linkedinTouchesToday(prospects);
  const semaine = semaineCampagne(prospects);
  const cetteSemaine = linkedinTouchesSemaine(prospects);
  const quota = useMemo(
    () => quotaDuJour({ envoyeesSemaine: cetteSemaine, envoyeesAujourdhui: today, semaineCampagne: semaine }),
    [cetteSemaine, today, semaine]
  );
  const remaining = quota.reste;
  const ready = queue.filter((t) => t.ready);

  /** Copie le message, ouvre LinkedIn, consigne la touche. */
  const fire = (p: Prospect, step: LinkedinStep, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(p.id);
    setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 2000);
    window.open(linkedinUrl(p), "_blank", "noopener");
    addEvent(p.id, {
      date: new Date().toISOString(),
      kind: "linkedin",
      summary: `LinkedIn — ${STEP_LABEL[step]} (ALPHA SALES TEST 1)`,
    });
    logActivity({ kind: "campagne", message: `LinkedIn ${STEP_LABEL[step]} — ${p.company}`, prospectId: p.id });
  };

  return (
    <div className="page">
      {/* ⚠ Le sur-titre annonçait « SCINTIA × EAGLEYE CORP » à l'écran. L'accord
          est mort (CLAUDE.md, 02/09/2026) et cette marque n'est pas la nôtre :
          elle ne doit plus s'afficher nulle part. Ce qui reste vrai, et qui est
          la seule chose utile ici, c'est la règle du canal. */}
      <PageHeader
        eyebrow="Un canal à quota · le volume s'y paie en compte fermé"
        title="Machine LinkedIn"
        actions={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Quota du jour</p>
              <p className={cn("font-display text-lg font-extrabold", remaining === 0 ? "text-signal-red" : "text-paper")}>
                {today}<span className="text-sm text-paper-faint">/{today + remaining}</span>
              </p>
            </div>
            {/* La semaine est l'unité que LinkedIn compte vraiment. */}
            <div className="text-right">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Cette semaine</p>
              <p
                className={cn(
                  "font-display text-lg font-extrabold",
                  cetteSemaine >= plafondSemaine(semaine) ? "text-signal-red" : "text-paper"
                )}
              >
                {cetteSemaine}<span className="text-sm text-paper-faint">/{plafondSemaine(semaine)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Mûrs aujourd&apos;hui</p>
              <p className="font-display text-lg font-extrabold text-bronze-400">{ready.length}</p>
            </div>
          </div>
        }
      />

      {/* Périmètre */}
      <div className="card flex flex-wrap items-center gap-3 p-3.5">
        <label className="label mb-0 shrink-0">Périmètre</label>
        <input
          className="input w-auto min-w-44"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Ville / arrondissement"
        />
        <p className="text-[12px] text-paper-faint">
          {queue.length} fiche(s) dans le périmètre · séquence invitation → J+2 message → J+4 relance.
        </p>
      </div>

      <SourcingPanel />

      {/* Le message dit LAQUELLE des trois limites bloque : « quota atteint »
          sans raison pousse à passer outre, « il te reste 4 invitations cette
          semaine » se respecte. */}
      <p
        className={cn(
          "rounded-xl border px-4 py-3 text-[13px]",
          remaining === 0
            ? "border-signal-red/50 bg-signal-red/5 text-signal-red"
            : "border-ink-600 bg-ink-850 text-paper-dim"
        )}
      >
        {quota.message}
      </p>

      <p className="rounded-xl border border-bronze-700/50 bg-bronze-900/20 px-4 py-3 text-[12.5px] leading-relaxed text-bronze-300">
        <strong>Comment ça marche :</strong> « Copier + ouvrir » met le message dans le presse-papier, ouvre le profil
        LinkedIn et consigne la touche. Tu colles, tu relis, tu envoies — c&apos;est réellement toi qui écris, donc zéro
        risque de restriction. L&apos;audit n&apos;est jamais joint d&apos;office : il part quand la personne dit oui.
      </p>

      <section className="space-y-2">
        {queue.map(({ prospect: p, step, text, ready: isReady, waitDays, touches }) => (
          <div key={p.id} className={cn("card p-4", !isReady && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-bold text-paper">{p.company}</p>
                <p className="truncate text-[12px] text-paper-faint">
                  {p.name || "contact inconnu"} · {p.city}
                  {p.linkedin?.trim() ? " · profil en fiche" : " · recherche par nom"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={cn("chip", STEP_TONE[step])}>{STEP_LABEL[step]}</span>
                {touches > 0 && <span className="chip border-ink-600 text-paper-faint">{touches} touche(s)</span>}
              </div>
            </div>

            {step !== "termine" ? (
              <>
                <pre className="panel mt-2.5 max-h-44 overflow-y-auto whitespace-pre-wrap p-3 font-body text-[12.5px] leading-relaxed text-paper-dim">
                  {text}
                </pre>
                {step === "invitation" && (
                  <p className={cn("mt-1 font-mono text-[10.5px]", text.length > LINKEDIN_INVITE_LIMIT ? "text-signal-red" : "text-paper-faint")}>
                    {text.length}/{LINKEDIN_INVITE_LIMIT} caractères
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="btn-bronze px-3.5 py-1.5 text-[12px]"
                    disabled={!isReady || remaining === 0}
                    onClick={() => fire(p, step, text)}
                    title={isReady ? "Copie le message, ouvre LinkedIn et consigne la touche" : `Cadence : encore ${waitDays} j`}
                  >
                    {copied === p.id ? <CheckCircle2 size={13} /> : <Send size={13} />}
                    {copied === p.id ? "Copié — colle sur LinkedIn" : "Copier + ouvrir"}
                  </button>
                  <button
                    className="btn-ghost px-2.5 py-1.5 text-[12px]"
                    onClick={() => {
                      void navigator.clipboard.writeText(text);
                      setCopied(p.id);
                      setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 2000);
                    }}
                  >
                    <Copy size={13} /> Copier seul
                  </button>
                  <a className="btn-ghost px-2.5 py-1.5 text-[12px]" href={linkedinUrl(p)} target="_blank" rel="noreferrer">
                    <ExternalLink size={13} /> Profil
                  </a>
                  <Link className="btn-ghost px-2.5 py-1.5 text-[12px]" href={`/prospects/${p.id}`}>
                    Fiche <ArrowUpRight size={13} />
                  </Link>
                  {!isReady && (
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-paper-faint">
                      <Clock size={12} /> cadence : encore {waitDays} j
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-2 text-[13px] text-paper-faint">
                Séquence terminée — bascule sur l&apos;appel ou l&apos;email, LinkedIn a fait sa part.
              </p>
            )}
          </div>
        ))}

        {queue.length === 0 && (
          <p className="card px-4 py-8 text-center text-sm text-paper-faint">
            Aucune fiche active dans « {city} ». Élargis le périmètre ou importe la liste Lyon 6.
          </p>
        )}
      </section>

      <p className="flex items-center justify-center gap-2 text-center text-[11px] text-paper-faint">
        <Gauge size={12} /> {plafondSemaine(semaine)} invitations/semaine maximum (plafond plateforme {LINKEDIN_WEEKLY_LIMIT}) ·
        chaque envoi est consigné dans la fiche et dans les Preuves.
      </p>
    </div>
  );
}
