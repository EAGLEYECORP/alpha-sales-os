"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  ListChecks,
  Send,
  ShieldQuestion,
  X,
} from "lucide-react";
import { useAlpha } from "@/lib/store";
import { stageById } from "@/lib/hormozi";
import { daysAhead } from "@/lib/utils";
import type { Prospect, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

/**
 * ─────────────────────────────────────────────────────────────────────
 * À décider — la boucle humaine.
 *
 * Une seule page pour tout ce qui attend une DÉCISION de toi, pas une
 * simple tâche : un envoi à approuver, une fiche sans prochaine étape (une
 * décision non prise), une promesse en retard, une objection à trancher,
 * un RDV imminent à préparer. Le reste — le « faire » du jour — vit dans
 * Aujourd'hui ; ici on répond, on tranche, on avance, vite.
 *
 * Doctrine : rien ne part sans toi (les envois sont proposés, pas lancés),
 * et une fiche sans prochaine étape datée est un deal qui meurt en silence.
 * Cette page rend ces deux vérités visibles et actionnables en un geste.
 * ─────────────────────────────────────────────────────────────────────
 */

const atMidnight = (d: string) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};
const daysUntil = (iso: string) => Math.round((atMidnight(iso) - atMidnight(new Date().toISOString())) / 86_400_000);

/** L'action par défaut d'une prochaine étape, selon l'avancement. */
const defaultAction = (stage: Stage): string =>
  stage === "offre" || stage === "redzone"
    ? "Appel décision"
    : stage === "demo"
      ? "Relancer après la démo"
      : stage === "audit"
        ? "Confirmer le rendez-vous d'audit"
        : "Rappeler";

export default function DecisionsPage() {
  const { prospects, meetings, drafts, setNextStep, moveStage, addEvent } = useAlpha();
  const [flash, setFlash] = useState("");

  const active = useMemo(() => prospects.filter((p) => p.stage !== "signe" && p.stage !== "perdu"), [prospects]);

  const pendingDrafts = useMemo(() => drafts.filter((d) => d.status === "pending"), [drafts]);

  const sansNext = useMemo(
    () => active.filter((p) => !p.nextStep).sort((a, b) => b.probability - a.probability),
    [active]
  );
  const enRetard = useMemo(
    () =>
      active
        .filter((p) => p.nextStep && daysUntil(p.nextStep.date) < 0)
        .sort((a, b) => daysUntil(a.nextStep!.date) - daysUntil(b.nextStep!.date)),
    [active]
  );
  const objections = useMemo(
    () => active.filter((p) => p.stage === "redzone" || p.objections.some((o) => o.status !== "traitee")),
    [active]
  );
  const rdvImminents = useMemo(
    () => meetings.filter((m) => !m.done && daysUntil(m.date) >= 0 && daysUntil(m.date) <= 1),
    [meetings]
  );

  const total = pendingDrafts.length + sansNext.length + enRetard.length + objections.length + rdvImminents.length;

  const say = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const planifier = (p: Prospect, days: number) => {
    setNextStep(p.id, { date: daysAhead(days), action: defaultAction(p.stage) });
    say(`✓ ${p.company} — prochaine étape dans ${days} j.`);
  };
  const reprogrammer = (p: Prospect, days: number) => {
    setNextStep(p.id, { date: daysAhead(days), action: p.nextStep?.action ?? defaultAction(p.stage) });
    say(`✓ ${p.company} — reprogrammé (+${days} j).`);
  };
  const abandonner = (p: Prospect) => {
    const { ok } = moveStage(p.id, "perdu", { lostReason: "Écarté depuis À décider" });
    if (ok) {
      addEvent(p.id, { date: new Date().toISOString(), kind: "stage", summary: "Marqué perdu (décision)" });
      say(`${p.company} — sorti du pipe.`);
    } else say(`Impossible de clore ${p.company} ici — ouvre la fiche.`);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="La boucle humaine · tu tranches"
        title="À décider"
        actions={
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-paper-faint">
            En attente <b className={cn("ml-1 font-display text-base", total ? "text-signal-red" : "text-signal-green")}>{total}</b>
          </span>
        }
      />

      {total === 0 && (
        <section className="card px-4 py-10 text-center">
          <CheckCircle2 size={22} className="mx-auto text-signal-green" />
          <p className="mt-2 text-sm text-paper">Rien n&apos;attend de décision. Chaque fiche active a sa prochaine étape.</p>
          <p className="mt-1 text-[12px] text-paper-faint">
            Va sur le terrain l&apos;esprit tranquille — <Link href="/aujourdhui" className="text-bronze-400 hover:underline">tes priorités du jour</Link> t&apos;attendent.
          </p>
        </section>
      )}

      {/* 1. À approuver avant envoi — rien ne part sans toi */}
      {pendingDrafts.length > 0 && (
        <Section icon={Send} tone="text-bronze-400" title="À approuver avant envoi" count={pendingDrafts.length}
          sub="Des messages sont rédigés et attendent ton feu vert. Rien ne part tout seul.">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] text-paper-dim">
              {pendingDrafts.length} message{pendingDrafts.length > 1 ? "s" : ""} prêt{pendingDrafts.length > 1 ? "s" : ""} à relire
              ({new Set(pendingDrafts.map((d) => d.company)).size} fiche(s)).
            </p>
            <Link href="/campaigns" className="btn-bronze px-3 py-1.5 text-[12px]">Relire &amp; envoyer <ArrowRight size={13} /></Link>
            <Link href="/outbox" className="btn-ghost px-3 py-1.5 text-[12px]">Boîte d&apos;envoi</Link>
          </div>
        </Section>
      )}

      {/* 2. Sans prochaine étape — LA décision qui tue les deals en silence */}
      {sansNext.length > 0 && (
        <Section icon={ListChecks} tone="text-signal-amber" title="Sans prochaine étape" count={sansNext.length}
          sub="Une fiche sans prochaine étape datée est une décision non prise — elle disparaît des radars. Tranche en un geste.">
          <ul className="space-y-2">
            {sansNext.slice(0, 12).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-700 p-2.5">
                <Link href={`/prospects/${p.id}`} className="min-w-0 text-[13px] font-medium text-paper hover:text-bronze-400">
                  {p.company} <span className="chip border-ink-700 text-[10px] text-paper-faint">{stageById(p.stage).label}</span>
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-paper-faint">Rappeler :</span>
                  <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => planifier(p, 1)}>Demain</button>
                  <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => planifier(p, 3)}>+3 j</button>
                  <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => planifier(p, 7)}>+1 sem</button>
                  <button className="btn-ghost px-2 py-1 text-[11px] text-paper-faint" onClick={() => abandonner(p)} title="Sortir du pipe">
                    <X size={12} /> Perdu
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {sansNext.length > 12 && <p className="mt-2 text-[11px] text-paper-faint">+{sansNext.length - 12} autres — <Link href="/pipeline" className="text-bronze-400 hover:underline">le pipe</Link>.</p>}
        </Section>
      )}

      {/* 3. En retard — la promesse rompue */}
      {enRetard.length > 0 && (
        <Section icon={Clock} tone="text-signal-red" title="En retard" count={enRetard.length}
          sub="Tu t'étais engagé sur une date passée. Fais-le maintenant, reprogramme, ou tranche.">
          <ul className="space-y-2">
            {enRetard.slice(0, 12).map((p) => {
              const d = daysUntil(p.nextStep!.date);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-signal-red/30 p-2.5">
                  <Link href={`/prospects/${p.id}`} className="min-w-0 text-[13px] text-paper hover:text-bronze-400">
                    <b className="font-medium">{p.company}</b> — {p.nextStep!.action}{" "}
                    <span className="text-signal-red">({Math.abs(d)} j de retard)</span>
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => reprogrammer(p, 1)}>Demain</button>
                    <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => reprogrammer(p, 3)}>+3 j</button>
                    <button className="btn-ghost px-2 py-1 text-[11px] text-paper-faint" onClick={() => abandonner(p)}><X size={12} /> Perdu</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* 4. RDV imminents — à préparer */}
      {rdvImminents.length > 0 && (
        <Section icon={CalendarClock} tone="text-bronze-400" title="Rendez-vous imminents" count={rdvImminents.length}
          sub="Aujourd'hui ou demain. Un rendez-vous se prépare la veille, pas le matin même.">
          <ul className="space-y-1.5">
            {rdvImminents.map((m) => {
              const d = daysUntil(m.date);
              const heure = new Date(m.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              return (
                <li key={m.id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="text-paper">{m.title} — <b>{d === 0 ? "aujourd'hui" : "demain"} {heure}</b></span>
                  {m.prospectId && <Link href={`/prospects/${m.prospectId}`} className="btn-ghost px-2.5 py-1 text-[12px]">Préparer <ArrowRight size={12} /></Link>}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* 5. Objections / Red Zone — à trancher */}
      {objections.length > 0 && (
        <Section icon={ShieldQuestion} tone="text-signal-amber" title="Objection à traiter" count={objections.length}
          sub="Tant qu'une objection est posée, aucun autre contact ne sert : il glissera dessus.">
          <ul className="space-y-1.5">
            {objections.slice(0, 10).map((p) => {
              const o = p.objections.find((x) => x.status !== "traitee");
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 text-paper">
                    <b className="font-medium">{p.company}</b>{o ? ` — « ${o.label} »` : " — red zone"}
                  </span>
                  <Link href={`/prospects/${p.id}`} className="btn-ghost px-2.5 py-1 text-[12px]">Traiter <ArrowRight size={12} /></Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {flash && (
        <p className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-bronze-700 bg-ink-900 px-4 py-2 text-[12px] text-paper shadow-lg">
          {flash}
        </p>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  tone,
  title,
  count,
  sub,
  children,
}: {
  icon: typeof Send;
  tone: string;
  title: string;
  count: number;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="flex items-start gap-2">
        <Icon size={16} className={cn("mt-0.5 shrink-0", tone)} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
            {title}
            <span className={cn("rounded-full border px-1.5 text-[10px]", tone, "border-ink-600")}>{count}</span>
          </h2>
          <p className="mt-0.5 text-[12px] text-paper-faint">{sub}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
