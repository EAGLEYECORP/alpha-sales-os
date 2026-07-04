"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  Gauge,
  Kanban,
  Mail,
  Settings,
  Sprout,
  Swords,
} from "lucide-react";
import { Eagle } from "@/components/eagle";
import { cn } from "@/lib/utils";
import { useAlpha } from "@/lib/store";
import { eur } from "@/lib/utils";
import { weightedValue } from "@/lib/hormozi";
import { LockGate } from "@/components/security/lock-gate";
import { Onboarding } from "@/components/onboarding";

const NAV = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/agent", label: "Agent ALPHA", icon: Bot },
  { href: "/campaigns", label: "Campagnes", icon: Mail },
  { href: "/kpis", label: "KPIs", icon: Gauge },
  { href: "/meetings", label: "Rendez-vous", icon: CalendarDays },
  { href: "/nurture", label: "Nurture", icon: Sprout },
  { href: "/intel", label: "Intel Concurrents", icon: Swords },
  { href: "/activity", label: "Activité", icon: Activity },
  { href: "/settings", label: "Réglages", icon: Settings },
];

const MOBILE_NAV = NAV.filter((n) =>
  ["/", "/pipeline", "/agent", "/campaigns", "/settings"].includes(n.href)
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prospects = useAlpha((s) => s.prospects);
  const pipeValue = prospects.reduce((sum, p) => sum + weightedValue(p), 0);

  // Mounted gate: all content is driven by localStorage (local-first), which
  // the server can't know. Server and first client paint both render the
  // splash — identical markup, zero hydration mismatch — then real data.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950">
        <div className="animate-floaty text-center">
          <span className="mx-auto block text-bronze-400">
            <Eagle size={96} glow />
          </span>
          <p className="mt-4 font-display text-lg font-extrabold tracking-[0.1em] text-bronze-400">
            ALPHA SALES OS<sup>®</sup>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-faint">Eagleye Corp — Lyon</p>
        </div>
      </div>
    );
  }

  return (
    <LockGate>
    <Onboarding />
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-60 flex-col border-r border-ink-700 bg-ink-900/60 backdrop-blur-xl sticky top-0 h-screen">
        <div className="px-5 py-6 border-b border-ink-700">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="text-bronze-400 transition-transform group-hover:scale-105">
              <Eagle size={38} glow />
            </span>
            <span>
              <span className="block font-display text-sm font-extrabold tracking-[0.04em] text-paper">
                ALPHA <span className="text-bronze-400">SALES OS</span>
              </span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-paper-faint">
                Eagleye Corp — Lyon
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive(href)
                  ? "bg-bronze-900/70 text-bronze-300 font-medium"
                  : "text-paper-dim hover:text-paper hover:bg-ink-800"
              )}
            >
              <Icon size={17} strokeWidth={isActive(href) ? 2.4 : 1.8} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-ink-700 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Pipe pondéré</p>
          <p className="font-display text-xl font-extrabold text-bronze-400">{eur(pipeValue)}</p>
          <p className="mt-1 text-[10px] italic text-paper-faint">
            « La décision EST le produit. »
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>

      {/* Bottom nav — mobile */}
      <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-ink-700 bg-ink-900/95 backdrop-blur md:hidden">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px]",
              isActive(href) ? "text-bronze-400" : "text-paper-faint"
            )}
          >
            <Icon size={19} strokeWidth={isActive(href) ? 2.4 : 1.8} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
    </LockGate>
  );
}
