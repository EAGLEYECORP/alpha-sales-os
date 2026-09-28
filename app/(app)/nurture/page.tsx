"use client";

import { Mail, MessageSquare, Phone, Sprout } from "lucide-react";
import { useAlpha } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

const CHANNEL_ICON = {
  email: <Mail size={13} />,
  whatsapp: <MessageSquare size={13} />,
  appel: <Phone size={13} />,
};

export default function NurturePage() {
  const { nurture, upsertNurture, prospects } = useAlpha();
  const lost = prospects.filter((p) => p.stage === "perdu");
  const signed = prospects.filter((p) => p.stage === "signe");

  return (
    <div className="page">
      <PageHeader
        title="Relances long terme"
        subtitle="Deux automatismes : recontacter les « non » au bon moment (90 jours), et transformer chaque client signé en source de recommandations."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-paper-faint">En nurture (perdus)</p>
          <p className="font-mono text-2xl text-paper">{lost.length}</p>
          <p className="text-[11px] text-paper-faint">{lost.map((p) => p.company).join(" · ") || "—"}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wider text-paper-faint">Machine à referrals (signés)</p>
          <p className="font-mono text-2xl text-signal-green">{signed.length}</p>
          <p className="text-[11px] text-paper-faint">{signed.map((p) => p.company).join(" · ") || "—"}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {nurture.map((n) => (
          <div key={n.id} className={cn("card p-4", !n.active && "opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-medium text-paper">
                  <Sprout size={15} className="text-bronze-400" /> {n.name}
                </p>
                <p className="text-[11px] text-paper-faint">{n.audience}</p>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-paper-faint">
                <input
                  type="checkbox"
                  className="accent-bronze-500"
                  checked={n.active}
                  onChange={(e) => upsertNurture({ ...n, active: e.target.checked })}
                />
                active
              </label>
            </div>
            <ol className="relative mt-4 space-y-3 border-l border-ink-700 pl-5">
              {n.steps.map((s) => (
                <li key={s.id} className="relative">
                  <span className="absolute -left-[27px] grid h-5 w-5 place-items-center rounded-full border border-bronze-700 bg-ink-900 text-bronze-400">
                    {CHANNEL_ICON[s.channel]}
                  </span>
                  <p className="text-[11px] uppercase tracking-wider text-bronze-500">Jour {s.day} · {s.channel}</p>
                  <p className="text-sm text-paper-dim">{s.content}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
