"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bot, CalendarClock, Check, CheckCircle2, ChevronDown, Circle,
  Clock, Coins, FileSignature, Gauge, MailOpen, MessageSquare, Radio, User, X,
} from "lucide-react";
import type { Prospect } from "@/lib/types";
import { useAlpha } from "@/lib/store";
import { masterRappel, type RunCheck, type Action } from "@/lib/master-rappel";
import { lireReactivite, type EnvoiSuivi, type Reactivite } from "@/lib/reactivite";
import { useAccountCommercial } from "@/lib/client-catalogue";
import { buildArgumentaire, argumentaireText } from "@/lib/argumentaire";
import { cn } from "@/lib/utils";

/**
 * MASTER RAPPEL — le panneau qui répond, sur la fiche : pour CE prospect,
 * maintenant, qu'est-ce que je fais, qu'est-ce qu'Alpha fait, et est-ce que
 * ça tourne vraiment ?
 *
 * Tout est calculé côté client à partir de la fiche (modules purs) : aucune
 * clé, et le plan reste complet hors ligne.
 *
 * UNE seule lecture réseau, facultative : les ouvertures et les clics de ses
 * emails. Elle CORRIGE le plan quand elle arrive (« il ouvre » ≠ « il ignore »)
 * et ne le bloque jamais quand elle échoue — sans elle, la réactivité reste
 * un angle mort déclaré, pas un « il n'ouvre pas » supposé.
 */
export function MasterPanel({ p }: { p: Prospect }) {
  const accountId = useAlpha((s) => s.settings.accountId);
  const [showArgu, setShowArgu] = useState(false);

  // `now` figé au montage : sans ça, chaque rendu redécale les échéances.
  const now = useMemo(() => new Date(), []);

  const [reactivite, setReactivite] = useState<Reactivite | undefined>(undefined);
  useEffect(() => {
    let vivant = true;
    fetch(`/api/track/stats?prospectId=${encodeURIComponent(p.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivant) return;
        const envois = (Array.isArray(d.records) ? d.records : []) as EnvoiSuivi[];
        setReactivite(lireReactivite(envois));
      })
      // Un échec réseau laisse `undefined` : le plan se calcule sans, et
      // l'écran dira « angle mort » plutôt qu'une conclusion inventée.
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [p.id]);

  const plan = useMemo(
    () => masterRappel(p, { now, accountId, reactivite }),
    [p, now, accountId, reactivite]
  );
  const argu = useMemo(() => buildArgumentaire(p, accountId), [p, accountId]);

  const s = plan.signs;
  const readyTone = s.readiness >= 70 ? "text-signal-green" : s.readiness >= 45 ? "text-bronze-400" : "text-signal-red";

  return (
    <section className="card space-y-4 p-4 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Gauge size={15} className="text-bronze-400" /> Master rappel
        </h2>
        <div className="flex items-center gap-3 text-[11px]">
          <span className={cn("font-mono font-semibold", readyTone)}>{s.readiness}/100 prêt</span>
          <FatigueChip level={s.fatigueLevel} n={s.unansweredTouches} />
          <span className="text-paper-faint">momentum {s.momentum}</span>
        </div>
      </div>

      {/* La phrase à lire en premier. */}
      <p
        className={cn(
          "rounded-xl border px-3 py-2 text-[12.5px]",
          plan.closing
            ? "border-signal-green/40 bg-signal-green/5 text-signal-green"
            : "border-bronze-700/40 bg-bronze-900/10 text-paper"
        )}
      >
        {plan.headline}
      </p>

      {/* Le rituel de signature — seulement s'il est prêt. */}
      {plan.closing && (
        <div className="rounded-xl border border-signal-green/30 bg-signal-green/5 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-paper">
            <FileSignature size={13} className="text-signal-green" /> Closing — {plan.closing.accountName}
          </p>
          <p className="mt-1 text-[11.5px] text-paper-dim">{plan.closing.action}</p>
          {/* Les coordonnées du rituel viennent du serveur : email d'expédition,
              panel de vente, personne à impliquer. Elles n'ont rien à faire
              dans un bundle que n'importe qui télécharge. */}
          <ClosingCoordonnees accountId={plan.closing.accountId} />
        </div>
      )}

      {/* Actions : humain d'un côté, Alpha de l'autre. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionColumn title="Toi" icon={<User size={13} className="text-bronze-400" />} actions={plan.human} empty="Rien à faire de ton côté — Alpha gère." />
        <ActionColumn title="Alpha Sales OS" icon={<Bot size={13} className="text-bronze-400" />} actions={plan.alpha} empty="Aucun automatisme actif sur cette fiche." />
      </div>

      {/* Quoi dire, quand, comment, à quelle fréquence. */}
      <div className="rounded-xl border border-line/50 bg-surface/30 p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-paper">
          <MessageSquare size={13} className="text-bronze-400" /> Quoi dire — et à quelle fréquence
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-paper-faint">
          <span>canal : <strong className="text-paper-dim">{plan.comms.channel}</strong></span>
          <span>tous les <strong className="text-paper-dim">{plan.comms.everyDays} j</strong></span>
          <span className="flex items-center gap-1">
            <CalendarClock size={11} /> fenêtre : {new Date(s.bestWindow.at).toLocaleDateString("fr-FR")}
          </span>
        </div>
        <p className="mt-1.5 text-[11.5px] text-paper-dim">{plan.comms.say}</p>
        <p className="mt-1 text-[11px] italic text-paper-faint">Ton : {plan.comms.tone}</p>

        {/* La réactivité mesurée, avec sa réserve. Elle est affichée telle
            quelle : un taux d'ouverture est un plancher, jamais une mesure,
            et le lecteur doit voir la limite en même temps que le chiffre. */}
        {plan.comms.reactivite && (
          <p
            className={cn(
              "mt-2 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed",
              plan.comms.reactivite.lecture === "clic"
                ? "border-signal-green/40 bg-signal-green/5 text-signal-green"
                : plan.comms.reactivite.lecture === "lu-sans-reponse"
                  ? "border-bronze-700/40 bg-bronze-900/10 text-bronze-300"
                  : "border-ink-700 text-paper-faint"
            )}
          >
            <MailOpen size={11} className="mt-0.5 shrink-0" />
            {plan.comms.reactivite.phrase}
          </p>
        )}
        {plan.comms.avoid.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {plan.comms.avoid.map((a) => (
              <li key={a} className="flex items-start gap-1.5 text-[11px] text-signal-red">
                <X size={11} className="mt-0.5 shrink-0" /> {a}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-[11px] text-paper-faint">{s.bestWindow.why}</p>
      </div>

      {/* Est-ce que ça tourne ? Alpha reçoit-il la donnée ? */}
      <div>
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-paper">
          <Radio size={13} className="text-bronze-400" /> Ça tourne ?
        </p>
        <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
          {plan.checks.map((c) => (
            <CheckRow key={c.id} c={c} />
          ))}
        </ul>
      </div>

      {/* Signaux vitaux — ce qui bloque encore la signature. */}
      <div>
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-paper">
          <Activity size={13} className="text-bronze-400" /> Signaux vitaux
        </p>
        <ul className="mt-1.5 space-y-1">
          {s.vitals.map((v) => (
            <li key={v.id} className="flex items-start gap-1.5 text-[11.5px]">
              {v.ok ? (
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-signal-green" />
              ) : (
                <Circle size={12} className="mt-0.5 shrink-0 text-signal-red" />
              )}
              <span className={v.ok ? "text-paper-dim" : "text-paper"}>
                {v.label}
                <span className="text-paper-faint"> — {v.why}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* L'argumentaire complet, replié par défaut. */}
      <div className="rounded-xl border border-line/50">
        <button
          onClick={() => setShowArgu((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-paper">
            <Coins size={13} className="text-bronze-400" /> Argumentaire complet
            {argu.losses.measured && (
              <span className="ml-1 text-[11px] font-normal text-signal-amber">
                perte {argu.losses.perMonth.toLocaleString("fr-FR")} €/mois
              </span>
            )}
          </span>
          <ChevronDown size={14} className={cn("text-paper-faint transition-transform", showArgu && "rotate-180")} />
        </button>
        {showArgu && (
          <div className="space-y-3 border-t border-line/50 px-3 py-3 text-[11.5px]">
            <Block title="1. Se présenter">{argu.intro}</Block>
            <Block title="2. Questions qui font constater (puis se taire)">
              <ul className="space-y-0.5">{argu.questions.map((q) => <li key={q}>— {q}</li>)}</ul>
            </Block>
            <Block title="3. Ce qui se fait dans le marché">
              <ul className="space-y-0.5">{argu.marketStandard.map((x) => <li key={x}>— {x}</li>)}</ul>
            </Block>
            <Block title="4. Ce que ça coûte">{argu.losses.sentence}</Block>
            <Block title="5. Notre offre et son prix">
              <p>{argu.offer.what}</p>
              <p className="mt-0.5 text-bronze-400">{argu.offer.price}</p>
            </Block>
            <div className="grid gap-3 sm:grid-cols-2">
              <Block title="6. Nos devoirs">
                <ul className="space-y-0.5">{argu.ourDuties.map((x) => <li key={x}>— {x}</li>)}</ul>
              </Block>
              <Block title="6bis. Ses droits">
                <ul className="space-y-0.5">{argu.theirRights.map((x) => <li key={x}>— {x}</li>)}</ul>
              </Block>
            </div>
            <Block title="7. Pourquoi il dirait non">
              <ul className="space-y-1.5">
                {argu.objections.map((o) => (
                  <li key={o.says}>
                    <span className="text-paper">{o.says}</span>
                    <br />
                    <span className="text-paper-faint">il pense : {o.means}</span>
                    <br />
                    <span className="text-bronze-400">→ {o.answer}</span>
                  </li>
                ))}
              </ul>
            </Block>
            <Block title="8. Pourquoi attendre coûte plus cher">{argu.urgency}</Block>
            <Block title="9. Si le budget est contraint">
              <ul className="space-y-0.5">
                {argu.payment.map((x) => (
                  <li key={x.label}>
                    <strong className="text-paper-dim">{x.label}</strong> — {x.detail}
                  </li>
                ))}
              </ul>
            </Block>
            <button
              className="btn-ghost w-full text-[11px]"
              onClick={() => navigator.clipboard?.writeText(argumentaireText(argu))}
            >
              Copier l&apos;argumentaire
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-paper-faint">{title}</p>
      <div className="mt-0.5 text-paper-dim">{children}</div>
    </div>
  );
}

/**
 * Les coordonnées du rituel de signature, récupérées côté serveur.
 *
 * Rien tant que la réponse n'est pas là : l'ACTE (« envoyer le devis », « caler
 * le cadrage ») est déjà affiché au-dessus et suffit à agir. Mieux vaut une
 * ligne qui apparaît une demi-seconde plus tard qu'une adresse partenaire
 * livrée à quiconque télécharge nos fichiers JavaScript.
 */
function ClosingCoordonnees({ accountId }: { accountId: string }) {
  const c = useAccountCommercial(accountId)?.closing;
  if (!c) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-paper-faint">
      {c.fromEmail && <span>depuis <span className="font-mono text-bronze-400">{c.fromEmail}</span></span>}
      {c.panelUrl && (
        <a href={c.panelUrl} target="_blank" rel="noreferrer" className="text-bronze-400 hover:underline">
          ouvrir le panel ↗
        </a>
      )}
      {c.contactName && <span>avec {c.contactName}</span>}
      {c.timezone && <span>fuseau {c.timezone}</span>}
    </div>
  );
}

function ActionColumn({
  title, icon, actions, empty,
}: { title: string; icon: React.ReactNode; actions: Action[]; empty: string }) {
  return (
    <div className="rounded-xl border border-line/50 bg-surface/30 p-3">
      <p className="flex items-center gap-1.5 text-[12px] font-medium text-paper">{icon} {title}</p>
      {actions.length === 0 ? (
        <p className="mt-1 text-[11px] text-paper-faint">{empty}</p>
      ) : (
        <ul className="mt-1.5 space-y-2">
          {actions.map((a) => (
            <li key={a.id}>
              <p className="text-[11.5px] text-paper-dim">{a.do}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10.5px] text-paper-faint">
                <span className="rounded-full bg-bronze-900/25 px-1.5 py-0.5 text-bronze-300">{a.channel}</span>
                <span className="flex items-center gap-1">
                  <Clock size={10} /> {new Date(a.when).toLocaleDateString("fr-FR")}
                </span>
              </p>
              <p className="mt-0.5 text-[11px] italic text-paper-faint">{a.why}</p>
              {a.mustCapture?.length ? (
                <p className="mt-0.5 text-[11px] text-signal-amber">
                  À récolter : {a.mustCapture.join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckRow({ c }: { c: RunCheck }) {
  const tone =
    c.state === "actif" ? "text-signal-green" : c.state === "en-attente" ? "text-signal-amber" : "text-signal-red";
  const Icon = c.state === "actif" ? Check : c.state === "en-attente" ? Clock : AlertTriangle;
  return (
    <li className="flex items-start gap-1.5 text-[11.5px]">
      <Icon size={12} className={cn("mt-0.5 shrink-0", tone)} />
      <span>
        <span className="text-paper-dim">{c.label}</span>
        <span className="text-paper-faint"> — {c.detail}</span>
      </span>
    </li>
  );
}

function FatigueChip({ level, n }: { level: "ok" | "prudence" | "sature"; n: number }) {
  const map = {
    ok: { t: "text-signal-green", l: "non saturé" },
    prudence: { t: "text-signal-amber", l: "prudence" },
    sature: { t: "text-signal-red", l: "SATURÉ" },
  } as const;
  const m = map[level];
  return (
    <span className={cn("font-mono", m.t)}>
      {m.l}
      {n > 0 ? ` (${n} sans réponse)` : ""}
    </span>
  );
}
