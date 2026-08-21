"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CalendarClock, Check, Flame, Gauge, Square, Target } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { dailyStandard, streak, reminderText, type BarItem } from "@/lib/standard";
import { cn } from "@/lib/utils";

/**
 * LA BARRE DU JOUR — le seul écran qui dit si la journée est tenue.
 *
 * Rappels : la permission de notification se demande sur un GESTE de
 * l'utilisateur (les navigateurs refusent autrement), et les rappels ne
 * partent que pendant que l'app est ouverte. C'est écrit noir sur blanc dans
 * l'interface : promettre une notification qui n'arrivera jamais est pire que
 * ne rien promettre. De vraies notifications hors-app exigeraient un service
 * worker et des Web Push — non fait, non prétendu.
 */
export function DailyBar() {
  const prospects = useAlpha((s) => s.prospects);
  const meetings = useAlpha((s) => s.meetings);
  const log = useAlpha((s) => s.standardLog);
  const toggleStandardItem = useAlpha((s) => s.toggleStandardItem);
  const setStandardHeld = useAlpha((s) => s.setStandardHeld);

  const [perm, setPerm] = useState<NotificationPermission | "indisponible">("default");
  const [lastNotified, setLastNotified] = useState<string>("");

  useEffect(() => {
    if (typeof Notification === "undefined") setPerm("indisponible");
    else setPerm(Notification.permission);
  }, []);

  const now = useMemo(() => new Date(), []);
  const today = now.toISOString().slice(0, 10);
  const checked = useMemo(() => log.find((d) => d.date === today)?.checked ?? [], [log, today]);

  // Le CA encaissé pilote le palier — donc les actions structurelles du jour.
  const cashed = useMemo(
    () =>
      prospects.reduce(
        (s, p) => s + (p.payments ?? []).filter((x) => x.status === "paye").reduce((a, x) => a + x.amount, 0),
        0
      ),
    [prospects]
  );

  const std = useMemo(
    () => dailyStandard(prospects, meetings, cashed, checked, now),
    [prospects, meetings, cashed, checked, now]
  );
  const serie = useMemo(() => streak(log, now), [log, now]);

  // Le verdict du jour est figé à chaque changement : c'est lui qui fait la série.
  useEffect(() => {
    setStandardHeld(std.held);
  }, [std.held, setStandardHeld]);

  const notify = useCallback(() => {
    if (perm !== "granted") return;
    const r = reminderText(std);
    if (!r) return;
    const key = `${today}-${std.doneCount}`;
    if (key === lastNotified) return; // pas deux fois le même état
    setLastNotified(key);
    try {
      new Notification(r.title, { body: r.body, tag: "alpha-barre-du-jour" });
    } catch {
      // Une notification qui échoue ne doit rien casser à l'écran.
    }
  }, [perm, std, today, lastNotified]);

  // Rappel toutes les 90 minutes tant que l'app est ouverte.
  useEffect(() => {
    if (perm !== "granted") return;
    const t = setInterval(notify, 90 * 60_000);
    return () => clearInterval(t);
  }, [perm, notify]);

  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") notify();
  };

  const groups: { kind: BarItem["kind"]; label: string; icon: React.ReactNode }[] = [
    { kind: "echeance", label: "Aujourd'hui — ça ne se reporte pas", icon: <CalendarClock size={13} className="text-signal-red" /> },
    { kind: "closing", label: "Quelqu'un attend", icon: <Target size={13} className="text-signal-green" /> },
    { kind: "palier", label: std.palier.name.split(" — ")[0], icon: <Gauge size={13} className="text-bronze-400" /> },
  ];

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-paper">
          <Flame size={15} className={serie > 0 ? "text-signal-amber" : "text-paper-faint"} /> La barre du jour
        </h2>
        <div className="flex items-center gap-3 text-[11.5px]">
          {serie > 0 && (
            <span className="text-signal-amber">
              {serie} jour{serie > 1 ? "s" : ""} d&apos;affilée
            </span>
          )}
          <span className={cn("font-mono", std.held ? "text-signal-green" : "text-paper-faint")}>
            {std.doneCount}/{std.total}
          </span>
          {perm === "granted" ? (
            <span className="flex items-center gap-1 text-paper-faint">
              <Bell size={12} /> rappels actifs
            </span>
          ) : perm === "indisponible" ? null : (
            <button onClick={askPermission} className="flex items-center gap-1 text-bronze-400 hover:underline">
              <BellOff size={12} /> activer les rappels
            </button>
          )}
        </div>
      </div>

      <p
        className={cn(
          "rounded-xl border px-3 py-2 text-[12.5px]",
          std.held
            ? "border-signal-green/40 bg-signal-green/5 text-signal-green"
            : "border-bronze-700/40 bg-bronze-900/10 text-paper"
        )}
      >
        {std.verdict}
      </p>

      {groups.map((g) => {
        const items = std.items.filter((i) => i.kind === g.kind);
        if (items.length === 0) return null;
        return (
          <div key={g.kind}>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-paper-faint">
              {g.icon} {g.label}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {items.map((i) => (
                <li key={i.id} className="flex items-start gap-2">
                  <button
                    onClick={() => !i.measured && toggleStandardItem(i.id, std.held)}
                    disabled={i.measured}
                    className={cn("mt-0.5 shrink-0", i.measured ? "cursor-default" : "cursor-pointer")}
                    title={i.measured ? "Validé automatiquement par les données" : "Cocher"}
                  >
                    {i.done ? (
                      <Check size={14} className="text-signal-green" />
                    ) : (
                      <Square size={14} className="text-paper-faint" />
                    )}
                  </button>
                  <span className="text-[12px]">
                    {i.href ? (
                      <Link href={i.href} className={cn(i.done ? "text-paper-faint line-through" : "text-paper hover:text-bronze-400")}>
                        {i.label}
                      </Link>
                    ) : (
                      <span className={i.done ? "text-paper-faint line-through" : "text-paper-dim"}>{i.label}</span>
                    )}
                    <span className="block text-[11px] text-paper-faint">{i.why}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {perm !== "granted" && perm !== "indisponible" && (
        <p className="text-[11px] text-paper-faint">
          Les rappels n&apos;arrivent que pendant que cette application est ouverte. Pour des
          notifications hors-app, il faudrait un service worker — ce n&apos;est pas encore fait, et
          je préfère te le dire que te le laisser croire.
        </p>
      )}
    </section>
  );
}
