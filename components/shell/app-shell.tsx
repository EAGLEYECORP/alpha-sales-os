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
  ScrollText,
  Search,
  Settings,
  Sprout,
  Swords,
} from "lucide-react";
import { Eagle } from "@/components/eagle";
import { cn } from "@/lib/utils";
import { useAlpha } from "@/lib/store";
import { eur, relativeFr } from "@/lib/utils";
import { weightedValue } from "@/lib/hormozi";
import { LockGate } from "@/components/security/lock-gate";
import { Onboarding } from "@/components/onboarding";
import { CommandPalette } from "@/components/command-palette";

const NAV = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/agent", label: "Agent ALPHA", icon: Bot },
  { href: "/templates", label: "Templates", icon: ScrollText },
  { href: "/campaigns", label: "Campagnes", icon: Mail },
  { href: "/kpis", label: "KPIs", icon: Gauge },
  { href: "/meetings", label: "Rendez-vous", icon: CalendarDays },
  { href: "/nurture", label: "Relances", icon: Sprout },
  { href: "/intel", label: "Concurrents", icon: Swords },
  { href: "/activity", label: "Activité", icon: Activity },
  { href: "/settings", label: "Réglages", icon: Settings },
];

const MOBILE_NAV = NAV.filter((n) =>
  ["/", "/pipeline", "/agent", "/templates", "/settings"].includes(n.href)
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prospects = useAlpha((s) => s.prospects);
  const meetings = useAlpha((s) => s.meetings);
  const pipeValue = prospects.reduce((sum, p) => sum + weightedValue(p), 0);
  const nextMeeting = meetings
    .filter((m) => !m.done && new Date(m.date) > new Date(Date.now() - 36e5))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const [paletteOpen, setPaletteOpen] = useState(false);

  // Mounted gate: all content is driven by localStorage (local-first), which
  // the server can't know. Server and first client paint both render the
  // splash — identical markup, zero hydration mismatch — then real data.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Recherche globale : Ctrl/Cmd+K partout
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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

        <div className="px-3 pt-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-ink-600 px-3 py-2 text-left text-sm text-paper-faint transition-colors hover:border-bronze-700 hover:text-paper"
          >
            <Search size={14} />
            Rechercher…
            <kbd className="ml-auto rounded border border-ink-600 px-1.5 py-0.5 font-mono text-[9px] uppercase">⌘K</kbd>
          </button>
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

        <div className="space-y-2.5 border-t border-ink-700 p-4">
          {nextMeeting && (
            <Link href="/meetings" className="block">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Prochain RDV</p>
              <p className="truncate text-[12px] font-medium text-paper">
                {nextMeeting.title}{" "}
                <span className="font-mono text-bronze-400">{relativeFr(nextMeeting.date)}</span>
              </p>
            </Link>
          )}
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-paper-faint">Pipe pondéré</p>
            <p className="font-display text-xl font-extrabold text-bronze-400">{eur(pipeValue)}</p>
          </div>
          <p className="text-[10px] italic text-paper-faint">« La décision EST le produit. »</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        {/* Header mobile — logo + recherche */}
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-700 bg-ink-950/90 px-4 py-2.5 backdrop-blur-xl md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-bronze-400"><Eagle size={26} glow /></span>
            <span className="font-display text-[13px] font-extrabold tracking-[0.04em] text-paper">
              ALPHA <span className="text-bronze-400">SALES OS</span>
            </span>
          </Link>
          <button
            onClick={() => setPaletteOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full border border-ink-600 text-paper-faint"
            aria-label="Rechercher"
          >
            <Search size={16} />
          </button>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

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
