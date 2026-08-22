"use client";

import Link from "next/link";
import { Activity as ActivityIcon, Bot, CalendarDays, Mail, PartyPopper, Skull, UserPlus } from "lucide-react";
import { useAlpha } from "@/lib/store";
import type { Activity } from "@/lib/types";
import { cn, dateTimeFr } from "@/lib/utils";

const KIND_META: Record<Activity["kind"], { icon: React.ReactNode; tone: string }> = {
  prospect: { icon: <UserPlus size={14} />, tone: "text-bronze-400 border-bronze-700" },
  stage: { icon: <ActivityIcon size={14} />, tone: "text-paper-dim border-ink-600" },
  meeting: { icon: <CalendarDays size={14} />, tone: "text-bronze-400 border-bronze-700" },
  campagne: { icon: <Mail size={14} />, tone: "text-paper-dim border-ink-600" },
  ia: { icon: <Bot size={14} />, tone: "text-bronze-300 border-bronze-600" },
  systeme: { icon: <ActivityIcon size={14} />, tone: "text-paper-faint border-ink-700" },
  signe: { icon: <PartyPopper size={14} />, tone: "text-signal-green border-signal-green/50" },
  perdu: { icon: <Skull size={14} />, tone: "text-signal-red border-signal-red/50" },
};

export default function ActivityPage() {
  const { activities, auditLog, settings } = useAlpha();

  return (
    <div className="space-y-5 animate-fade-up">
      <header>
        <h1 className="font-display text-2xl font-bold text-paper">Fil d&apos;activité</h1>
        <p className="text-sm text-paper-faint">Tout ce qui bouge dans l&apos;OS, en un seul flux.</p>
      </header>

      <section className="card p-4">
        <ol className="relative space-y-4 border-l border-ink-700 pl-6">
          {activities.map((a) => {
            const meta = KIND_META[a.kind];
            return (
              <li key={a.id} className="relative">
                <span className={cn("absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full border bg-ink-900", meta.tone)}>
                  {meta.icon}
                </span>
                <p className="text-sm text-paper">
                  {a.prospectId ? (
                    <Link href={`/prospects/${a.prospectId}`} className="hover:text-bronze-300">
                      {a.message}
                    </Link>
                  ) : (
                    a.message
                  )}
                </p>
                <p className="text-[11px] text-paper-faint">{dateTimeFr(a.date)}</p>
              </li>
            );
          })}
          {activities.length === 0 && <p className="text-sm text-paper-faint">Rien pour l&apos;instant.</p>}
        </ol>
      </section>

      {settings.role === "team" && auditLog.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-display text-sm font-semibold text-paper">Journal d&apos;audit</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-ink-700 text-left text-paper-faint">
                  <th className="py-1.5 pr-4">Date</th>
                  <th className="py-1.5 pr-4">Acteur</th>
                  <th className="py-1.5 pr-4">Action</th>
                  <th className="py-1.5">Cible</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.slice(0, 50).map((e) => (
                  <tr key={e.id} className="border-b border-ink-800 text-paper-dim">
                    <td className="py-1.5 pr-4 font-mono">{dateTimeFr(e.date)}</td>
                    <td className="py-1.5 pr-4">{e.actor}</td>
                    <td className="py-1.5 pr-4">{e.action}</td>
                    <td className="py-1.5">{e.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
