"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  AudioLines,
  BadgeEuro,
  BarChart3,
  Bot,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Coins,
  Cpu,
  FileText,
  Footprints,
  Gauge,
  Gem,
  Handshake,
  Kanban,
  ListChecks,
  Linkedin,
  Mail,
  Mic,
  Newspaper,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  ScrollText,
  Search,
  Send,
  Settings,
  Sprout,
  Swords,
  Trophy,
  UserCog,
} from "lucide-react";
import { Eagle } from "@/components/eagle";
import { cn } from "@/lib/utils";
import { useAlpha } from "@/lib/store";
import { eur, relativeFr } from "@/lib/utils";
import { weightedValue } from "@/lib/hormozi";
import { LockGate } from "@/components/security/lock-gate";
import { AuthGate } from "@/components/security/auth-gate";
import { AuthSync } from "@/components/security/auth-sync";
import { Onboarding } from "@/components/onboarding";
import { OperatorTour } from "@/components/tour/operator-tour";
import { PageGuide } from "@/components/page-guide";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { N8nAutoSync } from "@/components/n8n-autosync";

const NAV = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/aujourdhui", label: "Aujourd'hui", icon: CalendarCheck },
  { href: "/decisions", label: "À décider", icon: ListChecks },
  { href: "/demarrage", label: "Prise en main", icon: Footprints },
  { href: "/pilote", label: "Pilote", icon: Cpu },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/closer", label: "Closer OS", icon: Navigation },
  { href: "/debrief", label: "Débrief terrain", icon: Mic },
  { href: "/voice", label: "Alpha Voice", icon: AudioLines },
  { href: "/appels", label: "Appels", icon: PhoneCall },
  { href: "/linkedin", label: "LinkedIn", icon: Linkedin },
  { href: "/prescripteurs", label: "Prescripteurs", icon: Handshake },
  { href: "/agent", label: "Agent ALPHA", icon: Bot },
  { href: "/templates", label: "Templates", icon: ScrollText },
  { href: "/audits", label: "Audits", icon: FileText },
  { href: "/campaigns", label: "Campagnes", icon: Mail },
  { href: "/outbox", label: "Boîte d'envoi", icon: Send },
  { href: "/newsletter", label: "Newsletter", icon: Newspaper },
  { href: "/kpis", label: "KPIs", icon: Gauge },
  { href: "/milestones", label: "Jalons", icon: Trophy },
  { href: "/preuves", label: "Preuves", icon: Gem },
  { href: "/offre", label: "Offre & Tarifs", icon: BadgeEuro },
  { href: "/payouts", label: "Payouts", icon: Coins },
  { href: "/meetings", label: "Rendez-vous", icon: CalendarDays },
  { href: "/nurture", label: "Relances", icon: Sprout },
  { href: "/intel", label: "Concurrents", icon: Swords },
  { href: "/activity", label: "Activité", icon: Activity },
  { href: "/recette", label: "Recette", icon: ClipboardCheck },
  { href: "/compte", label: "Compte", icon: UserCog },
  { href: "/settings", label: "Réglages", icon: Settings },
];

// Sur téléphone, le Closer OS remplace Templates : c'est LE compagnon terrain.
const MOBILE_NAV = NAV.filter((n) =>
  ["/aujourdhui", "/decisions", "/closer", "/debrief", "/settings"].includes(n.href)
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

  // Collapsible sidebar — persisted per browser. Lazy-init from localStorage
  // (client only; the shell renders splash on the server so no hydration risk).
  const [collapsed, setCollapsed] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem("alpha_sidebar_collapsed") === "1"
  );
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined")
        localStorage.setItem("alpha_sidebar_collapsed", next ? "1" : "0");
      return next;
    });

  // Mounted gate: all content is driven by localStorage (local-first), which
  // the server can't know. Server and first client paint both render the
  // splash — identical markup, zero hydration mismatch — then real data.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Raccourcis : ⌘/Ctrl+K (recherche) · ⌘/Ctrl+B (replier la sidebar)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // L'écran de connexion (/gate) vit HORS du shell : pas de sidebar, pas
  // d'assistant, pas de visite guidée par-dessus le mot de passe.
  if (pathname === "/gate") return <>{children}</>;

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
    <>
    <AuthSync />
    <AuthGate>
    <LockGate>
    <Onboarding />
    <OperatorTour />
    <PageGuide />
    <N8nAutoSync />
    <div className="flex min-h-screen">
      {/* Sidebar — desktop (repliable : ⌘B ou le bouton) */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-ink-700 bg-ink-900/60 backdrop-blur-xl sticky top-0 h-screen transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className={cn("border-b border-ink-700", collapsed ? "px-2 py-4" : "px-5 py-6")}>
          <Link
            href="/"
            className={cn("flex items-center gap-3 group", collapsed && "justify-center")}
            title="ALPHA SALES OS — Dashboard"
          >
            <span className="text-bronze-400 transition-transform group-hover:scale-105">
              <Eagle size={collapsed ? 30 : 38} glow />
            </span>
            {!collapsed && (
              <span>
                <span className="block font-display text-sm font-extrabold tracking-[0.04em] text-paper">
                  ALPHA <span className="text-bronze-400">SALES OS</span>
                </span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-paper-faint">
                  Eagleye Corp — Lyon
                </span>
              </span>
            )}
          </Link>
        </div>

        <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label="Rechercher (⌘K)"
            title="Rechercher (⌘K)"
            className={cn(
              "flex w-full items-center rounded-xl border border-ink-600 text-paper-faint transition-colors hover:border-bronze-700 hover:text-paper",
              collapsed ? "justify-center py-2" : "gap-2.5 px-3 py-2 text-left text-sm"
            )}
          >
            <Search size={14} />
            {!collapsed && (
              <>
                Rechercher…
                <kbd className="ml-auto rounded border border-ink-600 px-1.5 py-0.5 font-mono text-[9px] uppercase">⌘K</kbd>
              </>
            )}
          </button>
        </div>

        <nav className={cn("flex-1 overflow-y-auto py-3 space-y-0.5", collapsed ? "px-2" : "px-3")}>
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={isActive(href) ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                isActive(href)
                  ? "bg-bronze-900/70 text-bronze-300 font-medium"
                  : "text-paper-dim hover:text-paper hover:bg-ink-800"
              )}
            >
              <Icon size={17} strokeWidth={isActive(href) ? 2.4 : 1.8} />
              {!collapsed && label}
            </Link>
          ))}
        </nav>

        {!collapsed && (
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
        )}

        {/* Thème + repli */}
        <div className={cn("space-y-1 border-t border-ink-700", collapsed ? "px-2 py-2" : "px-3 py-2")}>
          <ThemeToggle variant={collapsed ? "icon" : "rail"} className={collapsed ? "mx-auto h-9 w-9" : ""} />
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Déplier la barre latérale (⌘B)" : "Replier la barre latérale (⌘B)"}
            title={collapsed ? "Déplier (⌘B)" : "Replier (⌘B)"}
            className={cn(
              "flex w-full items-center rounded-lg text-paper-faint transition-colors hover:text-paper hover:bg-ink-800",
              collapsed ? "justify-center py-2" : "gap-2.5 px-3 py-2 text-[12px]"
            )}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && "Replier"}
          </button>
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
          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" className="h-9 w-9" />
            <button
              onClick={() => setPaletteOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full border border-ink-600 text-paper-faint"
              aria-label="Rechercher"
            >
              <Search size={16} />
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Bottom nav — mobile (safe-area : barre gestuelle Android/iOS en PWA) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-ink-700 bg-ink-900/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
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
    </AuthGate>
    </>
  );
}
